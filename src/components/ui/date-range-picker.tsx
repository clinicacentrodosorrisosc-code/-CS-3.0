import React, { useEffect, useRef, useState } from 'react';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { ptBR } from 'date-fns/locale';
import { type DateRange } from 'react-day-picker';
import { Calendar } from '@/components/base-ui/calendar';

interface DateRangePickerProps {
  value: { start: string; end: string };
  onChange: (range: { start: string; end: string }) => void;
  className?: string;
}

const parseLocalDate = (value?: string) => {
  if (!value) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  return year && month && day ? new Date(year, month - 1, day) : undefined;
};

const toDateKey = (date?: Date) => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDate = (value?: string) => {
  const date = parseLocalDate(value);
  return date ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(date) : '';
};

const calendarClassNames = {
  range_start: 'rounded-l-full bg-[#887CFD]/15',
  range_end: 'rounded-r-full bg-[#887CFD]/15',
  range_middle: 'rounded-none bg-[#887CFD]/15',
  day_button: 'ring-0 ring-offset-0 data-[range-start=true]:rounded-full data-[range-start=true]:bg-[#887CFD] data-[range-start=true]:text-white data-[range-end=true]:rounded-full data-[range-end=true]:bg-[#887CFD] data-[range-end=true]:text-white data-[range-middle=true]:rounded-none data-[range-middle=true]:bg-[#887CFD]/15 hover:rounded-full',
  today: 'rounded-full bg-panel font-semibold text-[#6D5CE7]',
};

export function DateRangePicker({ value, onChange, className = '' }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected: DateRange | undefined = value.start
    ? { from: parseLocalDate(value.start), to: parseLocalDate(value.end) }
    : undefined;

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  const label = value.start
    ? value.end ? `${formatDate(value.start)} – ${formatDate(value.end)}` : formatDate(value.start)
    : 'Selecionar período';

  const handleSelect = (range: DateRange | undefined) => {
    onChange({ start: toDateKey(range?.from), end: toDateKey(range?.to) });
    if (range?.from && range?.to) setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(open => !open)}
        className="flex min-w-[170px] w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-text shadow-sm transition-colors hover:bg-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#887CFD]/35"
      >
        <span className="flex min-w-0 items-center gap-2">
          <CalendarIcon className="size-4 shrink-0 text-[#887CFD]" />
          <span className="truncate capitalize">{label}</span>
        </span>
        <ChevronDown className={`size-3.5 shrink-0 text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div role="dialog" aria-label="Selecionar período" className="absolute left-0 top-full z-50 mt-2 w-[310px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border/60 bg-surface p-1 shadow-xl">
          <Calendar
            mode="range"
            locale={ptBR}
            defaultMonth={selected?.from}
            selected={selected}
            onSelect={handleSelect}
            className="rounded-2xl p-3"
            classNames={calendarClassNames}
          />
          <p className="border-t border-border/60 px-3 py-2 text-center text-[10px] text-muted" role="status">
            Selecione a data inicial e a data final
          </p>
        </div>
      )}
    </div>
  );
}