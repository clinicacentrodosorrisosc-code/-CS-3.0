-- Auditoria e trava de idempotência das automações do CRM.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.crm_automation_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES public.crm_automation_flows(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES public.clinic_experts_opportunities(id) ON DELETE CASCADE,
  trigger_stage_id UUID NOT NULL REFERENCES public.clinic_experts_stages(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'sent', 'failed', 'skipped')),
  template_name TEXT,
  meta_message_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  UNIQUE(flow_id, opportunity_id, trigger_stage_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_automation_executions_user_created
  ON public.crm_automation_executions(user_id, created_at DESC);

ALTER TABLE public.crm_automation_executions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_automation_executions_read_own ON public.crm_automation_executions;
CREATE POLICY crm_automation_executions_read_own ON public.crm_automation_executions
  FOR SELECT USING (auth.uid() = user_id);
