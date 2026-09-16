import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, CalendarX2, ChevronLeft, ChevronRight, ClipboardCheck, Clock3, RefreshCw, RotateCcw, Trophy, UserCheck, UsersRound, UserX } from 'lucide-react';
import { supabase } from '../supabaseClient';

type AgendaEvent = {
  uuid: string;
  title?: string | null;
  type?: string | null;
  annotation?: string | null;
  starts_at: string;
  ends_at?: string | null;
  status?: string | null;
  patient?: { name?: string | null } | null;
  professional?: { name?: string | null } | null;
  rooms?: Array<{ name?: string | null }>;
  procedures?: Array<{ name?: string | null; quantity?: number | null }>;
};

type PeriodMode = 'day' | 'week' | 'month' | 'custom';

const formatApiDate = (date: Date, endOfDay = false) => {
  const copy = new Date(date);
  copy.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  const offset = -copy.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const absolute = Math.abs(offset);
  return `${copy.getFullYear()}-${String(copy.getMonth() + 1).padStart(2, '0')}-${String(copy.getDate()).padStart(2, '0')}T${String(copy.getHours()).padStart(2, '0')}:${String(copy.getMinutes()).padStart(2, '0')}:${String(copy.getSeconds()).padStart(2, '0')}${sign}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`;
};

const statusLabel = (value?: string | null) => {
  const normalized = String(value || 'agendado').toLowerCase();
  if (normalized === 'scheduled') return 'Agendado';
  if (normalized === 'done') return 'Concluído';
  if (normalized.includes('confirm')) return 'Confirmado';
  if (normalized.includes('cancel')) return 'Cancelado';
  if (normalized === 'rescheduled') return 'Remarcado';
  if (normalized.includes('remarc')) return 'Remarcado';
  if (normalized === 'waiting') return 'Aguardando';
  if (normalized === 'progress') return 'Em atendimento';
  if (normalized === 'noshow') return 'Não compareceu';
  if (normalized.includes('conclu') || normalized.includes('finaliz')) return 'Concluído';
  return value || 'Agendado';
};

const statusTone = (value?: string | null) => {
  const normalized = String(value || 'agendado').toLowerCase();
  if (normalized.includes('cancel')) return 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300';
  if (normalized === 'noshow') return 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
  if (normalized === 'rescheduled' || normalized.includes('remarc')) return 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300';
  if (normalized === 'waiting') return 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
  if (normalized === 'progress') return 'bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300';
  if (normalized === 'done' || normalized.includes('conclu') || normalized.includes('finaliz') || normalized.includes('confirm')) return 'bg-[#EAF5F0] text-[#1F6F5B] dark:bg-[#1F6F5B]/20 dark:text-[#63B596]';
  return 'bg-slate-100 text-slate-600 dark:bg-white/[0.08] dark:text-slate-300';
};

const startOfDay = (date: Date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

const endOfDay = (date: Date) => {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
};

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const fromDateInputValue = (value: string, end = false) => {
  const [year, month, day] = value.split('-').map(Number);
  const result = new Date(year, (month || 1) - 1, day || 1);
  return end ? endOfDay(result) : startOfDay(result);
};

const getPeriodRange = (date: Date, mode: PeriodMode) => {
  if (mode === 'day') return { start: startOfDay(date), end: endOfDay(date) };
  if (mode === 'month') {
    return { start: new Date(date.getFullYear(), date.getMonth(), 1), end: new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999) };
  }
  const start = startOfDay(date);
  const weekday = start.getDay();
  start.setDate(start.getDate() - (weekday === 0 ? 6 : weekday - 1));
  const end = endOfDay(start);
  end.setDate(end.getDate() + 6);
  return { start, end };
};

