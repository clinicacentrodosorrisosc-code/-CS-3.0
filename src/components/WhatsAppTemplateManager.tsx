import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, FileText, Image, Loader2, Plus, RefreshCw, Send, Trash2, Video } from 'lucide-react';
import { supabase } from '../supabaseClient';

type TemplateComponent = {
  type: string;
  format?: string;
  text?: string;
  buttons?: Array<{ type: string; text?: string; url?: string; phone_number?: string }>;
};

type Template = {
  id?: string;
  name: string;
  language: string;
  category: string;
  status: string;
  rejected_reason?: string | null;
  components?: TemplateComponent[];
};

type ButtonDraft = { type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'; text: string; url: string; phoneNumber: string; example: string };
type HeaderType = 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';

const emptyButton = (): ButtonDraft => ({ type: 'QUICK_REPLY', text: '', url: '', phoneNumber: '', example: '' });
const variablePositions = (value: string) => [...new Set(Array.from(value.matchAll(/\{\{(\d+)\}\}/g), match => Number(match[1])))].sort((a, b) => a - b);

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sessão expirada. Entre novamente.');
  return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };
}

const statusStyle: Record<string, string> = {
  APPROVED: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300',
  PENDING: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300',
  REJECTED: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300',
  PAUSED: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300',
  DISABLED: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300',
};

const statusLabel: Record<string, string> = { APPROVED: 'Aprovado', PENDING: 'Em análise', REJECTED: 'Reprovado', PAUSED: 'Pausado', DISABLED: 'Desativado' };

