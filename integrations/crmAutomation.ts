import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptWhatsAppAccessToken } from './whatsappHttp.js';

type FlowNode = { id: string; data?: { kind?: string; pipelineId?: string; stageId?: string; templateName?: string; language?: string; variables?: string } };
type FlowEdge = { source: string; target: string };
type Opportunity = { id: string; pipeline_id: string; stage_id: string; patient_name: string | null; patient_phone: string | null; seller_name: string | null; title: string; amount_cents: number };
type QueueExecution = { id: string; flow_id: string; opportunity_id: string; trigger_stage_id: string };

const metaGraphVersion = process.env.META_GRAPH_VERSION || 'v23.0';
const normalizePhone = (value: string | null) => {
  const digits = String(value || '').replace(/\D/g, '');
  return (digits.length === 10 || digits.length === 11) && !digits.startsWith('55') ? `55${digits}` : digits;
};

function variableValue(key: string, opportunity: Opportunity) {
  return ({ patient_name: opportunity.patient_name || '', patient_phone: opportunity.patient_phone || '', seller_name: opportunity.seller_name || '', opportunity_title: opportunity.title || '', amount: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((opportunity.amount_cents || 0) / 100) } as Record<string, string>)[key] || '';
}

function templateComponents(mapping: string | undefined, opportunity: Opportunity) {
  const parameters = String(mapping || '').split(/\r?\n/).map(line => line.match(/^\s*\{\{(\d+)\}\}\s*=\s*([a-z_]+)\s*$/i)).filter((match): match is RegExpMatchArray => Boolean(match)).sort((a, b) => Number(a[1]) - Number(b[1])).map(match => ({ type: 'text', text: variableValue(match[2], opportunity) }));
  return parameters.length ? [{ type: 'body', parameters }] : undefined;
}

async function sendTemplate(db: SupabaseClient, userId: string, opportunity: Opportunity, node: FlowNode) {
  const { data: config, error } = await db.from('whatsapp_config').select('phone_number_id,access_token_encrypted,status').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!config || config.status !== 'connected' || !config.access_token_encrypted) throw new Error('WhatsApp Business nao conectado.');
  const phone = normalizePhone(opportunity.patient_phone);
  if (!phone) throw new Error('Oportunidade sem telefone valido.');
  const templateName = node.data?.templateName;
  if (!templateName) throw new Error('Fluxo sem template Meta configurado.');
  const response = await fetch(`https://graph.facebook.com/${metaGraphVersion}/${encodeURIComponent(config.phone_number_id)}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${decryptWhatsAppAccessToken(config.access_token_encrypted)}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: phone, type: 'template', template: { name: templateName, language: { code: node.data?.language || 'pt_BR' }, components: templateComponents(node.data?.variables, opportunity) } }), signal: AbortSignal.timeout(15_000) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || 'A Meta recusou o envio do template.');
  return String(body?.messages?.[0]?.id || '');
}

export async function queueCrmStageAutomations(db: SupabaseClient, userId: string, opportunity: Opportunity) {
  const { data: flows, error } = await db.from('crm_automation_flows').select('id,nodes,edges').eq('user_id', userId).eq('is_active', true);
  if (error) throw error;
  for (const flow of flows || []) {
    const nodes = (Array.isArray(flow.nodes) ? flow.nodes : []) as FlowNode[];
    const edges = (Array.isArray(flow.edges) ? flow.edges : []) as FlowEdge[];
    const trigger = nodes.find(node => node.data?.kind === 'trigger' && node.data.pipelineId === opportunity.pipeline_id && node.data.stageId === opportunity.stage_id);
    const templateNode = trigger ? nodes.find(node => node.id === edges.find(edge => edge.source === trigger.id)?.target && node.data?.kind === 'template') : undefined;
    if (!templateNode) continue;
    const { error: insertError } = await db.from('crm_automation_executions').insert({ flow_id: flow.id, user_id: userId, opportunity_id: opportunity.id, trigger_stage_id: opportunity.stage_id, template_name: templateNode.data?.templateName, status: 'pending' });
    if (insertError && insertError.code !== '23505') throw insertError;
  }
}

export async function processCrmAutomationQueue(db: SupabaseClient, userId: string, limit = 5) {
  const { data: claimed, error: claimError } = await db.rpc('claim_crm_automation_executions', { p_user_id: userId, p_limit: Math.min(10, Math.max(1, limit)) });
  if (claimError) throw claimError;
  const executions = (claimed || []) as QueueExecution[];
  if (!executions.length) return { claimed: 0, sent: 0, failed: 0, skipped: 0 };
  const [flowsResult, opportunitiesResult] = await Promise.all([
    db.from('crm_automation_flows').select('id,nodes,edges').in('id', [...new Set(executions.map(item => item.flow_id))]),
    db.from('clinic_experts_opportunities').select('id,pipeline_id,stage_id,patient_name,patient_phone,seller_name,title,amount_cents').in('id', [...new Set(executions.map(item => item.opportunity_id))]),
  ]);
  if (flowsResult.error) throw flowsResult.error;
  if (opportunitiesResult.error) throw opportunitiesResult.error;
  const flowsById = new Map((flowsResult.data || []).map(flow => [flow.id, flow]));
  const opportunitiesById = new Map((opportunitiesResult.data || []).map(opportunity => [opportunity.id, opportunity as Opportunity]));
  let sent = 0; let failed = 0; let skipped = 0;
  await Promise.all(executions.map(async execution => {
    const flow = flowsById.get(execution.flow_id);
    const opportunity = opportunitiesById.get(execution.opportunity_id);
    const nodes = (Array.isArray(flow?.nodes) ? flow.nodes : []) as FlowNode[];
    const edges = (Array.isArray(flow?.edges) ? flow.edges : []) as FlowEdge[];
    const trigger = nodes.find(node => node.data?.kind === 'trigger' && node.data.stageId === execution.trigger_stage_id);
    const templateNode = trigger ? nodes.find(node => node.id === edges.find(edge => edge.source === trigger.id)?.target && node.data?.kind === 'template') : undefined;
    if (!opportunity || !templateNode) { skipped += 1; await db.from('crm_automation_executions').update({ status: 'skipped', finished_at: new Date().toISOString(), locked_at: null, error_message: 'Fluxo ou oportunidade nao esta mais disponivel.' }).eq('id', execution.id); return; }
    try { const metaMessageId = await sendTemplate(db, userId, opportunity, templateNode); sent += 1; await db.from('crm_automation_executions').update({ status: 'sent', meta_message_id: metaMessageId, finished_at: new Date().toISOString(), locked_at: null }).eq('id', execution.id); }
    catch (error) { failed += 1; const message = error instanceof Error ? error.message : 'Falha ao enviar template.'; await db.from('crm_automation_executions').update({ status: 'failed', error_message: message.slice(0, 1000), available_at: new Date(Date.now() + 5 * 60_000).toISOString(), locked_at: null }).eq('id', execution.id); console.error('[crm-automation] template send failed', message); }
  }));
  return { claimed: executions.length, sent, failed, skipped };
}

export const processCrmStageAutomations = queueCrmStageAutomations;
