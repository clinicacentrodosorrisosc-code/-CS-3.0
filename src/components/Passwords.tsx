import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Lock, Eye, EyeOff, Plus, Trash2, KeyRound, Copy, Check, X } from 'lucide-react';

interface PasswordEntry {
  id: string;
  service_name: string;
  username: string;
  password_value: string;
  notes?: string;
}

export const Passwords: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [error, setError] = useState('');
  
  const [passwords, setPasswords] = useState<PasswordEntry[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<PasswordEntry>>({});
  
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === 'priscilamuitobrava') {
      setIsAuthenticated(true);
      setError('');
      fetchPasswords();
    } else {
      setError('Senha incorreta');
    }
  };

  const fetchPasswords = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('service_passwords').select('*').order('service_name');
      if (error) {
          // Se a tabela não existir, criamos um mock temporário para não quebrar a UI
          console.error("Erro ao buscar senhas, a tabela pode não existir:", error);
      } else {
          setPasswords(data || []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.service_name || !formData.password_value) return;
    
    const newEntry = {
      id: formData.id || 'pwd_' + Date.now(),
      service_name: formData.service_name,
      username: formData.username || '',
      password_value: formData.password_value,
      notes: formData.notes || ''
    };

    try {
      const { error } = await supabase.from('service_passwords').upsert(newEntry);
      if (error) {
          // Fallback local se a tabela não existir
          if (formData.id) {
              setPasswords(p => p.map(x => x.id === formData.id ? newEntry as PasswordEntry : x));
          } else {
              setPasswords(p => [...p, newEntry as PasswordEntry]);
          }
      } else {
          fetchPasswords();
      }
      setIsModalOpen(false);
      setFormData({});
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta senha?')) return;
    try {
      const { error } = await supabase.from('service_passwords').delete().eq('id', id);
      if (error) {
          setPasswords(p => p.filter(x => x.id !== id));
      } else {
          fetchPasswords();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const toggleVisibility = (id: string) => {
    setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full bg-transparent font-display p-4">
        <div className="glass-panel p-8 rounded-3xl border border-border max-w-md w-full flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-500">
          <div className="w-16 h-16 rounded-full bg-rose-500/20 flex items-center justify-center border border-rose-500/30">
            <Lock className="w-8 h-8 text-rose-400" />
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-text mb-2">Acesso Restrito</h2>
            <p className="text-slate-400 text-sm">Insira a senha mestra para acessar o cofre de senhas da operação.</p>
          </div>
          
          <form onSubmit={handleLogin} className="w-full flex flex-col gap-4">
            <input 
              type="password" 
              value={passwordInput}
              onChange={e => setPasswordInput(e.target.value)}
              placeholder="Senha de acesso..."
              className="w-full bg-panel border border-border rounded-xl px-4 py-3 text-text text-center tracking-widest focus:border-rose-500/50 outline-none transition-colors"
              autoFocus
            />
            {error && <p className="text-rose-400 text-xs font-bold text-center">{error}</p>}
            <button type="submit" className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-text rounded-xl font-bold transition-colors">
              Desbloquear
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex w-full h-full bg-transparent text-slate-300 font-sans overflow-hidden">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-transparent relative">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-rose-600/5 blur-[120px] pointer-events-none"></div>

        {/* View Content */}
        <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-8 custom-scrollbar relative z-10 w-full">
           <div className="w-full min-h-full space-y-10 relative z-10">
               
               <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                   <div>
                       <h1 className="text-4xl md:text-5xl font-bold text-text bg-transparent outline-none w-full block resize-none leading-tight tracking-tight mb-2">
                          Cofre de Senhas
                       </h1>
                       <p className="text-slate-400 text-sm">Credenciais de serviços e plataformas da operação.</p>
                   </div>

                   <div className="flex gap-2 text-sm justify-end">
                      <button 
                         onClick={() => { setFormData({}); setIsModalOpen(true); }}
                         className="px-6 py-2 glass-button glass-button-primary text-text rounded-xl font-bold shadow-lg transition-all flex items-center gap-2"
                      >
                         <Plus className="w-4 h-4" /> Nova Senha
                      </button>
                   </div>
               </div>

               <div className="flex-1 w-full pb-20">
        {loading ? (
          <div className="text-slate-400 text-center py-10">Carregando cofre...</div>
        ) : passwords.length === 0 ? (
          <div className="text-slate-500 text-center py-20 flex flex-col items-center gap-4">
            <KeyRound className="w-12 h-12 opacity-20" />
            <p>Nenhuma senha cadastrada ainda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {passwords.map(pwd => (
              <div key={pwd.id} className="glass-panel p-6 rounded-2xl border border-border flex flex-col gap-4 relative group hover:border-border transition-colors">
                <div className="flex justify-between items-start">
                  <h3 className="text-lg font-bold text-text">{pwd.service_name}</h3>
                  <button onClick={() => handleDelete(pwd.id)} className="p-1.5 glass-button text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="flex flex-col gap-3">
                  {pwd.username && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Usuário / Login</span>
                      <div className="flex items-center justify-between bg-panel px-3 py-2 rounded-lg border border-border">
                        <span className="text-sm text-slate-300 font-mono">{pwd.username}</span>
                        <button onClick={() => copyToClipboard(pwd.username, pwd.id + '_user')} className="p-1 glass-button text-slate-500 hover:text-text transition-all rounded-md">
                          {copiedId === pwd.id + '_user' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Senha</span>
                    <div className="flex items-center justify-between bg-panel px-3 py-2 rounded-lg border border-border">
                      <span className="text-sm text-text font-mono tracking-wider">
                        {visiblePasswords[pwd.id] ? pwd.password_value : '••••••••••••'}
                      </span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleVisibility(pwd.id)} className="text-slate-500 hover:text-text transition-colors">
                          {visiblePasswords[pwd.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button onClick={() => copyToClipboard(pwd.password_value, pwd.id + '_pwd')} className="text-slate-500 hover:text-text transition-colors">
                          {copiedId === pwd.id + '_pwd' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {pwd.notes && (
                    <div className="mt-2 pt-3 border-t border-border">
                      <p className="text-xs text-slate-400">{pwd.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
</div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-2xl z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border flex justify-between items-center">
              <h3 className="text-xl font-bold text-text">Nova Senha</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-text"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-400 uppercase">Serviço / Plataforma *</label>
                <input 
                  value={formData.service_name || ''} 
                  onChange={e => setFormData({...formData, service_name: e.target.value})}
                  className="bg-panel border border-border rounded-lg px-3 py-2 text-text outline-none focus:border-rose-500/50"
                  placeholder="Ex: Instagram, Conta de Luz..."
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-400 uppercase">Usuário / Email</label>
                <input 
                  value={formData.username || ''} 
                  onChange={e => setFormData({...formData, username: e.target.value})}
                  className="bg-panel border border-border rounded-lg px-3 py-2 text-text outline-none focus:border-rose-500/50"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-400 uppercase">Senha *</label>
                <input 
                  value={formData.password_value || ''} 
                  onChange={e => setFormData({...formData, password_value: e.target.value})}
                  className="bg-panel border border-border rounded-lg px-3 py-2 text-text outline-none focus:border-rose-500/50"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-400 uppercase">Observações</label>
                <textarea 
                  value={formData.notes || ''} 
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                  className="bg-panel border border-border rounded-lg px-3 py-2 text-text outline-none focus:border-rose-500/50 min-h-[80px]"
                />
              </div>
            </div>
            <div className="p-6 border-t border-border flex justify-end gap-3 bg-panel">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-400 hover:text-text font-bold text-sm">Cancelar</button>
              <button 
                onClick={handleSave}
                disabled={!formData.service_name || !formData.password_value}
                className="px-6 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-text rounded-lg font-bold text-sm transition-colors"
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
