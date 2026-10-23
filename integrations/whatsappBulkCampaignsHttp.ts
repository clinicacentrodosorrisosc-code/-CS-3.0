import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { decryptWhatsAppAccessToken } from './whatsappHttp.js';
import { fallbackSupabaseAnonKey } from './supabasePublicConfig.js';

type Request = { method?: string; headers: Record<string, string | string[] | undefined>; body?: any };
type Response = { status: (code: number) => Response; json: (body: unknown) => void };
type Opportunity = { id: string; patient_phone: string | null; patient_name: string | null; patient_email?: string | null; seller_name: string | null; title: string; amount_cents: number; tags?: string[] };
type OrthoPatient = { id: string; name: string; maintenance_value: number | null; attendance: Record<string, any> | null; status: string };
type ImportedContact = { id: string; name: string; phone: string; normalized_phone: string; email: string | null; status: string; error_message: string | null; custom_fields?: Record<string, unknown> | null };
type ReactivationLead = { id: string; patient_name: string; phone: string; budget_value_cents: number; assignee: string | null; status: string };
type TagFilter = { mode: 'all' | 'include' | 'exclude'; tags: string[] };
const url = process.env.VITE_SUPABASE_URL || 'https://dmslcvvjxfulsocksave.supabase.co';
const anon = process.env.VITE_SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || fallbackSupabaseAnonKey;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const graphVersion = process.env.META_GRAPH_VERSION || 'v23.0';
const brazilRates: Record<string, number> = { MARKETING: 0.3217, UTILITY: 0.035, AUTHENTICATION: 0.035 };

