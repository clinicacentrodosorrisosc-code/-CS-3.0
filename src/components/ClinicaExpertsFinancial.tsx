import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  CircleAlert,
  FolderTree,
  Landmark,
  ReceiptText,
  RefreshCw,
  WalletCards,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { DateRangePicker } from './ui/date-range-picker';

type FinancialRecord = Record<string, unknown>;
type FinancialData = {
  accounts: FinancialRecord[];
  categories: FinancialRecord[];
  bills: FinancialRecord[];
  parcels: FinancialRecord[];
  fetchedAt: string;
};
type FlowDirection = 'income' | 'expense' | 'unknown';
type View = 'overview' | 'accounts' | 'cashflow';

const recordValue = (record: FinancialRecord, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
};

const textValue = (record: FinancialRecord, keys: string[], fallback = 'Não informado') => {
  const value = recordValue(record, keys);
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object') {
    const namedValue = value as { name?: unknown; description?: unknown; title?: unknown; label?: unknown };
    for (const item of [namedValue.name, namedValue.description, namedValue.title, namedValue.label]) {
      if (typeof item === 'string' && item.trim()) return item;
    }
  }
  return fallback;
};

const numericValue = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const cleaned = value.replace(/[^\d,.-]/g, '');
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  const normalized = lastComma > lastDot
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned.replace(/,/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const moneyValue = (record: FinancialRecord, keys = ['amount', 'value', 'total', 'original_amount', 'gross_amount']) => {
  for (const key of keys) {
    const value = numericValue(record[key]);
    if (value !== null) return value;
  }
  return 0;
};

const formatMoney = (value: number) => value.toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value || '—' : date.toLocaleDateString('pt-BR');
};

const formatPeriod = (period: { start: string; end: string }) => {
  if (!period.start || !period.end) return 'Selecione o período';
  return `${formatDate(`${period.start}T12:00:00`)} a ${formatDate(`${period.end}T12:00:00`)}`;
};

const recordDate = (record: FinancialRecord) => textValue(record, [
  'due_date',
  'date',
  'competence_date',
  'payment_date',
  'received_at',
  'created_at',
], '');

const isSettled = (record: FinancialRecord) => {
  for (const key of ['is_paid', 'is_received', 'settled', 'paid', 'received']) {
    if (typeof record[key] === 'boolean') return record[key] as boolean;
  }

  if (recordValue(record, ['paid_at', 'received_at', 'payment_date', 'settlement_date'])) return true;
  const status = textValue(record, ['status', 'payment_status', 'settlement_status'], '').toLowerCase();
  if (!status) return false;
  if (/unpaid|pending|open|overdue|cancel|pendente|abert|atras|vencid/.test(status)) return false;
  return /paid|received|settled|liquidated|completed|pago|recebid|quitado|baixado/.test(status);
};

const categoryId = (record: FinancialRecord) => textValue(record, [
  'financial_category_uuid',
  'financial_category_id',
  'category_uuid',
  'category_id',
], '');

const categoryName = (record: FinancialRecord, categoriesById: Map<string, FinancialRecord>) => {
  const directCategory = recordValue(record, ['category', 'financial_category']);
  if (directCategory && typeof directCategory === 'object') {
    const name = textValue({ value: directCategory }, ['value'], '');
    if (name) return name;
  }
  if (typeof directCategory === 'string' && directCategory.trim()) return directCategory;
  const linked = categoriesById.get(categoryId(record));
  return linked ? textValue(linked, ['name', 'description', 'title'], 'Sem categoria') : textValue(record, ['category_name', 'financial_category_name'], 'Sem categoria');
};

const directionFromText = (value: string): FlowDirection => {
  const normalized = value.toLocaleLowerCase('pt-BR');
  if (/receb|receita|entrada|income|revenue|credit|receivable/.test(normalized)) return 'income';
  if (/pagar|despesa|saída|saida|expense|debit|payable|fornecedor/.test(normalized)) return 'expense';
  return 'unknown';
};

const directionOf = (record: FinancialRecord, categoriesById: Map<string, FinancialRecord>): FlowDirection => {
  const ownDirection = directionFromText(textValue(record, [
    'direction',
    'type',
    'transaction_type',
    'flow_type',
    'nature',
    'kind',
  ], ''));
  if (ownDirection !== 'unknown') return ownDirection;

  const linkedCategory = categoriesById.get(categoryId(record));
  const categoryDirection = linkedCategory
    ? directionFromText(textValue(linkedCategory, ['type', 'direction', 'nature', 'name', 'description'], ''))
    : directionFromText(categoryName(record, categoriesById));
  return categoryDirection;
};

