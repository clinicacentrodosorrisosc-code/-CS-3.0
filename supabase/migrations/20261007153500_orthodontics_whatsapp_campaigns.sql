-- Permite usar a infraestrutura oficial de campanhas do WhatsApp também para
-- lembretes de mensalidade dos pacientes de ortodontia.

ALTER TABLE public.whatsapp_bulk_campaigns
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'crm'
    CHECK (source IN ('crm', 'orthodontics')),
  ADD COLUMN IF NOT EXISTS payment_month TEXT;

ALTER TABLE public.whatsapp_bulk_campaign_recipients
  ADD COLUMN IF NOT EXISTS ortho_patient_id TEXT REFERENCES public.ortho_patients(id) ON DELETE CASCADE;

ALTER TABLE public.whatsapp_bulk_campaign_recipients
  ALTER COLUMN opportunity_id DROP NOT NULL;

ALTER TABLE public.whatsapp_bulk_campaign_recipients
  DROP CONSTRAINT IF EXISTS whatsapp_bulk_campaign_recipients_target_check;

ALTER TABLE public.whatsapp_bulk_campaign_recipients
  ADD CONSTRAINT whatsapp_bulk_campaign_recipients_target_check
  CHECK (num_nonnulls(opportunity_id, ortho_patient_id) = 1);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_campaign_ortho_recipient
  ON public.whatsapp_bulk_campaign_recipients(campaign_id, ortho_patient_id)
  WHERE ortho_patient_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_campaigns_source_created
  ON public.whatsapp_bulk_campaigns(user_id, source, created_at DESC);

COMMENT ON COLUMN public.whatsapp_bulk_campaigns.source IS
  'Origem do publico da campanha: crm ou orthodontics.';

COMMENT ON COLUMN public.whatsapp_bulk_campaigns.payment_month IS
  'Competencia YYYY-MM usada nos lembretes de pagamento da ortodontia.';

COMMENT ON COLUMN public.whatsapp_bulk_campaign_recipients.ortho_patient_id IS
  'Paciente de ortodontia destinatario da campanha, quando source=orthodontics.';