const normalizePhone = (value: string | null) => { const digits = String(value || '').replace(/\D/g, ''); return (digits.length === 10 || digits.length === 11) && !digits.startsWith('55') ? `55${digits}` : digits; };
const normalizeName = (value: string | null) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
const paymentRecorded = (patient: OrthoPatient, month: string) => Boolean(patient.attendance?.[`__monthly_payment_${month}`]?.paidAt || patient.attendance?.[`__post12_payment_${month}`]?.paidAt);
const orthoAsOpportunity = (patient: OrthoPatient): Opportunity => ({ id: patient.id, patient_phone: String(patient.attendance?.__whatsapp_phone || '') || null, patient_name: patient.name, seller_name: null, title: 'Mensalidade de ortodontia', amount_cents: Math.round(Number(patient.maintenance_value || 0) * 100), tags: [] });
const importedContactAsOpportunity = (contact: ImportedContact): Opportunity => ({ id: contact.id, patient_phone: contact.normalized_phone || contact.phone || null, patient_name: contact.name || 'Contato sem nome', patient_email: contact.email || null, seller_name: null, title: 'Lista importada', amount_cents: 0, tags: [] });
const reactivationLeadAsOpportunity = (lead: ReactivationLead): Opportunity => ({ id: lead.id, patient_phone: lead.phone || null, patient_name: lead.patient_name || 'Paciente sem nome', seller_name: lead.assignee, title: 'Reativação de orçamento', amount_cents: Number(lead.budget_value_cents || 0), tags: [] });
const normalizeTagValue = (value: unknown) => String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
const tagFilterFrom = (source: Record<string, unknown>): TagFilter => {
  const serializedTags = typeof source.tagFilters === 'string' && source.tagFilters.trim().startsWith('[') ? (() => { try { const parsed = JSON.parse(source.tagFilters); return Array.isArray(parsed) ? parsed : []; } catch { return []; } })() : null;
  let rawTags: unknown[] = [];
  if (Array.isArray(source.tagFilters)) rawTags = source.tagFilters;
  else if (serializedTags) rawTags = serializedTags;
  else if (Array.isArray(source.tag_filter_values)) rawTags = source.tag_filter_values;
  else if (source.tagFilters) rawTags = [source.tagFilters];
  else if (source.tagFilter || source.tag || source.tag_filter_value) rawTags = [source.tagFilter || source.tag || source.tag_filter_value];
  const tags = [...new Set(rawTags.map(tag => String(tag || '').trim().replace(/\s+/g, ' ').slice(0, 40)).filter(Boolean))];
  const requestedMode = String(source.tagFilterMode || source.tagMode || 'all');
  return tags.length && (requestedMode === 'include' || requestedMode === 'exclude') ? { mode: requestedMode, tags } : { mode: 'all', tags: [] };
};
const matchesTagFilter = (opportunity: Opportunity, filter: TagFilter) => {
  if (filter.mode === 'all') return true;
  const selectedTags = new Set(filter.tags.map(normalizeTagValue));
  const hasAnySelectedTag = (Array.isArray(opportunity.tags) ? opportunity.tags : []).some(tag => selectedTags.has(normalizeTagValue(tag)));
  return filter.mode === 'include' ? hasAnySelectedTag : !hasAnySelectedTag;
};
const header = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
async function auth(req: Request) {
  const token = header(req.headers.authorization)?.replace(/^Bearer\s+/i, '') || '';
  if (!token || !service) throw new Error('Sessao invalida ou servidor nao configurado.');
  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) throw new Error('Sessao invalida. Faca login novamente.');
  return { userId: user.id, db: createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } }) };
}
function value(key: string, item: Opportunity) { return ({ patient_name: item.patient_name || '', patient_phone: item.patient_phone || '', contact_email: item.patient_email || '', seller_name: item.seller_name || '', opportunity_title: item.title || '', amount: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((item.amount_cents || 0) / 100) } as Record<string, string>)[key] || ''; }
function components(mapping: string, item: Opportunity) {
  const lines = String(mapping || '').split(/\r?\n/);
  const parameters = lines.map(line => line.match(/^\s*\{\{(\d+)\}\}\s*=\s*([a-z_]+)\s*$/i)).filter((match): match is RegExpMatchArray => Boolean(match)).sort((a, b) => Number(a[1]) - Number(b[1])).map(match => ({ type: 'text', text: value(match[2], item) }));
  const mediaHeader = lines.map(line => line.match(/^\s*__header_(image|video|document)_url\s*=\s*(https:\/\/\S+)\s*$/i)).find((match): match is RegExpMatchArray => Boolean(match));
  const headerTextParameters = lines.map(line => line.match(/^\s*__header_text_(\d+)\s*=\s*([a-z_]+)\s*$/i)).filter((match): match is RegExpMatchArray => Boolean(match)).sort((a, b) => Number(a[1]) - Number(b[1])).map(match => ({ type: 'text', text: value(match[2], item) }));
  const headerComponent = mediaHeader
    ? { type: 'header', parameters: [{ type: mediaHeader[1].toLowerCase(), [mediaHeader[1].toLowerCase()]: { link: mediaHeader[2] } }] }
    : headerTextParameters.length ? { type: 'header', parameters: headerTextParameters } : null;
  const copyCodeButtons = lines.map(line => line.match(/^\s*__copy_code_(\d+)\s*=\s*(.+?)\s*$/)).filter((match): match is RegExpMatchArray => Boolean(match)).map(match => ({ type: 'button', sub_type: 'copy_code', index: match[1], parameters: [{ type: 'coupon_code', coupon_code: match[2] }] }));
  const result = [headerComponent, parameters.length ? { type: 'body', parameters } : null, ...copyCodeButtons].filter(Boolean);
  return result.length ? result : undefined;
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
async function resolveOrthoPhones(db: SupabaseClient, userId: string, patients: OrthoPatient[]) {
  const missingNames = patients.filter(patient => normalizePhone(String(patient.attendance?.__whatsapp_phone || '')).length < 12).map(patient => normalizeName(patient.name));
  const crmPhones = new Map<string, string>();
  if (missingNames.length) {
    const { data, error } = await db.from('clinic_experts_opportunities').select('patient_name,patient_phone').eq('user_id', userId).not('patient_phone', 'is', null);
    if (error) throw error;
    const candidates = new Map<string, Set<string>>();
    for (const item of data || []) {
      const name = normalizeName(item.patient_name); const phone = normalizePhone(item.patient_phone);
      if (name && phone.length >= 12) {
        const phones = candidates.get(name) || new Set<string>();
        phones.add(phone); candidates.set(name, phones);
      }
    }
    for (const [name, phones] of candidates) if (phones.size === 1) crmPhones.set(name, [...phones][0]);
  }
  return patients.map(patient => {
    const attendance = patient.attendance || {};
    const direct = normalizePhone(String(attendance.__whatsapp_phone || ''));
    const history = Array.isArray(attendance.__whatsapp_history) ? attendance.__whatsapp_history : [];
    const historical = normalizePhone(String(history.find((entry: any) => entry?.phone)?.phone || ''));
    const crm = crmPhones.get(normalizeName(patient.name)) || '';
    const phone = direct.length >= 12 ? direct : historical.length >= 12 ? historical : crm;
    const phoneSource = direct.length >= 12 ? 'orthodontics' : historical.length >= 12 ? 'history' : crm ? 'crm' : 'none';
    return { ...orthoAsOpportunity(patient), patient, phone, phoneSource, status: phone.length >= 12 ? 'ready' : 'skipped', reason: phone.length >= 12 ? '' : 'Telefone ausente ou invalido.' };
  });
}

async function getContactLists(db: SupabaseClient, userId: string, listId?: string) {
  if (listId) {
    const { data: list, error: listError } = await db.from('whatsapp_contact_lists').select('*').eq('id', listId).eq('user_id', userId).single();
    if (listError) throw listError;
    const { data: contacts, error: contactsError } = await db.from('whatsapp_contact_list_contacts').select('id,name,phone,normalized_phone,email,status,error_message,custom_fields,created_at').eq('list_id', listId).eq('user_id', userId).order('created_at');
    if (contactsError) throw contactsError;
    return { list, contacts: contacts || [] };
  }
  const { data, error } = await db.from('whatsapp_contact_lists').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return { lists: data || [] };
}

function safeCustomFields(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 30).map(([key, fieldValue]) => [String(key).slice(0, 80), String(fieldValue ?? '').slice(0, 500)]));
}

