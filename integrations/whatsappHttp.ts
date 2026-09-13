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

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  return fallback;
}

function encryptAccessToken(token: string) {
  const key = Buffer.from(credentialsEncryptionKey, 'base64');
  if (key.length !== 32) throw new Error('WHATSAPP_CREDENTIALS_ENCRYPTION_KEY deve ser uma chave base64 de 32 bytes.');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}

export function decryptWhatsAppAccessToken(encryptedValue: string) {
  const key = Buffer.from(credentialsEncryptionKey, 'base64');
  if (key.length !== 32) throw new Error('WHATSAPP_CREDENTIALS_ENCRYPTION_KEY deve ser uma chave base64 de 32 bytes.');
  const payload = Buffer.from(encryptedValue, 'base64');
  if (payload.length < 29) throw new Error('O token criptografado do WhatsApp estÃ¡ invÃ¡lido. Reconecte a conta.');
  const iv = payload.subarray(0, 12);
  const authTag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
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
      res.status(200).json({
        configured: Boolean(data),
        config: data || null,
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
    const twoFactorPin = String(req.body?.twoFactorPin || '').trim();
    if (!phoneNumberId || !accessToken) {
      res.status(400).json({ error: 'Phone Number ID e token da Meta sao obrigatorios.' });
      return;
    }

    const metaPhone = await validateMetaCredentials(phoneNumberId, accessToken);
    await registerMetaNumber(phoneNumberId, accessToken, twoFactorPin);
    const encryptedAccessToken = encryptAccessToken(accessToken);
    const { error } = await db.from('whatsapp_config').upsert({
      user_id: userId,
      phone_number_id: phoneNumberId,
      waba_id: wabaId,
      access_token: null,
      access_token_encrypted: encryptedAccessToken,
      verify_token: null,
      status: 'connected',
      connected_at: new Date().toISOString(),
      registered_at: twoFactorPin ? new Date().toISOString() : null,
      subscribed_apps_at: null,
      last_registration_error: null,
    }, { onConflict: 'user_id' });
    if (error) throw error;
    res.status(200).json({ connected: true, phone: metaPhone });
  } catch (error) {
    const message = errorMessage(error, 'Falha ao configurar WhatsApp.');
    res.status(/Sessao|Authorization/i.test(message) ? 401 : 400).json({ error: message });
  }
}

export async function handleWhatsAppTemplates(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Metodo nao permitido.' });
    return;
  }

  try {
    const { userId, db } = await authenticate(req);
    const { data: config, error } = await db
      .from('whatsapp_config')
      .select('waba_id,access_token_encrypted,status')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!config || config.status !== 'connected') throw new Error('Conecte o WhatsApp Business antes de atualizar os templates.');
    if (!config.waba_id) throw new Error('Informe o WABA ID na conexao para atualizar os templates da Meta.');
    if (!config.access_token_encrypted) throw new Error('O token da Meta nao esta disponivel. Reconecte o WhatsApp Business.');

    const accessToken = decryptWhatsAppAccessToken(config.access_token_encrypted);
    const templates: unknown[] = [];
    let nextUrl: string | null = `https://graph.facebook.com/${metaGraphVersion}/${encodeURIComponent(config.waba_id)}/message_templates?limit=100&fields=id,name,status,language,category,quality_score,components`;
    let pages = 0;

    while (nextUrl && pages < 50) {
      const response = await fetch(nextUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(15_000),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error?.message || 'A Meta recusou a consulta dos templates.');
      if (Array.isArray(body.data)) templates.push(...body.data);
      nextUrl = typeof body?.paging?.next === 'string' ? body.paging.next : null;
      pages += 1;
    }

    res.status(200).json({ templates, total: templates.length, fetchedAt: new Date().toISOString() });
  } catch (error) {
    const message = errorMessage(error, 'Falha ao atualizar templates do WhatsApp.');
    res.status(/Sessao|Authorization/i.test(message) ? 401 : 400).json({ error: message });
  }
}
