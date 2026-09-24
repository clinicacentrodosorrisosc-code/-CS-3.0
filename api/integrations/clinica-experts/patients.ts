import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { handleClinicaExpertsPatients } = await import('../../../integrations/clinicaExpertsHttp.js');
    return handleClinicaExpertsPatients(req, res);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Falha ao carregar pacientes.' });
  }
}
