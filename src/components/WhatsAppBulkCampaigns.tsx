import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, CheckCircle2, CircleAlert, Loader2, Search, Send, Tag, UsersRound, X } from 'lucide-react';
import { supabase } from '../supabaseClient';

type Pipeline = { id: string; name: string };
type Stage = { id: string; pipeline_id: string; name: string };
type Template = { name: string; language: string; status: string; components?: { type: string; text?: string }[] };
type Campaign = { id: string; name: string; template_name: string; sent_count: number; failed_count?: number; total_recipients: number; status?: string; created_at?: string };
type Contact = { id: string; patient_name: string; opportunity_title: string; phone: string; status: 'ready' | 'skipped' | 'needs_confirmation'; reason: string; phoneSource?: string };
type OpportunitySample = { patient_name: string | null; patient_phone: string | null; seller_name: string | null; title: string; amount_cents: number };
type Preview = { template: { category: string; body: string }; sample: OpportunitySample | null; recipients: { totalCards: number; eligible: number; skippedInvalid: number; skippedDuplicate: number; awaitingConfirmation: number; contacts: Contact[] }; pricing: { unitPrice: number; total: number; estimated: boolean; note: string } };
type RecipientReport = { id: string; opportunity_id: string; phone: string; status: string; error_message?: string | null; patient_name: string; opportunity_title: string };
type TagFilterMode = 'all' | 'include' | 'exclude';

