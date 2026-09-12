export default async function templates(req: any, res: any) {
  try {
    const { handleWhatsAppTemplates } = await import('../../../integrations/whatsappHttp.js');
    return handleWhatsAppTemplates(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao atualizar templates do WhatsApp.';
    return res.status(500).json({ error: message });
  }
}
