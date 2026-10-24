import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, Database, ExternalLink, FileSpreadsheet, Loader2, RefreshCw, Search, ShieldCheck, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { CRMPhoneImport } from './CRMPhoneImport';
import './crm-integrations.css';
import './crm-integrations-stage-visibility.css';

type Pipeline = { id: string; external_id: string; name: string; synced_at: string };
type Stage = { id: string; pipeline_id: string; external_id: string; name: string; stage_type: string | null; position: number };
type Opportunity = {
  id: string; external_id: string; pipeline_id: string; stage_id: string; title: string; patient_name: string | null;
  patient_phone: string | null; patient_email: string | null; seller_name: string | null; priority: number;
  amount_cents: number; origin: string | null; observations: string | null; status: string | null; synced_at: string; source_payload: unknown;
};
type SyncRun = { status: string; pipelines_count: number; stages_count: number; opportunities_count: number; started_at: string; finished_at: string | null; error_message: string | null };

const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((Number(cents) || 0) / 100);
const dateTime = (value?: string | null) => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : 'Ainda não sincronizado';
const objectEntries = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value) ? Object.entries(value as Record<string, unknown>) : [];
const displayValue = (value: unknown) => value === null || value === undefined || value === '' ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value);

async function loadAllOpportunities() {
  const rows: Opportunity[] = [];
  const pageSize = 1000;
  for (let page = 0; ; page += 1) {
    const { data, error } = await supabase
      .from('clinic_experts_opportunities')
      .select('id,external_id,pipeline_id,stage_id,title,patient_name,patient_phone,patient_email,seller_name,priority,amount_cents,origin,observations,status,synced_at,source_payload')
      .order('synced_at', { ascending: false })
      .range(page * pageSize, ((page + 1) * pageSize) - 1);
    if (error) return { data: rows, error };
    const batch = (data || []) as Opportunity[];
    rows.push(...batch);
    if (batch.length < pageSize) return { data: rows, error: null };
  }
}

