import React, { useState, useEffect, useRef } from 'react';
import { Tab } from '../types';
import { supabase } from '../supabaseClient';
import { motion, AnimatePresence } from 'motion/react';
import {
  Menu,
  X,
  LogOut,
  ChevronRight,
  ChevronDown,
  PanelLeftClose,
  PanelLeft,
  DollarSign,
  Calendar,
  FlaskConical,
  Briefcase,
  Headphones,
  KeyRound,
  CheckSquare,
  BookOpen,
  LayoutDashboard,
  KanbanSquare,
  Settings2,
  ExternalLink,
  ClipboardList,
  Search,
  CalendarPlus,
  FilePlus2,
  CreditCard
} from 'lucide-react';
import { recordAuditEvent } from '../lib/audit';

interface SidebarProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  allowedTabs: string[];
  allowedSubTabs?: string[];
  userRole: string;
  userEmail?: string;
  openPermissions: () => void;
  onSubTabSelect?: (subTabId: string) => void;
  requestedSubTab?: string | null;
  theme?: 'light' | 'dark';
  toggleTheme?: () => void;
  notificationCount?: number;
  openNotifications?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  isMobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

interface MenuItem {
  id: Tab;
  label: string;
  icon: React.ElementType;
  group: 'main' | 'management';
  subItems: Array<{
    id: string;
    label: string;
    adminOnly?: boolean;
    externalUrl?: string;
    permissionId?: string;
  }>;
}

const sidebarContentTransition = {
  duration: 0.16,
  ease: 'easeOut' as const,
};

const CRM_JAMES_URL = String(
  import.meta.env.VITE_CRM_JAMES_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '')
).trim();

const SUB_TAB_PERMISSION_IDS: Record<string, string> = {
  commercial: 'dash_financial',
  agenda: 'dash_agenda',
  pipeline: 'crm_pipeline',
  automations: 'crm_automations',
  campaigns: 'crm_campaigns',
  reactivation: 'crm_reactivation',
  whatsapp: 'crm_whatsapp',
  overview: 'financial_overview',
  transactions: 'financial_transactions',
  pricing: 'financial_pricing',
  viability: 'financial_viability',
  vision: 'ortho_vision',
  grid: 'ortho_grid',
  patients: 'ortho_patients',
  dashboard: 'lab_dashboard',
  kanban: 'lab_kanban',
  campaign_calendar: 'campaign_calendar',
  meeting_minutes: 'meeting_minutes',
  clinic_ideas: 'clinic_ideas',
  sales_playbook: 'sales_playbook',
  [`${Tab.FINANCIAL}:settings`]: 'financial_settings',
  [`${Tab.ORTHODONTICS}:settings`]: 'ortho_settings',
  [`${Tab.LABWORK}:settings`]: 'lab_settings',
};

