import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, RefreshCw, Users, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../supabaseClient';

type Pipeline = { id: string; external_id: string; name: string; synced_at: string };
type Stage = {
  id: string;
  pipeline_id: string;
  external_id: string;
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
  patient_email: string | null;
  seller_name: string | null;
  priority: number;
  amount_cents: number;
  status: string | null;
  synced_at: string;
};

const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;

function normalizePhoneBR(value: string | null) {
  let digits = (value || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return digits.length >= 12 && digits.length <= 13 ? digits : '';
}

function csvCell(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function safeFilename(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
}

export const ClinicaExpertsCRM: React.FC = () => {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const syncInFlight = useRef(false);

  const loadData = useCallback(async () => {
    const [pipelineResult, stageResult, opportunityResult] = await Promise.all([
      supabase.from('clinic_experts_pipelines').select('*').order('name'),
      supabase.from('clinic_experts_stages').select('*').order('position'),
      supabase.from('clinic_experts_opportunities').select('*').order('patient_name'),
    ]);

    const firstError = pipelineResult.error || stageResult.error || opportunityResult.error;
    if (firstError) throw firstError;
    const nextPipelines = (pipelineResult.data || []) as Pipeline[];
    setPipelines(nextPipelines);
    setStages((stageResult.data || []) as Stage[]);
    setOpportunities((opportunityResult.data || []) as Opportunity[]);
    setSelectedPipelineId(current => current || nextPipelines[0]?.id || '');
    const syncDates = nextPipelines.map(item => item.synced_at).sort();
    const newest = syncDates[syncDates.length - 1];
    setLastSync(newest || null);
  }, []);

  const getAccessToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) throw new Error('Sua sessao expirou. Entre novamente.');
    return data.session.access_token;
  }, []);

  const checkStatus = useCallback(async () => {
    const token = await getAccessToken();
    const response = await fetch('/api/integrations/clinica-experts/status', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Falha ao consultar a integracao.');
    setConfigured(Boolean(body.configured));
    if (body.lastSync?.finished_at) setLastSync(body.lastSync.finished_at);
    return Boolean(body.configured);
  }, [getAccessToken]);

  const synchronize = useCallback(async (showFeedback = true) => {
    if (syncInFlight.current) return;
    syncInFlight.current = true;
    setSyncing(true);
    try {
      const token = await getAccessToken();
      const response = await fetch('/api/integrations/clinica-experts/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Falha na sincronizacao.');
      await loadData();
      setConfigured(true);
      setLastSync(body.data?.finishedAt || new Date().toISOString());
      if (showFeedback) {
        toast.success('CRM atualizado pelo Clinica Experts', {
          description: `${body.data?.opportunities || 0} oportunidades sincronizadas.`,
        });
      }
    } catch (error) {
      if (showFeedback) toast.error(error instanceof Error ? error.message : 'Falha na sincronizacao.');
    } finally {
      syncInFlight.current = false;
      setSyncing(false);
    }
  }, [getAccessToken, loadData]);

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      try {
        await loadData();
        const isConfigured = await checkStatus();
        if (active && isConfigured) await synchronize(false);
      } catch (error) {
        if (active) {
          setConfigured(false);
          console.warn('Clinica Experts CRM indisponivel:', error);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void initialize();

    const timer = window.setInterval(() => {
      if (active && configured !== false) void synchronize(false);
    }, AUTO_SYNC_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [checkStatus, loadData, synchronize, configured]);

  const pipelineStages = useMemo(
    () => stages.filter(stage => stage.pipeline_id === selectedPipelineId).sort((a, b) => a.position - b.position),
    [stages, selectedPipelineId],
  );
  const selectedPipeline = pipelines.find(pipeline => pipeline.id === selectedPipelineId);

  const exportStage = (stage: Stage) => {
    const source = opportunities.filter(item => item.stage_id === stage.id);
    const seen = new Set<string>();
    const valid = source.flatMap(item => {
      const phone = normalizePhoneBR(item.patient_phone);
      if (!phone || seen.has(phone)) return [];
      seen.add(phone);
      return [{ ...item, normalizedPhone: phone }];
    });

    if (!valid.length) {
      toast.error('Esta etapa nao possui contatos com telefone valido.');
      return;
    }

    const headers = ['nome', 'telefone', 'email', 'oportunidade', 'funil', 'etapa', 'responsavel'];
    const rows = valid.map(item => [
      item.patient_name || item.title,
      item.normalizedPhone,
      item.patient_email || '',
      item.title,
      selectedPipeline?.name || '',
      stage.name,
      item.seller_name || '',
    ]);
    const csv = `\uFEFF${headers.map(csvCell).join(',')}\r\n${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `whatsapp-${safeFilename(selectedPipeline?.name || 'funil')}-${safeFilename(stage.name)}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);

    const ignored = source.length - valid.length;
    toast.success(`${valid.length} contatos exportados`, {
      description: ignored ? `${ignored} registro(s) sem telefone valido ou duplicado foram ignorados.` : undefined,
    });
  };

  if (loading) {
    return (
      <div className="h-full bg-[#f7f7f9] p-5 dark:bg-[#0f0f13]">
        <div className="mb-7 flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-5 w-44 animate-pulse rounded bg-slate-200/80 dark:bg-white/10" />
            <div className="h-3 w-64 animate-pulse rounded bg-slate-200/60 dark:bg-white/[0.06]" />
          </div>
          <div className="h-9 w-36 animate-pulse rounded-lg bg-slate-200/70 dark:bg-white/[0.08]" />
        </div>
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2].map(item => <div key={item} className="h-72 w-[282px] shrink-0 animate-pulse rounded-xl bg-white dark:bg-white/[0.04]" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col bg-[#f7f7f9] dark:bg-[#0f0f13] text-[#202027] dark:text-[#f4f4f5]">
      <header className="px-5 py-4 border-b border-[#e6e6eb] dark:border-white/[0.07] bg-white/85 dark:bg-[#141419]/90 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-5 w-1 rounded-full bg-[#536fd1]" aria-hidden="true" />
              <h1 className="text-lg font-semibold tracking-[-0.02em]">CRM Clinica Experts</h1>
              <span className={`ml-1 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-medium ${configured ? 'bg-[#536fd1]/8 text-[#4059b2] dark:bg-[#7c8fe0]/10 dark:text-[#aab7f4]' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}>
                {configured ? <span className="size-1.5 rounded-full bg-[#7460a8]" /> : <WifiOff className="size-3" />}
                {configured ? 'Conectado' : 'Desconectado'}
              </span>
            </div>
            <p className="text-[11px] text-[#7b7b86] dark:text-[#92929d] mt-1.5 pl-3">
              {lastSync ? `Ultima atualizacao: ${new Date(lastSync).toLocaleString('pt-BR')}` : 'Aguardando a primeira sincronizacao'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedPipelineId}
              onChange={event => setSelectedPipelineId(event.target.value)}
              aria-label="Selecionar funil"
              className="h-9 min-w-40 px-3 rounded-lg border border-[#dedee4] dark:border-white/10 bg-white dark:bg-[#1b1b21] text-xs font-medium outline-none focus:border-[#536fd1] focus:ring-2 focus:ring-[#536fd1]/10"
            >
              {pipelines.map(pipeline => <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>)}
            </select>
            <button
              onClick={() => void synchronize(true)}
              disabled={syncing || !configured}
              className="h-9 px-3.5 rounded-lg bg-[#4059b2] hover:bg-[#354da4] disabled:opacity-45 text-white text-xs font-semibold flex items-center gap-2 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Atualizando...' : 'Atualizar'}
            </button>
          </div>
        </div>
        {!configured && (
          <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.07] px-3 py-2.5 text-xs text-amber-800 dark:text-amber-200">
            A integracao ainda precisa do token do Clinica Experts e da migration 031 no Supabase.
          </div>
        )}
      </header>

      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden p-4 lg:p-5">
        <div className="h-full flex gap-3 min-w-max">
          {pipelineStages.map(stage => {
            const cards = opportunities.filter(item => item.stage_id === stage.id);
            const exportable = new Set(cards.map(item => normalizePhoneBR(item.patient_phone)).filter(Boolean)).size;
            return (
              <section key={stage.id} className="w-[282px] h-full flex flex-col rounded-xl border border-[#e7e7eb] dark:border-white/[0.07] bg-[#fbfbfc] dark:bg-[#15151a] overflow-hidden">
                <div className="px-3.5 pt-3.5 pb-3 border-b border-[#ececf0] dark:border-white/[0.06]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="size-1.5 shrink-0 rounded-full bg-[#7460a8]" aria-hidden="true" />
                      <h2 className="font-semibold text-[13px] truncate">{stage.name}</h2>
                    </div>
                    <span className="text-[10px] font-medium tabular-nums text-[#777782] dark:text-[#a0a0aa]">{cards.length}</span>
                  </div>
                  <button
                    onClick={() => exportStage(stage)}
                    disabled={!exportable}
                    className="mt-3 h-8 w-full rounded-lg border border-[#dfe2ef] bg-white hover:border-[#536fd1]/40 hover:text-[#4059b2] disabled:opacity-40 dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:text-[#aab7f4] text-[#5d5d68] dark:text-[#b0b0ba] text-[10px] font-medium flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> Exportar para WhatsApp <span className="text-[#92929c]">({exportable})</span>
                  </button>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5">
                  {cards.map(card => (
                    <article key={card.id} className="group rounded-lg border border-[#e9e9ed] dark:border-white/[0.07] bg-white dark:bg-[#1b1b21] p-3 transition-all hover:-translate-y-px hover:border-[#536fd1]/25 hover:shadow-[0_5px_18px_rgba(32,32,39,0.05)] dark:hover:border-[#7c8fe0]/20">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-[13px] truncate">{card.patient_name || card.title}</p>
                          <p className={`text-[11px] truncate mt-1 ${card.patient_phone ? 'text-[#777782] dark:text-[#92929d]' : 'text-amber-600/80 dark:text-amber-300/80'}`}>{card.patient_phone || 'Sem telefone'}</p>
                        </div>
                        <span className="text-[9px] font-medium text-[#a0a0a9]">P{card.priority}</span>
                      </div>
                      {card.seller_name && <p className="mt-2.5 pt-2 border-t border-[#f0f0f2] dark:border-white/[0.05] text-[10px] text-[#85858f] flex items-center gap-1.5"><Users className="w-3 h-3" /> {card.seller_name}</p>}
                    </article>
                  ))}
                  {!cards.length && <div className="py-10 text-center text-[11px] text-[#a0a0a9]">Nenhuma oportunidade nesta etapa</div>}
                </div>
              </section>
            );
          })}
          {!pipelineStages.length && (
            <div className="w-[min(520px,calc(100vw-3rem))] rounded-xl border border-dashed border-[#d8d8df] dark:border-white/10 bg-white/60 dark:bg-white/[0.02] grid place-items-center text-center p-8">
              <div>
                <div className="mx-auto mb-3 grid size-9 place-items-center rounded-lg bg-[#536fd1]/8 text-[#536fd1] dark:bg-[#7c8fe0]/10 dark:text-[#aab7f4]"><Users className="w-4 h-4" /></div>
                <p className="font-medium text-sm">Nenhum funil sincronizado</p>
                <p className="text-xs text-[#85858f] mt-1">Configure o token e execute a primeira sincronizacao.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
