-- Corrige a conversao anterior: o texto ja foi preservado em local_overrides,
-- mas precisa aparecer tambem na coluna de observacoes do CRM.
UPDATE public.clinic_experts_opportunities
SET observations = NULLIF(local_overrides->>'observations', '')
WHERE observations IS NULL
  AND COALESCE(local_overrides->>'observations', '') LIKE 'Marcadores CRM:%';
