export const maxDuration = 60;

export default async function processQueue(req: any, res: any) {
  const { handleCrmAutomationQueue } = await import('../../../integrations/crmAutomationHttp.js');
  return handleCrmAutomationQueue(req, res);
}