const settledAmount = (record: FinancialRecord) => moneyValue(record, [
  'paid_amount',
  'received_amount',
  'amount_paid',
  'amount_received',
  'settled_amount',
  'amount',
  'value',
  'total',
]);

const outstandingAmount = (record: FinancialRecord) => moneyValue(record, [
  'remaining_amount',
  'open_amount',
  'pending_amount',
  'balance_due',
  'balance',
  'amount',
  'value',
  'total',
]);

const sumValues = (records: FinancialRecord[], resolver: (record: FinancialRecord) => number) => records.reduce((total, record) => total + resolver(record), 0);

const Metric: React.FC<{
  icon: React.ElementType;
  label: string;
  value: number;
  description: string;
  tone: 'income' | 'expense' | 'neutral';
  format?: 'money' | 'count';
}> = ({ icon: Icon, label, value, description, tone, format = 'money' }) => {
  const tones = {
    income: 'border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-600 dark:text-emerald-300',
    expense: 'border-rose-500/20 bg-rose-500/[0.08] text-rose-600 dark:text-rose-300',
    neutral: 'border-white/70 bg-white/70 text-[var(--primary)] dark:border-white/[0.09] dark:bg-white/[0.05]',
  };

  return <article className={`rounded-2xl border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.86)] backdrop-blur-xl ${tones[tone]}`}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">{label}</p>
        <p className="mt-2 text-xl font-bold tabular-nums text-[var(--text)]">{format === 'money' ? formatMoney(value) : value.toLocaleString('pt-BR')}</p>
      </div>
      <span className="flex size-9 items-center justify-center rounded-xl bg-white/65 shadow-sm dark:bg-white/[0.08]"><Icon className="size-4" /></span>
    </div>
    <p className="mt-2 text-[11px] font-medium text-[var(--text-secondary)]">{description}</p>
  </article>;
};

const SectionCard: React.FC<{
  title: string;
  subtitle: string;
  icon: React.ElementType;
  children: React.ReactNode;
}> = ({ title, subtitle, icon: Icon, children }) => <section className="overflow-hidden rounded-2xl border border-white/70 bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,.82)] backdrop-blur-xl dark:border-white/[0.09] dark:bg-white/[0.05]">
  <header className="flex items-start gap-3 border-b border-white/60 bg-white/35 px-4 py-3.5 dark:border-white/[0.08] dark:bg-white/[0.03]">
    <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-dim)] text-[var(--primary)]"><Icon className="size-4" /></span>
    <div><h3 className="text-sm font-bold text-[var(--text)]">{title}</h3><p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{subtitle}</p></div>
  </header>
  {children}
</section>;

const FinancialList: React.FC<{
  records: FinancialRecord[];
  categoriesById: Map<string, FinancialRecord>;
  empty: string;
}> = ({ records, categoriesById, empty }) => {
  if (records.length === 0) return <p className="p-5 text-sm text-[var(--text-muted)]">{empty}</p>;
  return <div className="max-h-[25rem] overflow-auto custom-scrollbar divide-y divide-[var(--border-subtle)]">
    {records.map((record, index) => {
      const settled = isSettled(record);
      const value = settled ? settledAmount(record) : outstandingAmount(record);
      return <div key={textValue(record, ['uuid', 'id'], String(index))} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3 transition-colors hover:bg-white/40 dark:hover:bg-white/[0.035]">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-[var(--text)]">{textValue(record, ['description', 'name', 'title', 'patient_name', 'supplier_name'])}</p>
          <p className="mt-1 truncate text-[11px] text-[var(--text-secondary)]">{categoryName(record, categoriesById)} · {formatDate(recordDate(record))}</p>
        </div>
        <div className="text-right"><p className="text-xs font-bold tabular-nums text-[var(--text)]">{formatMoney(value)}</p><p className={`mt-1 text-[10px] font-bold uppercase tracking-wide ${settled ? 'text-emerald-600 dark:text-emerald-300' : 'text-amber-600 dark:text-amber-300'}`}>{settled ? 'Liquidado' : 'Em aberto'}</p></div>
      </div>;
    })}
  </div>;
};

