-- Permite campanhas Meta a partir da carteira de reativacao de orcamentos.
ALTER TABLE public.whatsapp_bulk_campaigns
  DROP CONSTRAINT IF EXISTS whatsapp_bulk_campaigns_source_check;

ALTER TABLE public.whatsapp_bulk_campaigns
  ADD CONSTRAINT whatsapp_bulk_campaigns_source_check
  CHECK (source IN ('crm', 'orthodontics', 'contact_list', 'budget_reactivation'));

ALTER TABLE public.whatsapp_bulk_campaign_recipients
  ADD COLUMN IF NOT EXISTS budget_reactivation_lead_id UUID
  REFERENCES public.budget_reactivation_leads(id) ON DELETE CASCADE;

ALTER TABLE public.whatsapp_bulk_campaign_recipients
  DROP CONSTRAINT IF EXISTS whatsapp_bulk_campaign_recipients_target_check;

ALTER TABLE public.whatsapp_bulk_campaign_recipients
  ADD CONSTRAINT whatsapp_bulk_campaign_recipients_target_check
  CHECK (num_nonnulls(opportunity_id, ortho_patient_id, contact_list_contact_id, budget_reactivation_lead_id) = 1);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_campaign_budget_reactivation_recipient
  ON public.whatsapp_bulk_campaign_recipients(campaign_id, budget_reactivation_lead_id)
  WHERE budget_reactivation_lead_id IS NOT NULL;