export const ClinicaExpertsAgenda: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [periodMode, setPeriodMode] = useState<PeriodMode>('day');
  const [customStart, setCustomStart] = useState(() => toDateInputValue(new Date()));
  const [customEnd, setCustomEnd] = useState(() => toDateInputValue(new Date()));
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasInvalidCustomRange = periodMode === 'custom' && fromDateInputValue(customStart) > fromDateInputValue(customEnd, true);
  const periodRange = useMemo(() => periodMode === 'custom'
    ? { start: fromDateInputValue(customStart), end: fromDateInputValue(customEnd, true) }
    : getPeriodRange(selectedDate, periodMode), [customEnd, customStart, periodMode, selectedDate]);
  const periodLabel = useMemo(() => {
    if (periodMode === 'day') return selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
    if (periodMode === 'month') return selectedDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    if (periodMode === 'custom') {
      const start = periodRange.start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
      const end = periodRange.end.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
      return `${start} a ${end}`;
    }
    const start = periodRange.start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    const end = periodRange.end.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    return `${start} a ${end}`;
  }, [periodMode, periodRange, selectedDate]);

  const loadAgenda = useCallback(async () => {
    if (hasInvalidCustomRange) {
      setError('A data final precisa ser igual ou posterior à data inicial.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sua sessão expirou. Entre novamente para consultar a agenda.');
      const params = new URLSearchParams({ starts_at: formatApiDate(periodRange.start), ends_at: formatApiDate(periodRange.end, true) });
      const response = await fetch(`/api/integrations/clinica-experts/agenda?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const payload = await response.json() as { data?: AgendaEvent[]; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Não foi possível carregar a agenda.');
      setEvents(Array.isArray(payload.data) ? payload.data : []);
    } catch (reason) {
      setEvents([]);
      setError(reason instanceof Error ? reason.message : 'Não foi possível carregar a agenda.');
    } finally {
      setLoading(false);
    }
  }, [hasInvalidCustomRange, periodRange]);

  useEffect(() => { loadAgenda(); }, [loadAgenda]);

  const summary = useMemo(() => {
    const countStatus = (status: string) => events.filter(event => String(event.status || '').toLowerCase() === status).length;
    const normalizeText = (value?: string | null) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const isEvaluation = (event: AgendaEvent) => [event.title, event.type, ...(event.procedures?.map(procedure => procedure.name) || [])]
      .some(value => normalizeText(value).includes('avaliacao'));
    const bookedMinutes = events.reduce((total, event) => {
      const status = String(event.status || '').toLowerCase();
      if (status === 'canceled' || status === 'rescheduled' || !event.ends_at) return total;
      const duration = new Date(event.ends_at).getTime() - new Date(event.starts_at).getTime();
      return total + (Number.isFinite(duration) && duration > 0 ? duration / 60_000 : 0);
    }, 0);
    const attendedBase = events.filter(event => ['done', 'noshow'].includes(String(event.status || '').toLowerCase())).length;
    const completedProcedures = new Map<string, number>();
    events.filter(event => String(event.status || '').toLowerCase() === 'done').forEach(event => {
      event.procedures?.forEach(procedure => {
        const name = procedure.name?.trim();
        if (name) completedProcedures.set(name, (completedProcedures.get(name) || 0) + Math.max(1, Number(procedure.quantity) || 1));
      });
    });
    const topCompletedProcedure = [...completedProcedures.entries()].sort(([, left], [, right]) => right - left)[0] || null;
    const evaluations = events.filter(isEvaluation);
    const evaluationCompleted = evaluations.filter(event => String(event.status || '').toLowerCase() === 'done').length;
    const evaluationRescheduled = evaluations.filter(event => String(event.status || '').toLowerCase() === 'rescheduled').length;
    const evaluationLost = evaluations.filter(event => ['canceled', 'noshow'].includes(String(event.status || '').toLowerCase())).length;
    return {
      total: events.length,
      canceled: countStatus('canceled'),
      noShow: countStatus('noshow'),
      rescheduled: countStatus('rescheduled'),
      completed: countStatus('done'),
      professionals: new Set(events.map(event => event.professional?.name?.trim()).filter(Boolean)).size,
      bookedMinutes,
      attendanceRate: attendedBase ? (countStatus('done') / attendedBase) * 100 : 0,
      lossRate: events.length ? ((countStatus('canceled') + countStatus('noshow')) / events.length) * 100 : 0,
      topCompletedProcedure,
      evaluations: {
        total: evaluations.length,
        completed: evaluationCompleted,
        rescheduled: evaluationRescheduled,
        lost: evaluationLost,
        effectivenessRate: evaluationCompleted + evaluationLost > 0 ? (evaluationCompleted / (evaluationCompleted + evaluationLost)) * 100 : 0,
      },
    };
  }, [events]);

  const changePeriod = (amount: number) => setSelectedDate(current => {
    const next = new Date(current);
    if (periodMode === 'month') next.setMonth(next.getMonth() + amount);
    else next.setDate(next.getDate() + amount * (periodMode === 'week' ? 7 : 1));
    return next;
  });

  const selectPeriodMode = (mode: PeriodMode) => {
    if (mode === 'custom' && periodMode !== 'custom') {
      const currentRange = getPeriodRange(selectedDate, periodMode);
      setCustomStart(toDateInputValue(currentRange.start));
      setCustomEnd(toDateInputValue(currentRange.end));
    }
    setPeriodMode(mode);
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[#DFE6E2] bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#19231F]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#EAF5F0] text-[#1F6F5B] dark:bg-[#1F6F5B]/20 dark:text-[#63B596]"><CalendarDays className="size-5" /></div>
            <div><h2 className="text-sm font-bold text-[#17211D] dark:text-white">Agenda Clínica Experts</h2><p className="text-xs text-[#5E6D66] dark:text-slate-400">Consultas e indicadores do período selecionado.</p></div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl border border-[#DFE6E2] bg-[#F5F7F6] p-0.5 dark:border-white/[0.08] dark:bg-white/[0.04]">
              {[{ id: 'day', label: 'Dia' }, { id: 'week', label: 'Semana' }, { id: 'month', label: 'Mês' }, { id: 'custom', label: 'Personalizado' }].map(option => <button key={option.id} type="button" onClick={() => selectPeriodMode(option.id as PeriodMode)} className={`rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${periodMode === option.id ? 'bg-[#1F6F5B] text-white shadow-sm dark:bg-[#63B596] dark:text-[#101217]' : 'text-[#5E6D66] hover:bg-white hover:text-[#17211D] dark:text-slate-400 dark:hover:bg-white/[0.08] dark:hover:text-white'}`}>{option.label}</button>)}
            </div>
            {periodMode === 'custom' ? <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#DFE6E2] bg-[#F5F7F6] p-1.5 dark:border-white/[0.08] dark:bg-white/[0.04]">
              <label className="flex items-center gap-1.5 px-1 text-[10px] font-bold text-[#5E6D66] dark:text-slate-400">De<input type="date" value={customStart} max={customEnd} onChange={event => setCustomStart(event.target.value)} className="rounded-lg border border-[#DFE6E2] bg-white px-2 py-1 text-xs font-semibold text-[#17211D] dark:border-white/[0.1] dark:bg-[#19231F] dark:text-white" /></label>
              <label className="flex items-center gap-1.5 px-1 text-[10px] font-bold text-[#5E6D66] dark:text-slate-400">Até<input type="date" value={customEnd} min={customStart} onChange={event => setCustomEnd(event.target.value)} className="rounded-lg border border-[#DFE6E2] bg-white px-2 py-1 text-xs font-semibold text-[#17211D] dark:border-white/[0.1] dark:bg-[#19231F] dark:text-white" /></label>
            </div> : <div className="flex items-center rounded-xl border border-[#DFE6E2] bg-[#F5F7F6] p-1 dark:border-white/[0.08] dark:bg-white/[0.04]">
              <button type="button" onClick={() => changePeriod(-1)} aria-label="Período anterior" className="rounded-lg p-1.5 text-[#5E6D66] hover:bg-white hover:text-[#17211D] dark:text-slate-400 dark:hover:bg-white/[0.08] dark:hover:text-white"><ChevronLeft className="size-4" /></button>
              <button type="button" onClick={() => setSelectedDate(new Date())} className="px-2 text-xs font-bold capitalize text-[#17211D] dark:text-white">{periodLabel}</button>
              <button type="button" onClick={() => changePeriod(1)} aria-label="Próximo período" className="rounded-lg p-1.5 text-[#5E6D66] hover:bg-white hover:text-[#17211D] dark:text-slate-400 dark:hover:bg-white/[0.08] dark:hover:text-white"><ChevronRight className="size-4" /></button>
            </div>}
            <button type="button" onClick={loadAgenda} disabled={loading} className="inline-flex items-center gap-1.5 rounded-xl border border-[#CFE5DC] bg-[#EAF5F0] px-3 py-2 text-xs font-bold text-[#1F6F5B] transition-colors hover:bg-[#DCEFE7] disabled:opacity-60 dark:border-[#1F6F5B]/40 dark:bg-[#1F6F5B]/15 dark:text-[#63B596]"><RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />Atualizar</button>
          </div>
        </div>
      </section>

      {loading ? <div className="space-y-2 animate-pulse"><div className="h-20 rounded-2xl bg-white dark:bg-white/[0.06]" /><div className="h-20 rounded-2xl bg-white dark:bg-white/[0.06]" /></div> : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200"><p className="font-bold">Não foi possível consultar a agenda.</p><p className="mt-1 text-xs">{error}</p></div>
      ) : <>
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {[
            { label: periodMode === 'day' ? 'Consultas do dia' : 'Consultas no período', value: summary.total, icon: CalendarDays, tone: 'text-[#1F6F5B] dark:text-[#63B596]', featured: true },
            { label: 'Concluídas', value: summary.completed, icon: UserCheck, tone: 'text-[#1F6F5B] dark:text-[#63B596]' },
            { label: 'Canceladas', value: summary.canceled, icon: CalendarX2, tone: 'text-rose-600 dark:text-rose-400' },
            { label: 'Não compareceram', value: summary.noShow, icon: UserX, tone: 'text-amber-600 dark:text-amber-400' },
            { label: 'Reagendadas', value: summary.rescheduled, icon: RotateCcw, tone: 'text-sky-600 dark:text-sky-400' },
          ].map(item => <div key={item.label} className={`rounded-2xl border p-4 shadow-sm ${item.featured ? 'border-[#CFE5DC] bg-[#EAF5F0] dark:border-[#1F6F5B]/35 dark:bg-[#1F6F5B]/10' : 'border-[#DFE6E2] bg-white dark:border-white/[0.08] dark:bg-[#19231F]'}`}><item.icon className={`size-4 ${item.tone}`} /><p className="mt-3 text-2xl font-black tabular-nums text-[#17211D] dark:text-white">{item.value}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#5E6D66] dark:text-slate-400">{item.label}</p></div>)}
        </section>
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: 'Profissionais', value: summary.professionals, icon: UsersRound, helper: 'na agenda' },
            { label: 'Horas reservadas', value: `${Math.floor(summary.bookedMinutes / 60)}h${String(Math.round(summary.bookedMinutes % 60)).padStart(2, '0')}`, icon: Clock3, helper: 'sem canceladas' },
            { label: 'Presença', value: `${summary.attendanceRate.toFixed(0)}%`, icon: UserCheck, helper: 'concluídas vs. faltas' },
            { label: 'Perdas', value: `${summary.lossRate.toFixed(0)}%`, icon: UserX, helper: 'canceladas e faltas' },
          ].map(item => <div key={item.label} className="rounded-xl border border-[#DFE6E2] bg-[#F8FAF9] p-3 dark:border-white/[0.08] dark:bg-white/[0.03]"><item.icon className="size-3.5 text-[#5E6D66] dark:text-slate-400" /><p className="mt-2 text-lg font-black tabular-nums text-[#17211D] dark:text-white">{item.value}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#5E6D66] dark:text-slate-400">{item.label}</p><p className="mt-0.5 text-[10px] text-[#86938D]">{item.helper}</p></div>)}
        </section>
        <section className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <article className="rounded-2xl border border-[#CFE5DC] bg-[#EAF5F0] p-5 dark:border-[#1F6F5B]/35 dark:bg-[#1F6F5B]/10">
            <div className="flex items-start gap-3"><div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/80 text-[#1F6F5B] dark:bg-[#1F6F5B]/25 dark:text-[#63B596]"><Trophy className="size-4" /></div><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-[#1F6F5B] dark:text-[#63B596]">Procedimento com mais concluídos</p><h3 className="mt-1 truncate text-lg font-black text-[#17211D] dark:text-white">{summary.topCompletedProcedure?.[0] || 'Sem procedimentos concluídos'}</h3><p className="mt-1 text-xs text-[#5E6D66] dark:text-slate-400">{summary.topCompletedProcedure ? `${summary.topCompletedProcedure[1]} concluído${summary.topCompletedProcedure[1] === 1 ? '' : 's'} no período` : 'O indicador aparece quando houver uma consulta concluída.'}</p></div></div>
          </article>
          <article className="rounded-2xl border border-[#DFE6E2] bg-white p-5 shadow-sm dark:border-white/[0.08] dark:bg-[#19231F]">
            <div className="flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-xl bg-[#EEF2F0] text-[#1F6F5B] dark:bg-white/[0.06] dark:text-[#63B596]"><ClipboardCheck className="size-4" /></div><div><h3 className="text-sm font-bold text-[#17211D] dark:text-white">Avaliações</h3><p className="text-xs text-[#5E6D66] dark:text-slate-400">Acompanhamento exclusivo das consultas identificadas como avaliação.</p></div></div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[{ label: 'Total', value: summary.evaluations.total }, { label: 'Concluídas', value: summary.evaluations.completed }, { label: 'Remarcadas', value: summary.evaluations.rescheduled }, { label: 'Perdidas', value: summary.evaluations.lost }, { label: 'Efetividade', value: `${summary.evaluations.effectivenessRate.toFixed(0)}%`, helper: 'concluídas ÷ resultados' }].map(item => <div key={item.label} className="rounded-xl bg-[#F8FAF9] px-3 py-2.5 dark:bg-white/[0.03]"><p className="text-lg font-black tabular-nums text-[#17211D] dark:text-white">{item.value}</p><p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-[#5E6D66] dark:text-slate-400">{item.label}</p>{item.helper && <p className="mt-0.5 text-[10px] text-[#86938D]">{item.helper}</p>}</div>)}
            </div>
          </article>
        </section>
        <section className="overflow-hidden rounded-2xl border border-[#DFE6E2] bg-white shadow-sm dark:border-white/[0.08] dark:bg-[#19231F]">
          {events.length === 0 ? <div className="flex min-h-48 flex-col items-center justify-center px-5 text-center"><CalendarDays className="size-7 text-[#86938D]" /><p className="mt-3 text-sm font-bold text-[#17211D] dark:text-white">Nenhuma consulta neste período</p><p className="mt-1 text-xs text-[#5E6D66] dark:text-slate-400">A agenda foi consultada na Clínica Experts.</p></div> : <div className="divide-y divide-[#DFE6E2] dark:divide-white/[0.08]">{events.map(event => { const start = new Date(event.starts_at); const end = event.ends_at ? new Date(event.ends_at) : null; const patient = event.patient?.name || event.title || 'Paciente não informado'; const procedure = event.procedures?.map(item => item.name).filter(Boolean).join(', ') || event.type || 'Atendimento'; const rooms = event.rooms?.map(item => item.name).filter(Boolean).join(', '); return <article key={event.uuid} className="flex gap-4 p-4 sm:items-center"><div className="w-12 shrink-0 text-center"><p className="text-sm font-black tabular-nums text-[#17211D] dark:text-white">{start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>{end && <p className="mt-0.5 text-[10px] text-[#86938D]">até {end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-bold text-[#17211D] dark:text-white">{patient}</h3><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusTone(event.status)}`}>{statusLabel(event.status)}</span></div><p className="mt-1 truncate text-xs text-[#5E6D66] dark:text-slate-400">{procedure}{event.professional?.name ? ` · ${event.professional.name}` : ''}{rooms ? ` · ${rooms}` : ''}</p>{event.annotation && <p className="mt-1 truncate text-[11px] text-[#86938D]">{event.annotation}</p>}</div><Clock3 className="mt-0.5 size-4 shrink-0 text-[#86938D] sm:hidden" /></article>; })}</div>}
        </section>
      </>}
    </div>
  );
};
