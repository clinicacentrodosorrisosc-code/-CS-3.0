import React from 'react';
import { Sun, Moon, ShieldCheck, ChevronRight, Menu, ExternalLink } from 'lucide-react';
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
}) => {
  const moduleLabel = TAB_LABELS[activeTab] || 'Centro do Sorriso';
  const subLabel = requestedSubTab
    ? requestedSubTab.replace(/_/g, ' ').replace(/^./, char => char.toUpperCase())
    : null;

  const openCrmJames = () => {
    if (!CRM_JAMES_URL) {
      window.alert('O ambiente CRM James (beta) ainda não foi configurado para esta instalação.');
      return;
    }

    window.open(CRM_JAMES_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <header className="z-50 flex h-12 min-h-12 w-full items-center justify-between border-b border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] px-3 backdrop-blur-xl sm:px-4 dark:bg-[color-mix(in_srgb,var(--surface)_92%,transparent)]">
      <div className="flex min-w-0 items-center gap-2.5">
        <button type="button" onClick={onMobileMenuToggle} className="grid size-8 place-items-center rounded-md text-[#667085] hover:bg-[#f4f5f7] hover:text-[#172033] dark:text-slate-400 dark:hover:bg-white/[0.05] dark:hover:text-white" aria-label="Abrir menu">
          <Menu className="size-4" />
        </button>

        <div className="flex shrink-0 items-center gap-2">
          <div className="grid size-7 place-items-center rounded-lg bg-[var(--primary)] text-[9px] font-bold text-white shadow-[0_3px_10px_rgba(0,122,255,0.22)]">CS</div>
          <span className="hidden text-sm font-semibold tracking-[-0.025em] text-[var(--text)] sm:inline">Centro do Sorriso</span>
        </div>

        <div className="hidden h-4 w-px bg-[var(--border)] md:block" />
        <div className="hidden min-w-0 items-center gap-1.5 text-xs md:flex">
          <span className="truncate font-semibold text-[var(--primary)]">{moduleLabel}</span>
          {subLabel && <><ChevronRight className="size-3 text-[#b0b6c0]" /><span className="truncate text-[#667085] dark:text-slate-300">{subLabel}</span></>}
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
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
