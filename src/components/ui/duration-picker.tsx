import React, { useState } from 'react';
import { Check, Clock3, Pencil, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

type DurationUnit = 'minutes' | 'hours' | 'days';

interface DurationPickerProps {
  value: number;
  unit: DurationUnit;
  onChange: (value: number, unit: DurationUnit) => void;
}

const unitLabels: Record<DurationUnit, string> = {
  minutes: 'minutos',
  hours: 'horas',
  days: 'dias',
};

export const DurationPicker: React.FC<DurationPickerProps> = ({ value, unit, onChange }) => {
  const [editing, setEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(value);
  const [draftUnit, setDraftUnit] = useState<DurationUnit>(unit);
  const reduceMotion = useReducedMotion();

  const open = () => {
    setDraftValue(value);
    setDraftUnit(unit);
    setEditing(true);
  };

  const save = () => {
    onChange(Math.max(1, Number(draftValue) || 1), draftUnit);
    setEditing(false);
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] p-2.5">
      <AnimatePresence initial={false} mode="wait">
        {!editing ? (
          <motion.button
            key="summary"
            type="button"
            onClick={open}
            initial={reduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
            className="flex w-full items-center justify-between gap-3 rounded-lg px-1 py-0.5 text-left"
          >
            <span className="flex items-center gap-2 text-xs font-semibold text-[var(--text)]">
              <Clock3 className="h-4 w-4 text-[var(--primary)]" />
              Aguardar {value} {unitLabels[unit]}
            </span>
            <Pencil className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          </motion.button>
        ) : (
          <motion.div
            key="editor"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, scale: 0.98 }}
            className="grid grid-cols-[1fr_105px_auto] items-end gap-2"
          >
            <label className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
              Tempo
              <input autoFocus type="number" min="1" value={draftValue} onChange={(event) => setDraftValue(Number(event.target.value))} className="mt-1 h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text)] outline-none" />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
              Unidade
              <select value={draftUnit} onChange={(event) => setDraftUnit(event.target.value as DurationUnit)} className="mt-1 h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-xs text-[var(--text)]">
                <option value="minutes">Minutos</option>
                <option value="hours">Horas</option>
                <option value="days">Dias</option>
              </select>
            </label>
            <div className="flex gap-1 pb-0.5">
              <button type="button" onClick={() => setEditing(false)} aria-label="Cancelar alteração" className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface)]"><X className="h-4 w-4" /></button>
              <button type="button" onClick={save} aria-label="Salvar duração" className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--primary)] text-white"><Check className="h-4 w-4" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
