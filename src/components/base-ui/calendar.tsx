import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker, getDefaultClassNames, type DayPickerProps } from 'react-day-picker';

export type CalendarProps = DayPickerProps;

export function Calendar({ className = '', classNames, components, ...props }: CalendarProps) {
  const defaults = getDefaultClassNames();

  return (
    <DayPicker
      {...props}
      className={`${className} bg-surface text-text`}
      classNames={{
        ...defaults,
        months: `${defaults.months} flex flex-col`,
        month_caption: `${defaults.month_caption} relative flex h-10 items-center justify-center`,
        caption_label: `${defaults.caption_label} text-sm font-semibold capitalize`,
        nav: `${defaults.nav} absolute inset-x-3 top-3 flex items-center justify-between`,
        button_previous: `${defaults.button_previous} inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40`,
        button_next: `${defaults.button_next} inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40`,
        month_grid: `${defaults.month_grid} w-full border-collapse`,
        weekdays: `${defaults.weekdays} grid grid-cols-7`,
        weekday: `${defaults.weekday} py-2 text-center text-[10px] font-semibold uppercase text-muted`,
        week: `${defaults.week} grid grid-cols-7`,
        day: `${defaults.day} relative flex h-9 items-center justify-center p-0 text-center text-xs`,
        day_button: `${defaults.day_button} inline-flex size-9 items-center justify-center rounded-full transition-colors hover:bg-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40`,
        outside: `${defaults.outside} text-muted opacity-35`,
        disabled: `${defaults.disabled} pointer-events-none opacity-30`,
        today: `${defaults.today} font-semibold text-accent`,
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => orientation === 'left'
          ? <ChevronLeft className="size-4" />
          : <ChevronRight className="size-4" />,
        ...components,
      }}
    />
  );
}
