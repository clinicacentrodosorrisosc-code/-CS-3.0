import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { UserProfile, Tab } from '../types';
import { 
  X, 
  ChevronUp, 
  ChevronDown, 
  Trash2, 
  Sliders, 
  Loader2, 
  UserPlus, 
  Info, 
  Key, 
  Eye, 
  EyeOff, 
  Copy, 
  Check, 
  Search, 
  Shield, 
  ShieldCheck,
  ShieldAlert, 
  Users, 
  Sparkles, 
  RefreshCw, 
  CheckCircle2, 
  Wand2,
  Lock,
  Mail,
  User as UserIcon,
  Filter
} from 'lucide-react';

interface PermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onlineUsers?: string[];
}

// Configuration of available sub-tabs structure
const SUB_TABS_CONFIG: Record<string, { id: string; label: string; description?: string }[]> = {
  [Tab.FINANCIAL]: [
    { id: 'financial_overview', label: 'Visão Geral' },
    { id: 'financial_transactions', label: 'Receitas' },
    { id: 'financial_pricing', label: 'Precificação' },
    { id: 'financial_viability', label: 'Viabilidade & Comissões (Exclusivo Admin)' },
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
    { id: 'campaign_calendar', label: 'Calendário de Campanhas' },
    { id: 'meeting_minutes', label: 'Atas de Reuniões' },
    { id: 'clinic_ideas', label: 'Ideias & Melhorias' },
    { id: 'sales_playbook', label: 'Playbook & Scripts' },
    { id: 'management_overview', label: 'Visão Geral (Gráficos)' },
    { id: 'management_breakeven', label: 'Ponto de Equilíbrio' }
  ],
  [Tab.TASKS]: [
    { id: 'tasks', label: 'Tarefas' },
    { id: 'reports', label: 'Relatórios' }
  ]
};

// Ready-to-use permission presets
const PRESET_TEMPLATES: Record<string, { name: string; icon: string; description: string; role: 'admin' | 'reception' | 'user'; tabs: string[]; subTabs: string[] }> = {
  admin: {
    name: 'Administrador (Total)',
    icon: '👑',
    description: 'Acesso irrestrito a todas as abas e ferramentas.',
    role: 'admin',
    tabs: [
      Tab.DASHBOARD, Tab.FINANCIAL, Tab.ORTHODONTICS, Tab.LABWORK, Tab.MEETINGS,
      Tab.SUPPORT, Tab.PASSWORDS, Tab.RESPONSIBILITIES, Tab.BIBLIOTECA, Tab.TASKS
    ],
    subTabs: [
      'financial_overview', 'financial_transactions', 'financial_pricing', 'financial_viability', 'financial_settings',
      'ortho_vision', 'ortho_calendar', 'ortho_grid', 'ortho_patients', 'ortho_settings',
      'dash_financial', 'lab_kanban', 'campaign_calendar', 'meeting_minutes', 'clinic_ideas', 'sales_playbook',
      'tasks', 'reports', 'management_overview', 'management_breakeven'
    ]
  },
  reception: {
    name: 'Recepção / Atendimento',
    icon: '📞',
    description: 'Agenda, pacientes, receitas, laboratório, reuniões e senhas.',
    role: 'reception',
    tabs: [
      Tab.DASHBOARD, Tab.FINANCIAL, Tab.ORTHODONTICS, Tab.LABWORK, Tab.MEETINGS,
      Tab.SUPPORT, Tab.PASSWORDS, Tab.TASKS
    ],
    subTabs: [
      'dash_financial', 'financial_overview', 'financial_transactions',
      'ortho_vision', 'ortho_calendar', 'ortho_grid', 'ortho_patients',
      'lab_kanban', 'meeting_minutes', 'campaign_calendar', 'tasks', 'reports'
    ]
  },
  dentist: {
    name: 'Dentista / Clínico',
    icon: '🦷',
    description: 'Ortodontia, laboratório de próteses, biblioteca e tarefas.',
    role: 'user',
    tabs: [
      Tab.ORTHODONTICS, Tab.LABWORK, Tab.BIBLIOTECA, Tab.TASKS, Tab.SUPPORT
    ],
    subTabs: [
      'ortho_vision', 'ortho_calendar', 'ortho_grid', 'ortho_patients',
      'lab_kanban', 'tasks'
    ]
  },
  sales: {
    name: 'Comercial & Vendas',
    icon: '💼',
    description: 'Dashboard comercial, receitas, campanhas, atas e tarefas.',
    role: 'user',
    tabs: [
      Tab.DASHBOARD, Tab.FINANCIAL, Tab.MEETINGS, Tab.TASKS
    ],
    subTabs: [
      'dash_financial', 'financial_overview', 'financial_transactions',
      'campaign_calendar', 'meeting_minutes', 'sales_playbook', 'clinic_ideas', 'tasks', 'reports'
    ]
  },
  basic: {
    name: 'Acesso Básico',
    icon: '🔒',
    description: 'Apenas visualização do dashboard inicial.',
    role: 'user',
    tabs: [Tab.DASHBOARD],
    subTabs: ['dash_financial']
  }
};

