import React, { useEffect, useState } from 'react';
import { BudgetReactivation } from './BudgetReactivation';
import { WhatsAppSettings } from './WhatsAppSettings';
import { CRMWorkspace, type CRMSection } from './CRMWorkspace';

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
  // Render the exact same workspace used by the isolated CRM preview. Keeping
  // this direct avoids a parallel presentation layer between the application
  // CRM route and the verified pipeline/detail implementation.
  return <CRMWorkspace key={activeView} section={activeView as CRMSection} />;
};
