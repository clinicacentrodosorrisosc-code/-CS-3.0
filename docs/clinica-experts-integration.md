# Integração Clínica Experts

Esta integração mantém um espelho somente-leitura dos funis, etapas,
oportunidades e dados básicos dos pacientes do Clínica Experts. Mover uma
oportunidade no sistema de origem atualiza sua etapa neste projeto na próxima
sincronização.

## Comportamento

- Ao abrir a tela CRM, ocorre uma sincronização inicial.
- Enquanto a tela estiver aberta, a sincronização se repete a cada 5 minutos.
- O botão **Atualizar agora** força uma nova leitura.
- Cada etapa permite exportar um CSV com nome, telefone, e-mail, oportunidade,
  funil, etapa e responsável.
- Telefones inválidos e números duplicados são ignorados na exportação.
- A integração não altera registros no Clínica Experts.

Os webhooks publicados pelo Clínica Experts não incluem eventos de CRM. Por
isso, a mudança de etapa é detectada consultando periodicamente a API.

## Configuração obrigatória

1. No Supabase SQL Editor, execute
   `supabase_crm_migrations/031_clinica_experts_sync.sql`.
2. No Clínica Experts, abra **Configurações > Integrações** e gere uma chave de
   API.
3. Configure a chave no ambiente do servidor:

   ```text
   CLINICA_EXPERTS_API_TOKEN=...
   ```

4. Reinicie ou publique novamente a aplicação.

Nunca coloque a chave em uma variável `VITE_`, no navegador, no Git ou em
mensagens. Ela deve existir apenas no ambiente do servidor.

## Sincronização contínua em segundo plano

Para atualizar mesmo quando ninguém estiver com o CRM aberto, configure também:

```text
CLINICA_EXPERTS_OWNER_USER_ID=<UUID do usuário proprietário>
SUPABASE_SERVICE_ROLE_KEY=<chave service_role do projeto>
CRON_SECRET=<segredo longo e aleatório>
```

Depois, um agendador externo deve chamar a cada 5 minutos:

```text
GET https://SEU-DOMINIO/api/integrations/clinica-experts/sync
Authorization: Bearer <CRON_SECRET>
```

O endpoint impede duas sincronizações simultâneas. A API do Clínica Experts
limita o consumo a 120 requisições por minuto; o cliente pagina os resultados e
mantém intervalo entre as páginas.

## Diagnóstico

O endpoint autenticado abaixo informa se a integração está configurada e exibe
o último resultado, sem revelar a chave:

```text
GET /api/integrations/clinica-experts/status
Authorization: Bearer <sessão do usuário>
```

Cada execução também é registrada em `clinic_experts_sync_runs`.
