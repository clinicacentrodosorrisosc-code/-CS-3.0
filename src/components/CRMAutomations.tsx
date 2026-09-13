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
type MetaTemplate = { id: string; name: string; status: string; language: string; category: string };

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadBaseData = useCallback(async () => {
    const [flowsResult, pipelinesResult, stagesResult] = await Promise.all([
      supabase.from('crm_automation_flows').select('id,name,description,is_active,nodes,edges,updated_at').order('updated_at', { ascending: false }),
      supabase.from('clinic_experts_pipelines').select('id,name').order('name'),
      supabase.from('clinic_experts_stages').select('id,pipeline_id,name').order('position'),
    ]);
    const firstError = flowsResult.error || pipelinesResult.error || stagesResult.error;
    if (firstError) throw firstError;
    setFlows((flowsResult.data || []) as FlowRecord[]);
    setPipelines((pipelinesResult.data || []) as Pipeline[]);
    setStages((stagesResult.data || []) as Stage[]);
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

  const selectedNode = nodes.find(node => node.id === selectedNodeId) || null;
  const selectedPipelineId = selectedNode?.data.pipelineId || '';
  const visibleStages = stages.filter(stage => stage.pipeline_id === selectedPipelineId);

  const updateNode = (patch: Partial<FlowNodeData>) => {
    if (!selectedNodeId) return;
    setNodes(current => current.map(node => node.id === selectedNodeId ? { ...node, data: { ...node.data, ...patch } } : node));
  };

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
    return null;
  }, [name, nodes]);

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
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Falha ao salvar o fluxo.' });
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
            {selectedNode.data.kind === 'trigger' && <><label className="block text-xs font-semibold">Funil<select value={selectedNode.data.pipelineId || ''} onChange={event => updateNode({ pipelineId: event.target.value, stageId: '' })} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3"><option value="">Selecione</option>{pipelines.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="block text-xs font-semibold">Etapa<select value={selectedNode.data.stageId || ''} onChange={event => updateNode({ stageId: event.target.value })} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3"><option value="">Selecione</option>{visibleStages.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></>}
            {selectedNode.data.kind === 'wait' && <div className="grid grid-cols-[1fr_120px] gap-2"><label className="text-xs font-semibold">Tempo<input type="number" min="1" value={selectedNode.data.delayValue || 1} onChange={event => updateNode({ delayValue: Number(event.target.value) })} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3" /></label><label className="text-xs font-semibold">Unidade<select value={selectedNode.data.delayUnit || 'hours'} onChange={event => updateNode({ delayUnit: event.target.value as FlowNodeData['delayUnit'] })} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-2"><option value="minutes">Minutos</option><option value="hours">Horas</option><option value="days">Dias</option></select></label></div>}
            {selectedNode.data.kind === 'schedule' && <><div className="grid grid-cols-2 gap-2"><label className="text-xs font-semibold">Início<input type="time" value={selectedNode.data.startTime || '08:00'} onChange={event => updateNode({ startTime: event.target.value })} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-2" /></label><label className="text-xs font-semibold">Fim<input type="time" value={selectedNode.data.endTime || '18:00'} onChange={event => updateNode({ endTime: event.target.value })} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-2" /></label></div><div><p className="text-xs font-semibold">Dias permitidos</p><div className="mt-2 flex flex-wrap gap-1">{weekdays.map((day, index) => { const active = (selectedNode.data.weekdays || []).includes(index); return <button key={day} type="button" onClick={() => updateNode({ weekdays: active ? (selectedNode.data.weekdays || []).filter(value => value !== index) : [...(selectedNode.data.weekdays || []), index] })} className={`rounded-lg border px-2 py-1 text-[10px] font-bold ${active ? 'border-[var(--primary)] bg-[var(--primary-dim)] text-[var(--primary)]' : 'border-[var(--border)] text-[var(--text-muted)]'}`}>{day}</button>; })}</div></div></>}
            {selectedNode.data.kind === 'template' && <><label className="block text-xs font-semibold">Template aprovado<select value={selectedNode.data.templateId || ''} onChange={event => { const template = templates.find(item => item.id === event.target.value); updateNode({ templateId: template?.id || '', templateName: template?.name || '', language: template?.language || '' }); }} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3"><option value="">Selecione</option>{templates.map(item => <option key={item.id} value={item.id}>{item.name} · {item.language}</option>)}</select></label><label className="block text-xs font-semibold">Variáveis<textarea value={selectedNode.data.variables || ''} onChange={event => updateNode({ variables: event.target.value })} placeholder={'{{1}} = patient_name\n{{2}} = seller_name'} rows={5} className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] p-3 font-mono text-[11px] outline-none" /></label><p className="text-[10px] leading-4 text-[var(--text-muted)]">Disponíveis: patient_name, patient_phone, seller_name, opportunity_title, amount.</p></>}
            <button type="button" onClick={deleteSelectedNode} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-rose-200 text-xs font-bold text-rose-600 transition hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /> Excluir etapa</button>
          </div>}
        </aside>
      </div>
    </div>
  );
};
