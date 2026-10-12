import crypto from 'node:crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { fallbackSupabaseAnonKey } from './supabasePublicConfig.js';

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
  if (payload.length < 29) throw new Error('O token criptografado do WhatsApp está inválido. Reconecte a conta.');
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

async function subscribeWabaToApp(wabaId: string, accessToken: string) {
  const response = await fetch(`https://graph.facebook.com/${metaGraphVersion}/${encodeURIComponent(wabaId)}/subscribed_apps`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || 'A Meta recusou assinar os eventos do WhatsApp.');
}

export async function handleWhatsAppConfig(req: ApiRequest, res: ApiResponse) {
  if (!['GET', 'POST', 'DELETE'].includes(req.method || '')) {
    res.status(405).json({ error: 'Metodo nao permitido.' });
    return;
  }
  try {
    const { userId, db } = await authenticate(req);
    if (req.method === 'GET') {
      let { data, error } = await db.from('whatsapp_config').select('phone_number_id,waba_id,meta_app_id,status,connected_at,updated_at,registered_at,subscribed_apps_at,last_registration_error,verify_token').eq('user_id', userId).maybeSingle();
      if (error) {
        const fallback = await db.from('whatsapp_config').select('phone_number_id,waba_id,status,connected_at,updated_at,registered_at,subscribed_apps_at,last_registration_error,verify_token').eq('user_id', userId).maybeSingle();
        data = fallback.data ? { ...fallback.data, meta_app_id: null } : null;
        error = fallback.error;
      }
      if (error) throw error;
      res.status(200).json({
        configured: Boolean(data),
        config: data || null,
        webhook: data?.verify_token ? { callbackUrl: `${appPublicUrl || 'https://centrodosorriso.vercel.app'}/api/integrations/whatsapp/meta/webhook`, verifyToken: data.verify_token } : null,
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
    const metaAppId = String(req.body?.metaAppId || '').trim() || null;
    const accessToken = String(req.body?.accessToken || '').trim();
    const twoFactorPin = String(req.body?.twoFactorPin || '').trim();
    if (!phoneNumberId || !accessToken) {
      res.status(400).json({ error: 'Phone Number ID e token da Meta sao obrigatorios.' });
      return;
    }

    const metaPhone = await validateMetaCredentials(phoneNumberId, accessToken);
    await registerMetaNumber(phoneNumberId, accessToken, twoFactorPin);
    let subscribedAppsAt: string | null = null;
    let subscriptionError: string | null = null;
    if (wabaId) {
      try {
        await subscribeWabaToApp(wabaId, accessToken);
        subscribedAppsAt = new Date().toISOString();
      } catch (error) {
        subscriptionError = errorMessage(error, 'Não foi possível assinar os eventos do WhatsApp.');
      }
    }
    const encryptedAccessToken = encryptAccessToken(accessToken);
    const verifyToken = crypto.randomBytes(24).toString('hex');
    const { error } = await db.from('whatsapp_config').upsert({
      user_id: userId,
      phone_number_id: phoneNumberId,
      waba_id: wabaId,
      meta_app_id: metaAppId,
      access_token: null,
      access_token_encrypted: encryptedAccessToken,
      verify_token: verifyToken,
      status: 'connected',
      connected_at: new Date().toISOString(),
      registered_at: twoFactorPin ? new Date().toISOString() : null,
      subscribed_apps_at: subscribedAppsAt,
      last_registration_error: subscriptionError,
    }, { onConflict: 'user_id' });
    if (error) throw error;
    res.status(200).json({ connected: true, phone: metaPhone, webhook: { callbackUrl: `${appPublicUrl || 'https://centrodosorriso.vercel.app'}/api/integrations/whatsapp/meta/webhook`, verifyToken }, subscriptionError });
  } catch (error) {
    const message = errorMessage(error, 'Falha ao configurar WhatsApp.');
    res.status(/Sessao|Authorization/i.test(message) ? 401 : 400).json({ error: message });
  }
}

export async function handleWhatsAppConnectionStatus(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Metodo nao permitido.' });
    return;
  }

  try {
    const { userId, db } = await authenticate(req);
    const { data: config, error } = await db
      .from('whatsapp_config')
      .select('phone_number_id,waba_id,access_token_encrypted,status,updated_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!config || config.status !== 'connected' || !config.phone_number_id || !config.access_token_encrypted) {
      throw new Error('WhatsApp Business nao conectado. Configure a conta em Integracoes > WhatsApp.');
    }

    const accessToken = decryptWhatsAppAccessToken(config.access_token_encrypted);
    const response = await fetch(`https://graph.facebook.com/${metaGraphVersion}/${encodeURIComponent(config.phone_number_id)}?fields=display_phone_number,verified_name,quality_rating`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15_000),
    });
    const phone: any = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(phone?.error?.message || 'A Meta nao confirmou a conexao deste numero.');

    res.status(200).json({
      active: true,
      checkedAt: new Date().toISOString(),
      updatedAt: config.updated_at,
      phone: {
        displayName: phone.verified_name || null,
        displayNumber: phone.display_phone_number || null,
        qualityRating: phone.quality_rating || null,
      },
      hasWabaId: Boolean(config.waba_id),
    });
  } catch (error) {
    const message = errorMessage(error, 'Falha ao verificar a conexao do WhatsApp.');
    res.status(/Sessao|Authorization/i.test(message) ? 401 : 400).json({ error: message });
  }
}

