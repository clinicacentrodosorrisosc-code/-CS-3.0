import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { fallbackSupabaseAnonKey } from './clinicaExpertsHttp.js';

type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: any;
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
};

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://dmslcvvjxfulsocksave.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || fallbackSupabaseAnonKey;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const metaGraphVersion = process.env.META_GRAPH_VERSION || 'v23.0';
const appPublicUrl = (process.env.APP_PUBLIC_URL || '').replace(/\/$/, '');
const credentialsEncryptionKey = process.env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY || '';
const publicSupabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function encryptAccessToken(token: string) {
  const key = Buffer.from(credentialsEncryptionKey, 'base64');
  if (key.length !== 32) throw new Error('WHATSAPP_CREDENTIALS_ENCRYPTION_KEY deve ser uma chave base64 de 32 bytes.');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}

async function authenticate(req: ApiRequest) {
  const bearer = headerValue(req.headers.authorization)?.replace(/^Bearer\s+/i, '') || '';
  if (!bearer) throw new Error('Sessao ausente. Faca login novamente.');
  const { data: { user }, error } = await publicSupabase.auth.getUser(bearer);
  if (error || !user) throw new Error('Sessao invalida. Faca login novamente.');
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY nao configurada.');
  return {
    userId: user.id,
    db: createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } }),
  };
}

async function validateMetaCredentials(phoneNumberId: string, accessToken: string) {
  const response = await fetch(`https://graph.facebook.com/${metaGraphVersion}/${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name,quality_rating`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body?.error?.message || 'A Meta recusou as credenciais informadas.';
    throw new Error(message);
  }
  return body;
}

async function registerMetaNumber(phoneNumberId: string, accessToken: string, twoFactorPin: string) {
  if (!twoFactorPin) return;
  const response = await fetch(`https://graph.facebook.com/${metaGraphVersion}/${encodeURIComponent(phoneNumberId)}/register`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', pin: twoFactorPin }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || 'A Meta recusou registrar o número.');
}

async function subscribeMetaApp(wabaId: string | null, accessToken: string) {
  if (!wabaId) return;
  const response = await fetch(`https://graph.facebook.com/${metaGraphVersion}/${encodeURIComponent(wabaId)}/subscribed_apps`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || 'A Meta recusou assinar o aplicativo no WABA.');
}

export async function handleWhatsAppConfig(req: ApiRequest, res: ApiResponse) {
  if (!['GET', 'POST', 'DELETE'].includes(req.method || '')) {
    res.status(405).json({ error: 'Metodo nao permitido.' });
    return;
  }
  try {
    const { userId, db } = await authenticate(req);
    if (req.method === 'GET') {
      const { data, error } = await db.from('whatsapp_config').select('phone_number_id,waba_id,status,connected_at,updated_at,registered_at,subscribed_apps_at,last_registration_error').eq('user_id', userId).maybeSingle();
      if (error) throw error;
      const requestOrigin = headerValue(req.headers.origin)?.replace(/\/$/, '');
      const baseUrl = appPublicUrl || requestOrigin || null;
      res.status(200).json({
        configured: Boolean(data),
        config: data || null,
        webhook: data && baseUrl ? { callbackUrl: `${baseUrl}/api/integrations/whatsapp/meta/webhook`, verifyToken: 'o token configurado abaixo', fields: ['messages', 'message_template_status_update'] } : null,
      });
      return;
    }
    if (req.method === 'DELETE') {
      const { error } = await db.from('whatsapp_config').delete().eq('user_id', userId);
      if (error) throw error;
      res.status(200).json({ connected: false });
      return;
    }

    const phoneNumberId = String(req.body?.phoneNumberId || '').trim();
    const wabaId = String(req.body?.wabaId || '').trim() || null;
    const accessToken = String(req.body?.accessToken || '').trim();
    const verifyToken = String(req.body?.verifyToken || '').trim() || null;
    const twoFactorPin = String(req.body?.twoFactorPin || '').trim();
    if (!phoneNumberId || !accessToken) {
      res.status(400).json({ error: 'Phone Number ID e token da Meta sao obrigatorios.' });
      return;
    }

    const metaPhone = await validateMetaCredentials(phoneNumberId, accessToken);
    await registerMetaNumber(phoneNumberId, accessToken, twoFactorPin);
    await subscribeMetaApp(wabaId, accessToken);
    const encryptedAccessToken = encryptAccessToken(accessToken);
    const { error } = await db.from('whatsapp_config').upsert({
      user_id: userId,
      phone_number_id: phoneNumberId,
      waba_id: wabaId,
      access_token: null,
      access_token_encrypted: encryptedAccessToken,
      verify_token: verifyToken,
      status: 'connected',
      connected_at: new Date().toISOString(),
      registered_at: twoFactorPin ? new Date().toISOString() : null,
      subscribed_apps_at: wabaId ? new Date().toISOString() : null,
      last_registration_error: null,
    }, { onConflict: 'user_id' });
    if (error) throw error;
    res.status(200).json({ connected: true, phone: metaPhone });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao configurar WhatsApp.';
    res.status(/Sessao|Authorization/i.test(message) ? 401 : 400).json({ error: message });
  }
}
