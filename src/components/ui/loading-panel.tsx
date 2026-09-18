import React from 'react';
import { motion, useReducedMotion } from 'motion/react';

interface LoadingPanelProps {
  label: string;
  description?: string;
  fullScreen?: boolean;
  action?: React.ReactNode;
}

export const LoadingPanel: React.FC<LoadingPanelProps> = ({ label, description, fullScreen = false, action }) => {
  const reduceMotion = useReducedMotion();

  return (
    <div className={`flex items-center justify-center p-6 ${fullScreen ? 'min-h-[100dvh] bg-[var(--background)]' : 'h-full min-h-56'}`} role="status" aria-live="polite">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 shadow-[0_18px_60px_rgba(24,39,32,0.08)]">
        <div className="flex items-center gap-1.5" aria-hidden="true">
          {Array.from({ length: 12 }).map((_, index) => (
            <motion.span
              key={index}
              className="h-1 flex-1 rounded-full bg-[var(--primary)]"
              initial={reduceMotion ? false : { opacity: 0.14, scaleX: 0.55 }}
              animate={reduceMotion ? { opacity: 0.7, scaleX: 1 } : { opacity: [0.14, 0.95, 0.14], scaleX: [0.55, 1, 0.55] }}
              transition={reduceMotion ? undefined : { duration: 1.25, repeat: Infinity, delay: index * 0.06, ease: 'easeInOut' }}
            />
          ))}
        </div>
        <p className="mt-5 text-sm font-semibold tracking-[-0.01em] text-[var(--text)]">{label}</p>
        {description && <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{description}</p>}
        <div className="mt-5 space-y-2" aria-hidden="true">
          <div className="h-2.5 w-full animate-pulse rounded-md bg-[var(--surface-high)]" />
          <div className="h-2.5 w-4/5 animate-pulse rounded-md bg-[var(--surface-high)]" />
          <div className="h-2.5 w-3/5 animate-pulse rounded-md bg-[var(--surface-high)]" />
        </div>
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
};
