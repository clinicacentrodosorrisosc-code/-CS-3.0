-- Keeps the external Clínica Experts records intact while hiding the local
-- duplicate after a reviewed merge. Sync upserts do not overwrite these fields.
ALTER TABLE public.clinic_experts_opportunities
  ADD COLUMN IF NOT EXISTS merged_into_id UUID REFERENCES public.clinic_experts_opportunities(id),
  ADD COLUMN IF NOT EXISTS merged_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_ce_opportunities_merged_into
  ON public.clinic_experts_opportunities(user_id, merged_into_id);

CREATE OR REPLACE FUNCTION public.merge_clinic_experts_opportunities(
  p_survivor_id UUID,
  p_duplicate_id UUID,
  p_values JSONB
) RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_survivor public.clinic_experts_opportunities%ROWTYPE;
  v_duplicate public.clinic_experts_opportunities%ROWTYPE;
BEGIN
  IF p_survivor_id IS NULL OR p_duplicate_id IS NULL OR p_survivor_id = p_duplicate_id THEN
    RAISE EXCEPTION 'Escolha dois cards diferentes para mesclar.';
  END IF;

  SELECT * INTO v_survivor FROM public.clinic_experts_opportunities
    WHERE id = p_survivor_id AND user_id = auth.uid() AND merged_into_id IS NULL FOR UPDATE;
  SELECT * INTO v_duplicate FROM public.clinic_experts_opportunities
    WHERE id = p_duplicate_id AND user_id = auth.uid() AND merged_into_id IS NULL FOR UPDATE;
  IF NOT FOUND OR v_survivor.id IS NULL OR v_duplicate.id IS NULL THEN
    RAISE EXCEPTION 'Um dos cards não está disponível para mesclagem.';
  END IF;

  UPDATE public.clinic_experts_opportunities SET
    title = COALESCE(p_values->>'title', title),
    patient_name = COALESCE(p_values->>'patient_name', patient_name),
    patient_phone = COALESCE(p_values->>'patient_phone', patient_phone),
    patient_email = COALESCE(p_values->>'patient_email', patient_email),
    seller_name = COALESCE(p_values->>'seller_name', seller_name),
    origin = COALESCE(p_values->>'origin', origin),
    observations = COALESCE(p_values->>'observations', observations),
    status = COALESCE(p_values->>'status', status),
    priority = COALESCE((p_values->>'priority')::INTEGER, priority),
    amount_cents = COALESCE((p_values->>'amount_cents')::INTEGER, amount_cents),
    tags = CASE WHEN jsonb_typeof(p_values->'tags') = 'array' THEN ARRAY(SELECT jsonb_array_elements_text(p_values->'tags')) ELSE tags END,
    synced_at = NOW()
  WHERE id = p_survivor_id AND user_id = auth.uid();

  UPDATE public.clinic_experts_opportunities
    SET merged_into_id = p_survivor_id, merged_at = NOW()
    WHERE id = p_duplicate_id AND user_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.merge_clinic_experts_opportunities(UUID, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_clinic_experts_opportunities(UUID, UUID, JSONB) TO authenticated;
