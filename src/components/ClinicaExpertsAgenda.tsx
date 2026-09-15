import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, RefreshCw, UserRound, UsersRound } from 'lucide-react';
import { supabase } from '../supabaseClient';

type AgendaEvent = {
  id: number | string;
  title?: string | null;
  type?: string | null;
  annotation?: string | null;
  starts_at: string;
  ends_at?: string | null;
  status?: string | null;
  patient?: { name?: string | null } | null;
  professional?: { name?: string | null } | null;
  room?: { name?: string | null } | null;
  procedures?: Array<{ name?: string | null }>;
};

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
  if (normalized.includes('confirm')) return 'Confirmado';
  if (normalized.includes('cancel')) return 'Cancelado';
  if (normalized.includes('remarc')) return 'Remarcado';
  if (normalized.includes('conclu') || normalized.includes('finaliz')) return 'Concluído';
  return value || 'Agendado';
};

export const ClinicaExpertsAgenda: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAgenda = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sua sessão expirou. Entre novamente para consultar a agenda.');
      const params = new URLSearchParams({ starts_at: formatApiDate(selectedDate), ends_at: formatApiDate(selectedDate, true) });
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
  }, [selectedDate]);

  useEffect(() => { loadAgenda(); }, [loadAgenda]);

  const summary = useMemo(() => ({
    total: events.length,
    confirmed: events.filter(event => String(event.status || '').toLowerCase().includes('confirm')).length,
    professionals: new Set(events.map(event => event.professional?.name).filter(Boolean)).size,
  }), [events]);

  const changeDay = (amount: number) => setSelectedDate(current => {
    const next = new Date(current);
    next.setDate(next.getDate() + amount);
    return next;
  });

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[#DFE6E2] bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#19231F]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#EAF5F0] text-[#1F6F5B] dark:bg-[#1F6F5B]/20 dark:text-[#63B596]"><CalendarDays className="size-5" /></div>
            <div><h2 className="text-sm font-bold text-[#17211D] dark:text-white">Agenda Clínica Experts</h2><p className="text-xs text-[#5E6D66] dark:text-slate-400">Consultas lidas diretamente da agenda oficial.</p></div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-xl border border-[#DFE6E2] bg-[#F5F7F6] p-1 dark:border-white/[0.08] dark:bg-white/[0.04]">
              <button type="button" onClick={() => changeDay(-1)} aria-label="Dia anterior" className="rounded-lg p-1.5 text-[#5E6D66] hover:bg-white hover:text-[#17211D] dark:text-slate-400 dark:hover:bg-white/[0.08] dark:hover:text-white"><ChevronLeft className="size-4" /></button>
              <button type="button" onClick={() => setSelectedDate(new Date())} className="px-2 text-xs font-bold capitalize text-[#17211D] dark:text-white">{selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</button>
              <button type="button" onClick={() => changeDay(1)} aria-label="Próximo dia" className="rounded-lg p-1.5 text-[#5E6D66] hover:bg-white hover:text-[#17211D] dark:text-slate-400 dark:hover:bg-white/[0.08] dark:hover:text-white"><ChevronRight className="size-4" /></button>
            </div>
            <button type="button" onClick={loadAgenda} disabled={loading} className="inline-flex items-center gap-1.5 rounded-xl border border-[#CFE5DC] bg-[#EAF5F0] px-3 py-2 text-xs font-bold text-[#1F6F5B] transition-colors hover:bg-[#DCEFE7] disabled:opacity-60 dark:border-[#1F6F5B]/40 dark:bg-[#1F6F5B]/15 dark:text-[#63B596]"><RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />Atualizar</button>
          </div>
        </div>
      </section>

      {loading ? <div className="space-y-2 animate-pulse"><div className="h-20 rounded-2xl bg-white dark:bg-white/[0.06]" /><div className="h-20 rounded-2xl bg-white dark:bg-white/[0.06]" /></div> : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200"><p className="font-bold">Não foi possível consultar a agenda.</p><p className="mt-1 text-xs">{error}</p></div>
      ) : <>
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[{ label: 'Consultas do dia', value: summary.total, icon: CalendarDays }, { label: 'Confirmadas', value: summary.confirmed, icon: UserRound }, { label: 'Profissionais', value: summary.professionals, icon: UsersRound }].map(item => <div key={item.label} className="rounded-2xl border border-[#DFE6E2] bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#19231F]"><item.icon className="size-4 text-[#1F6F5B] dark:text-[#63B596]" /><p className="mt-3 text-2xl font-black tabular-nums text-[#17211D] dark:text-white">{item.value}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#5E6D66] dark:text-slate-400">{item.label}</p></div>)}
        </section>
        <section className="overflow-hidden rounded-2xl border border-[#DFE6E2] bg-white shadow-sm dark:border-white/[0.08] dark:bg-[#19231F]">
          {events.length === 0 ? <div className="flex min-h-48 flex-col items-center justify-center px-5 text-center"><CalendarDays className="size-7 text-[#86938D]" /><p className="mt-3 text-sm font-bold text-[#17211D] dark:text-white">Nenhuma consulta para este dia</p><p className="mt-1 text-xs text-[#5E6D66] dark:text-slate-400">A agenda foi consultada na Clínica Experts.</p></div> : <div className="divide-y divide-[#DFE6E2] dark:divide-white/[0.08]">{events.map(event => { const start = new Date(event.starts_at); const end = event.ends_at ? new Date(event.ends_at) : null; const patient = event.patient?.name || event.title || 'Paciente não informado'; const procedure = event.procedures?.map(item => item.name).filter(Boolean).join(', ') || event.type || 'Atendimento'; return <article key={event.id} className="flex gap-4 p-4 sm:items-center"><div className="w-12 shrink-0 text-center"><p className="text-sm font-black tabular-nums text-[#17211D] dark:text-white">{start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>{end && <p className="mt-0.5 text-[10px] text-[#86938D]">até {end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-bold text-[#17211D] dark:text-white">{patient}</h3><span className="rounded-full bg-[#EAF5F0] px-2 py-0.5 text-[10px] font-bold text-[#1F6F5B] dark:bg-[#1F6F5B]/20 dark:text-[#63B596]">{statusLabel(event.status)}</span></div><p className="mt-1 truncate text-xs text-[#5E6D66] dark:text-slate-400">{procedure}{event.professional?.name ? ` · ${event.professional.name}` : ''}{event.room?.name ? ` · ${event.room.name}` : ''}</p>{event.annotation && <p className="mt-1 truncate text-[11px] text-[#86938D]">{event.annotation}</p>}</div><Clock3 className="mt-0.5 size-4 shrink-0 text-[#86938D] sm:hidden" /></article>; })}</div>}
        </section>
      </>}
    </div>
  );
};
