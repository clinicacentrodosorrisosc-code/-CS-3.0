import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CircleAlert, Loader2, MessageCircle, Send, Tag, X } from 'lucide-react';
import { supabase } from '../supabaseClient';

type QuickOpportunity = { id: string; pipeline_id: string; stage_id: string; patient_name: string | null; title: string };
type Template = { name: string; language: string; status: string; components?: { type: string; text?: string }[] };
type OpportunitySample = { patient_name: string | null; patient_phone: string | null; seller_name: string | null; title: string; amount_cents: number };
type Preview = { template: { category: string; body: string }; sample: OpportunitySample | null; recipients: { contacts: Array<{ id: string; phone: string; status: 'ready' | 'skipped' | 'needs_confirmation'; reason: string }> }; pricing: { unitPrice: number; estimated: boolean; note: string } };

const variableOptions = [
  { value: 'patient_name', label: 'Nome do paciente' },
  { value: 'patient_phone', label: 'Telefone do paciente' },
  { value: 'seller_name', label: 'Responsável comercial' },
  { value: 'opportunity_title', label: 'Nome da oportunidade' },
  { value: 'amount', label: 'Valor da oportunidade' },
];

const bodyOf = (template?: Template) => template?.components?.find(item => item.type === 'BODY')?.text || '';
const positionsOf = (template?: Template) => Array.from(new Set(Array.from(bodyOf(template).matchAll(/\{\{(\d+)\}\}/g), match => Number(match[1])))).sort((a, b) => a - b);
const defaultMappings = (template?: Template) => {
  const defaults = ['patient_name', 'seller_name', 'opportunity_title', 'amount'];
  return Object.fromEntries(positionsOf(template).map((position, index) => [position, defaults[index] || 'patient_name'])) as Record<number, string>;
};

const brl = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
async function headers() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sessão expirada. Entre novamente.');
  return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };
}