type WhatsAppTemplateButtonInput = {
  type?: string;
  text?: string;
  url?: string;
  phoneNumber?: string;
  example?: string;
};

function templateVariablePositions(value: string) {
  return [...new Set(Array.from(value.matchAll(/\{\{(\d+)\}\}/g), match => Number(match[1])))]
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
}

function ensureSequentialTemplateVariables(value: string, fieldLabel: string) {
  const positions = templateVariablePositions(value);
  positions.forEach((position, index) => {
    if (position !== index + 1) throw new Error(`As variaveis de ${fieldLabel} devem ser sequenciais: {{1}}, {{2}}, ...`);
  });
  return positions;
}

async function readTemplateConfig(db: SupabaseClient, userId: string) {
  let result: { data: any; error: any } = await db
    .from('whatsapp_config')
    .select('waba_id,meta_app_id,access_token_encrypted,status')
    .eq('user_id', userId)
    .maybeSingle();
  if (result.error) {
    result = await db
      .from('whatsapp_config')
      .select('waba_id,access_token_encrypted,status')
      .eq('user_id', userId)
      .maybeSingle();
  }
  if (result.error) throw result.error;
  if (!result.data || result.data.status !== 'connected') throw new Error('Conecte o WhatsApp Business antes de gerenciar templates.');
  if (!result.data.waba_id) throw new Error('Informe o WABA ID na conexao para gerenciar templates da Meta.');
  if (!result.data.access_token_encrypted) throw new Error('O token da Meta nao esta disponivel. Reconecte o WhatsApp Business.');
  return result.data as { waba_id: string; meta_app_id?: string | null; access_token_encrypted: string; status: string };
}

async function listMetaTemplates(wabaId: string, accessToken: string) {
  const templates: any[] = [];
  const fieldsWithReason = 'id,name,status,language,category,quality_score,components,rejected_reason';
  const fieldsFallback = 'id,name,status,language,category,quality_score,components';
  let nextUrl: string | null = `https://graph.facebook.com/${metaGraphVersion}/${encodeURIComponent(wabaId)}/message_templates?limit=100&fields=${fieldsWithReason}`;
  let pages = 0;
  let retriedWithoutReason = false;
  while (nextUrl && pages < 50) {
    const response: Response = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15_000),
    });
    const body: any = await response.json().catch(() => ({}));
    if (!response.ok && !retriedWithoutReason && pages === 0) {
      retriedWithoutReason = true;
      nextUrl = `https://graph.facebook.com/${metaGraphVersion}/${encodeURIComponent(wabaId)}/message_templates?limit=100&fields=${fieldsFallback}`;
      continue;
    }
    if (!response.ok) throw new Error(body?.error?.message || 'A Meta recusou a consulta dos templates.');
    if (Array.isArray(body.data)) templates.push(...body.data);
    nextUrl = typeof body?.paging?.next === 'string' ? body.paging.next : null;
    pages += 1;
  }
  return templates;
}

async function syncTemplateRegistry(db: SupabaseClient, userId: string, templates: any[]) {
  if (!templates.length) return;
  const now = new Date().toISOString();
  const rows = templates.map(template => ({
    user_id: userId,
    meta_template_id: template.id ? String(template.id) : null,
    name: String(template.name || ''),
    language: String(template.language || 'pt_BR'),
    category: String(template.category || 'MARKETING'),
    status: String(template.status || 'PENDING'),
    quality_score: template.quality_score || null,
    components: Array.isArray(template.components) ? template.components : [],
    rejection_reason: template.rejected_reason ? String(template.rejected_reason) : null,
    last_synced_at: now,
    updated_at: now,
  })).filter(row => row.name);
  const { error } = await db.from('whatsapp_template_registry').upsert(rows, { onConflict: 'user_id,name,language' });
  if (error && !/whatsapp_template_registry|schema cache|does not exist/i.test(error.message || '')) throw error;
}

