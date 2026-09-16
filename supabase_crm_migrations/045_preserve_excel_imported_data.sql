-- Imported spreadsheet values are local business data, not API mirror data.
-- Keep them in an override payload so a later Clínica Experts sync cannot erase them.
ALTER TABLE public.clinic_experts_opportunities
  ADD COLUMN IF NOT EXISTS local_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Preserve the numbers already imported before this change as local values too.
UPDATE public.clinic_experts_opportunities
SET local_overrides = jsonb_set(COALESCE(local_overrides, '{}'::jsonb), '{patient_phone}', to_jsonb(patient_phone), true)
WHERE patient_phone IS NOT NULL
  AND length(regexp_replace(patient_phone, '[^0-9]', '', 'g')) BETWEEN 12 AND 15
  AND NOT (COALESCE(local_overrides, '{}'::jsonb) ? 'patient_phone');

CREATE OR REPLACE FUNCTION public.import_clinic_experts_opportunity_phones(p_updates JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE v_updated INTEGER;
BEGIN
  WITH parsed AS (
    SELECT NULLIF(item->>'id', '')::UUID AS id,
           regexp_replace(COALESCE(item->>'phone', ''), '[^0-9]', '', 'g') AS phone
    FROM jsonb_array_elements(COALESCE(p_updates, '[]'::jsonb)) item
  ), updated AS (
    UPDATE public.clinic_experts_opportunities opportunity
    SET patient_phone = parsed.phone,
        local_overrides = jsonb_set(COALESCE(opportunity.local_overrides, '{}'::jsonb), '{patient_phone}', to_jsonb(parsed.phone), true),
        synced_at = NOW()
    FROM parsed
    WHERE opportunity.id = parsed.id
      AND opportunity.user_id = auth.uid()
      AND length(parsed.phone) BETWEEN 12 AND 15
      AND length(regexp_replace(COALESCE(opportunity.patient_phone, ''), '[^0-9]', '', 'g')) < 12
    RETURNING opportunity.id
  ) SELECT count(*) INTO v_updated FROM updated;
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.import_clinic_experts_opportunity_phones(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_clinic_experts_opportunity_phones(JSONB) TO authenticated;
