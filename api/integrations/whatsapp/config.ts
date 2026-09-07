export default async function config(req: any, res: any) {
  try {
    const { handleWhatsAppConfig } = await import('../../../integrations/whatsappHttp.js');
    return handleWhatsAppConfig(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha na configuracao do WhatsApp.';
    return res.status(500).json({ error: message });
  }
}
