import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Filter,
  MessageCircle,
  GitMerge,
  Phone,
  RefreshCw,
  Search,
  Tag,
  UserRoundPlus,
  UsersRound,
  Upload,
  X,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { AnimatedNumber } from './ui/animated-number';
import { LoadingPanel } from './ui/loading-panel';
import { WhatsAppSettings } from './WhatsAppSettings';
import { CRMAutomations } from './CRMAutomations';
import { WhatsAppBulkCampaigns } from './WhatsAppBulkCampaigns';
import { WhatsAppQuickSend } from './WhatsAppQuickSend';
import { CRMPhoneImport } from './CRMPhoneImport';

type CRMProps = {
  requestedSubTab?: string | null;
};

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
  patient_external_id: string | null;
  pipeline_id: string;
  stage_id: string;
  title: string;
  patient_name: string | null;
  patient_phone: string | null;
  patient_email?: string | null;
  seller_name: string | null;
  priority: number;
  amount_cents: number;
  origin: string | null;
  observations: string | null;
  status: string | null;
  tags: string[];
  synced_at: string;
};

type DuplicateGroup = { key: string; label: string; cards: Opportunity[] };
type Reconciliation = { externalTotal: number; localTotal: number; stages: Array<{ stageId: string; stage: string; externalCount: number; localCount: number; difference: number; externalStatuses: Array<[string, number]> }>; onlyLocal: Array<{ external_id: string; title: string; patient_name: string | null; status: string | null; synced_at: string }>; onlyExternal: Array<{ external_id: string; title: string; patient_name: string | null; status: string | null; stage: string }> };
type MergeField = 'title' | 'patient_name' | 'patient_phone' | 'patient_email' | 'seller_name' | 'origin' | 'observations' | 'status' | 'priority' | 'amount_cents' | 'tags';