async function importContactList(db: SupabaseClient, userId: string, input: any) {
  const name = String(input?.name || '').trim().slice(0, 120);
  const description = String(input?.description || '').trim().slice(0, 500) || null;
  const sourceFileName = String(input?.sourceFileName || '').trim().slice(0, 180) || null;
  const rawContacts = Array.isArray(input?.contacts) ? input.contacts.slice(0, 5000) : [];
  if (!name) throw new Error('Informe um nome para a lista de contatos.');
  if (!rawContacts.length) throw new Error('A planilha nao possui contatos para importar.');
  const seenPhones = new Set<string>();
  let validContacts = 0; let invalidContacts = 0; let duplicateContacts = 0;
  const contacts = rawContacts.map((item: any, index: number) => {
    const contactName = String(item?.name || '').trim().replace(/\s+/g, ' ').slice(0, 160) || `Contato ${index + 1}`;
    const rawPhone = String(item?.phone || '').trim().slice(0, 60);
    const phone = normalizePhone(rawPhone);
    const email = String(item?.email || '').trim().toLowerCase().slice(0, 180) || null;
    let status: 'valid' | 'invalid' | 'duplicate' = 'valid';
    let errorMessage: string | null = null;
    if (phone.length < 12 || phone.length > 15) {
      status = 'invalid'; errorMessage = 'Telefone ausente ou invalido.'; invalidContacts += 1;
    } else if (seenPhones.has(phone)) {
      status = 'duplicate'; errorMessage = 'Telefone duplicado dentro desta lista.'; duplicateContacts += 1;
    } else {
      seenPhones.add(phone); validContacts += 1;
    }
    return { user_id: userId, name: contactName, phone: rawPhone, normalized_phone: phone, email, custom_fields: safeCustomFields(item?.customFields), status, error_message: errorMessage };
  });
  const { data: list, error: listError } = await db.from('whatsapp_contact_lists').insert({ user_id: userId, name, description, source_file_name: sourceFileName, total_contacts: contacts.length, valid_contacts: validContacts, invalid_contacts: invalidContacts, duplicate_contacts: duplicateContacts }).select('*').single();
  if (listError || !list) throw listError || new Error('Falha ao criar a lista.');
  for (let index = 0; index < contacts.length; index += 500) {
    const { error } = await db.from('whatsapp_contact_list_contacts').insert(contacts.slice(index, index + 500).map((contact: (typeof contacts)[number]) => ({ ...contact, list_id: list.id })));
    if (error) {
      await db.from('whatsapp_contact_lists').delete().eq('id', list.id).eq('user_id', userId);
      throw error;
    }
  }
  return { list, summary: { total: contacts.length, valid: validContacts, invalid: invalidContacts, duplicate: duplicateContacts } };
}

async function deleteContactList(db: SupabaseClient, userId: string, listId: string) {
  if (!listId) throw new Error('Lista nao informada.');
  const { count, error: campaignError } = await db.from('whatsapp_bulk_campaigns').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('contact_list_id', listId);
  if (campaignError) throw campaignError;
  if (count) throw new Error('Esta lista ja foi usada em uma campanha e precisa ser mantida para preservar o historico.');
  const { error } = await db.from('whatsapp_contact_lists').delete().eq('id', listId).eq('user_id', userId);
  if (error) throw error;
  return { deleted: true };
}

