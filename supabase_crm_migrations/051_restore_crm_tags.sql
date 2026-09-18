-- Retorno ao modelo local de tags: recupera os marcadores convertidos e
-- remove apenas o texto tecnico criado pela tentativa de sincronizacao.
UPDATE public.clinic_experts_opportunities
SET tags = string_to_array(trim(regexp_replace(COALESCE(local_overrides->>'observations', observations, ''), '^.*Marcadores CRM:\\s*', '')), ', '),
    observations = NULLIF(trim(regexp_replace(COALESCE(observations, ''), E'\\n?Marcadores CRM:.*$', '')), ''),
    local_overrides = COALESCE(local_overrides, '{}'::jsonb) - 'observations'
WHERE COALESCE(local_overrides->>'observations', observations, '') LIKE '%Marcadores CRM:%';

-- Mantem o historico das tentativas, mas impede novo processamento da fila.
UPDATE public.clinic_experts_observation_sync_queue
SET status = 'failed', updated_at = NOW(), error_message = COALESCE(error_message, 'Sincronizacao de observacoes desativada; tags restauradas localmente.')
WHERE status = 'pending';
