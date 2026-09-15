-- Selecao explicita de destinatarios e identificacao dos leads impactados.
ALTER TABLE public.clinic_experts_opportunities
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE public.whatsapp_bulk_campaigns
  ADD COLUMN IF NOT EXISTS success_tag TEXT;

CREATE INDEX IF NOT EXISTS idx_ce_opportunities_tags
  ON public.clinic_experts_opportunities USING GIN(tags);

COMMENT ON COLUMN public.clinic_experts_opportunities.tags IS
  'Marcadores locais do CRM, preservados nas sincronizacoes da Clinica Experts.';

COMMENT ON COLUMN public.whatsapp_bulk_campaigns.success_tag IS
  'Tag aplicada ao card somente quando a Meta aceita o envio do destinatario.';
