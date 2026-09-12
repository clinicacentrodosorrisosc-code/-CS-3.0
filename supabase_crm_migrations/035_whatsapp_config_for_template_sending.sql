-- Configuração mínima do canal oficial Meta para envio de templates.
-- Pode ser aplicada com segurança mesmo se a tabela já existir.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.whatsapp_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number_id TEXT NOT NULL,
  waba_id TEXT,
  access_token TEXT,
  access_token_encrypted TEXT,
  verify_token TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected')),
  connected_at TIMESTAMPTZ,
  registered_at TIMESTAMPTZ,
  subscribed_apps_at TIMESTAMPTZ,
  last_registration_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS access_token_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS registered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscribed_apps_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_registration_error TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.whatsapp_config
  ALTER COLUMN access_token DROP NOT NULL;

ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own config" ON public.whatsapp_config;
CREATE POLICY "Users can manage own config" ON public.whatsapp_config
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
