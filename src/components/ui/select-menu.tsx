import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';

export type SelectMenuOption = {
  value: string;
  label: string;
  disabled?: boolean;
  group?: string;
};

type SelectMenuProps = {
  value: string;
  options: readonly SelectMenuOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
};

export function SelectMenu({ value, options, onChange, placeholder = 'Selecionar...', searchPlaceholder = 'Buscar...', className = '', disabled = false }: SelectMenuProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find(option => option.value === value);
  const filtered = useMemo(() => options.filter(option => option.label.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [options, query]);
  const groups = useMemo(() => [...new Set(filtered.map(option => option.group || ''))], [filtered]);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => { document.removeEventListener('mousedown', handleOutside); document.removeEventListener('keydown', handleEscape); };
  }, []);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button type="button" id={id} role="combobox" aria-expanded={open} disabled={disabled} onClick={() => setOpen(current => !current)} className="flex h-10 w-full items-center justify-between rounded-xl border border-border/60 bg-background px-3 text-sm font-normal text-text shadow-sm outline-none transition-colors hover:bg-accent/20 focus-visible:ring-2 focus-visible:ring-[#887CFD]/35 disabled:cursor-not-allowed disabled:opacity-50">
        <span className={`truncate ${selected ? 'text-text' : 'text-muted'}`}>{selected?.label || placeholder}</span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted" aria-hidden="true" />
      </button>
      {open && (
        <div role="listbox" aria-labelledby={id} className="absolute left-0 top-full z-50 mt-2 w-full min-w-[var(--select-menu-width)] overflow-hidden rounded-xl border border-border/60 bg-surface shadow-xl">
          <div className="flex items-center gap-2 border-b border-border/60 px-3">
            <Search className="size-3.5 shrink-0 text-muted" />
            <input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder={searchPlaceholder} className="h-9 min-w-0 flex-1 bg-transparent text-xs text-text outline-none placeholder:text-muted" />
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {!filtered.length && <p className="px-3 py-5 text-center text-xs text-muted">Nenhuma opção encontrada.</p>}
            {groups.map(group => (
              <React.Fragment key={group || 'default'}>
                {group && <p className="px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted">{group}</p>}
                {filtered.filter(option => (option.group || '') === group).map(option => (
                  <button key={option.value} type="button" role="option" aria-selected={value === option.value} disabled={option.disabled} onClick={() => { onChange(option.value); setOpen(false); setQuery(''); }} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs text-text transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40">
                    <span className="truncate">{option.label}</span>
                    {value === option.value && <Check className="size-3.5 shrink-0 text-[#887CFD]" />}
                  </button>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
