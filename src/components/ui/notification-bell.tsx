import React, { useEffect } from 'react';
import { Bell } from 'lucide-react';
import { animate, motion, useMotionValue, useReducedMotion } from 'motion/react';

export const NotificationBell: React.FC<{ count: number; onClick?: () => void }> = ({ count, onClick }) => {
  const rotate = useMotionValue(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!count || reduced) return;
    const control = animate(rotate, [0, -14, 11, -8, 5, 0], { duration: 0.55, ease: 'easeOut' });
    return () => control.stop();
  }, [count, reduced, rotate]);
  return <motion.button type="button" onClick={onClick} whileTap={reduced ? undefined : { scale: 0.9 }} className="relative grid size-9 place-items-center rounded-xl text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]" aria-label={count ? `${count} notificações` : 'Notificações'}>
    <motion.span style={{ rotate, transformOrigin: '50% 12%' }}><Bell className="size-4" /></motion.span>
    {count > 0 && <motion.span key={count} initial={reduced ? false : { scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-md bg-[var(--danger)] px-1 text-[9px] font-bold text-white ring-2 ring-[var(--surface)]">{count > 99 ? '99+' : count}</motion.span>}
  </motion.button>;
};
