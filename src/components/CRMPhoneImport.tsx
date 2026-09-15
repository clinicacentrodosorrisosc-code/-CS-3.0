import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, FileSpreadsheet, Loader2, Phone, Upload, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient';

type Opportunity = { id: string; patient_external_id: string | null; patient_name: string | null; patient_phone: string | null };
type ImportUpdate = { id: string; phone: string };
type Analysis = {
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  matchedNames: number;
  updates: ImportUpdate[];
  unmatchedNames: string[];
  ambiguousNames: string[];
};

const normalizeName = (value: unknown) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
const normalizeHeader = (value: unknown) => normalizeName(value).replace(/\s/g, '');
const normalizePhone = (value: unknown) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits.length >= 12 && digits.length <= 15 ? digits : '';
};
const hasValidPhone = (value: unknown) => normalizePhone(value).length >= 12;

function findColumns(rows: unknown[][]) {
  const nameAliases = ['nome', 'name', 'nomedopaciente', 'nomepaciente', 'nomedolead', 'nomelead', 'contato', 'paciente', 'lead'];
  const phoneAliases = ['telefone', 'phone', 'celular', 'whatsapp', 'fone', 'mobile', 'numero'];
  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 20); rowIndex += 1) {
    const headers = rows[rowIndex].map(normalizeHeader);
    const exactOrContaining = (aliases: string[]) => {
      const exact = headers.findIndex(header => aliases.includes(header));
      return exact >= 0 ? exact : headers.findIndex(header => aliases.some(alias => header.includes(alias)));
    };
    const nameIndex = exactOrContaining(nameAliases);
    const phoneIndex = exactOrContaining(phoneAliases);
    if (nameIndex >= 0 && phoneIndex >= 0 && nameIndex !== phoneIndex) return { headerRow: rowIndex, nameIndex, phoneIndex };
  }
  return null;
}

function analyzeWorkbook(fileName: string, rows: unknown[][], opportunities: Opportunity[]): Analysis {
  const columns = findColumns(rows);
  if (!columns) throw new Error('Não encontrei colunas de Nome e Telefone. Renomeie os cabeçalhos e tente novamente.');
  const fileEntries = rows.slice(columns.headerRow + 1).map(row => ({ name: String(row[columns.nameIndex] || '').trim(), phone: normalizePhone(row[columns.phoneIndex]) })).filter(item => item.name || item.phone);
  const phonesByName = new Map<string, { displayName: string; phones: Set<string> }>();
  let invalidRows = 0;
  for (const entry of fileEntries) {
    const key = normalizeName(entry.name);
    if (!key || !entry.phone) { invalidRows += 1; continue; }
    const current = phonesByName.get(key) || { displayName: entry.name, phones: new Set<string>() };
    current.phones.add(entry.phone);
    phonesByName.set(key, current);
  }

  const cardsByName = new Map<string, Opportunity[]>();
  for (const opportunity of opportunities) {
    const key = normalizeName(opportunity.patient_name);
    if (!key) continue;
    const cards = cardsByName.get(key) || [];
    cards.push(opportunity);
    cardsByName.set(key, cards);
  }

  const updates: ImportUpdate[] = [];
  const unmatchedNames: string[] = [];
  const ambiguousNames: string[] = [];
  let matchedNames = 0;
  for (const [key, fileEntry] of phonesByName) {
    const cards = cardsByName.get(key) || [];
    if (!cards.length) { unmatchedNames.push(fileEntry.displayName); continue; }
    const patientIds = new Set(cards.map(card => card.patient_external_id).filter(Boolean));
    if (fileEntry.phones.size !== 1 || patientIds.size > 1) { ambiguousNames.push(fileEntry.displayName); continue; }
    const missingCards = cards.filter(card => !hasValidPhone(card.patient_phone));
    if (!missingCards.length) continue;
    const phone = Array.from(fileEntry.phones)[0];
    missingCards.forEach(card => updates.push({ id: card.id, phone }));
    matchedNames += 1;
  }

  return { fileName, totalRows: fileEntries.length, validRows: fileEntries.length - invalidRows, invalidRows, matchedNames, updates, unmatchedNames, ambiguousNames };
}

