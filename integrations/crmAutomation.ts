import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptWhatsAppAccessToken } from './whatsappHttp.js';

type FlowNode = {
  id: string;
  data?: {
    kind?: string;
    pipelineId?: string;
    stageId?: string;
    templateName?: string;
    language?: string;
    variables?: string;
  };
};
type FlowEdge = { source: string; target: string };
type Opportunity = {
  id: string;
  pipeline_id: string;
  stage_id: string;
  patient_name: string | null;
  patient_phone: string | null;
  seller_name: string | null;
  title: string;
  amount_cents: number;
};

const metaGraphVersion = process.env.META_GRAPH_VERSION || 'v23.0';

function normalizePhone(value: string | null) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) return `55${digits}`;
  return digits;
}

function variableValue(key: string, opportunity: Opportunity) {
  const values: Record<string, string> = {
    patient_name: opportunity.patient_name || '',
    patient_phone: opportunity.patient_phone || '',
    seller_name: opportunity.seller_name || '',
    opportunity_title: opportunity.title || '',
    amount: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((opportunity.amount_cents || 0) / 100),
  };
  return values[key] || '';
}

function templateComponents(mapping: string | undefined, opportunity: Opportunity) {
  const parameters = String(mapping || '')
    .split(/\r?\n/)
    .map(line => line.match(/^\s*\{\{(\d+)\}\}\s*=\s*([a-z_]+)\s*$/i))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .sort((a, b) => Number(a[1]) - Number(b[1]))
    .map(match => ({ type: 'text', text: variableValue(match[2], opportunity) }));
  return parameters.length ? [{ type: 'body', parameters }] : undefined;
}

async function sendTemplate(db: SupabaseClient, userId: string, opportunity: Opportunity, node: FlowNode) {
  const { data: config, error } = await db
    .from('whatsapp_config')
    .select('phone_number_id,access_token_encrypted,status')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!config || config.status !== 'connected' || !config.access_token_encrypted) throw new Error('WhatsApp Business não conectado.');
  const phone = normalizePhone(opportunity.patient_phone);
  if (!phone) throw new Error('Oportunidade sem telefone válido.');
  const templateName = node.data?.templateName;
  if (!templateName) throw new Error('Fluxo sem template Meta configurado.');

  const response = await fetch(`https://graph.facebook.com/${metaGraphVersion}/${encodeURIComponent(config.phone_number_id)}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${decryptWhatsAppAccessToken(config.access_token_encrypted)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: node.data?.language || 'pt_BR' },
        components: templateComponents(node.data?.variables, opportunity),
      },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || 'A Meta recusou o envio do template.');
  return String(body?.messages?.[0]?.id || '');
}

export async function processCrmStageAutomations(db: SupabaseClient, userId: string, opportunity: Opportunity) {
  const { data: flows, error } = await db
    .from('crm_automation_flows')
    .select('id,nodes,edges')
    .eq('user_id', userId)
    .eq('is_active', true);
  if (error) throw error;

  for (const flow of flows || []) {
    const nodes = (Array.isArray(flow.nodes) ? flow.nodes : []) as FlowNode[];
    const edges = (Array.isArray(flow.edges) ? flow.edges : []) as FlowEdge[];
    const trigger = nodes.find(node => node.data?.kind === 'trigger' && node.data.pipelineId === opportunity.pipeline_id && node.data.stageId === opportunity.stage_id);
    if (!trigger) continue;
    const nextId = edges.find(edge => edge.source === trigger.id)?.target;
    const templateNode = nodes.find(node => node.id === nextId && node.data?.kind === 'template');
    if (!templateNode) continue;

    const { data: execution, error: insertError } = await db
      .from('crm_automation_executions')
      .insert({ flow_id: flow.id, user_id: userId, opportunity_id: opportunity.id, trigger_stage_id: opportunity.stage_id, template_name: templateNode.data?.templateName })
      .select('id')
      .maybeSingle();
    if (insertError?.code === '23505') continue;
    if (insertError || !execution) throw insertError || new Error('Falha ao registrar execução da automação.');

    try {
      const metaMessageId = await sendTemplate(db, userId, opportunity, templateNode);
      await db.from('crm_automation_executions').update({ status: 'sent', meta_message_id: metaMessageId, finished_at: new Date().toISOString() }).eq('id', execution.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao enviar template.';
      await db.from('crm_automation_executions').update({ status: 'failed', error_message: message.slice(0, 1000), finished_at: new Date().toISOString() }).eq('id', execution.id);
      console.error('[crm-automation] template send failed', message);
    }
  }
}
