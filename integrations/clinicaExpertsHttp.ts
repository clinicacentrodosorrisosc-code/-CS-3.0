import { createClient } from '@supabase/supabase-js';
import { createUserScopedSupabase, processClinicaExpertsOpportunityWebhook, syncClinicaExperts } from './clinicaExperts.js';
import crypto from 'crypto';

type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
};

const fallbackSupabaseUrl = 'https://dmslcvvjxfulsocksave.supabase.co';
export const fallbackSupabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtc2xjdnZqeGZ1bHNvY2tzYXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMDQyNjgsImV4cCI6MjA4NDg4MDI2OH0.H0iDEj58mdwSFnLlyn1a2n_k3UZBtf_rHH8w4BkzfUw';

const supabaseUrl = process.env.VITE_SUPABASE_URL || fallbackSupabaseUrl;
const supabaseAnonKey = process.env.VITE_SUPABASE_KEY || fallbackSupabaseAnonKey;
const publicSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const activeSyncs = new Map<string, Promise<unknown>>();

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function resolveContext(req: ApiRequest) {
  const authorization = headerValue(req.headers.authorization);
  const bearer = authorization?.replace(/^Bearer\s+/i, '') || '';
  const cronSecret = process.env.CRON_SECRET || '';
  const isCron = Boolean(cronSecret && bearer === cronSecret);

  if (isCron) {
    const ownerUserId = process.env.CLINICA_EXPERTS_OWNER_USER_ID || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!ownerUserId || !serviceRoleKey) {
      throw new Error('Sincronizacao agendada ainda nao foi configurada por completo.');
    }
    return {
      userId: ownerUserId,
      db: createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      }),
    };
  }

  if (!bearer) throw new Error('Sessao ausente. Faca login novamente.');
  const { data: { user }, error } = await publicSupabase.auth.getUser(bearer);
  if (error || !user) throw new Error('Sessao invalida. Faca login novamente.');
  return {
    userId: user.id,
    db: createUserScopedSupabase(supabaseUrl, supabaseAnonKey, bearer),
  };
}

export async function handleClinicaExpertsStatus(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Metodo nao permitido.' });
    return;
  }
  try {
    const context = await resolveContext(req);
    const { data, error } = await context.db
      .from('clinic_experts_sync_runs')
      .select('status, pipelines_count, stages_count, opportunities_count, started_at, finished_at, error_message')
      .eq('user_id', context.userId)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    res.status(200).json({
      configured: Boolean(process.env.CLINICA_EXPERTS_API_TOKEN),
      lastSync: data || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao consultar integracao.';
    res.status(/Sessao/i.test(message) ? 401 : 400).json({ error: message });
  }
}

export async function handleClinicaExpertsSync(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Metodo nao permitido.' });
    return;
  }
  const apiToken = process.env.CLINICA_EXPERTS_API_TOKEN || '';
  if (!apiToken) {
    res.status(503).json({ error: 'CLINICA_EXPERTS_API_TOKEN ainda nao foi configurado no servidor.' });
    return;
  }

  try {
    const context = await resolveContext(req);
    if (activeSyncs.has(context.userId)) {
      res.status(409).json({ error: 'Ja existe uma sincronizacao em andamento.' });
      return;
    }
    const operation = syncClinicaExperts(context.db, context.userId, apiToken)
      .finally(() => activeSyncs.delete(context.userId));
    activeSyncs.set(context.userId, operation);
    const result = await operation;
    res.status(200).json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha na sincronizacao.';
    res.status(/Sessao/i.test(message) ? 401 : 500).json({ error: message });
  }
}

export async function handleClinicaExpertsWebhook(req: ApiRequest & { params?: Record<string, string>; query?: Record<string, string | string[]>; body?: unknown }, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Metodo nao permitido.' });
    return;
  }

  const expectedSecret = process.env.CLINICA_EXPERTS_WEBHOOK_SECRET || '';
  const querySecret = Array.isArray(req.query?.secret) ? req.query.secret[0] : req.query?.secret;
  const suppliedSecret = req.params?.secret || querySecret || '';
  const isValidSecret = Boolean(
    expectedSecret
    && suppliedSecret.length === expectedSecret.length
    && crypto.timingSafeEqual(Buffer.from(suppliedSecret), Buffer.from(expectedSecret)),
  );
  if (!isValidSecret) {
    res.status(401).json({ error: 'Webhook nao autorizado.' });
    return;
  }

  const ownerUserId = process.env.CLINICA_EXPERTS_OWNER_USER_ID || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!ownerUserId || !serviceRoleKey) {
    res.status(503).json({ error: 'Integracao Clinica Experts incompleta no servidor.' });
    return;
  }

  const payload = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
  const eventName = String(payload.event || payload.type || payload.name || 'unknown');
  const deliveryId = String(payload.id || payload.delivery_id || payload.uuid || '');
  const eventKey = deliveryId || crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    let { data: eventRow, error: insertError } = await db
      .from('clinic_experts_webhook_events')
      .insert({
        user_id: ownerUserId,
        event_name: eventName,
        event_key: eventKey,
        source_payload: payload,
      })
      .select('id')
      .single();

    if (insertError?.code === '23505') {
      const { data: existingEvent, error: existingError } = await db
        .from('clinic_experts_webhook_events')
        .select('id,status')
        .eq('user_id', ownerUserId)
        .eq('event_key', eventKey)
        .single();
      if (existingError || !existingEvent) throw existingError || new Error('Webhook duplicado nao encontrado.');
      if (existingEvent.status === 'processed' || existingEvent.status === 'ignored') {
        res.status(200).json({ received: true, duplicate: true });
        return;
      }
      eventRow = existingEvent;
      insertError = null;
      await db.from('clinic_experts_webhook_events').update({ status: 'received', processed_at: null, error_message: null }).eq('id', eventRow.id);
    }
    if (insertError || !eventRow) throw insertError || new Error('Nao foi possivel registrar o webhook.');

    if (!eventName.startsWith('crm_opportunity.')) {
      await db.from('clinic_experts_webhook_events').update({ status: 'ignored', processed_at: new Date().toISOString() }).eq('id', eventRow.id);
      res.status(200).json({ received: true, ignored: true });
      return;
    }

    try {
      await processClinicaExpertsOpportunityWebhook(db, ownerUserId, payload);
      await db.from('clinic_experts_webhook_events').update({ status: 'processed', processed_at: new Date().toISOString(), error_message: null }).eq('id', eventRow.id);
      res.status(200).json({ received: true, processed: true });
    } catch (error) {
      await db.from('clinic_experts_webhook_events').update({ status: 'failed', processed_at: new Date().toISOString(), error_message: String(error instanceof Error ? error.message : error).slice(0, 1000) }).eq('id', eventRow.id);
      throw error;
    }
  } catch (error) {
    console.error('[CLINICA EXPERTS] Webhook error:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Falha ao registrar webhook.' });
  }
}
