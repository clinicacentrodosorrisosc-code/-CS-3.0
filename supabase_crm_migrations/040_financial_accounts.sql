-- Contas de recebimento do módulo financeiro.
-- Não reutiliza public.accounts, que representa a organização/tenancy do CRM.

CREATE TABLE IF NOT EXISTS public.financial_accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  bank TEXT NOT NULL,
  initial_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'checking',
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso total financial_accounts" ON public.financial_accounts;
CREATE POLICY "Acesso total financial_accounts"
  ON public.financial_accounts FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