const ALL_AVAILABLE_TABS = [
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

export const PermissionsModal: React.FC<PermissionsModalProps> = ({ isOpen, onClose, onlineUsers = [] }) => {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>('user');

  // Deletion state
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<{ id: string; email: string } | null>(null);
  
  // Password Reset state
  const [passwordModalUser, setPasswordModalUser] = useState<{ id: string; email: string } | null>(null);
  const [newResetPassword, setNewResetPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);

  // New User Form State
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'reception' | 'user'>('user');
  const [newSelectedTabs, setNewSelectedTabs] = useState<string[]>([Tab.DASHBOARD]);
  const [newSelectedSubTabs, setNewSelectedSubTabs] = useState<string[]>(['dash_financial']);
  const [creatingUser, setCreatingUser] = useState(false);
  const [activePreset, setActivePreset] = useState<string>('basic');

  // Custom feedback toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  const showFeedback = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Generate secure password
  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
    let pass = 'CS#';
    for (let i = 0; i < 6; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pass;
  };

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
      setCurrentUserEmail(user?.email || null);

      const { data } = await supabase.from('profiles').select('*');
      if (data) {
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

        // Detect current user role
        const me = normalizedProfiles.find((p: any) => p.id === user?.id || p.email === user?.email);
        if (me) {
          setCurrentUserRole(me.role || 'user');
        } else if (user?.email === 'clinica.centrodosorrisosc@gmail.com') {
          setCurrentUserRole('admin');
        }
      }
    } catch (e) {
      console.error("Error fetching profiles:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchProfiles();
    }
  }, [isOpen]);

  const applyTemplateToNewUser = (key: string) => {
    const template = PRESET_TEMPLATES[key];
    if (!template) return;
    setActivePreset(key);
    setNewRole(template.role);
    setNewSelectedTabs([...template.tabs]);
    setNewSelectedSubTabs([...template.subTabs]);
  };

  const applyTemplateToExistingUser = async (userId: string, key: string) => {
    const template = PRESET_TEMPLATES[key];
    if (!template) return;

    // Optimistic update
    setProfiles(prev => prev.map(p => {
      if (p.id === userId) {
        return {
          ...p,
          role: template.role,
          allowed_tabs: [...template.tabs],
          allowed_sub_tabs: [...template.subTabs]
        };
      }
      return p;
    }));

    const { error } = await supabase
      .from('profiles')
      .update({
        role: template.role,
        allowed_tabs: template.tabs,
        allowed_sub_tabs: template.subTabs
      })
      .eq('id', userId);

    if (error) {
      console.error("Failed to apply preset to user:", error);
      showFeedback(`Erro ao aplicar perfil: ${error.message}`, 'error');
      fetchProfiles();
    } else {
      showFeedback(`Template "${template.name}" aplicado com sucesso!`, 'success');
    }
  };

  const toggleTabPermission = async (userId: string, tabName: string, currentTabs: string[] | null) => {
    const safeTabs = Array.isArray(currentTabs) ? currentTabs : [];
    let newTabs: string[];
    
    if (safeTabs.includes(tabName)) {
      newTabs = safeTabs.filter(t => t !== tabName);
    } else {
      newTabs = [...safeTabs, tabName];
    }

    setProfiles(prev => prev.map(p => p.id === userId ? { ...p, allowed_tabs: newTabs } : p));

    const { error } = await supabase
      .from('profiles')
      .update({ allowed_tabs: newTabs })
      .eq('id', userId);

    if (error) {
      console.error("Failed to update tab permission:", error);
      setProfiles(prev => prev.map(p => p.id === userId ? { ...p, allowed_tabs: safeTabs } : p));
      showFeedback('Erro ao atualizar permissão da aba.', 'error');
    }
  };

  const toggleAllTabsForUser = async (userId: string, grantAll: boolean) => {
    const newTabs = grantAll ? [...ALL_AVAILABLE_TABS] : [Tab.DASHBOARD];
    
    setProfiles(prev => prev.map(p => p.id === userId ? { ...p, allowed_tabs: newTabs } : p));

    const { error } = await supabase
      .from('profiles')
      .update({ allowed_tabs: newTabs })
      .eq('id', userId);

    if (error) {
      showFeedback('Erro ao alterar todas as abas.', 'error');
      fetchProfiles();
    } else {
      showFeedback(grantAll ? 'Todas as abas foram liberadas!' : 'Acesso reduzido ao mínimo.', 'success');
    }
  };

  const toggleSubTabPermission = async (userId: string, subTabId: string, currentSubTabs: string[] | undefined | null) => {
    const safeCurrentSubTabs = Array.isArray(currentSubTabs) ? currentSubTabs : [];
    let newSubTabs: string[];

    if (safeCurrentSubTabs.includes(subTabId)) {
      newSubTabs = safeCurrentSubTabs.filter(t => t !== subTabId);
    } else {
      newSubTabs = [...safeCurrentSubTabs, subTabId];
    }

    setProfiles(prev => prev.map(p => p.id === userId ? { ...p, allowed_sub_tabs: newSubTabs } : p));

    const { error } = await supabase
      .from('profiles')
      .update({ allowed_sub_tabs: newSubTabs })
      .eq('id', userId);
    
    if (error) {
      console.error('Error updating sub-tabs:', error);
      setProfiles(prev => prev.map(p => p.id === userId ? { ...p, allowed_sub_tabs: safeCurrentSubTabs } : p));
      showFeedback('Erro ao atualizar sub-aba.', 'error');
    }
  };

  const updateRole = async (userId: string, newRole: 'admin' | 'user' | 'reception') => {
    setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role: newRole } : p));
    
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    if (error) {
      console.error('Error updating role:', error);
      showFeedback('Erro ao atualizar cargo.', 'error');
      fetchProfiles();
    } else {
      showFeedback(`Cargo alterado para ${newRole.toUpperCase()}!`, 'success');
    }
  };

  // Delete User
  const deleteUser = async (userId: string) => {
    setDeletingUserId(userId);
    const previousProfiles = [...profiles];
    setProfiles(prev => prev.filter(p => p.id !== userId));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // Try server endpoint first
      if (token) {
        const response = await fetch('/api/admin/delete-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ target_user_id: userId })
        });

        if (response.ok) {
          showFeedback('Usuário excluído com sucesso do sistema!', 'success');
          await fetchProfiles();
          return;
        }
      }

      // Fallback via RPC or direct profiles delete
      const { error: rpcError } = await supabase.rpc('delete_user_account', { target_user_id: userId });
      if (rpcError) {
        const { error: tableError } = await supabase.from('profiles').delete().eq('id', userId);
        if (tableError) throw tableError;
        showFeedback('Perfil do usuário excluído com sucesso.', 'warning');
      } else {
        showFeedback('Usuário excluído com sucesso!', 'success');
      }

      await fetchProfiles();
    } catch (err: any) {
      console.error("Error deleting user:", err);
      showFeedback(`Erro ao excluir usuário: ${err.message}`, 'error');
      setProfiles(previousProfiles);
    } finally {
      setDeletingUserId(null);
    }
  };

  // Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.includes('@')) {
      showFeedback('Por favor, informe um email válido.', 'error');
      return;
    }
    if (newPassword.length < 6) {
      showFeedback('A senha deve ter no mínimo 6 caracteres.', 'error');
      return;
    }

    setCreatingUser(true);
    try {
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
          email: newEmail.trim().toLowerCase(),
          password: newPassword,
          full_name: newFullName.trim(),
          role: newRole,
          allowed_tabs: newSelectedTabs,
          allowed_sub_tabs: newSelectedSubTabs
        })
      });

      let result: any = {};
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        result = await response.json().catch(() => ({}));
      } else {
        const text = await response.text();
        result = { error: text || `HTTP ${response.status}` };
      }
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao criar usuário.');
      }

      showFeedback(`Usuário ${newEmail} cadastrado com sucesso!`, 'success');
      
      // Reset form
      setNewEmail('');
      setNewPassword('');
      setNewFullName('');
      setNewRole('user');
      setNewSelectedTabs([Tab.DASHBOARD]);
      setNewSelectedSubTabs(['dash_financial']);
      setShowCreateForm(false);
      
      await fetchProfiles();
    } catch (err: any) {
      console.error("Error creating user:", err);
      showFeedback(err.message || 'Erro ao criar usuário.', 'error');
    } finally {
      setCreatingUser(false);
    }
  };

  // Update Password
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModalUser || !newResetPassword) return;

    if (newResetPassword.length < 6) {
      showFeedback('A senha deve ter pelo menos 6 caracteres.', 'error');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error("Sessão expirada. Faça login novamente.");
      }

      const response = await fetch('/api/admin/update-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          target_user_id: passwordModalUser.id,
          target_email: passwordModalUser.email,
          new_password: newResetPassword
        })
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao redefinir a senha.');
      }

      showFeedback(`Nova senha definida com sucesso para ${passwordModalUser.email}!`, 'success');
      setPasswordModalUser(null);
      setNewResetPassword('');
    } catch (err: any) {
      console.error("Error updating password:", err);
      showFeedback(err.message || 'Erro ao atualizar senha.', 'error');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setPasswordCopied(true);
    showFeedback('Senha copiada para a área de transferência!', 'success');
    setTimeout(() => setPasswordCopied(false), 2000);
  };

  // Filter profiles
  const filteredProfiles = useMemo(() => {
    return profiles.filter(p => {
      const matchesSearch = 
        p.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p as any).full_name?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesRole = roleFilter === 'all' || (p.role || 'user') === roleFilter;
      
      const isOnline = onlineUsers.includes(p.id);
      const matchesStatus = 
        statusFilter === 'all' || 
        (statusFilter === 'online' && isOnline) || 
        (statusFilter === 'offline' && !isOnline);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [profiles, searchTerm, roleFilter, statusFilter, onlineUsers]);

  // Statistics
  const stats = useMemo(() => {
    const total = profiles.length;
    const admins = profiles.filter(p => p.role === 'admin').length;
    const reception = profiles.filter(p => p.role === 'reception').length;
    const online = profiles.filter(p => onlineUsers.includes(p.id)).length;
    return { total, admins, reception, online };
  }, [profiles, onlineUsers]);

  if (!isOpen) return null;

  const isCurrentUserAdmin = currentUserRole === 'admin' || currentUserEmail === 'clinica.centrodosorrisosc@gmail.com';

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 text-slate-100 w-full max-w-6xl rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* MODAL HEADER */}
        <div className="p-5 sm:p-6 border-b border-slate-800 bg-slate-900/90 backdrop-blur-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20 text-white shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black tracking-tight text-white">
                  Gestão de Usuários & Permissões
                </h3>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Painel Admin
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Crie novos acessos, defina senhas seguras e personalize permissões granulares por função.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {isCurrentUserAdmin && (
              <button
                onClick={() => {
                  setShowCreateForm(!showCreateForm);
                  if (!showCreateForm) {
                    setNewPassword(generateRandomPassword());
                    applyTemplateToNewUser('reception');
                  }
                }}
                className={`text-xs font-bold px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 shadow-lg cursor-pointer ${
                  showCreateForm 
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700' 
                    : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-purple-900/40'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                {showCreateForm ? 'Fechar Cadastro' : 'Cadastrar Novo Usuário'}
              </button>
            )}
            <button 
              onClick={onClose} 
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* QUICK STATS BAR */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 p-4 sm:px-6 bg-slate-950/40 border-b border-slate-800/80">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 flex items-center gap-3">
            <div className="size-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Total Usuários</span>
              <p className="text-lg font-black text-white">{stats.total}</p>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 flex items-center gap-3">
            <div className="size-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Administradores</span>
              <p className="text-lg font-black text-purple-300">{stats.admins}</p>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 flex items-center gap-3">
            <div className="size-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <UserIcon className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Recepção / Outros</span>
              <p className="text-lg font-black text-indigo-300">{stats.reception + (stats.total - stats.admins - stats.reception)}</p>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 flex items-center gap-3">
            <div className="size-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <div className="size-2.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Online Agora</span>
              <p className="text-lg font-black text-emerald-400">{stats.online}</p>
            </div>
          </div>
        </div>

        {/* CREATE USER ACCORDION PANEL */}
        {showCreateForm && isCurrentUserAdmin && (
          <form 
            onSubmit={handleCreateUser} 
            className="m-4 sm:m-6 p-5 sm:p-6 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-purple-500/30 rounded-3xl shadow-xl flex flex-col gap-5 animate-in slide-in-from-top-4 duration-200"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h4 className="text-sm font-black text-white uppercase tracking-wider">
                  Criar Novo Usuário & Definir Acessos
                </h4>
              </div>
              <span className="text-xs text-purple-400 font-semibold">
                Passo 1 de 2: Credenciais & Template
              </span>
            </div>

            {/* QUICK PRESET SELECTOR */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Escolher Perfil Pré-Configurado (1 Clique)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {Object.entries(PRESET_TEMPLATES).map(([key, template]) => {
                  const isSelected = activePreset === key;
                  return (
                    <button
                      type="button"
                      key={key}
                      onClick={() => applyTemplateToNewUser(key)}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected 
                          ? 'bg-purple-600/20 border-purple-500 text-white ring-2 ring-purple-500/30 shadow-lg' 
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="text-base">{template.icon}</span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-purple-400" />}
                      </div>
                      <span className="text-xs font-bold text-slate-200 line-clamp-1">{template.name}</span>
                      <span className="text-[10px] text-slate-400 line-clamp-2 mt-1 leading-tight">{template.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CREDENTIALS FORM */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-purple-400" />
                  Email de Acesso *
                </label>
                <input 
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
                  placeholder="usuario@centrodosorriso.com"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-purple-400" />
                    Senha Inicial *
                  </span>
                  <button
                    type="button"
                    onClick={() => setNewPassword(generateRandomPassword())}
                    className="text-[10px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Wand2 className="w-3 h-3" /> Gerar Segura
                  </button>
                </label>
                <div className="relative">
                  <input 
                    type={showNewPassword ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-white font-mono placeholder-slate-500 focus:border-purple-500 outline-none transition-all"
                    placeholder="Mínimo 6 dígitos"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-purple-400" />
                  Cargo no Sistema
                </label>
                <select 
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-purple-500 outline-none cursor-pointer"
                >
                  <option value="user">Usuário Padrão</option>
                  <option value="reception">Recepção / Atendimento</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>

            {/* TAB SELECTION */}
            <div className="border-t border-slate-800/80 pt-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Abas Permitidas ({newSelectedTabs.length}/{ALL_AVAILABLE_TABS.length})
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setNewSelectedTabs([...ALL_AVAILABLE_TABS])}
                    className="text-[10px] font-bold text-purple-400 hover:underline cursor-pointer"
                  >
                    Marcar Todas
                  </button>
                  <span className="text-slate-600">•</span>
                  <button
                    type="button"
                    onClick={() => setNewSelectedTabs([Tab.DASHBOARD])}
                    className="text-[10px] font-bold text-slate-400 hover:underline cursor-pointer"
                  >
                    Apenas Dashboard
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {ALL_AVAILABLE_TABS.map(tab => {
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
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer flex items-center gap-1.5 ${
                        isChecked 
                          ? 'bg-purple-600/20 border-purple-500/50 text-purple-200 hover:bg-purple-600/30 shadow-sm' 
                          : 'bg-slate-950/60 border-slate-800 text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      <div className={`size-2 rounded-full ${isChecked ? 'bg-purple-400' : 'bg-slate-600'}`} />
                      {tab}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex items-center justify-between border-t border-slate-800 pt-4">
              <div className="text-xs text-slate-400">
                A senha poderá ser redefinida a qualquer momento após o cadastro.
              </div>
              <div className="flex items-center gap-3">
                <button 
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={creatingUser}
                  className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-purple-900/30 disabled:opacity-50"
                >
                  {creatingUser ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Cadastrando Usuário...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      Concluir Cadastro
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* SEARCH AND FILTERS BAR */}
        <div className="p-4 sm:px-6 bg-slate-950/30 border-b border-slate-800/80 flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Buscar por email ou nome do usuário..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-transparent text-xs text-slate-200 outline-none px-2 py-1 cursor-pointer"
              >
                <option value="all" className="bg-slate-900">Todos os Cargos</option>
                <option value="admin" className="bg-slate-900">Administrador</option>
                <option value="reception" className="bg-slate-900">Recepção</option>
                <option value="user" className="bg-slate-900">Usuário Padrão</option>
              </select>
            </div>

            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-xs text-slate-200 outline-none px-2 py-1 cursor-pointer"
              >
                <option value="all" className="bg-slate-900">Status (Todos)</option>
                <option value="online" className="bg-slate-900">Apenas Online</option>
                <option value="offline" className="bg-slate-900">Apenas Offline</option>
              </select>
            </div>
          </div>
        </div>

        {/* USERS LIST */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-4">
          
          {loading ? (
            <div className="flex flex-col gap-3 animate-pulse">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-slate-900/60 border border-slate-800 rounded-2xl h-24 w-full" />
              ))}
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div className="py-16 text-center text-slate-500 flex flex-col items-center justify-center">
              <Users className="w-12 h-12 text-slate-700 mb-3" />
              <p className="text-sm font-semibold text-slate-400">Nenhum usuário encontrado com os filtros atuais.</p>
              <p className="text-xs text-slate-600 mt-1">Tente ajustar a busca ou os filtros de cargo/status.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredProfiles.map(user => {
                const isOnline = onlineUsers.includes(user.id);
                const isCurrent = user.id === currentUserId;
                const safeTabs = Array.isArray(user.allowed_tabs) ? user.allowed_tabs : [];
                const safeSubTabs = Array.isArray(user.allowed_sub_tabs) ? user.allowed_sub_tabs : [];
                const isExpanded = expandedUser === user.id;

                return (
                  <div 
                    key={user.id} 
                    className={`bg-slate-900/70 border rounded-2xl overflow-hidden transition-all duration-200 ${
                      isExpanded ? 'border-purple-500/40 ring-1 ring-purple-500/20 bg-slate-900' : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* User Card Main Row */}
                    <div className="p-4 sm:p-5 flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
                      
                      {/* Left: User Identity */}
                      <div className="flex items-center gap-3.5">
                        <div className={`size-11 rounded-2xl flex items-center justify-center font-bold text-sm text-white shadow-inner uppercase shrink-0 ${
                          user.role === 'admin' 
                            ? 'bg-gradient-to-tr from-purple-600 to-indigo-600 shadow-purple-900/30' 
                            : user.role === 'reception'
                              ? 'bg-gradient-to-tr from-blue-600 to-cyan-600 shadow-blue-900/30'
                              : 'bg-gradient-to-tr from-slate-700 to-slate-600'
                        }`}>
                          {user.email ? user.email.slice(0, 2) : 'US'}
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white font-bold text-sm">{user.email}</span>
                            
                            {isCurrent && (
                              <span className="text-[9px] bg-purple-500 text-white px-1.5 py-0.5 rounded-md uppercase font-black tracking-wider">
                                Você
                              </span>
                            )}

                            {isOnline ? (
                              <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1.5">
                                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Online
                              </span>
                            ) : (
                              <span className="text-[9px] bg-slate-800 border border-slate-700 text-slate-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1.5">
                                <span className="size-1.5 rounded-full bg-slate-600" />
                                Offline
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                            {/* Role Selector */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] uppercase font-bold text-slate-400">Função:</span>
                              <select 
                                value={user.role || 'user'}
                                onChange={(e) => updateRole(user.id, e.target.value as any)}
                                disabled={!isCurrentUserAdmin}
                                className="bg-slate-950 border border-slate-800 text-xs font-semibold text-purple-300 rounded-lg px-2 py-1 outline-none cursor-pointer focus:border-purple-500 disabled:opacity-60"
                              >
                                <option value="admin">Administrador</option>
                                <option value="reception">Recepção</option>
                                <option value="user">Usuário Padrão</option>
                              </select>
                            </div>

                            <span className="text-slate-700">•</span>
                            <span className="text-[10px] text-slate-400 font-mono">ID: {user.id.slice(0, 8)}...</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Quick Actions */}
                      <div className="flex items-center gap-2 self-end lg:self-auto w-full lg:w-auto justify-end flex-wrap">
                        
                        {/* Redefinir Senha Button */}
                        {isCurrentUserAdmin && (
                          <button
                            onClick={() => {
                              setPasswordModalUser({ id: user.id, email: user.email });
                              setNewResetPassword(generateRandomPassword());
                            }}
                            className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                            title="Definir nova senha para este usuário"
                          >
                            <Key className="w-3.5 h-3.5 text-amber-400" />
                            Redefinir Senha
                          </button>
                        )}

                        {/* Detalhes / Permissões Toggle */}
                        <button 
                          onClick={() => setExpandedUser(isExpanded ? null : user.id)}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                            isExpanded 
                              ? 'bg-purple-600/20 border-purple-500/50 text-purple-200' 
                              : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-200'
                          }`}
                        >
                          <Sliders className="w-3.5 h-3.5 text-purple-400" />
                          Permissões ({safeTabs.length} abas)
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {/* Delete User Button */}
                        {isCurrentUserAdmin && !isCurrent && (
                          <button 
                            onClick={() => setUserToDelete({ id: user.id, email: user.email || '' })}
                            disabled={deletingUserId !== null}
                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors border border-transparent hover:border-red-500/20 cursor-pointer disabled:opacity-50"
                            title="Excluir Usuário permanentemente"
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

                    {/* EXPANDED PERMISSIONS DRAWER */}
                    {isExpanded && (
                      <div className="bg-slate-950/70 border-t border-slate-800 p-4 sm:p-5 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-150">
                        
                        {/* Quick Presets for this user */}
                        {isCurrentUserAdmin && (
                          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-3.5">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5">
                                <Sparkles className="w-3 h-3 text-purple-400" />
                                Aplicar Template Rápido a este usuário:
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => toggleAllTabsForUser(user.id, true)}
                                  className="text-[10px] font-bold text-purple-400 hover:underline cursor-pointer"
                                >
                                  Liberar Tudo
                                </button>
                                <span className="text-slate-700">•</span>
                                <button
                                  onClick={() => toggleAllTabsForUser(user.id, false)}
                                  className="text-[10px] font-bold text-slate-400 hover:underline cursor-pointer"
                                >
                                  Restringir
                                </button>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                              {Object.entries(PRESET_TEMPLATES).map(([key, template]) => (
                                <button
                                  key={key}
                                  onClick={() => applyTemplateToExistingUser(user.id, key)}
                                  className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-purple-900/30 border border-slate-800 hover:border-purple-500/40 text-slate-300 hover:text-white text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                                >
                                  <span>{template.icon}</span>
                                  <span>{template.name}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Main Tabs Permissions */}
                        <div>
                          <span className="text-[11px] font-bold uppercase text-slate-300 block mb-2">
                            Abas Principais Liberadas ({safeTabs.length}/{ALL_AVAILABLE_TABS.length})
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {ALL_AVAILABLE_TABS.map(tab => {
                              const hasAccess = safeTabs.includes(tab);
                              return (
                                <button
                                  key={tab}
                                  onClick={() => toggleTabPermission(user.id, tab, safeTabs)}
                                  disabled={!isCurrentUserAdmin}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed ${
                                    hasAccess 
                                      ? 'bg-purple-600/20 border-purple-500/50 text-purple-200 hover:bg-purple-600/30 shadow-sm' 
                                      : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                                  }`}
                                >
                                  <div className={`size-2 rounded-full ${hasAccess ? 'bg-purple-400' : 'bg-slate-600'}`} />
                                  {tab}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Sub-tabs Granular Permissions */}
                        <div className="border-t border-slate-800/80 pt-3">
                          <span className="text-[11px] font-bold uppercase text-slate-300 flex items-center gap-1.5 mb-3">
                            <Sliders className="w-3.5 h-3.5 text-purple-400" />
                            Permissões Detalhadas de Sub-Abas & Recursos
                          </span>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {Object.entries(SUB_TABS_CONFIG).map(([mainTab, subTabs]) => {
                              if (!safeTabs.includes(mainTab)) return null;

                              return (
                                <div key={mainTab} className="bg-slate-900 rounded-2xl p-3 border border-slate-800">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase block border-b border-slate-800 pb-1.5 mb-2">
                                    {mainTab}
                                  </span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {subTabs.map(sub => {
                                      const isAllowed = safeSubTabs.includes(sub.id);
                                      return (
                                        <button 
                                          key={sub.id}
                                          onClick={() => toggleSubTabPermission(user.id, sub.id, safeSubTabs)}
                                          disabled={!isCurrentUserAdmin}
                                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors border cursor-pointer disabled:cursor-not-allowed ${
                                            isAllowed 
                                              ? 'bg-purple-500/20 border-purple-500/40 text-purple-200' 
                                              : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
                                          }`}
                                        >
                                          <div className={`size-1.5 rounded-full ${isAllowed ? 'bg-purple-400' : 'bg-slate-600'}`} />
                                          {sub.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}

        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 sm:px-6 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-blue-400" />
            <span>As alterações de permissões são salvas em tempo real no banco de dados.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl transition-colors cursor-pointer"
          >
            Concluir & Fechar
          </button>
        </div>

      </div>

      {/* PASSWORD RESET DIALOG */}
      {passwordModalUser && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <form 
            onSubmit={handleUpdatePassword}
            className="bg-slate-900 border border-slate-700 text-slate-100 w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col gap-4"
          >
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="size-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-black text-white">Redefinir Senha do Usuário</h4>
                <p className="text-xs text-slate-400 truncate max-w-[260px]">{passwordModalUser.email}</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Nova Senha de Acesso</span>
                <button
                  type="button"
                  onClick={() => setNewResetPassword(generateRandomPassword())}
                  className="text-[10px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer"
                >
                  <Wand2 className="w-3 h-3" /> Gerar Aleatória
                </button>
              </label>
              <div className="relative">
                <input 
                  type={showResetPassword ? "text" : "password"}
                  required
                  value={newResetPassword}
                  onChange={(e) => setNewResetPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3.5 pr-20 py-3 text-sm text-white font-mono placeholder-slate-500 focus:border-purple-500 outline-none"
                  placeholder="Nova senha (mínimo 6 dígitos)"
                />
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(newResetPassword)}
                    className="p-1 text-slate-400 hover:text-white rounded cursor-pointer"
                    title="Copiar Senha"
                  >
                    {passwordCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="p-1 text-slate-400 hover:text-white rounded cursor-pointer"
                  >
                    {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-slate-400">
                O usuário utilizará esta nova senha para entrar imediatamente no sistema.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button 
                type="button"
                onClick={() => {
                  setPasswordModalUser(null);
                  setNewResetPassword('');
                }}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                disabled={isUpdatingPassword || !newResetPassword}
                className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
              >
                {isUpdatingPassword ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Salvar Nova Senha
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CONFIRM DELETE DIALOG */}
      {userToDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-red-500/30 text-slate-100 w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col gap-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="size-10 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-black text-white">Excluir Usuário</h4>
                <p className="text-xs text-red-400">Esta ação é irreversível</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">
              Tem certeza que deseja excluir permanentemente o usuário <strong className="text-white break-all">{userToDelete.email}</strong>?
            </p>
            <p className="text-xs text-slate-400 bg-red-500/10 border border-red-500/20 p-3 rounded-xl">
              O acesso desta conta ao sistema será revogado imediatamente e seu perfil será removido da clínica.
            </p>
            
            <div className="flex justify-end gap-3 pt-2">
              <button 
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                onClick={async () => {
                  const { id } = userToDelete;
                  setUserToDelete(null);
                  await deleteUser(id);
                }}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-lg shadow-red-900/30"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FEEDBACK TOAST BANNER */}
      {toast && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[220] flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-2xl animate-in slide-in-from-top-4 duration-200 text-xs font-bold min-w-[280px] max-w-[90vw] ${
          toast.type === 'success' 
            ? 'bg-slate-900/95 border-emerald-500/40 text-emerald-300 shadow-emerald-950/40' 
            : toast.type === 'error'
              ? 'bg-slate-900/95 border-red-500/40 text-red-300 shadow-red-950/40'
              : 'bg-slate-900/95 border-amber-500/40 text-amber-300 shadow-amber-950/40'
        }`}>
          <div className={`size-2 rounded-full shrink-0 ${
            toast.type === 'success' ? 'bg-emerald-400 animate-pulse' : toast.type === 'error' ? 'bg-red-400' : 'bg-amber-400'
          }`} />
          <span className="flex-1 text-slate-100">{toast.message}</span>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

    </div>
  );
};
