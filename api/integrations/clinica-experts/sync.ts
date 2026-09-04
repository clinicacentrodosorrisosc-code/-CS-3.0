export const maxDuration = 60;
export default async function sync(req: any, res: any) {
  try {
    const { handleClinicaExpertsSync } = await import('../../../integrations/clinicaExpertsHttp.js');
    return handleClinicaExpertsSync(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao iniciar integracao.';
    return res.status(500).json({ error: message });
  }
}
