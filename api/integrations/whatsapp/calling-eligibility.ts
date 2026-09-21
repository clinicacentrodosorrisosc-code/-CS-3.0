export default async function callingEligibility(req: any, res: any) {
  try {
    const { handleWhatsAppCallingEligibility } = await import('../../../integrations/whatsappHttp.js');
    return handleWhatsAppCallingEligibility(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao verificar chamadas do WhatsApp.';
    return res.status(500).json({ error: message });
  }
}
