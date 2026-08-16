import React, { useState } from 'react';
import { 
  Megaphone, FileText, 
  Lightbulb, BookOpen, Sparkles
} from 'lucide-react';
import { CampaignCalendar } from './Management/CampaignCalendar';
import { MeetingMinutes } from './Management/MeetingMinutes';
import { ClinicIdeas } from './ClinicIdeas';
import { SalesPlaybook } from './Management/SalesPlaybook';

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
        
        {/* Top Header & Context */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-black uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Módulo Executivo • Gestão & Comercial</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-text tracking-tight">
              {currentTabInfo.label}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              {currentTabInfo.description}
            </p>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold font-mono">
              {SUB_TABS.length} Módulos Integrados
            </span>
          </div>
        </div>

        {/* Sub Navigation Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          {SUB_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setSelectedSubTab(tab.id)}
                className={`
                  flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap border
                  ${isActive 
                    ? 'bg-blue-600 text-white border-blue-500 shadow-sm shadow-blue-600/30' 
                    : 'bg-panel/80 text-slate-400 border-border hover:text-white hover:border-white/20 hover:bg-panel'}
                `}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-blue-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

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
