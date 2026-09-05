import React from 'react';
import { Tab } from '../../types';
import { 
  Bell, 
  Sun, 
  Moon, 
  ShieldCheck, 
  Activity, 
  Users, 
  ChevronRight,
  Sparkles,
  DollarSign,
  Calendar,
  FlaskConical,
  Briefcase,
  Headphones,
  KeyRound,
  CheckSquare,
  BookOpen,
  Menu,
  KanbanSquare
} from 'lucide-react';

interface AppHeaderProps {
  activeTab: Tab;
  requestedSubTab?: string | null;
  userRole: string;
  userEmail?: string;
  onlineUsers?: string[];
  notificationCount?: number;
  openNotifications?: () => void;
  theme?: 'light' | 'dark';
  toggleTheme?: () => void;
  openPermissions?: () => void;
  onMobileMenuToggle?: () => void;
  isSidebarExpanded?: boolean;
}

const TAB_CONFIG: Record<Tab, { label: string; icon: React.ElementType; description: string }> = {
  [Tab.CRM]: {
    label: 'CRM Clinica Experts',
    icon: KanbanSquare,
    description: 'Funis sincronizados e exportacao para WhatsApp'
  },
  [Tab.FINANCIAL]: { 
    label: 'Gestão Financeira', 
    icon: DollarSign, 
    description: 'Receitas, despesas, precificação e viabilidade' 
  },
  [Tab.ORTHODONTICS]: { 
    label: 'Ortodontia', 
    icon: Calendar, 
    description: 'Grade de presença, visão geral e pacientes' 
  },
  [Tab.LABWORK]: { 
    label: 'Laboratório & Prótese', 
    icon: FlaskConical, 
    description: 'Controle de ordens de serviço e kanban de produção' 
  },
  [Tab.MEETINGS]: { 
    label: 'Gestão & Comercial', 
    icon: Briefcase, 
    description: 'Campanhas, atas de reuniões, ideias e playbooks' 
  },
  [Tab.SUPPORT]: { 
    label: 'Chamados & Suporte', 
    icon: Headphones, 
    description: 'Solicitações internas e chamados de manutenção' 
  },
  [Tab.PASSWORDS]: { 
    label: 'Cofre & Governança', 
    icon: KeyRound, 
    description: 'Diretrizes, credenciais seguras e metas' 
  },
  [Tab.RESPONSIBILITIES]: { 
    label: 'Processos & SOPs', 
    icon: CheckSquare, 
    description: 'Instruções de trabalho e matriz de responsabilidades' 
  },
  [Tab.BIBLIOTECA]: { 
    label: 'Biblioteca Clínica', 
    icon: BookOpen, 
    description: 'Acervo científico, materiais e manuais' 
  },
  [Tab.TASKS]: {
    label: 'Tarefas & Atividades',
    icon: CheckSquare,
    description: 'Gerenciamento de pendências e tarefas'
  }
};

