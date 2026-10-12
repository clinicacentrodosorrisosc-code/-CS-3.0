# Checkbox branco simples

Written against: c1ab45c

## Evidence chain

- Surface: `src/components/BudgetReactivation.tsx` em Registrar ações e `src/components/Financial.tsx` nas tabelas de lançamentos.
- Problem: o controle atual `clean-checkbox` desenha um ícone de confirmação e pode aparentar mais de uma moldura, enquanto o pedido é uma única caixa branca de seleção.
- Design evidence: imagem fornecida pelo usuário e instrução explícita de manter somente a caixa branca.
- Owner: `src/index.css`, seletor `.ce-app input.clean-checkbox`.
- Scope and affected surfaces: cinco checkboxes que já usam `clean-checkbox` em Reativação e Financeiro.
- Uncertainty: none.

## Design decision

Manter a separação visual dos grupos e tabelas. Simplificar somente o controle: uma caixa branca quadrada, sem fundo adicional, sombra, ícone SVG ou moldura interna. O estado marcado deve continuar distinguível por uma borda de cor primária, sem criar um segundo elemento visual.

## Reuse

- `.ce-app input.clean-checkbox` em `src/index.css`.
- Exemplar: `src/components/BudgetReactivation.tsx`.

## Changes

1. `src/index.css`
   - Change: remover a imagem SVG do estado marcado e manter um único quadrado branco com borda primária quando selecionado.
   - Preserve: tamanho compacto, foco por teclado e interação nativa do checkbox.
   - Verify: cada opção mostra somente uma caixa branca, marcada ou não.

2. `src/components/BudgetReactivation.tsx` e `src/components/Financial.tsx`
   - Change: manter o uso compartilhado de `clean-checkbox`, sem wrappers ou pseudo-elementos adicionais.
   - Preserve: seleção múltipla, seleção em massa e agrupamento dos controles.
   - Verify: WhatsApp, Ligações, Resultado e tabelas de lançamentos usam o mesmo controle.

## Scope

- Inherit: todos os usos existentes de `clean-checkbox`.
- Verify: Reativação de orçamentos e Financeiro > Lançamentos.
- Exclude: checkboxes de manutenção de ortodontia e controles não relacionados.

## Validation

- Product: selecionar e desmarcar ações e lançamentos sem mudança de comportamento.
- Interface: verificar os estados marcado, desmarcado, foco e tema claro/escuro.
- System: confirmar que não há outro estilo local sobrepondo `clean-checkbox`.
- Repository: `npm.cmd run build` → concluído sem erros.

## Stop conditions

- Stop if algum navegador não apresentar diferenciação suficiente entre marcado e desmarcado apenas pela borda.

## Design documentation

- After acceptance and validation: none.
