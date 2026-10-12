# Plano de renovacao visual do CS3.0

## Outcome

Transformar o aplicativo principal do CS3.0 em um sistema operacional coeso, legivel e rapido, mantendo intactos dados, permissoes, calculos e fluxos. O resultado deve usar uma linguagem visual unica em Dashboard, CRM, Financeiro, Ortodontia, Laboratorio, Tarefas, Gestao, Chamados, Cofre, Processos, Biblioteca, Configuracoes e Auditoria.

O produto deve parecer um unico sistema, nao uma colecao de telas criadas em momentos diferentes.

**Written against commit:** `c1ab45c`

**Escopo auditado:** aplicacao React/Vite principal em `src/`. O `apps/crm-james` e um produto Next.js separado e deve receber uma auditoria propria antes de qualquer convergencia visual; nesta iniciativa ele entra apenas como destino externo da navegacao.

**Limite desta entrega:** plano e auditoria estatica. Nenhum arquivo funcional foi alterado. As capturas locais disponiveis mostram login e Dashboard em loading, portanto a execucao deve comecar por uma linha de base autenticada em navegador.

## Evidence chain

### Superficies e fluxo em runtime

- `src/App.tsx:548-689` monta o shell autenticado, o cabecalho, a sidebar, o canvas, as notificacoes, o chat e os 13 modulos principais.
- `src/components/Sidebar.tsx:112-244` define os grupos e subrotas operacionais, incluindo Dashboard, CRM, Financeiro, Ortodontia, Laboratorio, Tarefas, Gestao, Chamados, Cofre, Processos e Biblioteca.
- `src/components/PermissionsModal.tsx:41-169` confirma que a navegacao depende de `allowed_tabs` e `allowed_sub_tabs`; a renovacao visual nao pode alterar essa matriz.
- `src/components/Dashboard.tsx:519-607` e a referencia atual mais proxima de uma composicao operacional: KPIs, tendencia, distribuicao e dominios no mesmo canvas.
- `src/components/BudgetReactivation.tsx:701-1402` evidencia o caso mais exigente de densidade: lista de leads, ficha, grafico, KPIs e historico coexistem na mesma tela.
- `src/components/Financial.tsx:5292-7851` concentra cabecalho, filtros, KPIs, graficos, tabelas e configuracoes em um unico componente de 7.966 linhas.

### Inventario tecnico

- 65 arquivos TSX na aplicacao principal, 41.870 linhas TSX e 3.804 linhas em `src/index.css`.
- 63 componentes de produto e apenas 18 componentes em `src/components/ui`.
- Os maiores hotspots sao `Financial.tsx` (7.966 linhas), `PricingSystem.tsx` (4.545), `Orthodontics.tsx` (4.259) e `CommercialDailyReport.tsx` (2.819).
- Foram encontrados 820 usos de cores hexadecimais, 1.104 textos com tamanho arbitrario em pixels, 123 larguras arbitrarias e 349 usos de `transition-all`.
- A aplicacao principal nao possui testes visuais, testes de componentes nem stories. Os testes existentes pertencem majoritariamente ao produto separado `apps/crm-james`.
- `index.html` carrega Tailwind por CDN em runtime, embora Tailwind 4 esteja listado nas dependencias. Isso deixa configuracao, desempenho e reproducibilidade visual mais frageis.
- `src/index.css` contem varias camadas historicas de redesign e redefine os tokens principais em diferentes pontos, inclusive nas linhas aproximadas 1, 1.880 e 3.235.

### Detector de consistencia

O detector `impeccable` encontrou 782 ocorrencias: 757 advisories e 25 warnings.

| Categoria | Ocorrencias |
|---|---:|
| Tamanho tipografico fora do contrato atual | 429 |
| Cor fora do contrato atual | 242 |
| Raio fora do contrato atual | 76 |
| Paleta generica/multipla | 16 |
| Easing com bounce | 10 |
| Outros | 9 |

Os arquivos com maior concentracao sao `src/index.css` (257), `CommercialDailyReport.tsx` (99), `Financial.tsx` (79), `PricingSystem.tsx` (45), `FinancialViability.tsx` (37) e `Orthodontics.tsx` (36).

