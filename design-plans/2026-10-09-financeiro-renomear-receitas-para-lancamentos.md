# Renomear a superfície mista de Receitas para Lançamentos

Written against: `c1ab45c657de9bd85a2e1eba46a85e3f4477bcc9` plus the existing uncommitted working-tree state observed on 2026-10-09

## Evidence chain

- Surface: navegação Financeiro → subaba `transactions`, seu título, contexto interno e configuração de permissões.
- Problem: a superfície é apresentada como “Receitas”, mas nela o usuário pode criar “Despesa em massa” e acessar o planejamento com “Receitas Orçadas” e “Despesas Orçadas”. Dentro da própria superfície, o `aria-label`, o contador e o alternador já usam o termo abrangente “lançamentos”.
- Design evidence: `ALL_TABS_CONFIG` em `Financial.tsx`, os subitens em `Sidebar.tsx` e `FINANCIAL` em `PermissionsModal.tsx` são três proprietários atuais do mesmo rótulo. `Financial.tsx` reutiliza o rótulo de `ALL_TABS_CONFIG` como título da página e mantém o contexto textual `Financeiro › Receitas` separadamente.
- Owner: `src/components/Financial.tsx` governa a aba e o contexto renderizado; `src/components/Sidebar.tsx` governa o rótulo no menu lateral; `src/components/PermissionsModal.tsx` governa o nome da permissão exibido ao administrador.
- Scope and affected surfaces: menu lateral do Financeiro, controle segmentado e título da subaba, barra de contexto da subaba e modal de permissões.
- Uncertainty: none. O identificador técnico `transactions` e a permissão `financial_transactions` permanecem inalterados.

## Design decision

Adotar “Lançamentos” como rótulo abrangente da subaba `transactions` e “Financeiro › Lançamentos” como seu contexto. O termo já existe na própria interface e cobre receitas realizadas, despesas em massa e planejamento de receitas/despesas sem renomear conteúdos específicos que continuam corretamente chamados de receita ou despesa.

## Reuse

- Termo existente: “Lançamentos”, já usado em `aria-label="Contexto dos lançamentos"`, no contador de lançamentos e em “Lançamentos Realizados”.
- Identificadores preservados: `transactions` e `financial_transactions`.
- Exemplar: texto “Lançamentos Realizados” em `src/components/Financial.tsx`.

## Changes

1. `src/components/Financial.tsx`
   - Change: alterar o `label` da entrada `id: "transactions"` em `ALL_TABS_CONFIG` de “Receitas” para “Lançamentos”; alterar a barra de contexto de “Financeiro › Receitas” para “Financeiro › Lançamentos”.
   - Preserve: `id`, `permissionId`, filtragem por permissão, `activeSubTab`, lógica de receitas realizadas, orçamento, entradas em massa, título derivado de `visibleTabs` e todos os rótulos específicos como “Nova receita”, “Receita em massa”, “Receitas Orçadas” e “Despesas Orçadas”.
   - Verify: controle segmentado, título da página e contexto exibem o mesmo nome abrangente.
2. `src/components/Sidebar.tsx`
   - Change: no subitem financeiro `id: 'transactions'`, alterar somente o `label` de “Receitas” para “Lançamentos”.
   - Preserve: o mapeamento `transactions: 'financial_transactions'`, permissões, navegação, atalho “Registrar pagamento” e alterações locais existentes no Sidebar.
   - Verify: o menu lateral abre a mesma subaba e mostra “Lançamentos”.
3. `src/components/PermissionsModal.tsx`
   - Change: na entrada `id: 'financial_transactions'`, alterar somente o `label` de “Receitas” para “Lançamentos”.
   - Preserve: o identificador da permissão, perfis padrão, persistência de `allowed_sub_tabs` e regras de acesso.
   - Verify: o administrador vê “Lançamentos” e salvar permissões continua enviando `financial_transactions`.

## Scope

- Inherit: título do Financeiro derivado de `visibleTabs`, navegação lateral e nome exibido no modal de permissões.
- Verify: administrador e usuário com permissão `financial_transactions`; navegação pelo Sidebar; abertura via atalho “Registrar pagamento”; alternância entre realizado e orçamento.
- Exclude: nomes de banco/tabela, tipos TypeScript, IDs, chaves de permissão, eventos de auditoria, textos específicos de receita/despesa e qualquer lógica financeira.

## Validation

- Product: acessar a subaba pelo menu lateral e pelo atalho “Registrar pagamento”; alternar realizado/orçamento; abrir ações em massa; confirmar que todas as funções continuam apontando para `transactions` e que a permissão continua sendo `financial_transactions`.
- Interface: confirmar “Lançamentos” no Sidebar, controle segmentado, título principal e modal de permissões, além de “Financeiro › Lançamentos” na barra de contexto; verificar desktop e móvel nos temas claro e escuro.
- System: executar `rg -n "label: ['\"]Receitas['\"]|Financeiro › Receitas" src/components/Financial.tsx src/components/Sidebar.tsx src/components/PermissionsModal.tsx` e esperar nenhum rótulo antigo da superfície; confirmar separadamente que `financial_transactions` e `id: 'transactions'` continuam presentes.
- Repository: `npm.cmd run build` → build Vite concluído sem erro; `git diff --check -- src/components/Financial.tsx src/components/Sidebar.tsx src/components/PermissionsModal.tsx` → nenhuma falha de whitespace.

## Stop conditions

- Stop if a fonte única de configuração para subabas e permissões for introduzida antes da execução; alterar o novo proprietário em vez de manter três cópias.
- Stop if “Receitas” passar a identificar uma rota separada que exclua orçamento e despesas; nesse caso, reauditar o escopo antes de renomear.
- Stop if houver conflito com alterações locais no mesmo bloco de `Sidebar.tsx`; preservar o trabalho existente e aplicar somente a mudança de rótulo após reconciliação.

## Design documentation

- After acceptance and validation: none.
