-- Permanent local store for spreadsheet values. Unlike the mirror table, these
-- rows survive a remote card being moved, removed, or re-created during sync.
CREATE TABLE IF NOT EXISTS public.clinic_experts_imported_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opportunity_external_id TEXT NOT NULL,
  patient_external_id TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, opportunity_external_id)
);

CREATE INDEX IF NOT EXISTS idx_ce_imported_data_patient
  ON public.clinic_experts_imported_data(user_id, patient_external_id)
  WHERE patient_external_id IS NOT NULL;

ALTER TABLE public.clinic_experts_imported_data ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ce_imported_data_own ON public.clinic_experts_imported_data;
CREATE POLICY ce_imported_data_own ON public.clinic_experts_imported_data FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

INSERT INTO public.clinic_experts_imported_data (user_id, opportunity_external_id, patient_external_id, data)
SELECT user_id, external_id, patient_external_id,
       jsonb_build_object('patient_phone', COALESCE(local_overrides->>'patient_phone', patient_phone))
FROM public.clinic_experts_opportunities
WHERE length(regexp_replace(COALESCE(local_overrides->>'patient_phone', patient_phone, ''), '[^0-9]', '', 'g')) BETWEEN 12 AND 15
ON CONFLICT (user_id, opportunity_external_id) DO UPDATE
  SET patient_external_id = EXCLUDED.patient_external_id,
      data = public.clinic_experts_imported_data.data || EXCLUDED.data,
      updated_at = NOW();

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
  ), matched AS (
    SELECT opportunity.id, opportunity.external_id, opportunity.patient_external_id, parsed.phone
    FROM parsed JOIN public.clinic_experts_opportunities opportunity ON opportunity.id = parsed.id
    WHERE opportunity.user_id = auth.uid() AND length(parsed.phone) BETWEEN 12 AND 15
  ), saved_imports AS (
    INSERT INTO public.clinic_experts_imported_data (user_id, opportunity_external_id, patient_external_id, data)
    SELECT auth.uid(), external_id, patient_external_id, jsonb_build_object('patient_phone', phone) FROM matched
    ON CONFLICT (user_id, opportunity_external_id) DO UPDATE
      SET patient_external_id = EXCLUDED.patient_external_id, data = public.clinic_experts_imported_data.data || EXCLUDED.data, updated_at = NOW()
    RETURNING opportunity_external_id
  ), updated AS (
    UPDATE public.clinic_experts_opportunities opportunity
    SET patient_phone = matched.phone,
        local_overrides = jsonb_set(COALESCE(opportunity.local_overrides, '{}'::jsonb), '{patient_phone}', to_jsonb(matched.phone), true),
        synced_at = NOW()
    FROM matched
    WHERE opportunity.id = matched.id
      AND length(regexp_replace(COALESCE(opportunity.patient_phone, ''), '[^0-9]', '', 'g')) < 12
    RETURNING opportunity.id
  ) SELECT count(*) INTO v_updated FROM updated;
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.import_clinic_experts_opportunity_phones(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_clinic_experts_opportunity_phones(JSONB) TO authenticated;
