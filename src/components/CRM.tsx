import React, { useEffect, useState } from 'react';
import { BudgetReactivation } from './BudgetReactivation';
import { WhatsAppSettings } from './WhatsAppSettings';

type CRMProps = {
  requestedSubTab?: string | null;
};

type RelationshipView = 'reactivation' | 'whatsapp';

const resolveView = (requestedSubTab?: string | null): RelationshipView => (
  requestedSubTab === 'whatsapp' ? 'whatsapp' : 'reactivation'
);

export const CRM: React.FC<CRMProps> = ({ requestedSubTab }) => {
  const [activeView, setActiveView] = useState<RelationshipView>(() => resolveView(requestedSubTab));

  useEffect(() => {
    setActiveView(resolveView(requestedSubTab));
  }, [requestedSubTab]);

  return activeView === 'whatsapp' ? <WhatsAppSettings /> : <BudgetReactivation />;
};
