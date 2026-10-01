import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, CalendarDays, ChevronLeft, ChevronRight, Eye, RefreshCw, Search, ShieldCheck, UserRound } from 'lucide-react';
import { supabase } from '../supabaseClient';

type AuditEntry = {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  module: string;
  description: string;
  table_name: string | null;
  record_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const PAGE_SIZE = 30;
const actionLabel: Record<string, string> = {
  INSERT: 'Criou', UPDATE: 'Alterou', DELETE: 'Excluiu', LOGIN: 'Entrou', LOGOUT: 'Saiu', VIEW: 'Acessou',
};

const formatDateTime = (value: string) => new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short', timeStyle: 'medium',
}).format(new Date(value));

const AuditLog: React.FC = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('ALL');
  const [module, setModule] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [selected, setSelected] = useState<AuditEntry | null>(null);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError('');
    let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false });
    if (action !== 'ALL') query = query.eq('action', action);
    if (module !== 'ALL') query = query.eq('module', module);
    if (startDate) query = query.gte('created_at', `${startDate}T00:00:00`);
    if (endDate) query = query.lte('created_at', `${endDate}T23:59:59.999`);
    if (search.trim()) {
      const term = search.trim().replace(/[,%()]/g, ' ');
      query = query.or(`user_email.ilike.%${term}%,description.ilike.%${term}%,record_id.ilike.%${term}%`);
    }
    const from = page * PAGE_SIZE;
    const { data, error: queryError } = await query.range(from, from + PAGE_SIZE);
    if (queryError) setError(queryError.message);
    const rows = (data || []) as AuditEntry[];
    setHasNextPage(rows.length > PAGE_SIZE);
    setEntries(rows.slice(0, PAGE_SIZE));
    setLoading(false);
  }, [action, endDate, module, page, search, startDate]);

  useEffect(() => { void loadEntries(); }, [loadEntries]);
  useEffect(() => { setPage(0); }, [action, endDate, module, search, startDate]);

  const modules = useMemo(() => [...new Set(entries.map(item => item.module))].sort(), [entries]);

  return (
    <div className="h-full overflow-y-auto bg-[var(--background)] p-4 md:p-6">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <header className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2 text-[var(--primary)]"><ShieldCheck className="h-5 w-5" /><span className="text-xs font-bold uppercase tracking-[0.16em]">Seguranca e rastreabilidade</span></div>
            <h1 className="mt-1 text-2xl font-bold text-[var(--text)]">Auditoria do sistema</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Veja quem acessou, criou, alterou ou excluiu informacoes.</p>
          </div>
          <button type="button" onClick={() => void loadEntries()} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--text)] hover:bg-[var(--surface-hover)]">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </button>
        </header>

        <section className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="relative xl:col-span-2"><Search className="absolute left-3 top-3 h-4 w-4 text-[var(--text-muted)]" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar usuario, descricao ou registro" className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] pl-9 pr-3 text-sm outline-none focus:border-[var(--primary)]" /></label>
          <select value={action} onChange={e => setAction(e.target.value)} className="h-10 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 text-sm"><option value="ALL">Todas as acoes</option>{Object.entries(actionLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <select value={module} onChange={e => setModule(e.target.value)} className="h-10 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 text-sm"><option value="ALL">Todos os modulos</option>{modules.map(value => <option key={value}>{value}</option>)}</select>
          <div className="flex gap-2"><input type="date" aria-label="Data inicial" value={startDate} onChange={e => setStartDate(e.target.value)} className="min-w-0 h-10 flex-1 rounded-xl border border-[var(--border)] bg-[var(--background)] px-2 text-xs" /><input type="date" aria-label="Data final" value={endDate} onChange={e => setEndDate(e.target.value)} className="min-w-0 h-10 flex-1 rounded-xl border border-[var(--border)] bg-[var(--background)] px-2 text-xs" /></div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          {error ? <div className="p-8 text-center text-sm text-red-500">Nao foi possivel carregar a auditoria: {error}</div> : loading ? <div className="p-12 text-center text-sm text-[var(--text-secondary)]">Carregando historico...</div> : entries.length === 0 ? <div className="p-12 text-center"><Activity className="mx-auto mb-3 h-8 w-8 text-[var(--text-muted)]" /><p className="font-semibold">Nenhum evento encontrado</p><p className="text-sm text-[var(--text-secondary)]">Ajuste os filtros ou aguarde novas atividades.</p></div> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b border-[var(--border)] bg-[var(--surface-hover)] text-xs uppercase tracking-wide text-[var(--text-muted)]"><tr><th className="px-4 py-3">Data e hora</th><th className="px-4 py-3">Usuario</th><th className="px-4 py-3">Acao</th><th className="px-4 py-3">Modulo</th><th className="px-4 py-3">Atividade</th><th className="px-4 py-3 text-right">Detalhes</th></tr></thead><tbody className="divide-y divide-[var(--border-subtle)]">{entries.map(item => <tr key={item.id} className="hover:bg-[var(--surface-hover)]"><td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--text-secondary)]"><CalendarDays className="mr-1.5 inline h-3.5 w-3.5" />{formatDateTime(item.created_at)}</td><td className="px-4 py-3"><div className="flex items-center gap-2"><UserRound className="h-4 w-4 text-[var(--text-muted)]" /><span className="max-w-[210px] truncate font-medium">{item.user_email || 'Sistema/Integracao'}</span></div></td><td className="px-4 py-3"><span className="rounded-full bg-[var(--primary-dim)] px-2.5 py-1 text-xs font-bold text-[var(--primary)]">{actionLabel[item.action] || item.action}</span></td><td className="px-4 py-3 text-[var(--text-secondary)]">{item.module}</td><td className="max-w-[430px] truncate px-4 py-3">{item.description}</td><td className="px-4 py-3 text-right"><button type="button" onClick={() => setSelected(item)} className="rounded-lg p-2 text-[var(--primary)] hover:bg-[var(--primary-dim)]" title="Ver detalhes"><Eye className="h-4 w-4" /></button></td></tr>)}</tbody></table></div>
          )}
          <footer className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3 text-xs text-[var(--text-secondary)]"><span>Pagina {page + 1}</span><div className="flex gap-2"><button disabled={page === 0} onClick={() => setPage(value => value - 1)} className="rounded-lg border border-[var(--border)] p-2 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button><button disabled={!hasNextPage} onClick={() => setPage(value => value + 1)} className="rounded-lg border border-[var(--border)] p-2 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button></div></footer>
        </section>
      </div>

      {selected && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4" onClick={() => setSelected(null)}><div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-[var(--surface)] p-5 shadow-2xl" onClick={event => event.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-bold">Detalhes da atividade</h2><p className="text-xs text-[var(--text-secondary)]">{formatDateTime(selected.created_at)} · {selected.user_email || 'Sistema/Integracao'}</p></div><button onClick={() => setSelected(null)} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs">Fechar</button></div><dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs font-bold uppercase text-[var(--text-muted)]">Acao</dt><dd>{actionLabel[selected.action] || selected.action}</dd></div><div><dt className="text-xs font-bold uppercase text-[var(--text-muted)]">Modulo</dt><dd>{selected.module}</dd></div><div className="sm:col-span-2"><dt className="text-xs font-bold uppercase text-[var(--text-muted)]">Descricao</dt><dd>{selected.description}</dd></div>{selected.record_id && <div><dt className="text-xs font-bold uppercase text-[var(--text-muted)]">Registro</dt><dd className="break-all">{selected.record_id}</dd></div>}</dl>{(selected.old_data || selected.new_data || selected.metadata) && <div className="mt-5 grid gap-3 md:grid-cols-2">{selected.old_data && <pre className="overflow-auto rounded-xl bg-[var(--background)] p-3 text-xs"><strong>Antes</strong>{'\n'}{JSON.stringify(selected.old_data, null, 2)}</pre>}{selected.new_data && <pre className="overflow-auto rounded-xl bg-[var(--background)] p-3 text-xs"><strong>Depois</strong>{'\n'}{JSON.stringify(selected.new_data, null, 2)}</pre>}{selected.metadata && Object.keys(selected.metadata).length > 0 && <pre className="overflow-auto rounded-xl bg-[var(--background)] p-3 text-xs"><strong>Informacoes adicionais</strong>{'\n'}{JSON.stringify(selected.metadata, null, 2)}</pre>}</div>}</div></div>}
    </div>
  );
};

export default AuditLog;
