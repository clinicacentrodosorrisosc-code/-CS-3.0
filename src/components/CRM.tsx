import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  UserRoundPlus,
  UsersRound,
} from 'lucide-react';
import { supabase } from '../supabaseClient';

type Pipeline = { id: string; external_id: string; name: string };
type Stage = {
  id: string;
  pipeline_id: string;
  name: string;
  stage_type: string | null;
  position: number;
};
type Opportunity = {
  id: string;
  external_id: string;
  pipeline_id: string;
  stage_id: string;
  title: string;
  patient_name: string | null;
  patient_phone: string | null;
  seller_name: string | null;
  priority: number;
  amount_cents: number;
  origin: string | null;
  status: string | null;
  synced_at: string;
};
type SyncStatus = {
  configured: boolean;
  lastSync: {
    status: 'running' | 'success' | 'failed';
    pipelines_count: number;
    stages_count: number;
    opportunities_count: number;
    finished_at: string | null;
    error_message: string | null;
  } | null;
};

const formatCurrency = (amountCents: number) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
}).format(amountCents / 100);

const formatLastSync = (date: string | null | undefined) => {
  if (!date) return 'Ainda não sincronizado';
  return `Atualizado em ${new Date(date).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })}`;
};

export const CRM: React.FC = () => {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState('');
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState('');
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);

  const loadCRM = useCallback(async () => {
    setError('');
    const [pipelinesResult, stagesResult, opportunitiesResult] = await Promise.all([
      supabase.from('clinic_experts_pipelines').select('id, external_id, name').order('name'),
      supabase.from('clinic_experts_stages').select('id, pipeline_id, name, stage_type, position').order('position'),
      supabase
        .from('clinic_experts_opportunities')
        .select('id, external_id, pipeline_id, stage_id, title, patient_name, patient_phone, seller_name, priority, amount_cents, origin, status, synced_at')
        .order('synced_at', { ascending: false }),
    ]);

    const firstError = pipelinesResult.error || stagesResult.error || opportunitiesResult.error;
    if (firstError) throw firstError;
    setPipelines((pipelinesResult.data || []) as Pipeline[]);
    setStages((stagesResult.data || []) as Stage[]);
    setOpportunities((opportunitiesResult.data || []) as Opportunity[]);
    setSelectedPipelineId(current => current || pipelinesResult.data?.[0]?.id || '');
  }, []);

  const loadStatus = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const response = await fetch('/api/integrations/clinica-experts/status', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Não foi possível consultar a integração.');
    setSyncStatus(body);
  }, []);

  useEffect(() => {
    Promise.all([loadCRM(), loadStatus()])
      .catch(currentError => setError(currentError.message || 'Não foi possível carregar o CRM.'))
      .finally(() => setIsLoading(false));

    const channel = supabase
      .channel('clinic-experts-crm')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clinic_experts_pipelines' }, loadCRM)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clinic_experts_stages' }, loadCRM)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clinic_experts_opportunities' }, loadCRM)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadCRM, loadStatus]);

  const handleSync = async () => {
    setIsSyncing(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sua sessão expirou. Entre novamente.');
      const response = await fetch('/api/integrations/clinica-experts/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Falha ao sincronizar o CRM.');
      await Promise.all([loadCRM(), loadStatus()]);
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'Falha ao sincronizar o CRM.');
    } finally {
      setIsSyncing(false);
    }
  };

  const selectedPipeline = pipelines.find(pipeline => pipeline.id === selectedPipelineId);
  const visibleStages = stages.filter(stage => stage.pipeline_id === selectedPipelineId);
  const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
  const visibleOpportunities = opportunities.filter(opportunity => {
    if (opportunity.pipeline_id !== selectedPipelineId) return false;
    if (!normalizedQuery) return true;
    return [opportunity.title, opportunity.patient_name, opportunity.patient_phone, opportunity.seller_name]
      .some(value => value?.toLocaleLowerCase('pt-BR').includes(normalizedQuery));
  });

  const metrics = useMemo(() => {
    const active = opportunities.filter(opportunity => !['won', 'lost', 'closed'].includes(opportunity.status || ''));
    const today = new Date().toISOString().slice(0, 10);
    return [
      { label: 'Leads ativos', value: active.length, detail: `${opportunities.length} oportunidades sincronizadas`, icon: UsersRound },
      { label: 'Atualizados hoje', value: opportunities.filter(item => item.synced_at.slice(0, 10) === today).length, detail: 'Dados recebidos da Clínica Experts', icon: UserRoundPlus },
      { label: 'No funil atual', value: visibleOpportunities.length, detail: selectedPipeline?.name || 'Selecione um funil', icon: BarChart3 },
    ];
  }, [opportunities, selectedPipeline?.name, visibleOpportunities.length]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-transparent text-[var(--text)]">
      <div className="custom-scrollbar flex-1 overflow-y-auto px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
          <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--primary)] dark:text-[var(--primary-hover)]">
                <span className="h-px w-6 bg-current" />
                Clínica Experts
              </div>
              <h1 className="text-2xl font-bold tracking-[-0.03em] text-[var(--text)] sm:text-3xl">CRM da clínica</h1>
              <p className="mt-1 max-w-2xl text-sm text-[var(--text-secondary)]">
                Espelho automático dos funis e oportunidades do sistema da clínica.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                {syncStatus?.lastSync?.status === 'success' ? <CheckCircle2 className="h-4 w-4 text-[#1F6F5B]" /> : <AlertCircle className="h-4 w-4" />}
                <span>{formatLastSync(syncStatus?.lastSync?.finished_at)}</span>
              </div>
              <button
                type="button"
                onClick={handleSync}
                disabled={isSyncing || syncStatus?.configured === false}
                className="flex h-10 items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-xs font-bold text-white shadow-[0_8px_24px_rgba(37,99,235,0.18)] transition hover:bg-[var(--primary-hover)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40"
              >
                <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Sincronizando' : 'Sincronizar agora'}
              </button>
            </div>
          </header>

          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <section className="grid grid-cols-1 gap-3 md:grid-cols-3" aria-label="Indicadores do CRM">
            {metrics.map(({ label, value, detail, icon: Icon }) => (
              <article key={label} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-secondary)]">{label}</p>
                    <strong className="mt-2 block font-mono text-3xl font-semibold tracking-[-0.04em] text-[var(--text)]">{value}</strong>
                  </div>
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EAF5F0] text-[#1F6F5B] dark:bg-[#63B596]/10 dark:text-[#63B596]">
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                </div>
                <p className="mt-3 text-[11px] text-[var(--text-muted)]">{detail}</p>
              </article>
            ))}
          </section>

          <section className="flex min-h-[430px] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
            <div className="flex flex-col gap-3 border-b border-[var(--border)] px-4 py-3.5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <h2 className="text-sm font-bold text-[var(--text)]">Funil comercial</h2>
                  <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{visibleOpportunities.length} oportunidades neste funil</p>
                </div>
                {pipelines.length > 0 && (
                  <select
                    value={selectedPipelineId}
                    onChange={event => setSelectedPipelineId(event.target.value)}
                    className="h-9 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 text-xs font-semibold text-[var(--text)] outline-none focus:border-[#1F6F5B]/50"
                  >
                    {pipelines.map(pipeline => <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>)}
                  </select>
                )}
              </div>
              <div className="flex flex-1 flex-wrap items-center gap-2 lg:max-w-xl lg:justify-end">
                <label className="flex h-9 min-w-[210px] flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 text-[var(--text-muted)] focus-within:border-[#1F6F5B]/50">
                  <Search className="h-3.5 w-3.5 shrink-0" />
                  <input value={query} onChange={event => setQuery(event.target.value)} type="search" placeholder="Buscar por nome ou telefone" className="min-w-0 flex-1 bg-transparent text-xs text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]" aria-label="Buscar leads" />
                </label>
                <button type="button" className="flex h-9 items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)]">
                  <Filter className="h-3.5 w-3.5" /> Filtros
                </button>
              </div>
            </div>

            {isLoading ? (
              <div className="flex flex-1 items-center justify-center gap-2 text-xs text-[var(--text-muted)]">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando CRM
              </div>
            ) : visibleStages.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                <UsersRound className="mb-3 h-8 w-8 text-[#1F6F5B] opacity-60" />
                <p className="text-sm font-semibold text-[var(--text)]">Nenhum funil sincronizado</p>
                <p className="mt-1 max-w-md text-xs text-[var(--text-muted)]">Configure as credenciais no servidor, aplique as migrations e use “Sincronizar agora”.</p>
              </div>
            ) : (
              <div className="custom-scrollbar grid flex-1 auto-cols-[minmax(265px,1fr)] grid-flow-col gap-3 overflow-x-auto bg-[var(--bg-subtle)]/60 p-3">
                {visibleStages.map(stage => {
                  const stageOpportunities = visibleOpportunities.filter(item => item.stage_id === stage.id);
                  return (
                    <article key={stage.id} className="flex min-h-[340px] flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                      <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-[#1F6F5B] opacity-60" />
                          <h3 className="truncate text-xs font-bold text-[var(--text)]">{stage.name}</h3>
                        </div>
                        <span className="rounded-md bg-[var(--bg-subtle)] px-2 py-1 font-mono text-[10px] font-semibold text-[var(--text-secondary)]">{stageOpportunities.length}</span>
                      </div>

                      <div className="flex flex-col gap-2 pt-3">
                        {stageOpportunities.map(opportunity => (
                          <div key={opportunity.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)]/45 p-3 transition hover:border-[#1F6F5B]/30 hover:bg-[var(--surface-hover)]">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-xs font-bold text-[var(--text)]">{opportunity.patient_name || opportunity.title}</p>
                                <p className="mt-0.5 truncate text-[10px] text-[var(--text-muted)]">{opportunity.title}</p>
                              </div>
                              {opportunity.priority > 1 && <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" title="Prioridade" />}
                            </div>
                            {opportunity.amount_cents > 0 && <p className="mt-3 font-mono text-xs font-semibold text-[#1F6F5B] dark:text-[#63B596]">{formatCurrency(opportunity.amount_cents)}</p>}
                            <div className="mt-3 flex items-center justify-between gap-2 text-[9px] text-[var(--text-muted)]">
                              <span className="truncate">{opportunity.seller_name || 'Sem responsável'}</span>
                              <span className="truncate">{opportunity.origin || 'Clínica Experts'}</span>
                            </div>
                          </div>
                        ))}
                        {stageOpportunities.length === 0 && <p className="py-10 text-center text-[10px] text-[var(--text-muted)]">Nenhuma oportunidade nesta etapa</p>}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
