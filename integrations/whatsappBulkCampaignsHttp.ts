import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { decryptWhatsAppAccessToken } from './whatsappHttp.js';
import { fallbackSupabaseAnonKey } from './supabasePublicConfig.js';

type Request = { method?: string; headers: Record<string, string | string[] | undefined>; body?: any };
type Response = { status: (code: number) => Response; json: (body: unknown) => void };
type Opportunity = { id: string; patient_phone: string | null; patient_name: string | null; seller_name: string | null; title: string; amount_cents: number };
const url = process.env.VITE_SUPABASE_URL || 'https://dmslcvvjxfulsocksave.supabase.co';
const anon = process.env.VITE_SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || fallbackSupabaseAnonKey;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const graphVersion = process.env.META_GRAPH_VERSION || 'v23.0';

const normalizePhone = (value: string | null) => { const digits = String(value || '').replace(/\D/g, ''); return (digits.length === 10 || digits.length === 11) && !digits.startsWith('55') ? `55${digits}` : digits; };
const header = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
async function auth(req: Request) {
  const token = header(req.headers.authorization)?.replace(/^Bearer\s+/i, '') || '';
  if (!token || !service) throw new Error('Sessao invalida ou servidor nao configurado.');
  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) throw new Error('Sessao invalida. Faca login novamente.');
  return { userId: user.id, db: createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } }) };
}
function value(key: string, item: Opportunity) { return ({ patient_name: item.patient_name || '', seller_name: item.seller_name || '', opportunity_title: item.title || '', amount: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((item.amount_cents || 0) / 100) } as Record<string, string>)[key] || ''; }
function components(mapping: string, item: Opportunity) {
  const parameters = String(mapping || '').split(/\r?\n/).map(line => line.match(/^\s*\{\{(\d+)\}\}\s*=\s*([a-z_]+)\s*$/i)).filter((match): match is RegExpMatchArray => Boolean(match)).sort((a, b) => Number(a[1]) - Number(b[1])).map(match => ({ type: 'text', text: value(match[2], item) }));
  return parameters.length ? [{ type: 'body', parameters }] : undefined;
}
async function sendBatch(db: SupabaseClient, userId: string, campaignId: string) {
  const { data: campaign, error: campaignError } = await db.from('whatsapp_bulk_campaigns').select('template_name,template_language,variable_mapping').eq('id', campaignId).eq('user_id', userId).single();
  if (campaignError) throw campaignError;
  const { data: config, error: configError } = await db.from('whatsapp_config').select('phone_number_id,access_token_encrypted,status').eq('user_id', userId).maybeSingle();
  if (configError || !config || config.status !== 'connected' || !config.access_token_encrypted) throw new Error('WhatsApp Business nao conectado.');
  const { data: rows, error: rowsError } = await db.from('whatsapp_bulk_campaign_recipients').select('id,opportunity_id,phone').eq('campaign_id', campaignId).eq('status', 'pending').order('created_at').limit(15);
  if (rowsError) throw rowsError;
  let sent = 0; let failed = 0;
  for (const row of rows || []) {
    await db.from('whatsapp_bulk_campaign_recipients').update({ status: 'sending', attempts: 1 }).eq('id', row.id).eq('status', 'pending');
    const { data: item } = await db.from('clinic_experts_opportunities').select('id,patient_phone,patient_name,seller_name,title,amount_cents').eq('id', row.opportunity_id).single();
    try {
      if (!item) throw new Error('Oportunidade nao encontrada.');
      const response = await fetch(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(config.phone_number_id)}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${decryptWhatsAppAccessToken(config.access_token_encrypted)}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: row.phone, type: 'template', template: { name: campaign.template_name, language: { code: campaign.template_language }, components: components(campaign.variable_mapping, item as Opportunity) } }), signal: AbortSignal.timeout(15000) });
      const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body?.error?.message || 'A Meta recusou o envio.');
      sent += 1; await db.from('whatsapp_bulk_campaign_recipients').update({ status: 'sent', meta_message_id: String(body?.messages?.[0]?.id || ''), sent_at: new Date().toISOString() }).eq('id', row.id);
    } catch (error) { failed += 1; await db.from('whatsapp_bulk_campaign_recipients').update({ status: 'failed', error_message: (error instanceof Error ? error.message : 'Falha ao enviar.').slice(0, 1000) }).eq('id', row.id); }
  }
  const { count: pending } = await db.from('whatsapp_bulk_campaign_recipients').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).eq('status', 'pending');
  const { count: totalSent } = await db.from('whatsapp_bulk_campaign_recipients').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).eq('status', 'sent');
  const { count: totalFailed } = await db.from('whatsapp_bulk_campaign_recipients').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).eq('status', 'failed');
  await db.from('whatsapp_bulk_campaigns').update({ status: pending ? 'sending' : 'completed', sent_count: totalSent || 0, failed_count: totalFailed || 0, finished_at: pending ? null : new Date().toISOString() }).eq('id', campaignId);
  return { sent, failed, pending: pending || 0, completed: !pending };
}
export async function handleWhatsAppBulkCampaigns(req: Request, res: Response) {
  try {
    const { userId, db } = await auth(req);
    if (req.method === 'GET') { const { data, error } = await db.from('whatsapp_bulk_campaigns').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20); if (error) throw error; return res.status(200).json({ campaigns: data || [] }); }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo nao permitido.' });
    if (req.body?.action === 'process') return res.status(200).json(await sendBatch(db, userId, String(req.body.campaignId || '')));
    const { name, templateName, language = 'pt_BR', variableMapping = '', pipelineId, stageId } = req.body || {};
    if (!name || !templateName || !pipelineId) return res.status(400).json({ error: 'Nome, template e funil sao obrigatorios.' });
    const { data: config, error: configError } = await db.from('whatsapp_config').select('waba_id,access_token_encrypted,status').eq('user_id', userId).maybeSingle();
    if (configError || !config || config.status !== 'connected' || !config.waba_id || !config.access_token_encrypted) throw new Error('Conecte o WhatsApp Business e informe o WABA ID antes de criar a campanha.');
    let templateUrl: string | null = `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(config.waba_id)}/message_templates?limit=100&fields=name,status,language`;
    let approved = false; let pages = 0;
    while (templateUrl && !approved && pages < 50) {
      const templateResponse = await fetch(templateUrl, { headers: { Authorization: `Bearer ${decryptWhatsAppAccessToken(config.access_token_encrypted)}` }, signal: AbortSignal.timeout(15000) });
      const templateBody: any = await templateResponse.json().catch(() => ({}));
      if (!templateResponse.ok) throw new Error(templateBody?.error?.message || 'Nao foi possivel validar o template na Meta.');
      approved = Array.isArray(templateBody.data) && templateBody.data.some((item: any) => item.name === templateName && item.language === language && item.status === 'APPROVED');
      templateUrl = typeof templateBody?.paging?.next === 'string' ? templateBody.paging.next : null; pages += 1;
    }
    if (!approved) throw new Error('Escolha um template atualmente aprovado pela Meta.');
    let query = db.from('clinic_experts_opportunities').select('id,patient_phone').eq('user_id', userId).eq('pipeline_id', pipelineId);
    if (stageId) query = query.eq('stage_id', stageId);
    const { data: opportunities, error } = await query; if (error) throw error;
    const uniquePhones = new Set<string>();
    const recipients = (opportunities || []).map(item => ({ opportunity_id: item.id, phone: normalizePhone(item.patient_phone) })).filter(item => item.phone.length >= 12 && !uniquePhones.has(item.phone) && Boolean(uniquePhones.add(item.phone)));
    if (!recipients.length) return res.status(400).json({ error: 'Nenhum contato com telefone valido foi encontrado neste filtro.' });
    const { data: campaign, error: createError } = await db.from('whatsapp_bulk_campaigns').insert({ user_id: userId, name: String(name).slice(0, 120), template_name: templateName, template_language: language, variable_mapping: variableMapping, pipeline_id: pipelineId, stage_id: stageId || null, status: 'sending', total_recipients: recipients.length, started_at: new Date().toISOString() }).select('id').single();
    if (createError || !campaign) throw createError || new Error('Falha ao criar campanha.');
    const { error: recipientsError } = await db.from('whatsapp_bulk_campaign_recipients').insert(recipients.map(item => ({ ...item, campaign_id: campaign.id }))); if (recipientsError) throw recipientsError;
    return res.status(201).json({ campaignId: campaign.id, totalRecipients: recipients.length });
  } catch (error) { const message = error instanceof Error ? error.message : 'Falha na campanha.'; return res.status(/Sessao/i.test(message) ? 401 : 400).json({ error: message }); }
}
