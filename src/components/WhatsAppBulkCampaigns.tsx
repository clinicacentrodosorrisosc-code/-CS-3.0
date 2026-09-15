import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, CheckCircle2, CircleAlert, Loader2, Search, Send, Tag, UsersRound, X } from 'lucide-react';
import { supabase } from '../supabaseClient';

type Pipeline = { id: string; name: string };
type Stage = { id: string; pipeline_id: string; name: string };
type Template = { name: string; language: string; status: string; components?: { type: string; text?: string }[] };
type Campaign = { id: string; name: string; template_name: string; sent_count: number; failed_count?: number; total_recipients: number; status?: string; created_at?: string };
type Contact = { id: string; patient_name: string; opportunity_title: string; phone: string; status: 'ready' | 'skipped' | 'needs_confirmation'; reason: string; phoneSource?: string };
type Preview = { template: { category: string; body: string }; recipients: { totalCards: number; eligible: number; skippedInvalid: number; skippedDuplicate: number; awaitingConfirmation: number; contacts: Contact[] }; pricing: { unitPrice: number; total: number; estimated: boolean; note: string } };
type RecipientReport = { id: string; opportunity_id: string; phone: string; status: string; error_message?: string | null; patient_name: string; opportunity_title: string };

const brl = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sessão expirada. Entre novamente.');
  return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };
}