O volume nao deve ser tratado como 782 correcoes isoladas. Ele e a evidencia de que o contrato visual e os componentes-base precisam ser corrigidos primeiro.

## Diagnostico executivo

### 1. O contrato visual nao representa o produto

**Confianca: alta.** Nao existe `PRODUCT.md`. O `DESIGN.md` atual se chama `Apple-design-analysis` e descreve uma galeria de marketing com tiles fotograficos, enquanto o runtime e um sistema clinico denso. Ao mesmo tempo, `src/index.css` acumula passes Nexus, Clinica Experts, Taskify e Apple. Isso cria uma cadeia de autoridade contraditoria.

**Impacto:** cada nova tela escolhe seus proprios tamanhos, raios, cores e densidade. O CSS global precisa corrigir o CSS anterior em vez de fornecer uma base previsivel.

### 2. Ha pouca reutilizacao para a quantidade de produto

**Confianca: alta.** Existem bons primitivos isolados (`DateRangePicker`, `SelectMenu`, `LoadingPanel`, `DonutChart`, `AnimatedNumber`, `ConfirmAction`), mas faltam estruturas compartilhadas para cabecalho, KPI, barra de filtros, tabela/lista, dialog, drawer, formulario e estados vazios. O resultado aparece nos componentes gigantes e nas variacoes de titulo entre 16px e 48px.

**Impacto:** uma melhoria visual exige alteracoes repetidas e arriscadas em muitos arquivos, e os modulos voltam a divergir rapidamente.

### 3. Densidade, responsividade, movimento e acessibilidade nao formam um sistema

**Confianca: alta no codigo; media na experiencia visual ate validar no navegador.** Existem breakpoints, skip link e focus global, mas tambem 1.104 textos de 9-11px, tabelas com `min-width`, 639 botoes para apenas 75 `aria-label`, 349 `transition-all`, animacao de 350ms em toda troca de modulo e apenas tres guardas de `prefers-reduced-motion`.

**Impacto:** telas ficam apertadas, informacoes essenciais perdem hierarquia e interacoes frequentes parecem lentas. Em mobile, parte da adaptacao acontece por scroll horizontal em vez de uma composicao especifica.

## Audit scorecard inicial

Escala de 0 a 4. Esta nota e uma linha de base estatica e deve ser atualizada depois da rodada autenticada em navegador.

| Dimensao | Nota | Evidencia principal |
|---|---:|---|
| Acessibilidade | 2/4 | Skip link e foco existem, mas ha microtexto, rotulos inconsistentes e poucos nomes acessiveis em relacao ao volume de controles. |
| Performance percebida | 2/4 | Componentes muito grandes, Tailwind CDN, animacao global de rota e muitos efeitos amplos; a carga real ainda precisa ser medida. |
| Theming | 2/4 | Light/dark e tokens existem, mas sao redefinidos em varios passes e contornados por centenas de cores literais. |
| Responsividade | 2/4 | Ha breakpoints em quase todos os modulos, mas persistem larguras minimas, tabelas largas e densidade excessiva. |
| Integridade de implementacao | 1/4 | Contrato visual incorreto, CSS acumulativo, baixo numero de primitivos e hotspots de milhares de linhas. |
| **Total** | **9/20** | Base funcional, mas com risco alto de divergencia a cada nova tela. |

## Design decision

### Direcao: operacao clinica calma, precisa e compacta

Usar o Dashboard como referencia de hierarquia e densidade, nao como um conjunto literal de classes. A linguagem deve ser:

- clara e profissional, com superficies neutras e uma unica cor primaria para acao;
- compacta onde a tarefa pede comparacao, mas nunca com texto principal abaixo de 12px;
- orientada por dados, com numeros tabulares, alinhamentos previsiveis e estados semanticos consistentes;
- silenciosa em tarefas repetidas: movimento curto, funcional e quase imperceptivel;
- responsiva por recomposicao: tabela no desktop, lista/cartao ou painel progressivo no mobile;
- fiel a identidade atual da clinica, sem importar o visual de marketing Apple do `DESIGN.md`.

### Paleta funcional

