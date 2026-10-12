import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import {
  FilterBar,
  IconButton,
  PageHeader,
  Panel,
  StatePanel,
  StatusBadge,
} from './ui/operational-ui';

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
  INSERT: 'Criou',
  UPDATE: 'Alterou',
  DELETE: 'Excluiu',
  LOGIN: 'Entrou',
  LOGOUT: 'Saiu',
  VIEW: 'Acessou',
};

const actionTone: Record<string, 'primary' | 'success' | 'danger' | 'info' | 'neutral'> = {
  INSERT: 'success',
  UPDATE: 'primary',
  DELETE: 'danger',
  LOGIN: 'info',
  LOGOUT: 'neutral',
  VIEW: 'neutral',
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium',
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

    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (action !== 'ALL') query = query.eq('action', action);
    if (module !== 'ALL') query = query.eq('module', module);
    if (startDate) query = query.gte('created_at', `${startDate}T00:00:00`);
    if (endDate) query = query.lte('created_at', `${endDate}T23:59:59.999`);
    if (search.trim()) {
      const term = search.trim().replace(/[,%()]/g, ' ');
      query = query.or(
        `user_email.ilike.%${term}%,description.ilike.%${term}%,record_id.ilike.%${term}%`,
      );
    }

    const from = page * PAGE_SIZE;
    const { data, error: queryError } = await query.range(from, from + PAGE_SIZE);
    if (queryError) setError(queryError.message);

    const rows = (data || []) as AuditEntry[];
    setHasNextPage(rows.length > PAGE_SIZE);
    setEntries(rows.slice(0, PAGE_SIZE));
    setLoading(false);
  }, [action, endDate, module, page, search, startDate]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    setPage(0);
  }, [action, endDate, module, search, startDate]);

  const modules = useMemo(
    () => [...new Set(entries.map(item => item.module))].sort(),
    [entries],
  );

  return (
    <div className="h-full overflow-y-auto bg-[var(--background)] p-4 md:p-6">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <PageHeader
          title="Auditoria do sistema"
          description="Veja quem acessou, criou, alterou ou excluiu informações."
          icon={ShieldCheck}
          actions={
            <button
              type="button"
              onClick={() => void loadEntries()}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold hover:bg-[var(--surface-hover)]"
            >
              <RefreshCw
                className={`size-4 ${loading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              Atualizar
            </button>
          }
        />

        <FilterBar className="grid md:grid-cols-2 xl:grid-cols-5">
          <label className="relative xl:col-span-2">
            <span className="sr-only">Buscar na auditoria</span>
            <Search
              className="pointer-events-none absolute left-3 top-3 size-4 text-[var(--text-muted)]"
              aria-hidden="true"
            />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Buscar usuário, descrição ou registro"
              className="h-10 w-full pl-9 pr-3"
            />
          </label>
          <label>
            <span className="sr-only">Filtrar por ação</span>
            <select
              value={action}
              onChange={event => setAction(event.target.value)}
              className="h-10 w-full px-3"
            >
              <option value="ALL">Todas as ações</option>
              {Object.entries(actionLabel).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Filtrar por módulo</span>
            <select
              value={module}
              onChange={event => setModule(event.target.value)}
              className="h-10 w-full px-3"
            >
              <option value="ALL">Todos os módulos</option>
              {modules.map(value => <option key={value}>{value}</option>)}
            </select>
          </label>
          <div className="flex gap-2">
            <input
              type="date"
              aria-label="Data inicial"
              value={startDate}
              onChange={event => setStartDate(event.target.value)}
              className="h-10 min-w-0 flex-1 px-2 text-xs"
            />
            <input
              type="date"
              aria-label="Data final"
              value={endDate}
              onChange={event => setEndDate(event.target.value)}
              className="h-10 min-w-0 flex-1 px-2 text-xs"
            />
          </div>
        </FilterBar>

        <Panel className="overflow-hidden">
          {error ? (
            <StatePanel
              kind="error"
              description={`Não foi possível carregar a auditoria: ${error}`}
            />
          ) : loading ? (
            <StatePanel kind="loading" description="Buscando o histórico mais recente." />
          ) : entries.length === 0 ? (
            <StatePanel
              kind="empty"
              title="Nenhum evento encontrado"
              description="Ajuste os filtros ou aguarde novas atividades."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b border-[var(--border)]">
                  <tr>
                    <th className="px-4 py-3">Data e hora</th>
                    <th className="px-4 py-3">Usuário</th>
                    <th className="px-4 py-3">Ação</th>
                    <th className="px-4 py-3">Módulo</th>
                    <th className="px-4 py-3">Atividade</th>
                    <th className="px-4 py-3 text-right">Detalhes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {entries.map(item => (
                    <tr key={item.id}>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--text-secondary)]">
                        <CalendarDays className="mr-1.5 inline size-3.5" aria-hidden="true" />
                        {formatDateTime(item.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <UserRound className="size-4 text-[var(--text-muted)]" aria-hidden="true" />
                          <span className="max-w-[210px] truncate font-medium">
                            {item.user_email || 'Sistema/Integração'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={actionTone[item.action] || 'neutral'}>
                          {actionLabel[item.action] || item.action}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{item.module}</td>
                      <td className="max-w-[430px] truncate px-4 py-3">{item.description}</td>
                      <td className="px-4 py-3 text-right">
                        <IconButton
                          label="Ver detalhes"
                          icon={Eye}
                          tone="primary"
                          onClick={() => setSelected(item)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <footer className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3 text-xs text-[var(--text-secondary)]">
            <span>Página {page + 1}</span>
            <div className="flex gap-2">
              <IconButton
                label="Página anterior"
                icon={ChevronLeft}
                disabled={page === 0}
                onClick={() => setPage(value => value - 1)}
              />
              <IconButton
                label="Próxima página"
                icon={ChevronRight}
                disabled={!hasNextPage}
                onClick={() => setPage(value => value + 1)}
              />
            </div>
          </footer>
        </Panel>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4"
          onClick={() => setSelected(null)}
          role="presentation"
        >
          <section
            className="modal-panel max-h-[85vh] w-full max-w-3xl overflow-y-auto p-5"
            onClick={event => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="audit-detail-title"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="audit-detail-title" className="text-lg font-bold">Detalhes da atividade</h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  {formatDateTime(selected.created_at)} · {selected.user_email || 'Sistema/Integração'}
                </p>
              </div>
              <IconButton label="Fechar detalhes" icon={X} onClick={() => setSelected(null)} />
            </div>
            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs font-bold text-[var(--text-muted)]">Ação</dt><dd>{actionLabel[selected.action] || selected.action}</dd></div>
              <div><dt className="text-xs font-bold text-[var(--text-muted)]">Módulo</dt><dd>{selected.module}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs font-bold text-[var(--text-muted)]">Descrição</dt><dd>{selected.description}</dd></div>
              {selected.record_id && <div><dt className="text-xs font-bold text-[var(--text-muted)]">Registro</dt><dd className="break-all">{selected.record_id}</dd></div>}
            </dl>
            {(selected.old_data || selected.new_data || selected.metadata) && (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {selected.old_data && <pre className="overflow-auto rounded-lg bg-[var(--background)] p-3 text-xs"><strong>Antes</strong>{'\n'}{JSON.stringify(selected.old_data, null, 2)}</pre>}
                {selected.new_data && <pre className="overflow-auto rounded-lg bg-[var(--background)] p-3 text-xs"><strong>Depois</strong>{'\n'}{JSON.stringify(selected.new_data, null, 2)}</pre>}
                {selected.metadata && Object.keys(selected.metadata).length > 0 && <pre className="overflow-auto rounded-lg bg-[var(--background)] p-3 text-xs"><strong>Informações adicionais</strong>{'\n'}{JSON.stringify(selected.metadata, null, 2)}</pre>}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default AuditLog;
