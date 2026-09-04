export default async function status(req: any, res: any) {
  try {
    const { handleClinicaExpertsStatus } = await import('../../../integrations/clinicaExpertsHttp.js');
    return handleClinicaExpertsStatus(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao iniciar integracao.';
    return res.status(500).json({ error: message });
  }
}
