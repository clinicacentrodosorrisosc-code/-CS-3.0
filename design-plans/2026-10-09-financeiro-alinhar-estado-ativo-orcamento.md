# Alinhar o estado ativo do planejamento orçamentário

Written against: `c1ab45c657de9bd85a2e1eba46a85e3f4477bcc9` plus the existing uncommitted working-tree state observed on 2026-10-09

## Evidence chain

- Surface: `src/components/Financial.tsx`, Financeiro → Lançamentos/Receitas → alternador entre realizado e orçamento.
- Problem: os dois botões irmãos representam o mesmo tipo de estado selecionado, mas usam variantes diferentes. “Lançamentos Realizados” usa `bg-blue-600 text-text shadow-lg`; “Planejamento Orçamentário (Próximo Mês)” usa `bg-purple-600 text-text shadow-lg`.
- Design evidence: `src/index.css` remapeia `bg-purple-600` para `var(--primary)`, mas a camada final `.apple-product-pass` aplica borda primária, fundo primário e texto branco somente a `.btn-primary`, `button.bg-blue-600` e `button.bg-indigo-600`. Assim, no tema claro, o estado ativo do orçamento recebe o mesmo fundo azul do sistema sem herdar o mesmo texto branco do botão irmão.
- Owner: a escolha da variante ativa pertence ao alternador local em `src/components/Financial.tsx`; os tokens e a resolução visual pertencem a `src/index.css`.
- Scope and affected surfaces: somente o alternador realizado/orçamento mostrado para o perfil próprio dentro da aba `transactions` do Financeiro, nos temas claro e escuro.
- Uncertainty: none.

## Design decision

Usar no estado ativo do planejamento orçamentário a mesma variante exata já usada por “Lançamentos Realizados”: `bg-blue-600 text-text shadow-lg`. Isso remove a diferença acidental de resolução na cascata e mantém um único tratamento visual para os dois estados mutuamente exclusivos, sem ampliar o seletor global nem alterar cores semânticas de outras partes do produto.

## Reuse

- Variante existente: `bg-blue-600 text-text shadow-lg`.
- Tokens resolvidos pela camada final: `var(--primary)` e texto branco aplicados por `.apple-product-pass :is(.btn-primary, button.bg-blue-600, button.bg-indigo-600)`.
- Exemplar: botão “Lançamentos Realizados” em `src/components/Financial.tsx`.

## Changes

1. `src/components/Financial.tsx`
   - Change: no ramo ativo de `transactionsViewMode === "orcamento"`, substituir somente `bg-purple-600` por `bg-blue-600`, preservando `text-text shadow-lg` e todas as classes de layout, tipografia, hover e transição.
   - Preserve: `transactionsViewMode`, os handlers, a alternância de conteúdo, o campo “Mês de Referência”, as regras de perfil próprio e toda a lógica do planejamento orçamentário.
   - Verify: ao alternar entre realizado e orçamento, ambos os estados ativos apresentam a mesma família visual; o botão inativo mantém o tratamento neutro atual.

## Scope

- Inherit: apenas o botão de planejamento orçamentário no Financeiro.
- Verify: temas claro e escuro; larguras desktop e móvel; estados ativo, inativo, hover e pressionado dos dois botões.
- Exclude: estilos globais de roxo/índigo, gráficos, cores semânticas de receita/despesa e qualquer cálculo financeiro.

## Validation

- Product: abrir Financeiro → aba de lançamentos/receitas como perfil próprio, alternar entre “Lançamentos Realizados” e “Planejamento Orçamentário (Próximo Mês)” e confirmar que conteúdo, filtros e orçamento continuam funcionando sem mudança.
- Interface: conferir os dois estados em tema claro e escuro, em aproximadamente 1440 px, 1024 px e 390 px; verificar que o texto do estado ativo permanece legível e visualmente idêntico entre os botões.
- System: confirmar que a correção reutiliza a variante local existente e que nenhum seletor paralelo foi criado em `src/index.css`.
- Repository: `npm.cmd run build` → build Vite concluído sem erro; `git diff --check -- src/components/Financial.tsx` → nenhuma falha de whitespace.

## Stop conditions

- Stop if a implementação posterior substituir esse alternador por um componente compartilhado ou se a camada `.apple-product-pass` deixar de resolver `button.bg-blue-600`; nesse caso, reavaliar o proprietário antes de editar.
- Stop if `src/components/Financial.tsx` apresentar alterações concorrentes na mesma expressão de classes; reconciliar preservando a lógica existente em vez de sobrescrever o arquivo.

## Design documentation

- After acceptance and validation: none.
