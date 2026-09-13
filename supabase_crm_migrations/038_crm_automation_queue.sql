-- Fila persistente para os envios de automação do CRM.

ALTER TABLE public.crm_automation_executions
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

ALTER TABLE public.crm_automation_executions
  DROP CONSTRAINT IF EXISTS crm_automation_executions_status_check;

ALTER TABLE public.crm_automation_executions
  ADD CONSTRAINT crm_automation_executions_status_check
  CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'skipped'));

CREATE INDEX IF NOT EXISTS idx_crm_automation_queue_ready
  ON public.crm_automation_executions(user_id, available_at, created_at)
  WHERE status IN ('pending', 'failed', 'processing');

CREATE OR REPLACE FUNCTION public.claim_crm_automation_executions(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  flow_id UUID,
  user_id UUID,
  opportunity_id UUID,
  trigger_stage_id UUID,
  template_name TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH candidates AS (
    SELECT execution.id
    FROM public.crm_automation_executions AS execution
    WHERE execution.user_id = p_user_id
      AND (
        (execution.status = 'pending' AND execution.available_at <= NOW())
        OR (execution.status = 'failed' AND execution.attempts < 3 AND execution.available_at <= NOW())
        OR (execution.status = 'processing' AND (execution.locked_at IS NULL OR execution.locked_at < NOW() - INTERVAL '5 minutes'))
      )
    ORDER BY execution.available_at, execution.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(1, LEAST(p_limit, 10))
  )
  UPDATE public.crm_automation_executions AS execution
  SET status = 'processing',
      attempts = execution.attempts + 1,
      locked_at = NOW(),
      error_message = NULL
  FROM candidates
  WHERE execution.id = candidates.id
  RETURNING execution.id, execution.flow_id, execution.user_id, execution.opportunity_id, execution.trigger_stage_id, execution.template_name;
$$;

GRANT EXECUTE ON FUNCTION public.claim_crm_automation_executions(UUID, INTEGER) TO authenticated, service_role;
