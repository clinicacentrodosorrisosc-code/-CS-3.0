export default async function config(req: any, res: any) {
  try {
    const { handleWhatsAppCallingEligibility, handleWhatsAppConfig } = await import('../../../integrations/whatsappHttp.js');
    if (req.query?.check === 'calling') return handleWhatsAppCallingEligibility(req, res);
    return handleWhatsAppConfig(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha na configuracao do WhatsApp.';
    return res.status(500).json({ error: message });
  }
}