function buildTemplateComponents(input: any) {
  const result: any[] = [];
  const headerType = String(input.headerType || 'NONE').toUpperCase();
  const headerText = String(input.headerText || '').trim();
  const mediaHandle = String(input.mediaHandle || '').trim();
  const headerExamples = Array.isArray(input.headerExamples) ? input.headerExamples.map(String) : [];
  if (headerType === 'TEXT') {
    if (!headerText) throw new Error('Informe o texto do cabecalho.');
    const positions = ensureSequentialTemplateVariables(headerText, 'cabecalho');
    const component: any = { type: 'HEADER', format: 'TEXT', text: headerText };
    if (positions.length) {
      if (headerExamples.length < positions.length || headerExamples.slice(0, positions.length).some((value: string) => !value.trim())) throw new Error('Informe um exemplo para cada variavel do cabecalho.');
      component.example = { header_text: headerExamples.slice(0, positions.length) };
    }
    result.push(component);
  } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType)) {
    if (!mediaHandle) throw new Error('Envie a midia de exemplo antes de submeter o template.');
    result.push({ type: 'HEADER', format: headerType, example: { header_handle: [mediaHandle] } });
  }

  const bodyText = String(input.bodyText || '').trim();
  if (!bodyText) throw new Error('O corpo da mensagem e obrigatorio.');
  if (bodyText.length > 1024) throw new Error('O corpo da mensagem deve ter no maximo 1024 caracteres.');
  const bodyPositions = ensureSequentialTemplateVariables(bodyText, 'corpo');
  const bodyExamples = Array.isArray(input.bodyExamples) ? input.bodyExamples.map(String) : [];
  const body: any = { type: 'BODY', text: bodyText };
  if (bodyPositions.length) {
    if (bodyExamples.length < bodyPositions.length || bodyExamples.slice(0, bodyPositions.length).some((value: string) => !value.trim())) throw new Error('Informe um exemplo para cada variavel do corpo.');
    body.example = { body_text: [bodyExamples.slice(0, bodyPositions.length)] };
  }
  result.push(body);

  const footerText = String(input.footerText || '').trim();
  if (footerText) result.push({ type: 'FOOTER', text: footerText.slice(0, 60) });

  const rawButtons = Array.isArray(input.buttons) ? input.buttons.slice(0, 10) as WhatsAppTemplateButtonInput[] : [];
  if (rawButtons.length) {
    const buttons = rawButtons.map(button => {
      const type = String(button.type || '').toUpperCase();
      const text = String(button.text || '').trim().slice(0, 25);
      if (!text) throw new Error('Todos os botoes precisam de um titulo.');
      if (type === 'QUICK_REPLY') return { type, text };
      if (type === 'URL') {
        const url = String(button.url || '').trim();
        if (!/^https:\/\//i.test(url)) throw new Error('O botao de site precisa usar uma URL https:// valida.');
        if (/\{\{\d+\}\}/.test(url)) throw new Error('Use uma URL fixa no botao de site. URLs dinamicas ainda nao sao suportadas no disparador.');
        const payload: any = { type, text, url };
        return payload;
      }
      if (type === 'PHONE_NUMBER') {
        const phoneNumber = String(button.phoneNumber || '').replace(/[^\d+]/g, '');
        if (phoneNumber.replace(/\D/g, '').length < 10) throw new Error('Informe um telefone valido no botao de ligacao.');
        return { type, text, phone_number: phoneNumber };
      }
      if (type === 'COPY_CODE') return { type, example: String(button.example || '').trim() || 'CODIGO', text };
      throw new Error('Tipo de botao nao suportado.');
    });
    result.push({ type: 'BUTTONS', buttons });
  }
  return result;
}

async function uploadTemplateMedia(appId: string, accessToken: string, fileName: string, mimeType: string, base64: string) {
  if (!appId) throw new Error('Informe o Meta App ID nas configuracoes do WhatsApp antes de enviar midia.');
  if (!['image/jpeg', 'image/png', 'video/mp4', 'application/pdf'].includes(mimeType)) throw new Error('Formato de midia nao suportado. Use JPG, PNG, MP4 ou PDF.');
  const cleanBase64 = base64.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(cleanBase64, 'base64');
  if (!buffer.length || buffer.length > 5 * 1024 * 1024) throw new Error('A midia deve ter no maximo 5 MB.');
  const sessionResponse = await fetch(`https://graph.facebook.com/${metaGraphVersion}/${encodeURIComponent(appId)}/uploads?file_length=${buffer.length}&file_type=${encodeURIComponent(mimeType)}&file_name=${encodeURIComponent(fileName || 'template-media')}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(20_000),
  });
  const sessionBody: any = await sessionResponse.json().catch(() => ({}));
  if (!sessionResponse.ok || !sessionBody.id) throw new Error(sessionBody?.error?.message || 'A Meta nao iniciou o upload da midia.');
  const uploadResponse = await fetch(`https://graph.facebook.com/${metaGraphVersion}/${encodeURIComponent(sessionBody.id)}`, {
    method: 'POST',
    headers: { Authorization: `OAuth ${accessToken}`, 'Content-Type': mimeType, file_offset: '0' },
    body: buffer,
    signal: AbortSignal.timeout(30_000),
  });
  const uploadBody: any = await uploadResponse.json().catch(() => ({}));
  if (!uploadResponse.ok || !uploadBody.h) throw new Error(uploadBody?.error?.message || 'A Meta recusou a midia do template.');
  return String(uploadBody.h);
}

