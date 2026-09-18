import React, { useState } from 'react';
import { Check, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

export const ConfirmAction: React.FC<{ onConfirm: () => void; label?: string; disabled?: boolean }> = ({ onConfirm, label = 'Excluir', disabled }) => {
  const [open, setOpen] = useState(false); const reduced = useReducedMotion();
  return <motion.div layout className="inline-flex h-9 items-center overflow-hidden rounded-xl border border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger-text)]">
    <button type="button" disabled={disabled} onClick={() => setOpen(value => !value)} className="grid h-9 w-9 place-items-center disabled:opacity-40" aria-expanded={open} aria-label={label}><Trash2 className="size-4" /></button>
    <AnimatePresence initial={false}>{open && <motion.div initial={reduced ? false : { opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} className="flex items-center overflow-hidden"><span className="whitespace-nowrap px-1 text-[10px] font-semibold">Confirmar?</span><button onClick={() => { onConfirm(); setOpen(false); }} className="grid size-8 place-items-center hover:bg-[var(--danger-dim)]" aria-label="Confirmar"><Check className="size-3.5" /></button><button onClick={() => setOpen(false)} className="grid size-8 place-items-center hover:bg-[var(--surface-hover)]" aria-label="Cancelar"><X className="size-3.5" /></button></motion.div>}</AnimatePresence>
  </motion.div>;
};
