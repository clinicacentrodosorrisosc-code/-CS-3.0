import React, { useMemo } from 'react';
import { SpotlightCard } from './ui/spotlight-card';

interface OrthodonticsCalendarProps {
  currentYear: string;
  selectedMonth: string;
  isOrthoDay: (date: Date) => boolean;
  onDayClick?: (date: Date) => void;
}

export const OrthodonticsCalendar: React.FC<OrthodonticsCalendarProps> = ({ currentYear, selectedMonth, isOrthoDay, onDayClick }) => {
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
      <h4 className="text-text font-bold text-sm mb-4">Calendário de Pacing</h4>
      <div className="grid grid-cols-7 gap-2 text-center text-[10px] text-slate-400 font-bold mb-2">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, index) => <span key={`${d}-${index}`}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.map((date, i) => {
          if (!date) return <div key={i} />;
          
          const orthoDay = isOrthoDay(date);
          
          return (
            <div 
              key={i} 
              onClick={() => onDayClick?.(date)}
              className={`flex items-center justify-center h-8 rounded-lg text-xs font-bold cursor-pointer ${
                orthoDay ? 'bg-blue-500 text-text' : 'bg-panel text-slate-500'
              }`}
            >
              {date.getDate()}
            </div>
          );
        })}
      </div>
    </SpotlightCard>
  );
};
