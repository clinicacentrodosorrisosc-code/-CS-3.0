import React, { useState, useEffect, useRef } from 'react';
import { Tab } from '../types';
import { supabase } from '../supabaseClient';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Menu,
  X,
  LogOut,
  Sun,
  Moon,
  Bell,
  ChevronRight,
  ChevronDown,
  Users,
  Settings,
  Star,
  Edit2,
  Check,
  PanelLeftClose,
  PanelLeft,
  LayoutDashboard,
  DollarSign,
  Calendar,
  FlaskConical,
  Briefcase,
  Headphones,
  KeyRound,
  CheckSquare,
  BookOpen,
  Sparkles,
  ShieldCheck
} from 'lucide-react';

interface SidebarProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  allowedTabs: string[];
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
  }>;
}

const MENU_STRUCTURE: MenuItem[] = [
  // PRINCIPAL
  {
    id: Tab.DASHBOARD,
    label: 'Dashboard',
    icon: LayoutDashboard,
    group: 'main',
    subItems: [
      { id: 'geral', label: 'Visão Geral' },
      { id: 'commercial', label: 'Comercial' }
    ]
  },
  {
    id: Tab.FINANCIAL,
    label: 'Financeiro',
    icon: DollarSign,
    group: 'main',
    subItems: [
      { id: 'overview', label: 'Visão Geral' },
      { id: 'transactions', label: 'Receitas' },
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
  userRole,
  userEmail,
  openPermissions,
  requestedSubTab,
  theme = 'dark',
  toggleTheme,
  notificationCount = 0,
  openNotifications,
  onSubTabSelect,
  isExpanded: externalIsExpanded,
  onToggleExpand: externalOnToggleExpand
}) => {
  const [internalIsExpanded, setInternalIsExpanded] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('sidebar_expanded');
      return saved !== null ? saved === 'true' : true;
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

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openAccordionTab, setOpenAccordionTab] = useState<Tab | null>(activeTab);
  const [flyoutTab, setFlyoutTab] = useState<Tab | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Profile Card Modal States
  const [isProfileCardOpen, setIsProfileCardOpen] = useState(false);
  const [profileName, setProfileName] = useState(() => localStorage.getItem('profileName') || 'Dr. Alexander Ross');
  const [profileRole, setProfileRole] = useState(() => localStorage.getItem('profileRole') || 'Dentista Administrador');
  const [profileRating, setProfileRating] = useState(() => localStorage.getItem('profileRating') || '4.9');
  const [profilePatients, setProfilePatients] = useState(() => localStorage.getItem('profilePatients') || '2.4k+');
  const [profileScore, setProfileScore] = useState(() => localStorage.getItem('profileScore') || '98%');
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  useEffect(() => {
    localStorage.setItem('profileName', profileName);
  }, [profileName]);

  useEffect(() => {
    localStorage.setItem('profileRole', profileRole);
  }, [profileRole]);

  useEffect(() => {
    localStorage.setItem('profileRating', profileRating);
  }, [profileRating]);

  useEffect(() => {
    localStorage.setItem('profilePatients', profilePatients);
  }, [profilePatients]);

  useEffect(() => {
    localStorage.setItem('profileScore', profileScore);
  }, [profileScore]);

  // Keep accordion tab synced with active tab
  useEffect(() => {
    if (activeTab) {
      setOpenAccordionTab(activeTab);
    }
  }, [activeTab]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const MASTER_EMAIL = 'clinica.centrodosorrisosc@gmail.com';

  const handleTabClick = (tabId: Tab, hasSubItems: boolean) => {
    setActiveTab(tabId);
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

  const showFlyout = (tabId: Tab) => {
    if (isExpanded) return;
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setFlyoutTab(tabId);
  };

  const hideFlyout = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setFlyoutTab(null);
    }, 150);
  };

  const keepFlyout = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  const filteredNavItems = MENU_STRUCTURE.filter(item => 
    Array.isArray(allowedTabs) && (allowedTabs.length === 0 || allowedTabs.includes(item.id))
  );

  const mainItems = filteredNavItems.filter(item => item.group === 'main');
  const managementItems = filteredNavItems.filter(item => item.group === 'management');

  const renderNavGroup = (items: MenuItem[], groupTitle?: string) => (
    <div className="flex flex-col gap-1 w-full">
      {groupTitle && isExpanded && (
        <span className="text-[10px] font-extrabold text-[#94A3B8] dark:text-slate-500 uppercase tracking-widest px-3 py-1.5 mt-2 select-none">
          {groupTitle}
        </span>
      )}
      {items.map((item) => {
        const isActive = activeTab === item.id;
        const isAccordionOpen = isExpanded && openAccordionTab === item.id;
        const IconComponent = item.icon;
        const validSubItems = item.subItems.filter(sub => !sub.adminOnly || userRole === 'admin');
        const hasSubItems = validSubItems.length > 0;

        return (
          <div 
            key={item.id}
            className="flex flex-col relative w-full"
            onMouseEnter={() => showFlyout(item.id)}
            onMouseLeave={hideFlyout}
          >
            <button
              type="button"
              onClick={() => handleTabClick(item.id, hasSubItems)}
              className={`
                group relative flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-150 w-full text-left
                ${isActive 
                  ? 'bg-[#5347CE]/10 text-[#5347CE] dark:bg-[#887CFD]/15 dark:text-[#887CFD] border border-[#5347CE]/20 dark:border-[#887CFD]/30 shadow-sm font-bold' 
                  : 'text-[#64748B] hover:text-[#181B26] hover:bg-[#F4F6FB] dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-white/[0.04] border border-transparent font-medium'}
              `}
              title={!isExpanded ? item.label : undefined}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`
                  w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200
                  ${isActive 
                    ? 'bg-[#5347CE]/15 text-[#5347CE] dark:bg-[#887CFD]/20 dark:text-[#887CFD] shadow-inner' 
                    : 'text-[#64748B] group-hover:text-[#181B26] dark:text-slate-400 dark:group-hover:text-slate-200 group-hover:bg-white/40 dark:group-hover:bg-white/[0.04]'}
                `}>
                  <IconComponent className="w-4 h-4" />
                </div>

                {isExpanded && (
                  <span className="text-xs tracking-tight truncate font-semibold">
                    {item.label}
                  </span>
                )}
              </div>

              {isExpanded && hasSubItems && (
                <ChevronDown 
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isAccordionOpen ? 'rotate-180 text-[#5347CE] dark:text-[#887CFD]' : ''}`} 
                />
              )}

              {isActive && (
                <motion.div 
                  layoutId="activeTabIndicator" 
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-[#5347CE] dark:bg-[#887CFD]"
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
                className="pl-8 pr-2 py-1 flex flex-col gap-0.5 relative before:absolute before:left-5 before:top-2 before:bottom-2 before:w-px before:bg-[#EAEFF6] dark:before:bg-white/10"
              >
                {validSubItems.map(subItem => (
                  <button
                    key={subItem.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTab(item.id);
                      if (onSubTabSelect) onSubTabSelect(subItem.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`
                      w-full text-left py-1.5 px-2.5 text-[11px] rounded-lg transition-all flex items-center justify-between
                      ${requestedSubTab === subItem.id 
                        ? 'text-[#5347CE] dark:text-[#887CFD] font-bold bg-[#5347CE]/10 dark:bg-[#887CFD]/10' 
                        : 'text-[#64748B] hover:text-[#181B26] hover:bg-[#F4F6FB] dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-white/[0.03]'}
                    `}
                  >
                    <span>{subItem.label}</span>
                    <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 text-slate-400" />
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
        initial={false}
        animate={{ 
          width: isExpanded ? 260 : 72
        }}
        transition={{
          type: 'spring',
          stiffness: 280,
          damping: 28,
          mass: 0.5
        }}
        className={`
          flex flex-col shrink-0 lg:h-screen fixed lg:sticky top-0 z-40
          bg-white dark:bg-[#0F1420] border-b lg:border-b-0 lg:border-r border-[#EAEFF6] dark:border-white/[0.08]
          transition-colors duration-200
          ${isMobileMenuOpen ? 'h-[92vh] w-full rounded-b-3xl shadow-2xl z-50' : 'h-auto'}
        `}
      >
        {/* Top Branding & Expand/Collapse Trigger */}
        <div className="h-[60px] px-3.5 flex items-center justify-between border-b border-[#EAEFF6] dark:border-white/[0.06] select-none">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#5347CE] via-[#887CFD] to-[#16C8C7] p-[1px] shadow-md shadow-[#5347CE]/20 shrink-0">
              <div className="w-full h-full bg-white dark:bg-[#0B0F17] rounded-[11px] flex items-center justify-center font-black text-[#5347CE] dark:text-[#887CFD] text-sm">
                CS
              </div>
            </div>

            {isExpanded && (
              <motion.div 
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                className="flex flex-col min-w-0"
              >
                <span className="text-xs font-bold text-[#181B26] dark:text-slate-100 tracking-tight truncate leading-tight">
                  Centro do Sorriso
                </span>
                <span className="text-[10px] text-[#5347CE] dark:text-[#887CFD] font-bold tracking-wide">
                  Nexus Odonto Pro
                </span>
              </motion.div>
            )}
          </div>

          {/* Desktop Toggle Button */}
          <button
            type="button"
            onClick={toggleExpanded}
            className="hidden lg:flex p-1.5 rounded-lg text-[#64748B] hover:text-[#181B26] hover:bg-[#F4F6FB] dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-white/[0.06] border border-transparent transition-all"
            title={isExpanded ? "Recolher Menu" : "Expandir Menu"}
            aria-label="Alternar Menu Lateral"
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
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Scrollable Navigation Area */}
        <div className={`
          flex-1 flex flex-col overflow-y-auto px-2 py-3 gap-3 custom-scrollbar
          ${isMobileMenuOpen ? 'opacity-100 max-h-screen' : 'opacity-0 max-h-0 lg:opacity-100 lg:max-h-full'}
        `}>
          {renderNavGroup(mainItems, 'Principal')}
          {renderNavGroup(managementItems, 'Gestão & Apoio')}
        </div>

        {/* User Profile & Footer Section */}
        <div className="p-2 border-t border-[#EAEFF6] dark:border-white/[0.06] flex flex-col gap-1.5 bg-[#F8F9FD]/60 dark:bg-[#070A11]/60">
          <div 
            onClick={() => setIsProfileCardOpen(true)}
            className={`
              flex items-center gap-2.5 p-2 rounded-xl bg-white dark:bg-white/[0.03] hover:bg-[#F0EFFE] dark:hover:bg-white/[0.06] border border-[#EAEFF6] dark:border-white/[0.06] transition-all cursor-pointer group shadow-sm
              ${!isExpanded ? 'justify-center p-2' : 'justify-between'}
            `}
            title="Abrir Perfil"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#5347CE] to-[#887CFD] flex items-center justify-center text-white font-black text-xs shrink-0 shadow-sm">
                {userRole.slice(0, 2).toUpperCase()}
              </div>

              {isExpanded && (
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] font-bold text-[#181B26] dark:text-slate-100 truncate leading-tight">
                    {profileName}
                  </span>
                  <span className="text-[9px] text-[#64748B] dark:text-slate-400 truncate">
                    {userRole === 'admin' ? 'Administrador' : userRole === 'reception' ? 'Recepção' : userRole}
                  </span>
                </div>
              )}
            </div>

            {isExpanded && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleLogout();
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                title="Sair da Conta"
              >
                <LogOut className="w-3.5 h-3.5" />
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
            className="fixed left-[76px] top-16 w-56 rounded-2xl bg-white dark:bg-[#0F1420] border border-[#EAEFF6] dark:border-white/10 shadow-2xl p-3 z-50 hidden lg:flex flex-col gap-1"
          >
            {(() => {
              const currentItem = MENU_STRUCTURE.find(m => m.id === flyoutTab);
              if (!currentItem) return null;
              const validSubs = currentItem.subItems.filter(s => !s.adminOnly || userRole === 'admin');

              return (
                <>
                  <div className="px-2 py-1.5 border-b border-[#EAEFF6] dark:border-white/[0.06] flex items-center justify-between">
                    <span className="text-xs font-bold text-[#181B26] dark:text-slate-100">
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
                            setActiveTab(currentItem.id);
                            if (onSubTabSelect) onSubTabSelect(sub.id);
                            setFlyoutTab(null);
                          }}
                          className={`
                            text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between
                            ${requestedSubTab === sub.id 
                              ? 'text-[#5347CE] dark:text-[#887CFD] bg-[#5347CE]/10 dark:bg-[#887CFD]/10 font-bold' 
                              : 'text-[#64748B] hover:text-[#181B26] hover:bg-[#F4F6FB] dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-white/[0.04]'}
                          `}
                        >
                          <span>{sub.label}</span>
                          <ChevronRight className="w-3 h-3 text-slate-400" />
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
                      className="text-left px-2.5 py-1.5 rounded-lg text-xs text-[#5347CE] dark:text-[#887CFD] hover:bg-[#F4F6FB] dark:hover:bg-white/[0.04]"
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

      {/* Profile Details Modal */}
      <AnimatePresence>
        {isProfileCardOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-xl cursor-pointer"
              onClick={() => {
                setIsProfileCardOpen(false);
                setIsEditingProfile(false);
              }}
            />

            <motion.div
              initial={{ scale: 0.92, y: 16, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.92, y: 16, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 240 }}
              className={`
                relative w-full max-w-[380px] rounded-3xl overflow-hidden shadow-2xl border z-10
                ${theme === 'dark' 
                  ? 'bg-slate-950/80 border-white/10 text-white shadow-black/80' 
                  : 'bg-white/95 border-slate-200/80 text-slate-900 shadow-slate-300/50'
                }
              `}
            >
              {/* Cover Banner */}
              <div className="relative h-[130px] w-full overflow-hidden bg-gradient-to-r from-sky-600 to-indigo-800">
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                
                <button 
                  type="button"
                  onClick={() => setIsEditingProfile(!isEditingProfile)}
                  className="absolute top-3 right-3 size-9 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-black/60 transition-all text-white"
                  title="Editar Perfil"
                >
                  {isEditingProfile ? <Check className="w-4 h-4 text-emerald-400" /> : <Edit2 className="w-4 h-4 text-slate-200" />}
                </button>
              </div>

              {/* Card Body */}
              <div className="relative pt-12 px-6 pb-6">
                {/* Overlapping Avatar */}
                <div className="absolute -top-10 left-6">
                  <div className={`
                    size-20 rounded-2xl border-4 overflow-hidden shadow-xl relative bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-2xl font-black text-white
                    ${theme === 'dark' ? 'border-slate-950' : 'border-white'}
                  `}>
                    {userRole.slice(0, 2).toUpperCase()}
                  </div>
                </div>

                {/* Name & Role */}
                <div className="flex items-start justify-between gap-4 mt-2 mb-4">
                  <div className="flex-1 min-w-0">
                    {isEditingProfile ? (
                      <div className="flex flex-col gap-1.5 w-full">
                        <input
                          type="text"
                          value={profileName}
                          onChange={(e) => setProfileName(e.target.value)}
                          className={`w-full text-sm font-bold px-2.5 py-1 rounded-xl border ${theme === 'dark' ? 'bg-slate-900 border-white/15 text-white' : 'bg-slate-100 border-slate-300 text-slate-900'}`}
                          placeholder="Nome Completo"
                        />
                        <input
                          type="text"
                          value={profileRole}
                          onChange={(e) => setProfileRole(e.target.value)}
                          className={`w-full text-xs px-2.5 py-1 rounded-lg border ${theme === 'dark' ? 'bg-slate-900 border-white/15 text-white' : 'bg-slate-100 border-slate-300 text-slate-900'}`}
                          placeholder="Cargo"
                        />
                      </div>
                    ) : (
                      <>
                        <h4 className="text-base font-bold tracking-tight truncate">
                          {profileName}
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {profileRole}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* Role Pill */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[10px] font-bold uppercase tracking-wider">
                    <span className="size-1.5 rounded-full bg-sky-400 animate-pulse"></span>
                    {userRole === 'admin' ? 'Administrador Pro' : 'Membro da Equipe'}
                  </div>
                </div>

                {/* Stats Row */}
                <div className={`grid grid-cols-3 divide-x rounded-xl py-3 mb-5 text-center border ${theme === 'dark' ? 'bg-white/[0.02] border-white/5 divide-white/10' : 'bg-slate-50 border-slate-100 divide-slate-200'}`}>
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-bold flex items-center gap-1">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      {profileRating}
                    </span>
                    <span className="text-[9px] text-slate-500 uppercase mt-0.5">Nota</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-bold">{profilePatients}</span>
                    <span className="text-[9px] text-slate-500 uppercase mt-0.5">Pacientes</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-bold text-emerald-400">{profileScore}</span>
                    <span className="text-[9px] text-slate-500 uppercase mt-0.5">Score</span>
                  </div>
                </div>

                {/* Save button if editing */}
                {isEditingProfile && (
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(false)}
                    className="w-full mb-3 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Salvar Alterações
                  </button>
                )}

                {/* Quick actions */}
                <div className="flex flex-col gap-1 pt-3 border-t border-white/10">
                  {userRole === 'admin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileCardOpen(false);
                        openPermissions();
                      }}
                      className="flex items-center justify-between p-2.5 rounded-xl hover:bg-white/[0.04] text-xs font-medium text-amber-400 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <ShieldCheck className="w-4 h-4" />
                        <span>Controle de Acessos & Permissões</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-red-500/10 text-xs font-medium text-red-400 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <LogOut className="w-4 h-4" />
                      <span>Sair do Sistema</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-red-500/50" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
