import crypto from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { fallbackSupabaseAnonKey } from './clinicaExpertsHttp.js';

type ApiRequest = { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown };
type ApiResponse = { status: (code: number) => ApiResponse; json: (body: unknown) => void };

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://dmslcvvjxfulsocksave.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || fallbackSupabaseAnonKey;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const wahaBaseUrl = (process.env.WAHA_BASE_URL || '').replace(/\/$/, '');
const wahaApiKey = process.env.WAHA_API_KEY || '';
const wahaWebhookSecret = process.env.WAHA_WEBHOOK_SECRET || '';

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function wahaHeaders() {
  return { 'X-Api-Key': wahaApiKey, 'Content-Type': 'application/json' };
}

function wahaIsConfigured() {
  return Boolean(wahaBaseUrl && wahaApiKey);
}

function validSessionName(value: string) {
  return /^[a-zA-Z0-9_-]{3,80}$/.test(value);
}

async function authenticate(req: ApiRequest) {
  const bearer = headerValue(req.headers.authorization)?.replace(/^Bearer\s+/i, '') || '';
  if (!bearer) throw new Error('Sessao ausente. Faca login novamente.');

  const authClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error } = await authClient.auth.getUser(bearer);
  if (error || !user) throw new Error('Sessao invalida. Faca login novamente.');
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY nao configurada.');

  return {
    userId: user.id,
    db: createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } }),
  };
}

async function callWaha(path: string, init: RequestInit = {}) {
  if (!wahaIsConfigured()) throw new Error('WAHA_BASE_URL e WAHA_API_KEY precisam ser configurados no servidor.');
  try {
    return await fetch(`${wahaBaseUrl}${path}`, {
      ...init,
      headers: { ...wahaHeaders(), ...init.headers },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new Error('O WAHA nao respondeu em 15 segundos.');
    }
    throw new Error('Nao foi possivel conectar ao WAHA.');
  }
}

async function startSession(sessionName: string) {
  const create = await callWaha('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({
      name: sessionName,
      config: { ignore: { status: true, broadcast: true, channels: true, groups: true } },
    }),
  });
  if (!create.ok && ![409, 422].includes(create.status)) throw new Error(`WAHA recusou criar a sessao (HTTP ${create.status}).`);

  const start = await callWaha(`/api/sessions/${encodeURIComponent(sessionName)}/start`, {
    method: 'POST',
    body: '{}',
  });
  if (!start.ok && ![409, 422].includes(start.status)) throw new Error(`WAHA recusou iniciar a sessao (HTTP ${start.status}).`);

  const status = await callWaha(`/api/sessions/${encodeURIComponent(sessionName)}`, { method: 'GET' });
  if (!status.ok) throw new Error(`WAHA nao retornou o estado da sessao (HTTP ${status.status}).`);
  const body = await status.json().catch(() => ({})) as { status?: string; qr?: string };
  return { status: body.status || 'STARTING', qr: body.qr || null };
}