const variableOptions = [
  { value: 'patient_name', label: 'Nome do paciente' },
  { value: 'patient_phone', label: 'Telefone do paciente' },
  { value: 'seller_name', label: 'Responsável comercial' },
  { value: 'opportunity_title', label: 'Nome da oportunidade' },
  { value: 'amount', label: 'Valor da oportunidade' },
];

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
  const [tagFilterMode, setTagFilterMode] = useState<TagFilterMode>('all');
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [variableMappings, setVariableMappings] = useState<Record<number, string>>({});
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
  const templateBody = currentTemplate?.components?.find(item => item.type === 'BODY')?.text || '';
  const placeholderNumbers = Array.from(new Set(Array.from(templateBody.matchAll(/\{\{(\d+)\}\}/g), match => Number(match[1])))).sort((a, b) => a - b);
  const variableMapping = Object.entries(variableMappings).sort(([a], [b]) => Number(a) - Number(b)).map(([position, key]) => `{{${position}}} = ${key}`).join('\n');
  const missingVariables = placeholderNumbers.filter(position => !variableMappings[position]);

  useEffect(() => {
    if (!pipelineId) { setAvailableTags([]); return; }
    void (async () => {
      let query = supabase.from('clinic_experts_opportunities').select('tags').eq('pipeline_id', pipelineId);
      if (stageId) query = query.eq('stage_id', stageId);
      const { data, error } = await query;
      if (error) { setNotice(error.message); return; }
      const tags = [...new Set((data || []).flatMap(item => Array.isArray(item.tags) ? item.tags : []).map(tag => String(tag).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
      setAvailableTags(tags);
      setTagFilters(current => current.filter(tag => tags.includes(tag)));
    })();
  }, [pipelineId, stageId]);

  const sampleValue = (key: string) => {
    const sample = preview?.sample;
    if (!sample) return `[${variableOptions.find(option => option.value === key)?.label || key}]`;
    const values: Record<string, string> = {
      patient_name: sample.patient_name || 'Paciente sem nome',
      patient_phone: sample.patient_phone || 'Telefone não informado',
      seller_name: sample.seller_name || 'Responsável não informado',
      opportunity_title: sample.title || 'Oportunidade',
      amount: brl((sample.amount_cents || 0) / 100),
    };
    return values[key] || `[${key}]`;
  };

  const renderedMessage = templateBody.replace(/\{\{(\d+)\}\}/g, (_, rawPosition: string) => {
    const position = Number(rawPosition);
    return variableMappings[position] ? sampleValue(variableMappings[position]) : `{{${position}}}`;
  });

  const selectTemplate = (nextTemplateKey: string) => {
    setTemplateKey(nextTemplateKey);
    const nextTemplate = templates.find(item => `${item.name}::${item.language}` === nextTemplateKey);
    const positions = Array.from(new Set(Array.from((nextTemplate?.components?.find(item => item.type === 'BODY')?.text || '').matchAll(/\{\{(\d+)\}\}/g), match => Number(match[1])))).sort((a, b) => a - b);
    const defaults = ['patient_name', 'seller_name', 'opportunity_title', 'amount'];
    setVariableMappings(Object.fromEntries(positions.map((position, index) => [position, defaults[index] || 'patient_name'])));
  };

  const setVariableMapping = (position: number, key: string) => {
    setVariableMappings(current => {
      const next = { ...current };
      if (key) next[position] = key;
      else delete next[position];
      return next;
    });
  };

  useEffect(() => {
    if (!pipelineId || !currentTemplate) { setPreview(null); setSelectedIds(new Set()); return; }
    const controller = new AbortController();
    void (async () => {
      try {
        const params = new URLSearchParams({ action: 'preview', pipelineId, stageId, templateName: currentTemplate.name, language: currentTemplate.language });
        if (tagFilterMode !== 'all' && tagFilters.length) { params.set('tagFilterMode', tagFilterMode); params.set('tagFilters', JSON.stringify(tagFilters)); }
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
  }, [pipelineId, stageId, tagFilterMode, tagFilters, currentTemplate?.name, currentTemplate?.language]);

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
    if (tagFilterMode !== 'all' && !tagFilters.length) { setNotice('Selecione ao menos uma tag usada no filtro do público.'); return; }
    if (missingVariables.length) { setNotice('Escolha o conteúdo de todas as variáveis do template antes de enviar.'); return; }
    const historicalSelected = selectedContacts.some(contact => contact.status === 'needs_confirmation');
    if (historicalSelected && !window.confirm('Há telefones recuperados do histórico entre os selecionados. Confirma o uso desses números?')) return;
    if (!window.confirm(`Confirmar envio para ${selectedIds.size} contato(s)?`)) return;
    setSending(true); setNotice('');
    try {
      const headers = await authHeaders();
      const response = await fetch('/api/integrations/whatsapp/bulk-campaigns', { method: 'POST', headers, body: JSON.stringify({ name: name.trim(), templateName: currentTemplate.name, language: currentTemplate.language, variableMapping, pipelineId, stageId, useHistoricalPhones: historicalSelected, selectedOpportunityIds: Array.from(selectedIds), successTag, tagFilterMode, tagFilters }) });
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
            <label className="text-xs font-semibold">Template aprovado<select value={templateKey} onChange={event => selectTemplate(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 outline-none"><option value="">Selecione</option>{templates.map(item => <option key={`${item.name}-${item.language}`} value={`${item.name}::${item.language}`}>{item.name} ({item.language})</option>)}</select></label>
          </div>
          <section className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-subtle)] p-4">
            <div className="flex items-center gap-1.5 text-xs font-bold"><Tag className="h-3.5 w-3.5 text-[var(--primary)]" />Público por tag</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold">Regra do filtro<select value={tagFilterMode} onChange={event => { const mode = event.target.value as TagFilterMode; setTagFilterMode(mode); if (mode === 'all') setTagFilters([]); }} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 outline-none"><option value="all">Não filtrar por tag</option><option value="include">Enviar para quem possui alguma das tags</option><option value="exclude">Não enviar para quem possui alguma das tags</option></select></label>
              {tagFilterMode !== 'all' && <div className="text-xs font-semibold"><span>Tags selecionadas ({tagFilters.length})</span><div className="mt-1.5 max-h-32 space-y-1 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2">{availableTags.map(tag => { const selected = tagFilters.includes(tag); return <button key={tag} type="button" onClick={() => setTagFilters(current => selected ? current.filter(item => item !== tag) : [...current, tag])} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium hover:bg-[var(--surface-hover)]"><span className={`flex h-4 w-4 items-center justify-center rounded border ${selected ? 'border-[var(--primary)] bg-[var(--primary)] text-white' : 'border-[var(--border)]'}`}>{selected && <Check className="h-3 w-3" />}</span><span className="truncate">{tag}</span></button>; })}{!availableTags.length && <span className="block p-2 text-[10px] font-normal text-[var(--text-muted)]">Nenhuma tag encontrada neste público.</span>}</div></div>}
            </div>
            {tagFilterMode !== 'all' && tagFilters.length > 0 && <p className="mt-3 text-[10px] text-[var(--text-muted)]">A prévia e o envio considerarão qualquer uma das tags selecionadas.</p>}
          </section>
          {currentTemplate && <section className="mt-5 grid gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10 md:grid-cols-[minmax(0,1fr)_280px]">
            <div>
              <div className="flex items-center justify-between gap-3"><p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Como ficará a mensagem</p><span className="rounded-md bg-white/70 px-2 py-1 text-[9px] font-semibold text-emerald-700 dark:bg-white/10 dark:text-emerald-200">{currentTemplate.language}</span></div>
              <div className="mt-3 max-w-xl rounded-xl rounded-tl-sm bg-white px-3.5 py-3 shadow-sm dark:bg-[var(--surface)]"><p className="whitespace-pre-wrap text-xs leading-5 text-[var(--text)]">{renderedMessage || 'Este template não possui texto no corpo.'}</p></div>
              <p className="mt-2 text-[10px] text-[var(--text-muted)]">{preview?.sample ? `Exemplo usando o contato ${preview.sample.patient_name || preview.sample.title}.` : 'Os valores reais serão personalizados para cada contato selecionado.'}</p>
            </div>
            <div className="border-t border-emerald-600/15 pt-4 md:border-l md:border-t-0 md:pl-4 md:pt-0">
              <p className="text-xs font-bold text-[var(--text)]">Variáveis da mensagem</p>
              {placeholderNumbers.length > 0 ? <div className="mt-3 space-y-2">{placeholderNumbers.map(position => <label key={position} className="block text-[10px] font-semibold text-[var(--text-secondary)]"><span className="mb-1 flex items-center justify-between"><span>{`Variável {{${position}}}`}</span>{variableMappings[position] && <span className="max-w-[150px] truncate font-normal text-[var(--text-muted)]">{sampleValue(variableMappings[position])}</span>}</span><select value={variableMappings[position] || ''} onChange={event => setVariableMapping(position, event.target.value)} className="h-9 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text)] outline-none focus:border-[var(--primary)]"><option value="">Escolha o conteúdo</option>{variableOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>)}</div> : <p className="mt-3 rounded-lg bg-white/60 px-3 py-2 text-[10px] text-[var(--text-muted)] dark:bg-white/5">Este template não possui variáveis no corpo.</p>}
              {missingVariables.length > 0 && <p className="mt-2 text-[10px] font-semibold text-amber-700 dark:text-amber-300">Defina {missingVariables.length === 1 ? 'a variável pendente' : `as ${missingVariables.length} variáveis pendentes`} para liberar o envio.</p>}
            </div>
          </section>}
          {preview && <section className="mt-5 rounded-2xl bg-[var(--bg-subtle)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[11px] font-semibold text-[var(--primary)]">Prévia do disparo</p><p className="mt-1 text-lg font-bold">{selectedIds.size} de {preview.recipients.totalCards} contatos selecionados</p><p className="mt-1 text-xs text-[var(--text-muted)]">{preview.recipients.skippedInvalid + preview.recipients.skippedDuplicate} bloqueados por telefone ou duplicidade</p></div><div className="text-right"><p className="font-mono text-xl font-semibold">{preview.pricing.estimated ? brl(selectedEstimate) : '--'}</p><p className="text-[10px] text-[var(--text-muted)]">estimativa da Meta</p></div></div>
            <button type="button" onClick={() => setSelectionOpen(true)} className="mt-4 flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-xs font-semibold transition hover:border-[var(--primary)]/40 hover:bg-[var(--surface-hover)]"><UsersRound className="h-4 w-4" />Pré-selecionar contatos</button>
            <label className="mt-4 block text-xs font-semibold"><span className="flex items-center gap-1.5"><Tag className="h-3.5 w-3.5" />Tag após envio confirmado</span><input value={successTag} onChange={event => setSuccessTag(event.target.value)} maxLength={40} placeholder="Ex.: Campanha retorno" className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 outline-none focus:border-[var(--primary)]" /></label>
            <p className="mt-3 text-[10px] leading-relaxed text-[var(--text-muted)]">{preview.pricing.note}</p>
          </section>}
          <button disabled={sending || !name.trim() || !selectedIds.size || missingVariables.length > 0 || (tagFilterMode !== 'all' && !tagFilters.length)} onClick={() => void send()} className="mt-5 flex h-11 items-center gap-2 rounded-xl bg-[var(--primary)] px-5 text-sm font-bold text-white transition hover:bg-[var(--primary-hover)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-4 w-4" />{sending ? 'Enviando...' : `Enviar para ${selectedIds.size || 0} contatos`}</button>
        </main>
        <aside className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm"><h2 className="text-sm font-bold">Histórico recente</h2><div className="mt-3 space-y-2">{campaigns.length ? campaigns.map(campaign => <button key={campaign.id} onClick={() => void openReport(campaign)} className="w-full rounded-xl border border-[var(--border-subtle)] p-3 text-left transition hover:bg-[var(--surface-hover)]"><span className="block truncate text-xs font-semibold">{campaign.name}</span><span className="mt-1 block text-[10px] text-[var(--text-muted)]">{campaign.sent_count}/{campaign.total_recipients} enviados · ver relatório</span></button>) : <p className="py-8 text-center text-xs text-[var(--text-muted)]">Nenhuma campanha enviada</p>}</div></aside>
      </div>
    </div>

    {selectionOpen && preview && <div className="fixed inset-0 z-50 flex items-end bg-slate-950/40 sm:items-center sm:justify-center sm:p-6"><section className="flex max-h-[88dvh] w-full max-w-3xl flex-col rounded-t-2xl bg-[var(--surface)] shadow-2xl sm:rounded-2xl"><header className="flex items-center justify-between border-b border-[var(--border)] p-4"><div><p className="text-[11px] font-semibold text-[var(--primary)]">Destinatários</p><h2 className="font-bold">Escolha quem receberá</h2></div><button onClick={() => setSelectionOpen(false)} className="rounded-lg p-2 hover:bg-[var(--surface-hover)]"><X className="h-5 w-5" /></button></header><div className="border-b border-[var(--border)] p-4"><div className="flex flex-wrap gap-2"><button onClick={() => setSelectedIds(new Set(selectableContacts.map(contact => contact.id)))} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold">Selecionar válidos</button><button onClick={() => setSelectedIds(new Set())} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold">Limpar seleção</button><label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-[var(--border)] px-3"><Search className="h-4 w-4 text-[var(--text-muted)]" /><input value={contactSearch} onChange={event => setContactSearch(event.target.value)} placeholder="Buscar contato" className="h-9 min-w-0 flex-1 bg-transparent text-xs outline-none" /></label></div><p className="mt-3 text-xs font-semibold">{selectedIds.size} selecionados · {preview.pricing.estimated ? brl(selectedEstimate) : 'valor não estimado'}</p></div><div className="custom-scrollbar overflow-y-auto p-3">{filteredContacts.map(contact => { const disabled = contact.status === 'skipped'; const checked = selectedIds.has(contact.id); return <button key={contact.id} type="button" disabled={disabled} onClick={() => toggleContact(contact)} className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-55"><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${checked ? 'border-[var(--primary)] bg-[var(--primary)] text-white' : 'border-[var(--border)]'}`}>{checked && <Check className="h-3.5 w-3.5" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{contact.patient_name}</span><span className="mt-0.5 block truncate text-[10px] text-[var(--text-muted)]">{contact.phone || 'Sem telefone'} · {contact.opportunity_title}</span>{contact.reason && <span className="mt-1 block text-[10px] text-amber-700 dark:text-amber-300">{contact.reason}</span>}</span>{contact.status === 'ready' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <CircleAlert className="h-4 w-4 text-amber-500" />}</button>; })}</div><footer className="flex items-center justify-between border-t border-[var(--border)] p-4"><span className="text-xs text-[var(--text-muted)]">{selectedIds.size} de {preview.recipients.totalCards}</span><button onClick={() => setSelectionOpen(false)} className="rounded-xl bg-[var(--primary)] px-4 py-2.5 text-xs font-bold text-white">Aplicar seleção</button></footer></section></div>}

    {report && <div className="fixed inset-0 z-50 flex items-end bg-slate-950/40 sm:items-center sm:justify-center sm:p-6"><section className="flex max-h-[88dvh] w-full max-w-3xl flex-col rounded-t-2xl bg-[var(--surface)] sm:rounded-2xl"><header className="flex items-center justify-between border-b border-[var(--border)] p-4"><div><p className="text-[11px] font-semibold text-[var(--primary)]">Relatório da campanha</p><h2 className="font-bold">{report.campaign.name}</h2></div><button onClick={() => setReport(null)} className="rounded-lg p-2 hover:bg-[var(--surface-hover)]"><X className="h-5 w-5" /></button></header><div className="custom-scrollbar overflow-y-auto p-3">{report.recipients.map(recipient => <div key={recipient.id} className="flex gap-3 rounded-xl px-3 py-3 hover:bg-[var(--surface-hover)]">{recipient.status === 'sent' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <CircleAlert className="h-4 w-4 text-amber-500" />}<div className="min-w-0"><p className="truncate text-xs font-semibold">{recipient.patient_name}</p><p className="text-[10px] text-[var(--text-muted)]">{recipient.phone || 'Sem telefone'} · {recipient.status}</p>{recipient.error_message && <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-300">{recipient.error_message}</p>}</div></div>)}</div></section></div>}
  </div>;
};
