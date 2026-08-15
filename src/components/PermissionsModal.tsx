
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { UserProfile, Tab } from '../types';
import { X, ChevronUp, ChevronDown, Trash2, Sliders, Loader2, UserPlus, Info } from 'lucide-react';
import { toast } from 'sonner';

interface PermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onlineUsers?: string[];
}

// Configuration of available sub-tabs structure
const SUB_TABS_CONFIG: Record<string, { id: string; label: string }[]> = {
    [Tab.FINANCIAL]: [
        { id: 'financial_overview', label: 'Visão Geral' },
        { id: 'financial_transactions', label: 'Receitas' },
        { id: 'financial_pricing', label: 'Precificação' },
        { id: 'financial_settings', label: 'Configurações' },
    ],
    [Tab.ORTHODONTICS]: [
        { id: 'ortho_vision', label: 'Visão Geral' },
        { id: 'ortho_calendar', label: 'Calendário Mensal' },
        { id: 'ortho_grid', label: 'Grade de Presença' },
        { id: 'ortho_patients', label: 'Lista de Pacientes' },
        { id: 'ortho_settings', label: 'Configurações' },
    ],
    [Tab.DASHBOARD]: [
        { id: 'dash_financial', label: 'Visão Financeira' },
    ],
    [Tab.LABWORK]: [
        { id: 'lab_kanban', label: 'Quadro Kanban' },
    ],
    [Tab.MEETINGS]: [
        { id: 'sales_pipeline', label: 'Funil & Pipeline de Vendas' },
        { id: 'management_strategy', label: 'Estratégia & Metas OKR' },
        { id: 'campaign_calendar', label: 'Calendário de Campanhas' },
        { id: 'meeting_minutes', label: 'Atas de Reuniões' },
        { id: 'clinic_ideas', label: 'Ideias & Melhorias' },
        { id: 'sales_playbook', label: 'Playbook & Scripts' }
    ],

    [Tab.TASKS]: [
        { id: 'tasks', label: 'Tarefas' },
        { id: 'reports', label: 'Relatórios' }
    ],
    [Tab.MANAGEMENT]: [
        { id: 'management_overview', label: 'Visão Geral (Gráficos)' },
        { id: 'management_breakeven', label: 'Ponto de Equilíbrio' }
    ]
};

