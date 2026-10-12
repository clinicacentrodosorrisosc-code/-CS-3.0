# Unificar o acento de seleção dos menus compartilhados

Written against: `c1ab45c657de9bd85a2e1eba46a85e3f4477bcc9` plus the existing uncommitted working-tree state observed on 2026-10-09

## Evidence chain

- Surface: `src/components/ui/select-menu.tsx`, consumido lado a lado pelos filtros do Financeiro em `src/components/Financial.tsx`.
- Problem: `SelectMenu` marca a opção selecionada com verde fixo (`#1F6F5B`/`#63B596`), enquanto `MultiSelectMenu` usa roxo fixo (`#887CFD`) tanto no check quanto em “Limpar seleção”. Os controles irmãos comunicam o mesmo estado com acentos diferentes na mesma barra de filtros.
- Design evidence: a raiz autenticada aplica `.apple-product-pass`, que define `--primary` como `#0071e3` no tema claro e `#0a84ff` no escuro. O próprio repositório já usa a classe arbitrária `text-[var(--primary)]` em componentes como `Financial.tsx`, `AuditLog.tsx`, `Sidebar.tsx` e `ClinicaExpertsFinancial.tsx`.
- Owner: `src/components/ui/select-menu.tsx` é o proprietário compartilhado dos indicadores selecionados de `SelectMenu` e `MultiSelectMenu`.
- Scope and affected surfaces: filtros do Financeiro; seletor de cargo no cadastro em `Login.tsx`; filtro múltiplo de pacientes em `Orthodontics.tsx`; qualquer consumidor futuro dos dois componentes.
- Uncertainty: none. O alcance compartilhado exige regressão visual nos três consumidores atuais.

## Design decision

Substituir os acentos fixos de seleção dos dois componentes pelo token existente `text-[var(--primary)]`. O check de seleção simples, o check de seleção múltipla e a ação “Limpar seleção” passam a compartilhar o mesmo proprietário cromático e acompanham automaticamente os temas claro e escuro.

## Reuse

- Token existente: `var(--primary)`.
- Classe existente no projeto: `text-[var(--primary)]`.
- Componente proprietário: `SelectMenu` e `MultiSelectMenu` em `src/components/ui/select-menu.tsx`.
- Exemplar: ações e indicadores tokenizados em `src/components/Financial.tsx`, incluindo botões com `text-[var(--primary)]`.

## Changes

1. `src/components/ui/select-menu.tsx`
   - Change: no check da opção ativa de `SelectMenu`, substituir `text-[#1F6F5B] dark:text-[#63B596]` por `text-[var(--primary)]`.
   - Preserve: agrupamento, busca, fechamento por clique externo/Escape, opção desabilitada, `aria-selected`, `module-filter-option` e a alteração local já existente que introduziu os proprietários `module-filter-control` e `module-filter-menu`.
   - Verify: a opção selecionada usa o azul primário correto nos temas claro e escuro.
2. `src/components/ui/select-menu.tsx`
   - Change: no check de `MultiSelectMenu` e na ação “Limpar seleção”, substituir `text-[#887CFD]` por `text-[var(--primary)]`.
   - Preserve: seleção acumulativa, remoção individual, limpeza completa, busca, contador de itens selecionados e todas as classes de layout.
   - Verify: check e ação de limpeza compartilham o mesmo acento do `SelectMenu` sem alterar o comportamento.

## Scope

- Inherit: todos os consumidores de `SelectMenu` e `MultiSelectMenu`.
- Verify: `Financial.tsx` (seleção simples e múltipla na mesma barra), `Login.tsx` (Cargo/Setor durante cadastro) e `Orthodontics.tsx` (Filtrar pacientes).
- Exclude: `DateRangePicker`, elementos `<select>` nativos, cores semânticas de sucesso/aviso/erro e os estilos estruturais de `module-filter-control`, `module-filter-menu` e `module-filter-option`.

## Validation

- Product: no Financeiro, selecionar Categoria, Forma de pagamento e Recebimento; confirmar valores, filtragem, busca e limpeza. No cadastro, selecionar Cargo/Setor. Na Ortodontia, selecionar e limpar múltiplos filtros de pacientes.
- Interface: verificar menus abertos/fechados, opção marcada, “Limpar seleção”, temas claro e escuro e larguras de aproximadamente 1440 px e 390 px; confirmar que nenhum consumidor perde contraste ou herda verde/roxo fixo para o mesmo estado.
- System: pesquisar `src/components/ui/select-menu.tsx` e confirmar que os três acentos selecionados usam `text-[var(--primary)]`, sem introduzir token ou componente paralelo.
- Repository: `npm.cmd run build` → build Vite concluído sem erro; `git diff --check -- src/components/ui/select-menu.tsx` → nenhuma falha de whitespace.

## Stop conditions

- Stop if `SelectMenu` ou `MultiSelectMenu` ganhar uma prop documentada de cor semântica antes da execução; preservar a API e reavaliar se o acento deve ser parametrizado.
- Stop if as alterações locais já presentes em `src/components/ui/select-menu.tsx` forem removidas ou substituídas; reabrir o arquivo e reaplicar somente a troca dos três acentos sobre o novo proprietário.

## Design documentation

- After acceptance and validation: none.
