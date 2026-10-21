import React from 'react';
import { CRMWorkspace, CRMSection } from './CRMWorkspace';

export { CRMWorkspace } from './CRMWorkspace';
export type { CRMSection } from './CRMWorkspace';

export const PipedrivePipeline: React.FC<{ section?: CRMSection }> = ({ section }) => (
  <CRMWorkspace section={section} />
);
