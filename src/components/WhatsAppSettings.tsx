import React, { useEffect, useState } from 'react';
import { CheckCircle2, FileText, KeyRound, Link2, Loader2, MessageCircle, RefreshCw, ShieldCheck, Unplug } from 'lucide-react';
import { supabase } from '../supabaseClient';

type WhatsAppSettingsProps = { requestedSubTab?: string | null };
type MetaTemplate = {
  id: string;
  name: string;
  status: string;
  language: string;
  category: string;
};

async function readApiResponse(response: Response) {
  const raw = await response.text();
  let body: any = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    body = {};
  }
  if (!response.ok) {
    throw new Error(body.error || raw.slice(0, 300) || `Servidor respondeu HTTP ${response.status}.`);
  }
  return body;
}

export const WhatsAppSettings: React.FC<WhatsAppSettingsProps> = () => {
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [twoFactorPin, setTwoFactorPin] = useState('');
  const [connected, setConnected] = useState(false);
  const [phoneLabel, setPhoneLabel] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [wahaSessionName, setWahaSessionName] = useState('');
  const [isConnectingWaha, setIsConnectingWaha] = useState(false);
  const [wahaMessage, setWahaMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [templates, setTemplates] = useState<MetaTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [templatesMessage, setTemplatesMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Sessão expirada.');
        const response = await fetch('/api/integrations/whatsapp/config', { headers: { Authorization: `Bearer ${session.access_token}` } });
        const body = await readApiResponse(response);
        setConnected(Boolean(body.config?.status === 'connected'));
        setPhoneNumberId(body.config?.phone_number_id || '');
        setWabaId(body.config?.waba_id || '');
      } catch (error) {
        setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Falha ao carregar configuração.' });
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada.');
      const response = await fetch('/api/integrations/whatsapp/config', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumberId, wabaId, accessToken, twoFactorPin }),
      });
      const body = await readApiResponse(response);
      setConnected(true);
      setAccessToken('');
      setPhoneLabel(body.phone?.verified_name || body.phone?.display_phone_number || 'Número validado pela Meta');
      setMessage({ type: 'success', text: 'WhatsApp Business conectado e validado pela Meta.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Falha ao conectar WhatsApp.' });
    } finally {
      setIsSaving(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm('Desconectar o WhatsApp Business deste sistema?')) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch('/api/integrations/whatsapp/config', { method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` } });
    setConnected(false);
    setAccessToken('');
    setMessage({ type: 'success', text: 'WhatsApp Business desconectado.' });
  };

  const refreshTemplates = async () => {
    setIsLoadingTemplates(true);
    setTemplatesMessage(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada.');
      const response = await fetch('/api/integrations/whatsapp/templates', { headers: { Authorization: `Bearer ${session.access_token}` } });
      const body = await readApiResponse(response);
      setTemplates(Array.isArray(body.templates) ? body.templates : []);
      setTemplatesMessage({ type: 'success', text: `${body.total || 0} template(s) consultado(s) diretamente na Meta.` });
    } catch (error) {
      setTemplatesMessage({ type: 'error', text: error instanceof Error ? error.message : 'Falha ao atualizar templates.' });
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const connectWaha = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsConnectingWaha(true);
    setWahaMessage(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada.');
      const response = await fetch('/api/integrations/whatsapp/waha', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionName: wahaSessionName }),
      });
      const body = await readApiResponse(response);
      const status = body.session?.status ? ` Estado: ${body.session.status}.` : '';
      setWahaMessage({ type: 'success', text: `Sessão WAHA criada e iniciada.${status} Escaneie o QR Code no painel do WAHA.` });
    } catch (error) {
      setWahaMessage({ type: 'error', text: error instanceof Error ? error.message : 'Falha ao conectar WAHA.' });
    } finally {
      setIsConnectingWaha(false);
    }
  };

  if (isLoading) return <div className="flex flex-1 items-center justify-center gap-2 text-xs text-[var(--text-muted)]"><Loader2 className="h-4 w-4 animate-spin" /> Carregando configuração</div>;

  return (
    <div className="custom-scrollbar flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#1F6F5B] dark:text-[#63B596]"><span className="h-px w-6 bg-current" /> Integrações</div>
            <h1 className="text-2xl font-bold tracking-[-0.03em] text-[var(--text)]">WhatsApp Business API</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Conecte o número oficial da clínica para enviar templates aprovados pela Meta.</p>
          </div>
          <span className={`inline-flex items-center gap-2 self-start rounded-lg border px-3 py-2 text-xs font-semibold sm:self-auto ${connected ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)]'}`}>
            <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-slate-400'}`} /> {connected ? 'Conectado' : 'Não conectado'}
          </span>
        </div>

        {message && <div className={`mb-5 rounded-xl border px-4 py-3 text-xs ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200' : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200'}`}>{message.text}</div>}

        <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
          <form onSubmit={save} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-start gap-3 border-b border-[var(--border)] pb-5"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF5F0] text-[#1F6F5B] dark:bg-[#63B596]/10 dark:text-[#63B596]"><MessageCircle className="h-5 w-5" /></span><div><h2 className="text-sm font-bold text-[var(--text)]">Credenciais da conta</h2><p className="mt-1 text-xs text-[var(--text-muted)]">O token é validado no servidor e nunca é exibido novamente.</p></div></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">Phone Number ID<input required value={phoneNumberId} onChange={event => setPhoneNumberId(event.target.value)} placeholder="Ex.: 123456789012345" className="mt-2 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 text-sm text-[var(--text)] outline-none focus:border-[#1F6F5B]/50" /></label>
              <label className="text-xs font-semibold text-[var(--text-secondary)]">WABA ID <span className="font-normal text-[var(--text-muted)]">(opcional)</span><input value={wabaId} onChange={event => setWabaId(event.target.value)} placeholder="ID da conta WhatsApp Business" className="mt-2 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 text-sm text-[var(--text)] outline-none focus:border-[#1F6F5B]/50" /></label>
              <label className="text-xs font-semibold text-[var(--text-secondary)] sm:col-span-2">Token de acesso permanente<input required type="password" value={accessToken} onChange={event => setAccessToken(event.target.value)} placeholder={connected ? 'Digite o token para validar ou substituir' : 'Cole o token da Meta'} className="mt-2 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 text-sm text-[var(--text)] outline-none focus:border-[#1F6F5B]/50" /></label>
              <label className="text-xs font-semibold text-[var(--text-secondary)] sm:col-span-2">PIN de verificação em duas etapas <span className="font-normal text-[var(--text-muted)]">(opcional)</span><input inputMode="numeric" maxLength={6} value={twoFactorPin} onChange={event => setTwoFactorPin(event.target.value.replace(/\D/g, ''))} placeholder="PIN de 6 dígitos para registrar o número" className="mt-2 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 text-sm text-[var(--text)] outline-none focus:border-[#1F6F5B]/50" /></label>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><p className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]"><ShieldCheck className="h-4 w-4 text-[#1F6F5B]" /> Validação feita diretamente na Graph API</p><div className="flex gap-2">{connected && <button type="button" onClick={disconnect} className="flex h-10 items-center gap-2 rounded-xl border border-rose-200 px-3 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-500/20 dark:hover:bg-rose-500/10"><Unplug className="h-4 w-4" /> Desconectar</button>}<button disabled={isSaving} className="flex h-10 items-center gap-2 rounded-xl bg-[#1F6F5B] px-4 text-xs font-bold text-white transition hover:bg-[#195c4c] disabled:opacity-50">{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} {isSaving ? 'Validando...' : connected ? 'Atualizar conexão' : 'Conectar WhatsApp'}</button></div></div>
          </form>
          <aside className="h-fit rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm"><div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--bg-subtle)] text-[var(--text-secondary)]"><KeyRound className="h-4 w-4" /></div><h2 className="text-sm font-bold text-[var(--text)]">Onde encontrar</h2><p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">No Meta for Developers, abra sua aplicação, vá em WhatsApp → API Setup e copie o Phone Number ID e o token. O WABA ID está na conta do WhatsApp Business.</p>{phoneLabel && <div className="mt-4 rounded-xl bg-[#EAF5F0] px-3 py-2 text-xs font-semibold text-[#1F6F5B] dark:bg-[#63B596]/10 dark:text-[#63B596]"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" /> {phoneLabel}</div>}</aside>
        </div>
        <section className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF5F0] text-[#1F6F5B] dark:bg-[#63B596]/10 dark:text-[#63B596]"><FileText className="h-5 w-5" /></span><div><h2 className="text-sm font-bold text-[var(--text)]">Templates da Meta</h2><p className="mt-1 text-xs text-[var(--text-muted)]">Consulte a Meta para confirmar a conexÃ£o e listar os templates cadastrados nesta conta.</p></div></div>
            <button type="button" onClick={refreshTemplates} disabled={!connected || isLoadingTemplates} className="flex h-10 items-center justify-center gap-2 rounded-xl border border-[#1F6F5B]/30 px-4 text-xs font-bold text-[#1F6F5B] transition hover:bg-[#EAF5F0] disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-[#63B596]/10"><RefreshCw className={`h-4 w-4 ${isLoadingTemplates ? 'animate-spin' : ''}`} />{isLoadingTemplates ? 'Atualizando...' : 'Atualizar templates'}</button>
          </div>
          {!connected && <p className="mt-4 text-xs text-[var(--text-muted)]">Conecte a conta e informe o WABA ID para consultar os templates.</p>}
          {templatesMessage && <div className={`mt-4 rounded-xl border px-4 py-3 text-xs ${templatesMessage.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200' : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200'}`}>{templatesMessage.text}</div>}
          {templates.length > 0 && <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border)]"><div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 border-b border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]"><span>Template</span><span>Status</span><span>Idioma</span></div>{templates.map(template => <div key={template.id || `${template.name}-${template.language}`} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-[var(--border)] px-4 py-3 text-xs last:border-b-0"><div className="min-w-0"><p className="truncate font-semibold text-[var(--text)]">{template.name}</p><p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{template.category || 'Sem categoria'}</p></div><span className="rounded-md bg-[var(--bg-subtle)] px-2 py-1 text-[10px] font-bold text-[var(--text-secondary)]">{template.status}</span><span className="text-[11px] text-[var(--text-secondary)]">{template.language}</span></div>)}</div>}
        </section>
        <form onSubmit={connectWaha} className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-bold text-[var(--text)]">Conexão WAHA</h2><p className="mt-1 text-xs text-[var(--text-muted)]">Alternativa por WhatsApp Web. As credenciais ficam somente no servidor; configure o webhook e escaneie o QR no painel WAHA.</p></div><span className="rounded-lg bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">Canal alternativo</span></div>
          {wahaMessage && <div className={`mt-4 rounded-xl border px-4 py-3 text-xs ${wahaMessage.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200' : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200'}`}>{wahaMessage.text}</div>}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row"><label className="flex-1 text-xs font-semibold text-[var(--text-secondary)]">Nome da sessão<input required value={wahaSessionName} onChange={event => setWahaSessionName(event.target.value)} placeholder="clinica-principal" className="mt-2 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 text-sm text-[var(--text)] outline-none focus:border-[#1F6F5B]/50" /></label><button disabled={isConnectingWaha} className="mt-5 flex h-10 items-center justify-center gap-2 rounded-xl border border-[#1F6F5B]/30 px-4 text-xs font-bold text-[#1F6F5B] transition hover:bg-[#EAF5F0] disabled:opacity-50 sm:mt-6">{isConnectingWaha ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}{isConnectingWaha ? 'Iniciando...' : 'Iniciar sessão WAHA'}</button></div>
        </form>
      </div>
    </div>
  );
};