export const CRMIntegrations: React.FC = () => {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [lastSync, setLastSync] = useState<SyncRun | null>(null);
  const [configured, setConfigured] = useState(false);
  const [selectedPipelineId, setSelectedPipelineId] = useState('');
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [phoneImportOpen, setPhoneImportOpen] = useState(false);

  const loadMirror = useCallback(async () => {
    setLoading(true); setError(null);
    const { data: { session } } = await supabase.auth.getSession();
    const authorization = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
    const [pipelineResult, stageResult, opportunityResult, statusResult] = await Promise.all([
      supabase.from('clinic_experts_pipelines').select('id,external_id,name,synced_at').order('name'),
      supabase.from('clinic_experts_stages').select('id,pipeline_id,external_id,name,stage_type,position').order('position'),
      loadAllOpportunities(),
      fetch('/api/integrations/clinica-experts/status', { headers: authorization }).then(async response => ({ ok: response.ok, body: await response.json().catch(() => ({})) })).catch(() => ({ ok: false, body: {} })),
    ]);
    const dbError = pipelineResult.error || stageResult.error || opportunityResult.error;
    if (dbError) setError(`Não foi possível carregar o espelho da integração: ${dbError.message}`);
    setPipelines((pipelineResult.data || []) as Pipeline[]);
    setStages((stageResult.data || []) as Stage[]);
    setOpportunities((opportunityResult.data || []) as Opportunity[]);
    if (statusResult.ok) {
      setConfigured(Boolean(statusResult.body?.configured));
      setLastSync(statusResult.body?.lastSync || null);
    } else if (!session) setError('Faça login novamente para consultar a integração do CRM.');
    setLoading(false);
  }, []);

  useEffect(() => { void loadMirror(); }, [loadMirror]);
  useEffect(() => { if (!selectedPipelineId && pipelines[0]) setSelectedPipelineId(pipelines[0].id); }, [pipelines, selectedPipelineId]);

  const selectedPipeline = pipelines.find(item => item.id === selectedPipelineId) || null;
  const pipelineStages = useMemo(() => stages.filter(item => item.pipeline_id === selectedPipelineId).sort((a, b) => a.position - b.position), [stages, selectedPipelineId]);
  const filteredOpportunities = useMemo(() => opportunities.filter(item => {
    if (item.pipeline_id !== selectedPipelineId) return false;
    const searchable = `${item.title} ${item.patient_name || ''} ${item.patient_phone || ''} ${item.patient_email || ''} ${item.seller_name || ''}`.toLocaleLowerCase('pt-BR');
    return searchable.includes(query.toLocaleLowerCase('pt-BR'));
  }), [opportunities, selectedPipelineId, query]);

  const syncNow = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) { setError('Faça login novamente para sincronizar.'); return; }
    setSyncing(true); setError(null);
    try {
      const response = await fetch('/api/integrations/clinica-experts/sync', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'A sincronização não foi concluída.');
      await loadMirror();
    } catch (syncError) { setError(syncError instanceof Error ? syncError.message : 'Falha ao sincronizar Clínica Experts.'); }
    finally { setSyncing(false); }
  };

  return <div className="crm-integrations" aria-label="Configurações do CRM e integrações">
    <header className="crm-integrations-head">
      <div><p>CRM / Configurações</p><h1>Integrações</h1><span>Conexões que alimentam o CRM com dados operacionais.</span></div>
      <div className="crm-integration-actions">
        <button className="crm-integration-import" onClick={() => setPhoneImportOpen(true)} disabled={loading || !opportunities.length}>
          <FileSpreadsheet /> Importar telefones de leads
        </button>
        <button className="crm-integration-sync" onClick={() => void syncNow()} disabled={syncing}>
          {syncing ? <Loader2 className="spin" /> : <RefreshCw />} {syncing ? 'Sincronizando...' : 'Atualizar dados'}
        </button>
      </div>
    </header>

    <nav className="crm-integration-tabs" aria-label="Seções de configurações"><button className="active">Integrações</button><button disabled>Campos e dados</button></nav>
    {error && <div className="crm-integration-error">{error}</div>}

    <section className="crm-connection-card">
      <div className="crm-connection-icon"><Database size={20} /></div>
      <div className="crm-connection-copy"><div><h2>Clínica Experts</h2><span className={configured ? 'connected' : ''}>{configured ? <><CheckCircle2 size={14} /> Conectada</> : 'Aguardando configuração'}</span></div><p>Espelho somente leitura de funis, etapas, oportunidades e dados de contato. Nenhum dado é alterado no sistema de origem.</p></div>
      <div className="crm-connection-metrics"><span>Última sincronização</span><b>{dateTime(lastSync?.finished_at || lastSync?.started_at)}</b><small>{lastSync?.status === 'success' ? `${lastSync.opportunities_count} oportunidades importadas` : lastSync?.error_message || 'Sem execução registrada'}</small></div>
      <ShieldCheck className="crm-connection-shield" aria-label="Integração somente leitura" />
    </section>

    <section className="crm-mirror">
      <div className="crm-mirror-head"><div><p>Dados sincronizados</p><h2>Funis e leads da Clínica Experts</h2><span>{opportunities.length} oportunidades disponíveis no espelho</span></div><label className="crm-pipeline-select">Funil<select value={selectedPipelineId} onChange={event => setSelectedPipelineId(event.target.value)}>{pipelines.length === 0 && <option value="">Nenhum funil sincronizado</option>}{pipelines.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><ChevronDown size={15} /></label></div>
      <div className="crm-mirror-actions"><label><Search size={15}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar lead, telefone ou responsável" /></label><span>{selectedPipeline ? `Atualizado em ${dateTime(selectedPipeline.synced_at)}` : 'Use “Atualizar dados” para criar o espelho'}</span></div>
      {loading ? <div className="crm-mirror-empty"><Loader2 className="spin" /> Carregando dados sincronizados…</div> : pipelineStages.length === 0 ? <div className="crm-mirror-empty">Ainda não há etapas sincronizadas. Use <strong>Atualizar dados</strong> para importar os funis da Clínica Experts.</div> : <div className="crm-mirror-board">{pipelineStages.map(stage => { const cards = filteredOpportunities.filter(item => item.stage_id === stage.id); return <article className="crm-mirror-stage" key={stage.id}><header><h3>{stage.name}</h3><span>{money(cards.reduce((total, item) => total + item.amount_cents, 0))} · {cards.length} lead{cards.length === 1 ? '' : 's'}</span></header><div>{cards.map(item => <button className="crm-mirror-card" key={item.id} onClick={() => setSelectedOpportunity(item)}><b>{item.title}</b><span>{item.patient_name || 'Sem contato informado'}</span><small>{item.patient_phone || item.patient_email || 'Sem telefone ou e-mail'}</small><footer><em>{money(item.amount_cents)}</em>{item.seller_name && <i>{item.seller_name}</i>}</footer></button>)}{cards.length === 0 && <p className="crm-stage-empty">Nenhum lead nesta etapa</p>}</div></article>; })}</div>}
    </section>

    {selectedOpportunity && <div className="crm-integration-modal-backdrop" role="presentation" onMouseDown={() => setSelectedOpportunity(null)}><section className="crm-integration-modal" role="dialog" aria-modal="true" aria-label="Dados importados do lead" onMouseDown={event => event.stopPropagation()}><header><div><p>Clínica Experts · dados importados</p><h2>{selectedOpportunity.title}</h2></div><button onClick={() => setSelectedOpportunity(null)} aria-label="Fechar"><X size={18}/></button></header><div className="crm-lead-data"><dl>{[['Contato', selectedOpportunity.patient_name], ['Telefone', selectedOpportunity.patient_phone], ['E-mail', selectedOpportunity.patient_email], ['Responsável', selectedOpportunity.seller_name], ['Valor', money(selectedOpportunity.amount_cents)], ['Origem', selectedOpportunity.origin], ['Status', selectedOpportunity.status], ['Prioridade', selectedOpportunity.priority], ['Observações', selectedOpportunity.observations], ['Sincronizado em', dateTime(selectedOpportunity.synced_at)]].map(([label, value]) => <React.Fragment key={String(label)}><dt>{label}</dt><dd>{displayValue(value)}</dd></React.Fragment>)}</dl><details><summary>Dados completos recebidos da Clínica Experts <ExternalLink size={14}/></summary><pre>{JSON.stringify(selectedOpportunity.source_payload, null, 2)}</pre></details></div></section></div>}
    {phoneImportOpen && <CRMPhoneImport opportunities={opportunities} onClose={() => setPhoneImportOpen(false)} onImported={() => { void loadMirror(); }} />}
  </div>;
};
