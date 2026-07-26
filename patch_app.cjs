const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Replace TabContainer definition
const tabContainerRegex = /const TabContainer = \(\{ isActive, children \}: \{ isActive: boolean, children: React\.ReactNode \}\) => \{[\s\S]*?return \([\s\S]*?<motion\.div[\s\S]*?className="absolute inset-0 flex flex-col"[\s\S]*?>[\s\S]*?\{children\}[\s\S]*?<\/motion\.div>[\s\S]*?\);[\s\S]*?\};/;

const newTabContainer = `const TabContainer = ({ children }: { children: React.ReactNode }) => {
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
};`;

content = content.replace(tabContainerRegex, newTabContainer);

// Replace visitedTabs state
content = content.replace(/const \[visitedTabs, setVisitedTabs\] = useState<Record<string, boolean>>\(\{\}\);\s*useEffect\(\(\) => \{\s*if \(activeTab\) \{\s*setVisitedTabs\(prev => \{\s*if \(prev\[activeTab\]\) return prev;\s*return \{ \.\.\.prev, \[activeTab\]: true \};\s*\}\);\s*\}\s*\}, \[activeTab\]\);/g, '');

// Replace rendering logic
const renderingRegex = /\{visitedTabs\[Tab\.DASHBOARD\] && \([\s\S]*?\{visitedTabs\[Tab\.BIBLIOTECA\] && \([\s\S]*?<\/TabContainer>\s*\)\}/;

const newRendering = `<AnimatePresence mode="wait">
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
              <LabWork userRole={userRole} allowedSubTabs={allowedSubTabs} requestedSubTab={requestedSubTab} />
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
              <Passwords />
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
        </AnimatePresence>`;

content = content.replace(renderingRegex, newRendering);

fs.writeFileSync('src/App.tsx', content);
