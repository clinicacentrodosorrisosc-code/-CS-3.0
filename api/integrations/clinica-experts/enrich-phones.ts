export const maxDuration = 60;

export default async function enrichPhones(req: any, res: any) {
  try {
    const { handleClinicaExpertsPhoneEnrichment } = await import('../../../integrations/clinicaExpertsHttp.js');
    return handleClinicaExpertsPhoneEnrichment(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao atualizar telefones.';
    return res.status(500).json({ error: message });
  }
}
