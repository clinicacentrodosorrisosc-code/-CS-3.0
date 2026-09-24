import { createClient } from '@supabase/supabase-js';
import { ClinicaExpertsClient, createUserScopedSupabase, enrichClinicaExpertsOpportunityPhones, enrichClinicaExpertsOpportunityPhonesDirect, processClinicaExpertsOpportunityWebhook, syncClinicaExperts } from './clinicaExperts.js';
import crypto from 'crypto';

type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
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
const patientSearchCache = new Map<string, { expiresAt: number; patients: Array<{ id: string; name: string; phone: string | null; email: string | null }> }>();
const patientSearchBlockedUntil = new Map<string, number>();

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

export async function handleClinicaExpertsCrmReconciliation(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Metodo nao permitido.' });
    return;
  }
  const apiToken = process.env.CLINICA_EXPERTS_API_TOKEN || '';
  if (!apiToken) {
    res.status(503).json({ error: 'CLINICA_EXPERTS_API_TOKEN ainda nao foi configurado no servidor.' });
    return;
  }
  const pipelineExternalId = headerValue(req.query?.pipelineExternalId);
  if (!pipelineExternalId) {
    res.status(400).json({ error: 'Informe o funil para reconciliar.' });
    return;
  }
  try {
    const context = await resolveContext(req);
    const [{ data: pipeline, error: pipelineError }, externalRows] = await Promise.all([
      context.db.from('clinic_experts_pipelines').select('id').eq('user_id', context.userId).eq('external_id', pipelineExternalId).maybeSingle(),
      new ClinicaExpertsClient(apiToken).listOpportunities(pipelineExternalId),
    ]);
    if (pipelineError) throw pipelineError;
    if (!pipeline) throw new Error('Funil local nao encontrado. Sincronize o CRM antes de reconciliar.');
    const [{ data: stages, error: stagesError }, { data: localRows, error: localError }] = await Promise.all([
      context.db.from('clinic_experts_stages').select('id,external_id,name').eq('user_id', context.userId).eq('pipeline_id', pipeline.id),
      context.db.from('clinic_experts_opportunities').select('external_id,stage_id,title,patient_name,status,synced_at').eq('user_id', context.userId).eq('pipeline_id', pipeline.id),
    ]);
    if (stagesError) throw stagesError;
    if (localError) throw localError;
    const stageByExternal = new Map((stages || []).map(stage => [stage.external_id, stage]));
    const localByStage = new Map<string, typeof localRows>();
    for (const row of localRows || []) localByStage.set(row.stage_id, [...(localByStage.get(row.stage_id) || []), row]);
    const externalIds = new Set(externalRows.map(row => row.uuid));
    const localIds = new Set((localRows || []).map(row => row.external_id));
    const stagesReport = (stages || []).map(stage => {
      const remote = externalRows.filter(row => row.stage?.uuid === stage.external_id);
      const local = localByStage.get(stage.id) || [];
      const statuses = Object.entries(remote.reduce<Record<string, number>>((counts, row) => {
        const key = String(row.status || row.stage?.status || 'sem status');
        counts[key] = (counts[key] || 0) + 1;
        return counts;
      }, {})).sort((a, b) => b[1] - a[1]);
      return { stageId: stage.id, stage: stage.name, externalCount: remote.length, localCount: local.length, difference: local.length - remote.length, externalStatuses: statuses };
    });
    const onlyLocal = (localRows || []).filter(row => !externalIds.has(row.external_id)).slice(0, 100);
    const onlyExternal = externalRows.filter(row => !localIds.has(row.uuid)).slice(0, 100).map(row => ({ external_id: row.uuid, title: row.title || row.patient?.name || 'Oportunidade', patient_name: row.patient?.name || null, status: row.status || row.stage?.status || null, stage: stageByExternal.get(row.stage?.uuid || '')?.name || row.stage?.name || 'Etapa não mapeada' }));
    res.status(200).json({ data: { externalTotal: externalRows.length, localTotal: (localRows || []).length, stages: stagesReport, onlyLocal, onlyExternal } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao reconciliar o CRM.';
    res.status(/Sessao/i.test(message) ? 401 : 500).json({ error: message });
  }
}

export async function handleClinicaExpertsAgenda(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Metodo nao permitido.' });
    return;
  }

  const apiToken = process.env.CLINICA_EXPERTS_API_TOKEN || '';
  if (!apiToken) {
    res.status(503).json({ error: 'CLINICA_EXPERTS_API_TOKEN ainda nao foi configurado no servidor.' });
    return;
  }

  const queryValue = (key: string) => {
    const value = req.query?.[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const startsAt = queryValue('starts_at');
  const endsAt = queryValue('ends_at');
  const isValidDate = (value?: string) => Boolean(value && !Number.isNaN(Date.parse(value)));

  if (!isValidDate(startsAt) || !isValidDate(endsAt) || Date.parse(endsAt!) < Date.parse(startsAt!)) {
    res.status(400).json({ error: 'Informe um intervalo de datas valido para a agenda.' });
    return;
  }

  try {
    await resolveContext(req);
    const data = await new ClinicaExpertsClient(apiToken).listCalendarEvents(startsAt!, endsAt!);
    res.status(200).json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao consultar a agenda.';
    res.status(/Sessao/i.test(message) ? 401 : 500).json({ error: message });
  }
}

/**
 * Searches the patient's authoritative Clínica Experts directory. The API token
 * remains server-side; a single filtered page is requested, never the full base.
 */
export async function handleClinicaExpertsPatients(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Metodo nao permitido.' });
    return;
  }
  const apiToken = process.env.CLINICA_EXPERTS_API_TOKEN || '';
  if (!apiToken) {
    res.status(503).json({ error: 'CLINICA_EXPERTS_API_TOKEN ainda nao foi configurado no servidor.' });
    return;
  }
  const query = headerValue(req.query?.q)?.trim() || '';
  if (query.length < 2) {
    res.status(200).json({ data: [] });
    return;
  }
  let userId = '';
  try {
    const context = await resolveContext(req);
    userId = context.userId;
    const now = Date.now();
    const cacheKey = `${context.userId}:${query.toLocaleLowerCase('pt-BR')}`;
    const normalizedQuery = query.toLocaleLowerCase('pt-BR');
    const { data: localRows, error: localError } = await context.db
      .from('clinic_experts_opportunities')
      .select('patient_external_id,patient_name,patient_phone,patient_email')
      .eq('user_id', context.userId)
      .ilike('patient_name', `%${query}%`)
      .limit(50);
    if (localError) throw localError;
    const localPatients = [...new Map((localRows || [])
      .filter(row => row.patient_external_id && row.patient_name)
      .map(row => [String(row.patient_external_id), {
        id: String(row.patient_external_id),
        name: String(row.patient_name).trim(),
        phone: row.patient_phone || null,
        email: row.patient_email || null,
      }])).values()]
      .filter(patient => patient.name.toLocaleLowerCase('pt-BR').includes(normalizedQuery))
      .slice(0, 12);
    if (localPatients.length > 0) {
      res.status(200).json({ data: localPatients, source: 'synced' });
      return;
    }
    const blockedUntil = patientSearchBlockedUntil.get(context.userId) || 0;
    if (blockedUntil > now) {
      const retryInSeconds = Math.ceil((blockedUntil - now) / 1_000);
      res.status(429).json({ error: `A busca de pacientes está aguardando o limite da Clínica Experts. Tente novamente em ${retryInSeconds}s.` });
      return;
    }
    let cached = patientSearchCache.get(cacheKey);
    if (!cached || cached.expiresAt < now) {
      const response = await new ClinicaExpertsClient(apiToken).searchPatients(query);
      const patients = Array.isArray(response.data) ? response.data : [];
      cached = {
        expiresAt: now + 60_000,
        patients: patients
          .map(patient => ({
            id: String(patient.uuid || patient.id || ''),
            name: String(patient.name || '').trim(),
            phone: patient.phone || patient.cellphone || patient.mobile || patient.whatsapp || null,
            email: patient.email || null,
          }))
          .filter(patient => patient.id && patient.name),
      };
      patientSearchCache.set(cacheKey, cached);
    }
    const data = cached.patients
      .filter(patient => patient.name.toLocaleLowerCase('pt-BR').includes(normalizedQuery))
      .slice(0, 12);
    res.status(200).json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao buscar pacientes.';
    if (/HTTP 429/.test(message) && userId) patientSearchBlockedUntil.set(userId, Date.now() + 60_000);
    const rateLimited = /HTTP 429/.test(message);
    res.status(/Sessao/i.test(message) ? 401 : rateLimited ? 429 : 500).json({
      error: rateLimited
        ? 'A Clínica Experts limitou temporariamente a consulta direta de pacientes. A base já sincronizada continua disponível; tente novamente em 1 minuto para pacientes ainda não sincronizados.'
        : message,
    });
  }
}

export async function handleClinicaExpertsFinancial(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Metodo nao permitido.' });
    return;
  }
  const apiToken = process.env.CLINICA_EXPERTS_API_TOKEN || '';
  if (!apiToken) {
    res.status(503).json({ error: 'CLINICA_EXPERTS_API_TOKEN ainda nao foi configurado no servidor.' });
    return;
  }
  try {
    await resolveContext(req);
    const client = new ClinicaExpertsClient(apiToken);
    const queryValue = (key: string) => headerValue(req.query?.[key]);
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const startsAt = queryValue('starts_at') || startOfYear.toISOString();
    const endsAt = queryValue('ends_at') || today.toISOString();
    const startsAtMs = Date.parse(startsAt);
    const endsAtMs = Date.parse(endsAt);
    if (Number.isNaN(startsAtMs) || Number.isNaN(endsAtMs) || endsAtMs < startsAtMs) {
      res.status(400).json({ error: 'Informe um período financeiro válido.' });
      return;
    }
    if (endsAtMs - startsAtMs > 366 * 24 * 60 * 60 * 1000) {
      res.status(400).json({ error: 'A Clínica Experts permite consultar títulos e parcelas em períodos de até 1 ano.' });
      return;
    }
    const [accounts, categories, bills, parcels] = await Promise.all([
      client.listFinancialAccounts(),
      client.listFinancialCategories(),
      client.listBills(startsAt, endsAt),
      client.listParcels(startsAt, endsAt),
    ]);
    res.status(200).json({ data: { accounts, categories, bills, parcels, fetchedAt: new Date().toISOString() } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao consultar o financeiro da Clinica Experts.';
    res.status(/Sessao/i.test(message) ? 401 : 500).json({ error: message });
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
    const body = req.body && typeof req.body === 'object' ? req.body as { pipelineExternalId?: unknown } : {};
    const pipelineExternalId = typeof body.pipelineExternalId === 'string' && body.pipelineExternalId.trim()
      ? body.pipelineExternalId.trim()
      : undefined;
    const operation = syncClinicaExperts(context.db, context.userId, apiToken, pipelineExternalId)
      .finally(() => activeSyncs.delete(context.userId));
    activeSyncs.set(context.userId, operation);
    const result = await operation;
    res.status(200).json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha na sincronizacao.';
    res.status(/Sessao/i.test(message) ? 401 : 500).json({ error: message });
  }
}

export async function handleClinicaExpertsPhoneEnrichment(req: ApiRequest, res: ApiResponse) {
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
    const body = req.body && typeof req.body === 'object' ? req.body as { startPage?: unknown; pageCount?: unknown; strategy?: unknown; afterId?: unknown; limit?: unknown } : {};
    if (body.strategy === 'direct') {
      const result = await enrichClinicaExpertsOpportunityPhonesDirect(
        context.db,
        context.userId,
        apiToken,
        typeof body.afterId === 'string' ? body.afterId : undefined,
        Number(body.limit),
      );
      res.status(200).json({ data: result });
      return;
    }
    const startPage = Number(body.startPage);
    const pageCount = Number(body.pageCount);
    const result = await enrichClinicaExpertsOpportunityPhones(
      context.db,
      context.userId,
      apiToken,
      Number.isFinite(startPage) ? startPage : 1,
      Number.isFinite(pageCount) ? pageCount : 70,
    );
    res.status(200).json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao atualizar telefones.';
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
  const apiToken = process.env.CLINICA_EXPERTS_API_TOKEN || '';
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
      await processClinicaExpertsOpportunityWebhook(db, ownerUserId, payload, apiToken);
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