export const WhatsAppTemplateManager: React.FC<{ onTemplatesChanged?: () => void }> = ({ onTemplatesChanged }) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('MARKETING');
  const [language, setLanguage] = useState('pt_BR');
  const [headerType, setHeaderType] = useState<HeaderType>('NONE');
  const [headerText, setHeaderText] = useState('');
  const [headerExamples, setHeaderExamples] = useState<Record<number, string>>({});
  const [mediaHandle, setMediaHandle] = useState('');
  const [mediaName, setMediaName] = useState('');
  const [bodyText, setBodyText] = useState('Olá, {{1}}!');
  const [bodyExamples, setBodyExamples] = useState<Record<number, string>>({ 1: 'Maria' });
  const [footerText, setFooterText] = useState('');
  const [buttons, setButtons] = useState<ButtonDraft[]>([]);

  const loadTemplates = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const response = await fetch('/api/integrations/whatsapp/templates', { headers: await authHeaders() });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Não foi possível consultar os templates na Meta.');
      setTemplates(body.templates || []);
      if (!silent) setNotice('Status sincronizados diretamente com a Meta.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Falha ao consultar templates.');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { void loadTemplates(true); }, [loadTemplates]);
  useEffect(() => {
    if (!templates.some(template => template.status === 'PENDING')) return;
    const timer = window.setInterval(() => void loadTemplates(true), 60_000);
    return () => window.clearInterval(timer);
  }, [loadTemplates, templates]);

  const headerPositions = useMemo(() => variablePositions(headerText), [headerText]);
  const bodyPositions = useMemo(() => variablePositions(bodyText), [bodyText]);
  const previewBody = bodyText.replace(/\{\{(\d+)\}\}/g, (_, position: string) => bodyExamples[Number(position)] || `{{${position}}}`);
  const previewHeader = headerText.replace(/\{\{(\d+)\}\}/g, (_, position: string) => headerExamples[Number(position)] || `{{${position}}}`);

  const updateButton = (index: number, patch: Partial<ButtonDraft>) => setButtons(current => current.map((button, buttonIndex) => buttonIndex === index ? { ...button, ...patch } : button));

  const uploadMedia = async (file?: File) => {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { setNotice('Use um arquivo de até 3 MB para garantir o envio pela API.'); return; }
    setUploading(true); setNotice(''); setMediaHandle('');
    try {
      const dataBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
        reader.readAsDataURL(file);
      });
      const response = await fetch('/api/integrations/whatsapp/templates', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ action: 'upload_media', fileName: file.name, mimeType: file.type, dataBase64 }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'A Meta recusou o arquivo.');
      setMediaHandle(body.handle); setMediaName(file.name); setNotice('Mídia de exemplo enviada para a Meta.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Falha no upload da mídia.'); }
    finally { setUploading(false); }
  };

  const submit = async () => {
    setSubmitting(true); setNotice('');
    try {
      const payload = {
        action: 'create', name, category, language, headerType, headerText,
        headerExamples: headerPositions.map(position => headerExamples[position] || ''),
        mediaHandle, bodyText,
        bodyExamples: bodyPositions.map(position => bodyExamples[position] || ''),
        footerText, buttons,
      };
      const response = await fetch('/api/integrations/whatsapp/templates', { method: 'POST', headers: await authHeaders(), body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'A Meta recusou o template.');
      setNotice(`Template “${name.trim().toLowerCase()}” enviado para análise da Meta.`);
      setName(''); setHeaderType('NONE'); setHeaderText(''); setHeaderExamples({}); setMediaHandle(''); setMediaName(''); setBodyText('Olá, {{1}}!'); setBodyExamples({ 1: 'Maria' }); setFooterText(''); setButtons([]);
      await loadTemplates(true);
      onTemplatesChanged?.();
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Falha ao enviar o template.'); }
    finally { setSubmitting(false); }
  };

  const mediaIcon = headerType === 'VIDEO' ? Video : headerType === 'DOCUMENT' ? FileText : Image;
  const MediaIcon = mediaIcon;

  return <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(380px,0.92fr)]">
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <div><p className="text-[11px] font-semibold text-[var(--primary)]">Novo template oficial</p><h2 className="mt-1 text-lg font-bold">Criar e enviar para aprovação</h2><p className="mt-1 text-xs text-[var(--text-muted)]">Monte a mensagem completa. O envio só fica disponível depois da aprovação da Meta.</p></div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-semibold">Nome interno<input value={name} onChange={event => setName(event.target.value.toLocaleLowerCase('pt-BR').replace(/[^a-z0-9_]/g, '_'))} placeholder="retorno_orcamento" className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 outline-none focus:border-[var(--primary)]" /></label>
        <label className="text-xs font-semibold">Categoria<select value={category} onChange={event => setCategory(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3"><option value="MARKETING">Marketing</option><option value="UTILITY">Utilidade</option></select></label>
        <label className="text-xs font-semibold">Idioma<select value={language} onChange={event => setLanguage(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3"><option value="pt_BR">Português (Brasil)</option><option value="en_US">Inglês (EUA)</option><option value="es">Espanhol</option></select></label>
        <label className="text-xs font-semibold">Cabeçalho<select value={headerType} onChange={event => { setHeaderType(event.target.value as HeaderType); setMediaHandle(''); setMediaName(''); }} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3"><option value="NONE">Sem cabeçalho</option><option value="TEXT">Texto</option><option value="IMAGE">Imagem</option><option value="VIDEO">Vídeo</option><option value="DOCUMENT">Documento</option></select></label>
      </div>

      {headerType === 'TEXT' && <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] p-4"><label className="text-xs font-semibold">Texto do cabeçalho<input value={headerText} onChange={event => setHeaderText(event.target.value)} maxLength={60} placeholder="Uma condição especial para {{1}}" className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 outline-none focus:border-[var(--primary)]" /></label>{headerPositions.map(position => <label key={position} className="mt-3 block text-[10px] font-semibold">Exemplo para {`{{${position}}}`}<input value={headerExamples[position] || ''} onChange={event => setHeaderExamples(current => ({ ...current, [position]: event.target.value }))} className="mt-1 h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 outline-none" /></label>)}</div>}

      {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType) && <div className="mt-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-subtle)] p-4"><label className="flex cursor-pointer items-center gap-3"><span className="rounded-xl bg-[var(--surface)] p-2.5 text-[var(--primary)]"><MediaIcon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{mediaName || `Selecionar ${headerType === 'IMAGE' ? 'imagem' : headerType === 'VIDEO' ? 'vídeo' : 'documento'} de exemplo`}</span><span className="mt-0.5 block text-[10px] text-[var(--text-muted)]">JPG, PNG, MP4 ou PDF · até 3 MB</span></span>{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : mediaHandle && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}<input type="file" accept={headerType === 'IMAGE' ? 'image/jpeg,image/png' : headerType === 'VIDEO' ? 'video/mp4' : 'application/pdf'} className="hidden" onChange={event => void uploadMedia(event.target.files?.[0])} /></label></div>}

      <label className="mt-4 block text-xs font-semibold">Corpo da mensagem<textarea value={bodyText} onChange={event => setBodyText(event.target.value)} maxLength={1024} rows={6} placeholder="Olá, {{1}}! Temos uma novidade para você." className="mt-1.5 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] p-3 leading-5 outline-none focus:border-[var(--primary)]" /><span className="mt-1 block text-right text-[9px] font-normal text-[var(--text-muted)]">{bodyText.length}/1024 · use {`{{1}}, {{2}}...`} para variáveis</span></label>
      {bodyPositions.length > 0 && <div className="mt-3 grid gap-3 sm:grid-cols-2">{bodyPositions.map(position => <label key={position} className="text-[10px] font-semibold">Exemplo para {`{{${position}}}`}<input value={bodyExamples[position] || ''} onChange={event => setBodyExamples(current => ({ ...current, [position]: event.target.value }))} placeholder={position === 1 ? 'Maria' : 'Exemplo'} className="mt-1 h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-3 outline-none" /></label>)}</div>}
      <label className="mt-4 block text-xs font-semibold">Rodapé opcional<input value={footerText} onChange={event => setFooterText(event.target.value)} maxLength={60} placeholder="Centro do Sorriso" className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 outline-none focus:border-[var(--primary)]" /></label>

      <div className="mt-5 rounded-xl border border-[var(--border)] p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-bold">Botões</p><p className="mt-0.5 text-[10px] text-[var(--text-muted)]">Resposta rápida, site ou ligação.</p></div><button type="button" disabled={buttons.length >= 3} onClick={() => setButtons(current => [...current, emptyButton()])} className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-[10px] font-bold disabled:opacity-40"><Plus className="h-3.5 w-3.5" />Adicionar</button></div>
        <div className="mt-3 space-y-3">{buttons.map((button, index) => <div key={index} className="grid gap-2 rounded-xl bg-[var(--bg-subtle)] p-3 sm:grid-cols-[140px_minmax(0,1fr)_36px]"><select value={button.type} onChange={event => updateButton(index, { type: event.target.value as ButtonDraft['type'] })} className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-[10px]"><option value="QUICK_REPLY">Resposta rápida</option><option value="URL">Abrir site</option><option value="PHONE_NUMBER">Ligar</option></select><div className="grid gap-2 sm:grid-cols-2"><input value={button.text} onChange={event => updateButton(index, { text: event.target.value })} maxLength={25} placeholder="Texto do botão" className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[10px] outline-none" />{button.type === 'URL' && <input value={button.url} onChange={event => updateButton(index, { url: event.target.value })} placeholder="https://seusite.com" className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[10px] outline-none" />}{button.type === 'PHONE_NUMBER' && <input value={button.phoneNumber} onChange={event => updateButton(index, { phoneNumber: event.target.value })} placeholder="+5531999999999" className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[10px] outline-none" />}</div><button type="button" onClick={() => setButtons(current => current.filter((_, buttonIndex) => buttonIndex !== index))} className="flex h-9 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button></div>)}{!buttons.length && <p className="py-3 text-center text-[10px] text-[var(--text-muted)]">Nenhum botão adicionado.</p>}</div>
      </div>

      {notice && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">{notice}</p>}
      <button type="button" onClick={() => void submit()} disabled={submitting || uploading || !name.trim() || !bodyText.trim() || (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType) && !mediaHandle)} className="mt-5 flex h-11 items-center gap-2 rounded-xl bg-[var(--primary)] px-5 text-sm font-bold text-white disabled:opacity-50">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{submitting ? 'Enviando...' : 'Enviar para aprovação na Meta'}</button>
    </section>

    <aside className="space-y-5">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm"><p className="text-[11px] font-semibold text-[var(--primary)]">Prévia</p><div className="mt-3 rounded-2xl bg-[#e9edef] p-3 dark:bg-slate-900"><div className="overflow-hidden rounded-xl rounded-tl-sm bg-white shadow-sm dark:bg-[var(--surface)]">{headerType !== 'NONE' && <div className="flex min-h-24 items-center justify-center bg-slate-100 text-slate-400 dark:bg-white/5">{headerType === 'TEXT' ? <p className="px-4 text-center text-sm font-bold text-[var(--text)]">{previewHeader || 'Cabeçalho'}</p> : <><MediaIcon className="h-8 w-8" /><span className="ml-2 text-xs">{mediaName || headerType.toLocaleLowerCase('pt-BR')}</span></>}</div>}<div className="p-3.5"><p className="whitespace-pre-wrap text-xs leading-5 text-[var(--text)]">{previewBody || 'Corpo da mensagem'}</p>{footerText && <p className="mt-2 text-[10px] text-[var(--text-muted)]">{footerText}</p>}</div>{buttons.length > 0 && <div className="border-t border-[var(--border)]">{buttons.map((button, index) => <div key={index} className="border-b border-[var(--border-subtle)] px-3 py-2.5 text-center text-xs font-semibold text-sky-600 last:border-b-0">{button.text || 'Botão'}</div>)}</div>}</div></div></section>
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="font-bold">Templates na Meta</h2><p className="mt-1 text-xs text-[var(--text-muted)]">Status oficial sincronizado.</p></div><button onClick={() => void loadTemplates()} disabled={refreshing} title="Atualizar status" className="rounded-xl border border-[var(--border)] p-2.5 hover:bg-[var(--surface-hover)] disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /></button></div>
        <div className="mt-4 max-h-[600px] space-y-2 overflow-y-auto">{loading ? <p className="py-10 text-center text-xs text-[var(--text-muted)]">Consultando a Meta...</p> : templates.length ? templates.map(template => { const status = template.status || 'PENDING'; const body = template.components?.find(component => component.type === 'BODY')?.text || ''; return <article key={`${template.name}-${template.language}`} className="rounded-xl border border-[var(--border)] p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-bold">{template.name}</p><p className="mt-1 text-[9px] uppercase tracking-wide text-[var(--text-muted)]">{template.category} · {template.language}</p></div><span className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-bold ${statusStyle[status] || statusStyle.DISABLED}`}>{status === 'APPROVED' ? <CheckCircle2 className="mr-1 inline h-3 w-3" /> : status === 'PENDING' ? <Clock3 className="mr-1 inline h-3 w-3" /> : <AlertCircle className="mr-1 inline h-3 w-3" />}{statusLabel[status] || status}</span></div>{body && <p className="mt-2 line-clamp-2 text-[10px] leading-4 text-[var(--text-secondary)]">{body}</p>}{template.rejected_reason && <p className="mt-2 rounded-lg bg-rose-500/10 px-2.5 py-2 text-[10px] text-rose-700 dark:text-rose-300">Motivo: {template.rejected_reason}</p>}</article>; }) : <p className="py-10 text-center text-xs text-[var(--text-muted)]">Nenhum template encontrado na conta.</p>}</div>
      </section>
    </aside>
  </div>;
};
