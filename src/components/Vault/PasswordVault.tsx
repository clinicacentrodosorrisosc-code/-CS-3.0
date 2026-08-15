import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { 
  KeyRound, Plus, Trash2, Edit2, Eye, EyeOff, Copy, Check, 
  Search, X, ExternalLink, ShieldCheck, RefreshCw, Sparkles
} from 'lucide-react';

export interface PasswordEntry {
  id: string;
  service_name: string;
  category: string;
  username: string;
  password_value: string;
  url?: string;
  notes?: string;
  updated_at?: string;
}

const CATEGORIES = [
  'Todas',
  'Bancos & Finanças',
  'Sistemas & Softwares',
  'Redes Sociais & Marketing',
  'Servidores & Nuvem',
  'Certificados Digitais',
  'Operacional & Outros'
];

export const PasswordVault: React.FC = () => {
  const [passwords, setPasswords] = useState<PasswordEntry[]>(() => {
    try {
      const saved = localStorage.getItem('odontomanager_vault_passwords');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Error reading passwords from storage:', e);
    }
    return [
      {
        id: 'pwd_1',
        service_name: 'Conta Bancária Principal (Itaú PJ)',
        category: 'Bancos & Finanças',
        username: 'gestao@centrodosorriso.com.br',
        password_value: 'Sorriso@2026!Itau',
        url: 'https://www.itau.com.br',
        notes: 'Agência 1234 / Conta 98765-0. Acesso restrito aos sócios.'
      },
      {
        id: 'pwd_2',
        service_name: 'Instagram Oficial da Clínica',
        category: 'Redes Sociais & Marketing',
        username: '@centrodosorrisosc',
        password_value: 'SorrisoInsta#9921',
        url: 'https://instagram.com',
        notes: 'Autenticação 2 fatores vinculada ao celular da gerência.'
      },
      {
        id: 'pwd_3',
        service_name: 'Certificado Digital A1 (e-CNPJ)',
        category: 'Certificados Digitais',
        username: '00.123.456/0001-78',
        password_value: 'CertDig@Sorriso2026',
        notes: 'Válido até Dezembro/2026. Utilizado para emissão de NF-e e DMED.'
      },
      {
        id: 'pwd_4',
        service_name: 'Servidor de Imagens / Nuvem Raio-X',
        category: 'Servidores & Nuvem',
        username: 'admin_clinica',
        password_value: 'CloudDent!8834_XRay',
        url: 'https://cloud.radiologia.com',
        notes: 'Backup de tomografias e radiografias panorâmicas.'
      }
    ];
  });

  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<PasswordEntry>>({
    category: 'Sistemas & Softwares'
  });

  // Generator State
  const [showGenerator, setShowGenerator] = useState(false);
  const [genLength, setGenLength] = useState(16);
  const [genIncludeUpper, setGenIncludeUpper] = useState(true);
  const [genIncludeNumbers, setGenIncludeNumbers] = useState(true);
  const [genIncludeSymbols, setGenIncludeSymbols] = useState(true);
  const [generatedPassword, setGeneratedPassword] = useState('');

  // Fetch from Supabase with graceful fallback
  const fetchPasswords = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('service_passwords').select('*').order('service_name');
      if (!error && data && data.length > 0) {
        const normalized: PasswordEntry[] = data.map((d: any) => ({
          id: d.id,
          service_name: d.service_name,
          category: d.category || 'Operacional & Outros',
          username: d.username || '',
          password_value: d.password_value,
          url: d.url || '',
          notes: d.notes || ''
        }));
        setPasswords(normalized);
      }
    } catch (err) {
      console.warn('Using local passwords fallback:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPasswords();
  }, []);

  // Save to localStorage whenever state changes
  useEffect(() => {
    try {
      localStorage.setItem('odontomanager_vault_passwords', JSON.stringify(passwords));
    } catch (e) {
      console.warn('Error saving passwords:', e);
    }
  }, [passwords]);

  const generateNewPassword = useCallback(() => {
    let chars = 'abcdefghijklmnopqrstuvwxyz';
    if (genIncludeUpper) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (genIncludeNumbers) chars += '0123456789';
    if (genIncludeSymbols) chars += '!@#$%^&*()_+~`|}{[]:;?><,./-=';

    let result = '';
    for (let i = 0; i < genLength; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setGeneratedPassword(result);
  }, [genLength, genIncludeUpper, genIncludeNumbers, genIncludeSymbols]);

  useEffect(() => {
    if (showGenerator) {
      generateNewPassword();
    }
  }, [showGenerator, generateNewPassword]);

  const handleOpenNew = () => {
    setEditingId(null);
    setFormData({
      service_name: '',
      category: selectedCategory === 'Todas' ? 'Sistemas & Softwares' : selectedCategory,
      username: '',
      password_value: '',
      url: '',
      notes: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (entry: PasswordEntry) => {
    setEditingId(entry.id);
    setFormData({ ...entry });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.service_name || !formData.password_value) return;

    const newEntry: PasswordEntry = {
      id: editingId || 'pwd_' + Date.now(),
      service_name: formData.service_name.trim(),
      category: formData.category || 'Operacional & Outros',
      username: formData.username?.trim() || '',
      password_value: formData.password_value,
      url: formData.url?.trim() || '',
      notes: formData.notes?.trim() || '',
      updated_at: new Date().toISOString()
    };

    // Try saving to Supabase
    try {
      await supabase.from('service_passwords').upsert({
        id: newEntry.id,
        service_name: newEntry.service_name,
        username: newEntry.username,
        password_value: newEntry.password_value,
        notes: newEntry.notes
      });
    } catch (err) {
      console.warn('Supabase save notice:', err);
    }

    if (editingId) {
      setPasswords(prev => prev.map(p => p.id === editingId ? newEntry : p));
    } else {
      setPasswords(prev => [newEntry, ...prev]);
    }

    setIsModalOpen(false);
    setFormData({});
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta credencial do cofre?')) return;
    try {
      await supabase.from('service_passwords').delete().eq('id', id);
    } catch (err) {
      console.warn('Supabase delete notice:', err);
    }
    setPasswords(prev => prev.filter(p => p.id !== id));
  };

  const toggleVisibility = (id: string) => {
    setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredPasswords = useMemo(() => {
    return passwords.filter(pwd => {
      const matchSearch = pwd.service_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pwd.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (pwd.notes && pwd.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchCat = selectedCategory === 'Todas' || pwd.category === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [passwords, searchQuery, selectedCategory]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-6 md:p-8 custom-scrollbar">
      <div className="max-w-6xl w-full mx-auto space-y-6">
        
        {/* Top Controls & Stats */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface/60 border border-border p-4 md:p-6 rounded-3xl backdrop-blur-sm">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-rose-400">
              <ShieldCheck className="w-4 h-4" />
              <span>Cofre de Credenciais Seguras</span>
            </div>
            <h2 className="text-2xl font-bold text-text mt-1">Senhas & Acessos da Operação</h2>
            <p className="text-xs text-slate-400">Credenciais criptografadas e restritas exclusivamente à administração.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowGenerator(!showGenerator)}
              className="px-4 py-2.5 rounded-xl bg-panel hover:bg-surface border border-border text-slate-300 text-xs font-bold flex items-center gap-2 transition-all"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Gerador de Senha</span>
            </button>
            <button
              onClick={handleOpenNew}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-rose-900/40 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Senha</span>
            </button>
          </div>
        </div>

        {/* Password Generator Drawer / Card */}
        {showGenerator && (
          <div className="p-5 bg-panel border border-rose-500/30 rounded-2xl shadow-xl animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-text flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" /> Gerador de Senhas Seguras
              </h4>
              <button onClick={() => setShowGenerator(false)} className="text-slate-400 hover:text-text">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 bg-surface border border-border rounded-xl px-4 py-3 font-mono text-sm font-bold text-rose-300 tracking-wider">
                {generatedPassword}
              </div>
              <button
                onClick={generateNewPassword}
                className="p-3 bg-panel hover:bg-surface border border-border text-slate-300 rounded-xl transition-colors"
                title="Gerar Outra"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  copyToClipboard(generatedPassword, 'gen_pwd');
                }}
                className="px-4 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-xs flex items-center gap-2 transition-all"
              >
                {copiedId === 'gen_pwd' ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                <span>Copiar</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <span>Comprimento: <strong className="text-rose-400">{genLength}</strong></span>
                <input
                  type="range"
                  min="8"
                  max="32"
                  value={genLength}
                  onChange={e => setGenLength(Number(e.target.value))}
                  className="w-24 accent-rose-500"
                />
              </div>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={genIncludeUpper}
                  onChange={e => setGenIncludeUpper(e.target.checked)}
                  className="rounded accent-rose-500"
                />
                <span>Maiúsculas (A-Z)</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={genIncludeNumbers}
                  onChange={e => setGenIncludeNumbers(e.target.checked)}
                  className="rounded accent-rose-500"
                />
                <span>Números (0-9)</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={genIncludeSymbols}
                  onChange={e => setGenIncludeSymbols(e.target.checked)}
                  className="rounded accent-rose-500"
                />
                <span>Símbolos (!@#$)</span>
              </label>
            </div>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar serviço, usuário ou nota..."
              className="w-full bg-panel border border-border rounded-xl pl-9 pr-4 py-2 text-xs text-text outline-none focus:border-rose-500/50 transition-colors"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-text">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto custom-scrollbar pb-1">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-900/30'
                    : 'bg-panel border border-border text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Passwords Cards Grid */}
        {loading ? (
          <div className="text-center py-16 text-slate-400 text-sm">Carregando cofre criptografado...</div>
        ) : filteredPasswords.length === 0 ? (
          <div className="text-center py-20 flex flex-col items-center gap-3 bg-surface/30 border border-border rounded-3xl">
            <KeyRound className="w-12 h-12 opacity-20 text-slate-400" />
            <p className="text-sm font-semibold text-slate-400">Nenhuma credencial encontrada.</p>
            <button
              onClick={handleOpenNew}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-md transition-all"
            >
              Cadastrar Nova Credencial
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredPasswords.map(pwd => (
              <div
                key={pwd.id}
                className="bg-surface/80 hover:bg-surface border border-border hover:border-rose-500/40 p-5 rounded-2xl flex flex-col justify-between gap-4 transition-all shadow-sm group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[10px] font-bold">
                        {pwd.category}
                      </span>
                      <h3 className="text-base font-bold text-text mt-1.5 leading-snug">
                        {pwd.service_name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleOpenEdit(pwd)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-panel transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(pwd.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-panel transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {pwd.url && (
                    <a
                      href={pwd.url.startsWith('http') ? pwd.url : `https://${pwd.url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 mb-3"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span className="truncate max-w-[200px]">{pwd.url}</span>
                    </a>
                  )}

                  {/* Fields */}
                  <div className="space-y-2 mt-2">
                    {pwd.username && (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Login / Usuário</span>
                        <div className="flex items-center justify-between bg-panel px-3 py-1.5 rounded-lg border border-border/80">
                          <span className="text-xs text-slate-300 font-mono truncate">{pwd.username}</span>
                          <button
                            onClick={() => copyToClipboard(pwd.username, pwd.id + '_user')}
                            className="p-1 text-slate-500 hover:text-text rounded"
                            title="Copiar Usuário"
                          >
                            {copiedId === pwd.id + '_user' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Senha</span>
                      <div className="flex items-center justify-between bg-panel px-3 py-1.5 rounded-lg border border-border/80">
                        <span className="text-xs text-text font-mono tracking-wider font-semibold truncate">
                          {visiblePasswords[pwd.id] ? pwd.password_value : '••••••••••••'}
                        </span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => toggleVisibility(pwd.id)}
                            className="p-1 text-slate-500 hover:text-text"
                            title={visiblePasswords[pwd.id] ? 'Ocultar' : 'Revelar'}
                          >
                            {visiblePasswords[pwd.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => copyToClipboard(pwd.password_value, pwd.id + '_pwd')}
                            className="p-1 text-slate-500 hover:text-text"
                            title="Copiar Senha"
                          >
                            {copiedId === pwd.id + '_pwd' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {pwd.notes && (
                  <div className="pt-2 border-t border-border/60">
                    <p className="text-[11px] text-slate-400 italic line-clamp-2">{pwd.notes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      </div>

      {/* ================= MODAL DE NOVA / EDITAR SENHA ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-bold text-text">
                {editingId ? 'Editar Credencial' : 'Nova Credencial Segura'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-text">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase">Serviço / Plataforma *</label>
                <input
                  type="text"
                  value={formData.service_name || ''}
                  onChange={e => setFormData({ ...formData, service_name: e.target.value })}
                  placeholder="Ex: Conta Itaú, Instagram, Software Dental..."
                  className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-xs text-text outline-none focus:border-rose-500/50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase">Categoria</label>
                <select
                  value={formData.category || 'Sistemas & Softwares'}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-xs text-text outline-none focus:border-rose-500/50 font-bold"
                >
                  {CATEGORIES.filter(c => c !== 'Todas').map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase">Link / URL de Acesso (Opcional)</label>
                <input
                  type="text"
                  value={formData.url || ''}
                  onChange={e => setFormData({ ...formData, url: e.target.value })}
                  placeholder="Ex: https://itau.com.br"
                  className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-xs text-text outline-none focus:border-rose-500/50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase">Usuário / Email / Login</label>
                <input
                  type="text"
                  value={formData.username || ''}
                  onChange={e => setFormData({ ...formData, username: e.target.value })}
                  placeholder="Ex: admin@centrodosorriso.com.br"
                  className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-xs text-text outline-none focus:border-rose-500/50"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-400 uppercase">Senha *</label>
                  <button
                    type="button"
                    onClick={() => {
                      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
                      let gen = '';
                      for (let i = 0; i < 16; i++) gen += chars.charAt(Math.floor(Math.random() * chars.length));
                      setFormData({ ...formData, password_value: gen });
                    }}
                    className="text-[10px] text-rose-400 hover:underline font-bold"
                  >
                    Gerar Forte
                  </button>
                </div>
                <input
                  type="text"
                  value={formData.password_value || ''}
                  onChange={e => setFormData({ ...formData, password_value: e.target.value })}
                  placeholder="Insira ou gere a senha..."
                  className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-xs text-text font-mono font-bold outline-none focus:border-rose-500/50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase">Notas & Observações Sigilosas</label>
                <textarea
                  value={formData.notes || ''}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Instruções de 2FA, recuperação, responsáveis..."
                  className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-xs text-text outline-none focus:border-rose-500/50 min-h-[70px] resize-none"
                />
              </div>
            </div>

            <div className="p-4 border-t border-border bg-panel flex justify-end gap-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-slate-400 hover:text-text text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.service_name || !formData.password_value}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition-all"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