const mergeFields: Array<{ key: MergeField; label: string; format?: (value: unknown) => string }> = [
  { key: 'title', label: 'Oportunidade' }, { key: 'patient_name', label: 'Paciente' }, { key: 'patient_phone', label: 'Telefone' }, { key: 'patient_email', label: 'E-mail' },
  { key: 'seller_name', label: 'Responsável' }, { key: 'origin', label: 'Origem' }, { key: 'observations', label: 'Observações' }, { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Prioridade', format: value => String(value || 1) }, { key: 'amount_cents', label: 'Valor', format: value => formatCurrency(Number(value || 0)) },
  { key: 'tags', label: 'Tags', format: value => Array.isArray(value) && value.length ? value.join(', ') : 'Sem tags' },
];

const duplicateKey = (opportunity: Opportunity) => {
  if (opportunity.patient_external_id) return `patient:${opportunity.patient_external_id}`;
  const phone = String(opportunity.patient_phone || '').replace(/\D/g, '');
  if (phone.length >= 10) return `phone:${phone}`;
  const name = String(opportunity.patient_name || '').trim().toLocaleLowerCase('pt-BR');
  return name.length >= 5 ? `name:${name}` : '';
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
const hasValidPhone = (phone: string | null | undefined) => {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 12 && digits.length <= 15;
};

const formatLastSync = (date: string | null | undefined) => {
  if (!date) return 'Ainda não sincronizado';
  return `Atualizado em ${new Date(date).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })}`;
};

export const CRM: React.FC<CRMProps> = ({ requestedSubTab }) => {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState('');
  const [query, setQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [tagOpportunityId, setTagOpportunityId] = useState<string | null>(null);
  const [newTag, setNewTag] = useState('');
  const [quickOpportunity, setQuickOpportunity] = useState<Opportunity | null>(null);
  const [phoneImportOpen, setPhoneImportOpen] = useState(false);
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);
  const [selectedDuplicateGroup, setSelectedDuplicateGroup] = useState<DuplicateGroup | null>(null);
  const [survivorId, setSurvivorId] = useState('');
  const [fieldSources, setFieldSources] = useState<Partial<Record<MergeField, string>>>({});
  const [isMerging, setIsMerging] = useState(false);
  const [reconciliation, setReconciliation] = useState<Reconciliation | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);
  const [phoneFilter, setPhoneFilter] = useState<'all' | 'missing' | 'valid'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [activeView, setActiveView] = useState<'pipeline' | 'automations' | 'whatsapp' | 'campaigns'>('pipeline');

  useEffect(() => {
    if (requestedSubTab === 'whatsapp' || requestedSubTab === 'pipeline' || requestedSubTab === 'automations' || requestedSubTab === 'campaigns') {
      setActiveView(requestedSubTab);
    }
  }, [requestedSubTab]);

  const loadCRM = useCallback(async () => {
    setError('');
    const selectedId = selectedPipelineId;
    let opportunitiesQuery = supabase
      .from('clinic_experts_opportunities')
      .select('id, external_id, patient_external_id, pipeline_id, stage_id, title, patient_name, patient_phone, patient_email, seller_name, priority, amount_cents, origin, observations, status, tags, synced_at')
      .is('merged_into_id', null)
      .order('synced_at', { ascending: false });
    if (selectedId) opportunitiesQuery = opportunitiesQuery.eq('pipeline_id', selectedId);
    const [pipelinesResult, stagesResult, opportunitiesResult] = await Promise.all([
      supabase.from('clinic_experts_pipelines').select('id, external_id, name').order('name'),
      supabase.from('clinic_experts_stages').select('id, pipeline_id, name, stage_type, position').order('position'),
      opportunitiesQuery,
    ]);

    const firstError = pipelinesResult.error || stagesResult.error || opportunitiesResult.error;
    if (firstError) throw firstError;
    setPipelines((pipelinesResult.data || []) as Pipeline[]);
    setStages((stagesResult.data || []) as Stage[]);
    setOpportunities((opportunitiesResult.data || []) as Opportunity[]);
    setSelectedPipelineId(current => current || pipelinesResult.data?.[0]?.id || '');
  }, [selectedPipelineId]);

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
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipelineExternalId: selectedPipeline?.external_id }),
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
  const handlePipelineChange = (pipelineId: string) => {
    setSelectedPipelineId(pipelineId);
    setSelectedTag('');
    setPhoneFilter('all');
    setOpportunities([]);
  };
  const updateOpportunityTags = async (opportunity: Opportunity, nextTags: string[]) => {
    const tags = [...new Set(nextTags.map(tag => tag.trim().replace(/\s+/g, ' ')).filter(Boolean))].slice(0, 20);
    const { error: updateError } = await supabase
      .from('clinic_experts_opportunities')
      .update({ tags })
      .eq('id', opportunity.id);
    if (updateError) throw updateError;
    setOpportunities(current => current.map(item => item.id === opportunity.id ? { ...item, tags } : item));
  };
  const addTag = async (opportunity: Opportunity) => {
    const tag = newTag.trim().replace(/\s+/g, ' ');
    if (!tag) return;
    try {
      await updateOpportunityTags(opportunity, [...(opportunity.tags || []), tag]);
      setNewTag('');
      setTagOpportunityId(null);
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'NÃ£o foi possÃ­vel salvar a tag.');
    }
  };
  const removeTag = async (opportunity: Opportunity, tag: string) => {
    try {
      await updateOpportunityTags(opportunity, (opportunity.tags || []).filter(item => item !== tag));
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'NÃ£o foi possÃ­vel remover a tag.');
    }
  };
  const visibleStages = stages.filter(stage => stage.pipeline_id === selectedPipelineId);
  const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
  const visibleOpportunities = opportunities.filter(opportunity => {
    if (opportunity.pipeline_id !== selectedPipelineId) return false;
    if (selectedTag && !(opportunity.tags || []).includes(selectedTag)) return false;
    const hasPhone = hasValidPhone(opportunity.patient_phone);
    if (phoneFilter === 'missing' && hasPhone) return false;
    if (phoneFilter === 'valid' && !hasPhone) return false;
    if (!normalizedQuery) return true;
    return [opportunity.title, opportunity.patient_name, opportunity.patient_phone, opportunity.seller_name]
      .some(value => value?.toLocaleLowerCase('pt-BR').includes(normalizedQuery));
  });
  const availableTags = useMemo(() => Array.from(new Set(opportunities
    .filter(opportunity => opportunity.pipeline_id === selectedPipelineId)
    .flatMap(opportunity => opportunity.tags || []))).sort((a, b) => a.localeCompare(b, 'pt-BR')), [opportunities, selectedPipelineId]);

  const duplicateGroups = useMemo(() => {
    const grouped = new Map<string, Opportunity[]>();
    opportunities.filter(item => item.pipeline_id === selectedPipelineId).forEach(item => {
      const key = duplicateKey(item);
      if (key) grouped.set(key, [...(grouped.get(key) || []), item]);
    });
    return Array.from(grouped.entries()).filter(([, cards]) => cards.length > 1).map(([key, cards]) => ({ key, cards: cards.slice(0, 2), label: cards[0].patient_name || cards[0].patient_phone || cards[0].title }));
  }, [opportunities, selectedPipelineId]);

  const openMergeReview = (group: DuplicateGroup) => {
    const preferred = group.cards[0];
    setSelectedDuplicateGroup(group);
    setSurvivorId(preferred.id);
    setFieldSources(Object.fromEntries(mergeFields.map(field => [field.key, preferred.id])));
  };

  const confirmMerge = async () => {
    if (!selectedDuplicateGroup || !survivorId) return;
    const survivor = selectedDuplicateGroup.cards.find(card => card.id === survivorId);
    const duplicate = selectedDuplicateGroup.cards.find(card => card.id !== survivorId);
    if (!survivor || !duplicate) return;
    setIsMerging(true);
    setError('');
    try {
      const values = Object.fromEntries(mergeFields.map(field => {
        const source = selectedDuplicateGroup.cards.find(card => card.id === (fieldSources[field.key] || survivorId)) || survivor;
        return [field.key, source[field.key]];
      }));
      const { error: mergeError } = await supabase.rpc('merge_clinic_experts_opportunities', { p_survivor_id: survivor.id, p_duplicate_id: duplicate.id, p_values: values });
      if (mergeError) throw mergeError;
      setDuplicatesOpen(false);
      setSelectedDuplicateGroup(null);
      setNotice(`Cards mesclados. ${duplicate.patient_name || duplicate.title} foi ocultado no CRM local.`);
      await loadCRM();
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'Não foi possível mesclar os cards.');
    } finally { setIsMerging(false); }
  };

  const runReconciliation = async () => {
    if (!selectedPipeline?.external_id) return;
    setIsReconciling(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sua sessão expirou. Entre novamente.');
      const response = await fetch(`/api/integrations/clinica-experts/reconciliation?pipelineExternalId=${encodeURIComponent(selectedPipeline.external_id)}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Não foi possível reconciliar o funil.');
      setReconciliation(body.data as Reconciliation);
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'Não foi possível reconciliar o funil.');
    } finally { setIsReconciling(false); }
  };

  const metrics = useMemo(() => {
    const active = opportunities.filter(opportunity => !['won', 'lost', 'closed'].includes(opportunity.status || ''));
    const today = new Date().toISOString().slice(0, 10);
    return [
      { label: 'Leads ativos', value: active.length, detail: `${opportunities.length} oportunidades sincronizadas`, icon: UsersRound },
      { label: 'Atualizados hoje', value: opportunities.filter(item => item.synced_at.slice(0, 10) === today).length, detail: 'Dados recebidos da Clínica Experts', icon: UserRoundPlus },
      { label: 'No funil atual', value: visibleOpportunities.length, detail: selectedPipeline?.name || 'Selecione um funil', icon: BarChart3 },
    ];
  }, [opportunities, selectedPipeline?.name, visibleOpportunities.length]);

  if (activeView === 'whatsapp') {
    return <WhatsAppSettings />;
  }

  if (activeView === 'automations') {
    return <CRMAutomations />;
  }

  if (activeView === 'campaigns') {
    return <WhatsAppBulkCampaigns />;
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-transparent text-[var(--text)]">
      <div className="custom-scrollbar flex-1 overflow-y-auto px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
          <header className="module-command-bar flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
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
              <button type="button" onClick={runReconciliation} disabled={isReconciling || !selectedPipeline} className="flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-xs font-bold text-[var(--text-secondary)] transition hover:border-[var(--primary)]/40 hover:bg-[var(--surface-hover)] disabled:opacity-50"><BarChart3 className={`h-4 w-4 ${isReconciling ? 'animate-pulse' : ''}`} />{isReconciling ? 'Comparando...' : 'Reconciliar funil'}</button>
              <button type="button" onClick={() => setDuplicatesOpen(true)} className="flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-xs font-bold text-[var(--text-secondary)] transition hover:border-[var(--primary)]/40 hover:bg-[var(--surface-hover)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40"><GitMerge className="h-4 w-4" />Duplicidades{duplicateGroups.length > 0 && <span className="rounded-full bg-[var(--primary-dim)] px-1.5 py-0.5 text-[10px] text-[var(--primary)]">{duplicateGroups.length}</span>}</button>
              <button type="button" onClick={() => setPhoneImportOpen(true)} className="flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-xs font-bold text-[var(--text-secondary)] transition hover:border-[var(--primary)]/40 hover:bg-[var(--surface-hover)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40"><Upload className="h-4 w-4" />Importar telefones</button>
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
          {notice && <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /><span>{notice}</span></div>}

          <section className="grid grid-cols-1 gap-3 md:grid-cols-3" aria-label="Indicadores do CRM">
            {metrics.map(({ label, value, detail, icon: Icon }) => (
              <article key={label} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-secondary)]">{label}</p>
                    <AnimatedNumber value={value} className="mt-2 block font-mono text-3xl font-semibold tracking-[-0.04em] text-[var(--text)]" />
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
                    onChange={event => handlePipelineChange(event.target.value)}
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
                <label className="flex h-9 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 text-xs font-semibold text-[var(--text-secondary)]">
                  <Filter className="h-3.5 w-3.5" />
                  <select value={selectedTag} onChange={event => setSelectedTag(event.target.value)} className="max-w-[160px] bg-transparent outline-none">
                    <option value="">Todas as tags</option>
                    {availableTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
                  </select>
                </label>
                <label className="flex h-9 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 text-xs font-semibold text-[var(--text-secondary)]">
                  <Phone className="h-3.5 w-3.5" />
                  <select value={phoneFilter} onChange={event => setPhoneFilter(event.target.value as 'all' | 'missing' | 'valid')} className="max-w-[165px] bg-transparent outline-none">
                    <option value="all">Todos os telefones</option>
                    <option value="missing">Sem telefone</option>
                    <option value="valid">Com telefone válido</option>
                  </select>
                </label>
              </div>
            </div>

            {isLoading ? (
              <LoadingPanel label="Carregando CRM" description="Organizando funis, etapas e oportunidades." />
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
                                <p className={`mt-1 flex items-center gap-1 text-[10px] font-medium ${hasValidPhone(opportunity.patient_phone) ? 'text-[var(--text-secondary)]' : 'text-amber-700 dark:text-amber-300'}`}><Phone className="h-3 w-3" />{hasValidPhone(opportunity.patient_phone) ? opportunity.patient_phone : 'Sem telefone'}</p>
                              </div>
                              {opportunity.priority > 1 && <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" title="Prioridade" />}
                            </div>
                            {opportunity.amount_cents > 0 && <p className="mt-3 font-mono text-xs font-semibold text-[#1F6F5B] dark:text-[#63B596]">{formatCurrency(opportunity.amount_cents)}</p>}
                            {opportunity.observations && <p className="mt-2 line-clamp-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)]/70 px-2 py-1.5 text-[10px] leading-relaxed text-[var(--text-secondary)]" title={opportunity.observations}>{opportunity.observations}</p>}
                            <div className="mt-2 flex flex-wrap items-center gap-1">
                              {(opportunity.tags || []).map(tag => <span key={tag} className="inline-flex max-w-full items-center gap-1 rounded-md bg-[#EAF5F0] py-1 pl-2 pr-1 text-[9px] font-semibold text-[#1F6F5B] dark:bg-[#63B596]/10 dark:text-[#63B596]"><span className="truncate">{tag}</span><button type="button" onClick={() => void removeTag(opportunity, tag)} className="rounded p-0.5 hover:bg-[#1F6F5B]/10" aria-label={`Remover tag ${tag}`}><X className="h-2.5 w-2.5" /></button></span>)}
                              {tagOpportunityId === opportunity.id ? <form onSubmit={event => { event.preventDefault(); void addTag(opportunity); }} className="flex items-center gap-1"><input autoFocus value={newTag} onChange={event => setNewTag(event.target.value)} onBlur={() => { if (!newTag.trim()) setTagOpportunityId(null); }} maxLength={40} placeholder="Nova tag" className="h-6 w-24 rounded-md border border-[var(--border)] bg-[var(--surface)] px-1.5 text-[9px] text-[var(--text)] outline-none focus:border-[var(--primary)]" /><button type="submit" className="rounded-md bg-[var(--primary)] px-1.5 py-1 text-[9px] font-bold text-white">Salvar</button></form> : <button type="button" onClick={() => { setTagOpportunityId(opportunity.id); setNewTag(''); }} className="inline-flex items-center gap-1 rounded-md border border-dashed border-[var(--border)] px-1.5 py-1 text-[9px] font-semibold text-[var(--text-muted)] transition hover:border-[var(--primary)]/50 hover:text-[var(--primary)]"><Tag className="h-2.5 w-2.5" />Tag</button>}
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-2 text-[9px] text-[var(--text-muted)]">
                              <span className="truncate">{opportunity.seller_name || 'Sem responsável'}</span>
                              <button type="button" onClick={() => setQuickOpportunity(opportunity)} className="flex shrink-0 items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 font-semibold text-[var(--primary)] transition hover:border-[var(--primary)]/40 hover:bg-[var(--surface-hover)]" title="Fazer disparo rápido"><MessageCircle className="h-3 w-3" />Disparo rápido</button>
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
      {reconciliation && <div className="fixed inset-0 z-50 flex items-end bg-slate-950/40 sm:items-center sm:justify-center sm:p-6" role="presentation"><section className="flex max-h-[90dvh] w-full max-w-4xl flex-col rounded-t-2xl bg-[var(--surface)] shadow-2xl sm:rounded-2xl" role="dialog" aria-modal="true" aria-label="Reconciliação do funil"><header className="flex items-start justify-between gap-4 border-b border-[var(--border)] p-5"><div><p className="text-[11px] font-semibold text-[var(--primary)]">RECONCILIAÇÃO SEGURA</p><h2 className="mt-1 text-xl font-bold">Clínica Experts × CRM local</h2><p className="mt-1 text-xs text-[var(--text-muted)]">Apenas comparação: nenhum card foi alterado ou excluído.</p></div><button type="button" onClick={() => setReconciliation(null)} className="rounded-lg p-2 hover:bg-[var(--surface-hover)]" aria-label="Fechar"><X className="h-5 w-5" /></button></header><div className="custom-scrollbar overflow-y-auto p-5"><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-[var(--bg-subtle)] p-4"><p className="text-xs text-[var(--text-muted)]">Cards retornados pela API</p><strong className="mt-1 block font-mono text-2xl">{reconciliation.externalTotal}</strong></div><div className="rounded-xl bg-[var(--bg-subtle)] p-4"><p className="text-xs text-[var(--text-muted)]">Cards no CRM local</p><strong className="mt-1 block font-mono text-2xl">{reconciliation.localTotal}</strong></div></div><div className="mt-5 overflow-hidden rounded-xl border border-[var(--border)]"><div className="grid grid-cols-[1fr_70px_70px_80px] bg-[var(--bg-subtle)] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]"><span>Etapa</span><span>API</span><span>Local</span><span>Diferença</span></div>{reconciliation.stages.map(stage => <div key={stage.stageId} className="border-t border-[var(--border-subtle)] px-3 py-3"><div className="grid grid-cols-[1fr_70px_70px_80px] text-xs"><span className="font-semibold">{stage.stage}</span><span>{stage.externalCount}</span><span>{stage.localCount}</span><span className={stage.difference === 0 ? 'text-emerald-600' : 'font-semibold text-amber-600'}>{stage.difference > 0 ? '+' : ''}{stage.difference}</span></div>{stage.externalStatuses.length > 0 && <p className="mt-1 text-[10px] text-[var(--text-muted)]">API por status: {stage.externalStatuses.map(([status, count]) => `${status}: ${count}`).join(' · ')}</p>}</div>)}</div>{(reconciliation.onlyLocal.length > 0 || reconciliation.onlyExternal.length > 0) && <div className="mt-5 grid gap-4 md:grid-cols-2"><div><h3 className="text-xs font-bold">Só no CRM local ({reconciliation.onlyLocal.length})</h3><div className="mt-2 space-y-1.5">{reconciliation.onlyLocal.map(card => <div key={card.external_id} className="rounded-lg border border-[var(--border)] p-2 text-[11px]"><strong className="block truncate">{card.patient_name || card.title}</strong><span className="block truncate text-[var(--text-muted)]">{card.external_id} · {card.status || 'sem status'}</span></div>)}</div></div><div><h3 className="text-xs font-bold">Só na API ({reconciliation.onlyExternal.length})</h3><div className="mt-2 space-y-1.5">{reconciliation.onlyExternal.map(card => <div key={card.external_id} className="rounded-lg border border-[var(--border)] p-2 text-[11px]"><strong className="block truncate">{card.patient_name || card.title}</strong><span className="block truncate text-[var(--text-muted)]">{card.external_id} · {card.status || 'sem status'}</span></div>)}</div></div></div>}</div></section></div>}
      {duplicatesOpen && <div className="fixed inset-0 z-50 flex items-end bg-slate-950/40 p-0 sm:items-center sm:justify-center sm:p-6" role="presentation">
        <section className="flex max-h-[92dvh] w-full max-w-5xl flex-col rounded-t-2xl bg-[var(--surface)] shadow-2xl sm:rounded-2xl" role="dialog" aria-modal="true" aria-label="Mesclar cards duplicados">
          <header className="flex items-start justify-between gap-4 border-b border-[var(--border)] p-5"><div><p className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--primary)]"><GitMerge className="h-3.5 w-3.5" />Higienização do CRM</p><h2 className="mt-1 text-xl font-bold tracking-tight">Cards duplicados</h2><p className="mt-1 text-xs text-[var(--text-muted)]">A mesclagem é local: o card de origem continua na Clínica Experts e fica oculto aqui.</p></div><button type="button" onClick={() => { setDuplicatesOpen(false); setSelectedDuplicateGroup(null); }} className="rounded-lg p-2 hover:bg-[var(--surface-hover)]" aria-label="Fechar"><X className="h-5 w-5" /></button></header>
          {!selectedDuplicateGroup ? <div className="custom-scrollbar overflow-y-auto p-4">{duplicateGroups.length === 0 ? <div className="py-14 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" /><p className="mt-3 text-sm font-semibold">Nenhuma duplicidade encontrada neste funil</p><p className="mt-1 text-xs text-[var(--text-muted)]">Comparamos identificador do paciente, telefone e, quando necessário, nome.</p></div> : <div className="space-y-2">{duplicateGroups.map(group => <button type="button" key={group.key} onClick={() => openMergeReview(group)} className="flex w-full items-center justify-between gap-4 rounded-xl border border-[var(--border)] p-4 text-left transition hover:border-[var(--primary)]/35 hover:bg-[var(--surface-hover)]"><span><strong className="block text-sm">{group.label}</strong><span className="mt-1 block text-xs text-[var(--text-muted)]">{group.cards.map(card => `${card.title} · ${card.patient_phone || 'sem telefone'}`).join('  |  ')}</span></span><span className="shrink-0 rounded-full bg-[var(--primary-dim)] px-2.5 py-1 text-[11px] font-semibold text-[var(--primary)]">Revisar {group.cards.length} cards</span></button>)}</div>}</div> : <div className="custom-scrollbar overflow-y-auto p-5">
            <div className="mb-5 grid gap-3 md:grid-cols-2">{selectedDuplicateGroup.cards.slice(0, 2).map(card => <button type="button" key={card.id} onClick={() => setSurvivorId(card.id)} className={`rounded-xl border p-4 text-left transition ${survivorId === card.id ? 'border-[var(--primary)] bg-[var(--primary-dim)] ring-1 ring-[var(--primary)]/20' : 'border-[var(--border)] hover:bg-[var(--surface-hover)]'}`}><span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{survivorId === card.id ? 'Card que será mantido' : 'Card que será ocultado'}</span><strong className="mt-1 block text-sm">{card.patient_name || card.title}</strong><span className="mt-1 block text-xs text-[var(--text-secondary)]">{card.title}</span><span className="mt-1 block text-xs text-[var(--text-muted)]">{card.patient_phone || 'Sem telefone'}</span></button>)}</div>
            <p className="mb-3 text-xs font-semibold text-[var(--text-secondary)]">Escolha de qual card manter cada dado</p>
            <div className="overflow-hidden rounded-xl border border-[var(--border)]"><div className="grid grid-cols-[minmax(100px,0.7fr)_minmax(0,1fr)_minmax(0,1fr)] border-b border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]"><span>Campo</span>{selectedDuplicateGroup.cards.slice(0, 2).map(card => <span key={card.id} className="truncate px-2">{card.patient_name || card.title}</span>)}</div>{mergeFields.map(field => <div key={field.key} className="grid grid-cols-[minmax(100px,0.7fr)_minmax(0,1fr)_minmax(0,1fr)] border-b border-[var(--border-subtle)] last:border-b-0"><span className="px-3 py-3 text-xs font-semibold text-[var(--text-secondary)]">{field.label}</span>{selectedDuplicateGroup.cards.slice(0, 2).map(card => { const value = card[field.key]; const display = field.format ? field.format(value) : String(value || 'Não informado'); const selected = (fieldSources[field.key] || survivorId) === card.id; return <button type="button" key={card.id} onClick={() => setFieldSources(current => ({ ...current, [field.key]: card.id }))} className={`min-w-0 border-l border-[var(--border-subtle)] px-3 py-3 text-left text-xs transition ${selected ? 'bg-[var(--primary-dim)] text-[var(--text)]' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'}`}><span className={`mr-2 inline-block h-3 w-3 rounded-full border align-[-1px] ${selected ? 'border-[var(--primary)] bg-[var(--primary)] ring-2 ring-[var(--primary)]/15' : 'border-[var(--border)]'}`} /><span className="break-words">{display}</span></button>})}</div>)}</div>
          </div>}
          {selectedDuplicateGroup && <footer className="flex items-center justify-between gap-3 border-t border-[var(--border)] p-4"><button type="button" onClick={() => setSelectedDuplicateGroup(null)} className="rounded-xl px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]">Voltar</button><button type="button" onClick={confirmMerge} disabled={isMerging} className="flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"><GitMerge className="h-4 w-4" />{isMerging ? 'Mesclando...' : 'Confirmar mesclagem'}</button></footer>}
        </section>
      </div>}
      {quickOpportunity && <WhatsAppQuickSend opportunity={quickOpportunity} onClose={() => setQuickOpportunity(null)} onSent={() => { setNotice('Mensagem enviada e card atualizado.'); void loadCRM(); }} />}
      {phoneImportOpen && <CRMPhoneImport opportunities={opportunities} onClose={() => setPhoneImportOpen(false)} onImported={updated => { setNotice(`${updated} card(s) receberam telefone pela importação.`); void loadCRM(); }} />}
    </div>
  );
};
