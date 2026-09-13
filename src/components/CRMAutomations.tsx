import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addEdge,
  Background,
  Connection,
  Controls,
  Edge,
  MiniMap,
  Node,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Clock3, GitBranch, Loader2, MessageSquareText, Play, Plus, Save, Timer, Trash2, Workflow } from 'lucide-react';
import { supabase } from '../supabaseClient';

type NodeKind = 'trigger' | 'wait' | 'schedule' | 'template';
type FlowNodeData = {
  kind: NodeKind;
  label: string;
  pipelineId?: string;
  stageId?: string;
  delayValue?: number;
  delayUnit?: 'minutes' | 'hours' | 'days';
  startTime?: string;
  endTime?: string;
  weekdays?: number[];
  templateId?: string;
  templateName?: string;
  language?: string;
  variables?: string;
};
type FlowRecord = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  updated_at: string;
};
type Pipeline = { id: string; name: string };
type Stage = { id: string; pipeline_id: string; name: string };
type MetaTemplateComponent = { type: string; text?: string };
type MetaTemplate = { id: string; name: string; status: string; language: string; category: string; components?: MetaTemplateComponent[] };
type Opportunity = { id: string; stage_id: string; patient_name: string | null; patient_phone: string | null; seller_name: string | null; title: string; amount_cents: number };
type AutomationExecution = {
  id: string;
  flow_id: string;
  status: 'processing' | 'sent' | 'failed' | 'skipped';
  template_name: string | null;
  error_message: string | null;
  created_at: string;
};

const variableOptions = [
  { value: 'patient_name', label: 'Nome do paciente' },
  { value: 'patient_phone', label: 'Telefone do paciente' },
  { value: 'seller_name', label: 'Responsável comercial' },
  { value: 'opportunity_title', label: 'Nome da oportunidade' },
  { value: 'amount', label: 'Valor da oportunidade' },
];

const initialNodes: Node<FlowNodeData>[] = [
  { id: 'trigger-1', type: 'input', position: { x: 80, y: 160 }, data: { kind: 'trigger', label: 'Entrou em uma etapa' } },
  { id: 'template-1', position: { x: 390, y: 160 }, data: { kind: 'template', label: 'Enviar template Meta' } },
];
const initialEdges: Edge[] = [{ id: 'trigger-1-template-1', source: 'trigger-1', target: 'template-1', animated: true }];

const nodeCatalog: Array<{ kind: NodeKind; label: string; detail: string; icon: React.ElementType }> = [
  { kind: 'trigger', label: 'Gatilho de etapa', detail: 'Inicia ao entrar no funil e etapa', icon: GitBranch },
  { kind: 'wait', label: 'Aguardar', detail: 'Espera minutos, horas ou dias', icon: Timer },
  { kind: 'schedule', label: 'Horário permitido', detail: 'Define dias e janela de envio', icon: Clock3 },
  { kind: 'template', label: 'Template Meta', detail: 'Envia modelo aprovado com variáveis', icon: MessageSquareText },
];
const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

async function sessionHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sessão expirada.');
  return { Authorization: `Bearer ${session.access_token}` };
}

function readableError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  return fallback;
}

