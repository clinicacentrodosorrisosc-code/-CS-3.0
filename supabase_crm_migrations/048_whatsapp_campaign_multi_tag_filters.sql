-- Uma campanha pode preservar mais de uma tag como regra do publico.
ALTER TABLE public.whatsapp_bulk_campaigns
  ADD COLUMN IF NOT EXISTS tag_filter_values TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE public.whatsapp_bulk_campaigns
SET tag_filter_values = ARRAY[tag_filter_value]
WHERE COALESCE(array_length(tag_filter_values, 1), 0) = 0
  AND tag_filter_value IS NOT NULL
  AND btrim(tag_filter_value) <> '';

COMMENT ON COLUMN public.whatsapp_bulk_campaigns.tag_filter_values IS
  'Tags usadas no criterio de inclusao ou exclusao da campanha; qualquer uma delas satisfaz a regra.';
