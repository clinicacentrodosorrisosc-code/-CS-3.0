import React, { useState } from 'react';
import { 
  Megaphone, FileText, 
  Lightbulb, BookOpen
} from 'lucide-react';
import { CampaignCalendar } from './Management/CampaignCalendar';
import { MeetingMinutes } from './Management/MeetingMinutes';
import { ClinicIdeas } from './ClinicIdeas';
import { SalesPlaybook } from './Management/SalesPlaybook';
import { PageHeader } from './ui/operational-ui';

interface MeetingsProps {
  requestedSubTab?: string | null;
}

const SUB_TABS = [
  { 
    id: 'campaign_calendar', 
    label: 'Calendário de Campanhas', 
    icon: Megaphone,
    description: 'Planejamento e metas das campanhas mensais de marketing'
  },
  { 
    id: 'meeting_minutes', 
    label: 'Atas de Reuniões', 
    icon: FileText,
    description: 'Registro oficial de reuniões de equipe e planos de ação'
  },
  { 
    id: 'clinic_ideas', 
    label: 'Ideias & Melhorias', 
    icon: Lightbulb,
    description: 'Incubadora de sugestões e inovações para a clínica'
  },
  { 
    id: 'sales_playbook', 
    label: 'Playbook & Scripts', 
    icon: BookOpen,
    description: 'Quebra de objeções, roteiros de WhatsApp e técnicas de fechamento'
  }
] as const;

export const Meetings: React.FC<MeetingsProps> = ({ requestedSubTab }) => {
  const [selectedSubTab, setSelectedSubTab] = useState<string>('campaign_calendar');

  // Derive active tab to prevent cascading setState inside useEffect
  const activeSubTab = requestedSubTab || selectedSubTab;

  const currentTabInfo = SUB_TABS.find(t => t.id === activeSubTab) || SUB_TABS[0];

  return (
    <div className="flex-1 flex flex-col w-full h-full bg-transparent text-slate-300 font-sans overflow-hidden">
      {/* Main Scrollable Area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 custom-scrollbar relative z-10 w-full space-y-6">
        
        <PageHeader
          icon={currentTabInfo.icon}
          title={currentTabInfo.label}
          description={currentTabInfo.description}
          tabs={(
            <div className="module-segmented-control no-scrollbar" role="tablist" aria-label="Áreas de gestão e comercial">
              {SUB_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeSubTab === tab.id;
                return (
                  <button key={tab.id} type="button" role="tab" aria-selected={isActive} data-active={isActive} onClick={() => setSelectedSubTab(tab.id)}>
                    <Icon className="size-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        />

        {/* Content Container */}
        <div className="relative z-10 pt-2">
          {activeSubTab === 'campaign_calendar' && <CampaignCalendar />}
          {activeSubTab === 'meeting_minutes' && <MeetingMinutes />}
          {activeSubTab === 'clinic_ideas' && <ClinicIdeas />}
          {activeSubTab === 'sales_playbook' && <SalesPlaybook />}
        </div>
      </div>
    </div>
  );
};