- Azul atual como acao primaria, selecao, links e foco.
- Verde apenas para sucesso, comparecimento, receita e conversao positiva.
- Amarelo apenas para atencao, pendencia e vencimento.
- Vermelho apenas para erro, perda, atraso critico e exclusao.
- Uma unica familia de cinzas frios para fundos, divisores e texto secundario.
- Cores de series em graficos devem vir de tokens de dados e manter contraste nos dois temas.

### Tipografia e densidade

- Escala proposta: 12, 13, 14, 16, 20, 24 e 30px; 14px como corpo operacional padrao.
- 12px reservado a metadados e rotulos auxiliares, nunca a informacao principal ou acao.
- Pesos 400, 500, 600 e 700; retirar o excesso de `font-black` e caixa alta.
- Numeros financeiros e KPIs com `font-variant-numeric: tabular-nums`.
- Tres niveis de densidade documentados: `compact`, `comfortable` e `touch`, definidos pelo componente, nao por classes avulsas.

### Geometria

- Escala de espacamento: 4, 8, 12, 16, 24 e 32px.
- Raios: 8px em controles, 12px em cards e 16px em paineis/dialogs; pill somente para badges e filtros realmente segmentados.
- Bordas discretas para agrupamento; sombra apenas quando comunicar elevacao real.
- Canvas com largura fluida e margens previsiveis, evitando tanto a tela espremida no centro quanto a expansao sem limite.

## Before / After / Why

| Antes | Depois | Por que |
|---|---|---|
| `DESIGN.md` de marketing Apple e varios passes CSS concorrentes | `PRODUCT.md` operacional e `DESIGN.md` especifico do CS3.0 | Cria uma unica autoridade para novas telas e reduz correcoes em cascata. |
| Cabecalhos entre 16px e 48px | `PageHeader` com tres tamanhos por contexto | Estabiliza hierarquia sem tornar telas densas gigantes. |
| KPIs escritos dentro de cada modulo | `MetricCard` e `MetricGroup` com densidades e formatos | Mantem alinhamento, numero, comparacao e estado semantico consistentes. |
| Filtros, selects e periodos montados de formas diferentes | `FilterBar`, `SelectMenu` e `DateRangePicker` unificados | Reduz carga cognitiva e regressao visual. |
| Tabelas largas forcam scroll em mobile | `DataView` com tabela desktop e lista/drawer mobile | Preserva comparacao no desktop e usabilidade no toque. |
| 349 `transition-all` e animacao em toda troca de rota | Propriedades explicitas, 100-250ms e sem movimento em tarefas frequentes | Melhora resposta, previsibilidade e performance. |
| Loading, vazio e erro variam por tela | Estados compartilhados com linguagem e acoes consistentes | Torna o sistema confiavel inclusive fora do caminho feliz. |
| Componentes de 2.000-8.000 linhas | Views compostas por secoes e componentes de dominio | Torna melhorias locais seguras e sustentaveis. |

## Reuse

### Preservar e elevar

- `src/components/ui/date-range-picker.tsx`
- `src/components/ui/select-menu.tsx`
- `src/components/ui/loading-panel.tsx`
- `src/components/ui/confirm-action.tsx`
- `src/components/ui/donut-chart.tsx`
- `src/components/ui/animated-number.tsx`
- `src/components/base-ui/calendar.tsx`
- Sonner para feedback, Radix/Base UI para overlays e Recharts para dados.

### Retirar do caminho principal

- demos de `glowing-effect` e `liquid-metal-button`;
- shaders e efeitos decorativos sem funcao operacional comprovada;
- `SpotlightCard` em superficies vistas dezenas de vezes por dia;
- efeitos de glass em locais onde reduzem contraste ou geram ruido.

Esses elementos podem permanecer em laboratorio/demos, mas nao devem definir o sistema operacional.

## Changes

### Fase 0 - Linha de base e protecao contra regressao

**Prioridade:** P0
**Objetivo:** tornar o redesenho mensuravel antes de alterar a aparencia.