const AccountsTable: React.FC<{ accounts: FinancialRecord[] }> = ({ accounts }) => <SectionCard title="Contas e saldos" subtitle="Saldos retornados pela Clínica Experts" icon={Landmark}>
  {accounts.length === 0 ? <p className="p-5 text-sm text-[var(--text-muted)]">Nenhuma conta financeira retornada.</p> : <div className="overflow-auto custom-scrollbar"><table className="w-full min-w-[620px] text-left text-xs"><thead className="bg-white/35 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] dark:bg-white/[0.03]"><tr><th className="px-4 py-3">Conta</th><th className="px-4 py-3">Instituição</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3 text-right">Saldo</th></tr></thead><tbody className="divide-y divide-[var(--border-subtle)]">{accounts.map((account, index) => <tr key={textValue(account, ['uuid', 'id'], String(index))} className="transition-colors hover:bg-white/40 dark:hover:bg-white/[0.035]"><td className="px-4 py-3 font-semibold text-[var(--text)]">{textValue(account, ['name', 'description', 'title'])}</td><td className="px-4 py-3 text-[var(--text-secondary)]">{textValue(account, ['bank_name', 'bank', 'institution', 'institution_name'], '—')}</td><td className="px-4 py-3 text-[var(--text-secondary)]">{textValue(account, ['type', 'account_type'], '—')}</td><td className="px-4 py-3 text-right font-bold tabular-nums text-[var(--text)]">{formatMoney(moneyValue(account, ['current_balance', 'balance', 'available_balance', 'amount']))}</td></tr>)}</tbody></table></div>}
</SectionCard>;

export const ClinicaExpertsFinancial: React.FC = () => {
  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<View>('overview');
  const [loadedPeriod, setLoadedPeriod] = useState<{ start: string; end: string } | null>(null);
  const [period, setPeriod] = useState(() => {
    const today = new Date();
    return {
      start: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`,
      end: today.toISOString().slice(0, 10),
    };
  });

  const load = useCallback(async (range: { start: string; end: string }) => {
    if (!range.start || !range.end) return;
    setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token) throw new Error('Sua sessão expirou. Entre novamente para consultar o financeiro.');
      const query = new URLSearchParams({
        starts_at: `${range.start}T00:00:00-03:00`,
        ends_at: `${range.end}T23:59:59-03:00`,
      });
      const response = await fetch(`/api/integrations/clinica-experts/financial?${query}`, {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      });
      const payload = await response.json() as { data?: FinancialData; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || 'Não foi possível carregar o financeiro da Clínica Experts.');
      setData(payload.data);
      setLoadedPeriod(range);
    } catch (reason) {
      setData(null);
      setError(reason instanceof Error ? reason.message : 'Não foi possível carregar o financeiro da Clínica Experts.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePeriodChange = useCallback((nextPeriod: { start: string; end: string }) => {
    setPeriod(nextPeriod);
    if (nextPeriod.start && nextPeriod.end) void load(nextPeriod);
  }, [load]);

  useEffect(() => {
    void load(period);
  }, [load]);

  const categoriesById = useMemo(() => new Map((data?.categories || []).map((category) => [textValue(category, ['uuid', 'id'], ''), category])), [data?.categories]);
  const movementRecords = useMemo(() => (data?.parcels.length ? data.parcels : data?.bills || []), [data?.bills, data?.parcels]);
  const incomeRecords = useMemo(() => movementRecords.filter((record) => directionOf(record, categoriesById) === 'income'), [categoriesById, movementRecords]);
  const expenseRecords = useMemo(() => movementRecords.filter((record) => directionOf(record, categoriesById) === 'expense'), [categoriesById, movementRecords]);
  const receivedRecords = useMemo(() => incomeRecords.filter(isSettled), [incomeRecords]);
  const receivableRecords = useMemo(() => incomeRecords.filter((record) => !isSettled(record)), [incomeRecords]);
  const paidRecords = useMemo(() => expenseRecords.filter(isSettled), [expenseRecords]);
  const payableRecords = useMemo(() => expenseRecords.filter((record) => !isSettled(record)), [expenseRecords]);
  const received = useMemo(() => sumValues(receivedRecords, settledAmount), [receivedRecords]);
  const receivable = useMemo(() => sumValues(receivableRecords, outstandingAmount), [receivableRecords]);
  const paid = useMemo(() => sumValues(paidRecords, settledAmount), [paidRecords]);
  const payable = useMemo(() => sumValues(payableRecords, outstandingAmount), [payableRecords]);
  const netCashFlow = received - paid;
  const unclassified = movementRecords.filter((record) => directionOf(record, categoriesById) === 'unknown').length;
  const cashFlowLines = useMemo(() => {
    const groups = new Map<string, { income: number; expense: number }>();
    for (const record of [...receivedRecords, ...paidRecords]) {
      const name = categoryName(record, categoriesById);
      const current = groups.get(name) || { income: 0, expense: 0 };
      if (directionOf(record, categoriesById) === 'income') current.income += settledAmount(record);
      else current.expense += settledAmount(record);
      groups.set(name, current);
    }
    return [...groups.entries()].map(([name, values]) => ({ name, ...values, net: values.income - values.expense })).sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  }, [categoriesById, paidRecords, receivedRecords]);

  const views: Array<{ id: View; label: string }> = [
    { id: 'overview', label: 'Visão do período' },
    { id: 'accounts', label: 'Contas e saldos' },
    { id: 'cashflow', label: 'Categorias e DFC' },
  ];

  return <div className="mx-auto w-full max-w-7xl space-y-5 pb-10">
    <header className="module-command-bar relative z-20 flex flex-col gap-4 overflow-visible sm:flex-row sm:items-center sm:justify-between">
      <div className="max-w-2xl"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--primary)]">Integração financeira</p><h2 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text)]">Clínica Experts</h2><p className="mt-1 text-sm text-[var(--text-secondary)]">Acompanhe os recebimentos, compromissos e o fluxo de caixa do período selecionado.</p></div>
      <div className="relative z-30 flex w-full flex-col gap-2 sm:w-[330px] sm:items-stretch"><DateRangePicker value={period} onChange={handlePeriodChange} periodSelector className="relative z-40 w-full [&>button]:h-11 [&>button]:border-[var(--primary)]/25 [&>button]:bg-white/90 [&>button]:shadow-[0_12px_30px_rgba(31,111,91,0.14)] dark:[&>button]:bg-[#17211D]/90" /><button type="button" onClick={() => void load(period)} disabled={loading || !period.start || !period.end} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-xs font-bold text-white shadow-lg shadow-[var(--primary)]/20 transition hover:brightness-105 disabled:opacity-60"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar dados</button><p className="text-right text-[10px] font-medium text-[var(--text-muted)]" aria-live="polite">{loading ? `Atualizando: ${formatPeriod(period)}` : loadedPeriod ? `Dados exibidos: ${formatPeriod(loadedPeriod)}` : 'Nenhum período carregado'}</p></div>
    </header>

    <nav aria-label="Seções financeiras da Clínica Experts" className="flex w-full gap-1 overflow-x-auto rounded-2xl border border-white/70 bg-white/50 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,.8)] backdrop-blur-xl dark:border-white/[0.09] dark:bg-white/[0.04]">
      {views.map((view) => <button key={view.id} type="button" onClick={() => setActiveView(view.id)} className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${activeView === view.id ? 'bg-white text-[var(--primary)] shadow-sm dark:bg-white/90' : 'text-[var(--text-secondary)] hover:bg-white/50 hover:text-[var(--text)] dark:hover:bg-white/[0.08]'}`}>{view.label}</button>)}
    </nav>

    {error ? <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50/75 p-4 text-sm text-rose-800 backdrop-blur-xl dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-100"><CircleAlert className="mt-0.5 size-4 shrink-0" />{error}</div> : null}

    {loading && !data ? <div className="rounded-2xl border border-white/70 bg-white/55 p-8 text-center text-sm text-[var(--text-muted)] backdrop-blur-xl dark:border-white/[0.09] dark:bg-white/[0.05]">Consultando dados financeiros da Clínica Experts…</div> : null}

    {data && activeView === 'overview' ? <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={ArrowDownLeft} label="Recebido" value={received} description="Entradas liquidadas no período" tone="income" /><Metric icon={WalletCards} label="A receber" value={receivable} description="Entradas ainda em aberto" tone="income" /><Metric icon={ArrowUpRight} label="Pago" value={paid} description="Saídas liquidadas no período" tone="expense" /><Metric icon={ReceiptText} label="A pagar" value={payable} description="Saídas ainda em aberto" tone="expense" /></div>
      <div className="grid gap-5 xl:grid-cols-2"><SectionCard title="Recebimentos" subtitle="Recebido e valores a receber no período" icon={ArrowDownLeft}><FinancialList records={[...receivedRecords, ...receivableRecords]} categoriesById={categoriesById} empty="Nenhum recebimento classificado no período." /></SectionCard><SectionCard title="Contas a pagar" subtitle="Pagamentos realizados e compromissos em aberto" icon={ArrowUpRight}><FinancialList records={[...paidRecords, ...payableRecords]} categoriesById={categoriesById} empty="Nenhuma conta a pagar classificada no período." /></SectionCard></div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/55 px-4 py-3 backdrop-blur-xl dark:border-white/[0.09] dark:bg-white/[0.05]"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Base do período</p><p className="mt-1 text-xs text-[var(--text-secondary)]">{movementRecords.length} parcela(s) ou título(s) considerados na consulta.</p></div><div className="text-right"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Saldo de caixa realizado</p><p className={`mt-1 text-lg font-bold tabular-nums ${netCashFlow >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>{formatMoney(netCashFlow)}</p></div></div>
      {unclassified > 0 ? <p className="text-center text-[11px] text-[var(--text-muted)]">{unclassified} lançamento(s) sem natureza financeira identificada pela API não entram nos totais até receberem uma categoria de entrada ou saída.</p> : null}
    </> : null}

    {data && activeView === 'accounts' ? <><div className="grid gap-3 sm:grid-cols-3"><Metric icon={Landmark} label="Contas" value={data.accounts.length} description="Contas retornadas pela integração" tone="neutral" format="count" /><Metric icon={Building2} label="Títulos no período" value={data.bills.length} description="Documentos financeiros consultados" tone="neutral" format="count" /><Metric icon={ReceiptText} label="Parcelas no período" value={data.parcels.length} description="Movimentos para análise de caixa" tone="neutral" format="count" /></div><AccountsTable accounts={data.accounts} /></> : null}

    {data && activeView === 'cashflow' ? <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(20rem,.7fr)]"><SectionCard title="DFC simplificada" subtitle="Entradas e saídas liquidadas por categoria no período" icon={FolderTree}>{cashFlowLines.length === 0 ? <p className="p-5 text-sm text-[var(--text-muted)]">Ainda não há movimentos liquidados com categoria para compor a DFC.</p> : <div className="divide-y divide-[var(--border-subtle)]">{cashFlowLines.map((line) => <div key={line.name} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3"><div className="min-w-0"><p className="truncate text-xs font-semibold text-[var(--text)]">{line.name}</p><p className="mt-1 text-[11px] text-[var(--text-muted)]">Entradas {formatMoney(line.income)} · Saídas {formatMoney(line.expense)}</p></div><p className={`self-center text-right text-xs font-bold tabular-nums ${line.net >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>{formatMoney(line.net)}</p></div>)}</div>}</SectionCard><section className="rounded-2xl border border-white/70 bg-white/55 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.82)] backdrop-blur-xl dark:border-white/[0.09] dark:bg-white/[0.05]"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Resultado de caixa</p><p className={`mt-2 text-3xl font-bold tabular-nums ${netCashFlow >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>{formatMoney(netCashFlow)}</p><dl className="mt-5 space-y-3 border-t border-[var(--border-subtle)] pt-4 text-xs"><div className="flex items-center justify-between gap-4"><dt className="text-[var(--text-secondary)]">Entradas liquidadas</dt><dd className="font-bold tabular-nums text-emerald-600 dark:text-emerald-300">{formatMoney(received)}</dd></div><div className="flex items-center justify-between gap-4"><dt className="text-[var(--text-secondary)]">Saídas liquidadas</dt><dd className="font-bold tabular-nums text-rose-600 dark:text-rose-300">{formatMoney(paid)}</dd></div></dl><p className="mt-5 text-[11px] leading-relaxed text-[var(--text-muted)]">A DFC considera somente movimentos liquidados, agrupados pelas Categorias Financeiras da Clínica Experts.</p></section><SectionCard title="Categorias financeiras" subtitle={`${data.categories.length} categoria(s) disponíveis para classificação`} icon={FolderTree}><div className="max-h-[30rem] divide-y divide-[var(--border-subtle)] overflow-auto custom-scrollbar">{data.categories.length === 0 ? <p className="p-5 text-sm text-[var(--text-muted)]">Nenhuma categoria financeira retornada.</p> : data.categories.map((category, index) => <div key={textValue(category, ['uuid', 'id'], String(index))} className="px-4 py-3"><p className="text-xs font-semibold text-[var(--text)]">{textValue(category, ['name', 'description', 'title'])}</p><p className="mt-1 text-[11px] text-[var(--text-muted)]">{textValue(category, ['type', 'direction', 'nature'], 'Natureza não informada')}</p></div>)}</div></SectionCard></div> : null}
  </div>;
};
