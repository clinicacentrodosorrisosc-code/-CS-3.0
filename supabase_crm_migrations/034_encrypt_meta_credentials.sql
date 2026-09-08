-- Tokens de canal oficial não podem permanecer em texto aberto.
-- A chave AES-256-GCM vive somente no processo do servidor em
-- WHATSAPP_CREDENTIALS_ENCRYPTION_KEY (base64 de 32 bytes).

ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS access_token_encrypted TEXT;

-- A versão antiga mantinha o token aberto. Não é possível convertê-lo no banco
-- sem entregar a chave de cifra ao Postgres; portanto ele é removido e a pessoa
-- reconecta o canal uma vez pela tela, já sob a nova cifra no servidor.
UPDATE public.whatsapp_config
SET access_token = NULL,
    status = 'disconnected'
WHERE access_token IS NOT NULL;