1. Criar uma branch exclusiva a partir do estado revisado, preservando o worktree atual, que ja possui alteracoes locais.
2. Registrar capturas autenticadas dos fluxos por papel: admin, recepcao e vendedor.
3. Cobrir pelo menos: Dashboard Geral/Comercial/Agenda; CRM Funil/Reativacao; Financeiro Visao Geral/Lancamentos; Ortodontia; Laboratorio; Tarefas; Configuracoes; Auditoria.
4. Capturar 1440x900, 1280x720, 1024x768, 390x844 e 360x800, em light e dark.
5. Adicionar smoke tests de navegacao e screenshots com Playwright para a aplicacao principal. Nao misturar a suite do `apps/crm-james`.
6. Definir fixtures para estados loading, vazio, erro, pouco dado, muito dado e texto longo em portugues.

**Criterio de saida:** todas as superficies prioritarias possuem baseline reproduzivel e nenhuma mudanca posterior pode ser aprovada apenas por build.

### Fase 1 - Contrato de produto e design system

**Prioridade:** P0
**Arquivos:** `PRODUCT.md`, `DESIGN.md`, novo `src/styles/tokens.css`, `src/index.css`.

1. Criar `PRODUCT.md` com usuarios, tarefas frequentes, regras de densidade, matriz de permissoes e nao objetivos.
2. Substituir o `DESIGN.md` de marketing por um contrato do CS3.0 contendo paleta, tipografia, spacing, radius, elevacao, z-index, motion, estados, charts e exemplos.
3. Consolidar tokens light/dark em uma unica definicao; remover redefinicoes tardias e compatibilidades que ja nao forem necessarias.
4. Separar CSS em camadas: reset/tokens, shell, primitives, modules, utilities e print.
5. Compilar Tailwind localmente ou substitui-lo de forma controlada; remover o CDN somente depois de obter paridade visual nas capturas.
6. Documentar as excecoes semanticas de cor e os tokens de series de graficos.

**Criterio de saida:** um token tem uma unica origem; o detector deixa de usar um contrato alheio ao produto; light/dark nao dependem de overrides no fim do arquivo.

### Fase 2 - Biblioteca operacional minima

**Prioridade:** P0
**Arquivos:** `src/components/ui/*`, novo `src/components/layout/*`.

Criar ou consolidar:

- `PageHeader`, `ModuleTabs` e `SegmentedControl`;
- `MetricCard`, `MetricGroup` e `DeltaIndicator`;
- `FilterBar`, `SearchField`, `FormField`, `Checkbox` e `IconButton`;
- `StatusBadge` com vocabulario e cor por dominio;
- `DataTable`, `DataList`, `Pagination` e `BulkActions`;
- `Dialog`, `Drawer`, `DetailPanel` e `ConfirmAction`;
- `EmptyState`, `ErrorState`, `LoadingState` e skeletons de forma;
- `ChartCard`, `ChartLegend` e tooltip comum;
- `ResponsiveSplitPane` para lista + ficha + insights, necessario na Reativacao de orcamentos.

Cada componente deve possuir tamanhos, estados, teclado, foco, loading, disabled, erro e comportamento responsivo documentados. Evitar criar uma nova biblioteca abstrata antes de migrar duas telas reais.

**Criterio de saida:** Dashboard e uma segunda tela consomem os mesmos primitivos sem wrappers locais equivalentes.

### Fase 3 - Shell, navegacao e arquitetura da informacao

**Prioridade:** P1
**Arquivos:** `src/App.tsx`, `src/components/Sidebar.tsx`, `src/components/Layout/AppHeader.tsx`, `src/index.css`.

1. Manter a sidebar por ser adequada ao volume de modulos, mas reduzir ruido e padronizar expansao, item ativo e subnavegacao.
2. Diferenciar navegacao primaria, atalhos operacionais e administracao; o item ativo deve ser inequívoco sem depender apenas de cor.
3. Fazer cabecalho e sidebar compartilharem a mesma escala, altura, icones e estados.
4. Remover a animacao de entrada em toda troca de modulo. Navegacao frequente deve trocar imediatamente ou usar apenas fade curto de 100-140ms.
5. Garantir menu mobile como drawer com foco contido, escape, retorno de foco e area de toque minima de 44px.
6. Preservar exatamente `allowed_tabs`, `allowed_sub_tabs`, rotas solicitadas e atalhos atuais.