export const AppHeader: React.FC<AppHeaderProps> = ({
  activeTab,
  requestedSubTab,
  userRole,
  userEmail,
  onlineUsers = [],
  notificationCount = 0,
  openNotifications,
  theme = 'dark',
  toggleTheme,
  openPermissions,
  onMobileMenuToggle,
}) => {
  const currentTab = TAB_CONFIG[activeTab] || { 
    label: 'OdontoManager', 
    icon: Sparkles, 
    description: 'Sistema Integrado' 
  };
  const Icon = currentTab.icon;

  const getSubTabLabel = (subId?: string | null) => {
    if (!subId) return null;
    const clean = subId.replace(/_/g, ' ');
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  };

  const subLabel = getSubTabLabel(requestedSubTab);

  return (
    <header className="h-[60px] min-h-[60px] w-full px-4 sm:px-6 flex items-center justify-between border-b border-[#DFE6E2] dark:border-white/[0.08] bg-white/90 dark:bg-[#101714]/90 backdrop-blur-md z-20 transition-colors duration-200">
      {/* Left: Mobile trigger & Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMobileMenuToggle}
          className="lg:hidden p-2 rounded-xl text-[#5E6D66] hover:text-[#17211D] hover:bg-[#F0F4F2] dark:text-slate-400 dark:hover:text-white border border-[#DFE6E2] dark:border-white/10"
          aria-label="Abrir Menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#1F6F5B]/10 dark:bg-[#63B596]/15 text-[#1F6F5B] dark:text-[#63B596] flex items-center justify-center shadow-sm">
            <Icon className="w-4 h-4" />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-bold text-[#17211D] dark:text-slate-100 tracking-tight">
                {currentTab.label}
              </span>
              {subLabel && (
                <>
                  <ChevronRight className="w-3 h-3 text-[#86938D]" />
                  <span className="text-[#1F6F5B] dark:text-[#63B596] font-bold">{subLabel}</span>
                </>
              )}
            </div>
            <span className="text-[11px] text-[#5E6D66] dark:text-slate-400 hidden sm:inline">
              {currentTab.description}
            </span>
          </div>
        </div>
      </div>

      {/* Right: Search, online presence, permissions, notifications, theme */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Nexus Search Pill (From Reference UI) */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#F0F4F2] dark:bg-white/[0.04] border border-[#DFE6E2] dark:border-white/[0.08] text-xs text-[#5E6D66]">
          <span className="text-[11px]">Buscar...</span>
          <kbd className="px-1.5 py-0.5 rounded-md bg-white dark:bg-white/10 border border-[#DFE6E2] dark:border-white/10 text-[9px] font-mono font-bold text-[#86938D]">⌘+F</kbd>
        </div>

        {/* Live Presence Pill */}
        <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#EAF5F0] dark:bg-[#2A8069]/15 border border-[#CFE5DC] dark:border-[#2A8069]/30 text-[#1F6F5B] dark:text-[#79C4A8] text-xs font-bold">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2A8069] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#2A8069]"></span>
          </span>
          <span>{onlineUsers.length > 0 ? `${onlineUsers.length} online` : 'Sincronizado'}</span>
        </div>

        {/* Permissions for Admin */}
        {userRole === 'admin' && openPermissions && (
          <button
            type="button"
            onClick={openPermissions}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 border border-amber-200 dark:border-amber-500/25 transition-all active:scale-95 shadow-sm"
            title="Gerenciar Permissões de Usuários"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Permissões</span>
          </button>
        )}

        {/* Notifications */}
        {openNotifications && (
          <button
            type="button"
            onClick={openNotifications}
            className="relative p-2 rounded-xl text-[#5E6D66] hover:text-[#17211D] bg-white dark:bg-white/[0.04] hover:bg-[#F0F4F2] dark:hover:bg-white/[0.08] border border-[#DFE6E2] dark:border-white/10 transition-all active:scale-95 shadow-sm"
            aria-label="Notificações"
          >
            <Bell className="w-4 h-4" />
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-extrabold text-white bg-[#1F6F5B] dark:bg-[#63B596] rounded-full ring-2 ring-white dark:ring-[#101714] animate-pulse">
                {notificationCount > 99 ? '99+' : notificationCount}
              </span>
            )}
          </button>
        )}

        {/* Theme Toggle */}
        {toggleTheme && (
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl text-[#5E6D66] hover:text-[#17211D] bg-white dark:bg-white/[0.04] hover:bg-[#F0F4F2] dark:hover:bg-white/[0.08] border border-[#DFE6E2] dark:border-white/10 transition-all active:scale-95 shadow-sm"
            title={theme === 'dark' ? 'Ativar Modo Claro' : 'Ativar Modo Escuro'}
            aria-label="Alternar Tema"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-[#1F6F5B]" />
            )}
          </button>
        )}
      </div>
    </header>
  );
};
