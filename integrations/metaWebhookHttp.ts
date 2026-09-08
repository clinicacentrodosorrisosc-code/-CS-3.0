import crypto from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type ApiResponse = { status: (code: number) => ApiResponse; send: (body: unknown) => void; json: (body: unknown) => void };

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://dmslcvvjxfulsocksave.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const metaAppSecret = process.env.META_APP_SECRET || '';

function verified(rawBody: Buffer, signature: string | string[] | undefined) {
  const supplied = Array.isArray(signature) ? signature[0] : signature;
  if (!metaAppSecret || !supplied?.startsWith('sha256=')) return false;
  const expected = `sha256=${crypto.createHmac('sha256', metaAppSecret).update(rawBody).digest('hex')}`;
  return expected.length === supplied.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
}

function textFromMessage(message: Record<string, any>) {
  if (typeof message.text?.body === 'string') return message.text.body;
  if (typeof message.button?.text === 'string') return message.button.text;
  if (typeof message.interactive?.button_reply?.title === 'string') return message.interactive.button_reply.title;
  if (typeof message.interactive?.list_reply?.title === 'string') return message.interactive.list_reply.title;
  return `[Mensagem ${String(message.type || 'recebida')}]`;
}

function contentType(value: unknown) {
  const type = String(value || 'text');
  return ['text', 'image', 'document', 'audio', 'video', 'location', 'template'].includes(type) ? type : 'text';
}

async function conversationFor(db: SupabaseClient, userId: string, phone: string, name?: string) {
  const { data: contact, error: contactError } = await db.from('contacts').select('id').eq('user_id', userId).eq('phone', phone).limit(1).maybeSingle();
  if (contactError) throw contactError;
  let contactId = contact?.id as string | undefined;
  if (!contactId) {
    const { data, error } = await db.from('contacts').insert({ user_id: userId, phone, name: name || null }).select('id').single();
    if (error) throw error;
    contactId = data.id as string;
  }
  const { data: conversation, error: conversationError } = await db.from('conversations').select('id').eq('user_id', userId).eq('contact_id', contactId).order('last_message_at', { ascending: false }).limit(1).maybeSingle();
  if (conversationError) throw conversationError;
  if (conversation?.id) return conversation.id as string;
  const { data, error } = await db.from('conversations').insert({ user_id: userId, contact_id: contactId, status: 'open' }).select('id').single();
  if (error) throw error;
  return data.id as string;
}

export async function verifyMetaWebhook(query: Record<string, unknown>, res: ApiResponse) {
  if (!serviceRoleKey) return res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY nao configurada.' });
  const mode = String(query['hub.mode'] || '');
  const token = String(query['hub.verify_token'] || '');
  const challenge = String(query['hub.challenge'] || '');
  if (mode !== 'subscribe' || !token || !challenge) return res.status(400).json({ error: 'Verificacao Meta invalida.' });
  const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.from('whatsapp_config').select('id').eq('verify_token', token).limit(1).maybeSingle();
  if (error || !data) return res.status(403).json({ error: 'Token de verificacao invalido.' });
  return res.status(200).send(challenge);
}

export async function handleMetaWebhook(rawBody: Buffer, signature: string | string[] | undefined, res: ApiResponse) {
  if (!verified(rawBody, signature)) return res.status(401).json({ error: 'Assinatura Meta invalida.' });
  if (!serviceRoleKey) return res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY nao configurada.' });
  let body: any;
  try { body = JSON.parse(rawBody.toString('utf8')); } catch { return res.status(400).json({ error: 'Payload JSON invalido.' }); }
  const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    for (const entry of Array.isArray(body.entry) ? body.entry : []) {
      for (const change of Array.isArray(entry.changes) ? entry.changes : []) {
        const value = change?.value;
        const phoneNumberId = value?.metadata?.phone_number_id;
        if (!phoneNumberId) continue;
        const { data: config } = await db.from('whatsapp_config').select('user_id').eq('phone_number_id', phoneNumberId).maybeSingle();
        if (!config) continue;
        for (const message of Array.isArray(value.messages) ? value.messages : []) {
          const from = String(message.from || '').replace(/\D/g, '');
          if (!from || !message.id) continue;
          const contact = Array.isArray(value.contacts) ? value.contacts.find((item: any) => String(item.wa_id || '') === from) : null;
          const conversationId = await conversationFor(db, config.user_id, `+${from}`, contact?.profile?.name);
          const createdAt = message.timestamp ? new Date(Number(message.timestamp) * 1000).toISOString() : new Date().toISOString();
          const text = textFromMessage(message);
          const { error } = await db.from('messages').insert({ conversation_id: conversationId, sender_type: 'customer', content_type: contentType(message.type), content_text: text, message_id: message.id, status: 'delivered', created_at: createdAt });
          if (error?.code && error.code !== '23505') throw error;
          await db.from('conversations').update({ last_message_text: text, last_message_at: createdAt, updated_at: new Date().toISOString() }).eq('id', conversationId);
        }
      }
    }
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('[meta.webhook] ingestion failed', error instanceof Error ? error.message : error);
    return res.status(500).json({ error: 'Falha ao processar webhook Meta.' });
  }
}
