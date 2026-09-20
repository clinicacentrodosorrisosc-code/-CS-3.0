import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, CircleAlert, FolderTree, ReceiptText, RefreshCw, WalletCards } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { DateRangePicker } from './ui/date-range-picker';

type FinancialRecord = Record<string, unknown>;
type FinancialData = { accounts: FinancialRecord[]; categories: FinancialRecord[]; bills: FinancialRecord[]; parcels: FinancialRecord[]; fetchedAt: string };

const textValue = (record: FinancialRecord, keys: string[], fallback = 'Não informado') => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number') return String(value);
    if (value && typeof value === 'object' && 'name' in value && typeof (value as { name?: unknown }).name === 'string') return (value as { name: string }).name;
  }
  return fallback;
};

const moneyValue = (record: FinancialRecord) => {
  const fields = ['amount', 'value', 'total', 'balance', 'current_balance', 'paid_amount'];
  const value = fields.map(key => record[key]).find(item => typeof item === 'number' || (typeof item === 'string' && item.trim() !== '' && Number.isFinite(Number(item))));
  return value === undefined ? null : Number(value);
};

const formatMoney = (value: number | null) => value === null ? '—' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value || '—' : date.toLocaleDateString('pt-BR');
};

const Metric: React.FC<{ icon: React.ElementType; label: string; value: number }> = ({ icon: Icon, label, value }) => (
  <div className="rounded-2xl border border-white/70 bg-white/55 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.82)] backdrop-blur-xl dark:border-white/[0.09] dark:bg-white/[0.05]">
    <Icon className="size-4 text-[var(--primary)]" />
    <p className="mt-3 text-2xl font-bold tabular-nums text-[var(--text)]">{value}</p>
    <p className="mt-1 text-[11px] font-semibold text-[var(--text-muted)]">{label}</p>
  </div>
);

const RecordsTable: React.FC<{ title: string; records: FinancialRecord[]; empty: string }> = ({ title, records, empty }) => (
  <section className="overflow-hidden rounded-2xl border border-white/70 bg-white/55 backdrop-blur-xl dark:border-white/[0.09] dark:bg-white/[0.05]">
    <header className="flex items-center justify-between border-b border-white/60 bg-white/35 px-4 py-3 dark:border-white/[0.08] dark:bg-white/[0.03]"><h3 className="text-sm font-bold text-[var(--text)]">{title}</h3><span className="text-[11px] font-semibold tabular-nums text-[var(--text-muted)]">{records.length}</span></header>
    {records.length === 0 ? <p className="p-5 text-sm text-[var(--text-muted)]">{empty}</p> : <div className="max-h-80 overflow-auto custom-scrollbar"><table className="w-full min-w-[580px] text-left"><thead className="sticky top-0 bg-white/65 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] backdrop-blur-xl dark:bg-[#20232a]/65"><tr><th className="px-4 py-3">Descrição</th><th className="px-4 py-3">Categoria / conta</th><th className="px-4 py-3">Vencimento</th><th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-[var(--border-subtle)] text-xs">{records.map((record, index) => <tr key={textValue(record, ['uuid', 'id'], String(index))} className="transition-colors hover:bg-white/40 dark:hover:bg-white/[0.035]"><td className="max-w-64 truncate px-4 py-3 font-semibold text-[var(--text)]">{textValue(record, ['description', 'name', 'title', 'patient_name'])}</td><td className="max-w-48 truncate px-4 py-3 text-[var(--text-secondary)]">{textValue(record, ['category_name', 'category', 'financial_category', 'account_name', 'account'], '—')}</td><td className="px-4 py-3 text-[var(--text-secondary)]">{formatDate(textValue(record, ['due_date', 'date', 'competence_date', 'created_at'], ''))}</td><td className="px-4 py-3 text-right font-semibold tabular-nums text-[var(--text)]">{formatMoney(moneyValue(record))}</td><td className="px-4 py-3 text-[var(--text-secondary)]">{textValue(record, ['status', 'payment_status', 'type'], '—')}</td></tr>)}</tbody></table></div>}
  </section>
);

export const ClinicaExpertsFinancial: React.FC = () => {
  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState(() => {
    const today = new Date();
    return { start: `${today.getFullYear()}-01-01`, end: today.toISOString().slice(0, 10) };
  });

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token) throw new Error('Sua sessão expirou. Entre novamente para consultar o financeiro.');
      const query = new URLSearchParams({ starts_at: `${period.start}T00:00:00-03:00`, ends_at: `${period.end}T23:59:59-03:00` });
      const response = await fetch(`/api/integrations/clinica-experts/financial?${query}`, { headers: { Authorization: `Bearer ${sessionData.session.access_token}` } });
      const payload = await response.json() as { data?: FinancialData; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || 'Não foi possível carregar o financeiro da Clínica Experts.');
      setData(payload.data);
    } catch (reason) {
      setData(null); setError(reason instanceof Error ? reason.message : 'Não foi possível carregar o financeiro da Clínica Experts.');
    } finally { setLoading(false); }
  }, [period]);

  useEffect(() => { void load(); }, [load]);
  const bills = data?.bills || [];
  const parcels = data?.parcels || [];
  const totalTitles = useMemo(() => bills.reduce((sum, item) => sum + (moneyValue(item) || 0), 0), [bills]);

  return <div className="mx-auto w-full max-w-7xl space-y-5 pb-10">
    <header className="module-command-bar flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--primary)]">Integração financeira</p><h2 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text)]">Clínica Experts</h2><p className="mt-1 text-sm text-[var(--text-secondary)]">Consulta segura e somente leitura dos dados financeiros da clínica.</p></div>
      <div className="flex flex-col gap-2 sm:items-end"><div className="w-full sm:w-[300px]"><DateRangePicker value={period} onChange={setPeriod} periodSelector className="h-10" /></div><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-xs font-bold text-white shadow-lg shadow-[var(--primary)]/20 transition hover:brightness-105 disabled:opacity-60"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar</button></div>
    </header>
    {error ? <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50/75 p-4 text-sm text-rose-800 backdrop-blur-xl dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-100"><CircleAlert className="mt-0.5 size-4 shrink-0" />{error}</div> : <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric icon={WalletCards} label="Contas financeiras" value={data?.accounts.length || 0} /><Metric icon={FolderTree} label="Categorias" value={data?.categories.length || 0} /><Metric icon={ReceiptText} label="Títulos" value={bills.length} /><Metric icon={Building2} label="Parcelas" value={parcels.length} /></div>
      <div className="flex items-center justify-between rounded-xl border border-white/60 bg-white/40 px-4 py-2.5 text-xs backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.035]"><span className="text-[var(--text-muted)]">Total informado nos títulos</span><strong className="tabular-nums text-[var(--text)]">{formatMoney(totalTitles)}</strong></div>
      {loading ? <div className="rounded-2xl border border-white/70 bg-white/55 p-8 text-center text-sm text-[var(--text-muted)] backdrop-blur-xl dark:border-white/[0.09] dark:bg-white/[0.05]">Consultando dados financeiros da Clínica Experts…</div> : <div className="grid gap-5 xl:grid-cols-2"><RecordsTable title="Contas e saldos" records={data?.accounts || []} empty="Nenhuma conta financeira retornada." /><RecordsTable title="Categorias financeiras" records={data?.categories || []} empty="Nenhuma categoria financeira retornada." /><RecordsTable title="Contas a pagar e receber" records={bills} empty="Nenhum título retornado." /><RecordsTable title="Parcelas" records={parcels} empty="Nenhuma parcela retornada." /></div>}
    </>}
  </div>;
};
