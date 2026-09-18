import React from 'react';
import { Check } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';

export const StepIndicator: React.FC<{ steps: string[]; current: number }> = ({ steps, current }) => {
  const reduced = useReducedMotion();
  return <ol className="grid gap-2 sm:grid-cols-4" aria-label="Progresso da configuração">
    {steps.map((label, index) => { const done = index < current; const active = index === current; return <li key={label} className="relative flex items-center gap-2 rounded-xl bg-[var(--bg-subtle)] px-3 py-2.5">
      <motion.span layout={!reduced} className={`grid size-5 shrink-0 place-items-center rounded-md text-[10px] font-bold ${done || active ? 'bg-[var(--primary)] text-white' : 'bg-[var(--surface-elevated)] text-[var(--text-muted)]'}`}>{done ? <Check className="size-3" /> : index + 1}</motion.span>
      <span className={`truncate text-[10px] font-semibold ${active ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'}`}>{label}</span>
      {active && <motion.span layoutId="campaign-step" className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[var(--primary)]" />}
    </li>; })}
  </ol>;
};
