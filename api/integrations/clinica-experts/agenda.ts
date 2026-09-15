import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { handleClinicaExpertsAgenda } = await import('../../../integrations/clinicaExpertsHttp.js');
    return handleClinicaExpertsAgenda(req, res);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Falha ao carregar agenda.' });
  }
}