export const WhatsAppQuickSend: React.FC<{ opportunity: QuickOpportunity; onClose: () => void; onSent: () => void }> = ({ opportunity, onClose, onSent }) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateKey, setTemplateKey] = useState('');
  const [successTag, setSuccessTag] = useState('');
  const [variableMappings, setVariableMappings] = useState<Record<number, string>>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/integrations/whatsapp/templates', { headers: await headers() });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        const approved = (body.templates || []).filter((item: Template) => item.status === 'APPROVED');
        setTemplates(approved);
        if (approved[0]) {
          setTemplateKey(`${approved[0].name}::${approved[0].language}`);
          setVariableMappings(defaultMappings(approved[0]));
        }
      } catch (currentError) { setError(currentError instanceof Error ? currentError.message : 'Falha ao carregar templates.'); }
      finally { setLoading(false); }
    })();
  }, []);

  const currentTemplate = templates.find(item => `${item.name}::${item.language}` === templateKey);
  const templateBody = bodyOf(currentTemplate);
  const placeholderNumbers = useMemo(() => positionsOf(currentTemplate), [currentTemplate]);
  const variableMapping = useMemo(() => Object.entries(variableMappings).sort(([a], [b]) => Number(a) - Number(b)).map(([position, key]) => `{{${position}}} = ${key}`).join('\n'), [variableMappings]);
  const missingVariables = placeholderNumbers.filter(position => !variableMappings[position]);

  const sampleValue = (key: string) => {
    const sample = preview?.sample;
    if (!sample) return `[${variableOptions.find(option => option.value === key)?.label || key}]`;
    const values: Record<string, string> = {
      patient_name: sample.patient_name || opportunity.patient_name || 'Paciente sem nome',
      patient_phone: sample.patient_phone || preview?.recipients.contacts[0]?.phone || 'Telefone não informado',
      seller_name: sample.seller_name || 'Responsável não informado',
      opportunity_title: sample.title || opportunity.title || 'Oportunidade',
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
    setVariableMappings(defaultMappings(nextTemplate));
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
    if (!currentTemplate) { setPreview(null); return; }
    const controller = new AbortController();
    void (async () => {
      try {
        setError('');
        const params = new URLSearchParams({ action: 'preview', pipelineId: opportunity.pipeline_id, stageId: opportunity.stage_id, opportunityId: opportunity.id, templateName: currentTemplate.name, language: currentTemplate.language });
        const response = await fetch(`/api/integrations/whatsapp/bulk-campaigns?${params}`, { headers: await headers(), signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        setPreview(body);
      } catch (currentError) { if (!controller.signal.aborted) setError(currentError instanceof Error ? currentError.message : 'Falha na prévia.'); }
    })();
    return () => controller.abort();
  }, [currentTemplate?.name, currentTemplate?.language, opportunity.id, opportunity.pipeline_id, opportunity.stage_id]);

  const contact = preview?.recipients.contacts[0];
  const canSend = contact?.status === 'ready' || contact?.status === 'needs_confirmation';
  const send = async () => {
    if (!currentTemplate || !contact || !canSend) return;
    if (missingVariables.length) { setError('Escolha o conteúdo de todas as variáveis do template antes de enviar.'); return; }
    const useHistory = contact.status === 'needs_confirmation';
    if (useHistory && !window.confirm('Este telefone foi recuperado do histórico. Confirma o uso para este envio?')) return;
    setSending(true); setError('');
    try {
      const requestHeaders = await headers();
      const response = await fetch('/api/integrations/whatsapp/bulk-campaigns', { method: 'POST', headers: requestHeaders, body: JSON.stringify({ name: `Envio rápido - ${opportunity.patient_name || opportunity.title}`, templateName: currentTemplate.name, language: currentTemplate.language, variableMapping, pipelineId: opportunity.pipeline_id, stageId: opportunity.stage_id, useHistoricalPhones: useHistory, selectedOpportunityIds: [opportunity.id], successTag }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      let pending = body.totalRecipients;
      let failed = 0;
      while (pending > 0) {
        const batchResponse = await fetch('/api/integrations/whatsapp/bulk-campaigns', { method: 'POST', headers: requestHeaders, body: JSON.stringify({ action: 'process', campaignId: body.campaignId }) });
        const batchBody = await batchResponse.json();
        if (!batchResponse.ok) throw new Error(batchBody.error);
        pending = batchBody.pending;
        failed += Number(batchBody.failed || 0);
      }
      if (failed > 0) throw new Error('A Meta recusou o envio. Consulte o relatório da campanha para ver o motivo.');
      onSent();
      onClose();
    } catch (currentError) { setError(currentError instanceof Error ? currentError.message : 'Falha no envio rápido.'); }
    finally { setSending(false); }
  };

  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35" onMouseDown={onClose} role="presentation">
    <aside className="custom-scrollbar h-full w-full max-w-md overflow-y-auto border-l border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl" onMouseDown={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Disparo rápido">
      <header className="flex items-start justify-between gap-4"><div><p className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--primary)]"><MessageCircle className="h-3.5 w-3.5" />Disparo rápido</p><h2 className="mt-1 text-xl font-bold tracking-tight">{opportunity.patient_name || opportunity.title}</h2><p className="mt-1 text-xs text-[var(--text-muted)]">Envio individual com template aprovado pela Meta.</p></div><button type="button" onClick={onClose} aria-label="Fechar disparo rápido" className="rounded-lg p-2 transition hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40"><X className="h-5 w-5" /></button></header>
      {error && <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">{error}</p>}
      {loading ? <div className="flex items-center justify-center gap-2 py-16 text-xs text-[var(--text-muted)]"><Loader2 className="h-4 w-4 animate-spin" />Carregando templates</div> : <div className="mt-6 space-y-5">
        <label className="block text-xs font-semibold">Template<select value={templateKey} onChange={event => selectTemplate(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 outline-none">{templates.map(item => <option key={`${item.name}-${item.language}`} value={`${item.name}::${item.language}`}>{item.name} ({item.language})</option>)}</select></label>
        {currentTemplate && <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10"><p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Como ficará a mensagem</p><div className="mt-3 rounded-xl rounded-tl-sm bg-white px-3.5 py-3 shadow-sm dark:bg-[var(--surface)]"><p className="whitespace-pre-wrap text-xs leading-5">{renderedMessage || 'Este template não possui texto no corpo.'}</p></div>{placeholderNumbers.length > 0 ? <div className="mt-4 space-y-3 border-t border-emerald-600/15 pt-4"><p className="text-xs font-bold">Variáveis da mensagem</p>{placeholderNumbers.map(position => <label key={position} className="block text-[10px] font-semibold text-[var(--text-secondary)]"><span className="mb-1 flex items-center justify-between gap-2"><span>{`Variável {{${position}}}`}</span>{variableMappings[position] && <span className="truncate font-normal text-[var(--text-muted)]">{sampleValue(variableMappings[position])}</span>}</span><select value={variableMappings[position] || ''} onChange={event => setVariableMapping(position, event.target.value)} className="h-9 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs outline-none focus:border-[var(--primary)]"><option value="">Escolha o conteúdo</option>{variableOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>)}{missingVariables.length > 0 && <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-300">Defina todas as variáveis para liberar o envio.</p>}</div> : <p className="mt-3 text-[10px] text-[var(--text-muted)]">Este template não possui variáveis no corpo.</p>}</section>}
        {preview && <section className="rounded-2xl bg-[var(--bg-subtle)] p-4"><p className="text-[11px] font-semibold text-[var(--primary)]">Conferência</p><div className="mt-3 flex items-start gap-3">{canSend ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <CircleAlert className="h-5 w-5 text-amber-500" />}<div><p className="text-sm font-semibold">{contact?.phone || 'Telefone não localizado'}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{canSend ? 'Contato pronto para receber' : contact?.reason}</p></div></div><div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-4"><span className="text-xs text-[var(--text-muted)]">Estimativa da Meta</span><strong className="font-mono text-sm">{preview.pricing.estimated ? brl(preview.pricing.unitPrice) : '--'}</strong></div></section>}
        <label className="block text-xs font-semibold"><span className="flex items-center gap-1.5"><Tag className="h-3.5 w-3.5" />Tag após envio</span><input value={successTag} onChange={event => setSuccessTag(event.target.value)} maxLength={40} placeholder="Ex.: Contatado pelo WhatsApp" className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 outline-none focus:border-[var(--primary)]" /></label>
        <button onClick={() => void send()} disabled={!canSend || sending || missingVariables.length > 0} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] text-sm font-bold text-white transition hover:bg-[var(--primary-hover)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-4 w-4" />{sending ? 'Enviando...' : 'Enviar agora'}</button>
      </div>}
    </aside>
  </div>;
};