export const CRMPhoneImport: React.FC<{ opportunities: Opportunity[]; onClose: () => void; onImported: (updated: number) => void }> = ({ opportunities, onClose, onImported }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !importing) onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', handleKeyDown); };
  }, [importing, onClose]);

  const issues = useMemo(() => [...(analysis?.ambiguousNames || []).map(name => ({ name, reason: 'Nome duplicado ou telefones diferentes' })), ...(analysis?.unmatchedNames || []).map(name => ({ name, reason: 'Nenhum card com este nome' }))].slice(0, 8), [analysis]);

  const readFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError('O arquivo deve ter no máximo 10 MB.'); return; }
    setReading(true); setError(''); setAnalysis(null);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error('O arquivo não possui uma planilha legível.');
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: false });
      setAnalysis(analyzeWorkbook(file.name, rows, opportunities));
    } catch (currentError) { setError(currentError instanceof Error ? currentError.message : 'Não foi possível ler o arquivo.'); }
    finally { setReading(false); if (inputRef.current) inputRef.current.value = ''; }
  };

  const importPhones = async () => {
    if (!analysis?.updates.length) return;
    setImporting(true); setError('');
    try {
      const { data, error: importError } = await supabase.rpc('import_clinic_experts_opportunity_phones', { p_updates: analysis.updates });
      if (importError) throw importError;
      onImported(Number(data || 0));
      onClose();
    } catch (currentError) { setError(currentError instanceof Error ? currentError.message : 'Não foi possível importar os telefones.'); }
    finally { setImporting(false); }
  };

  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 sm:items-center sm:p-6" onMouseDown={() => { if (!importing) onClose(); }} role="presentation">
    <section className="flex max-h-[90dvh] w-full max-w-3xl flex-col rounded-t-2xl bg-[var(--surface)] shadow-2xl sm:rounded-2xl" onMouseDown={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Importar telefones">
      <header className="flex items-start justify-between gap-4 border-b border-[var(--border)] p-5"><div><p className="text-[11px] font-semibold text-[var(--primary)]">Clínica Experts</p><h2 className="mt-1 text-xl font-bold tracking-tight">Importar telefones dos leads</h2><p className="mt-1 text-xs text-[var(--text-muted)]">O sistema relaciona Nome + Telefone e atualiza somente cards sem número válido.</p></div><button type="button" onClick={onClose} disabled={importing} aria-label="Fechar importação" className="rounded-lg p-2 transition hover:bg-[var(--surface-hover)] disabled:opacity-40"><X className="h-5 w-5" /></button></header>
      <div className="custom-scrollbar overflow-y-auto p-5">
        {error && <p className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}
        <input ref={inputRef} type="file" accept=".csv,.xls,.xlsx" className="hidden" onChange={event => void readFile(event.target.files?.[0])} />
        <button type="button" onClick={() => inputRef.current?.click()} disabled={reading || importing} className="flex min-h-36 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-subtle)] p-6 text-center transition hover:border-[var(--primary)]/50 hover:bg-[var(--surface-hover)] disabled:opacity-50">{reading ? <Loader2 className="h-7 w-7 animate-spin text-[var(--primary)]" /> : <FileSpreadsheet className="h-7 w-7 text-[var(--primary)]" />}<strong className="mt-3 text-sm">{reading ? 'Lendo planilha' : 'Selecionar CSV ou Excel'}</strong><span className="mt-1 text-xs text-[var(--text-muted)]">Cabeçalhos esperados: Nome e Telefone, Celular ou WhatsApp</span></button>

        {analysis && <div className="mt-5 space-y-4"><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /><p className="truncate text-xs font-semibold">{analysis.fileName}</p></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><article className="rounded-xl bg-[var(--bg-subtle)] p-3"><span className="text-[10px] text-[var(--text-muted)]">Linhas lidas</span><strong className="mt-1 block font-mono text-lg">{analysis.totalRows}</strong></article><article className="rounded-xl bg-[var(--bg-subtle)] p-3"><span className="text-[10px] text-[var(--text-muted)]">Nomes vinculados</span><strong className="mt-1 block font-mono text-lg">{analysis.matchedNames}</strong></article><article className="rounded-xl bg-[var(--bg-subtle)] p-3"><span className="text-[10px] text-[var(--text-muted)]">Cards a atualizar</span><strong className="mt-1 block font-mono text-lg text-emerald-700 dark:text-emerald-300">{analysis.updates.length}</strong></article><article className="rounded-xl bg-[var(--bg-subtle)] p-3"><span className="text-[10px] text-[var(--text-muted)]">Com erro</span><strong className="mt-1 block font-mono text-lg text-amber-700 dark:text-amber-300">{analysis.invalidRows + analysis.unmatchedNames.length + analysis.ambiguousNames.length}</strong></article></div>
          {issues.length > 0 && <div className="rounded-xl border border-[var(--border)]"><div className="border-b border-[var(--border)] px-3 py-2 text-[10px] font-semibold text-[var(--text-muted)]">Itens que precisam de conferência</div>{issues.map(issue => <div key={`${issue.name}-${issue.reason}`} className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-3 py-2 last:border-0"><span className="truncate text-xs">{issue.name}</span><span className="shrink-0 text-[10px] text-amber-700 dark:text-amber-300">{issue.reason}</span></div>)}</div>}
          <p className="flex items-start gap-2 text-[10px] leading-relaxed text-[var(--text-muted)]"><Phone className="mt-0.5 h-3.5 w-3.5 shrink-0" />Nomes são comparados sem diferença de maiúsculas e acentos. Nomes duplicados não são importados automaticamente.</p></div>}
      </div>
      <footer className="flex items-center justify-between gap-3 border-t border-[var(--border)] p-4"><button type="button" onClick={onClose} disabled={importing} className="rounded-xl px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]">Cancelar</button><button type="button" onClick={() => void importPhones()} disabled={!analysis?.updates.length || importing} className="flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50">{importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{importing ? 'Importando...' : `Importar ${analysis?.updates.length || 0} cards`}</button></footer>
    </section>
  </div>;
};
