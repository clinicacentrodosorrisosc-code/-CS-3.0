import React, { useState, useMemo } from 'react';
import { 
  Lock, KeyRound, FileText, Building2, Target, ShieldCheck, 
  Unlock
} from 'lucide-react';
import { NotionWorkspace } from './Vault/NotionWorkspace';
import { PasswordVault } from './Vault/PasswordVault';
import { BankingVault } from './Vault/BankingVault';
import { ManagementProjects } from './Vault/ManagementProjects';
import { PageHeader, StatusBadge } from './ui/operational-ui';

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
              className="w-full py-3 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white rounded-xl font-bold text-sm shadow-lg shadow-rose-900/40 transition active:scale-98 flex items-center justify-center gap-2"
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
      
      <div className="mx-4 mt-4 flex-shrink-0">
        <PageHeader
          icon={Lock}
          title="Cofre e diretrizes da gestão"
          description="Documentos, credenciais, dados bancários e metas da diretoria."
          actions={<><StatusBadge tone="danger">Confidencial</StatusBadge><button type="button" onClick={handleLockVault} className="btn btn-secondary" title="Bloquear cofre agora"><Lock className="size-4" /> Bloquear</button></>}
          tabs={<div className="module-segmented-control no-scrollbar" role="tablist" aria-label="Áreas do cofre">
            <button
              type="button"
              role="tab"
              aria-selected={activeSubTab === 'docs'}
              data-active={activeSubTab === 'docs'}
              onClick={() => setSelectedSubTab('docs')}
            >
              <FileText className="w-4 h-4" />
              <span>Docs & Diretrizes</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeSubTab === 'passwords'}
              data-active={activeSubTab === 'passwords'}
              onClick={() => setSelectedSubTab('passwords')}
            >
              <KeyRound className="w-4 h-4" />
              <span>Senhas & Credenciais</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeSubTab === 'banking'}
              data-active={activeSubTab === 'banking'}
              onClick={() => setSelectedSubTab('banking')}
            >
              <Building2 className="w-4 h-4" />
              <span>Bancos & Pix</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeSubTab === 'projects'}
              data-active={activeSubTab === 'projects'}
              onClick={() => setSelectedSubTab('projects')}
            >
              <Target className="w-4 h-4" />
              <span>Metas & Projetos</span>
            </button>
          </div>}
        />
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
