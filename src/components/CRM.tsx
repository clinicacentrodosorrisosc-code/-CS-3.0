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

  let content: React.ReactNode;

  if (activeView === 'whatsapp') {
    content = <WhatsAppSettings />;
  } else if (activeView === 'reactivation') {
    content = <BudgetReactivation />;
  } else {
    // This is the same workspace rendered by the isolated preview.  The
    // integration boundary below only prevents the application shell's
    // generic component styles from changing the CRM's measured layout.
    content = <CRMWorkspace key={activeView} section={activeView as CRMSection} />;
  }

  return <section className="crm-integrated-workspace" aria-label="CRM">{content}</section>;
};