export const CRMAutomations: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);
  const [flows, setFlows] = useState<FlowRecord[]>([]);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('trigger-1');
  const [name, setName] = useState('Novo fluxo comercial');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [templates, setTemplates] = useState<MetaTemplate[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [executions, setExecutions] = useState<AutomationExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadBaseData = useCallback(async () => {
    const [flowsResult, pipelinesResult, stagesResult, opportunitiesResult, executionsResult] = await Promise.all([
      supabase.from('crm_automation_flows').select('id,name,description,is_active,nodes,edges,updated_at').order('updated_at', { ascending: false }),
      supabase.from('clinic_experts_pipelines').select('id,name').order('name'),
      supabase.from('clinic_experts_stages').select('id,pipeline_id,name').order('position'),
      supabase.from('clinic_experts_opportunities').select('id,stage_id,patient_name,patient_phone,seller_name,title,amount_cents').order('synced_at', { ascending: false }),
      supabase.from('crm_automation_executions').select('id,flow_id,status,template_name,error_message,created_at').order('created_at', { ascending: false }).limit(20),
    ]);
    const firstError = flowsResult.error || pipelinesResult.error || stagesResult.error || opportunitiesResult.error || executionsResult.error;
    if (firstError) throw firstError;
    setFlows((flowsResult.data || []) as FlowRecord[]);
    setPipelines((pipelinesResult.data || []) as Pipeline[]);
    setStages((stagesResult.data || []) as Stage[]);
    setOpportunities((opportunitiesResult.data || []) as Opportunity[]);
    setExecutions((executionsResult.data || []) as AutomationExecution[]);
  }, []);

  const refreshTemplates = useCallback(async () => {
    const headers = await sessionHeaders();
    const response = await fetch('/api/integrations/whatsapp/templates', { headers });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Não foi possível consultar os templates da Meta.');
    setTemplates((body.templates || []).filter((template: MetaTemplate) => template.status === 'APPROVED'));
  }, []);

  const ensureSdrFlow = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Sessão expirada.');
    const { data: existing, error: existingError } = await supabase
      .from('crm_automation_flows')
      .select('id')
      .eq('user_id', user.id)
      .eq('name', 'Fluxo SDR')
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return;

    const { data: pipeline, error: pipelineError } = await supabase
      .from('clinic_experts_pipelines')
      .select('id,name')
      .eq('user_id', user.id)
      .ilike('name', '%comercial%')
      .limit(1)
      .maybeSingle();
    if (pipelineError) throw pipelineError;
    if (!pipeline) throw new Error('Funil Comercial não encontrado na sincronização da Clínica Experts.');

    const { data: stage, error: stageError } = await supabase
      .from('clinic_experts_stages')
      .select('id,name')
      .eq('user_id', user.id)
      .eq('pipeline_id', pipeline.id)
      .ilike('name', '%qualifica%')
      .limit(1)
      .maybeSingle();
    if (stageError) throw stageError;
    if (!stage) throw new Error('Etapa Qualificação não encontrada no funil Comercial.');

    const presetNodes: Node<FlowNodeData>[] = [
      { id: 'fluxo-sdr-trigger', type: 'input', position: { x: 100, y: 180 }, data: { kind: 'trigger', label: 'Entrou em Qualificação', pipelineId: pipeline.id, stageId: stage.id } },
      { id: 'fluxo-sdr-template', position: { x: 420, y: 180 }, data: { kind: 'template', label: 'Enviar lembrete_2h', templateName: 'lembrete_2h', language: 'pt_BR', variables: '' } },
    ];
    const presetEdges: Edge[] = [{ id: 'fluxo-sdr-trigger-template', source: 'fluxo-sdr-trigger', target: 'fluxo-sdr-template', animated: true }];
    const { error: insertError } = await supabase.from('crm_automation_flows').insert({
      user_id: user.id,
      name: 'Fluxo SDR',
      description: 'Envia o template lembrete_2h quando um card entra em Comercial → Qualificação.',
      is_active: true,
      nodes: presetNodes,
      edges: presetEdges,
    });
    if (insertError && insertError.code !== '23505') throw insertError;
  }, []);

  useEffect(() => {
    Promise.all([ensureSdrFlow(), refreshTemplates()])
      .then(() => loadBaseData())
      .catch(error => setMessage({ type: 'error', text: error?.message || 'Falha ao carregar o construtor.' }))
      .finally(() => setLoading(false));
  }, [ensureSdrFlow, loadBaseData, refreshTemplates]);

  useEffect(() => {
    const channel = supabase
      .channel('crm-automation-executions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_automation_executions' }, () => void loadBaseData())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadBaseData]);

  const selectedNode = nodes.find(node => node.id === selectedNodeId) || null;
  const selectedPipelineId = selectedNode?.data.pipelineId || '';
  const visibleStages = stages.filter(stage => stage.pipeline_id === selectedPipelineId);
  const triggerNode = nodes.find(node => node.data.kind === 'trigger');
  const sampleCard = opportunities.find(opportunity => opportunity.stage_id === triggerNode?.data.stageId) || null;
  const selectedTemplate = selectedNode?.data.kind === 'template'
    ? templates.find(template => template.id === selectedNode.data.templateId)
      || templates.find(template => template.name === selectedNode.data.templateName && template.language === selectedNode.data.language)
    : null;
  const templateBody = selectedTemplate?.components?.find(component => component.type === 'BODY')?.text || '';
  const placeholderNumbers = Array.from(new Set(Array.from(templateBody.matchAll(/\{\{(\d+)\}\}/g), match => Number(match[1])))).sort((a, b) => a - b);
  const variableMappings = Object.fromEntries(String(selectedNode?.data.variables || '').split(/\r?\n/).map(line => line.match(/^\s*\{\{(\d+)\}\}\s*=\s*([a-z_]+)\s*$/i)).filter((match): match is RegExpMatchArray => Boolean(match)).map(match => [Number(match[1]), match[2]])) as Record<number, string>;

  const sampleValue = (key: string) => {
    if (!sampleCard) return `[${variableOptions.find(option => option.value === key)?.label || key}]`;
    const values: Record<string, string> = {
      patient_name: sampleCard.patient_name || 'Paciente sem nome',
      patient_phone: sampleCard.patient_phone || 'Telefone não informado',
      seller_name: sampleCard.seller_name || 'Responsável não informado',
      opportunity_title: sampleCard.title || 'Oportunidade',
      amount: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((sampleCard.amount_cents || 0) / 100),
    };
    return values[key] || `[${key}]`;
  };

  const previewMessage = templateBody.replace(/\{\{(\d+)\}\}/g, (_, rawIndex: string) => {
    const index = Number(rawIndex);
    return variableMappings[index] ? sampleValue(variableMappings[index]) : `{{${index}}}`;
  });

  const setVariableMapping = (index: number, value: string) => {
    const next = { ...variableMappings };
    if (value) next[index] = value;
    else delete next[index];
    updateNode({ variables: Object.entries(next).sort(([a], [b]) => Number(a) - Number(b)).map(([position, key]) => `{{${position}}} = ${key}`).join('\n') });
  };

  function updateNode(patch: Partial<FlowNodeData>) {
    if (!selectedNodeId) return;
    setNodes(current => current.map(node => node.id === selectedNodeId ? { ...node, data: { ...node.data, ...patch } } : node));
  }

  const deleteSelectedNode = () => {
    if (!selectedNodeId || !selectedNode) return;
    if (!window.confirm(`Excluir a etapa "${selectedNode.data.label}" deste fluxo?`)) return;
    setNodes(current => current.filter(node => node.id !== selectedNodeId));
    setEdges(current => current.filter(edge => edge.source !== selectedNodeId && edge.target !== selectedNodeId));
    setSelectedNodeId(null);
    setMessage({ type: 'success', text: 'Etapa removida. Salve o fluxo para confirmar a alteração.' });
  };

  const addNode = (kind: NodeKind) => {
    const catalog = nodeCatalog.find(item => item.kind === kind)!;
    const id = `${kind}-${Date.now()}`;
    const node: Node<FlowNodeData> = {
      id,
      position: { x: 220 + nodes.length * 70, y: 90 + (nodes.length % 3) * 150 },
      data: {
        kind,
        label: catalog.label,
        delayValue: kind === 'wait' ? 1 : undefined,
        delayUnit: kind === 'wait' ? 'hours' : undefined,
        startTime: kind === 'schedule' ? '08:00' : undefined,
        endTime: kind === 'schedule' ? '18:00' : undefined,
        weekdays: kind === 'schedule' ? [1, 2, 3, 4, 5] : undefined,
      },
    };
    setNodes(current => [...current, node]);
    setSelectedNodeId(id);
  };

  const newFlow = () => {
    if (!window.confirm('Criar um novo fluxo? Alterações ainda não salvas no fluxo atual serão descartadas.')) return;
    setSelectedFlowId(null);
    setName('Novo fluxo comercial');
    setDescription('');
    setIsActive(false);
    setNodes(initialNodes);
    setEdges(initialEdges);
    setSelectedNodeId('trigger-1');
    setMessage(null);
  };

  const openFlow = (flow: FlowRecord) => {
    setSelectedFlowId(flow.id);
    setName(flow.name);
    setDescription(flow.description || '');
    setIsActive(flow.is_active);
    setNodes(Array.isArray(flow.nodes) ? flow.nodes : initialNodes);
    setEdges(Array.isArray(flow.edges) ? flow.edges : []);
    setSelectedNodeId(null);
  };

  const validation = useMemo(() => {
    const trigger = nodes.find(node => node.data.kind === 'trigger');
    const template = nodes.find(node => node.data.kind === 'template');
    if (!name.trim()) return 'Informe o nome do fluxo.';
    if (!trigger?.data.pipelineId || !trigger.data.stageId) return 'Configure o funil e a etapa do gatilho.';
    if (!template?.data.templateName || !template.data.language) return 'Escolha um template aprovado da Meta.';
    const metaTemplate = templates.find(item => item.name === template.data.templateName && item.language === template.data.language);
    const body = metaTemplate?.components?.find(component => component.type === 'BODY')?.text || '';
    const requiredPositions = Array.from(new Set(Array.from(body.matchAll(/\{\{(\d+)\}\}/g), match => Number(match[1]))));
    const configuredPositions = new Set(String(template.data.variables || '').split(/\r?\n/).map(line => Number(line.match(/\{\{(\d+)\}\}/)?.[1])).filter(Number.isFinite));
    if (requiredPositions.some(position => !configuredPositions.has(position))) return 'Mapeie todas as variáveis obrigatórias do template.';
    return null;
  }, [name, nodes, templates]);

  const saveFlow = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sessão expirada.');
      if (isActive && validation) throw new Error(validation);
      const payload = { user_id: user.id, name: name.trim(), description: description.trim() || null, is_active: isActive, nodes, edges, updated_at: new Date().toISOString() };
      const query = selectedFlowId
        ? supabase.from('crm_automation_flows').update(payload).eq('id', selectedFlowId).select().single()
        : supabase.from('crm_automation_flows').insert(payload).select().single();
      const { data, error } = await query;
      if (error) throw error;
      setSelectedFlowId(data.id);
      await loadBaseData();
      setMessage({ type: 'success', text: isActive ? 'Fluxo salvo e marcado como ativo.' : 'Rascunho salvo com sucesso.' });
    } catch (error) {
      setMessage({ type: 'error', text: readableError(error, 'Falha ao salvar o fluxo.') });
    } finally {
      setSaving(false);
    }
  };

  const onConnect = useCallback((connection: Connection) => setEdges(current => addEdge({ ...connection, animated: true }, current)), [setEdges]);

  if (loading) return <div className="flex h-full items-center justify-center gap-2 text-sm text-[var(--text-muted)]"><Loader2 className="h-4 w-4 animate-spin" /> Carregando automações</div>;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--bg)] text-[var(--text)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 lg:px-6">
        <div className="min-w-0"><div className="flex items-center gap-2"><Workflow className="h-5 w-5 text-[var(--primary)]" /><h1 className="text-base font-bold">Automações do CRM</h1></div><p className="mt-0.5 text-xs text-[var(--text-muted)]">Monte jornadas por etapa, tempo, horário e templates oficiais.</p></div>
        <div className="flex items-center gap-2"><label className="flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-semibold"><input type="checkbox" checked={isActive} onChange={event => setIsActive(event.target.checked)} className="accent-[var(--primary)]" /> Ativo</label><button type="button" onClick={saveFlow} disabled={saving} className="flex h-10 items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-xs font-bold text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar fluxo</button></div>
      </header>

      {message && <div className={`mx-4 mt-3 rounded-xl border px-4 py-2.5 text-xs lg:mx-6 ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>{message.text}</div>}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[230px_minmax(0,1fr)_290px]">
        <aside className="custom-scrollbar overflow-y-auto border-r border-[var(--border)] bg-[var(--surface)] p-3">
          <button type="button" onClick={newFlow} className="mb-3 flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] text-xs font-bold hover:bg-[var(--surface-hover)]"><Plus className="h-4 w-4" /> Novo fluxo</button>
          <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Meus fluxos</p>
          <div className="mt-2 space-y-1">{flows.length === 0 ? <p className="px-2 py-3 text-xs text-[var(--text-muted)]">Nenhum fluxo salvo.</p> : flows.map(flow => <button key={flow.id} type="button" onClick={() => openFlow(flow)} className={`w-full rounded-xl border px-3 py-2 text-left ${selectedFlowId === flow.id ? 'border-[var(--primary-border)] bg-[var(--primary-dim)]' : 'border-transparent hover:bg-[var(--surface-hover)]'}`}><span className="block truncate text-xs font-semibold">{flow.name}</span><span className="mt-1 flex items-center gap-1 text-[10px] text-[var(--text-muted)]"><span className={`h-1.5 w-1.5 rounded-full ${flow.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />{flow.is_active ? 'Ativo' : 'Rascunho'}</span></button>)}</div>
          <div className="my-4 border-t border-[var(--border)]" />
          <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Últimas execuções</p>
          <div className="mt-2 space-y-1.5">{executions.length === 0 ? <p className="px-2 py-2 text-[10px] text-[var(--text-muted)]">Nenhum disparo registrado.</p> : executions.slice(0, 8).map(execution => { const flowName = flows.find(flow => flow.id === execution.flow_id)?.name || 'Fluxo'; const statusLabel = execution.status === 'sent' ? 'Enviado' : execution.status === 'failed' ? 'Falhou' : execution.status === 'processing' ? 'Processando' : 'Ignorado'; return <div key={execution.id} className="rounded-xl border border-[var(--border)] px-2.5 py-2"><div className="flex items-center justify-between gap-2"><span className="truncate text-[10px] font-semibold">{flowName}</span><span className={`text-[9px] font-bold ${execution.status === 'sent' ? 'text-emerald-600' : execution.status === 'failed' ? 'text-rose-600' : 'text-amber-600'}`}>{statusLabel}</span></div><p className="mt-1 truncate text-[9px] text-[var(--text-muted)]">{execution.template_name || 'Template'} · {new Date(execution.created_at).toLocaleString('pt-BR')}</p>{execution.error_message && <p title={execution.error_message} className="mt-1 line-clamp-2 text-[9px] leading-3 text-rose-600">{execution.error_message}</p>}</div>; })}</div>
          <div className="my-4 border-t border-[var(--border)]" />
          <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Adicionar etapa</p>
          <div className="mt-2 space-y-2">{nodeCatalog.map(({ kind, label, detail, icon: Icon }) => <button key={kind} type="button" onClick={() => addNode(kind)} className="flex w-full items-start gap-2 rounded-xl border border-[var(--border)] p-2.5 text-left hover:border-[var(--primary-border)] hover:bg-[var(--primary-dim)]"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" /><span><strong className="block text-xs">{label}</strong><small className="mt-0.5 block text-[10px] leading-4 text-[var(--text-muted)]">{detail}</small></span></button>)}</div>
        </aside>

        <main className="relative min-h-[500px] bg-[var(--bg-subtle)]">
          <div className="absolute left-4 top-4 z-10 flex max-w-[calc(100%-2rem)] gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-sm"><input value={name} onChange={event => setName(event.target.value)} className="min-w-0 flex-1 bg-transparent px-2 text-sm font-bold outline-none" /><input value={description} onChange={event => setDescription(event.target.value)} placeholder="Descrição do fluxo" className="hidden min-w-0 flex-1 border-l border-[var(--border)] bg-transparent px-3 text-xs outline-none md:block" /></div>
          <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeClick={(_, node) => setSelectedNodeId(node.id)} fitView colorMode="light">
            <Background gap={20} size={1} color="#cfd5df" />
            <Controls />
            <MiniMap pannable zoomable nodeColor="#2563eb" />
          </ReactFlow>
        </main>

        <aside className="custom-scrollbar overflow-y-auto border-l border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Configuração da etapa</p>
          {!selectedNode ? <div className="mt-10 text-center"><Play className="mx-auto h-7 w-7 text-[var(--text-muted)]" /><p className="mt-2 text-xs text-[var(--text-muted)]">Selecione um bloco no quadro.</p></div> : <div className="mt-4 space-y-4">
            <label className="block text-xs font-semibold">Nome do bloco<input value={selectedNode.data.label} onChange={event => updateNode({ label: event.target.value })} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 outline-none" /></label>
            {selectedNode.data.kind === 'trigger' && <><label className="block text-xs font-semibold">Funil<select value={selectedNode.data.pipelineId || ''} onChange={event => updateNode({ pipelineId: event.target.value, stageId: '' })} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3"><option value="">Selecione</option>{pipelines.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="block text-xs font-semibold">Etapa<select value={selectedNode.data.stageId || ''} onChange={event => { const stage = stages.find(item => item.id === event.target.value); updateNode({ stageId: event.target.value, label: stage ? `Entrou em ${stage.name}` : 'Entrou em uma etapa' }); }} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3"><option value="">Selecione</option>{visibleStages.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></>}
            {selectedNode.data.kind === 'wait' && <div className="grid grid-cols-[1fr_120px] gap-2"><label className="text-xs font-semibold">Tempo<input type="number" min="1" value={selectedNode.data.delayValue || 1} onChange={event => updateNode({ delayValue: Number(event.target.value) })} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3" /></label><label className="text-xs font-semibold">Unidade<select value={selectedNode.data.delayUnit || 'hours'} onChange={event => updateNode({ delayUnit: event.target.value as FlowNodeData['delayUnit'] })} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-2"><option value="minutes">Minutos</option><option value="hours">Horas</option><option value="days">Dias</option></select></label></div>}
            {selectedNode.data.kind === 'schedule' && <><div className="grid grid-cols-2 gap-2"><label className="text-xs font-semibold">Início<input type="time" value={selectedNode.data.startTime || '08:00'} onChange={event => updateNode({ startTime: event.target.value })} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-2" /></label><label className="text-xs font-semibold">Fim<input type="time" value={selectedNode.data.endTime || '18:00'} onChange={event => updateNode({ endTime: event.target.value })} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-2" /></label></div><div><p className="text-xs font-semibold">Dias permitidos</p><div className="mt-2 flex flex-wrap gap-1">{weekdays.map((day, index) => { const active = (selectedNode.data.weekdays || []).includes(index); return <button key={day} type="button" onClick={() => updateNode({ weekdays: active ? (selectedNode.data.weekdays || []).filter(value => value !== index) : [...(selectedNode.data.weekdays || []), index] })} className={`rounded-lg border px-2 py-1 text-[10px] font-bold ${active ? 'border-[var(--primary)] bg-[var(--primary-dim)] text-[var(--primary)]' : 'border-[var(--border)] text-[var(--text-muted)]'}`}>{day}</button>; })}</div></div></>}
            {selectedNode.data.kind === 'template' && <>
              <label className="block text-xs font-semibold">Template aprovado<select value={selectedTemplate?.id || ''} onChange={event => { const template = templates.find(item => item.id === event.target.value); updateNode({ templateId: template?.id || '', templateName: template?.name || '', language: template?.language || '', variables: '' }); }} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3"><option value="">Selecione</option>{templates.map(item => <option key={item.id} value={item.id}>{item.name} · {item.language}</option>)}</select></label>
              {selectedTemplate && <div className="rounded-xl border border-[var(--border)] bg-[#E7F7EF] p-3 dark:bg-emerald-500/10"><p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Mensagem do template</p><p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[var(--text)]">{previewMessage || 'Este template não possui texto no corpo.'}</p>{sampleCard && <p className="mt-2 border-t border-emerald-600/15 pt-2 text-[10px] text-[var(--text-muted)]">Prévia usando o card de {sampleCard.patient_name || sampleCard.title}.</p>}</div>}
              {placeholderNumbers.length > 0 && <div><p className="text-xs font-semibold">Variáveis da mensagem</p><div className="mt-2 space-y-2">{placeholderNumbers.map(index => <label key={index} className="grid grid-cols-[44px_minmax(0,1fr)] items-center gap-2 text-xs"><span className="font-mono text-[var(--primary)]">{`{{${index}}}`}</span><select value={variableMappings[index] || ''} onChange={event => setVariableMapping(index, event.target.value)} className="h-9 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-2"><option value="">Selecione o dado do card</option>{variableOptions.map(option => <option key={option.value} value={option.value}>{option.label}{variableMappings[index] === option.value ? `: ${sampleValue(option.value)}` : ''}</option>)}</select></label>)}</div></div>}
              {selectedTemplate && placeholderNumbers.length === 0 && <p className="rounded-lg bg-[var(--bg-subtle)] px-3 py-2 text-[10px] text-[var(--text-muted)]">Este template não possui variáveis no corpo da mensagem.</p>}
            </>}
            <button type="button" onClick={deleteSelectedNode} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-rose-200 text-xs font-bold text-rose-600 transition hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /> Excluir etapa</button>
          </div>}
        </aside>
      </div>
    </div>
  );
};
