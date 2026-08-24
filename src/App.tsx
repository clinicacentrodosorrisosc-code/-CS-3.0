
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { Financial } from './components/Financial';
import { Orthodontics } from './components/Orthodontics';
import { LabWork } from './components/LabWork';
import { Meetings } from './components/Meetings';
import { Support } from './components/Support';
import { Passwords } from './components/Passwords';
import { Biblioteca } from './components/Biblioteca';
import { Responsibilities } from './components/Responsibilities';
import { Login } from './components/Login';
import { PermissionsModal } from './components/PermissionsModal';
import { NotificationCenter } from './components/NotificationCenter';
import { Tab } from './types';
import { supabase } from './supabaseClient';
import { Toaster, toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { ChatWidget } from './components/Chat/ChatWidget';
import { AppHeader } from './components/Layout/AppHeader';
import { useRealtimeSubscription } from './lib/realtime';
import { playCashRegisterSound } from './lib/sound';

const TabContainer = ({ children }: { children: React.ReactNode }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.995 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.995 }}
      transition={{ 
        duration: 0.35, 
        ease: [0.16, 1, 0.3, 1] 
      }}
      className="absolute inset-0 flex flex-col"
      style={{ zIndex: 10 }}
    >
      {children}
    </motion.div>
  );
};

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>(Tab.DASHBOARD);
  const activeTabRef = useRef<Tab>(Tab.DASHBOARD);
  

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  // Real-time listener for remote financial entries across profiles
  useRealtimeSubscription(['transactions'], (changedTable, isRemote) => {
    if (isRemote && changedTable === 'transactions') {
      playCashRegisterSound();
      toast.success('Novo lançamento financeiro registrado em outro perfil! 💰', {
        description: 'Os dados e relatórios financeiros foram atualizados automaticamente.',
        duration: 4000
      });
    }
  });

  const [allowedTabs, setAllowedTabs] = useState<string[]>([]);
  const [allowedSubTabs, setAllowedSubTabs] = useState<string[]>([]);
  const [userRole, setUserRole] = useState<string>('user');
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('theme');
      return (saved as 'light' | 'dark') || 'light';
    } catch (e) {
      console.warn("Could not read theme from localStorage inside App.tsx:", e);
      return 'light';
    }
  });
  
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    try {
      localStorage.setItem('theme', theme);
    } catch (e) {
      console.warn("Could not write theme to localStorage inside App.tsx:", e);
    }
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');
  

  const isFetchingProfile = useRef(false);
  const loadedProfileUserId = useRef<string | null>(null);


  const [requestedSubTab, setRequestedSubTab] = useState<string | null>(null);

  const fetchUserProfile = useCallback(async (currentUser: any) => {
    if (!currentUser || isFetchingProfile.current) return;
    
    if (loadedProfileUserId.current === currentUser.id) {
      setLoading(false);
      return;
    }
    
    isFetchingProfile.current = true;
    

    const timeoutId = setTimeout(() => {
      setLoading(current => {
        if (current) console.warn("DEBUG: fetchUserProfile demorando demais, forçando fim do loading");
        return false;
      });
    }, 5000);

    try {
      let profileData = null;
      const { data, error } = await supabase
        .from('profiles')
        .select('role, allowed_tabs, allowed_sub_tabs')
        .eq('id', currentUser.id)
        .single();
      
      if (error) {
        console.error("DEBUG: Erro retornado pelo Supabase (Profiles):", error);

      } else {
        profileData = data;
      }
      
      if (!profileData) {
        const defaultRole = currentUser.user_metadata?.role || 'user';
        let defaultTabs: string[] = [Tab.DASHBOARD];
        if (defaultRole === 'admin') {
          defaultTabs = Object.values(Tab);
        } else if (defaultRole === 'reception') {
          defaultTabs = [Tab.DASHBOARD, Tab.FINANCIAL, Tab.ORTHODONTICS, Tab.LABWORK, Tab.MEETINGS, Tab.SUPPORT, Tab.PASSWORDS];
        }
        
        const newProfile = {
          id: currentUser.id,
          email: currentUser.email,
          role: defaultRole,
          allowed_tabs: defaultTabs,
          allowed_sub_tabs: []
        };
        
        const { error: insertError } = await supabase
          .from('profiles')
          .insert(newProfile);
          
        if (insertError) {
          console.error("DEBUG: Erro ao criar perfil padrão no Supabase:", insertError);
        } else {
          const { data: retriedData } = await supabase
            .from('profiles')
            .select('role, allowed_tabs, allowed_sub_tabs')
            .eq('id', currentUser.id)
            .single();
            
          if (retriedData) {
            profileData = retriedData;
          }
        }
      }
      
      let role = profileData?.role;
      if (!role && currentUser.user_metadata?.role) {
          role = currentUser.user_metadata.role;
      }
      role = role || 'user';
      setUserRole(role);

      const rawTabs = profileData?.allowed_tabs;
      const permissionsNeverSet = rawTabs === null || rawTabs === undefined;
      
      let tabs: string[] = [];
      try { 
        tabs = Array.isArray(rawTabs) ? rawTabs : (typeof rawTabs === 'string' ? JSON.parse(rawTabs) : []); 
      } catch {
        console.warn("Could not parse tabs");
      }
      if (!Array.isArray(tabs)) tabs = [];

      // Ensure initial roles have required tabs

      const rawSubTabs = profileData?.allowed_sub_tabs;
      const subPermissionsNeverSet = rawSubTabs === null || rawSubTabs === undefined;
      
      let subTabs: string[] = [];
      try { 
        subTabs = Array.isArray(rawSubTabs) ? rawSubTabs : (typeof rawSubTabs === 'string' ? JSON.parse(rawSubTabs) : []); 
      } catch {
        console.warn("Could not parse sub-tabs");
      }
      if (!Array.isArray(subTabs)) subTabs = [];

      if (role === 'admin') {
          if (permissionsNeverSet) {
              tabs = Object.values(Tab);
          } else {
              Object.values(Tab).forEach(t => {
                  if (!tabs.includes(t)) tabs.push(t);
              });
          }
      } else if (role === 'reception') {
          if (permissionsNeverSet) {
              tabs = [Tab.DASHBOARD, Tab.FINANCIAL, Tab.ORTHODONTICS, Tab.LABWORK, Tab.MEETINGS, Tab.SUPPORT, Tab.PASSWORDS];
          }
          const mandatoryReceptionSubs = ['lab_kanban'];
          
          if (subPermissionsNeverSet) {
              subTabs = [
                  ...mandatoryReceptionSubs,
                  'financial_overview', 'financial_transactions',
                  'ortho_vision', 'ortho_calendar', 'ortho_grid', 'ortho_patients',
                  'dash_financial',
                  'support_view', 'support_manage'
              ];
          } else {

              mandatoryReceptionSubs.forEach(s => {
                  if (!subTabs.includes(s)) subTabs.push(s);
              });
          }
      } else {

          if (permissionsNeverSet) {
              tabs = [Tab.DASHBOARD]; 
          }
      }
      

      // Admin permissions check completed




      if (tabs.length === 0) {
          tabs.push(Tab.DASHBOARD);
      }
      
      setAllowedTabs(tabs);
      setAllowedSubTabs(subTabs);


      const checkGlobalReset = async () => {
          try {
              const { data: masterData } = await supabase
                  .from('profiles')
                  .select('allowed_sub_tabs')
                  .eq('email', 'clinica.centrodosorrisosc@gmail.com')
                  .single();

              if (masterData?.allowed_sub_tabs) {
                  let subTabsArray: string[] = [];
                  try {
                      subTabsArray = Array.isArray(masterData.allowed_sub_tabs) 
                          ? masterData.allowed_sub_tabs 
                          : (typeof masterData.allowed_sub_tabs === 'string' ? JSON.parse(masterData.allowed_sub_tabs) : []);
                  } catch {
                      subTabsArray = [];
                  }
                  if (!Array.isArray(subTabsArray)) subTabsArray = [];
                  
              const resetEntry = subTabsArray.find((s: string) => s.startsWith('RESET_TS:'));
              if (resetEntry && currentUser?.last_sign_in_at) {
                  const resetTime = new Date(resetEntry.split(':')[1]).getTime();
                  const sessionTime = new Date(currentUser.last_sign_in_at).getTime();
                  
                  if (!isNaN(sessionTime) && sessionTime > 0 && sessionTime < resetTime) {
                      await supabase.auth.signOut();
                      window.location.reload();
                  }
              }
              }
          } catch (e) {
              console.error("Error checking global reset:", e);
          }
      };

      if (currentUser) {
          checkGlobalReset();
      }
      

      if (tabs.length > 0 && !tabs.includes(activeTabRef.current)) {
          setActiveTab(tabs[0] as Tab);
      }

      loadedProfileUserId.current = currentUser.id;
    } catch (err) {
      console.error("Profile fetch error catch:", err);
      setAllowedTabs(Object.values(Tab));
      setAllowedSubTabs([]); 
      if (currentUser?.user_metadata?.role) {
          setUserRole(currentUser.user_metadata.role);
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
      isFetchingProfile.current = false;
    }
  }, []); // We only care if loading state exists, not its value change for logic

  useEffect(() => {
    let isMounted = true;

    // Failsafe timer to guarantee loading never hangs indefinitely
    const globalTimeout = setTimeout(() => {
      if (isMounted) {
        setLoading(false);
      }
    }, 4000);

    const initializeAuth = async () => {
      try {
        // Clear corrupted local storage session tokens if any
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.includes('supabase.auth.token')) {
              const val = localStorage.getItem(key);
              if (val) {
                JSON.parse(val);
              }
            }
          }
        } catch (storageErr) {
          console.warn("Corrupted auth token in localStorage detected, clearing...", storageErr);
          for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && key.includes('supabase.auth.token')) {
              localStorage.removeItem(key);
            }
          }
        }

        const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.warn("Session retrieval warning:", sessionError);
        }
        if (!isMounted) return;
        
        setSession(initialSession);
        
        if (initialSession) {
          await fetchUserProfile(initialSession.user);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error("DEBUG: Erro ao obter sessão inicial:", err);
        setLoading(false);
      } finally {
        clearTimeout(globalTimeout);
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted) return;
      
      setSession(newSession);
      
      if (newSession) {
        fetchUserProfile(newSession.user);
      } else {
        loadedProfileUserId.current = null;
        setAllowedTabs([]);
        setAllowedSubTabs([]);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserProfile]);

  useEffect(() => {
    if (session?.user) {
      const channel = supabase.channel('online-users');
      
      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          

          const activeSessions = Object.values(state).flatMap(presences => presences.map((p: any) => p.user_email || p.user_id));

          const users = Object.values(state).flatMap(presences => presences.map((p: any) => p.user_id));
          setOnlineUsers([...new Set(users)]);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({
              user_id: session.user.id,
              user_email: session.user.email,
              online_at: new Date().toISOString(),
            });
          }
        });

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [session]);

  const handleSubTabSelect = (subTabId: string) => {
      setRequestedSubTab(subTabId);

      setTimeout(() => setRequestedSubTab(null), 500); 
  };

  if (loading) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center text-white gap-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-slate-300">Carregando OdontoManager Pro...</p>
        <button
          onClick={() => setLoading(false)}
          className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-all shadow-md active:scale-95"
        >
          Entrar no Sistema
        </button>
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-[#F8F9FD] dark:bg-[#0B0E17] text-[#181B26] dark:text-slate-100 overflow-hidden transition-colors duration-200">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        allowedTabs={allowedTabs}
        userRole={userRole}
        userEmail={session.user.email}
        openPermissions={() => setIsPermissionsOpen(true)}
        onSubTabSelect={handleSubTabSelect}
        requestedSubTab={requestedSubTab}
        theme={theme}
        toggleTheme={toggleTheme}
        notificationCount={notificationCount}
        openNotifications={() => setIsNotificationsOpen(true)}
      />
      
      <main className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden bg-transparent">
        <AppHeader
          activeTab={activeTab}
          requestedSubTab={requestedSubTab}
          userRole={userRole}
          userEmail={session.user.email}
          onlineUsers={onlineUsers}
          notificationCount={notificationCount}
          openNotifications={() => setIsNotificationsOpen(true)}
          theme={theme}
          toggleTheme={toggleTheme}
          openPermissions={() => setIsPermissionsOpen(true)}
        />

        <NotificationCenter 
          isOpen={isNotificationsOpen}
          onClose={() => setIsNotificationsOpen(false)}
          onNotifyCountChange={setNotificationCount}
          onNavigate={(tab, subTab) => {
            setActiveTab(tab);
            if (subTab) handleSubTabSelect(subTab);
          }}
        />

        <div className="flex-1 min-h-0 relative overflow-hidden">
          <AnimatePresence mode="wait">
            {activeTab === Tab.DASHBOARD && (
              <TabContainer key="dashboard">
                <Dashboard userRole={userRole} allowedSubTabs={allowedSubTabs} requestedSubTab={requestedSubTab} />
              </TabContainer>
            )}

            {activeTab === Tab.FINANCIAL && (
              <TabContainer key="financial">
                <Financial userRole={userRole} allowedSubTabs={allowedSubTabs} requestedSubTab={requestedSubTab} />
              </TabContainer>
            )}

            {activeTab === Tab.ORTHODONTICS && (
              <TabContainer key="orthodontics">
                <Orthodontics userRole={userRole} allowedSubTabs={allowedSubTabs} requestedSubTab={requestedSubTab} />
              </TabContainer>
            )}

            {activeTab === Tab.LABWORK && (
              <TabContainer key="labwork">
                <LabWork userRole={userRole} allowedSubTabs={allowedSubTabs} requestedSubTab={requestedSubTab} userEmail={session.user.email} />
              </TabContainer>
            )}

            {activeTab === Tab.MEETINGS && (
              <TabContainer key="meetings">
                <Meetings requestedSubTab={requestedSubTab} />
              </TabContainer>
            )}

            {activeTab === Tab.SUPPORT && (
              <TabContainer key="support">
                <Support userRole={userRole} allowedSubTabs={allowedSubTabs} />
              </TabContainer>
            )}

            {activeTab === Tab.PASSWORDS && (
              <TabContainer key="passwords">
                <Passwords 
                  requestedSubTab={requestedSubTab} 
                  userRole={userRole} 
                  userEmail={session?.user?.email} 
                />
              </TabContainer>
            )}

            {activeTab === Tab.RESPONSIBILITIES && (
              <TabContainer key="responsibilities">
                <Responsibilities requestedSubTab={requestedSubTab} />
              </TabContainer>
            )}

            {activeTab === Tab.BIBLIOTECA && (
              <TabContainer key="biblioteca">
                <Biblioteca />
              </TabContainer>
            )}
          </AnimatePresence>
        </div>

        {/* Chat Widget FAB */}
        <ChatWidget currentUserId={session.user.id} currentUserName={session.user.email} />
        
        {/* Permissions Modal */}
        <PermissionsModal isOpen={isPermissionsOpen} onClose={() => setIsPermissionsOpen(false)} onlineUsers={onlineUsers} />
      </main>

      <Toaster 
        position="bottom-right" 
        richColors 
        closeButton
        theme={theme}
      />
    </div>
  );
};

export default App;
