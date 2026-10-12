# Produto

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Administração da clínica, que acompanha indicadores, permissões, auditoria, financeiro e desempenho geral.
- Recepção, que trabalha com agenda, pacientes, recebimentos, ortodontia, laboratório e rotinas diárias.
- Equipe comercial, incluindo James e Priscila, que acompanha leads, orçamentos, contatos por WhatsApp, ligações, agendamentos, comparecimentos, faltas, conversões e perdas.
- Equipe clínica e operacional, que acompanha trabalhos, tarefas, processos e responsabilidades.

## Product Purpose

O CS3.0 centraliza a operação do Centro do Sorriso em uma única aplicação. O produto existe para que a equipe registre atividades, acompanhe resultados e execute rotinas clínicas, comerciais, financeiras e administrativas sem depender de controles paralelos.

Sucesso significa encontrar rapidamente o registro certo, entender seu estado, executar a próxima ação e manter um histórico confiável por usuário, módulo e momento.

## Positioning

O produto reúne em um mesmo ambiente os fluxos específicos da clínica: gestão financeira, CRM, reativação de orçamentos, agenda, ortodontia, laboratório, tarefas internas, gestão, auditoria, permissões e integrações. As informações e indicadores devem permanecer ligados às ações operacionais que os geram.

## Operating Context

- Uso contínuo em computadores da clínica e acesso eventual em telas menores.
- Navegação por módulos e submódulos condicionada ao papel e às permissões do usuário.
- Trabalho frequente com tabelas, listas, filtros, períodos, valores monetários, datas, telefones e estados operacionais.
- Ações recorrentes incluem registrar lançamentos, atualizar leads, enviar WhatsApp, registrar tentativas e resultados, agendar pacientes, acompanhar presença, movimentar tarefas e consultar indicadores.
- O sistema possui temas claro e escuro.
- O CRM James é uma aplicação separada acessada pelo sistema principal; sua arquitetura e publicação são independentes.

## Capabilities and Constraints

- Aplicação principal em React, TypeScript e Vite, com Supabase e servidor Express.
- Persistência, regras financeiras, cálculos, integrações, permissões, `allowed_tabs` e `allowed_sub_tabs` devem ser preservados durante mudanças visuais.
- Dashboard, CRM, Financeiro, Ortodontia, Laboratório, Gestão, Chamados, Cofre, Processos, Biblioteca, Tarefas, Configurações e Auditoria fazem parte do aplicativo principal.
- As telas precisam lidar com loading, vazio, erro, dados extensos e textos longos em português.
- Publicação local, GitHub e hospedagem são etapas distintas e devem ser relatadas separadamente.
- Dados sensíveis e credenciais não devem aparecer em documentação, histórico visual ou mensagens.

## Brand Commitments

- Nome institucional: Centro do Sorriso.
- Linguagem em português, direta, profissional e adequada à rotina clínica.
- A interface deve parecer um sistema operacional da clínica, não uma página de marketing.
- A identidade deve ser sóbria e coesa, evitando excesso de cores e efeitos decorativos.

## Evidence on Hand

- Código e rotas do aplicativo principal em `src/`.
- Matriz de navegação e permissões em `src/App.tsx`, `src/components/Sidebar.tsx`, `src/components/PermissionsModal.tsx` e `src/types.ts`.
- Dados e integrações persistidos por Supabase e APIs do servidor.
- Capturas locais `app_shot.png` e `system_shot.png`; elas não substituem uma nova baseline autenticada.
- Plano aprovado em `design-plans/2026-10-11-renovacao-visual-sistema-cs30.md`.

Não há autorização para inventar resultados clínicos, depoimentos, métricas institucionais ou dados de pacientes.

## Product Principles

1. A próxima ação deve ser evidente sem esconder o contexto necessário para tomá-la.
2. Dados, permissões, cálculos e rastreabilidade têm prioridade sobre ornamentação.
3. Controles equivalentes devem funcionar e parecer iguais em todos os módulos.
4. Densidade é permitida quando melhora comparação; legibilidade e área de interação não podem ser sacrificadas.
5. Toda mudança deve ser validada no fluxo real, não apenas por build ou inspeção de código.

## Accessibility & Inclusion

- Operação completa por teclado nos fluxos principais.
- Foco visível, nomes acessíveis e estados que não dependem apenas de cor.
- Contraste compatível com WCAG AA nos temas claro e escuro.
- Interface utilizável com zoom de 200% e em telas móveis.
- Movimento reduzido deve preservar compreensão sem deslocamentos desnecessários.
