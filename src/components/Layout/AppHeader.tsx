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
  LayoutDashboard,
  DollarSign,
  Calendar,
  FlaskConical,
  Briefcase,
  Headphones,
  KeyRound,
  CheckSquare,
  BookOpen,
  Menu
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
  [Tab.DASHBOARD]: { 
    label: 'Dashboard Executivo', 
    icon: LayoutDashboard, 
    description: 'Métricas gerais e performance comercial' 
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
    <header className="h-[58px] min-h-[58px] w-full px-4 sm:px-6 flex items-center justify-between border-b border-white/[0.06] bg-[#090D16]/80 light:bg-white/85 backdrop-blur-xl z-20 transition-colors duration-200">
      {/* Left: Mobile trigger & Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMobileMenuToggle}
          className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 border border-white/10"
          aria-label="Abrir Menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shadow-inner">
            <Icon className="w-4 h-4" />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold text-slate-100 light:text-slate-900 tracking-tight">
                {currentTab.label}
              </span>
              {subLabel && (
                <>
                  <ChevronRight className="w-3 h-3 text-slate-500" />
                  <span className="text-sky-400 font-medium">{subLabel}</span>
                </>
              )}
            </div>
            <span className="text-[11px] text-slate-400 light:text-slate-500 hidden sm:inline">
              {currentTab.description}
            </span>
          </div>
        </div>
      </div>

      {/* Right: Online presence, permissions, notifications, theme */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Live Presence Pill */}
        <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>{onlineUsers.length > 0 ? `${onlineUsers.length} online` : 'Sistema Sincronizado'}</span>
        </div>

        {/* Permissions for Admin */}
        {userRole === 'admin' && openPermissions && (
          <button
            type="button"
            onClick={openPermissions}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/25 transition-all active:scale-95"
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
            className="relative p-2 rounded-lg text-slate-300 hover:text-white bg-slate-900/60 hover:bg-slate-800/80 border border-white/10 transition-all active:scale-95"
            aria-label="Notificações"
          >
            <Bell className="w-4 h-4" />
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-sky-500 rounded-full ring-2 ring-[#090D16] animate-pulse">
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
            className="p-2 rounded-lg text-slate-300 hover:text-white bg-slate-900/60 hover:bg-slate-800/80 border border-white/10 transition-all active:scale-95"
            title={theme === 'dark' ? 'Ativar Modo Claro' : 'Ativar Modo Escuro'}
            aria-label="Alternar Tema"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-sky-500" />
            )}
          </button>
        )}
      </div>
    </header>
  );
};
