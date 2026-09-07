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
const publicSupabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
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
  const response = await fetch(`https://graph.facebook.com/v23.0/${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name,quality_rating`, {
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

export async function handleWhatsAppConfig(req: ApiRequest, res: ApiResponse) {
  if (!['GET', 'POST', 'DELETE'].includes(req.method || '')) {
    res.status(405).json({ error: 'Metodo nao permitido.' });
    return;
  }
  try {
    const { userId, db } = await authenticate(req);
    if (req.method === 'GET') {
      const { data, error } = await db.from('whatsapp_config').select('phone_number_id,waba_id,status,connected_at,updated_at').eq('user_id', userId).maybeSingle();
      if (error) throw error;
      res.status(200).json({ configured: Boolean(data), config: data || null });
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
    if (!phoneNumberId || !accessToken) {
      res.status(400).json({ error: 'Phone Number ID e token da Meta sao obrigatorios.' });
      return;
    }

    const metaPhone = await validateMetaCredentials(phoneNumberId, accessToken);
    const { error } = await db.from('whatsapp_config').upsert({
      user_id: userId,
      phone_number_id: phoneNumberId,
      waba_id: wabaId,
      access_token: accessToken,
      verify_token: verifyToken,
      status: 'connected',
      connected_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (error) throw error;
    res.status(200).json({ connected: true, phone: metaPhone });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao configurar WhatsApp.';
    res.status(/Sessao|Authorization/i.test(message) ? 401 : 400).json({ error: message });
  }
}
