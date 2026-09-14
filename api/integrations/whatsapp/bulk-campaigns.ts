export const maxDuration = 60;

export default async function bulkCampaigns(req: any, res: any) {
  const { handleWhatsAppBulkCampaigns } = await import('../../../integrations/whatsappBulkCampaignsHttp.js');
  return handleWhatsAppBulkCampaigns(req, res);
}
