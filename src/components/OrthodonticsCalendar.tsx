import React, { useMemo } from 'react';
import { SpotlightCard } from './ui/spotlight-card';

interface OrthodonticsCalendarProps {
  currentYear: string;
  selectedMonth: string;
  isOrthoDay: (date: Date) => boolean;
  onDayClick?: (date: Date) => void;
  selectedDate?: Date | null;
  getDayStatus?: (date: Date) => 'Present' | 'Absent' | 'Scheduled' | 'None';
  title?: string;
}

const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const OrthodonticsCalendar: React.FC<OrthodonticsCalendarProps> = ({
  currentYear,
  selectedMonth,
  isOrthoDay,
  onDayClick,
  selectedDate = null,
  getDayStatus,
  title,
}) => {
  const year = parseInt(currentYear);
  const month = parseInt(selectedMonth) - 1;

  const days = useMemo(() => {
    const totalDays = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const daysArr = [];

    for (let i = 0; i < firstDay; i++) {
      daysArr.push(null);
    }
    for (let i = 1; i <= totalDays; i++) {
      daysArr.push(new Date(year, month, i));
    }
    return daysArr;
  }, [year, month]);

  return (
    <SpotlightCard className="glass-panel rounded-2xl p-6 relative overflow-hidden col-span-1" spotlightColor="rgba(59, 130, 246, 0.4)">
      <h4 className="text-text font-semibold text-sm mb-4">{title || 'Escolha a data'}</h4>
      <div className="grid grid-cols-7 gap-2 text-center text-[10px] text-slate-400 font-bold mb-2">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, index) => <span key={`${d}-${index}`}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.map((date, i) => {
          if (!date) return <div key={i} />;
          
          const orthoDay = isOrthoDay(date);
          const status = getDayStatus?.(date) || 'None';
          const isSelected = Boolean(selectedDate && formatDateKey(selectedDate) === formatDateKey(date));
          const statusClass = status === 'Present'
            ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
            : status === 'Scheduled'
              ? 'border-amber-300 bg-amber-50 text-amber-700'
              : status === 'Absent'
                ? 'border-red-300 bg-red-50 text-red-700'
                : orthoDay
                  ? 'border-[var(--primary-border)] bg-[var(--primary-dim)] text-[var(--primary)]'
                  : 'border-border bg-panel text-slate-500';
          const statusLabel = status === 'Scheduled' ? 'Agendado' : status === 'Present' ? 'Presente' : status === 'Absent' ? 'Faltou' : 'Sem registro';

          return (
            <button
              type="button"
              key={i}
              onClick={() => onDayClick?.(date)}
              className={`flex h-9 items-center justify-center rounded-lg border text-xs font-semibold transition-colors ${statusClass} ${
                isSelected ? 'ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--surface)]' : 'hover:border-[var(--primary)]'
              }`}
              aria-pressed={isSelected}
              title={`${date.toLocaleDateString('pt-BR')} - ${statusLabel}`}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </SpotlightCard>
  );
};