const MENU_STRUCTURE: MenuItem[] = [
  // PRINCIPAL
  {
    id: Tab.DASHBOARD,
    label: 'Dashboard',
    icon: LayoutDashboard,
    group: 'main',
    subItems: [
      { id: 'geral', label: 'Visao geral' },
      { id: 'commercial', label: 'Comercial' },
      { id: 'agenda', label: 'Agenda' }
    ]
  },
  {
    id: Tab.CRM,
    label: 'CRM',
    icon: KanbanSquare,
    group: 'main',
    subItems: [
      { id: 'pipeline', label: 'Funil comercial' },
      { id: 'automations', label: 'Automações' },
      { id: 'campaigns', label: 'Disparador em massa' },
      { id: 'reactivation', label: 'Reativação de orçamentos' },
      { id: 'whatsapp', label: 'WhatsApp Business' },
      { id: 'crm-james', label: 'CRM James (beta)', externalUrl: CRM_JAMES_URL }
    ]
  },
  {
    id: Tab.SETTINGS,
    label: 'Configurações',
    icon: Settings2,
    group: 'management',
    subItems: []
  },
  {
    id: Tab.AUDIT,
    label: 'Auditoria',
    icon: ClipboardList,
    group: 'management',
    subItems: []
  },
  {
    id: Tab.FINANCIAL,
    label: 'Financeiro',
    icon: DollarSign,
    group: 'main',
    subItems: [
      { id: 'overview', label: 'Visão Geral' },
      { id: 'transactions', label: 'Lançamentos' },
      { id: 'pricing', label: 'Precificação' },
      { id: 'viability', label: 'Viabilidade & Comissões', adminOnly: true },
      { id: 'settings', label: 'Configurações' }
    ]
  },
  {
    id: Tab.ORTHODONTICS,
    label: 'Ortodontia',
    icon: Calendar,
    group: 'main',
    subItems: [
      { id: 'vision', label: 'Visão Geral' },
      { id: 'grid', label: 'Grade Presença' },
      { id: 'patients', label: 'Pacientes' },
      { id: 'settings', label: 'Configurações' }
    ]
  },
  {
    id: Tab.LABWORK,
    label: 'Laboratório',
    icon: FlaskConical,
    group: 'main',
    subItems: [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'kanban', label: 'Kanban' },
      { id: 'settings', label: 'Tabela Preços' }
    ]
  },

  // GESTÃO & APOIO
  {
    id: Tab.TASKS,
    label: 'Trabalhos e Tarefas',
    icon: CheckSquare,
    group: 'management',
    subItems: [
      { id: 'tasks', label: 'Quadro de tarefas' },
      { id: 'reports', label: 'Visao de progresso' }
    ]
  },
  {
    id: Tab.MEETINGS,
    label: 'Gestão & Comercial',
    icon: Briefcase,
    group: 'management',
    subItems: [
      { id: 'campaign_calendar', label: 'Calendário de Campanhas' },
      { id: 'meeting_minutes', label: 'Atas de Reuniões' },
      { id: 'clinic_ideas', label: 'Ideias & Melhorias' },
      { id: 'sales_playbook', label: 'Playbook & Scripts' }
    ]
  },
  {
    id: Tab.SUPPORT,
    label: 'Chamados',
    icon: Headphones,
    group: 'management',
    subItems: []
  },
  {
    id: Tab.PASSWORDS,
    label: 'Cofre & Senhas',
    icon: KeyRound,
    group: 'management',
    subItems: [
      { id: 'docs', label: 'Docs & Diretrizes' },
      { id: 'passwords', label: 'Senhas & Acessos' },
      { id: 'banking', label: 'Dados Bancários' },
      { id: 'projects', label: 'Metas da Gestão' }
    ]
  },
  {
    id: Tab.RESPONSIBILITIES,
    label: 'Processos',
    icon: CheckSquare,
    group: 'management',
    subItems: [
      { id: 'processes', label: 'Processos' },
      { id: 'responsibilities', label: 'Responsabilidades' },
      { id: 'instructions', label: 'Instruções de Trabalho' }
    ]
  },
  {
    id: Tab.BIBLIOTECA,
    label: 'Biblioteca',
    icon: BookOpen,
    group: 'management',
    subItems: []
  }
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  allowedTabs,
  allowedSubTabs = [],
  userRole,
  userEmail,
  requestedSubTab,
  onSubTabSelect,
  isExpanded: externalIsExpanded,
  onToggleExpand: externalOnToggleExpand,
  isMobileOpen: externalIsMobileOpen,
  onMobileOpenChange
}) => {
  const [internalIsExpanded, setInternalIsExpanded] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('sidebar_expanded');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  const isExpanded = externalIsExpanded !== undefined ? externalIsExpanded : internalIsExpanded;

  const toggleExpanded = () => {
    if (externalOnToggleExpand) {
      externalOnToggleExpand();
    } else {
      setInternalIsExpanded(prev => {
        const next = !prev;
        try {
          localStorage.setItem('sidebar_expanded', String(next));
        } catch (e) {
          console.warn("Could not save sidebar state:", e);
        }
        return next;
      });
    }
  };

  const [internalIsMobileOpen, setInternalIsMobileOpen] = useState(false);
  const isMobileMenuOpen = externalIsMobileOpen ?? internalIsMobileOpen;
  const setIsMobileMenuOpen = (open: boolean) => {
    if (onMobileOpenChange) onMobileOpenChange(open);
    else setInternalIsMobileOpen(open);
  };

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMobileMenuOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isMobileMenuOpen, onMobileOpenChange]);
  const [navQuery, setNavQuery] = useState('');
  const [openAccordionTab, setOpenAccordionTab] = useState<Tab | null>(activeTab);
  const [flyoutTab, setFlyoutTab] = useState<Tab | null>(null);
  const [flyoutPosition, setFlyoutPosition] = useState({ top: 16, left: 76 });
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Keep accordion tab synced with active tab
  useEffect(() => {
    if (activeTab) {
      setOpenAccordionTab(activeTab);
    }
  }, [activeTab]);

  const handleLogout = async () => {
    await recordAuditEvent('LOGOUT', 'Autenticação', 'Encerrou a sessão no sistema');
    await supabase.auth.signOut();
  };

  const MASTER_EMAIL = 'clinica.centrodosorrisosc@gmail.com';

  const handleTabClick = (tabId: Tab, hasSubItems: boolean) => {
    setActiveTab(tabId);
    if (tabId === Tab.CRM && hasSubItems && onSubTabSelect) {
      onSubTabSelect('pipeline');
    }
    if (isExpanded) {
      if (openAccordionTab === tabId) {
        // Toggle accordion if already active
        setOpenAccordionTab(null);
      } else {
        setOpenAccordionTab(tabId);
      }
    } else {
      if (!hasSubItems) {
        setFlyoutTab(null);
      }
    }
    if (!hasSubItems) {
      setIsMobileMenuOpen(false);
    }
  };

  const showFlyout = (tabId: Tab, target: HTMLElement) => {
    if (isExpanded) return;
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    const { top, left, right } = target.getBoundingClientRect();
    const isRtl = document.documentElement.dir === 'rtl';
    const flyoutWidth = 208;
    setFlyoutPosition({
      top,
      left: isRtl ? Math.max(8, left - flyoutWidth - 8) : right + 8,
    });
    setFlyoutTab(tabId);
  };

  const handleSubItemClick = (
    tabId: Tab,
    subItem: MenuItem['subItems'][number],
  ) => {
    if (subItem.externalUrl !== undefined) {
      if (!subItem.externalUrl) {
        window.alert('O ambiente CRM James (beta) ainda não foi configurado para esta instalação.');
        return;
      }

      window.open(subItem.externalUrl, '_blank', 'noopener,noreferrer');
      setIsMobileMenuOpen(false);
      setFlyoutTab(null);
      return;
    }

    setActiveTab(tabId);
    if (onSubTabSelect) onSubTabSelect(subItem.id);
    setIsMobileMenuOpen(false);
    setFlyoutTab(null);
  };

  const hideFlyout = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setFlyoutTab(null);
    }, 250);
  };

  const keepFlyout = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  const normalizedQuery = navQuery.trim().toLocaleLowerCase('pt-BR');
  const filteredNavItems = MENU_STRUCTURE.filter(item => {
    const hasAccess = item.id === Tab.AUDIT
      ? userRole === 'admin'
      : Array.isArray(allowedTabs) && allowedTabs.includes(item.id);
    const matchesQuery = !normalizedQuery
      || item.label.toLocaleLowerCase('pt-BR').includes(normalizedQuery)
      || item.subItems.some(subItem => subItem.label.toLocaleLowerCase('pt-BR').includes(normalizedQuery));
    return hasAccess && matchesQuery;
  });

  const mainItems = filteredNavItems.filter(item => item.group === 'main');
  const managementItems = filteredNavItems.filter(item => item.group === 'management');
  const canAccessSubItem = (tabId: Tab, subItem: MenuItem['subItems'][number]) => {
    const permissionId = subItem.permissionId || SUB_TAB_PERMISSION_IDS[`${tabId}:${subItem.id}`] || SUB_TAB_PERMISSION_IDS[subItem.id];
    return (!subItem.adminOnly || userRole === 'admin')
      && (userRole === 'admin' || !permissionId || allowedSubTabs.length === 0 || allowedSubTabs.includes(permissionId));
  };

  const renderNavGroup = (items: MenuItem[], groupTitle?: string) => (
    <div className="flex flex-col gap-1 w-full">
      {groupTitle && isExpanded && (
        <span className="px-3 py-1.5 mt-2 select-none text-[10px] font-semibold text-[var(--text-muted)] tracking-normal">
          {groupTitle}
        </span>
      )}
      {items.map((item) => {
        const isActive = activeTab === item.id;
        const isAccordionOpen = isExpanded && openAccordionTab === item.id;
        const IconComponent = item.icon;
        const validSubItems = item.subItems.filter(subItem => canAccessSubItem(item.id, subItem));
        const hasSubItems = validSubItems.length > 0;

        return (
          <div
            key={item.id}
            className="flex flex-col relative w-full"
            onMouseEnter={(event) => showFlyout(item.id, event.currentTarget)}
            onMouseLeave={hideFlyout}
            onFocus={(event) => showFlyout(item.id, event.currentTarget)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setFlyoutTab(null);
                (event.currentTarget.querySelector('button') as HTMLButtonElement | null)?.focus();
              }
            }}
          >
            <button
              type="button"
              onClick={(event) => {
                handleTabClick(item.id, hasSubItems);
                if (!isExpanded && hasSubItems) showFlyout(item.id, event.currentTarget);
              }}
              aria-expanded={hasSubItems ? isAccordionOpen : undefined}
              aria-haspopup={hasSubItems ? 'menu' : undefined}
              aria-label={!isExpanded ? item.label : undefined}
              data-tooltip={!isExpanded ? item.label : undefined}
              className={`
                sidebar-nav-item group relative flex items-center min-h-9 py-0.5 rounded-lg transition duration-150 w-full text-start
                ${isExpanded ? 'justify-between px-2.5' : 'justify-center px-0'}
                ${isActive
                  ? 'sidebar-nav-item-active font-semibold'
                  : 'text-[#667085] hover:text-[#172033] hover:bg-white/70 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-white/[0.04] font-medium'}
              `}
              title={!isExpanded ? item.label : undefined}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`
                  w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition duration-200
                  ${isActive
                    ? 'sidebar-nav-icon-active'
                    : 'text-[#667085] group-hover:text-[#172033] dark:text-slate-400 dark:group-hover:text-slate-200'}
                `}>
                  <IconComponent className="w-4 h-4" />
                </div>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.span
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -6 }}
                      transition={sidebarContentTransition}
                      className="text-xs tracking-tight truncate font-semibold"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>

              <AnimatePresence initial={false}>
                {isExpanded && hasSubItems && (
                  <motion.div
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -4 }}
                    transition={sidebarContentTransition}
                  >
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isAccordionOpen ? 'rotate-180 text-[#8b3dff]' : ''}`}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="hidden"
                />
              )}
            </button>

            {/* Accordion Sub-items for Expanded Mode */}
            {isExpanded && isAccordionOpen && hasSubItems && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="sidebar-submenu ps-8 pe-2 py-1 flex flex-col gap-0.5 relative before:absolute before:start-5 before:top-2 before:bottom-2 before:w-px before:bg-[#E2E5EA] dark:before:bg-white/10"
              >
                {validSubItems.map(subItem => (
                  <button
                    key={subItem.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSubItemClick(item.id, subItem);
                    }}
                    className={`
                      w-full text-start py-1.5 px-2.5 text-[11px] rounded-lg transition flex items-center justify-between
                      ${requestedSubTab === subItem.id
                  ? 'text-[var(--primary)] dark:text-[var(--primary-hover)] font-bold bg-[var(--primary-dim)] dark:bg-[var(--primary-dim)]'
                        : 'text-[#667085] hover:text-[#172033] hover:bg-[#F5F6F8] dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-white/[0.03]'}
                    `}
                  >
                    <span>{subItem.label}</span>
                    {subItem.externalUrl !== undefined
                      ? <ExternalLink className="h-3 w-3 text-slate-400" />
                      : <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 text-slate-400" />}
                  </button>
                ))}
              </motion.div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Sidebar Shell */}
      <motion.aside
        id="app-sidebar"
        data-sidebar-expanded={isExpanded}
        initial={false}
        animate={{
          width: isExpanded ? 244 : 60
        }}
        transition={{
          type: 'spring',
          stiffness: 280,
          damping: 28,
          mass: 0.5
        }}
        className={`
          flex flex-col shrink-0 h-full fixed lg:sticky top-0 z-40 lg:my-0 lg:me-0 lg:h-full lg:rounded-none
          sidebar-shell bg-[var(--surface)] border-e border-[var(--border-subtle)]
          transition-colors duration-200
          ${isMobileMenuOpen ? 'sidebar-mobile-open shadow-2xl z-50' : 'sidebar-mobile-closed'}
        `}
      >
        {/* Top Branding & Expand/Collapse Trigger */}
        <div className="sidebar-brand h-[62px] px-3 flex items-center justify-between border-b border-[#e8eaee] dark:border-white/[0.06] select-none">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="brand-mark w-9 h-9 rounded-xl bg-[var(--primary)] flex items-center justify-center font-black text-white text-xs shrink-0">
              CS
            </div>

            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={sidebarContentTransition}
                  className="flex flex-col min-w-0"
                >
                  <span className="text-xs font-bold text-[#172033] dark:text-slate-100 tracking-tight truncate leading-tight">
                    Centro do Sorriso
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] font-medium tracking-wide">
                    Gestão Clínica
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Desktop Toggle Button */}
          <button
            type="button"
            onClick={toggleExpanded}
            className="hidden lg:flex p-1.5 rounded-lg text-[#667085] hover:text-[#172033] hover:bg-[#F5F6F8] dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-white/[0.06] border border-transparent transition"
            title={isExpanded ? "Recolher menu lateral" : "Expandir menu lateral"}
            aria-label={isExpanded ? "Recolher menu lateral" : "Expandir menu lateral"}
            aria-pressed={!isExpanded}
          >
            {isExpanded ? (
              <PanelLeftClose className="w-4 h-4" />
            ) : (
              <PanelLeft className="w-4 h-4" />
            )}
          </button>

          {/* Mobile Menu Close */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 dark:bg-white/[0.04]"
            aria-label={isMobileMenuOpen ? 'Fechar menu lateral' : 'Abrir menu lateral'}
            title={isMobileMenuOpen ? 'Fechar menu lateral' : 'Abrir menu lateral'}
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {isExpanded && (
          <div className="sidebar-search px-3 pt-3">
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="search"
                value={navQuery}
                onChange={event => setNavQuery(event.target.value)}
                placeholder="Buscar"
                className="h-9 w-full rounded-lg border border-[var(--border)] bg-white ps-9 pe-11 text-[11px] text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
                aria-label="Buscar no menu"
              />
              <span className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 rounded border border-[var(--border-subtle)] bg-[#f4f5f7] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--text-muted)]">Ctrl K</span>
            </div>
          </div>
        )}

        {/* Scrollable Navigation Area */}
        <div className={`
          flex-1 flex flex-col overflow-y-auto px-1 py-2 gap-2 custom-scrollbar
          ${isMobileMenuOpen ? 'opacity-100 max-h-screen' : 'opacity-0 max-h-0 lg:opacity-100 lg:max-h-full'}
        `}>
          {renderNavGroup(mainItems, 'Menu principal')}
          {renderNavGroup(managementItems)}

          {isExpanded && !normalizedQuery && (
            <div className="sidebar-shortcuts mt-2 border-t border-[var(--border-subtle)] pt-3">
              <span className="px-3 text-[10px] font-semibold text-[var(--text-muted)]">Atalhos fixos</span>
              <div className="mt-2 flex flex-col gap-1">
                {[
                  { label: 'Agendar paciente', icon: CalendarPlus, tab: Tab.DASHBOARD, subTab: 'agenda', tone: 'blue' },
                  { label: 'Novo orçamento', icon: FilePlus2, tab: Tab.CRM, subTab: 'pipeline', tone: 'green' },
                  { label: 'Registrar pagamento', icon: CreditCard, tab: Tab.FINANCIAL, subTab: 'transactions', tone: 'yellow' },
                  { label: 'Solicitar laboratório', icon: FlaskConical, tab: Tab.LABWORK, subTab: 'kanban', tone: 'purple' }
                ].filter(shortcut => allowedTabs.includes(shortcut.tab)
                  && canAccessSubItem(shortcut.tab, { id: shortcut.subTab, label: shortcut.label }))
                  .map(shortcut => {
                  const ShortcutIcon = shortcut.icon;
                  return (
                    <button
                      key={shortcut.label}
                      type="button"
                      onClick={() => {
                        setActiveTab(shortcut.tab);
                        onSubTabSelect?.(shortcut.subTab);
                      }}
                      className="sidebar-shortcut flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2 text-start text-[11px] font-medium text-[var(--text-secondary)] hover:bg-white hover:text-[var(--text)]"
                    >
                      <span className={`shortcut-icon shortcut-icon-${shortcut.tone}`}><ShortcutIcon className="size-3.5" /></span>
                      <span className="min-w-0 flex-1 truncate">{shortcut.label}</span>
                      <ChevronRight className="size-3 text-[var(--text-muted)]" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        <div className="flex flex-col gap-1 border-t border-[var(--border-subtle)] bg-[var(--surface)] p-2">
          <div className={`flex min-h-10 items-center gap-2.5 rounded-lg ${!isExpanded ? 'justify-center' : 'justify-between'}`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--primary)] text-[11px] font-bold text-white">
                {userRole.slice(0, 2).toUpperCase()}
              </div>

              {isExpanded && (
                <div className="flex flex-col min-w-0">
                  <span className="truncate text-xs font-semibold leading-tight text-[var(--text)]">
                    {userEmail || 'Usuário da clínica'}
                  </span>
                  <span className="truncate text-xs text-[var(--text-muted)]">
                    {userRole === 'admin' ? 'Administrador' : userRole === 'reception' ? 'Recepção' : userRole}
                  </span>
                </div>
              )}
            </div>

            {isExpanded && (
              <button
                type="button"
                onClick={handleLogout}
                className="grid size-9 place-items-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--danger-bg)] hover:text-[var(--danger-text)]"
                title="Sair da conta"
                aria-label="Sair da conta"
              >
                <LogOut className="size-4" />
              </button>
            )}
          </div>
        </div>
      </motion.aside>

      {/* Flyout Submenu for Collapsed Mode (Desktop) */}
      <AnimatePresence>
        {!isExpanded && flyoutTab && (
          <motion.div
            initial={{ opacity: 0, x: -10, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -10, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            onMouseEnter={keepFlyout}
            onMouseLeave={hideFlyout}
            style={{ top: flyoutPosition.top, left: flyoutPosition.left }}
            className="sidebar-context-submenu fixed w-52 rounded-xl bg-[var(--surface)] border border-[#E2E5EA] dark:border-white/10 shadow-xl shadow-slate-900/10 dark:shadow-black/30 p-1.5 z-50 hidden lg:flex flex-col gap-1"
          >
            {(() => {
              const currentItem = MENU_STRUCTURE.find(m => m.id === flyoutTab);
              if (!currentItem) return null;
              const validSubs = currentItem.subItems.filter(subItem => canAccessSubItem(currentItem.id, subItem));

              return (
                <>
                  <div className="px-2 py-1.5 border-b border-[#E2E5EA] dark:border-white/[0.06] flex items-center justify-between">
                    <span className="text-xs font-bold text-[#172033] dark:text-slate-100">
                      {currentItem.label}
                    </span>
                  </div>

                  {validSubs.length > 0 ? (
                    <div className="flex flex-col gap-0.5 mt-1">
                      {validSubs.map(sub => (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => {
                            handleSubItemClick(currentItem.id, sub);
                          }}
                          className={`
                            text-start px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between
                            ${requestedSubTab === sub.id
                            ? 'text-[var(--primary)] bg-[var(--primary-dim)] font-bold'
                              : 'text-[#667085] hover:text-[#172033] hover:bg-[#F5F6F8] dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-white/[0.04]'}
                          `}
                        >
                          <span>{sub.label}</span>
                          {sub.externalUrl !== undefined
                            ? <ExternalLink className="h-3 w-3 text-slate-400" />
                            : <ChevronRight className="w-3 h-3 text-slate-400" />}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab(currentItem.id);
                        setFlyoutTab(null);
                      }}
                      className="text-start px-2.5 py-1.5 rounded-lg text-xs text-[var(--primary)] hover:bg-[#F5F6F8] dark:hover:bg-white/[0.04]"
                    >
                      Acessar módulo
                    </button>
                  )}
                </>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

    </>
  );
};
