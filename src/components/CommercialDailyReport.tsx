import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Calendar, CheckCircle2, DollarSign, History, Save, TrendingUp, Users } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { notifyDataChange, useRealtimeSubscription } from '../lib/realtime';

type DailyCommercialData = {
    leads: number;
    appointments: number;
    sold: number;
    received: number;
};

type CommercialReport = DailyCommercialData & {
    id: string;
    report_date: string;
};

const today = () => new Date().toLocaleDateString('en-CA');
const asNumber = (value: unknown) => Math.max(0, Number(value) || 0);
const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fromRecord = (record: any): DailyCommercialData => {
    const answers = record?.raw_answers || {};
    return {
        leads: asNumber(record?.new_leads ?? answers.m_new_leads_count ?? record?.leads_received ?? answers.q2_contacts_count),
        appointments: asNumber(record?.appointments_made ?? answers.q5_appointments_count),
        sold: asNumber(record?.contracts_closed ?? answers.q7_value_sold),
        received: asNumber(record?.budgets_presented ?? answers.q7_value_received),
    };
};

export const CommercialDailyReport: React.FC = () => {
    const [reportDate, setReportDate] = useState(today);
    const [form, setForm] = useState<DailyCommercialData>({ leads: 0, appointments: 0, sold: 0, received: 0 });
    const [history, setHistory] = useState<CommercialReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const [{ data: selected, error: selectedError }, { data: records, error: historyError }] = await Promise.all([
                supabase.from('commercial_reports').select('*').eq('report_date', reportDate).maybeSingle(),
                supabase.from('commercial_reports').select('*').order('report_date', { ascending: false }).limit(31),
            ]);
            if (selectedError) throw selectedError;
            if (historyError) throw historyError;
            setForm(selected ? fromRecord(selected) : { leads: 0, appointments: 0, sold: 0, received: 0 });
            setHistory((records || []).map((record: any) => ({ id: record.id, report_date: record.report_date, ...fromRecord(record) })));
        } catch (error) {
            console.error('Erro ao carregar relatório comercial:', error);
            setMessage({ type: 'error', text: 'Não foi possível carregar os dados comerciais.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [reportDate]);
    useRealtimeSubscription(['commercial_reports', 'commercial_daily_reports'], load);

    const totals = useMemo(() => history.reduce((acc, item) => ({
        leads: acc.leads + item.leads,
        appointments: acc.appointments + item.appointments,
        sold: acc.sold + item.sold,
        received: acc.received + item.received,
    }), { leads: 0, appointments: 0, sold: 0, received: 0 }), [history]);

    const save = async () => {
        setSaving(true);
        setMessage(null);
        const data = {
            report_date: reportDate,
            leads_received: form.leads,
            new_leads: form.leads,
            appointments_made: form.appointments,
            budgets_presented: form.received,
            contracts_closed: form.sold,
            objections: [],
            appointments_by_time: [],
            main_challenges: '',
            opportunities: '',
            raw_answers: {
                q2_contacts_count: form.leads,
                q5_appointments_count: form.appointments,
                q7_value_sold: form.sold,
                q7_value_received: form.received,
                m_new_leads_count: form.leads,
            },
            updated_at: new Date().toISOString(),
        };

        try {
            const { data: existing, error: checkError } = await supabase
                .from('commercial_reports')
                .select('id')
                .eq('report_date', reportDate)
                .maybeSingle();
            if (checkError) throw checkError;
            const { error } = existing
                ? await supabase.from('commercial_reports').update(data).eq('id', existing.id)
                : await supabase.from('commercial_reports').insert([data]);
            if (error) throw error;

            setMessage({ type: 'success', text: 'Resumo comercial salvo.' });
            notifyDataChange(['commercial_reports', 'commercial_daily_reports', 'daily_evaluations']);
            await load();
        } catch (error: any) {
            console.error('Erro ao salvar resumo comercial:', error);
            setMessage({ type: 'error', text: `Não foi possível salvar: ${error?.message || 'erro desconhecido'}` });
        } finally {
            setSaving(false);
        }
    };

    const metrics = [
        { key: 'leads' as const, label: 'Leads que entraram', hint: 'novos contatos recebidos', icon: Users, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
        { key: 'appointments' as const, label: 'Agendamentos do dia', hint: 'avaliações marcadas', icon: Calendar, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
        { key: 'sold' as const, label: 'Valor vendido', hint: 'vendas fechadas no dia', icon: DollarSign, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
        { key: 'received' as const, label: 'Valor recebido', hint: 'entradas recebidas no dia', icon: DollarSign, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
    ];

    return (
        <div className="operational-report mx-auto flex w-full max-w-6xl flex-col gap-6 pb-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="glass-panel flex flex-col gap-5 rounded-3xl border border-border p-6 md:flex-row md:items-center md:justify-between">
                <div>
                    <span className="mb-2 inline-block rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-400">Comercial</span>
                    <h3 className="flex items-center gap-2 text-2xl font-black tracking-tight text-text"><TrendingUp className="h-7 w-7 text-indigo-400" />Resumo diário</h3>
                    <p className="mt-1 text-sm text-slate-400">Registre somente o essencial para acompanhar o comercial.</p>
                </div>
                <label className="flex items-center gap-2 rounded-2xl border border-border bg-panel px-4 py-3 text-xs font-semibold text-slate-300">
                    <Calendar className="h-4 w-4 text-indigo-400" />
                    <span className="sr-only">Data do resumo</span>
                    <input type="date" value={reportDate} onChange={event => setReportDate(event.target.value)} className="bg-transparent outline-none" />
                </label>
            </header>

            {message && <div className={`flex items-center gap-3 rounded-2xl border p-4 text-sm font-semibold ${message.type === 'success' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border-rose-500/20 bg-rose-500/10 text-rose-400'}`}>
                {message.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}{message.text}
            </div>}

            <section className="glass-panel rounded-3xl border border-border p-6">
                <div className="mb-5"><h4 className="text-sm font-black uppercase tracking-wider text-text">Dados de {new Date(`${reportDate}T12:00:00`).toLocaleDateString('pt-BR')}</h4><p className="mt-1 text-xs text-slate-400">Três informações. Um único registro por dia.</p></div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {metrics.map(({ key, label, hint, icon: Icon, color }) => <label key={key} className="rounded-2xl border border-border bg-panel p-5 transition focus-within:border-indigo-500/70">
                        <span className={`mb-4 inline-flex rounded-xl border p-2 ${color}`}><Icon className="h-5 w-5" /></span>
                        <span className="block text-sm font-bold text-text">{label}</span><span className="mt-1 block text-xs text-slate-500">{hint}</span>
                        <div className="mt-4 flex items-center gap-2">
                            {(key === 'sold' || key === 'received') && <span className="text-sm font-bold text-slate-400">R$</span>}
                            <input type="number" min="0" step={key === 'sold' || key === 'received' ? '0.01' : '1'} inputMode="decimal" value={form[key] || ''} onChange={event => setForm(current => ({ ...current, [key]: asNumber(event.target.value) }))} placeholder="0" disabled={loading || saving} className="min-w-0 w-full bg-transparent text-2xl font-black text-text outline-none placeholder:text-slate-600 disabled:opacity-50" />
                        </div>
                    </label>)}
                </div>
                <div className="mt-6 flex justify-end"><button type="button" onClick={save} disabled={loading || saving} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"><Save className="h-4 w-4" />{saving ? 'Salvando...' : 'Salvar resumo'}</button></div>
            </section>

            <section className="analytics-metric-grid grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {metrics.map(({ key, label, icon: Icon, color }) => <div key={key} className="analytics-card analytics-metric glass-panel rounded-2xl border border-border p-5"><div className="flex items-start justify-between gap-3"><div><p className="analytics-label text-xs font-bold uppercase tracking-wider text-slate-400">Últimos 31 dias</p><p className="mt-3 text-sm font-semibold text-slate-300">{label}</p><strong className="analytics-value mt-1 block text-2xl font-black text-text">{key === 'sold' || key === 'received' ? formatCurrency(totals[key]) : totals[key]}</strong></div><span className={`analytics-icon ${`rounded-xl border p-2 ${color}`}`}><Icon className="h-5 w-5" /></span></div></div>)}
            </section>

            <section className="glass-panel overflow-hidden rounded-3xl border border-border">
                <div className="flex items-center gap-2 border-b border-border p-6"><History className="h-5 w-5 text-indigo-400" /><div><h4 className="text-sm font-black text-text">Histórico recente</h4><p className="mt-1 text-xs text-slate-400">Últimos registros comerciais.</p></div></div>
                <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead className="bg-panel text-[10px] font-bold uppercase tracking-wider text-slate-500"><tr><th className="px-6 py-3">Data</th><th className="px-6 py-3 text-right">Leads</th><th className="px-6 py-3 text-right">Agendamentos</th><th className="px-6 py-3 text-right">Vendido</th><th className="px-6 py-3 text-right">Recebido</th></tr></thead><tbody className="divide-y divide-border text-sm">{history.length === 0 ? <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-500">Nenhum resumo registrado ainda.</td></tr> : history.map(item => <tr key={item.id} className="cursor-pointer transition hover:bg-panel/70" onClick={() => setReportDate(item.report_date)}><td className="px-6 py-4 font-semibold text-text">{new Date(`${item.report_date}T12:00:00`).toLocaleDateString('pt-BR')}</td><td className="px-6 py-4 text-right font-mono text-slate-300">{item.leads}</td><td className="px-6 py-4 text-right font-mono text-slate-300">{item.appointments}</td><td className="px-6 py-4 text-right font-mono font-bold text-emerald-400">{formatCurrency(item.sold)}</td><td className="px-6 py-4 text-right font-mono font-bold text-cyan-400">{formatCurrency(item.received)}</td></tr>)}</tbody></table></div>
            </section>
        </div>
    );
};
