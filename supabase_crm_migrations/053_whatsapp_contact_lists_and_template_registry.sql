-- Listas independentes de contatos e registro local do ciclo de templates Meta.
-- A migracao preserva campanhas CRM/Ortodontia existentes e adiciona a origem
-- contact_list como terceiro publico permitido.

ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS meta_app_id TEXT;

CREATE TABLE IF NOT EXISTS public.whatsapp_contact_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  source_file_name TEXT,
  total_contacts INTEGER NOT NULL DEFAULT 0,
  valid_contacts INTEGER NOT NULL DEFAULT 0,
  invalid_contacts INTEGER NOT NULL DEFAULT 0,
  duplicate_contacts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_contact_list_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.whatsapp_contact_lists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  normalized_phone TEXT NOT NULL DEFAULT '',
  email TEXT,
  custom_fields JSONB NOT NULL DEFAULT '{}'::JSONB,
  status TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'invalid', 'duplicate')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_contact_lists_user_created
  ON public.whatsapp_contact_lists(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_contact_list_contacts_list_status
  ON public.whatsapp_contact_list_contacts(list_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_whatsapp_contact_list_contacts_phone
  ON public.whatsapp_contact_list_contacts(list_id, normalized_phone)
  WHERE normalized_phone <> '';

ALTER TABLE public.whatsapp_bulk_campaigns
  DROP CONSTRAINT IF EXISTS whatsapp_bulk_campaigns_source_check;

ALTER TABLE public.whatsapp_bulk_campaigns
  ADD CONSTRAINT whatsapp_bulk_campaigns_source_check
  CHECK (source IN ('crm', 'orthodontics', 'contact_list'));

ALTER TABLE public.whatsapp_bulk_campaigns
  ADD COLUMN IF NOT EXISTS contact_list_id UUID
  REFERENCES public.whatsapp_contact_lists(id) ON DELETE SET NULL;

ALTER TABLE public.whatsapp_bulk_campaign_recipients
  ADD COLUMN IF NOT EXISTS contact_list_contact_id UUID
  REFERENCES public.whatsapp_contact_list_contacts(id) ON DELETE RESTRICT;

ALTER TABLE public.whatsapp_bulk_campaign_recipients
  DROP CONSTRAINT IF EXISTS whatsapp_bulk_campaign_recipients_target_check;

ALTER TABLE public.whatsapp_bulk_campaign_recipients
  ADD CONSTRAINT whatsapp_bulk_campaign_recipients_target_check
  CHECK (num_nonnulls(opportunity_id, ortho_patient_id, contact_list_contact_id) = 1);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_campaign_contact_list_recipient
  ON public.whatsapp_bulk_campaign_recipients(campaign_id, contact_list_contact_id)
  WHERE contact_list_contact_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.whatsapp_template_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meta_template_id TEXT,
  name TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'pt_BR',
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  quality_score JSONB,
  components JSONB NOT NULL DEFAULT '[]'::JSONB,
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, name, language)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_template_registry_user_status
  ON public.whatsapp_template_registry(user_id, status, updated_at DESC);

ALTER TABLE public.whatsapp_contact_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_contact_list_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_template_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_contact_lists_own ON public.whatsapp_contact_lists;
CREATE POLICY whatsapp_contact_lists_own ON public.whatsapp_contact_lists
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS whatsapp_contact_list_contacts_own ON public.whatsapp_contact_list_contacts;
CREATE POLICY whatsapp_contact_list_contacts_own ON public.whatsapp_contact_list_contacts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS whatsapp_template_registry_own ON public.whatsapp_template_registry;
CREATE POLICY whatsapp_template_registry_own ON public.whatsapp_template_registry
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.whatsapp_contact_lists IS
  'Listas importadas pelo usuario para campanhas oficiais do WhatsApp.';

COMMENT ON TABLE public.whatsapp_template_registry IS
  'Espelho local do status e dos componentes dos templates submetidos a Meta.';
