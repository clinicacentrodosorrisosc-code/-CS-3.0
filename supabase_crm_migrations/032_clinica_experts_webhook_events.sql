-- Eventos recebidos do Clinica Experts para auditoria e idempotencia.
-- Execute depois de 031_clinica_experts_sync.sql.

CREATE TABLE IF NOT EXISTS clinic_experts_webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  event_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'processed', 'ignored', 'failed')),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (user_id, event_key)
);

CREATE INDEX IF NOT EXISTS idx_ce_webhook_events_user_received
  ON clinic_experts_webhook_events(user_id, received_at DESC);

ALTER TABLE clinic_experts_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ce_webhook_events_own ON clinic_experts_webhook_events;
CREATE POLICY ce_webhook_events_own ON clinic_experts_webhook_events FOR SELECT
  USING (auth.uid() = user_id);
