-- Converte os marcadores locais em observacoes e deixa cada card na fila de envio.
CREATE TABLE IF NOT EXISTS public.clinic_experts_observation_sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES public.clinic_experts_opportunities(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'synced', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (opportunity_id)
);

INSERT INTO public.clinic_experts_observation_sync_queue (user_id, opportunity_id)
SELECT user_id, id FROM public.clinic_experts_opportunities
WHERE COALESCE(array_length(tags, 1), 0) > 0
ON CONFLICT (opportunity_id) DO UPDATE SET status = 'pending', updated_at = NOW();

UPDATE public.clinic_experts_opportunities
SET observations = concat_ws(E'\n', NULLIF(observations, ''), 'Marcadores CRM: ' || array_to_string(tags, ', ')),
    local_overrides = jsonb_set(COALESCE(local_overrides, '{}'::jsonb), '{observations}', to_jsonb(concat_ws(E'\n', NULLIF(observations, ''), 'Marcadores CRM: ' || array_to_string(tags, ', '))), true),
    tags = ARRAY[]::TEXT[]
WHERE COALESCE(array_length(tags, 1), 0) > 0;

ALTER TABLE public.clinic_experts_observation_sync_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ce_observation_queue_own" ON public.clinic_experts_observation_sync_queue
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
