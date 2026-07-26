
import React, { useState } from 'react';
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
  Users,
  Settings,
  Star,
  Edit2,
  Check
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
}

// Configuração centralizada da estrutura do menu
const MENU_STRUCTURE = [
  {
    id: Tab.DASHBOARD,
    label: 'Dashboard',
    icon: 'fas fa-chart-line',
    color: 'text-pink-500',
    subItems: [
        { id: 'geral', label: 'Visão Geral' },
        { id: 'commercial', label: 'Comercial' }
    ]
  },
  {
    id: Tab.FINANCIAL,
    label: 'Financeiro',
    icon: 'fas fa-dollar-sign',
    color: 'text-cyan-500',
    subItems: [
        { id: 'overview', label: 'Visão Geral' },
        { id: 'transactions', label: 'Receitas' },
        { id: 'expenses', label: 'Despesas' },
        { id: 'dre', label: 'DRE & Auditoria' },
        { id: 'accounts', label: 'Contas & Extratos' },
        { id: 'settings', label: 'Configurações' }
    ]
  },
  {
    id: Tab.ORTHODONTICS,
    label: 'Ortodontia',
    icon: 'fas fa-calendar-alt',
    color: 'text-purple-500',
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
    icon: 'fas fa-flask',
    color: 'text-emerald-500',
    subItems: [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'kanban', label: 'Kanban' },
        { id: 'settings', label: 'Tabela Preços' }
    ]
  },
  {
    id: Tab.MEETINGS,
    label: 'Gestão & Comercial',
    icon: 'fas fa-users',
    color: 'text-indigo-500',
    subItems: [
        { id: 'campaign_calendar', label: 'Calendário de Campanha' },
        { id: 'meeting_minutes', label: 'Atas de Reuniões' },
        { id: 'clinic_ideas', label: 'Ideias para a Clínica' }
    ]
  },
  {
    id: Tab.SUPPORT,
    label: 'Chamados',
    icon: 'fas fa-headset',
    color: 'text-orange-500',
    subItems: [] // Sem sub-abas
  },
  {
    id: Tab.PASSWORDS,
    label: 'Senhas',
    icon: 'fas fa-key',
    color: 'text-rose-500',
    subItems: []
  },
  {
    id: Tab.RESPONSIBILITIES,
    label: 'Processos',
    icon: 'fas fa-clipboard-check',
    color: 'text-teal-500',
    subItems: [
        { id: 'processes', label: 'Processos' },
        { id: 'responsibilities', label: 'Responsabilidades' },
        { id: 'instructions', label: 'Instruções de Trabalho' }
    ]
  },
  {
    id: Tab.BIBLIOTECA,
    label: 'Biblioteca',
    icon: 'fas fa-book-open',
    color: 'text-amber-500',
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
  onSubTabSelect
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isDesktopExpanded = false; // Always collapsed/narrow on desktop
  const [activeSubmenuTab, setActiveSubmenuTab] = useState<Tab | null>(null);
  const hoverTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const [isProfileCardOpen, setIsProfileCardOpen] = useState(false);
  const [profileName, setProfileName] = useState(() => localStorage.getItem('profileName') || 'Dr. Alexander Ross');
  const [profileRole, setProfileRole] = useState(() => localStorage.getItem('profileRole') || 'Dentista Administrador');
  const [profileRating, setProfileRating] = useState(() => localStorage.getItem('profileRating') || '4.9');
  const [profilePatients, setProfilePatients] = useState(() => localStorage.getItem('profilePatients') || '2.4k+');
  const [profileScore, setProfileScore] = useState(() => localStorage.getItem('profileScore') || '98%');
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  React.useEffect(() => {
    localStorage.setItem('profileName', profileName);
  }, [profileName]);

  React.useEffect(() => {
    localStorage.setItem('profileRole', profileRole);
  }, [profileRole]);

  React.useEffect(() => {
    localStorage.setItem('profileRating', profileRating);
  }, [profileRating]);

  React.useEffect(() => {
    localStorage.setItem('profilePatients', profilePatients);
  }, [profilePatients]);

  React.useEffect(() => {
    localStorage.setItem('profileScore', profileScore);
  }, [profileScore]);

  const showSubmenu = (tabId: Tab) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    const item = MENU_STRUCTURE.find(m => m.id === tabId);
    if (item && item.subItems && item.subItems.length > 0) {
      setActiveSubmenuTab(tabId);
    } else {
      setActiveSubmenuTab(null);
    }
  };

  const hideSubmenu = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setActiveSubmenuTab(null);
    }, 180);
  };

  const keepSubmenu = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  React.useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);
  
  // Sincroniza o activeSubTabId com solicitações externas (ex: dashboard buttons)
  React.useEffect(() => {
    if (requestedSubTab) {
      // Logic for requested tab can go here if needed
    }
  }, [requestedSubTab]);

  const handleLogout = async () => {
      await supabase.auth.signOut();
  };

  const MASTER_EMAIL = 'clinica.centrodosorrisosc@gmail.com';

  const handleMainTabClick = (tabId: Tab) => {
      setActiveTab(tabId);
      
      const item = MENU_STRUCTURE.find(m => m.id === tabId);
      if (item && item.subItems && item.subItems.length > 0) {
        if (activeSubmenuTab === tabId) {
          setActiveSubmenuTab(null);
        } else {
          setActiveSubmenuTab(tabId);
        }
      } else {
        setActiveSubmenuTab(null);
        setIsMobileMenuOpen(false); // Close mobile menu if no sub-items
      }
  };

  const filteredNavItems = MENU_STRUCTURE.filter(item => Array.isArray(allowedTabs) && allowedTabs.includes(item.id));

  return (
    <>
      {isMobileMenuOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-panel z-40 lg:hidden backdrop-blur-2xl" 
          onClick={() => setIsMobileMenuOpen(false)} 
        />
      )}

      <motion.aside 
        layout
        initial={false}
        animate={{ 
          width: 80
        }}
        transition={{
          type: 'spring',
          stiffness: 150,
          damping: 24,
          mass: 0.6
        }}
        className={`
          w-full glass-sidebar border-b lg:border-b-0 lg:border-r border-border/30
          flex flex-col shrink-0 lg:h-screen fixed lg:sticky top-0 z-50
          ${isMobileMenuOpen ? 'h-[90vh] rounded-b-3xl border-b border-border shadow-2xl bg-surface/80 backdrop-blur-2xl' : 'h-auto'} 
        `}
      >
        
        <div className="glass-filter"></div>
        <div className="glass-overlay"></div>
        <div className="glass-specular"></div>
        <div className="glass-content w-full h-full flex flex-col relative z-10">
          <div className="sidebar-header hidden">
            <h3>Menu</h3>
          </div>
        {/* LOGO AREA */}
        <div className={`p-4 lg:p-0 lg:py-8 flex items-center justify-between lg:justify-center gap-4 select-none relative`}>
          <motion.div layout className={`flex items-center gap-3`}>
            <motion.div 
              layout
              className={`flex flex-col items-center leading-[0.7] font-sans`}
            >
              <span className="text-blue-500 text-[24px] lg:text-[20px] font-extrabold tracking-tight">C</span>
              <span className="text-purple-500 text-[24px] lg:text-[20px] font-extrabold tracking-tight">S</span>
              <AnimatePresence mode="wait">
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="hidden lg:block h-px w-4 bg-panel/80 my-1"
                />
              </AnimatePresence>
            </motion.div>
            
            {/* Labels shown only on mobile */}
            <div className="flex flex-col lg:hidden leading-[0.8]">
              <span className="text-blue-500 text-[24px] font-extrabold tracking-tight">Centro</span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">do</span>
                <span className="text-purple-500 text-[24px] font-extrabold tracking-tight">Sorriso</span>
              </div>
            </div>
          </motion.div>

          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="lg:hidden p-2 glass-button text-slate-400 hover:text-text transition-all rounded-lg active:scale-95">
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* MENU NAVIGATION */}
        <div className={`flex-1 flex flex-col lg:overflow-visible overflow-hidden transition-all duration-300 ${isMobileMenuOpen ? 'opacity-100 max-h-screen' : 'opacity-0 max-h-0 lg:opacity-100 lg:max-h-full'}`}>
          <nav className={`flex-1 flex flex-col px-4 ${isDesktopExpanded ? 'lg:px-4' : 'lg:px-0'} gap-1.5 lg:overflow-visible overflow-y-auto mt-2 custom-scrollbar`}>
            
            <motion.span layout className={`text-[10px] font-bold text-slate-600 uppercase tracking-widest px-4 mb-2 mt-2 ${isDesktopExpanded ? 'lg:block' : 'lg:hidden'}`}>Principal</motion.span>

            {filteredNavItems.map((item) => {
                const isActive = activeTab === item.id;

                return (
                    <motion.div 
                        layout 
                        key={item.id} 
                        className="flex flex-col lg:items-center relative group transition-all duration-300 w-full"
                        onMouseEnter={() => showSubmenu(item.id)}
                        onMouseLeave={hideSubmenu}
                    >
                        <button
                          onClick={() => handleMainTabClick(item.id)}
                          className={`
                            group/btn relative flex items-center justify-between lg:justify-center px-4 py-3 lg:h-12 lg:p-0 rounded-xl transition-all duration-200 w-full lg:w-12 text-left shrink-0
                            ${isActive ? 'bg-panel/80 text-text shadow-lg shadow-black/20' : 'text-slate-500 hover:text-text hover:bg-white/[0.05]'}
                          `}
                        >
                          <motion.div layout className="flex items-center gap-3">
                              <div className={`glass-icon size-9 rounded-xl flex items-center justify-center relative transition-all duration-300 shrink-0 ${isActive ? 'scale-105 border-indigo-500/30' : 'opacity-80 group-hover/btn:opacity-100 group-hover/btn:scale-105'}`}>
                                <div className="glass-filter"></div>
                                <div className="glass-overlay"></div>
                                <div className="glass-specular"></div>
                                <div className="glass-content flex items-center justify-center">
                                  <i className={`text-[1.1rem] w-5 h-5 text-center flex items-center justify-center ${item.icon} ${isActive ? item.color : 'text-slate-400 group-hover/btn:text-slate-200'} transition-colors`} />
                                </div>
                              </div>
                              <span className="text-[10px] font-bold tracking-wide lg:hidden">{item.label}</span>
                          </motion.div>
                          {isActive && <motion.div layoutId="activeTab" className={`absolute lg:left-0 left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full ${item.color.replace('text-', 'bg-')}`}></motion.div>}
                        </button>

                        {/* MOBILE SUB-ITEMS ACCORDION */}
                        {isActive && item.subItems && item.subItems.length > 0 && (
                          <div className="pl-6 pr-2 py-1 flex flex-col gap-1 lg:hidden w-full mb-2">
                            {item.subItems.map(subItem => (
                              <button
                                key={subItem.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveTab(item.id);
                                  if (onSubTabSelect) onSubTabSelect(subItem.id);
                                  setIsMobileMenuOpen(false);
                                }}
                                className="w-full text-left py-2 px-3 text-[11px] text-slate-400 hover:text-text transition-colors rounded-lg bg-white/[0.02]"
                              >
                                {subItem.label}
                              </button>
                            ))}
                          </div>
                        )}
                    </motion.div>
                )
            })}


          </nav>


          {/* USER PROFILE FOOTER */}
          <div className={`p-4 border-t border-border/50 flex flex-col gap-3 bg-transparent lg:py-6 ${isDesktopExpanded ? 'lg:items-start lg:px-4' : 'lg:items-center'}`}>
            
            {/* NOTIFICATION TRIGGER */}
            <button 
              onClick={openNotifications}
              className={`
                group relative flex items-center justify-between ${isDesktopExpanded ? 'lg:justify-start px-4' : 'lg:justify-center px-4'} py-3 lg:h-10 lg:p-0 rounded-xl transition-all duration-200 w-full ${isDesktopExpanded ? 'lg:w-full lg:px-4' : 'lg:w-10'} text-left shrink-0 glass-button shadow-sm cursor-pointer relative
                ${notificationCount > 0 
                  ? 'border-orange-500/50 bg-orange-500/10 text-orange-400 ring-2 ring-orange-500/20 shadow-[0_0_15px_rgba(249,115,22,0.2)]' 
                  : 'text-slate-300'
                }
              `}
              title="Notificações"
            >
                {notificationCount > 0 && (
                  <span className="absolute inset-0 rounded-xl border border-orange-500/30 animate-pulse pointer-events-none" />
                )}
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Bell className={`w-5 h-5 text-orange-400 transition-transform group-hover:scale-110 ${notificationCount > 0 ? 'animate-bounce' : ''}`} />
                        {notificationCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 size-4 bg-red-500 text-text text-[9px] font-black rounded-full flex items-center justify-center border border-surface shadow-lg">
                                {notificationCount > 9 ? '9+' : notificationCount}
                            </span>
                        )}
                    </div>
                    <AnimatePresence mode="popLayout">
                      {isDesktopExpanded && (
                        <motion.span 
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          transition={{ duration: 0.18, ease: "easeOut" }}
                          className="text-[11px] font-bold tracking-wide hidden lg:block"
                        >
                          Notificações
                        </motion.span>
                      )}
                    </AnimatePresence>
                    <span className="text-[11px] font-bold tracking-wide lg:hidden">
                        Notificações
                    </span>
                </div>
            </button>

            {/* PERMISSIONS TRIGGER FOR MASTER EMAIL ONLY */}
            {userEmail === MASTER_EMAIL && (
              <button 
                onClick={openPermissions}
                className={`group relative flex items-center justify-between ${isDesktopExpanded ? 'lg:justify-start px-4' : 'lg:justify-center px-4'} py-3 lg:h-10 lg:p-0 rounded-xl transition-all duration-200 w-full ${isDesktopExpanded ? 'lg:w-full lg:px-4' : 'lg:w-10'} text-left shrink-0 glass-button shadow-sm text-slate-300 hover:text-text cursor-pointer`}
                title="Gestão de Usuários e Permissões"
              >
                  <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-blue-400 transition-transform group-hover:scale-110" />
                      <AnimatePresence mode="popLayout">
                        {isDesktopExpanded && (
                          <motion.span 
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.18, ease: "easeOut" }}
                            className="text-[11px] font-bold tracking-wide hidden lg:block"
                          >
                            Controle de Acessos
                          </motion.span>
                        )}
                      </AnimatePresence>
                      <span className="text-[11px] font-bold tracking-wide lg:hidden">
                          Controle de Acessos
                      </span>
                  </div>
              </button>
            )}

            {/* THEME TOGGLE */}
            <button 
              onClick={toggleTheme}
              className={`group relative flex items-center justify-between ${isDesktopExpanded ? 'lg:justify-start px-4' : 'lg:justify-center px-4'} py-3 lg:h-10 lg:p-0 rounded-xl transition-all duration-200 w-full ${isDesktopExpanded ? 'lg:w-full lg:px-4' : 'lg:w-10'} text-left shrink-0 glass-button shadow-sm text-slate-300 hover:text-text cursor-pointer`}
              title={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
            >
                <div className="flex items-center gap-3">
                    {theme === 'dark' ? (
                        <Sun className="w-5 h-5 text-yellow-400 transition-transform group-hover:rotate-45" />
                    ) : (
                        <Moon className="w-5 h-5 text-indigo-500 transition-transform group-hover:-rotate-12" />
                    )}
                    <AnimatePresence mode="popLayout">
                      {isDesktopExpanded && (
                        <motion.span 
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          transition={{ duration: 0.18, ease: "easeOut" }}
                          className="text-[11px] font-bold tracking-wide hidden lg:block"
                        >
                          {theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    <span className="text-[11px] font-bold tracking-wide lg:hidden">
                        {theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
                    </span>
                </div>
            </button>

            <motion.div 
              layout 
              onClick={() => setIsProfileCardOpen(true)}
              className={`px-3 py-2.5 lg:px-3 lg:py-2.5 lg:bg-white/[0.05] lg:border lg:border-border rounded-xl bg-white/[0.05] border border-border flex items-center justify-between w-full group relative hover:border-white/20 transition-colors cursor-pointer ${!isDesktopExpanded ? 'lg:size-10 lg:p-0 lg:justify-center' : ''}`}
            >
                <div className={`flex items-center gap-3 ${!isDesktopExpanded ? 'lg:flex-col lg:gap-2' : ''}`}>
                    <div className="size-9 lg:size-8 rounded-xl flex items-center justify-center text-text text-[10px] font-black uppercase bg-gradient-to-br from-blue-600 to-purple-600 shadow-lg shadow-purple-500/20 shrink-0">{userRole.slice(0, 2)}</div>
                    <AnimatePresence mode="popLayout">
                      {isDesktopExpanded && (
                        <motion.div 
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          transition={{ duration: 0.18, ease: "easeOut" }}
                          className="hidden lg:flex flex-col min-w-0"
                        >
                          <span className="text-[11px] font-bold text-text capitalize leading-tight">
                            {userRole === 'admin' ? 'Administrador' : userRole === 'reception' ? 'Recepção' : userRole}
                          </span>
                          {userEmail && (
                            <span className="text-[9px] text-slate-500 truncate max-w-[120px]" title={userEmail}>
                                {userEmail}
                            </span>
                          )}
                          <span className="text-[9px] text-emerald-500 font-medium flex items-center gap-1 mt-0.5"><span className="size-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Online</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <div className="flex flex-col lg:hidden min-w-0">
                      <span className="text-[11px] font-bold text-text capitalize leading-tight">
                        {userRole === 'admin' ? 'Administrador' : userRole === 'reception' ? 'Recepção' : userRole}
                      </span>
                      {userEmail && (
                        <span className="text-[9px] text-slate-500 truncate max-w-[180px]" title={userEmail}>
                            {userEmail}
                        </span>
                      )}
                      <span className="text-[9px] text-emerald-500 font-medium flex items-center gap-1 mt-0.5"><span className="size-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Online</span>
                    </div>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLogout();
                  }} 
                  className={`
                    size-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all font-bold
                    ${isDesktopExpanded ? 'relative' : 'lg:absolute lg:top-0 lg:right-0 lg:translate-x-2 lg:-translate-y-2 lg:bg-red-500 lg:text-text lg:rounded-full lg:size-5 lg:p-0 lg:opacity-0 lg:group-hover:opacity-100'}
                  `} 
                  title="Sair"
                >
                  <LogOut className={`w-4 h-4 ${!isDesktopExpanded ? 'lg:w-3 lg:h-3' : ''}`} />
                </button>
            </motion.div>
          </div>
        </div>


      </div>
      </motion.aside>

      {/* FLOATING SUBMENU NEXT TO COLLAPSED SIDEBAR (DESKTOP) */}
      <AnimatePresence>
        {activeSubmenuTab && (
          <>
            {/* Flyout panel next to sidebar */}
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              onMouseEnter={keepSubmenu}
              onMouseLeave={hideSubmenu}
              className="fixed left-[80px] top-0 bottom-0 w-64 glass-sidebar border-r border-border/50 shadow-[10px_0_30px_rgba(0,0,0,0.3)] z-[58] hidden lg:block"
            >
              <div className="glass-filter"></div>
              <div className="glass-overlay"></div>
              <div className="glass-specular"></div>
              <div className="glass-content w-full h-full flex flex-col p-6 pt-8">
              {/* Submenu Title */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
                <div className="flex items-center gap-2">
                  {(() => {
                    const matched = MENU_STRUCTURE.find(m => m.id === activeSubmenuTab);
                    if (!matched) return null;
                    return (
                      <div className="glass-icon size-7 rounded-lg flex items-center justify-center relative shrink-0">
                        <div className="glass-filter"></div>
                        <div className="glass-overlay"></div>
                        <div className="glass-specular"></div>
                        <div className="glass-content flex items-center justify-center">
                          <i className={`text-[0.9rem] text-center ${matched.icon} ${matched.color}`} />
                        </div>
                      </div>
                    );
                  })()}
                  <span className="text-[11px] font-bold uppercase tracking-wider text-text">
                    {MENU_STRUCTURE.find(m => m.id === activeSubmenuTab)?.label}
                  </span>
                </div>
                <button 
                  onClick={() => setActiveSubmenuTab(null)}
                  className="p-1.5 glass-button rounded-lg text-slate-500 hover:text-text transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Submenu Items List */}
              <div className="flex-1 flex flex-col gap-1 overflow-y-auto custom-scrollbar">
                {MENU_STRUCTURE.find(m => m.id === activeSubmenuTab)?.subItems.map((subItem) => {
                  return (
                    <button
                      key={subItem.id}
                      onClick={() => {
                        setActiveTab(activeSubmenuTab);
                        if (onSubTabSelect) {
                          onSubTabSelect(subItem.id);
                        }
                        setActiveSubmenuTab(null);
                      }}
                      className="w-full text-left px-4 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-text hover:bg-white/[0.04] transition-all flex items-center justify-between group cursor-pointer"
                    >
                      <span>{subItem.label}</span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-slate-500" />
                    </button>
                  );
                })}
              </div>
            </div></motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="lg:hidden h-[72px] shrink-0 bg-transparent"></div>

      {/* PROFILE DETAILS MODAL (ALEXANDER ROSS GLASS CARD STYLE) */}
      <AnimatePresence>
        {isProfileCardOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
            {/* Backdrop overlay with blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-xl cursor-pointer"
              onClick={() => {
                setIsProfileCardOpen(false);
                setIsEditingProfile(false);
              }}
            />

            {/* Glass Profile Card */}
            <motion.div
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className={`
                relative w-full max-w-[380px] rounded-[32px] overflow-hidden shadow-2xl border z-10
                ${theme === 'dark' 
                  ? 'bg-slate-950/70 border-white/10 text-white shadow-black/80' 
                  : 'bg-white/90 border-slate-200/80 text-slate-900 shadow-slate-300/50'
                }
              `}
            >
              {/* Cover Banner */}
              <div className="relative h-[150px] w-full overflow-hidden">
                <img 
                  src="/src/assets/images/profile_banner_3d_1784489803229.jpg" 
                  alt="Profile Cover" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"></div>
                
                {/* Floating Bookmark/Star overlay on cover or next to avatar */}
                <button 
                  onClick={() => setIsEditingProfile(!isEditingProfile)}
                  className="absolute top-4 right-4 size-10 rounded-full bg-black/30 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-black/50 transition-all text-white cursor-pointer"
                  title="Editar Perfil"
                >
                  {isEditingProfile ? <Check className="w-4 h-4 text-emerald-400" /> : <Edit2 className="w-4 h-4 text-slate-200" />}
                </button>
              </div>

              {/* Card Body Container */}
              <div className="relative pt-14 px-6 pb-6">
                {/* Overlapping Avatar */}
                <div className="absolute -top-12 left-6">
                  <div className={`
                    size-[88px] rounded-full border-4 overflow-hidden shadow-xl relative group
                    ${theme === 'dark' ? 'border-slate-950 bg-slate-900' : 'border-white bg-slate-100'}
                  `}>
                    <img 
                      src="/src/assets/images/profile_avatar_admin_1784489816090.jpg" 
                      alt="User Avatar" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                      <span className="text-[10px] text-white font-bold">CRM 12345</span>
                    </div>
                  </div>
                </div>

                {/* Name, Role & Bookmark Row */}
                <div className="flex items-start justify-between gap-4 mt-2 mb-4">
                  <div className="flex-1 min-w-0">
                    {isEditingProfile ? (
                      <div className="flex flex-col gap-1.5 w-full">
                        <input
                          type="text"
                          value={profileName}
                          onChange={(e) => setProfileName(e.target.value)}
                          className={`w-full text-base font-bold px-2.5 py-1 rounded-xl border ${theme === 'dark' ? 'bg-slate-900/80 border-white/15 text-white' : 'bg-slate-100 border-slate-300 text-slate-900'} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                          placeholder="Nome Completo"
                        />
                        <input
                          type="text"
                          value={profileRole}
                          onChange={(e) => setProfileRole(e.target.value)}
                          className={`w-full text-xs px-2.5 py-1 rounded-lg border ${theme === 'dark' ? 'bg-slate-900/80 border-white/15 text-white' : 'bg-slate-100 border-slate-300 text-slate-900'} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                          placeholder="Cargo / CRM"
                        />
                      </div>
                    ) : (
                      <>
                        <h4 className="text-[17px] font-bold tracking-tight truncate">
                          {profileName}
                        </h4>
                        <p className={`text-[11px] font-medium mt-0.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                          {profileRole}
                        </p>
                      </>
                    )}
                  </div>

                  {/* Glass Interactive Bookmark Button next to name */}
                  <button 
                    className={`
                      size-10 rounded-full flex items-center justify-center shrink-0 border transition-all cursor-pointer
                      ${theme === 'dark' 
                        ? 'bg-white/[0.04] border-white/10 text-slate-300 hover:bg-white/[0.08] hover:text-white' 
                        : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                      }
                    `}
                    onClick={() => {
                      alert("Perfil favoritado para acesso rápido no painel!");
                    }}
                    title="Favoritar Perfil"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                    </svg>
                  </button>
                </div>

                {/* Tag badges */}
                <div className="flex items-center gap-2 mb-6">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-wider">
                    <span className="size-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                    Gestor Pro
                  </div>
                  <div className={`px-2.5 py-1 rounded-full border text-[10px] font-bold ${theme === 'dark' ? 'bg-white/[0.04] border-white/10 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                    +6
                  </div>
                </div>

                {/* Interactive stats row with dividers */}
                <div className={`
                  grid grid-cols-3 divide-x rounded-2xl py-3.5 mb-6 text-center border
                  ${theme === 'dark' 
                    ? 'bg-white/[0.02] border-white/5 divide-white/10' 
                    : 'bg-slate-50 border-slate-100 divide-slate-200'
                  }
                `}>
                  {/* Stat 1: Rating */}
                  <div className="flex flex-col items-center">
                    {isEditingProfile ? (
                      <input
                        type="text"
                        value={profileRating}
                        onChange={(e) => setProfileRating(e.target.value)}
                        className={`w-14 text-center text-xs font-extrabold py-0.5 rounded ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-900'}`}
                      />
                    ) : (
                      <span className="text-[14px] font-black tracking-tight flex items-center justify-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400 shrink-0" />
                        {profileRating}
                      </span>
                    )}
                    <span className="text-[9px] font-semibold text-slate-500 mt-1 uppercase tracking-widest">
                      nota
                    </span>
                  </div>

                  {/* Stat 2: Patients */}
                  <div className="flex flex-col items-center">
                    {isEditingProfile ? (
                      <input
                        type="text"
                        value={profilePatients}
                        onChange={(e) => setProfilePatients(e.target.value)}
                        className={`w-14 text-center text-xs font-extrabold py-0.5 rounded ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-900'}`}
                      />
                    ) : (
                      <span className="text-[14px] font-black tracking-tight">
                        {profilePatients}
                      </span>
                    )}
                    <span className="text-[9px] font-semibold text-slate-500 mt-1 uppercase tracking-widest font-mono">
                      pacientes
                    </span>
                  </div>

                  {/* Stat 3: Productivity Score */}
                  <div className="flex flex-col items-center">
                    {isEditingProfile ? (
                      <input
                        type="text"
                        value={profileScore}
                        onChange={(e) => setProfileScore(e.target.value)}
                        className={`w-14 text-center text-xs font-extrabold py-0.5 rounded ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-900'}`}
                      />
                    ) : (
                      <span className="text-[14px] font-black tracking-tight">
                        {profileScore}
                      </span>
                    )}
                    <span className="text-[9px] font-semibold text-slate-500 mt-1 uppercase tracking-widest">
                      score
                    </span>
                  </div>
                </div>

                {/* Primary Get In Touch / Save Button */}
                <button
                  onClick={() => {
                    if (isEditingProfile) {
                      setIsEditingProfile(false);
                    } else {
                      setIsEditingProfile(true);
                    }
                  }}
                  className={`
                    w-full py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 shadow-lg cursor-pointer flex items-center justify-center gap-2
                    ${isEditingProfile 
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20' 
                      : theme === 'dark' 
                        ? 'bg-white text-slate-950 hover:bg-slate-200 shadow-white/10' 
                        : 'bg-slate-950 text-white hover:bg-slate-800 shadow-slate-950/20'
                    }
                  `}
                >
                  {isEditingProfile ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Salvar Dados
                    </>
                  ) : (
                    <>
                      <Settings className="w-3.5 h-3.5" />
                      Ajustar Dados do Perfil
                    </>
                  )}
                </button>

                {/* System Options List - "opções do perfil" */}
                <div className={`mt-6 pt-5 border-t ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'} flex flex-col gap-1.5`}>
                  
                  {/* Account Settings Option */}
                  <button 
                    onClick={() => {
                      alert("Configurações do consultório estão atualizadas com as melhores práticas de gestão!");
                    }}
                    className={`
                      flex items-center justify-between p-3 rounded-xl transition-all text-left text-xs font-medium cursor-pointer group
                      ${theme === 'dark' ? 'hover:bg-white/[0.04]' : 'hover:bg-slate-100'}
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`size-7 rounded-lg flex items-center justify-center ${theme === 'dark' ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
                        <Settings className="w-3.5 h-3.5 text-indigo-400" />
                      </div>
                      <span className="font-bold">Configurações do Consultório</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500 transition-transform group-hover:translate-x-0.5" />
                  </button>

                  {/* Access Controls Option */}
                  {userEmail === MASTER_EMAIL && (
                    <button 
                      onClick={() => {
                        setIsProfileCardOpen(false);
                        openPermissions();
                      }}
                      className={`
                        flex items-center justify-between p-3 rounded-xl transition-all text-left text-xs font-medium cursor-pointer group
                        ${theme === 'dark' ? 'hover:bg-white/[0.04]' : 'hover:bg-slate-100'}
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`size-7 rounded-lg flex items-center justify-center ${theme === 'dark' ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
                          <Users className="w-3.5 h-3.5 text-emerald-400" />
                        </div>
                        <span className="font-bold">Controle de Acessos</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  )}

                  {/* Theme Option inside popup */}
                  <button 
                    onClick={toggleTheme}
                    className={`
                      flex items-center justify-between p-3 rounded-xl transition-all text-left text-xs font-medium cursor-pointer group
                      ${theme === 'dark' ? 'hover:bg-white/[0.04]' : 'hover:bg-slate-100'}
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`size-7 rounded-lg flex items-center justify-center ${theme === 'dark' ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
                        {theme === 'dark' ? (
                          <Sun className="w-3.5 h-3.5 text-yellow-400" />
                        ) : (
                          <Moon className="w-3.5 h-3.5 text-indigo-500" />
                        )}
                      </div>
                      <span className="font-bold">{theme === 'dark' ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro'}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500 transition-transform group-hover:translate-x-0.5" />
                  </button>

                  {/* Logout Option inside popup */}
                  <button 
                    onClick={handleLogout}
                    className={`
                      flex items-center justify-between p-3 rounded-xl transition-all text-left text-xs font-medium cursor-pointer group
                      hover:bg-red-500/10 text-red-500
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <div className="size-7 rounded-lg flex items-center justify-center bg-red-500/10">
                        <LogOut className="w-3.5 h-3.5 text-red-500" />
                      </div>
                      <span className="font-bold">Sair do Sistema</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-red-500/50 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>

                {/* Close Button */}
                <div className="mt-5 flex justify-center">
                  <button 
                    onClick={() => {
                      setIsProfileCardOpen(false);
                      setIsEditingProfile(false);
                    }}
                    className={`text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-indigo-400 transition-colors cursor-pointer py-1 px-3`}
                  >
                    Fechar Detalhes
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
