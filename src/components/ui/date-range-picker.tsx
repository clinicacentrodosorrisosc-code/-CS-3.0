import { useEffect, useRef, useState } from 'react';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { ptBR } from 'date-fns/locale';
import { type DateRange } from 'react-day-picker';
import { Calendar } from '@/components/base-ui/calendar';

type PeriodMode = 'week' | 'month' | 'custom';

interface DateRangePickerProps {
  value: { start: string; end: string };
  onChange: (range: { start: string; end: string }) => void;
  className?: string;
  /** Ativa o seletor Semana/Mês translúcido usado nos painéis financeiros e operacionais. */
  periodSelector?: boolean;
  onPeriodModeChange?: (mode: PeriodMode) => void;
}

const parseLocalDate = (value?: string) => {
  if (!value) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  return year && month && day ? new Date(year, month - 1, day) : undefined;
};
const toDateKey = (date?: Date) => date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : '';
const formatDate = (value?: string) => {
  const date = parseLocalDate(value);
  return date ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(date).replace('.', '') : '';
};
const startOfWeek = (date: Date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - start.getDay());
  return start;
};
const endOfWeek = (date: Date) => {
  const end = startOfWeek(date);
  end.setDate(end.getDate() + 6);
  return end;
};

export function DateRangePicker({ value, onChange, className = '', periodSelector = false, onPeriodModeChange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [periodMode, setPeriodMode] = useState<PeriodMode>('month');
  const containerRef = useRef<HTMLDivElement>(null);
  const selected: DateRange | undefined = value.start ? { from: parseLocalDate(value.start), to: parseLocalDate(value.end) } : undefined;

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setIsOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape); };
  }, []);

  const setPreset = (mode: Extract<PeriodMode, 'week' | 'month'>) => {
    const baseDate = new Date();
    const range = mode === 'week'
      ? { start: toDateKey(startOfWeek(baseDate)), end: toDateKey(endOfWeek(baseDate)) }
      : { start: toDateKey(new Date(baseDate.getFullYear(), baseDate.getMonth(), 1)), end: toDateKey(new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0)) };
    setPeriodMode(mode);
    onPeriodModeChange?.(mode);
    onChange(range);
    setIsOpen(false);
  };

  const handleSelect = (range: DateRange | undefined) => {
    const next = { start: toDateKey(range?.from), end: toDateKey(range?.to) };
    onChange(next);
    if (range?.from && range?.to) {
      setPeriodMode('custom');
      onPeriodModeChange?.('custom');
      setIsOpen(false);
    }
  };

  const label = value.start
    ? value.end ? `${formatDate(value.start)} a ${formatDate(value.end)}` : formatDate(value.start)
    : 'Selecionar período';

  return <div ref={containerRef} className={`relative ${className}`}>
    <button type="button" aria-haspopup="dialog" aria-expanded={isOpen} onClick={() => setIsOpen(open => !open)} className="flex min-w-[170px] w-full items-center justify-between gap-2 rounded-xl border border-white/25 bg-white/35 px-3 py-2 text-xs font-semibold text-text shadow-[inset_0_1px_0_rgba(255,255,255,0.42),0_12px_28px_rgba(31,111,91,0.10)] backdrop-blur-xl transition-colors hover:bg-white/50 dark:border-white/[0.13] dark:bg-white/[0.06] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_12px_28px_rgba(0,0,0,0.16)] dark:hover:bg-white/[0.10] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F6F5B]/40"><span className="flex min-w-0 items-center gap-2"><CalendarIcon className="size-4 shrink-0 text-[#1F6F5B] dark:text-[#63B596]" /><span className="truncate capitalize">{label}</span></span><ChevronDown className={`size-3.5 shrink-0 text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} /></button>
    {isOpen && <div role="dialog" aria-label="Selecionar período" className="absolute left-0 top-full z-50 mt-2 w-[318px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-white/30 bg-white/55 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_18px_48px_rgba(31,111,91,0.18)] backdrop-blur-2xl dark:border-white/[0.13] dark:bg-[#17211D]/75 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_18px_48px_rgba(0,0,0,0.35)]">
      {periodSelector && <div className="mb-2 flex w-fit rounded-xl border border-white/35 bg-white/30 p-1 dark:border-white/[0.12] dark:bg-white/[0.06]">
        <button type="button" onClick={() => setPreset('week')} className={`rounded-lg px-4 py-1.5 text-[11px] font-bold transition-all ${periodMode === 'week' ? 'bg-white text-[#17211D] shadow-sm dark:bg-white/90' : 'text-[#5E6D66] hover:text-[#17211D] dark:text-slate-300 dark:hover:text-white'}`}>Semana</button>
        <button type="button" onClick={() => setPreset('month')} className={`rounded-lg px-4 py-1.5 text-[11px] font-bold transition-all ${periodMode === 'month' ? 'bg-white text-[#17211D] shadow-sm dark:bg-white/90' : 'text-[#5E6D66] hover:text-[#17211D] dark:text-slate-300 dark:hover:text-white'}`}>Mês</button>
      </div>}
      <Calendar mode="range" locale={ptBR} defaultMonth={selected?.from} selected={selected} onSelect={handleSelect} className="rounded-xl bg-transparent p-2" />
      <p className="border-t border-white/30 px-3 py-2 text-center text-[10px] font-medium text-[#5E6D66] dark:border-white/[0.10] dark:text-slate-400" role="status">Clique na data inicial e na data final</p>
    </div>}
  </div>;
}