**Criterio de saida:** todos os modulos abrem dentro do mesmo canvas, com titulo e subnavegacao previsiveis em desktop e mobile.

### Fase 4 - Migracao das jornadas de maior valor

**Prioridade:** P1
**Ordem:** Dashboard, CRM/Reativacao, Financeiro.

#### Dashboard

- Tornar a visao geral o exemplo vivo do design system.
- Reduzir KPIs a decisoes principais e deslocar detalhes para secoes ou drill-down.
- Unificar Tendencia e Performance sem duplicar graficos ou esconder contexto.
- Padronizar cards de Financeiro, Laboratorio e Ortodontia.
- Validar que carregamento, metas ausentes e periodos sem dados tenham estados proprios.

#### CRM e Reativacao de orcamentos

- Desktop: lista de leads a esquerda, ficha no centro e atividade/KPIs a direita com largura elastica.
- Em resolucoes intermediarias: lista + ficha, com insights em painel recolhivel.
- Mobile: lista, ficha e historico como etapas, nunca tres colunas espremidas.
- Nome do lead e informacao primaria; telefone, valor, status e data formam a segunda linha de leitura.
- Checkboxes permanecem quadrados, simples e brancos, com rotulo clicavel e foco visivel.
- Grafico de James/Priscila usa legenda interativa, cores acessiveis e tooltip compartilhado.
- Historico, conversao, perda e agendamento usam dialogs/drawers consistentes e registram claramente data de criacao e data do resultado.

#### Financeiro

- Dividir `Financial.tsx` por views e dominios sem alterar regras de negocio.
- Extrair cabecalho, filtros, KPIs, graficos, tabela de lancamentos, conciliacao e configuracoes.
- Unificar os controles de selecao e o checkbox simples ja solicitado pelo usuario.
- Padronizar valores, sinal, moeda, datas e estados `Pago`, `Pendente` e `Vencido`.
- Em mobile, substituir tabelas extensas por linhas resumidas + drawer de detalhes.

**Criterio de saida:** as tres jornadas usam a mesma biblioteca, mantem suas funcoes atuais e passam na matriz de capturas e permissoes.

### Fase 5 - Migracao dos modulos clinicos e operacionais

**Prioridade:** P2
**Ordem:** Agenda, Ortodontia, Laboratorio, Tarefas.

1. Agenda: priorizar horario, paciente, procedimento e status; separar indicadores de capacidade dos detalhes do dia.
2. Ortodontia: unificar filtros, calendario, grade e pacientes; manter controles de pagamento e presenca diretamente operacionais.
3. Laboratorio: padronizar Dashboard, Kanban e precos; usar cor por status, nao por decoracao.
4. Tarefas: preservar o quadro desktop, criar lista filtravel no mobile e reutilizar os dialogs de formulario.
5. Reavaliar `SpotlightCard` e efeitos de hover frequentes; manter apenas feedback discreto.

**Criterio de saida:** nenhuma dessas telas usa cabecalho, KPI, formulario ou overlay exclusivo sem uma justificativa de dominio.

### Fase 6 - Migracao dos modulos de apoio e administracao

**Prioridade:** P3
**Ordem:** Gestao & Comercial, Chamados, Cofre & Senhas, Processos, Biblioteca, WhatsApp/Configuracoes, Auditoria e Permissoes.

1. Aplicar o shell e os componentes consolidados.
2. Reduzir titulos de 48px em telas operacionais e normalizar hierarquia.
3. Padronizar busca, filtros, cards, estados e formularios.
4. Em Permissoes, manter a relacao exata entre abas principais e subabas e melhorar leitura por papel.
5. Em Auditoria, manter rastreabilidade por usuario, acao, modulo e hora, com detalhes em drawer/dialog acessivel.
6. Em Cofre, separar dados sensiveis do visual de gestao e evitar animacao/efeito decorativo sobre informacao critica.

**Criterio de saida:** 100% dos modulos roteados usam tokens e primitives do sistema, sem regressao de acesso por papel.

### Fase 7 - Motion, feedback e performance

**Prioridade:** P2 transversal
**Arquivos:** `src/App.tsx`, `src/index.css` e componentes interativos.

