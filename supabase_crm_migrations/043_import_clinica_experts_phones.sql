-- Atualiza em lote apenas cards do usuario autenticado que ainda nao possuem
-- telefone valido. O relacionamento nome -> card e conferido na interface.
CREATE OR REPLACE FUNCTION public.import_clinic_experts_opportunity_phones(p_updates JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER := 0;
BEGIN
  IF jsonb_typeof(COALESCE(p_updates, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'A lista de telefones e invalida.';
  END IF;

  WITH parsed AS (
    SELECT DISTINCT ON (input.id)
      input.id,
      CASE
        WHEN length(regexp_replace(COALESCE(input.phone, ''), '[^0-9]', '', 'g')) IN (10, 11)
          THEN '55' || regexp_replace(input.phone, '[^0-9]', '', 'g')
        ELSE regexp_replace(COALESCE(input.phone, ''), '[^0-9]', '', 'g')
      END AS phone
    FROM jsonb_to_recordset(COALESCE(p_updates, '[]'::jsonb)) AS input(id UUID, phone TEXT)
    WHERE input.id IS NOT NULL
  ), updated AS (
    UPDATE public.clinic_experts_opportunities opportunity
    SET patient_phone = parsed.phone,
        synced_at = NOW()
    FROM parsed
    WHERE opportunity.id = parsed.id
      AND opportunity.user_id = auth.uid()
      AND length(parsed.phone) BETWEEN 12 AND 15
      AND length(regexp_replace(COALESCE(opportunity.patient_phone, ''), '[^0-9]', '', 'g')) < 12
    RETURNING opportunity.id
  )
  SELECT count(*) INTO v_updated FROM updated;

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.import_clinic_experts_opportunity_phones(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_clinic_experts_opportunity_phones(JSONB) TO authenticated;
