export const maxDuration = 60;
export default async function reconciliation(req: any, res: any) {
  try {
    const { handleClinicaExpertsCrmReconciliation } = await import('../../../integrations/clinicaExpertsHttp.js');
    return handleClinicaExpertsCrmReconciliation(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao reconciliar CRM.';
    return res.status(500).json({ error: message });
  }
}
