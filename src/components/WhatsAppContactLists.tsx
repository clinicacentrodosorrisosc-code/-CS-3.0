import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, FileSpreadsheet, ListPlus, Loader2, Trash2, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient';

type ContactList = {
  id: string;
  name: string;
  description?: string | null;
  source_file_name?: string | null;
  total_contacts: number;
  valid_contacts: number;
  invalid_contacts: number;
  duplicate_contacts: number;
  created_at: string;
};

type ImportedContact = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  status: 'valid' | 'invalid' | 'duplicate';
  error_message?: string | null;
};

type SheetRow = Record<string, string | number | boolean | null>;

const normalizeHeader = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, ' ').trim();

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sessão expirada. Entre novamente.');
  return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };
}

function guessColumn(headers: string[], candidates: string[]) {
  return headers.find(header => candidates.some(candidate => normalizeHeader(header) === candidate))
    || headers.find(header => candidates.some(candidate => normalizeHeader(header).includes(candidate)))
    || '';
}

export const WhatsAppContactLists: React.FC<{ onChanged?: () => void }> = ({ onChanged }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lists, setLists] = useState<ContactList[]>([]);
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [listName, setListName] = useState('');
  const [description, setDescription] = useState('');
  const [nameColumn, setNameColumn] = useState('');
  const [phoneColumn, setPhoneColumn] = useState('');
  const [emailColumn, setEmailColumn] = useState('');
  const [openListId, setOpenListId] = useState('');
  const [contacts, setContacts] = useState<ImportedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState('');

  const loadLists = useCallback(async () => {
    const response = await fetch('/api/integrations/whatsapp/bulk-campaigns?action=contact-lists', { headers: await authHeaders() });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Não foi possível carregar as listas.');
    setLists(body.lists || []);
  }, []);

  useEffect(() => {
    loadLists().catch(error => setNotice(error.message)).finally(() => setLoading(false));
  }, [loadLists]);

  const readFile = async (file?: File) => {
    if (!file) return;
    setNotice('');
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const parsed = XLSX.utils.sheet_to_json<SheetRow>(sheet, { defval: '' }).slice(0, 5000);
      if (!parsed.length) throw new Error('A planilha não possui linhas para importar.');
      const sheetHeaders = [...new Set(parsed.flatMap(row => Object.keys(row)))];
      const guessedName = guessColumn(sheetHeaders, ['nome', 'nome paciente', 'paciente', 'contato', 'lead']);
      const guessedPhone = guessColumn(sheetHeaders, ['telefone', 'celular', 'whatsapp', 'fone']);
      const guessedEmail = guessColumn(sheetHeaders, ['email', 'e mail']);
      setRows(parsed);
      setHeaders(sheetHeaders);
      setFileName(file.name);
      setListName(current => current || file.name.replace(/\.[^.]+$/, ''));
      setNameColumn(guessedName);
      setPhoneColumn(guessedPhone);
      setEmailColumn(guessedEmail);
      if (!guessedPhone) setNotice('Selecione qual coluna contém o telefone.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível ler a planilha.');
      setRows([]);
    }
  };

  const importList = async () => {
    if (!listName.trim() || !phoneColumn || !rows.length) {
      setNotice('Informe o nome da lista, a coluna de telefone e uma planilha válida.');
      return;
    }
    setImporting(true);
    setNotice('');
    try {
      const contactsPayload = rows.map((row, index) => ({
        name: String(nameColumn ? row[nameColumn] ?? '' : '').trim() || `Contato ${index + 1}`,
        phone: String(row[phoneColumn] ?? '').trim(),
        email: emailColumn ? String(row[emailColumn] ?? '').trim() : '',
      }));
      const response = await fetch('/api/integrations/whatsapp/bulk-campaigns', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ action: 'import_contact_list', name: listName.trim(), description: description.trim(), sourceFileName: fileName, contacts: contactsPayload }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Falha ao importar a lista.');
      setNotice(`Lista importada: ${body.summary.valid} válidos, ${body.summary.invalid} inválidos e ${body.summary.duplicate} duplicados.`);
      setRows([]); setHeaders([]); setFileName(''); setListName(''); setDescription(''); setNameColumn(''); setPhoneColumn(''); setEmailColumn('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadLists();
      onChanged?.();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Falha ao importar a lista.');
    } finally {
      setImporting(false);
    }
  };

  const toggleList = async (listId: string) => {
    if (openListId === listId) { setOpenListId(''); setContacts([]); return; }
    setOpenListId(listId); setContacts([]); setNotice('');
    try {
      const response = await fetch(`/api/integrations/whatsapp/bulk-campaigns?action=contact-lists&listId=${encodeURIComponent(listId)}`, { headers: await authHeaders() });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Falha ao abrir a lista.');
      setContacts(body.contacts || []);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Falha ao abrir a lista.'); }
  };

  const deleteList = async (list: ContactList) => {
    if (!window.confirm(`Excluir a lista “${list.name}” e todos os seus contatos?`)) return;
    try {
      const response = await fetch('/api/integrations/whatsapp/bulk-campaigns', { method: 'DELETE', headers: await authHeaders(), body: JSON.stringify({ action: 'delete_contact_list', listId: list.id }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Falha ao excluir a lista.');
      if (openListId === list.id) { setOpenListId(''); setContacts([]); }
      await loadLists();
      onChanged?.();
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Falha ao excluir a lista.'); }
  };

  const previewRows = useMemo(() => rows.slice(0, 5), [rows]);

  return <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)]">
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="flex items-start gap-3"><span className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-600"><ListPlus className="h-5 w-5" /></span><div><h2 className="font-bold">Nova lista de contatos</h2><p className="mt-1 text-xs text-[var(--text-muted)]">Importe Excel ou CSV e escolha as colunas de nome, telefone e e-mail.</p></div></div>
      <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-5 flex min-h-32 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-subtle)] px-4 text-center transition hover:border-[var(--primary)]/50 hover:bg-[var(--surface-hover)]">
        <Upload className="h-6 w-6 text-[var(--primary)]" /><span className="mt-2 text-sm font-semibold">{fileName || 'Selecionar planilha'}</span><span className="mt-1 text-[10px] text-[var(--text-muted)]">XLSX, XLS ou CSV · até 5.000 linhas</span>
      </button>
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={event => void readFile(event.target.files?.[0])} />

      {rows.length > 0 && <div className="mt-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold">Nome da lista<input value={listName} onChange={event => setListName(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 outline-none focus:border-[var(--primary)]" /></label>
          <label className="text-xs font-semibold">Descrição opcional<input value={description} onChange={event => setDescription(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 outline-none focus:border-[var(--primary)]" /></label>
          <label className="text-xs font-semibold">Coluna de nome<select value={nameColumn} onChange={event => setNameColumn(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3"><option value="">Gerar nome automático</option>{headers.map(header => <option key={header}>{header}</option>)}</select></label>
          <label className="text-xs font-semibold">Coluna de telefone *<select value={phoneColumn} onChange={event => setPhoneColumn(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3"><option value="">Selecione</option>{headers.map(header => <option key={header}>{header}</option>)}</select></label>
          <label className="text-xs font-semibold">Coluna de e-mail<select value={emailColumn} onChange={event => setEmailColumn(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3"><option value="">Não importar</option>{headers.map(header => <option key={header}>{header}</option>)}</select></label>
        </div>
        <div className="overflow-hidden rounded-xl border border-[var(--border)]"><div className="border-b border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Prévia · {rows.length} linhas</div><div className="overflow-x-auto"><table className="w-full text-left text-[10px]"><thead><tr>{headers.slice(0, 4).map(header => <th key={header} className="whitespace-nowrap px-3 py-2 font-semibold">{header}</th>)}</tr></thead><tbody>{previewRows.map((row, index) => <tr key={index} className="border-t border-[var(--border-subtle)]">{headers.slice(0, 4).map(header => <td key={header} className="max-w-40 truncate px-3 py-2 text-[var(--text-secondary)]">{String(row[header] ?? '')}</td>)}</tr>)}</tbody></table></div></div>
        <button onClick={() => void importList()} disabled={importing || !phoneColumn || !listName.trim()} className="flex h-11 items-center gap-2 rounded-xl bg-[var(--primary)] px-5 text-sm font-bold text-white disabled:opacity-50">{importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}{importing ? 'Importando...' : `Importar ${rows.length} contatos`}</button>
      </div>}
      {notice && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">{notice}</p>}
    </section>

    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="flex items-center justify-between"><div><h2 className="font-bold">Listas disponíveis</h2><p className="mt-1 text-xs text-[var(--text-muted)]">Use qualquer uma delas como público de uma campanha.</p></div><span className="rounded-lg bg-[var(--bg-subtle)] px-2.5 py-1 text-xs font-bold">{lists.length}</span></div>
      <div className="mt-4 space-y-2">
        {loading ? <p className="py-10 text-center text-xs text-[var(--text-muted)]">Carregando listas...</p> : lists.length ? lists.map(list => <article key={list.id} className="overflow-hidden rounded-xl border border-[var(--border)]">
          <div className="flex items-center gap-3 p-3"><button type="button" onClick={() => void toggleList(list.id)} className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-semibold">{list.name}</span><span className="mt-1 block text-[10px] text-[var(--text-muted)]">{list.valid_contacts} válidos · {list.invalid_contacts} inválidos · {list.duplicate_contacts} duplicados</span></button><button onClick={() => void deleteList(list)} title="Excluir lista" className="rounded-lg p-2 text-rose-500 hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button><button onClick={() => void toggleList(list.id)} className="rounded-lg p-2 hover:bg-[var(--surface-hover)]">{openListId === list.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button></div>
          {openListId === list.id && <div className="max-h-80 overflow-y-auto border-t border-[var(--border)] bg-[var(--bg-subtle)] p-2">{contacts.map(contact => <div key={contact.id} className="flex items-start gap-2 rounded-lg px-2.5 py-2 hover:bg-[var(--surface)]">{contact.status === 'valid' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />}<div className="min-w-0"><p className="truncate text-xs font-semibold">{contact.name}</p><p className="text-[10px] text-[var(--text-muted)]">{contact.phone || 'Sem telefone'}{contact.email ? ` · ${contact.email}` : ''}</p>{contact.error_message && <p className="mt-0.5 text-[10px] text-amber-700 dark:text-amber-300">{contact.error_message}</p>}</div></div>)}{!contacts.length && <p className="py-8 text-center text-xs text-[var(--text-muted)]">Carregando contatos...</p>}</div>}
        </article>) : <div className="rounded-xl border border-dashed border-[var(--border)] py-14 text-center"><FileSpreadsheet className="mx-auto h-7 w-7 text-[var(--text-muted)]" /><p className="mt-2 text-xs text-[var(--text-muted)]">Nenhuma lista importada</p></div>}
      </div>
    </section>
  </div>;
};