async function sendBatch(db: SupabaseClient, userId: string, campaignId: string) {
  const { data: campaign, error: campaignError } = await db.from('whatsapp_bulk_campaigns').select('template_name,template_language,variable_mapping,success_tag,source,payment_month').eq('id', campaignId).eq('user_id', userId).single();
  if (campaignError) throw campaignError;
  const { data: config, error: configError } = await db.from('whatsapp_config').select('phone_number_id,access_token_encrypted,status').eq('user_id', userId).maybeSingle();
  if (configError || !config || config.status !== 'connected' || !config.access_token_encrypted) throw new Error('WhatsApp Business nao conectado.');
  // Keep campaigns for existing sources operational even when the optional
  // budget-reactivation migration has not reached the database yet.
  const recipientColumns = campaign.source === 'budget_reactivation'
    ? 'id,opportunity_id,ortho_patient_id,contact_list_contact_id,budget_reactivation_lead_id,phone'
    : 'id,opportunity_id,ortho_patient_id,contact_list_contact_id,phone';
  const recipientTable = db.from('whatsapp_bulk_campaign_recipients') as any;
  const { data: rows, error: rowsError } = await recipientTable.select(recipientColumns).eq('campaign_id', campaignId).eq('status', 'pending').order('created_at').limit(15);
  if (rowsError) throw rowsError;
  let sent = 0; let failed = 0;
  for (const row of rows || []) {
    await db.from('whatsapp_bulk_campaign_recipients').update({ status: 'sending', attempts: 1 }).eq('id', row.id).eq('status', 'pending');
    const isOrthodontics = campaign.source === 'orthodontics';
    const isContactList = campaign.source === 'contact_list';
    const isReactivation = campaign.source === 'budget_reactivation';
    const { data: sourceItem } = isOrthodontics
      ? await db.from('ortho_patients').select('id,name,maintenance_value,attendance,status').eq('id', row.ortho_patient_id).single()
      : isContactList
        ? await db.from('whatsapp_contact_list_contacts').select('id,name,phone,normalized_phone,email,status,error_message,custom_fields').eq('id', row.contact_list_contact_id).eq('user_id', userId).single()
        : isReactivation
          ? await db.from('budget_reactivation_leads').select('id,patient_name,phone,budget_value_cents,assignee,status').eq('id', row.budget_reactivation_lead_id).single()
        : await db.from('clinic_experts_opportunities').select('id,patient_phone,patient_name,patient_email,seller_name,title,amount_cents,tags').eq('id', row.opportunity_id).single();
    const item = isOrthodontics && sourceItem ? orthoAsOpportunity(sourceItem as OrthoPatient) : isContactList && sourceItem ? importedContactAsOpportunity(sourceItem as ImportedContact) : isReactivation && sourceItem ? reactivationLeadAsOpportunity(sourceItem as ReactivationLead) : sourceItem as Opportunity | null;
    try {
      if (!item) throw new Error(isOrthodontics ? 'Paciente de ortodontia nao encontrado.' : 'Oportunidade nao encontrada.');
      const response = await fetch(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(config.phone_number_id)}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${decryptWhatsAppAccessToken(config.access_token_encrypted)}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: row.phone, type: 'template', template: { name: campaign.template_name, language: { code: campaign.template_language }, components: components(campaign.variable_mapping, item as Opportunity) } }), signal: AbortSignal.timeout(15000) });
      const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body?.error?.message || 'A Meta recusou o envio.');
      const sentAt = new Date().toISOString();
      const metaMessageId = String(body?.messages?.[0]?.id || '');
      sent += 1; await db.from('whatsapp_bulk_campaign_recipients').update({ status: 'sent', meta_message_id: metaMessageId, sent_at: sentAt }).eq('id', row.id);
      if (isReactivation && sourceItem) {
        const reactivationLead = sourceItem as ReactivationLead;
        const historyNote = `Disparo em massa · campanha ${campaignId} · template ${campaign.template_name}${metaMessageId ? ` · Meta ${metaMessageId}` : ''}`;
        const { error: historyError } = await db.from('budget_reactivation_interactions').insert({
          lead_id: reactivationLead.id,
          channel: 'whatsapp',
          outcome: 'message_sent',
          note: historyNote.slice(0, 1000),
          seller: reactivationLead.assignee || 'James',
        });
        if (historyError) console.error('Falha ao registrar histórico de reativação:', historyError.message);
        const { error: leadUpdateError } = await db.from('budget_reactivation_leads').update({ status: 'contacted', last_contact_at: sentAt }).eq('id', reactivationLead.id);
        if (leadUpdateError) console.error('Falha ao atualizar carteira de reativação:', leadUpdateError.message);
      }
      if (isOrthodontics && sourceItem) {
        const attendance = { ...((sourceItem as OrthoPatient).attendance || {}) };
        const history = Array.isArray(attendance.__whatsapp_history) ? attendance.__whatsapp_history : [];
        const historyEntry = { id: metaMessageId || `bulk-${campaignId}-${row.id}`, phone: row.phone, message: `Template Meta: ${campaign.template_name}`, amount: Number((sourceItem as OrthoPatient).maintenance_value || 0), status: 'sent', openedAt: sentAt, sentAt, source: 'bulk', campaignId, templateName: campaign.template_name, paymentMonth: campaign.payment_month || null, metaMessageId };
        attendance.__whatsapp_phone = row.phone;
        attendance.__whatsapp_history = [historyEntry, ...history].slice(0, 100);
        await db.from('ortho_patients').update({ attendance }).eq('id', row.ortho_patient_id);
      } else if (!isContactList && !isReactivation && campaign.success_tag) {
        const currentTags = Array.isArray(item.tags) ? item.tags.map(String) : [];
        if (!currentTags.includes(campaign.success_tag)) await db.from('clinic_experts_opportunities').update({ tags: [...currentTags, campaign.success_tag] }).eq('id', item.id).eq('user_id', userId);
      }
    } catch (error) { failed += 1; await db.from('whatsapp_bulk_campaign_recipients').update({ status: 'failed', error_message: (error instanceof Error ? error.message : 'Falha ao enviar.').slice(0, 1000) }).eq('id', row.id); }
  }
  const { count: pending } = await db.from('whatsapp_bulk_campaign_recipients').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).eq('status', 'pending');
  const { count: totalSent } = await db.from('whatsapp_bulk_campaign_recipients').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).eq('status', 'sent');
  const { count: totalFailed } = await db.from('whatsapp_bulk_campaign_recipients').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).eq('status', 'failed');
  await db.from('whatsapp_bulk_campaigns').update({ status: pending ? 'sending' : 'completed', sent_count: totalSent || 0, failed_count: totalFailed || 0, finished_at: pending ? null : new Date().toISOString() }).eq('id', campaignId);
  return { sent, failed, pending: pending || 0, completed: !pending };
}
async function registerSkippedRecipients(db: SupabaseClient, campaign: any) {
  let query = db.from('clinic_experts_opportunities').select('id,patient_phone,tags').eq('user_id', campaign.user_id).eq('pipeline_id', campaign.pipeline_id);
  if (campaign.stage_id) query = query.eq('stage_id', campaign.stage_id);
  const { data: opportunities, error } = await query; if (error) throw error;
  const { data: existing, error: existingError } = await db.from('whatsapp_bulk_campaign_recipients').select('opportunity_id,phone').eq('campaign_id', campaign.id);
  if (existingError) throw existingError;
  const existingIds = new Set((existing || []).map(item => item.opportunity_id)); const usedPhones = new Set((existing || []).map(item => item.phone).filter(Boolean));
  const tagFilter = tagFilterFrom({ tagFilterMode: campaign.tag_filter_mode, tagFilters: campaign.tag_filter_values, tagFilter: campaign.tag_filter_value });
  const skipped = (opportunities || []).filter(item => matchesTagFilter(item as Opportunity, tagFilter) && !existingIds.has(item.id)).map(item => {
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
  const source = String(params.source || 'crm');
  const pipelineId = String(params.pipelineId || ''), stageId = String(params.stageId || ''), opportunityId = String(params.opportunityId || ''), contactListId = String(params.contactListId || ''), templateName = String(params.templateName || ''), language = String(params.language || 'pt_BR');
  const paymentMonth = String(params.paymentMonth || new Date().toISOString().slice(0, 7));
  if (!templateName) throw new Error('Selecione o template para conferir a campanha.');
  if (source === 'crm' && !pipelineId) throw new Error('Selecione o funil para conferir a campanha.');
  if (source === 'contact_list' && !contactListId) throw new Error('Selecione a lista de contatos para conferir a campanha.');
  const { data: config, error: configError } = await db.from('whatsapp_config').select('waba_id,access_token_encrypted,status').eq('user_id', userId).maybeSingle();
  if (configError || !config || config.status !== 'connected' || !config.waba_id || !config.access_token_encrypted) throw new Error('Conecte o WhatsApp Business e informe o WABA ID.');
  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(config.waba_id)}/message_templates?limit=100&fields=name,status,language,category,components`, { headers: { Authorization: `Bearer ${decryptWhatsAppAccessToken(config.access_token_encrypted)}` }, signal: AbortSignal.timeout(15000) });
  const body: any = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body?.error?.message || 'Nao foi possivel consultar o template na Meta.');
  const template = (body.data || []).find((item: any) => item.name === templateName && item.language === language && item.status === 'APPROVED');
  if (!template) throw new Error('O template aprovado nao foi encontrado na Meta. Atualize os templates e tente novamente.');
  const allowHistory = String(params.useHistoricalPhones || '') === 'true';
  const tagFilter = tagFilterFrom(params);
  let filteredOpportunities: Opportunity[] = [];
  let resolved: any[] = [];
  if (source === 'orthodontics') {
    const { data: patients, error } = await db.from('ortho_patients').select('id,name,maintenance_value,attendance,status').eq('status', 'Active').order('name'); if (error) throw error;
    const pendingPatients = (patients || []).filter(patient => !paymentRecorded(patient as OrthoPatient, paymentMonth)) as OrthoPatient[];
    filteredOpportunities = pendingPatients.map(orthoAsOpportunity);
    resolved = await resolveOrthoPhones(db, userId, pendingPatients);
  } else if (source === 'contact_list') {
    const { data: list, error: listError } = await db.from('whatsapp_contact_lists').select('id').eq('id', contactListId).eq('user_id', userId).single();
    if (listError || !list) throw listError || new Error('Lista de contatos nao encontrada.');
    const { data: contacts, error } = await db.from('whatsapp_contact_list_contacts').select('id,name,phone,normalized_phone,email,status,error_message,custom_fields').eq('list_id', contactListId).eq('user_id', userId).order('created_at');
    if (error) throw error;
    filteredOpportunities = (contacts || []).map(contact => importedContactAsOpportunity(contact as ImportedContact));
    resolved = (contacts || []).map(contact => ({
      ...importedContactAsOpportunity(contact as ImportedContact),
      phone: String(contact.normalized_phone || ''),
      phoneSource: 'contact_list',
      status: contact.status === 'valid' ? 'ready' : 'skipped',
      reason: contact.status === 'valid' ? '' : contact.error_message || 'Contato invalido na lista.',
    }));
  } else if (source === 'budget_reactivation') {
    const requestedIds = Array.isArray(params.leadIds) ? params.leadIds.map(String) : [];
    let query = db.from('budget_reactivation_leads').select('id,patient_name,phone,budget_value_cents,assignee,status').eq('status', 'pending');
    if (requestedIds.length) query = query.in('id', requestedIds);
    const { data: leads, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    filteredOpportunities = (leads || []).map(lead => reactivationLeadAsOpportunity(lead as ReactivationLead));
    resolved = (leads || []).map(lead => ({ ...reactivationLeadAsOpportunity(lead as ReactivationLead), phone: normalizePhone(lead.phone), status: normalizePhone(lead.phone).length >= 12 ? 'ready' : 'skipped', reason: normalizePhone(lead.phone).length >= 12 ? '' : 'Telefone ausente ou invalido.' }));
  } else {
    let query = db.from('clinic_experts_opportunities').select('id,patient_external_id,patient_phone,patient_name,patient_email,seller_name,title,amount_cents,tags').eq('user_id', userId).eq('pipeline_id', pipelineId);
    if (stageId) query = query.eq('stage_id', stageId);
    if (opportunityId) query = query.eq('id', opportunityId);
    const { data: opportunities, error } = await query; if (error) throw error;
    filteredOpportunities = (opportunities || []).filter(item => matchesTagFilter(item as Opportunity, tagFilter)) as Opportunity[];
    resolved = await resolvePhones(db, userId, filteredOpportunities as any, allowHistory);
  }
  const phones = new Set<string>(); let eligible = 0; let skippedInvalid = 0; let skippedDuplicate = 0; let awaitingConfirmation = 0; let sample: Opportunity | null = null;
  const contacts = resolved.map(item => { if (item.status === 'needs_confirmation') { awaitingConfirmation += 1; return { id: item.id, patient_name: item.patient_name || 'Paciente sem nome', opportunity_title: item.title || 'Oportunidade', phone: item.phone, status: item.status, reason: item.reason, phoneSource: item.phoneSource }; } if (item.status !== 'ready') { skippedInvalid += 1; return { id: item.id, patient_name: item.patient_name || 'Paciente sem nome', opportunity_title: item.title || 'Oportunidade', phone: item.phone, status: item.status, reason: item.reason, phoneSource: item.phoneSource }; } if (phones.has(item.phone)) { skippedDuplicate += 1; return { id: item.id, patient_name: item.patient_name || 'Paciente sem nome', opportunity_title: item.title || 'Oportunidade', phone: item.phone, status: 'skipped', reason: 'Telefone duplicado nesta campanha.', phoneSource: item.phoneSource }; } phones.add(item.phone); eligible += 1; sample ||= item; return { id: item.id, patient_name: item.patient_name || 'Paciente sem nome', opportunity_title: item.title || 'Oportunidade', phone: item.phone, status: 'ready', reason: item.reason, phoneSource: item.phoneSource }; });
  const category = String(template.category || '').toUpperCase(); const unitPrice = brazilRates[category] || 0; const outsideBrazil = [...phones].filter(phone => !phone.startsWith('55')).length;
  const pricingNote = !unitPrice
    ? 'A Meta nao informou uma tarifa estimavel para esta categoria.'
    : outsideBrazil > 0
      ? `Estimativa calculada com a tarifa Brasil para o lote; ${outsideBrazil} numero(s) com outro DDI podem ter valor diferente. Descontos, creditos e isencoes nao estao incluidos.`
      : 'Estimativa maxima para mensagens entregues a numeros com DDI Brasil; descontos por volume, creditos e isencoes nao estao incluidos.';
  return { template: { name: template.name, language: template.language, category, body: (template.components || []).find((item: any) => item.type === 'BODY')?.text || '' }, filter: tagFilter, recipients: { totalCards: filteredOpportunities.length, eligible, skippedInvalid, skippedDuplicate, awaitingConfirmation, contacts }, sample, pricing: { currency: 'BRL', unitPrice, total: unitPrice * eligible, estimated: Boolean(unitPrice), outsideBrazil, note: pricingNote } };
}
export async function handleWhatsAppBulkCampaigns(req: Request, res: Response) {
  try {
    const { userId, db } = await auth(req);
    if (req.method === 'GET') {
      const action = String((req as any).query?.action || '');
      if (action === 'preview') return res.status(200).json(await previewCampaign(db, userId, (req as any).query || {}));
      if (action === 'contact-lists') return res.status(200).json(await getContactLists(db, userId, String((req as any).query?.listId || '') || undefined));
      const campaignId = String((req as any).query?.campaignId || '');
      if (campaignId) {
        const { data: campaign, error: campaignError } = await db.from('whatsapp_bulk_campaigns').select('*').eq('id', campaignId).eq('user_id', userId).single(); if (campaignError) throw campaignError;
        if (campaign.source === 'crm') await registerSkippedRecipients(db, campaign);
        const recipientColumns = campaign.source === 'budget_reactivation'
          ? 'id,opportunity_id,ortho_patient_id,contact_list_contact_id,budget_reactivation_lead_id,phone,status,meta_message_id,error_message,created_at,sent_at'
          : 'id,opportunity_id,ortho_patient_id,contact_list_contact_id,phone,status,meta_message_id,error_message,created_at,sent_at';
        const recipientTable = db.from('whatsapp_bulk_campaign_recipients') as any;
        const { data: rawRecipients, error: recipientError } = await recipientTable.select(recipientColumns).eq('campaign_id', campaign.id).order('created_at'); if (recipientError) throw recipientError;
        const recipients: any[] = rawRecipients || [];
        if (campaign.source === 'orthodontics') {
          const ids = (recipients || []).map(item => item.ortho_patient_id).filter(Boolean); const { data: patients, error: patientsError } = ids.length ? await db.from('ortho_patients').select('id,name').in('id', ids) : { data: [], error: null }; if (patientsError) throw patientsError;
          const names = new Map((patients || []).map(item => [item.id, item.name]));
          return res.status(200).json({ campaign, recipients: (recipients || []).map(item => ({ ...item, patient_name: names.get(item.ortho_patient_id) || 'Paciente sem nome', opportunity_title: 'Mensalidade de ortodontia' })) });
        }
        if (campaign.source === 'contact_list') {
          const ids = (recipients || []).map(item => item.contact_list_contact_id).filter(Boolean);
          const { data: contacts, error: contactsError } = ids.length ? await db.from('whatsapp_contact_list_contacts').select('id,name').in('id', ids).eq('user_id', userId) : { data: [], error: null };
          if (contactsError) throw contactsError;
          const names = new Map((contacts || []).map(item => [item.id, item.name]));
          return res.status(200).json({ campaign, recipients: (recipients || []).map(item => ({ ...item, patient_name: names.get(item.contact_list_contact_id) || 'Contato sem nome', opportunity_title: 'Lista importada' })) });
        }
        if (campaign.source === 'budget_reactivation') {
          const ids = (recipients || []).map(item => item.budget_reactivation_lead_id).filter(Boolean);
          const { data: leads, error: leadsError } = ids.length ? await db.from('budget_reactivation_leads').select('id,patient_name').in('id', ids) : { data: [], error: null };
          if (leadsError) throw leadsError;
          const names = new Map((leads || []).map(item => [item.id, item.patient_name]));
          return res.status(200).json({ campaign, recipients: (recipients || []).map(item => ({ ...item, patient_name: names.get(item.budget_reactivation_lead_id) || 'Paciente sem nome', opportunity_title: 'Reativação de orçamento' })) });
        }
        const ids = (recipients || []).map(item => item.opportunity_id).filter(Boolean); const { data: opportunities, error: opportunitiesError } = ids.length ? await db.from('clinic_experts_opportunities').select('id,patient_name,title').in('id', ids) : { data: [], error: null }; if (opportunitiesError) throw opportunitiesError;
        const names = new Map((opportunities || []).map(item => [item.id, item]));
        return res.status(200).json({ campaign, recipients: (recipients || []).map(item => ({ ...item, patient_name: names.get(item.opportunity_id)?.patient_name || 'Paciente sem nome', opportunity_title: names.get(item.opportunity_id)?.title || 'Oportunidade' })) });
      }
      const source = String((req as any).query?.source || '');
      let campaignsQuery = db.from('whatsapp_bulk_campaigns').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20);
      if (source === 'crm' || source === 'orthodontics' || source === 'contact_list') campaignsQuery = campaignsQuery.eq('source', source);
      const { data, error } = await campaignsQuery; if (error) throw error; return res.status(200).json({ campaigns: data || [] });
    }
    if (req.method === 'DELETE' && req.body?.action === 'delete_contact_list') return res.status(200).json(await deleteContactList(db, userId, String(req.body?.listId || '')));
    if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo nao permitido.' });
    if (req.body?.action === 'import_contact_list') return res.status(201).json(await importContactList(db, userId, req.body));
    if (req.body?.action === 'process') return res.status(200).json(await sendBatch(db, userId, String(req.body.campaignId || '')));
    const { name, templateName, language = 'pt_BR', variableMapping = '', pipelineId, stageId, contactListId, useHistoricalPhones = false, selectedOpportunityIds, selectedPatientIds, selectedContactIds, successTag } = req.body || {};
    const source = String(req.body?.source || 'crm');
    const paymentMonth = String(req.body?.paymentMonth || new Date().toISOString().slice(0, 7));
    const tagFilter = tagFilterFrom(req.body || {});
    if (!name || !templateName) return res.status(400).json({ error: 'Nome e template sao obrigatorios.' });
    if (source === 'crm' && !pipelineId) return res.status(400).json({ error: 'Selecione o funil da campanha.' });
    if (source === 'contact_list' && !contactListId) return res.status(400).json({ error: 'Selecione uma lista de contatos.' });
    if (source === 'crm' && ['include', 'exclude'].includes(String(req.body?.tagFilterMode || '')) && !tagFilter.tags.length) return res.status(400).json({ error: 'Selecione ao menos uma tag usada no filtro do público.' });
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
    let filteredOpportunities: Opportunity[] = [];
    let resolved: any[] = [];
    if (source === 'orthodontics') {
      const { data: patients, error } = await db.from('ortho_patients').select('id,name,maintenance_value,attendance,status').eq('status', 'Active').order('name'); if (error) throw error;
      const pendingPatients = (patients || []).filter(patient => !paymentRecorded(patient as OrthoPatient, paymentMonth)) as OrthoPatient[];
      filteredOpportunities = pendingPatients.map(orthoAsOpportunity);
      resolved = await resolveOrthoPhones(db, userId, pendingPatients);
    } else if (source === 'contact_list') {
      const { data: list, error: listError } = await db.from('whatsapp_contact_lists').select('id').eq('id', contactListId).eq('user_id', userId).single();
      if (listError || !list) throw listError || new Error('Lista de contatos nao encontrada.');
      const { data: contacts, error } = await db.from('whatsapp_contact_list_contacts').select('id,name,phone,normalized_phone,email,status,error_message,custom_fields').eq('list_id', contactListId).eq('user_id', userId).order('created_at');
      if (error) throw error;
      filteredOpportunities = (contacts || []).map(contact => importedContactAsOpportunity(contact as ImportedContact));
      resolved = (contacts || []).map(contact => ({
        ...importedContactAsOpportunity(contact as ImportedContact),
        phone: String(contact.normalized_phone || ''),
        phoneSource: 'contact_list',
        status: contact.status === 'valid' ? 'ready' : 'skipped',
        reason: contact.status === 'valid' ? '' : contact.error_message || 'Contato invalido na lista.',
      }));
    } else if (source === 'budget_reactivation') {
      const requestedIds = Array.isArray(req.body?.selectedLeadIds) ? req.body.selectedLeadIds.map(String) : [];
      if (!requestedIds.length) return res.status(400).json({ error: 'Selecione ao menos um orçamento.' });
      const { data: leads, error } = await db.from('budget_reactivation_leads').select('id,patient_name,phone,budget_value_cents,assignee,status').in('id', requestedIds).eq('status', 'pending');
      if (error) throw error;
      filteredOpportunities = (leads || []).map(lead => reactivationLeadAsOpportunity(lead as ReactivationLead));
      resolved = (leads || []).map(lead => ({ ...reactivationLeadAsOpportunity(lead as ReactivationLead), phone: normalizePhone(lead.phone), status: normalizePhone(lead.phone).length >= 12 ? 'ready' : 'skipped', reason: normalizePhone(lead.phone).length >= 12 ? '' : 'Telefone ausente ou invalido.' }));
    } else {
      let query = db.from('clinic_experts_opportunities').select('id,patient_external_id,patient_phone,patient_name,patient_email,seller_name,title,amount_cents,tags').eq('user_id', userId).eq('pipeline_id', pipelineId);
      if (stageId) query = query.eq('stage_id', stageId);
      const { data: opportunities, error } = await query; if (error) throw error;
      filteredOpportunities = (opportunities || []).filter(item => matchesTagFilter(item as Opportunity, tagFilter)) as Opportunity[];
      resolved = await resolvePhones(db, userId, filteredOpportunities as any, Boolean(useHistoricalPhones));
    }
    const usedPhones = new Set<string>();
    const allowedIds = new Set(filteredOpportunities.map(item => item.id));
    const rawSelectedIds = source === 'orthodontics' ? selectedPatientIds : source === 'contact_list' ? selectedContactIds : source === 'budget_reactivation' ? req.body?.selectedLeadIds : selectedOpportunityIds;
    const requestedIds = Array.isArray(rawSelectedIds) ? rawSelectedIds.map(String).filter(id => allowedIds.has(id)) : Array.from(allowedIds);
    const selectedIds = new Set(requestedIds);
    if (!selectedIds.size) return res.status(400).json({ error: 'Selecione ao menos um contato para o disparo.' });
    const recipients = resolved.map(item => {
      const selected = selectedIds.has(item.id);
      const duplicate = selected && item.status === 'ready' && usedPhones.has(item.phone);
      if (selected && item.status === 'ready' && !duplicate) usedPhones.add(item.phone);
      return {
        opportunity_id: source === 'crm' ? item.id : null,
        ortho_patient_id: source === 'orthodontics' ? item.id : null,
        contact_list_contact_id: source === 'contact_list' ? item.id : null,
        ...(source === 'budget_reactivation' ? { budget_reactivation_lead_id: item.id } : {}),
        phone: item.phone,
        status: selected && item.status === 'ready' && !duplicate ? 'pending' : 'skipped',
        error_message: !selected ? 'Contato nao selecionado antes do disparo.' : duplicate ? 'Telefone duplicado na campanha; nao foi reenviado.' : item.reason || 'Telefone ausente ou invalido.'
      };
    });
    if (!recipients.some(item => item.status === 'pending')) return res.status(400).json({ error: 'Nenhum contato com telefone valido e unico foi encontrado neste filtro.' });
    const normalizedSuccessTag = String(successTag || '').trim().replace(/\s+/g, ' ').slice(0, 40) || null;
    const { data: campaign, error: createError } = await db.from('whatsapp_bulk_campaigns').insert({ user_id: userId, name: String(name).slice(0, 120), template_name: templateName, template_language: language, variable_mapping: variableMapping, pipeline_id: source === 'crm' ? pipelineId : null, stage_id: source === 'crm' ? stageId || null : null, contact_list_id: source === 'contact_list' ? contactListId : null, source, payment_month: source === 'orthodontics' ? paymentMonth : null, success_tag: source === 'crm' ? normalizedSuccessTag : null, tag_filter_mode: source === 'crm' ? tagFilter.mode : 'all', tag_filter_value: source === 'crm' ? tagFilter.tags[0] || null : null, tag_filter_values: source === 'crm' ? tagFilter.tags : [], status: 'sending', total_recipients: recipients.length, started_at: new Date().toISOString() }).select('id').single();
    if (createError || !campaign) throw createError || new Error('Falha ao criar campanha.');
    const { error: recipientsError } = await db.from('whatsapp_bulk_campaign_recipients').insert(recipients.map(item => ({ ...item, campaign_id: campaign.id }))); if (recipientsError) throw recipientsError;
    return res.status(201).json({ campaignId: campaign.id, totalRecipients: recipients.filter(item => item.status === 'pending').length });
  } catch (error) { const message = error instanceof Error ? error.message : 'Falha na campanha.'; return res.status(/Sessao/i.test(message) ? 401 : 400).json({ error: message }); }
}
