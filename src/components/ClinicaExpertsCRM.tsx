import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, RefreshCw, Users, Wifi, WifiOff } from 'lucide-react';
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
    return <div className="h-full grid place-items-center text-sm text-slate-500">Carregando CRM...</div>;
  }

  return (
    <div className="h-full min-h-0 flex flex-col bg-[#f5f7f6] dark:bg-[#101714] text-[#17211d] dark:text-slate-100">
      <header className="px-5 py-4 border-b border-black/10 dark:border-white/10 bg-white/70 dark:bg-[#15201b]/80 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight">CRM Clinica Experts</h1>
              {configured ? <Wifi className="w-4 h-4 text-emerald-500" /> : <WifiOff className="w-4 h-4 text-amber-500" />}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {lastSync ? `Ultima atualizacao: ${new Date(lastSync).toLocaleString('pt-BR')}` : 'Aguardando a primeira sincronizacao'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedPipelineId}
              onChange={event => setSelectedPipelineId(event.target.value)}
              className="h-10 px-3 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#1a2620] text-sm font-semibold"
            >
              {pipelines.map(pipeline => <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>)}
            </select>
            <button
              onClick={() => void synchronize(true)}
              disabled={syncing || !configured}
              className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wide flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Atualizando' : 'Atualizar agora'}
            </button>
          </div>
        </div>
        {!configured && (
          <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-200">
            A integracao ainda precisa do token do Clinica Experts e da migration 031 no Supabase.
          </div>
        )}
      </header>

      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden p-4">
        <div className="h-full flex gap-3 min-w-max">
          {pipelineStages.map(stage => {
            const cards = opportunities.filter(item => item.stage_id === stage.id);
            const exportable = new Set(cards.map(item => normalizePhoneBR(item.patient_phone)).filter(Boolean)).size;
            return (
              <section key={stage.id} className="w-[290px] h-full flex flex-col rounded-2xl border border-black/10 dark:border-white/10 bg-white/65 dark:bg-[#15201b]/70 overflow-hidden">
                <div className="p-3 border-b border-black/10 dark:border-white/10">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-black text-sm truncate">{stage.name}</h2>
                    <span className="text-[10px] font-black px-2 py-1 rounded-full bg-slate-200 dark:bg-white/10">{cards.length}</span>
                  </div>
                  <button
                    onClick={() => exportStage(stage)}
                    disabled={!exportable}
                    className="mt-3 w-full h-9 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-40 text-emerald-700 dark:text-emerald-300 text-[10px] font-black uppercase flex items-center justify-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5" /> Exportar {exportable} para WhatsApp
                  </button>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
                  {cards.map(card => (
                    <article key={card.id} className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#1a2620] p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-sm truncate">{card.patient_name || card.title}</p>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">{card.patient_phone || 'Sem telefone'}</p>
                        </div>
                        <span className="text-[9px] font-black text-slate-400">P{card.priority}</span>
                      </div>
                      {card.seller_name && <p className="mt-2 text-[10px] text-slate-500 flex items-center gap-1"><Users className="w-3 h-3" /> {card.seller_name}</p>}
                    </article>
                  ))}
                  {!cards.length && <div className="py-10 text-center text-xs text-slate-400">Nenhuma oportunidade</div>}
                </div>
              </section>
            );
          })}
          {!pipelineStages.length && (
            <div className="w-[min(520px,calc(100vw-3rem))] rounded-2xl border border-dashed border-black/15 dark:border-white/15 grid place-items-center text-center p-8">
              <div>
                <Users className="w-8 h-8 mx-auto text-slate-400 mb-3" />
                <p className="font-bold">Nenhum funil sincronizado</p>
                <p className="text-xs text-slate-500 mt-1">Configure o token e execute a primeira sincronizacao.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