export const WhatsAppBulkCampaigns: React.FC = () => {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [pipelineId, setPipelineId] = useState('');
  const [stageId, setStageId] = useState('');
  const [templateKey, setTemplateKey] = useState('');
  const [name, setName] = useState('');
  const [successTag, setSuccessTag] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [contactSearch, setContactSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [report, setReport] = useState<{ campaign: Campaign; recipients: RecipientReport[] } | null>(null);

  const load = useCallback(async () => {
    const headers = await authHeaders();
    const [pipelineResult, stageResult, templateResponse, campaignResponse] = await Promise.all([
      supabase.from('clinic_experts_pipelines').select('id,name').order('name'),
      supabase.from('clinic_experts_stages').select('id,pipeline_id,name').order('position'),
      fetch('/api/integrations/whatsapp/templates', { headers }),
      fetch('/api/integrations/whatsapp/bulk-campaigns', { headers }),
    ]);
    const templateBody = await templateResponse.json();
    const campaignBody = await campaignResponse.json();
    const firstError = pipelineResult.error || stageResult.error;
    if (firstError || !templateResponse.ok || !campaignResponse.ok) throw firstError || new Error(templateBody.error || campaignBody.error);
    setPipelines((pipelineResult.data || []) as Pipeline[]);
    setStages((stageResult.data || []) as Stage[]);
    setTemplates((templateBody.templates || []).filter((item: Template) => item.status === 'APPROVED'));
    setCampaigns(campaignBody.campaigns || []);
    setPipelineId(current => current || pipelineResult.data?.[0]?.id || '');
  }, []);

  useEffect(() => { load().catch(error => setNotice(error.message)).finally(() => setLoading(false)); }, [load]);

  const currentTemplate = templates.find(item => `${item.name}::${item.language}` === templateKey);
  const visibleStages = stages.filter(item => item.pipeline_id === pipelineId);
  const variableMapping = Array.from((currentTemplate?.components?.find(item => item.type === 'BODY')?.text || '').matchAll(/\{\{(\d+)\}\}/g))
    .map((match, index) => `{{${match[1]}}} = ${['patient_name', 'seller_name', 'opportunity_title', 'amount'][index] || 'patient_name'}`).join('\n');

  useEffect(() => {
    if (!pipelineId || !currentTemplate) { setPreview(null); setSelectedIds(new Set()); return; }
    const controller = new AbortController();
    void (async () => {
      try {
        const params = new URLSearchParams({ action: 'preview', pipelineId, stageId, templateName: currentTemplate.name, language: currentTemplate.language });
        const response = await fetch(`/api/integrations/whatsapp/bulk-campaigns?${params}`, { headers: await authHeaders(), signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        setPreview(body);
        setSelectedIds(new Set((body.recipients.contacts as Contact[]).filter(contact => contact.status === 'ready').map(contact => contact.id)));
      } catch (error) {
        if (!controller.signal.aborted) setNotice(error instanceof Error ? error.message : 'Falha na conferência.');
      }
    })();
    return () => controller.abort();
  }, [pipelineId, stageId, currentTemplate?.name, currentTemplate?.language]);

  const selectableContacts = preview?.recipients.contacts.filter(contact => contact.status !== 'skipped') || [];
  const selectedContacts = selectableContacts.filter(contact => selectedIds.has(contact.id));
  const selectedEstimate = (preview?.pricing.unitPrice || 0) * selectedContacts.length;
  const filteredContacts = useMemo(() => {
    const search = contactSearch.trim().toLocaleLowerCase('pt-BR');
    return (preview?.recipients.contacts || []).filter(contact => !search || [contact.patient_name, contact.opportunity_title, contact.phone].some(value => value?.toLocaleLowerCase('pt-BR').includes(search)));
  }, [contactSearch, preview]);

  const toggleContact = (contact: Contact) => {
    if (contact.status === 'skipped') return;
    setSelectedIds(current => { const next = new Set(current); if (next.has(contact.id)) next.delete(contact.id); else next.add(contact.id); return next; });
  };

  const send = async () => {
    if (!name.trim() || !currentTemplate || !selectedIds.size) return;
    const historicalSelected = selectedContacts.some(contact => contact.status === 'needs_confirmation');
    if (historicalSelected && !window.confirm('Há telefones recuperados do histórico entre os selecionados. Confirma o uso desses números?')) return;
    if (!window.confirm(`Confirmar envio para ${selectedIds.size} contato(s)?`)) return;
    setSending(true); setNotice('');
    try {
      const headers = await authHeaders();
      const response = await fetch('/api/integrations/whatsapp/bulk-campaigns', { method: 'POST', headers, body: JSON.stringify({ name: name.trim(), templateName: currentTemplate.name, language: currentTemplate.language, variableMapping, pipelineId, stageId, useHistoricalPhones: historicalSelected, selectedOpportunityIds: Array.from(selectedIds), successTag }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      let pending = body.totalRecipients;
      let failed = 0;
      while (pending > 0) {
        const batchResponse = await fetch('/api/integrations/whatsapp/bulk-campaigns', { method: 'POST', headers, body: JSON.stringify({ action: 'process', campaignId: body.campaignId }) });
        const batchBody = await batchResponse.json();
        if (!batchResponse.ok) throw new Error(batchBody.error);
        pending = batchBody.pending;
        failed += Number(batchBody.failed || 0);
      }
      setNotice(failed > 0 ? `Campanha concluída: ${selectedIds.size - failed} enviados e ${failed} com erro.` : `Campanha concluída para ${selectedIds.size} contato(s).`);
      setName('');
      await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Falha ao enviar.'); }
    finally { setSending(false); }
  };

  const openReport = async (campaign: Campaign) => {
    try {
      const response = await fetch(`/api/integrations/whatsapp/bulk-campaigns?campaignId=${campaign.id}`, { headers: await authHeaders() });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setReport({ campaign: body.campaign, recipients: body.recipients });
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Falha ao abrir o relatório.'); }
  };

  if (loading) return <div className="flex h-full items-center justify-center gap-2 text-sm text-[var(--text-muted)]"><Loader2 className="h-4 w-4 animate-spin" />Carregando campanhas</div>;

  return <div className="custom-scrollbar h-full overflow-y-auto p-4 text-[var(--text)] sm:p-6">
    <div className="mx-auto max-w-6xl">
      <header><p className="text-[11px] font-semibold text-[var(--primary)]">WhatsApp oficial</p><h1 className="mt-1 text-2xl font-bold tracking-tight">Disparador em massa</h1><p className="mt-1 text-sm text-[var(--text-secondary)]">Escolha exatamente quem receberá a mensagem antes do envio.</p></header>
      {notice && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">{notice}</p>}
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <main className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold">Nome da campanha<input value={name} onChange={event => setName(event.target.value)} placeholder="Ex.: Retorno setembro" className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 outline-none focus:border-[var(--primary)]" /></label>
            <label className="text-xs font-semibold">Funil<select value={pipelineId} onChange={event => { setPipelineId(event.target.value); setStageId(''); }} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 outline-none">{pipelines.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="text-xs font-semibold">Etapa<select value={stageId} onChange={event => setStageId(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 outline-none"><option value="">Todas as etapas</option>{visibleStages.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="text-xs font-semibold">Template aprovado<select value={templateKey} onChange={event => setTemplateKey(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 outline-none"><option value="">Selecione</option>{templates.map(item => <option key={`${item.name}-${item.language}`} value={`${item.name}::${item.language}`}>{item.name} ({item.language})</option>)}</select></label>
          </div>
          {preview && <section className="mt-5 rounded-2xl bg-[var(--bg-subtle)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[11px] font-semibold text-[var(--primary)]">Prévia do disparo</p><p className="mt-1 text-lg font-bold">{selectedIds.size} de {preview.recipients.totalCards} contatos selecionados</p><p className="mt-1 text-xs text-[var(--text-muted)]">{preview.recipients.skippedInvalid + preview.recipients.skippedDuplicate} bloqueados por telefone ou duplicidade</p></div><div className="text-right"><p className="font-mono text-xl font-semibold">{preview.pricing.estimated ? brl(selectedEstimate) : '--'}</p><p className="text-[10px] text-[var(--text-muted)]">estimativa da Meta</p></div></div>
            <button type="button" onClick={() => setSelectionOpen(true)} className="mt-4 flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-xs font-semibold transition hover:border-[var(--primary)]/40 hover:bg-[var(--surface-hover)]"><UsersRound className="h-4 w-4" />Pré-selecionar contatos</button>
            <label className="mt-4 block text-xs font-semibold"><span className="flex items-center gap-1.5"><Tag className="h-3.5 w-3.5" />Tag após envio confirmado</span><input value={successTag} onChange={event => setSuccessTag(event.target.value)} maxLength={40} placeholder="Ex.: Campanha retorno" className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 outline-none focus:border-[var(--primary)]" /></label>
            <p className="mt-3 text-[10px] leading-relaxed text-[var(--text-muted)]">{preview.pricing.note}</p>
          </section>}
          <button disabled={sending || !name.trim() || !selectedIds.size} onClick={() => void send()} className="mt-5 flex h-11 items-center gap-2 rounded-xl bg-[var(--primary)] px-5 text-sm font-bold text-white transition hover:bg-[var(--primary-hover)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-4 w-4" />{sending ? 'Enviando...' : `Enviar para ${selectedIds.size || 0} contatos`}</button>
        </main>
        <aside className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm"><h2 className="text-sm font-bold">Histórico recente</h2><div className="mt-3 space-y-2">{campaigns.length ? campaigns.map(campaign => <button key={campaign.id} onClick={() => void openReport(campaign)} className="w-full rounded-xl border border-[var(--border-subtle)] p-3 text-left transition hover:bg-[var(--surface-hover)]"><span className="block truncate text-xs font-semibold">{campaign.name}</span><span className="mt-1 block text-[10px] text-[var(--text-muted)]">{campaign.sent_count}/{campaign.total_recipients} enviados · ver relatório</span></button>) : <p className="py-8 text-center text-xs text-[var(--text-muted)]">Nenhuma campanha enviada</p>}</div></aside>
      </div>
    </div>

    {selectionOpen && preview && <div className="fixed inset-0 z-50 flex items-end bg-slate-950/40 sm:items-center sm:justify-center sm:p-6"><section className="flex max-h-[88dvh] w-full max-w-3xl flex-col rounded-t-2xl bg-[var(--surface)] shadow-2xl sm:rounded-2xl"><header className="flex items-center justify-between border-b border-[var(--border)] p-4"><div><p className="text-[11px] font-semibold text-[var(--primary)]">Destinatários</p><h2 className="font-bold">Escolha quem receberá</h2></div><button onClick={() => setSelectionOpen(false)} className="rounded-lg p-2 hover:bg-[var(--surface-hover)]"><X className="h-5 w-5" /></button></header><div className="border-b border-[var(--border)] p-4"><div className="flex flex-wrap gap-2"><button onClick={() => setSelectedIds(new Set(selectableContacts.map(contact => contact.id)))} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold">Selecionar válidos</button><button onClick={() => setSelectedIds(new Set())} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold">Limpar seleção</button><label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-[var(--border)] px-3"><Search className="h-4 w-4 text-[var(--text-muted)]" /><input value={contactSearch} onChange={event => setContactSearch(event.target.value)} placeholder="Buscar contato" className="h-9 min-w-0 flex-1 bg-transparent text-xs outline-none" /></label></div><p className="mt-3 text-xs font-semibold">{selectedIds.size} selecionados · {preview.pricing.estimated ? brl(selectedEstimate) : 'valor não estimado'}</p></div><div className="custom-scrollbar overflow-y-auto p-3">{filteredContacts.map(contact => { const disabled = contact.status === 'skipped'; const checked = selectedIds.has(contact.id); return <button key={contact.id} type="button" disabled={disabled} onClick={() => toggleContact(contact)} className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-55"><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${checked ? 'border-[var(--primary)] bg-[var(--primary)] text-white' : 'border-[var(--border)]'}`}>{checked && <Check className="h-3.5 w-3.5" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{contact.patient_name}</span><span className="mt-0.5 block truncate text-[10px] text-[var(--text-muted)]">{contact.phone || 'Sem telefone'} · {contact.opportunity_title}</span>{contact.reason && <span className="mt-1 block text-[10px] text-amber-700 dark:text-amber-300">{contact.reason}</span>}</span>{contact.status === 'ready' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <CircleAlert className="h-4 w-4 text-amber-500" />}</button>; })}</div><footer className="flex items-center justify-between border-t border-[var(--border)] p-4"><span className="text-xs text-[var(--text-muted)]">{selectedIds.size} de {preview.recipients.totalCards}</span><button onClick={() => setSelectionOpen(false)} className="rounded-xl bg-[var(--primary)] px-4 py-2.5 text-xs font-bold text-white">Aplicar seleção</button></footer></section></div>}

    {report && <div className="fixed inset-0 z-50 flex items-end bg-slate-950/40 sm:items-center sm:justify-center sm:p-6"><section className="flex max-h-[88dvh] w-full max-w-3xl flex-col rounded-t-2xl bg-[var(--surface)] sm:rounded-2xl"><header className="flex items-center justify-between border-b border-[var(--border)] p-4"><div><p className="text-[11px] font-semibold text-[var(--primary)]">Relatório da campanha</p><h2 className="font-bold">{report.campaign.name}</h2></div><button onClick={() => setReport(null)} className="rounded-lg p-2 hover:bg-[var(--surface-hover)]"><X className="h-5 w-5" /></button></header><div className="custom-scrollbar overflow-y-auto p-3">{report.recipients.map(recipient => <div key={recipient.id} className="flex gap-3 rounded-xl px-3 py-3 hover:bg-[var(--surface-hover)]">{recipient.status === 'sent' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <CircleAlert className="h-4 w-4 text-amber-500" />}<div className="min-w-0"><p className="truncate text-xs font-semibold">{recipient.patient_name}</p><p className="text-[10px] text-[var(--text-muted)]">{recipient.phone || 'Sem telefone'} · {recipient.status}</p>{recipient.error_message && <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-300">{recipient.error_message}</p>}</div></div>)}</div></section></div>}
  </div>;
};
