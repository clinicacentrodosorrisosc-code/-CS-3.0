import React from 'react';
import { Sun, Moon, ShieldCheck, Menu, ExternalLink, CalendarDays } from 'lucide-react';
import { Tab } from '../../types';
import { NotificationBell } from '../ui/notification-bell';
import BorderAvatar from '../ui/avatar-border';

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

const TAB_LABELS: Record<Tab, string> = {
  [Tab.DASHBOARD]: 'Dashboard',
  [Tab.CRM]: 'CRM Comercial',
  [Tab.SETTINGS]: 'Configurações do sistema',
  [Tab.FINANCIAL]: 'Financeiro',
  [Tab.ORTHODONTICS]: 'Ortodontia',
  [Tab.LABWORK]: 'Laboratorio e Protese',
  [Tab.MEETINGS]: 'Gestao e Comercial',
  [Tab.SUPPORT]: 'Chamados e Suporte',
  [Tab.PASSWORDS]: 'Cofre e Governanca',
  [Tab.RESPONSIBILITIES]: 'Processos e SOPs',
  [Tab.BIBLIOTECA]: 'Biblioteca Clinica',
  [Tab.TASKS]: 'Tarefas e Atividades',
};

const CRM_JAMES_URL = String(
  import.meta.env.VITE_CRM_JAMES_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '')
).trim();

export const AppHeader: React.FC<AppHeaderProps> = ({
  activeTab,
  requestedSubTab,
  userRole,
  userEmail,
  onlineUsers = [],
  notificationCount = 0,
  openNotifications,
  theme = 'light',
  toggleTheme,
  openPermissions,
  onMobileMenuToggle,
  isSidebarExpanded = false,
}) => {
  const moduleLabel = TAB_LABELS[activeTab] || 'Centro do Sorriso';
  const subLabel = requestedSubTab
    ? requestedSubTab.replace(/_/g, ' ').replace(/^./, char => char.toUpperCase())
    : null;
  const now = new Date();
  const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(now).replace('.', '');
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const todayLabel = `1 ${monthLabel} - ${monthEnd} ${monthLabel} ${now.getFullYear()}`;

  const openCrmJames = () => {
    if (!CRM_JAMES_URL) {
      window.alert('O ambiente CRM James (beta) ainda não foi configurado para esta instalação.');
      return;
    }

    window.open(CRM_JAMES_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <header className="app-header z-50 flex h-12 min-h-12 w-full items-center justify-between border-b border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] px-3 backdrop-blur-xl sm:px-5 dark:bg-[color-mix(in_srgb,var(--surface)_92%,transparent)]">
      <div className="flex min-w-0 items-center gap-2.5">
        <button type="button" onClick={onMobileMenuToggle} className="grid size-8 place-items-center rounded-md text-[#667085] hover:bg-[#f4f5f7] hover:text-[#172033] dark:text-slate-400 dark:hover:bg-white/[0.05] dark:hover:text-white lg:hidden" aria-label={isSidebarExpanded ? 'Fechar menu' : 'Abrir menu'} aria-expanded={isSidebarExpanded} aria-controls="app-sidebar">
          <Menu className="size-4" />
        </button>

        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold leading-tight tracking-[-0.025em] text-[var(--text)]">
            {activeTab === Tab.DASHBOARD ? 'Bom dia, equipe.' : moduleLabel}
          </span>
          <span className="mt-0.5 hidden truncate text-[9px] text-[var(--text-muted)] sm:block">
            {activeTab === Tab.DASHBOARD
              ? 'Veja o que está acontecendo na clínica hoje.'
              : subLabel || 'Centro do Sorriso'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <div className="header-date hidden h-8 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-[10px] font-semibold text-[var(--text-secondary)] xl:flex">
          <CalendarDays className="size-3.5" />
          <span>{todayLabel}</span>
        </div>
        <button
          type="button"
          onClick={openCrmJames}
          className="mr-1 inline-flex h-8 items-center gap-1.5 rounded-lg border border-[color-mix(in_srgb,var(--primary)_28%,var(--border))] bg-[color-mix(in_srgb,var(--primary)_8%,var(--surface))] px-2.5 text-[11px] font-semibold text-[var(--primary)] transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_14%,var(--surface))] sm:px-3"
          title="Abrir CRM James (beta)"
          aria-label="Abrir CRM James (beta)"
        >
          <span className="hidden sm:inline">CRM James</span>
          <span className="hidden rounded bg-[var(--primary)] px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white lg:inline">Beta</span>
          <ExternalLink className="size-3.5" />
        </button>

        <span className="mr-1 hidden items-center gap-1.5 text-[11px] text-[#667085] lg:flex dark:text-slate-400">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          {onlineUsers.length > 0 ? `${onlineUsers.length} online` : 'Sincronizado'}
        </span>

        {userRole === 'admin' && openPermissions && (
          <button type="button" onClick={openPermissions} className="grid size-8 place-items-center rounded-md text-[#667085] hover:bg-[#f4f5f7] hover:text-[var(--primary)] dark:text-slate-400 dark:hover:bg-white/[0.05]" title="Gerenciar permissões">
            <ShieldCheck className="size-4" />
          </button>
        )}

        {openNotifications && <NotificationBell count={notificationCount} onClick={openNotifications} />}

        {toggleTheme && (
          <button type="button" onClick={toggleTheme} className="grid size-8 place-items-center rounded-md text-[#667085] hover:bg-[#f4f5f7] hover:text-[#172033] dark:text-slate-400 dark:hover:bg-white/[0.05]" title={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}>
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        )}

        <button type="button" className="ml-1 rounded-lg p-1 hover:bg-[var(--surface-hover)]" title={userEmail || 'Perfil'} aria-label={userEmail || 'Perfil'}>
          <BorderAvatar fallback={(userEmail || 'CS').slice(0, 2).toUpperCase()} alt={userEmail ? `Perfil de ${userEmail}` : 'Perfil do usuário'} />
        </button>
      </div>
    </header>
  );
};
