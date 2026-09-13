import { createClient } from '@supabase/supabase-js';
import { processCrmAutomationQueue } from './crmAutomation.js';

type Request = { method?: string; headers: Record<string, string | string[] | undefined> };
type Response = { status: (code: number) => Response; json: (body: unknown) => void };
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://dmslcvvjxfulsocksave.supabase.co';

export async function handleCrmAutomationQueue(req: Request, res: Response) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Metodo nao permitido.' });
  const authorization = Array.isArray(req.headers.authorization) ? req.headers.authorization[0] : req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET || '';
  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) return res.status(401).json({ error: 'Cron nao autorizado.' });
  const userId = process.env.CLINICA_EXPERTS_OWNER_USER_ID || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!userId || !serviceRoleKey) return res.status(503).json({ error: 'Fila de automacao nao configurada.' });
  try {
    const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const result = await processCrmAutomationQueue(db, userId, 10);
    return res.status(200).json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao processar fila.';
    return res.status(500).json({ error: message });
  }
}