1. Remover `transition-all`; declarar apenas `color`, `background-color`, `border-color`, `opacity` e `transform` quando necessarios.
2. Duracoes: press 100-160ms, tooltip/popover 125-200ms, dropdown 150-220ms, dialog/drawer 200-280ms.
3. Usar `ease-out` forte para entrada/saida e `ease-in-out` para movimento; remover bounce de fluxos operacionais.
4. Nunca iniciar em `scale(0)`; popovers surgem a partir do gatilho e modais permanecem centralizados.
5. Nao animar troca por teclado nem navegacao usada dezenas de vezes ao dia.
6. Animar apenas `transform` e `opacity`; evitar width, height, top e left.
7. Consolidar `prefers-reduced-motion` e condicionar hover a `(hover: hover) and (pointer: fine)`.
8. Medir bundle, long tasks e render das tabelas; virtualizar apenas onde a quantidade real justificar.

**Criterio de saida:** nenhuma interacao frequente parece mais lenta por causa de animacao e o modo reduced motion remove deslocamentos nao essenciais.

### Fase 8 - Acessibilidade, conteudo e acabamento

**Prioridade:** P1 transversal.

1. Todo controle icon-only recebe nome acessivel; `title` nao substitui `aria-label`.
2. Inputs possuem label persistente, ajuda e erro vinculados por `aria-describedby`.
3. Dialogs e drawers prendem foco, fecham com Escape e devolvem foco ao gatilho.
4. Ordem de tab segue a ordem visual; skip link permanece funcional.
5. Contraste WCAG AA em ambos os temas; estados nao dependem apenas de cor.
6. Area de toque minima de 44x44px em mobile.
7. Revisar textos truncados, caixa alta excessiva, mensagens de erro e nomenclatura entre sidebar, permissoes e tela.
8. Corrigir os metadados e a estrategia de fontes para que o primeiro carregamento nao dependa de tres bibliotecas visuais externas.

**Criterio de saida:** fluxo completo operavel por teclado, zoom 200%, light/dark e leitor de tela nos pontos principais.

## Scope

### Incluido

- sistema visual e documentacao;
- shell e navegacao;
- componentes compartilhados;
- reorganizacao visual das telas;
- responsividade, acessibilidade, motion e performance percebida;
- decomposicao de componentes para sustentar o redesign;
- testes de navegacao e regressao visual.

### Nao incluido sem nova decisao

- mudanca de regras financeiras, KPIs, formulas ou modelo de dados;
- mudanca de permissoes, papeis ou rotas;
- reescrita do React/Vite em outro framework;
- redesign interno do `apps/crm-james`;
- rebrand da clinica, novo logo ou nova identidade de marketing;
- deploy automatico antes de validacao autenticada.

## Validation

### Matriz funcional

- Admin, recepcao e vendedor.
- Navegacao por todas as abas e subabas permitidas.
- Light e dark.
- Loading, vazio, erro, sucesso, dados extremos e textos longos.
- Operacoes criticas: salvar, excluir, converter, agendar, receber, filtrar e exportar.

### Matriz visual

- 1440x900, 1280x720, 1024x768, 390x844 e 360x800.
- Zoom 100%, 125%, 150% e 200%.
- Sem scroll horizontal na pagina; scroll local somente onde a comparacao tabular exigir.
- Titulos, filtros, KPIs e conteudo alinhados a uma mesma grade.
- Nada essencial abaixo de 12px.

### Matriz tecnica

- `npm.cmd run lint`
- `npm.cmd run build`
- smoke tests e screenshots Playwright da aplicacao principal;
- teste de teclado e foco;
- teste de `prefers-reduced-motion`;
- verificacao de contraste;
- comparacao de permissoes antes/depois;
- `git diff --check` e revisao para garantir que apenas os arquivos da fase foram incluidos.

## Stop conditions

- Interromper se a mudanca visual exigir alterar calculo, dado persistido, permissao ou fluxo sem aprovacao explicita.
- Nao remover o Tailwind CDN ate a compilacao local produzir paridade visual nas telas baseline.
- Nao migrar um segundo modulo antes de os primitivos funcionarem em dois contextos reais.
- Nao declarar uma fase concluida apenas com build; exigir navegador autenticado e matriz de resolucoes.
- Preservar as alteracoes locais existentes e nunca fazer reset ou sobrescrever arquivos fora da fase.
- Se o `apps/crm-james` precisar convergir visualmente, abrir plano separado com sua propria arquitetura, testes e deploy.

