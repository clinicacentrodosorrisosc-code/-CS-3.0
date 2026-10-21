import React, { useEffect, useState } from 'react';
import { BudgetReactivation } from './BudgetReactivation';
import { WhatsAppSettings } from './WhatsAppSettings';
import { PipedrivePipeline } from './PipedrivePipeline';

type CRMProps = {
  requestedSubTab?: string | null;
};

type CRMView = 'deals' | 'leads' | 'contacts' | 'activities' | 'reactivation' | 'whatsapp';

const resolveView = (requestedSubTab?: string | null): CRMView => (
  requestedSubTab === 'whatsapp'
    ? 'whatsapp'
    : requestedSubTab === 'reactivation'
      ? 'reactivation'
      : requestedSubTab === 'leads' || requestedSubTab === 'contacts' || requestedSubTab === 'activities'
        ? requestedSubTab
        : 'deals'
);

export const CRM: React.FC<CRMProps> = ({ requestedSubTab }) => {
  const [activeView, setActiveView] = useState<CRMView>(() => resolveView(requestedSubTab));

  useEffect(() => {
    setActiveView(resolveView(requestedSubTab));
  }, [requestedSubTab]);

  if (activeView === 'whatsapp') return <WhatsAppSettings />;
  if (activeView === 'reactivation') return <BudgetReactivation />;
  return <PipedrivePipeline key={activeView} section={activeView} />;
};
