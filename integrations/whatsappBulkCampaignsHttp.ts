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
const brazilRates: Record<string, number> = { MARKETING: 0.3217, UTILITY: 0.035, AUTHENTICATION: 0.035 };

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
async function resolvePhones(db: SupabaseClient, userId: string, raw: Array<Opportunity & { patient_external_id?: string | null }>, allowHistory: boolean) {
  const patientIds = [...new Set(raw.map(item => item.patient_external_id).filter(Boolean))] as string[];
  const [relatedResult, historyResult] = await Promise.all([
    patientIds.length ? db.from('clinic_experts_opportunities').select('patient_external_id,patient_phone').eq('user_id', userId).in('patient_external_id', patientIds).not('patient_phone', 'is', null) : Promise.resolve({ data: [], error: null }),
    raw.length ? db.from('whatsapp_bulk_campaign_recipients').select('opportunity_id,phone,created_at').in('opportunity_id', raw.map(item => item.id)).neq('phone', '').order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
  ]);
  if (relatedResult.error) throw relatedResult.error; if (historyResult.error) throw historyResult.error;
  const related = new Map<string, string>(); for (const item of relatedResult.data || []) { const phone = normalizePhone(item.patient_phone); if (phone.length >= 12 && !related.has(item.patient_external_id)) related.set(item.patient_external_id, phone); }
  const history = new Map<string, string>(); for (const item of historyResult.data || []) if (item.phone && !history.has(item.opportunity_id)) history.set(item.opportunity_id, item.phone);
  return raw.map(item => { const current = normalizePhone(item.patient_phone); if (current.length >= 12) return { ...item, phone: current, phoneSource: 'card', status: 'ready', reason: '' }; const relatedPhone = item.patient_external_id ? related.get(item.patient_external_id) : ''; if (relatedPhone) return { ...item, phone: relatedPhone, phoneSource: 'patient_record', status: 'ready', reason: 'Telefone localizado em outro card do mesmo paciente.' }; const historical = history.get(item.id); if (historical) return { ...item, phone: historical, phoneSource: 'history', status: allowHistory ? 'ready' : 'needs_confirmation', reason: allowHistory ? 'Telefone historico confirmado para esta campanha.' : 'Telefone localizado no historico; confirme para incluir no envio.' }; return { ...item, phone: '', phoneSource: 'none', status: 'skipped', reason: 'Telefone ausente ou invalido.' }; });
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
async function registerSkippedRecipients(db: SupabaseClient, campaign: any) {
  let query = db.from('clinic_experts_opportunities').select('id,patient_phone').eq('user_id', campaign.user_id).eq('pipeline_id', campaign.pipeline_id);
  if (campaign.stage_id) query = query.eq('stage_id', campaign.stage_id);
  const { data: opportunities, error } = await query; if (error) throw error;
  const { data: existing, error: existingError } = await db.from('whatsapp_bulk_campaign_recipients').select('opportunity_id,phone').eq('campaign_id', campaign.id);
  if (existingError) throw existingError;
  const existingIds = new Set((existing || []).map(item => item.opportunity_id)); const usedPhones = new Set((existing || []).map(item => item.phone).filter(Boolean));
  const skipped = (opportunities || []).filter(item => !existingIds.has(item.id)).map(item => {
    const phone = normalizePhone(item.patient_phone);
    const duplicate = phone.length >= 12 && usedPhones.has(phone);
    if (phone.length >= 12) usedPhones.add(phone);
    return { campaign_id: campaign.id, opportunity_id: item.id, phone, status: 'skipped', error_message: duplicate ? 'Telefone duplicado na campanha; nao foi reenviado.' : 'Telefone ausente ou invalido.' };
  });
  if (skipped.length) { const { error: insertError } = await db.from('whatsapp_bulk_campaign_recipients').insert(skipped); if (insertError) throw insertError; }
  const { count } = await db.from('whatsapp_bulk_campaign_recipients').select('id', { count: 'exact', head: true }).eq('campaign_id', campaign.id);
  await db.from('whatsapp_bulk_campaigns').update({ total_recipients: count || 0 }).eq('id', campaign.id);
}
async function previewCampaign(db: SupabaseClient, userId: string, params: Record<string, unknown>) {
  const pipelineId = String(params.pipelineId || ''), stageId = String(params.stageId || ''), templateName = String(params.templateName || ''), language = String(params.language || 'pt_BR');
  if (!pipelineId || !templateName) throw new Error('Selecione o funil e o template para conferir a campanha.');
  const { data: config, error: configError } = await db.from('whatsapp_config').select('waba_id,access_token_encrypted,status').eq('user_id', userId).maybeSingle();
  if (configError || !config || config.status !== 'connected' || !config.waba_id || !config.access_token_encrypted) throw new Error('Conecte o WhatsApp Business e informe o WABA ID.');
  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(config.waba_id)}/message_templates?limit=100&fields=name,status,language,category,components`, { headers: { Authorization: `Bearer ${decryptWhatsAppAccessToken(config.access_token_encrypted)}` }, signal: AbortSignal.timeout(15000) });
  const body: any = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body?.error?.message || 'Nao foi possivel consultar o template na Meta.');
  const template = (body.data || []).find((item: any) => item.name === templateName && item.language === language && item.status === 'APPROVED');
  if (!template) throw new Error('O template aprovado nao foi encontrado na Meta. Atualize os templates e tente novamente.');
  const allowHistory = String(params.useHistoricalPhones || '') === 'true';
  let query = db.from('clinic_experts_opportunities').select('id,patient_external_id,patient_phone,patient_name,seller_name,title,amount_cents').eq('user_id', userId).eq('pipeline_id', pipelineId);
  if (stageId) query = query.eq('stage_id', stageId);
  const { data: opportunities, error } = await query; if (error) throw error;
  const resolved = await resolvePhones(db, userId, (opportunities || []) as any, allowHistory); const phones = new Set<string>(); let eligible = 0; let skippedInvalid = 0; let skippedDuplicate = 0; let awaitingConfirmation = 0; let sample: Opportunity | null = null;
  const contacts = resolved.map(item => { if (item.status === 'needs_confirmation') { awaitingConfirmation += 1; return { id: item.id, patient_name: item.patient_name || 'Paciente sem nome', opportunity_title: item.title || 'Oportunidade', phone: item.phone, status: item.status, reason: item.reason, phoneSource: item.phoneSource }; } if (item.status !== 'ready') { skippedInvalid += 1; return { id: item.id, patient_name: item.patient_name || 'Paciente sem nome', opportunity_title: item.title || 'Oportunidade', phone: item.phone, status: item.status, reason: item.reason, phoneSource: item.phoneSource }; } if (phones.has(item.phone)) { skippedDuplicate += 1; return { id: item.id, patient_name: item.patient_name || 'Paciente sem nome', opportunity_title: item.title || 'Oportunidade', phone: item.phone, status: 'skipped', reason: 'Telefone duplicado nesta campanha.', phoneSource: item.phoneSource }; } phones.add(item.phone); eligible += 1; sample ||= item; return { id: item.id, patient_name: item.patient_name || 'Paciente sem nome', opportunity_title: item.title || 'Oportunidade', phone: item.phone, status: 'ready', reason: item.reason, phoneSource: item.phoneSource }; });
  const category = String(template.category || '').toUpperCase(); const unitPrice = brazilRates[category] || 0; const allBrazil = [...phones].every(phone => phone.startsWith('55'));
  return { template: { name: template.name, language: template.language, category, body: (template.components || []).find((item: any) => item.type === 'BODY')?.text || '' }, recipients: { totalCards: (opportunities || []).length, eligible, skippedInvalid, skippedDuplicate, awaitingConfirmation, contacts }, sample, pricing: { currency: 'BRL', unitPrice, total: unitPrice * eligible, estimated: Boolean(unitPrice && allBrazil), note: unitPrice ? 'Estimativa maxima para mensagens entregues a numeros com DDI Brasil; descontos por volume, creditos e isencoes nao estao incluidos.' : 'A Meta nao informou uma tarifa estimavel para esta categoria ou existem destinatarios fora do Brasil.' } };
}
export async function handleWhatsAppBulkCampaigns(req: Request, res: Response) {
  try {
    const { userId, db } = await auth(req);
    if (req.method === 'GET') {
      if (String((req as any).query?.action || '') === 'preview') return res.status(200).json(await previewCampaign(db, userId, (req as any).query || {}));
      const campaignId = String((req as any).query?.campaignId || '');
      if (campaignId) {
        const { data: campaign, error: campaignError } = await db.from('whatsapp_bulk_campaigns').select('*').eq('id', campaignId).eq('user_id', userId).single(); if (campaignError) throw campaignError;
        await registerSkippedRecipients(db, campaign);
        const { data: recipients, error: recipientError } = await db.from('whatsapp_bulk_campaign_recipients').select('id,opportunity_id,phone,status,meta_message_id,error_message,created_at,sent_at').eq('campaign_id', campaign.id).order('created_at'); if (recipientError) throw recipientError;
        const ids = (recipients || []).map(item => item.opportunity_id); const { data: opportunities, error: opportunitiesError } = ids.length ? await db.from('clinic_experts_opportunities').select('id,patient_name,title').in('id', ids) : { data: [], error: null }; if (opportunitiesError) throw opportunitiesError;
        const names = new Map((opportunities || []).map(item => [item.id, item]));
        return res.status(200).json({ campaign, recipients: (recipients || []).map(item => ({ ...item, patient_name: names.get(item.opportunity_id)?.patient_name || 'Paciente sem nome', opportunity_title: names.get(item.opportunity_id)?.title || 'Oportunidade' })) });
      }
      const { data, error } = await db.from('whatsapp_bulk_campaigns').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20); if (error) throw error; return res.status(200).json({ campaigns: data || [] });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo nao permitido.' });
    if (req.body?.action === 'process') return res.status(200).json(await sendBatch(db, userId, String(req.body.campaignId || '')));
    const { name, templateName, language = 'pt_BR', variableMapping = '', pipelineId, stageId, useHistoricalPhones = false } = req.body || {};
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
    let query = db.from('clinic_experts_opportunities').select('id,patient_external_id,patient_phone,patient_name,seller_name,title,amount_cents').eq('user_id', userId).eq('pipeline_id', pipelineId);
    if (stageId) query = query.eq('stage_id', stageId);
    const { data: opportunities, error } = await query; if (error) throw error;
    const resolved = await resolvePhones(db, userId, (opportunities || []) as any, Boolean(useHistoricalPhones)); const usedPhones = new Set<string>();
    const recipients = resolved.map(item => { const duplicate = item.status === 'ready' && usedPhones.has(item.phone); if (item.status === 'ready') usedPhones.add(item.phone); return { opportunity_id: item.id, phone: item.phone, status: item.status === 'ready' && !duplicate ? 'pending' : 'skipped', error_message: duplicate ? 'Telefone duplicado na campanha; nao foi reenviado.' : item.reason || 'Telefone ausente ou invalido.' }; });
    if (!recipients.some(item => item.status === 'pending')) return res.status(400).json({ error: 'Nenhum contato com telefone valido e unico foi encontrado neste filtro.' });
    const { data: campaign, error: createError } = await db.from('whatsapp_bulk_campaigns').insert({ user_id: userId, name: String(name).slice(0, 120), template_name: templateName, template_language: language, variable_mapping: variableMapping, pipeline_id: pipelineId, stage_id: stageId || null, status: 'sending', total_recipients: recipients.length, started_at: new Date().toISOString() }).select('id').single();
    if (createError || !campaign) throw createError || new Error('Falha ao criar campanha.');
    const { error: recipientsError } = await db.from('whatsapp_bulk_campaign_recipients').insert(recipients.map(item => ({ ...item, campaign_id: campaign.id }))); if (recipientsError) throw recipientsError;
    return res.status(201).json({ campaignId: campaign.id, totalRecipients: recipients.filter(item => item.status === 'pending').length });
  } catch (error) { const message = error instanceof Error ? error.message : 'Falha na campanha.'; return res.status(/Sessao/i.test(message) ? 401 : 400).json({ error: message }); }
}
