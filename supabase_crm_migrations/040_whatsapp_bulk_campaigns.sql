-- Campanhas manuais com templates aprovados da Meta. Cada destinatario e auditado
-- individualmente para permitir retomada segura e evitar reenvio acidental.

CREATE TABLE IF NOT EXISTS public.whatsapp_bulk_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_name TEXT NOT NULL,
  template_language TEXT NOT NULL DEFAULT 'pt_BR',
  variable_mapping TEXT NOT NULL DEFAULT '',
  pipeline_id UUID REFERENCES public.clinic_experts_pipelines(id) ON DELETE SET NULL,
  stage_id UUID REFERENCES public.clinic_experts_stages(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'completed', 'failed')),
  total_recipients INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.whatsapp_bulk_campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.whatsapp_bulk_campaigns(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES public.clinic_experts_opportunities(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  meta_message_id TEXT,
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  UNIQUE(campaign_id, opportunity_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_bulk_campaign_recipients_ready
  ON public.whatsapp_bulk_campaign_recipients(campaign_id, status, created_at);

ALTER TABLE public.whatsapp_bulk_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_bulk_campaign_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_bulk_campaigns_read_own ON public.whatsapp_bulk_campaigns;
CREATE POLICY whatsapp_bulk_campaigns_read_own ON public.whatsapp_bulk_campaigns
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS whatsapp_bulk_campaign_recipients_read_own ON public.whatsapp_bulk_campaign_recipients;
CREATE POLICY whatsapp_bulk_campaign_recipients_read_own ON public.whatsapp_bulk_campaign_recipients
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.whatsapp_bulk_campaigns campaign
    WHERE campaign.id = campaign_id AND campaign.user_id = auth.uid()
  ));