export async function handleWhatsAppTemplates(req: ApiRequest, res: ApiResponse) {
  if (!['GET', 'POST'].includes(req.method || '')) {
    res.status(405).json({ error: 'Metodo nao permitido.' });
    return;
  }
  try {
    const { userId, db } = await authenticate(req);
    const config = await readTemplateConfig(db, userId);
    const accessToken = decryptWhatsAppAccessToken(config.access_token_encrypted);

    if (req.method === 'GET') {
      const templates = await listMetaTemplates(config.waba_id, accessToken);
      await syncTemplateRegistry(db, userId, templates);
      res.status(200).json({ templates, total: templates.length, fetchedAt: new Date().toISOString() });
      return;
    }

    const action = String(req.body?.action || 'create');
    if (action === 'upload_media') {
      const handle = await uploadTemplateMedia(
        String(config.meta_app_id || ''),
        accessToken,
        String(req.body?.fileName || 'template-media'),
        String(req.body?.mimeType || ''),
        String(req.body?.dataBase64 || ''),
      );
      res.status(200).json({ handle });
      return;
    }

    const name = String(req.body?.name || '').trim().toLowerCase();
    const category = String(req.body?.category || 'MARKETING').toUpperCase();
    const language = String(req.body?.language || 'pt_BR').trim();
    if (!/^[a-z0-9_]{1,512}$/.test(name)) throw new Error('Use apenas letras minusculas, numeros e underline no nome do template.');
    if (!['MARKETING', 'UTILITY'].includes(category)) throw new Error('Escolha a categoria Marketing ou Utilidade.');
    if (!/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(language)) throw new Error('Informe um codigo de idioma valido, como pt_BR.');
    const components = buildTemplateComponents(req.body || {});
    const response = await fetch(`https://graph.facebook.com/${metaGraphVersion}/${encodeURIComponent(config.waba_id)}/message_templates`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, language, category, components }),
      signal: AbortSignal.timeout(20_000),
    });
    const body: any = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error?.error_user_msg || body?.error?.message || 'A Meta recusou o template.');
    const submittedAt = new Date().toISOString();
    const record = {
      user_id: userId,
      meta_template_id: body.id ? String(body.id) : null,
      name,
      language,
      category: String(body.category || category),
      status: String(body.status || 'PENDING'),
      components,
      rejection_reason: null,
      submitted_at: submittedAt,
      last_synced_at: submittedAt,
      updated_at: submittedAt,
    };
    const { error: registryError } = await db.from('whatsapp_template_registry').upsert(record, { onConflict: 'user_id,name,language' });
    res.status(201).json({ template: { ...record, id: body.id || null }, registryWarning: registryError?.message || null });
  } catch (error) {
    const message = errorMessage(error, 'Falha ao gerenciar templates do WhatsApp.');
    res.status(/Sessao|Authorization/i.test(message) ? 401 : 400).json({ error: message });
  }
}

export async function handleWhatsAppCallingEligibility(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Metodo nao permitido.' });
    return;
  }

  try {
    const { userId, db } = await authenticate(req);
    const { data: config, error } = await db
      .from('whatsapp_config')
      .select('phone_number_id,access_token_encrypted,status')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!config || config.status !== 'connected') throw new Error('Conecte o WhatsApp Business antes de consultar chamadas.');
    if (!config.access_token_encrypted) throw new Error('O token da Meta nao esta disponivel. Reconecte o WhatsApp Business.');

    const accessToken = decryptWhatsAppAccessToken(config.access_token_encrypted);
    const response = await fetch(`https://graph.facebook.com/${metaGraphVersion}/${encodeURIComponent(config.phone_number_id)}/settings`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15_000),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body?.error?.message || 'A Meta nao liberou a consulta de chamadas para este numero.');
    }

    res.status(200).json({
      eligible: true,
      settings: body,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = errorMessage(error, 'Falha ao verificar chamadas do WhatsApp.');
    res.status(/Sessao|Authorization/i.test(message) ? 401 : 400).json({ error: message });
  }
}
