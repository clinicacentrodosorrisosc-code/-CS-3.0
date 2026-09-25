import type { ApiRequest, ApiResponse } from '../../../integrations/clinicaExpertsHttp.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const { handleClinicaExpertsFinancial } = await import('../../../integrations/clinicaExpertsHttp.js');
    return handleClinicaExpertsFinancial(req, res);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Falha ao carregar financeiro.' });
  }
}
