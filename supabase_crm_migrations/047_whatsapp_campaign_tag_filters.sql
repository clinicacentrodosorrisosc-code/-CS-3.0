-- Mantem o criterio de tag usado no disparo para que relatorios posteriores
-- nao adicionem cards fora do publico originalmente escolhido.
ALTER TABLE public.whatsapp_bulk_campaigns
  ADD COLUMN IF NOT EXISTS tag_filter_mode TEXT NOT NULL DEFAULT 'all'
    CHECK (tag_filter_mode IN ('all', 'include', 'exclude')),
  ADD COLUMN IF NOT EXISTS tag_filter_value TEXT;

COMMENT ON COLUMN public.whatsapp_bulk_campaigns.tag_filter_mode IS
  'all, include ou exclude: criterio de tag aplicado ao publico da campanha.';

COMMENT ON COLUMN public.whatsapp_bulk_campaigns.tag_filter_value IS
  'Nome da tag usada como criterio de inclusao ou exclusao da campanha.';