## Sequencia recomendada de entrega

| Onda | Entrega | Prioridade | Resultado observavel |
|---|---|---:|---|
| 1 | Baseline + PRODUCT/DESIGN + tokens | P0 | Uma unica fonte de verdade e regressao visual detectavel. |
| 2 | Primitives + shell | P0/P1 | Todas as novas telas ja nascem consistentes. |
| 3 | Dashboard + CRM/Reativacao + Financeiro | P1 | Jornadas de maior valor demonstram o sistema completo. |
| 4 | Agenda + Ortodontia + Laboratorio + Tarefas | P2 | Operacao clinica e interna convergem. |
| 5 | Apoio + administracao | P3 | Cobertura integral do aplicativo principal. |
| 6 | Hardening de acessibilidade, motion e performance | P1/P2 | Sistema pronto para validacao final e publicacao. |

## Metricas de sucesso

- 100% dos modulos roteados usam `PageHeader`, navegacao, estados e controles compartilhados.
- Zero redefinicoes concorrentes de tokens globais.
- Zero `transition-all` no produto entregue.
- Zero texto primario abaixo de 12px.
- Reducao substancial de cores hexadecimais locais; excecoes limitadas a graficos e integracoes documentadas.
- `Financial.tsx`, `Orthodontics.tsx`, `PricingSystem.tsx` e `CommercialDailyReport.tsx` decompostos por view/domino sem mudanca de regra.
- Fluxos prioritarios aprovados em desktop, tablet, mobile, light, dark, teclado e reduced motion.
- Nenhuma divergencia entre sidebar, `App.tsx` e `PermissionsModal.tsx` na matriz de acesso.

## Design documentation

Ao final de cada onda:

1. atualizar `DESIGN.md` apenas com decisoes comprovadas em telas reais;
2. registrar novos primitives e seus estados;
3. manter exemplos de uso e antiuso;
4. guardar capturas de referencia por viewport;
5. registrar excecoes de dominio para impedir que virem novos padroes globais.

## Resultado da execucao local - 11/10/2026

### Concluido

- tokens, estilos compilados localmente e componentes operacionais compartilhados;
- shell, cabecalho, navegacao lateral e estados de carregamento consistentes;
- padronizacao das superficies principais de Dashboard, CRM, Reativacao de Orcamentos, Financeiro, Ortodontia, Laboratorio, Tarefas, Reunioes, Responsabilidades, Biblioteca, Senhas, Suporte e WhatsApp;
- Performance de Vendas reposicionada no topo da visualizacao correspondente;
- KPIs de Reativacao corrigidos para separar tentativas de ligacao e ligacoes efetivas;
- remocao de conteudo ficticio da barra lateral e uso dos dados reais do usuario;
- carregamento sob demanda dos modulos pesados, reduzindo o JavaScript inicial da aplicacao para cerca de 59 kB antes de gzip;
- remocao de `transition-all` e suporte global a `prefers-reduced-motion`;
- login responsivo revisado visualmente em desktop e mobile.

### Evidencias

- `npm.cmd run build`: aprovado;
- `npm.cmd run check:ui`: aprovado em 1440x900 e 390x844, sem overflow horizontal, erros de runtime ou violacoes automatizadas de acessibilidade;
- detector Impeccable: nenhuma ocorrencia;
- `git diff --check`: aprovado;
- capturas e relatorio: `.impeccable/review/`.

### Pendencias tecnicas preexistentes

- a verificacao TypeScript integral ainda encontra contratos antigos inconsistentes entre componentes e modelos do servidor;
- o lint integral ainda aponta dividas anteriores, incluindo hooks condicionais em `FinancialViability`;
- a validacao automatizada autenticada de todos os fluxos depende de uma sessao de teste com papeis reais e nao foi simulada com credenciais ficticias;
- nenhuma publicacao ou deploy foi realizado nesta execucao.
