-- Mantem todos os cards da campanha no historico, inclusive os nao enviados.
ALTER TABLE public.whatsapp_bulk_campaign_recipients
  DROP CONSTRAINT IF EXISTS whatsapp_bulk_campaign_recipients_status_check;

ALTER TABLE public.whatsapp_bulk_campaign_recipients
  ADD CONSTRAINT whatsapp_bulk_campaign_recipients_status_check
  CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'skipped'));
