export const maxDuration = 60;

export default async function payments(req: any, res: any) {
  try {
    const { handleClinicaExpertsPaymentSync } = await import('../../../integrations/clinicaExpertsHttp.js');
    return handleClinicaExpertsPaymentSync(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao sincronizar pagamentos.';
    return res.status(500).json({ error: message });
  }
}
