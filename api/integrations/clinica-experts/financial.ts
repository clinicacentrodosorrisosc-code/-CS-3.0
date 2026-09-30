import type { ApiRequest, ApiResponse } from '../../../integrations/clinicaExpertsHttp.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const {
      handleClinicaExpertsFinancial,
      handleClinicaExpertsPatients,
      handleClinicaExpertsPaymentSync,
    } = await import('../../../integrations/clinicaExpertsHttp.js');
    if (req.query?.resource === 'patients') {
      return handleClinicaExpertsPatients(req, res);
    }
    if (req.query?.resource === 'payments') {
      return handleClinicaExpertsPaymentSync(req, res);
    }
    return handleClinicaExpertsFinancial(req, res);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Falha ao carregar financeiro.' });
  }
}
