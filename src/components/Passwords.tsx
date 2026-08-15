import React, { useState, useMemo } from 'react';
import { 
  Lock, KeyRound, FileText, Building2, Target, ShieldCheck, 
  Unlock
} from 'lucide-react';
import { NotionWorkspace } from './Vault/NotionWorkspace';
import { PasswordVault } from './Vault/PasswordVault';
import { BankingVault } from './Vault/BankingVault';
import { ManagementProjects } from './Vault/ManagementProjects';

interface PasswordsProps {
  requestedSubTab?: string | null;
  userRole?: string;
  userEmail?: string;
}

type VaultTab = 'docs' | 'passwords' | 'banking' | 'projects';

const MASTER_PASSWORD = 'priscilamuitobrava';

export const Passwords: React.FC<PasswordsProps> = ({ 
  requestedSubTab 
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      const savedAuth = sessionStorage.getItem('odontomanager_vault_unlocked');
      if (savedAuth === 'true') return true;
    } catch (e) {
      console.warn('Session auth read warning:', e);
    }
    return false;
  });

  const [passwordInput, setPasswordInput] = useState('');
  const [error, setError] = useState('');
  const [selectedSubTab, setSelectedSubTab] = useState<VaultTab | null>(null);

  // Derive active sub-tab from user click or parent requested sub-tab
  const activeSubTab: VaultTab = useMemo(() => {
    if (selectedSubTab) return selectedSubTab;
    if (requestedSubTab === 'passwords') return 'passwords';
    if (requestedSubTab === 'banking') return 'banking';
    if (requestedSubTab === 'projects' || requestedSubTab === 'management_board') return 'projects';
    return 'docs';
  }, [selectedSubTab, requestedSubTab]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === MASTER_PASSWORD) {
      setIsAuthenticated(true);
      setError('');
      try {
        sessionStorage.setItem('odontomanager_vault_unlocked', 'true');
      } catch (err) {
        console.warn('Could not save vault auth state:', err);
      }
    } else {
      setError('Senha mestra incorreta');
    }
  };

  const handleLockVault = () => {
    setIsAuthenticated(false);
    setPasswordInput('');
    try {
      sessionStorage.removeItem('odontomanager_vault_unlocked');
    } catch (err) {
      console.warn('Could not clear vault auth state:', err);
    }
  };

  // Lock Screen
  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full bg-transparent font-sans p-4">
        <div className="glass-panel p-8 md:p-10 rounded-3xl border border-rose-500/20 max-w-md w-full flex flex-col items-center gap-6 shadow-2xl animate-in fade-in zoom-in duration-500 relative overflow-hidden">
          
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="w-16 h-16 rounded-3xl bg-rose-500/20 flex items-center justify-center border border-rose-500/30 text-rose-400 shadow-inner">
            <Lock className="w-8 h-8" />
          </div>

          <div className="text-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-rose-400 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20">
              Restrito à Gestão
            </span>
            <h2 className="text-2xl font-bold text-text mt-3 mb-1">Cofre & Workspace da Gestão</h2>
            <p className="text-slate-400 text-xs leading-relaxed">
              Ambiente confidencial protegido com criptografia contendo Documentos Notion, Senhas da Operação, Dados Bancários e Metas Estratégicas.
            </p>
          </div>
          
          <form onSubmit={handleLogin} className="w-full flex flex-col gap-4">
            <div className="space-y-1">
              <input 
                type="password" 
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                placeholder="Insira a senha mestra..."
                className="w-full bg-panel border border-border rounded-xl px-4 py-3 text-text text-center tracking-widest focus:border-rose-500/50 outline-none transition-colors text-sm"
                autoFocus
              />
              {error && <p className="text-rose-400 text-xs font-bold text-center mt-1">{error}</p>}
            </div>

            <button 
              type="submit" 
              className="w-full py-3 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white rounded-xl font-bold text-sm shadow-lg shadow-rose-900/40 transition-all active:scale-98 flex items-center justify-center gap-2"
            >
              <Unlock className="w-4 h-4" />
              <span>Desbloquear Cofre</span>
            </button>
          </form>

          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider pt-2 border-t border-border/60 w-full justify-center">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Sessão Protegida de Alta Segurança</span>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col w-full h-full bg-transparent text-slate-300 font-sans overflow-hidden">
      
      {/* Top Bar Navigation */}
      <div className="px-6 py-4 border-b border-border bg-surface/50 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0 z-20">
        
        {/* Title & Badge */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold text-text tracking-tight">Cofre & Diretrizes da Gestão</h1>
              <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[9px] font-black uppercase tracking-wider">
                Confidencial
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Documentos & Diretrizes, Senhas de Serviços, Dados Bancários e Metas da Diretoria.</p>
          </div>
        </div>

        {/* Sub-Tabs Nav Pill & Lock Button */}
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 md:pb-0">
          
          <div className="flex items-center p-1 bg-panel border border-border rounded-2xl">
            <button
              onClick={() => setSelectedSubTab('docs')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeSubTab === 'docs'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-900/40'
                  : 'text-slate-400 hover:text-text'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Docs & Diretrizes</span>
            </button>

            <button
              onClick={() => setSelectedSubTab('passwords')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeSubTab === 'passwords'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-900/40'
                  : 'text-slate-400 hover:text-text'
              }`}
            >
              <KeyRound className="w-4 h-4" />
              <span>Senhas & Credenciais</span>
            </button>

            <button
              onClick={() => setSelectedSubTab('banking')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeSubTab === 'banking'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-900/40'
                  : 'text-slate-400 hover:text-text'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Bancos & Pix</span>
            </button>

            <button
              onClick={() => setSelectedSubTab('projects')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeSubTab === 'projects'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-900/40'
                  : 'text-slate-400 hover:text-text'
              }`}
            >
              <Target className="w-4 h-4" />
              <span>Metas & Projetos</span>
            </button>
          </div>

          <button
            onClick={handleLockVault}
            className="p-2.5 rounded-2xl bg-panel hover:bg-rose-950/40 border border-border hover:border-rose-500/30 text-slate-400 hover:text-rose-400 transition-all flex items-center gap-1.5 text-xs font-bold"
            title="Bloquear Cofre Agora"
          >
            <Lock className="w-4 h-4" />
            <span className="hidden sm:inline">Bloquear</span>
          </button>

        </div>

      </div>

      {/* Content Rendering based on selected sub-tab */}
      <div className="flex-1 flex min-h-0 bg-transparent overflow-hidden">
        {activeSubTab === 'docs' && <NotionWorkspace />}
        {activeSubTab === 'passwords' && <PasswordVault />}
        {activeSubTab === 'banking' && <BankingVault />}
        {activeSubTab === 'projects' && <ManagementProjects />}
      </div>

    </div>
  );
};