export const PermissionsModal: React.FC<PermissionsModalProps> = ({ isOpen, onClose, onlineUsers = [] }) => {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<{ id: string; email: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // States for creating a brand new user
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'reception' | 'user'>('user');
  const [newSelectedTabs, setNewSelectedTabs] = useState<string[]>([Tab.DASHBOARD]);
  const [creatingUser, setCreatingUser] = useState(false);

  const showFeedback = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const fetchProfiles = async () => {
    setLoading(true);
    
    // Get current user to prevent self-deletion
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
    setCurrentUserEmail(user?.email || null);

    // Select all columns
    const { data } = await supabase.from('profiles').select('*');
    if (data) {
      // Normalize data: ensure arrays are arrays, not null/undefined or JSON strings
      const normalizedProfiles = data.map((p: any) => ({
          ...p,
          allowed_tabs: (() => {
              let t = p.allowed_tabs;
              try { t = Array.isArray(t) ? t : (typeof t === 'string' ? JSON.parse(t) : []); } catch { t = []; }
              return Array.isArray(t) ? t : [];
          })(),
          allowed_sub_tabs: (() => {
              let t = p.allowed_sub_tabs;
              try { t = Array.isArray(t) ? t : (typeof t === 'string' ? JSON.parse(t) : []); } catch { t = []; }
              return Array.isArray(t) ? t : [];
          })()
      }));
      setProfiles(normalizedProfiles as UserProfile[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) fetchProfiles();
  }, [isOpen]);

  const toggleTabPermission = async (userId: string, tabName: string, currentTabs: string[] | null) => {
    const safeTabs = Array.isArray(currentTabs) ? currentTabs : [];
    let newTabs: string[];
    
    if (safeTabs.includes(tabName)) {
      newTabs = safeTabs.filter(t => t !== tabName);
    } else {
      newTabs = [...safeTabs, tabName];
    }

    // Optimistic Update
    setProfiles(prev => prev.map(p => p.id === userId ? { ...p, allowed_tabs: newTabs } : p));

    const { error } = await supabase
      .from('profiles')
      .update({ allowed_tabs: newTabs })
      .eq('id', userId);

    if (error) {
      console.error("Failed to update main tab permission:", error);
      // Revert if error
      setProfiles(prev => prev.map(p => p.id === userId ? { ...p, allowed_tabs: safeTabs } : p));
    }
  };

  const toggleSubTabPermission = async (userId: string, subTabId: string, currentSubTabs: string[] | undefined | null) => {
      // Ensure strict array typing
      const safeCurrentSubTabs = Array.isArray(currentSubTabs) ? currentSubTabs : [];
      let newSubTabs: string[];

      if (safeCurrentSubTabs.includes(subTabId)) {
          newSubTabs = safeCurrentSubTabs.filter(t => t !== subTabId);
      } else {
          newSubTabs = [...safeCurrentSubTabs, subTabId];
      }

      // Optimistic Update: Update UI immediately
      setProfiles(prev => prev.map(p => p.id === userId ? { ...p, allowed_sub_tabs: newSubTabs } : p));

      // Database Update
      const { error } = await supabase
        .from('profiles')
        .update({ allowed_sub_tabs: newSubTabs })
        .eq('id', userId);
      
      if (error) {
          console.error('CRITICAL ERROR updating sub-tabs.', error);
          // Revert state on error so UI matches DB
          setProfiles(prev => prev.map(p => p.id === userId ? { ...p, allowed_sub_tabs: safeCurrentSubTabs } : p));
      }
  };

  const updateRole = async (userId: string, newRole: 'admin' | 'user' | 'reception') => {
      // Optimistic
      setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role: newRole } : p));
      
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
      if (error) {
          console.error('Error updating role:', error);
          fetchProfiles(); // Revert by refetching
      }
  };

  const deleteUser = async (userId: string) => {
      setDeletingUserId(userId);
      const previousProfiles = [...profiles];
      // Amigável e otimista: remove temporariamente da tela imediata
      setProfiles(prev => prev.filter(p => p.id !== userId));

      try {
          // Chamada da RPC nativa de deleção do Supabase
          const { error: rpcError } = await supabase.rpc('delete_user_account', { target_user_id: userId });
          
          if (rpcError) {
              console.warn("RPC delete_user_account falhou, tentando remoção direta...", rpcError);
              
              // Se a RPC falhar por falta de permissão ou inexistência, tenta deletar diretamente de public.profiles
              const { error: tableError } = await supabase.from('profiles').delete().eq('id', userId);
              if (tableError) throw tableError;
              
              showFeedback('Cadastro deletado do banco com sucesso de forma direta. O acesso está bloqueado.', 'warning');
          } else {
              showFeedback('Usuário excluído com sucesso do sistema (Perfil e Autenticação)!', 'success');
          }
          
          // Re-busca os usuários reais direto do banco de dados para sincronizar a lista de forma limpa e real
          await fetchProfiles();
      } catch (err: any) {
          console.error("Error deleting user:", err);
          showFeedback(`Erro ao excluir usuário: ${err.message}`, 'error');
          setProfiles(previousProfiles); // Reverte se houver erro absoluto
      } finally {
          setDeletingUserId(null);
      }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.includes('@')) {
      showFeedback('Por favor, informe um email válido.', 'error');
      return;
    }
    if (newPassword.length < 6) {
      showFeedback('Sua senha deve ter no mínimo 6 caracteres.', 'error');
      return;
    }

    setCreatingUser(true);
    try {
      // Obter o token da sessão ativa do administrador do Supabase
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        throw new Error("Sessão expirada. Faça login novamente.");
      }

      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email: newEmail.trim(),
          password: newPassword,
          role: newRole,
          allowed_tabs: newSelectedTabs,
          allowed_sub_tabs: []
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao criar usuário.');
      }

      showFeedback('Usuário cadastrado com sucesso (Login, Perfil e Permissões)!', 'success');
      
      // Limpar campos
      setNewEmail('');
      setNewPassword('');
      setNewRole('user');
      setNewSelectedTabs([Tab.DASHBOARD]);
      setShowCreateForm(false);
      
      // Recarregar os perfis
      await fetchProfiles();
    } catch (err: any) {
      console.error("Error creating user:", err);
      showFeedback(err.message || 'Erro de conexão ao criar usuário.', 'error');
    } finally {
      setCreatingUser(false);
    }
  };

  if (!isOpen) return null;

  const filteredProfiles = profiles.filter(p => 
    p.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const availableTabs = [
    Tab.DASHBOARD, 
    Tab.FINANCIAL, 
    Tab.ORTHODONTICS, 
    Tab.LABWORK, 
    Tab.MEETINGS,
    Tab.SUPPORT, 
    Tab.PASSWORDS, 
    Tab.RESPONSIBILITIES, 
    Tab.BIBLIOTECA,
    Tab.TASKS
  ];
  
  // Conditionally add Management tab only for master email
  if (currentUserEmail === 'clinica.centrodosorrisosc@gmail.com') {
    availableTabs.push(Tab.MANAGEMENT);
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/20 dark:bg-black/60 backdrop-blur-2xl p-4 animate-in fade-in duration-200">
      <div className="bg-surface border border-border w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-border bg-surface flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold text-text">Gestão de Usuários & Permissões</h3>
            <p className="text-xs text-slate-400">Configure o acesso para recepção, administrativo e dentistas.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-text"><X className="w-6 h-6" /></button>
        </div>

        <div className="p-4 bg-surface border-b border-border flex flex-col md:flex-row gap-4 items-center justify-between">
          <input 
            type="text" 
            placeholder="Buscar por email..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 w-full bg-panel border border-border rounded-lg px-4 py-2.5 text-sm text-text focus:border-blue-500 outline-none"
          />
          {currentUserEmail === 'clinica.centrodosorrisosc@gmail.com' && (
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-text text-xs font-bold px-4 py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              {showCreateForm ? 'Cancelar Cadastro' : 'Cadastrar Novo Usuário'}
            </button>
          )}
        </div>

        {showCreateForm && currentUserEmail === 'clinica.centrodosorrisosc@gmail.com' && (
          <form onSubmit={handleCreateUser} className="m-6 p-5 bg-panel border border-blue-500/20 rounded-xl flex flex-col gap-4 animate-in slide-in-from-top-4 duration-200">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <UserPlus className="w-5 h-5 text-blue-400" />
              <h4 className="text-sm font-bold text-text uppercase tracking-wider">Criar Novo Usuário no Sistema</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Email de Acesso</label>
                <input 
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-panel border border-border rounded-lg px-3 py-2 text-sm text-text focus:border-blue-500 outline-none"
                  placeholder="exemplo@gmail.com"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Senha de Acesso</label>
                <input 
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-panel border border-border rounded-lg px-3 py-2 text-sm text-text focus:border-blue-500 outline-none"
                  placeholder="mínimo 6 dígitos"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Cargo / Função</label>
                <select 
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full bg-panel border border-border rounded-lg px-3 py-2 text-sm text-text focus:border-blue-500 outline-none cursor-pointer"
                >
                  <option value="user">Usuário Padrão</option>
                  <option value="reception">Recepção</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Definir Abas Permitidas</label>
              <div className="flex flex-wrap gap-2">
                {availableTabs.map(tab => {
                  const isChecked = newSelectedTabs.includes(tab);
                  return (
                    <button
                      type="button"
                      key={tab}
                      onClick={() => {
                        if (isChecked) {
                          if (newSelectedTabs.length > 1) {
                            setNewSelectedTabs(newSelectedTabs.filter(t => t !== tab));
                          }
                        } else {
                          setNewSelectedTabs([...newSelectedTabs, tab]);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                        isChecked 
                          ? 'bg-blue-500/20 border-blue-500/50 text-blue-300 hover:bg-blue-500/30' 
                          : 'bg-panel border-border text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {tab}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-slate-400 mt-2">Dica: Após criar o usuário, você poderá refinar suas sub-abas clicando em "Detalhes" na lista abaixo.</p>
            </div>

            <div className="flex justify-end gap-3 border-t border-border pt-3">
              <button 
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewEmail('');
                  setNewPassword('');
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                disabled={creatingUser}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-text text-xs font-bold rounded-lg transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {creatingUser ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Criando Usuário...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5" />
                    Confirmar Cadastro
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <div className="bg-slate-800/30 border border-slate-500/20 rounded-lg p-3 mb-4 flex items-start gap-3">
            <div className="mt-0.5 text-blue-400">
              <Info className="w-4 h-4" />
            </div>
            <div className="text-xs text-slate-300">
              <strong className="text-text block mb-1">Indicadores Online</strong>
              O sistema mostra em tempo real quais usuários estão utilizando a plataforma agora. Para um usuário aparecer como <strong>Online</strong>, ele deve estar com o aplicativo aberto neste momento.
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col gap-4 animate-pulse">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-panel border border-border rounded-xl h-20 w-full"></div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {filteredProfiles.map(user => (
                <div key={user.id} className="bg-panel border border-border rounded-xl overflow-hidden group">
                    <div className="p-4 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                      <div className="flex flex-col">
                        <span className="text-text font-bold text-sm flex items-center gap-2">
                            {user.email}
                            {user.id === currentUserId && <span className="text-[9px] bg-blue-500 text-text px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Você</span>}
                            {onlineUsers.includes(user.id) ? (
                                <span className="text-[9px] bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider flex items-center gap-1" title="Usuário está com o sistema aberto neste momento">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                                    Online
                                </span>
                            ) : (
                                <span className="text-[9px] bg-slate-500/20 border border-slate-500/50 text-slate-400 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider flex items-center gap-1" title="Usuário está com o sistema fechado">
                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-500"></div>
                                    Offline
                                </span>
                            )}
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-slate-500 font-mono">{user.id.slice(0, 8)}...</span>
                            <button 
                                onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}
                                className="text-[10px] bg-panel/80 hover:bg-white/20 px-2 py-0.5 rounded text-slate-300 flex items-center gap-1"
                            >
                                {expandedUser === user.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                Detalhes
                            </button>
                        </div>
                        
                        <div className="flex gap-2 mt-2 items-center">
                            <select 
                                value={user.role || 'user'}
                                onChange={(e) => updateRole(user.id, e.target.value as any)}
                                className="bg-panel text-xs text-text border border-border rounded px-2 py-1 outline-none"
                            >
                                <option value="admin">Administrador</option>
                                <option value="reception">Recepção</option>
                                <option value="user">Usuário Padrão</option>
                            </select>

                            {/* DELETE BUTTON */}
                            {user.id !== currentUserId && (
                                <button 
                                    onClick={() => setUserToDelete({ id: user.id, email: user.email || '' })}
                                    disabled={deletingUserId !== null}
                                    className="p-1 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                    title="Excluir Usuário"
                                >
                                    {deletingUserId === user.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                                    ) : (
                                        <Trash2 className="w-4 h-4" />
                                    )}
                                </button>
                            )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 w-full md:w-auto">
                        <span className="text-[10px] font-bold uppercase text-slate-500">Acesso Principal</span>
                        <div className="flex flex-wrap gap-2">
                          {availableTabs.map(tab => {
                            const safeTabs = Array.isArray(user.allowed_tabs) ? user.allowed_tabs : [];
                            const hasAccess = safeTabs.includes(tab);
                            return (
                              <button
                                key={tab}
                                onClick={() => toggleTabPermission(user.id, tab, safeTabs)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                  hasAccess 
                                    ? 'bg-blue-500/20 border-blue-500/40 text-blue-300 hover:bg-blue-500/30' 
                                    : 'bg-panel border-border text-slate-500 hover:text-slate-300'
                                }`}
                              >
                                {tab}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* SUB-TABS SECTION (Expandable) */}
                    {expandedUser === user.id && (
                        <div className="bg-panel border-t border-border p-4 animate-in fade-in slide-in-from-top-1">
                            <h4 className="text-xs font-bold text-text uppercase mb-3 flex items-center gap-2">
                                <Sliders className="text-purple-400 w-4 h-4" />
                                Permissões Granulares (Sub-abas)
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {Object.entries(SUB_TABS_CONFIG).map(([mainTab, subTabs]) => {
                                    // Only show if user has access to main tab
                                    const safeTabs = Array.isArray(user.allowed_tabs) ? user.allowed_tabs : [];
                                    if (!safeTabs.includes(mainTab)) return null;

                                    return (
                                        <div key={mainTab} className="bg-panel rounded-lg p-3 border border-border">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase mb-2 block border-b border-border pb-1">{mainTab}</span>
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {subTabs.map(sub => {
                                                    const safeSubTabs = Array.isArray(user.allowed_sub_tabs) ? user.allowed_sub_tabs : [];
                                                    const isAllowed = safeSubTabs.includes(sub.id);
                                                    return (
                                                        <button 
                                                            key={sub.id}
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              toggleSubTabPermission(user.id, sub.id, safeSubTabs);
                                                            }}
                                                            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors border ${
                                                                isAllowed 
                                                                ? 'bg-purple-500/20 border-purple-500/40 text-purple-200' 
                                                                : 'bg-panel border-border text-slate-500 hover:text-slate-300'
                                                            }`}
                                                        >
                                                            <div className={`size-2 rounded-full ${isAllowed ? 'bg-purple-400' : 'bg-slate-600'}`}></div>
                                                            {sub.label}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CUSTOM CONFIRMATION OVERLAY */}
      {userToDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20 dark:bg-black/60 backdrop-blur-2xl p-4 animate-in fade-in duration-150">
          <div className="bg-surface border border-red-500/20 w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <h4 className="text-lg font-bold text-text flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-500" />
              Confirmar Exclusão
            </h4>
            <p className="text-sm text-slate-300 mt-3 leading-relaxed">
              Tem certeza que deseja excluir permanentemente o usuário <strong className="text-text break-all">{userToDelete.email}</strong>?
            </p>
            <p className="text-xs text-red-400 mt-2">
              Esta ação não pode ser desfeita. Todo o acesso ao sistema será revogado e os dados do perfil dele serão deletados.
            </p>
            
            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                onClick={async () => {
                  const { id } = userToDelete;
                  setUserToDelete(null);
                  await deleteUser(id);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-text text-sm font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM FEEDBACK TOAST BANNER */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[210] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl animate-in slide-in-from-top-4 duration-200 bg-surface text-text text-sm font-medium border-border min-w-[280px] max-w-[90vw]">
          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
            toast.type === 'success' ? 'bg-surface' : toast.type === 'error' ? 'bg-surface' : 'bg-surface'
          }`} />
          <span className="flex-1 text-xs text-slate-200">{toast.message}</span>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-text transition-colors cursor-pointer ml-1 p-0.5 rounded hover:bg-panel">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
