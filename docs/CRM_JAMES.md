# CRM James (beta)

O CRM James roda como uma aplicação isolada do OdontoManager. O código é acompanhado como submódulo em `apps/crm-james`, apontando para o repositório oficial do DeskcommCRM.

## Preparação local

```powershell
npm.cmd run setup:crm-james
```

Antes de iniciar o ambiente, crie `apps/crm-james/.env.local` a partir do `.env.example` do próprio projeto e configure um Supabase separado, com o schema indicado pelo DeskcommCRM. Não reutilize automaticamente o banco do OdontoManager.

Depois, execute os dois servidores em terminais separados:

```powershell
npm.cmd run dev
npm.cmd run dev:crm-james
```

O OdontoManager fica em `http://localhost:3000` e o CRM James em `http://localhost:3001`.

## Produção

O DeskcommCRM deve ser publicado como aplicação separada. No build do OdontoManager, defina:

```text
VITE_CRM_JAMES_URL=https://crm-james-beta.vercel.app
```

Sem essa variável, o submenu informa que o ambiente ainda não foi configurado. Essa separação preserva as dependências, a autenticação e o banco de dados de cada sistema.
