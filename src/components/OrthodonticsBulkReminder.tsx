import React, { useEffect, useMemo, useState } from 'react';
import { Check, CheckCircle2, CircleAlert, MessageCircle, Search, Send, X } from 'lucide-react';
import { supabase } from '../supabaseClient';

type TemplateButton = { type?: string; text?: string };
type TemplateComponent = { type: string; text?: string; buttons?: TemplateButton[] };
type Template = { name: string; language: string; status: string; components?: TemplateComponent[] };
type Contact = { id: string; patient_name: string; opportunity_title: string; phone: string; status: 'ready' | 'skipped'; reason?: string };
type Preview = { template: { body: string; category: string }; sample: { patient_name?: string; patient_phone?: string; title?: string; amount_cents?: number } | null; recipients: { totalCards: number; eligible: number; skippedInvalid: number; skippedDuplicate: number; contacts: Contact[] }; pricing: { unitPrice: number; total: number; estimated: boolean; note: string } };
type Campaign = { id: string; name: string; sent_count: number; failed_count: number; total_recipients: number; status: string; created_at: string };
type Recipient = { id: string; patient_name: string; phone: string; status: string; error_message?: string | null };
type ConnectionStatus = { active: boolean; checkedAt: string; phone?: { displayName?: string | null; displayNumber?: string | null; qualityRating?: string | null }; hasWabaId?: boolean };

const variableOptions = [
  { value: 'patient_name', label: 'Nome do paciente' },
  { value: 'patient_phone', label: 'Telefone do paciente' },
  { value: 'amount', label: 'Valor da mensalidade' },
  { value: 'opportunity_title', label: 'Descrição da cobrança' },
];

const brl = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sessão expirada. Entre novamente.');
  return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };
}

interface OrthodonticsBulkReminderProps {
  paymentMonth: string;
  onClose: () => void;
  onSent: () => void | Promise<void>;
}

