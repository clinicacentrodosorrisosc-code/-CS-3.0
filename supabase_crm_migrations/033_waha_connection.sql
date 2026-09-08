-- WAHA como provedor adicional de WhatsApp.
-- As credenciais ficam somente nas variaveis do servidor; o banco guarda
-- apenas o nome da sessao e o estado operacional de cada usuario.

ALTER TABLE public.whatsapp_config
  ALTER COLUMN phone_number_id DROP NOT NULL,
  ALTER COLUMN access_token DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'meta'
    CHECK (provider IN ('meta', 'waha')),
  ADD COLUMN IF NOT EXISTS waha_session_name TEXT,
  ADD COLUMN IF NOT EXISTS waha_status TEXT,
  ADD COLUMN IF NOT EXISTS waha_last_error TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_config_waha_session_name_key
  ON public.whatsapp_config (waha_session_name)
  WHERE waha_session_name IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.waha_webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, event_key)
);

ALTER TABLE public.waha_webhook_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS waha_webhook_events_own ON public.waha_webhook_events;
CREATE POLICY waha_webhook_events_own ON public.waha_webhook_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS messages_conversation_message_id_key
  ON public.messages (conversation_id, message_id)
  WHERE message_id IS NOT NULL;
