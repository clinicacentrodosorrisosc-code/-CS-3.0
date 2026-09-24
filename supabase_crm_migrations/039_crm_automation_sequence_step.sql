ALTER TABLE public.crm_automation_executions
  ADD COLUMN IF NOT EXISTS step INTEGER NOT NULL DEFAULT 1;
