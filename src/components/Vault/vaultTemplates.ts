// Notion-like Templates for Management Workspace
export interface VaultTemplate {
  id: string;
  title: string;
  emoji: string;
  category: string;
  tags: string[];
  description: string;
  content: string;
}

export const VAULT_TEMPLATES: VaultTemplate[] = [
  {
    id: 'tpl_ata_socios',
    title: 'Ata de Reunião de Sócios & Diretoria',
    emoji: '🏛️',
    category: 'Estratégia & Sócios',
    tags: ['Sócios', 'Diretoria', 'Decisões', 'Confidencial'],
    description: 'Registro formal de deliberações, investimentos e divisão de lucros da gestão.',
    content: `# Ata de Reunião Estratégica da Diretoria

**Data:** ${new Date().toLocaleDateString('pt-BR')}  
**Local / Formato:** Presencial / Sala da Gestão  
**Participantes:** Sócios Administradores e Diretor Clínico  

---

## 🎯 1. Pauta da Reunião
1. Avaliação do faturamento e margem líquida do último mês.
2. Planejamento de investimentos em novos equipamentos odontológicos (Scanner / Raio-X Digital).
3. Diretrizes de distribuição de lucros e retenção para reserva de contingência.
4. Ajuste na tabela de comissões de parceiros e especialistas.

---

## 📊 2. Deliberações & Acordos
> 🔒 **Acordo de Sócios:** Fica aprovada por unanimidade a retenção de 15% do lucro líquido operacional para composição do Fundo de Expansão e 10% para Reserva de Emergência.

- **Investimentos Aprovados:**
  - [x] Negociação de leasing para Scanner Intraoral com carência de 60 dias.
  - [ ] Homologação do novo sistema de cobrança recorrente automatizada via WhatsApp.
  - [ ] Contratação de consultoria contábil para revisão do enquadramento tributário (Simples vs Lucro Presumido).

---

## 🚀 3. Plano de Ação & Prazos
- **Ação 1:** Solicitar propostas comerciais de 3 fornecedores de equipamentos. *(Responsável: Direção Geral | Prazo: 15 dias)*
- **Ação 2:** Fechar DRE gerencial auditada do trimestre. *(Responsável: Financeiro/Gestão | Prazo: 10 dias)*
- **Ação 3:** Apresentar minuta de aditivo contratual para sócios cotistas. *(Responsável: Assessoria Jurídica | Prazo: 30 dias)*

---
*Documento restrito aos sócios administradores. Proibida reprodução ou compartilhamento sem anuência prévia.*`
  },
  {
    id: 'tpl_planejamento_okrs',
    title: 'Planejamento Estratégico & Metas (OKRs)',
    emoji: '🎯',
    category: 'Estratégia & Sócios',
    tags: ['Metas', 'OKRs', 'Crescimento', '2026'],
    description: 'Estrutura completa de Objetivos e Resultados-Chave para o ano/trimestre.',
    content: `# Planejamento Estratégico & OKRs da Clínica

> 💡 **Visão da Gestão:** Consolidar a clínica como referência em Ortodontia, Implantes e Estética Odontológica de alta performance na região, mantendo excelência no NPS e rentabilidade líquida acima de 25%.

---

## 🏆 Objetivo 1: Atingir Faturamento Recorde com Rentabilidade Saudável
- **KR 1.1:** Elevar o faturamento mensal médio de R$ 120.000 para R$ 180.000 até o Q4.
- **KR 1.2:** Aumentar a taxa de conversão de primeiras avaliações de 62% para 78%.
- **KR 1.3:** Reduzir o índice de inadimplência ativa para menos de 3.5%.

---

## ⚡ Objetivo 2: Excelência Operacional & Redução de Custos
- **KR 2.1:** Renegociar tabela de custos com laboratórios de prótese parceiros (-8% de custo médio).
- **KR 2.2:** Otimizar tempo de cadeira ociosa para menos de 12% da grade mensal.
- **KR 2.3:** Digitalizar 100% dos prontuários e assinaturas de termos via app.

---

## 📝 Ações Prioritárias em Execução
- [ ] Lançamento de campanha de captação para alinhadores invisíveis e estética.
- [ ] Treinamento intensivo da recepção em técnica de fechamento SPIN Selling.
- [ ] Implementação de pesquisa de satisfação NPS pós-tratamento com envio automático.
- [ ] Auditoria quinzenal de estoque de insumos de alto valor.`
  },
  {
    id: 'tpl_prolabore_bonificacoes',
    title: 'Diretriz de Pró-Labore & Bonificações da Gestão',
    emoji: '💰',
    category: 'RH & Remuneração',
    tags: ['Pró-labore', 'Bônus', 'Sócios', 'Comissões'],
    description: 'Critérios confidenciais de remuneração de sócios, metas de gratificação e dividendos.',
    content: `# Política Restrita de Remuneração e Bonificações

---

## 💵 1. Estrutura de Pró-Labore dos Sócios
- **Sócio 1 (Diretor Clínico / RT):** Pró-labore fixo mensal + comissionamento sobre procedimentos de alta complexidade executados.
- **Sócio 2 (Diretor Executivo & Operações):** Pró-labore fixo mensal + gratificação por cumprimento de meta global de faturamento e margem.

---

## 🎁 2. Regra de Distribuição de Lucros (Dividendos)
1. **Periodicidade:** Apuração trimestral com fechamento até o 10º dia útil após o trimestre.
2. **Critérios de Elegibilidade:**
   - A clínica deve possuir saldo em caixa equivalente a no mínimo 3 meses de despesas fixas (Fundo de Segurança).
   - Sem pendências tributárias ou trabalhistas vencidas.
3. **Divisão de Cotas:**
   - 50% Sócio Diretor Clínico
   - 50% Sócio Diretor Executivo

---

## 🎯 3. Programa de Bônus por Metas para Equipe-Chave
- **Recepção / Comercial:** Bônus mensal de até 15% sobre o salário base vinculado à meta batida de conversão de avaliações.
- **Especialistas Parceiros:** Repasse de 40% a 50% líquido do valor do procedimento realizado.`
  },
  {
    id: 'tpl_checklist_auditoria',
    title: 'Checklist de Auditoria & Segurança Operacional',
    emoji: '🛡️',
    category: 'Operações Confidenciais',
    tags: ['Auditoria', 'Segurança', 'Compliance', 'Gestão'],
    description: 'Rotina de verificação sigilosa de contas, acessos, conformidade e estoque crítico.',
    content: `# Checklist Confidencial de Auditoria Periódica

---

### 🔍 Auditoria Financeira & Bancária
- [ ] Conciliação de 100% das maquininhas de cartão com extrato bancário.
- [ ] Verificação de cancelamentos ou estornos de procedimentos no mês.
- [ ] Conferência de sangria e fechamento de caixa físico diário.
- [ ] Validação de notas fiscais emitidas versus faturamento real recebido.

---

### 🔐 Segurança de Dados & Acessos
- [ ] Troca trimestral da senha mestra do sistema e das contas bancárias corporativas.
- [ ] Auditoria de permissões de colaboradores ativos vs ex-funcionários no software.
- [ ] Verificação do backup automático em nuvem do banco de imagens e prontuários.
- [ ] Revisão dos logs de acessos confidenciais e registros de ponto.

---

### 📦 Controle Patrimonial & Insumos Críticos
- [ ] Contagem física de implantes, biomateriais e anestésicos especiais.
- [ ] Vistoria de calibragem de autoclaves e seladoras com laudo biológico arquivado.
- [ ] Revisão das apólices de seguro predial e responsabilidade civil profissional.`
  },
  {
    id: 'tpl_acordo_parcerias',
    title: 'Contratos & Acordos Estratégicos com Parceiros',
    emoji: '🤝',
    category: 'Contratos & Jurídico',
    tags: ['Jurídico', 'Parcerias', 'Contratos', 'Fornecedores'],
    description: 'Modelos e anotações confidenciais sobre condições negociadas com terceiros.',
    content: `# Acordos & Condições Especiais Negociadas

---

## 🏢 1. Laboratórios de Prótese Credenciados
- **Lab Dental Master:**
  - *Condição:* 12% de desconto para faturamento mensal superior a R$ 10.000.
  - *Prazo de Entrega Padrão:* 7 dias úteis para cerâmica / 4 dias para provisórios.
  - *Garantia de Repetição sem custo:* 90 dias em caso de falha estrutural.

---

## 📦 2. Dental & Insumos de Cirurgia
- **Dental Prime Sul:**
  - *Condição:* Pagamento faturado em 30/60/90 dias com frete grátis fixo.
  - *Contato do Representante Executivo:* João Pedro (48) 99888-1234.

---

## ⚖️ 3. Assessoria Jurídica e Contabilidade
- **Escritório Jurídico:** Dr. Roberto - Contrato de retenção mensal para defesa do consumidor e contratos de trabalho.
- **Contabilidade Especializada:** AuditaClin - Acompanhamento mensal de livro-caixa, pró-labore e DMED.`
  },
  {
    id: 'tpl_blank',
    title: 'Documento em Branco',
    emoji: '📄',
    category: 'Geral',
    tags: ['Rascunho', 'Gestão'],
    description: 'Comece uma página limpa no estilo Notion para anotações livres.',
    content: `# Nova Página da Gestão

Escreva aqui suas ideias, planejamentos, notas confidenciais ou diretrizes...

---

## 📌 Tópicos Principais
- Ponto 1
- Ponto 2

### ⚡ Checklist de Ações
- [ ] Primeira etapa
- [ ] Segunda etapa

> 💡 *Dica:* Utilize os botões da barra superior para inserir cabeçalhos, tabelas, caixas de alerta e listas interativas.`
  }
];
