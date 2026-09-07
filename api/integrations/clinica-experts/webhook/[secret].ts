export const maxDuration = 60;

export default async function webhook(req: any, res: any) {
  try {
    const { handleClinicaExpertsWebhook } = await import('../../../../integrations/clinicaExpertsHttp.js');
    return handleClinicaExpertsWebhook(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao processar webhook.';
    return res.status(500).json({ error: message });
  }
}
