-- Fluxos visuais do CRM da Clínica Experts.
-- A execução automática será feita pelo backend; o navegador apenas cria e edita definições.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.crm_automation_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  edges JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_crm_automation_flows_user
  ON public.crm_automation_flows(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_automation_flows_active
  ON public.crm_automation_flows(user_id)
  WHERE is_active = TRUE;

ALTER TABLE public.crm_automation_flows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_automation_flows_own ON public.crm_automation_flows;
CREATE POLICY crm_automation_flows_own ON public.crm_automation_flows
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