export const OrthodonticsBulkReminder: React.FC<OrthodonticsBulkReminderProps> = ({ paymentMonth, onClose, onSent }) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templateKey, setTemplateKey] = useState('');
  const [name, setName] = useState(`Lembrete ortodontia ${paymentMonth.split('-').reverse().join('/')}`);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [copyCode, setCopyCode] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const [connection, setConnection] = useState<ConnectionStatus | null>(null);
  const [connectionError, setConnectionError] = useState('');
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [report, setReport] = useState<{ campaign: Campaign; recipients: Recipient[] } | null>(null);

  const currentTemplate = templates.find(item => `${item.name}::${item.language}` === templateKey);
  const templateBody = currentTemplate?.components?.find(item => item.type === 'BODY')?.text || '';
  const copyCodeButtons = useMemo(() => (currentTemplate?.components || [])
    .find(item => item.type === 'BUTTONS')?.buttons
    ?.map((button, index) => ({ ...button, index }))
    .filter(button => button.type?.toUpperCase() === 'COPY_CODE') || [], [currentTemplate]);
  const requiresCopyCode = copyCodeButtons.length > 0;
  const positions = useMemo(() => Array.from(new Set(Array.from(templateBody.matchAll(/\{\{(\d+)\}\}/g), match => Number(match[1])))).sort((a, b) => a - b), [templateBody]);
  const missingVariables = positions.filter(position => !mapping[position]);
  const variableMapping = [
    ...Object.entries(mapping).sort(([a], [b]) => Number(a) - Number(b)).map(([position, key]) => `{{${position}}} = ${key}`),
    ...copyCodeButtons.map(button => `__copy_code_${button.index} = ${copyCode.trim()}`),
  ].join('\n');

  const checkConnection = async () => {
    setCheckingConnection(true);
    setConnectionError('');
    try {
      const response = await fetch('/api/integrations/whatsapp/config?check=connection', { headers: await authHeaders() });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Nao foi possivel verificar a conexao do WhatsApp.');
      setConnection(body);
    } catch (error) {
      setConnection(null);
      setConnectionError(error instanceof Error ? error.message : 'Nao foi possivel verificar a conexao do WhatsApp.');
    } finally {
      setCheckingConnection(false);
    }
  };

  const loadBase = async () => {
    const headers = await authHeaders();
    const [templateResponse, campaignResponse] = await Promise.all([
      fetch('/api/integrations/whatsapp/templates', { headers }),
      fetch('/api/integrations/whatsapp/bulk-campaigns?source=orthodontics', { headers }),
    ]);
    const templateBodyResult = await templateResponse.json();
    const campaignBody = await campaignResponse.json();
    if (!templateResponse.ok || !campaignResponse.ok) throw new Error(templateBodyResult.error || campaignBody.error || 'Não foi possível carregar o WhatsApp.');
    setTemplates((templateBodyResult.templates || []).filter((item: Template) => item.status === 'APPROVED'));
    setCampaigns(campaignBody.campaigns || []);
  };

  useEffect(() => {
    void Promise.all([
      loadBase().catch(error => setNotice(error.message)),
      checkConnection(),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!currentTemplate) { setPreview(null); setSelectedIds(new Set()); setCopyCode(''); return; }
    const controller = new AbortController();
    void (async () => {
      try {
        const params = new URLSearchParams({ action: 'preview', source: 'orthodontics', paymentMonth, templateName: currentTemplate.name, language: currentTemplate.language });
        const response = await fetch(`/api/integrations/whatsapp/bulk-campaigns?${params}`, { headers: await authHeaders(), signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Não foi possível preparar os pacientes.');
        setPreview(body);
        setSelectedIds(new Set((body.recipients.contacts as Contact[]).filter(contact => contact.status === 'ready').map(contact => contact.id)));
        setNotice('');
      } catch (error) {
        if (!controller.signal.aborted) setNotice(error instanceof Error ? error.message : 'Não foi possível preparar os pacientes.');
      }
    })();
    return () => controller.abort();
  }, [currentTemplate, paymentMonth]);

  const selectTemplate = (key: string) => {
    setTemplateKey(key);
    const selected = templates.find(item => `${item.name}::${item.language}` === key);
    const body = selected?.components?.find(item => item.type === 'BODY')?.text || '';
    const nextPositions = Array.from(new Set(Array.from(body.matchAll(/\{\{(\d+)\}\}/g), match => Number(match[1])))).sort((a, b) => a - b);
    const defaults = ['patient_name', 'amount', 'opportunity_title'];
    setMapping(Object.fromEntries(nextPositions.map((position, index) => [position, defaults[index] || 'patient_name'])));
    setCopyCode('');
  };

  const sampleValue = (key: string) => {
    const sample = preview?.sample;
    const values: Record<string, string> = {
      patient_name: sample?.patient_name || 'Paciente',
      patient_phone: sample?.patient_phone || 'Telefone cadastrado',
      amount: brl(Number(sample?.amount_cents || 0) / 100),
      opportunity_title: 'Mensalidade de ortodontia',
    };
    return values[key] || `[${key}]`;
  };

  const renderedMessage = templateBody.replace(/\{\{(\d+)\}\}/g, (_, raw: string) => mapping[Number(raw)] ? sampleValue(mapping[Number(raw)]) : `{{${raw}}}`);
  const visibleContacts = (preview?.recipients.contacts || []).filter(contact => !search.trim() || [contact.patient_name, contact.phone].some(value => value.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR'))));
  const readyContactIds = useMemo(() => (preview?.recipients.contacts || []).filter(contact => contact.status === 'ready').map(contact => contact.id), [preview]);
  const allReadySelected = readyContactIds.length > 0 && readyContactIds.every(id => selectedIds.has(id));
  const toggleAll = () => setSelectedIds(() => allReadySelected ? new Set() : new Set(readyContactIds));

  const send = async () => {
    if (!currentTemplate || !name.trim() || !selectedIds.size || missingVariables.length || (requiresCopyCode && !copyCode.trim())) return;
    if (!window.confirm(`Enviar lembrete para ${selectedIds.size} paciente(s) de ortodontia?`)) return;
    setSending(true); setNotice('');
    try {
      const headers = await authHeaders();
      const response = await fetch('/api/integrations/whatsapp/bulk-campaigns', { method: 'POST', headers, body: JSON.stringify({ source: 'orthodontics', paymentMonth, name: name.trim(), templateName: currentTemplate.name, language: currentTemplate.language, variableMapping, selectedPatientIds: Array.from(selectedIds) }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Falha ao criar campanha.');
      let pending = Number(body.totalRecipients || 0); let failed = 0;
      while (pending > 0) {
        const batchResponse = await fetch('/api/integrations/whatsapp/bulk-campaigns', { method: 'POST', headers, body: JSON.stringify({ action: 'process', campaignId: body.campaignId }) });
        const batchBody = await batchResponse.json();
        if (!batchResponse.ok) throw new Error(batchBody.error || 'Falha ao processar campanha.');
        pending = Number(batchBody.pending || 0); failed += Number(batchBody.failed || 0);
      }
      setNotice(failed ? `Campanha concluída com ${failed} falha(s). Consulte o histórico.` : 'Lembretes enviados e registrados no histórico dos pacientes.');
      await Promise.all([loadBase(), onSent()]);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Falha ao enviar os lembretes.'); }
    finally { setSending(false); }
  };

  const openReport = async (campaign: Campaign) => {
    try {
      const response = await fetch(`/api/integrations/whatsapp/bulk-campaigns?campaignId=${campaign.id}`, { headers: await authHeaders() });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setReport({ campaign: body.campaign, recipients: body.recipients || [] });
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Falha ao abrir o histórico.'); }
  };

  return <div className="fixed inset-0 z-[140] flex items-end justify-center bg-slate-950/55 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}>
    <section role="dialog" aria-modal="true" aria-label="Lembrete de pagamento em massa" className="flex max-h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl sm:rounded-2xl" onMouseDown={event => event.stopPropagation()}>
      <header className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4"><div><p className="text-[11px] font-semibold text-[var(--primary)]">WhatsApp oficial</p><h2 className="mt-1 text-lg font-bold">Lembrete de pagamento da ortodontia</h2><p className="mt-1 text-xs text-[var(--text-muted)]">Somente pacientes ativos sem pagamento registrado em {paymentMonth.split('-').reverse().join('/')}.</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-[var(--surface-hover)]" aria-label="Fechar"><X className="h-5 w-5" /></button></header>
      {notice && <p className="mx-5 mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-700 dark:text-amber-200">{notice}</p>}
      <div className="custom-scrollbar grid min-h-0 flex-1 gap-5 overflow-y-auto p-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <main className="space-y-4">
          <section className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${connection ? 'border-emerald-500/25 bg-emerald-500/10' : connectionError ? 'border-rose-500/25 bg-rose-500/10' : 'border-[var(--border)] bg-[var(--bg-subtle)]'}`}><div><p className="text-xs font-bold">Conexao WhatsApp</p><p className="mt-1 text-[11px] text-[var(--text-muted)]">{connection ? `Ativa na Meta${connection.phone?.displayName ? `: ${connection.phone.displayName}` : ''}${connection.phone?.displayNumber ? ` (${connection.phone.displayNumber})` : ''}.` : connectionError || 'Verificando a conexao oficial...'}</p>{connection && !connection.hasWabaId && <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-300">Informe o WABA ID em Integracoes {'>'} WhatsApp para listar e enviar templates.</p>}</div><button type="button" onClick={() => void checkConnection()} disabled={checkingConnection} className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-semibold hover:bg-[var(--surface-hover)] disabled:opacity-50">{checkingConnection ? 'Verificando...' : 'Verificar conexao'}</button></section>
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">Nome da campanha<input value={name} onChange={event => setName(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-3" /></label><label className="text-xs font-semibold">Template aprovado<select value={templateKey} onChange={event => selectTemplate(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-3"><option value="">Selecione</option>{templates.map(item => <option key={`${item.name}-${item.language}`} value={`${item.name}::${item.language}`}>{item.name} ({item.language})</option>)}</select></label></div>
          {loading && <div className="rounded-xl bg-[var(--bg-subtle)] p-5 text-sm text-[var(--text-muted)]">Carregando templates e pacientes...</div>}
          {currentTemplate && <section className="grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] p-4 md:grid-cols-[minmax(0,1fr)_250px]"><div><p className="text-[11px] font-bold text-[var(--primary)]">Prévia da mensagem</p><div className="mt-3 rounded-xl bg-[var(--surface)] p-3 text-xs leading-5">{renderedMessage || 'Template sem texto no corpo.'}</div></div><div><p className="text-xs font-bold">Variáveis</p><div className="mt-2 space-y-2">{positions.map(position => <label key={position} className="block text-[10px] font-semibold">{`{{${position}}}`}<select value={mapping[position] || ''} onChange={event => setMapping(current => ({ ...current, [position]: event.target.value }))} className="mt-1 h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-xs"><option value="">Selecione</option>{variableOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>)}</div></div></section>}
          {requiresCopyCode && <label className="block rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] p-4 text-xs font-semibold">Código Pix do botão “copiar”<textarea value={copyCode} onChange={event => setCopyCode(event.target.value.replace(/[\r\n]+/g, ''))} placeholder="Cole aqui o código Pix que o paciente copiará" rows={3} className="mt-1.5 w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-xs font-normal" /><span className="mt-1 block text-[10px] font-normal text-[var(--text-muted)]">Este código é enviado no botão do template e fica registrado apenas nesta campanha.</span></label>}
          {preview && <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)]"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] p-4"><div><p className="text-sm font-bold">{selectedIds.size} pacientes selecionados</p><p className="mt-1 text-[10px] text-[var(--text-muted)]">{preview.recipients.totalCards} pendentes · {preview.recipients.skippedInvalid + preview.recipients.skippedDuplicate} sem envio</p></div><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={toggleAll} disabled={!readyContactIds.length} className="h-9 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50">{allReadySelected ? 'Desselecionar todos' : 'Selecionar todos'}</button><label className="flex h-9 min-w-52 items-center gap-2 rounded-lg border border-[var(--border)] px-3"><Search className="h-4 w-4 text-[var(--text-muted)]" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar paciente" className="min-w-0 flex-1 border-0 bg-transparent text-xs outline-none" /></label></div></div><div className="custom-scrollbar max-h-72 overflow-y-auto p-2">{visibleContacts.map(contact => { const disabled = contact.status !== 'ready'; const checked = selectedIds.has(contact.id); return <button key={contact.id} type="button" disabled={disabled} onClick={() => setSelectedIds(current => { const next = new Set(current); if (checked) next.delete(contact.id); else next.add(contact.id); return next; })} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-[var(--surface-hover)] disabled:opacity-50"><span className={`grid size-5 place-items-center rounded border ${checked ? 'border-[var(--primary)] bg-[var(--primary)] text-white' : 'border-[var(--border)]'}`}>{checked && <Check className="h-3 w-3" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{contact.patient_name}</span><span className="block truncate text-[10px] text-[var(--text-muted)]">{contact.phone || contact.reason}</span></span>{disabled ? <CircleAlert className="h-4 w-4 text-amber-500" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}</button>; })}</div></section>}
          <button type="button" disabled={sending || !currentTemplate || !name.trim() || !selectedIds.size || missingVariables.length > 0 || (requiresCopyCode && !copyCode.trim())} onClick={() => void send()} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--primary)] px-5 text-sm font-bold text-white hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-4 w-4" />{sending ? 'Enviando lembretes...' : `Enviar para ${selectedIds.size} pacientes`}</button>
        </main>
        <aside className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] p-4"><div className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-[var(--primary)]" /><h3 className="text-sm font-bold">Histórico de campanhas</h3></div><div className="mt-3 space-y-2">{campaigns.length ? campaigns.map(campaign => <button key={campaign.id} type="button" onClick={() => void openReport(campaign)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-left hover:bg-[var(--surface-hover)]"><span className="block truncate text-xs font-semibold">{campaign.name}</span><span className="mt-1 block text-[10px] text-[var(--text-muted)]">{campaign.sent_count}/{campaign.total_recipients} enviados · ver detalhes</span></button>) : <p className="py-8 text-center text-xs text-[var(--text-muted)]">Nenhum lembrete enviado.</p>}</div></aside>
      </div>
    </section>
    {report && <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/60 p-4" onMouseDown={() => setReport(null)}><section className="flex max-h-[80dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]" onMouseDown={event => event.stopPropagation()}><header className="flex items-center justify-between border-b border-[var(--border)] p-4"><div><p className="text-[11px] text-[var(--primary)]">Relatório</p><h3 className="font-bold">{report.campaign.name}</h3></div><button onClick={() => setReport(null)} className="rounded-lg p-2 hover:bg-[var(--surface-hover)]"><X className="h-5 w-5" /></button></header><div className="custom-scrollbar overflow-y-auto p-3">{report.recipients.map(recipient => <div key={recipient.id} className="flex gap-3 rounded-lg px-3 py-3 hover:bg-[var(--surface-hover)]">{recipient.status === 'sent' ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <CircleAlert className="h-4 w-4 text-amber-500" />}<div><p className="text-xs font-semibold">{recipient.patient_name}</p><p className="text-[10px] text-[var(--text-muted)]">{recipient.phone || 'Sem telefone'} · {recipient.status}</p>{recipient.error_message && <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-300">{recipient.error_message}</p>}</div></div>)}</div></section></div>}
  </div>;
};