export async function handleWahaConfig(req: ApiRequest, res: ApiResponse) {
  if (!['GET', 'POST', 'DELETE'].includes(req.method || '')) return res.status(405).json({ error: 'Metodo nao permitido.' });

  try {
    const { userId, db } = await authenticate(req);
    if (req.method === 'GET') {
      const { data, error } = await db
        .from('whatsapp_config')
        .select('provider,waha_session_name,waha_status,waha_last_error,connected_at,updated_at')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return res.status(200).json({ configured: data?.provider === 'waha', available: wahaIsConfigured(), config: data || null });
    }

    if (req.method === 'DELETE') {
      const { data } = await db.from('whatsapp_config').select('waha_session_name').eq('user_id', userId).maybeSingle();
      if (data?.waha_session_name && wahaIsConfigured()) {
        await callWaha(`/api/sessions/${encodeURIComponent(data.waha_session_name)}`, { method: 'DELETE' });
      }
      const { error } = await db.from('whatsapp_config').delete().eq('user_id', userId);
      if (error) throw error;
      return res.status(200).json({ connected: false });
    }

    const sessionName = String((req.body as { sessionName?: unknown })?.sessionName || '').trim();
    if (!validSessionName(sessionName)) return res.status(400).json({ error: 'Nome da sessao invalido. Use 3 a 80 letras, numeros, hifen ou underscore.' });

    const session = await startSession(sessionName);
    const { error } = await db.from('whatsapp_config').upsert({
      user_id: userId,
      provider: 'waha',
      waha_session_name: sessionName,
      waha_status: session.status,
      waha_last_error: null,
      status: 'connected',
      connected_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (error) throw error;
    return res.status(200).json({ connected: true, session });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao configurar WAHA.';
    return res.status(/Sessao/i.test(message) ? 401 : 400).json({ error: message });
  }
}

type WahaEnvelope = {
  event?: string;
  session?: string;
  payload?: {
    id?: string;
    from?: string;
    to?: string;
    body?: string;
    fromMe?: boolean;
    type?: string;
    ack?: number;
    timestamp?: number;
  };
};

function verifySignature(rawBody: Buffer, signature: string | undefined) {
  if (!wahaWebhookSecret || !signature) return false;
  const expected = crypto.createHmac('sha512', wahaWebhookSecret).update(rawBody).digest('hex');
  const received = signature.replace(/^sha512=/i, '');
  return received.length === expected.length && crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

function phoneFromChatId(value: string | undefined) {
  const raw = (value || '').split('@')[0].replace(/\D/g, '');
  return raw.length >= 8 && raw.length <= 15 ? `+${raw}` : null;
}

async function findOrCreateConversation(db: SupabaseClient, userId: string, phone: string, name?: string) {
  const { data: existingContact, error: contactError } = await db.from('contacts').select('id').eq('user_id', userId).eq('phone', phone).limit(1).maybeSingle();
  if (contactError) throw contactError;
  let contactId = existingContact?.id as string | undefined;
  if (!contactId) {
    const { data, error } = await db.from('contacts').insert({ user_id: userId, phone, name: name || null }).select('id').single();
    if (error) throw error;
    contactId = data.id as string;
  }

  const { data: existingConversation, error: conversationError } = await db
    .from('conversations').select('id').eq('user_id', userId).eq('contact_id', contactId).order('last_message_at', { ascending: false }).limit(1).maybeSingle();
  if (conversationError) throw conversationError;
  if (existingConversation?.id) return existingConversation.id as string;

  const { data, error } = await db.from('conversations').insert({ user_id: userId, contact_id: contactId, status: 'open' }).select('id').single();
  if (error) throw error;
  return data.id as string;
}

export async function handleWahaWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>, res: ApiResponse) {
  const signature = headerValue(headers['x-webhook-hmac']) || headerValue(headers['X-Webhook-Hmac']);
  if (!verifySignature(rawBody, signature)) return res.status(401).json({ error: 'Webhook WAHA nao autorizado.' });

  let envelope: WahaEnvelope;
  try {
    envelope = JSON.parse(rawBody.toString('utf8')) as WahaEnvelope;
  } catch {
    return res.status(400).json({ error: 'Payload JSON invalido.' });
  }

  const sessionName = String(envelope.session || '');
  const payload = envelope.payload;
  if (!sessionName || !payload || !['message', 'message.any'].includes(envelope.event || '')) return res.status(200).json({ accepted: true, ignored: true });
  if (!serviceRoleKey) return res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY nao configurada.' });

  const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: config, error: configError } = await db.from('whatsapp_config').select('user_id').eq('provider', 'waha').eq('waha_session_name', sessionName).maybeSingle();
  if (configError) return res.status(500).json({ error: 'Falha ao localizar a sessao WAHA.' });
  if (!config) return res.status(404).json({ error: 'Sessao WAHA desconhecida.' });

  const eventKey = payload.id || crypto.createHash('sha256').update(rawBody).digest('hex');
  const { error: eventError } = await db.from('waha_webhook_events').insert({ user_id: config.user_id, event_key: eventKey, event_type: envelope.event, payload: envelope });
  if (eventError?.code === '23505') return res.status(200).json({ accepted: true, duplicate: true });
  if (eventError) return res.status(500).json({ error: 'Falha ao registrar evento WAHA.' });

  const phone = phoneFromChatId(payload.fromMe ? payload.to : payload.from);
  if (!phone || !payload.id) return res.status(200).json({ accepted: true, ignored: true });

  try {
    const conversationId = await findOrCreateConversation(db, config.user_id, phone);
    const createdAt = payload.timestamp ? new Date(payload.timestamp * 1000).toISOString() : new Date().toISOString();
    const direction = payload.fromMe ? 'agent' : 'customer';
    const { error: messageError } = await db.from('messages').insert({
      conversation_id: conversationId,
      sender_type: direction,
      content_type: payload.type || 'text',
      content_text: payload.body || null,
      message_id: payload.id,
      status: payload.fromMe ? 'sent' : 'delivered',
      created_at: createdAt,
    });
    if (messageError?.code !== '23505') throw messageError;

    await db.from('conversations').update({
      last_message_text: payload.body || null,
      last_message_at: createdAt,
      updated_at: new Date().toISOString(),
    }).eq('id', conversationId);
    return res.status(200).json({ accepted: true });
  } catch (error) {
    console.error('[waha.webhook] ingestion failed', error instanceof Error ? error.message : error);
    return res.status(500).json({ error: 'Falha ao processar mensagem WAHA.' });
  }
}
