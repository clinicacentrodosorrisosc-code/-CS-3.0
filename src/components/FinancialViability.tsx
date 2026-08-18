import React, { useState, useMemo, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  Sliders, 
  Plus, 
  Trash2, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldCheck, 
  Lock, 
  HelpCircle, 
  Award, 
  Percent, 
  Calculator, 
  History, 
  Copy, 
  Download, 
  RefreshCw, 
  Target, 
  Zap, 
  BarChart3, 
  ArrowUpRight, 
  ArrowDownRight, 
  Layers,
  ChevronRight,
  Info,
  Calendar,
  Eye,
  Settings,
  UserCheck,
  Stethoscope
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend, 
  BarChart, 
  Bar, 
  Cell, 
  AreaChart, 
  Area,
  ComposedChart
} from 'recharts';
import { SpotlightCard } from './ui/spotlight-card';
import { Transaction } from '../types';
import { toast } from 'sonner';

export interface CommissionTier {
  minRevenue: number;
  maxRevenue?: number;
  percentage: number;
  label?: string;
}

export interface ScenarioRule {
  id: string;
  name: string;
  description: string;
  isCurrent?: boolean; // Modelo Atual
  targetGroup: 'Comercial' | 'Toda a Equipe' | 'Recepção & Apoio' | 'Clínico & Geral' | 'Personalizado';
  ruleType: 'trigger' | 'flat' | 'tiered' | 'dentists_2_comm_reception'; // gatilho único, fixo em tudo, escalonado ou 2 dentistas+comercial+recepção
  triggerAmount: number; // Ex: 45000 ou 70000
  percentage: number; // Ex: 2% ou 1%
  applyOnSurplusOnly: boolean; // se true: aplica % apenas sobre o que passar da meta; se false: aplica sobre o faturamento total assim que bate a meta
  excludeOrtho: boolean; // se true: NÃO contabiliza pacientes/receitas de Ortodontia
  beneficiariesCount: number; // Quantidade de pessoas que receberão esse valor individualmente (ex: 4 pessoas = 4 x valor)
  customRevenue?: number; // Faturamento total específico deste cenário (editável individualmente)
  customOrthoPct?: number; // Fatia de ortodontia específica deste cenário (editável individualmente)
  bonusFixedAmount?: number; // bônus fixo extra por pessoa ao atingir supermeta
  bonusTriggerAmount?: number; // meta para ganhar o bônus fixo extra
  tiers?: CommissionTier[]; // para regras escalonadas
  color: string;
}

interface FinancialViabilityProps {
  transactions?: Transaction[];
  userRole?: string;
}

// Modelos Iniciais Base e Alternativos
const DEFAULT_SCENARIOS: ScenarioRule[] = [
  {
    id: 'current_commercial_tiered',
    name: 'Modelo Atual (Comercial: 2% > 45k | 3% > 55k | 5% > 60k)',
    description: 'Comercial ganha sobre o total vendido SEM Ortodontia: 0% (<45k), 2% (45k a 54.9k), 3% (55k a 59.9k) e 5% (≥ 60k). Ortodontia NÃO contabiliza.',
    isCurrent: true,
    targetGroup: 'Comercial',
    ruleType: 'tiered',
    triggerAmount: 45000,
    percentage: 2.0,
    applyOnSurplusOnly: false,
    excludeOrtho: true,
    beneficiariesCount: 1,
    customRevenue: 80000,
    customOrthoPct: 25,
    tiers: [
      { minRevenue: 0, maxRevenue: 45000, percentage: 0.0, label: 'Abaixo de 45k (0%)' },
      { minRevenue: 45000, maxRevenue: 55000, percentage: 2.0, label: '45k a 55k (2%)' },
      { minRevenue: 55000, maxRevenue: 60000, percentage: 3.0, label: '55k a 60k (3%)' },
      { minRevenue: 60000, percentage: 5.0, label: 'A partir de 60k (5%)' }
    ],
    color: '#3b82f6' // Azul
  },
  {
    id: 'team_tiered_70k_80k',
    name: 'Proposta 1 (Time Todo: 1% > 0 | 2% > 70k | 3% > 80k)',
    description: 'Toda a equipe ganha sobre o faturamento total: 1% (até 70k), 2% (70k a 80k) e 3% (acima de 80k) pago integralmente para cada colaborador.',
    targetGroup: 'Toda a Equipe',
    ruleType: 'tiered',
    triggerAmount: 0,
    percentage: 1.0,
    applyOnSurplusOnly: false,
    excludeOrtho: false,
    beneficiariesCount: 4, // 4 pessoas recebendo a comissão individual
    customRevenue: 80000,
    customOrthoPct: 25,
    tiers: [
      { minRevenue: 0, maxRevenue: 70000, percentage: 1.0, label: 'Até 70k (1% cada)' },
      { minRevenue: 70000, maxRevenue: 80000, percentage: 2.0, label: '70k a 80k (2% cada)' },
      { minRevenue: 80000, percentage: 3.0, label: 'Acima de 80k (3% cada)' }
    ],
    color: '#10b981' // Verde Esmeralda
  },
  {
    id: 'commercial_70k_2pct',
    name: 'Proposta 2 (Comercial 2% a partir de 70k)',
    description: 'Comercial ganha 2% sobre o vendido (sem Ortodontia) apenas ao atingir R$ 70.000 ou mais. Pago para 1 profissional.',
    targetGroup: 'Comercial',
    ruleType: 'trigger',
    triggerAmount: 70000,
    percentage: 2.0,
    applyOnSurplusOnly: false,
    excludeOrtho: true,
    beneficiariesCount: 1,
    customRevenue: 80000,
    customOrthoPct: 25,
    color: '#f59e0b' // Âmbar
  },
  {
    id: 'dentists_2_comm_reception_hybrid',
    name: 'Proposta 3 (2 Dentistas + Comercial Atual + Recepção 0.5%)',
    description: 'Dentista 1 ganha 1% COM Orto + Dentista 2 ganha 1% SEM Orto + Comercial segue o modelo atual (2%/3%/5% sem Orto) + Recepção ganha 0.5% do total da clínica.',
    targetGroup: 'Personalizado',
    ruleType: 'dentists_2_comm_reception',
    triggerAmount: 0,
    percentage: 1.0,
    applyOnSurplusOnly: false,
    excludeOrtho: false,
    beneficiariesCount: 1,
    customRevenue: 80000,
    customOrthoPct: 25,
    color: '#06b6d4' // Ciano
  }
];

export const FinancialViability: React.FC<FinancialViabilityProps> = ({ transactions = [], userRole = 'admin' }) => {
  // Trava de segurança: somente admin
  if (userRole !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-surface/50 border border-border rounded-2xl text-center">
        <div className="size-16 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center mb-4">
          <Lock className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-text mb-2 font-display">Acesso Restrito à Diretoria</h3>
        <p className="text-sm text-slate-400 max-w-md">
          O Painel de Viabilidade Financeira e Simulador de Comissões é visível e acessível exclusivamente para perfis de Administrador.
        </p>
      </div>
    );
  }

  // Estados dos Cenários
  const [scenarios, setScenarios] = useState<ScenarioRule[]>(() => {
    try {
      const saved = localStorage.getItem('om_viability_scenarios_v7');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Erro ao carregar cenários:', e);
    }
    return DEFAULT_SCENARIOS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('om_viability_scenarios_v7', JSON.stringify(scenarios));
    } catch (e) {
      console.warn('Erro ao salvar cenários:', e);
    }
  }, [scenarios]);

  // Estados Gerais de Simulação
  const [activeTab, setActiveTab] = useState<'simulator' | 'comparison' | 'historical' | 'settings'>('simulator');
  const [selectedHistoricalMonth, setSelectedHistoricalMonth] = useState<string | null>(null);
  
  // Parâmetros de Custos e Margens da Clínica (Customizáveis)
  const [taxesAndFeesPct, setTaxesAndFeesPct] = useState<number>(9.5); // Impostos + Taxa de Cartão (% médio)
  const [directMaterialsPct, setDirectMaterialsPct] = useState<number>(12.0); // Custo de Materiais/Laboratório Direto (% médio)
  const [fixedExpenses, setFixedExpenses] = useState<number>(22000); // Custos Fixos Mensais (Aluguel, Salários Fixos, Luz, etc.)

  // Modal de Criação / Edição de Cenário
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingScenario, setEditingScenario] = useState<ScenarioRule | null>(null);
  const [formScenario, setFormScenario] = useState<ScenarioRule>({
    id: '',
    name: '',
    description: '',
    targetGroup: 'Toda a Equipe',
    ruleType: 'flat',
    triggerAmount: 0,
    percentage: 1.0,
    applyOnSurplusOnly: false,
    excludeOrtho: false,
    beneficiariesCount: 4,
    customRevenue: 80000,
    customOrthoPct: 25,
    bonusFixedAmount: 0,
    bonusTriggerAmount: 0,
    color: '#06b6d4'
  });

  // Histórico Real da Clínica (Calculado a partir das Transactions)
  const historicalMonthlyData = useMemo(() => {
    const mapTotal = new Map<string, number>();
    const mapOrtho = new Map<string, number>();

    transactions.forEach(t => {
      if (t.type === 'income' && t.status === 'Paid') {
        const date = t.settlementDate || t.date;
        if (date && date.length >= 7) {
          const monthKey = date.substring(0, 7); // 'YYYY-MM'
          mapTotal.set(monthKey, (mapTotal.get(monthKey) || 0) + (t.amount || 0));

          const desc = ((t.category || '') + ' ' + (t.procedure || '') + ' ' + (t.description || '')).toLowerCase();
          if (desc.includes('orto') || desc.includes('aparelho') || desc.includes('manutenção orto') || desc.includes('alinhador')) {
            mapOrtho.set(monthKey, (mapOrtho.get(monthKey) || 0) + (t.amount || 0));
          }
        }
      }
    });

    const months = Array.from(mapTotal.keys()).sort();
    if (months.length === 0) {
      const mockMonths = [
        { month: '2026-01', label: 'Jan/26', revenue: 48000, ortho: 12000 },
        { month: '2026-02', label: 'Fev/26', revenue: 54000, ortho: 13500 },
        { month: '2026-03', label: 'Mar/26', revenue: 68000, ortho: 16000 },
        { month: '2026-04', label: 'Abr/26', revenue: 78000, ortho: 19500 },
        { month: '2026-05', label: 'Mai/26', revenue: 62000, ortho: 15500 },
        { month: '2026-06', label: 'Jun/26', revenue: 86000, ortho: 21000 },
        { month: '2026-07', label: 'Jul/26', revenue: 95000, ortho: 23000 },
        { month: '2026-08', label: 'Ago/26 (Atual)', revenue: 79000, ortho: 19000 }
      ];

      return mockMonths.map(item => {
        const commEligible = item.revenue - item.ortho;
        const realOrthoPct = item.revenue > 0 ? (item.ortho / item.revenue) * 100 : 0;
        return { 
          ...item, 
          commEligible, 
          orthoPct: realOrthoPct.toFixed(0) 
        };
      });
    }

    return months.slice(-8).map(mKey => {
      const revenue = mapTotal.get(mKey) || 0;
      const ortho = mapOrtho.get(mKey) || 0;
      const commEligible = Math.max(0, revenue - ortho);
      const realOrthoPct = revenue > 0 ? (ortho / revenue) * 100 : 0;

      const [year, month] = mKey.split('-');
      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const label = `${monthNames[parseInt(month, 10) - 1]}/${year.slice(2)}`;
      
      return { 
        month: mKey, 
        label, 
        revenue, 
        ortho, 
        commEligible, 
        orthoPct: realOrthoPct.toFixed(0) 
      };
    });
  }, [transactions]);

  // Carregar dados validados de um mês histórico para todos os cenários
  const handleApplyHistoricalMonthToAll = (m: any) => {
    const rev = m.revenue;
    const orthoP = parseFloat(m.orthoPct) || 25;
    setSelectedHistoricalMonth(m.label);
    
    setScenarios(prev => prev.map(sc => ({
      ...sc,
      customRevenue: rev,
      customOrthoPct: orthoP
    })));

    toast.success(`Valores validados de ${m.label} aplicados em todos os cenários!`, {
      description: `Faturamento: R$ ${rev.toLocaleString('pt-BR')} | Ortodontia: R$ ${m.ortho.toLocaleString('pt-BR')} (${orthoP}%)`
    });
  };

  // Atualizar campo individual de um cenário
  const handleUpdateScenarioField = (id: string, field: keyof ScenarioRule, value: any) => {
    setScenarios(prev => prev.map(sc => sc.id === id ? { ...sc, [field]: value } : sc));
  };

  // Função para calcular a comissão por pessoa e custo total da clínica
  const calculateCommission = (
    rule: ScenarioRule, 
    totalRevenue: number = rule.customRevenue || 80000, 
    orthoPct: number = rule.customOrthoPct !== undefined ? rule.customOrthoPct : 25
  ): { 
    amountPerPerson: number; 
    totalClinicAmount: number; 
    effectivePct: number; 
    baseRevenueUsed: number; 
    activeTierLabel?: string;
    peopleCount: number;
    breakdownDetails?: { label: string; amount: number; pct: string }[];
  } => {
    if (totalRevenue <= 0) {
      return { amountPerPerson: 0, totalClinicAmount: 0, effectivePct: 0, baseRevenueUsed: 0, peopleCount: rule.beneficiariesCount || 1 };
    }

    const orthoRevenue = totalRevenue * (orthoPct / 100);
    const commercialEligible = totalRevenue - orthoRevenue;

    // Cenário Proposta 3: 2 Dentistas (1 COM Orto + 1 SEM Orto) + Comercial Atual + Recepção 0.5%
    if (rule.ruleType === 'dentists_2_comm_reception') {
      const generalClinicalRevenue = commercialEligible; // faturamento de clínica geral dividido entre os 2 dentistas
      const d1Production = orthoRevenue + (generalClinicalRevenue / 2); // Dentista 1: Ortodontia + metade da clínica
      const d2Production = generalClinicalRevenue / 2; // Dentista 2: metade da clínica geral (sem Orto)

      const d1Cost = d1Production * 0.01; // 1% com Orto
      const d2Cost = d2Production * 0.01; // 1% sem Orto
      const totalDentistsCost = d1Cost + d2Cost;

      // Comercial Atual sobre vendas sem Orto
      let commPctUsed = 0;
      if (commercialEligible >= 60000) commPctUsed = 0.05;
      else if (commercialEligible >= 55000) commPctUsed = 0.03;
      else if (commercialEligible >= 45000) commPctUsed = 0.02;
      const commercialCost = commercialEligible * commPctUsed;

      // Recepção: 0.5% do total da clínica
      const receptionCost = totalRevenue * 0.005;

      const totalClinicAmount = totalDentistsCost + commercialCost + receptionCost;
      const effectivePct = totalRevenue > 0 ? (totalClinicAmount / totalRevenue) * 100 : 0;

      return {
        amountPerPerson: totalClinicAmount,
        totalClinicAmount,
        effectivePct,
        baseRevenueUsed: totalRevenue,
        activeTierLabel: `Dent.1 (c/ Orto): 1% • Dent.2 (s/ Orto): 1% • Com.: ${(commPctUsed * 100).toFixed(0)}% • Recep.: 0.5%`,
        peopleCount: 4, // 2 dentistas + 1 comercial + 1 recepção
        breakdownDetails: [
          { label: 'Dentista 1 (1% c/ Orto)', amount: d1Cost, pct: '1% prod.' },
          { label: 'Dentista 2 (1% s/ Orto)', amount: d2Cost, pct: '1% prod.' },
          { label: `Comercial (${(commPctUsed * 100).toFixed(0)}% s/ Orto)`, amount: commercialCost, pct: `${(commPctUsed * 100).toFixed(0)}%` },
          { label: 'Recepção (0.5% Total)', amount: receptionCost, pct: '0.5%' }
        ]
      };
    }

    // Se a regra exclui ortodontia, o faturamento base para atingir a meta e calcular o % é apenas o que não é Orto
    const baseRevenueUsed = rule.excludeOrtho 
      ? commercialEligible
      : totalRevenue;

    const peopleCount = rule.beneficiariesCount || 1;

    let amountPerPerson = 0;
    let activeTierLabel: string | undefined = undefined;

    if (rule.ruleType === 'flat') {
      amountPerPerson = baseRevenueUsed * (rule.percentage / 100);
      activeTierLabel = `${rule.percentage}% para cada`;
    } else if (rule.ruleType === 'trigger') {
      if (baseRevenueUsed >= rule.triggerAmount) {
        if (rule.applyOnSurplusOnly) {
          amountPerPerson = (baseRevenueUsed - rule.triggerAmount) * (rule.percentage / 100);
        } else {
          amountPerPerson = baseRevenueUsed * (rule.percentage / 100);
        }
        activeTierLabel = `${rule.percentage}% (meta atingida)`;
      } else {
        amountPerPerson = 0;
        activeTierLabel = 'Meta não atingida (0%)';
      }
    } else if (rule.ruleType === 'tiered' && rule.tiers && rule.tiers.length > 0) {
      const activeTier = rule.tiers.find(t => baseRevenueUsed >= t.minRevenue && (t.maxRevenue === undefined || baseRevenueUsed < t.maxRevenue)) 
        || rule.tiers[rule.tiers.length - 1];
      if (activeTier) {
        amountPerPerson = baseRevenueUsed * (activeTier.percentage / 100);
        activeTierLabel = activeTier.label || `${activeTier.percentage}%`;
      }
    }

    // Adiciona bônus fixo por pessoa se atingiu a supermeta
    if (rule.bonusFixedAmount && rule.bonusTriggerAmount && baseRevenueUsed >= rule.bonusTriggerAmount) {
      amountPerPerson += rule.bonusFixedAmount;
    }

    // CADA pessoa recebe amountPerPerson, custo da clínica é (amountPerPerson * peopleCount)
    const totalClinicAmount = amountPerPerson * peopleCount;
    const effectivePct = totalRevenue > 0 ? (totalClinicAmount / totalRevenue) * 100 : 0;

    return { 
      amountPerPerson, 
      totalClinicAmount, 
      effectivePct, 
      baseRevenueUsed, 
      activeTierLabel,
      peopleCount 
    };
  };

  // Cálculo detalhado de viabilidade para os cenários atuais
  const currentScenario = scenarios.find(s => s.isCurrent) || scenarios[0];

  const simulationResults = useMemo(() => {
    return scenarios.map(scenario => {
      const rev = scenario.customRevenue || 80000;
      const orthoP = scenario.customOrthoPct !== undefined ? scenario.customOrthoPct : 25;
      const orthoRev = rev * (orthoP / 100);
      const commEligible = rev - orthoRev;

      const { 
        amountPerPerson, 
        totalClinicAmount, 
        effectivePct: commPct, 
        baseRevenueUsed, 
        activeTierLabel, 
        peopleCount,
        breakdownDetails
      } = calculateCommission(scenario, rev, orthoP);
      
      const taxesAndFees = rev * (taxesAndFeesPct / 100);
      const directMaterials = rev * (directMaterialsPct / 100);
      const totalVariableCosts = taxesAndFees + directMaterials + totalClinicAmount;
      const contributionMarginR$ = rev - totalVariableCosts;
      const contributionMarginPct = rev > 0 ? (contributionMarginR$ / rev) * 100 : 0;

      const netProfit = contributionMarginR$ - fixedExpenses;
      const netMarginPct = rev > 0 ? (netProfit / rev) * 100 : 0;

      // Comparação com o Modelo Atual no faturamento deste cenário
      const currentClinicCost = calculateCommission(currentScenario, rev, orthoP).totalClinicAmount;
      const currentNetProfit = (rev - (taxesAndFees + directMaterials + currentClinicCost)) - fixedExpenses;
      const costDiff = totalClinicAmount - currentClinicCost;
      const profitDiff = netProfit - currentNetProfit;

      // Elasticidade / Break-even do aumento
      const baseContributionMarginRate = Math.max(0.1, (contributionMarginPct / 100));
      const requiredExtraSales = costDiff > 0 ? costDiff / baseContributionMarginRate : 0;
      const requiredGrowthPct = (costDiff > 0 && rev > 0) ? (requiredExtraSales / rev) * 100 : 0;

      return {
        scenario,
        rev,
        orthoP,
        orthoRev,
        commEligible,
        amountPerPerson,
        totalClinicAmount,
        commPct,
        peopleCount,
        baseRevenueUsed,
        activeTierLabel,
        breakdownDetails,
        taxesAndFees,
        directMaterials,
        totalVariableCosts,
        contributionMarginR$,
        contributionMarginPct,
        netProfit,
        netMarginPct,
        costDiff,
        profitDiff,
        requiredExtraSales,
        requiredGrowthPct
      };
    });
  }, [scenarios, taxesAndFeesPct, directMaterialsPct, fixedExpenses, currentScenario]);

  // Curva de Faturamento para Gráficos Comparativos
  const chartRevenuePoints = useMemo(() => {
    const points: number[] = [30000, 45000, 55000, 60000, 70000, 80000, 90000, 100000, 120000, 140000, 160000];
    return points.map(rev => {
      const pointData: any = {
        revenue: rev,
        revenueLabel: `R$ ${(rev / 1000).toFixed(0)}k`
      };

      scenarios.forEach(sc => {
        const orthoP = sc.customOrthoPct !== undefined ? sc.customOrthoPct : 25;
        const { totalClinicAmount: comm } = calculateCommission(sc, rev, orthoP);
        const taxes = rev * (taxesAndFeesPct / 100);
        const mat = rev * (directMaterialsPct / 100);
        const netProf = rev - (taxes + mat + comm) - fixedExpenses;
        const netMargin = rev > 0 ? (netProf / rev) * 100 : 0;

        pointData[`comm_${sc.id}`] = comm;
        pointData[`margin_${sc.id}`] = parseFloat(netMargin.toFixed(1));
        pointData[`profit_${sc.id}`] = netProf;
      });

      return pointData;
    });
  }, [scenarios, taxesAndFeesPct, directMaterialsPct, fixedExpenses]);

  // Histórico com cálculo dos cenários
  const historicalCalculatedData = useMemo(() => {
    return historicalMonthlyData.map(item => {
      const results: any = { ...item };
      scenarios.forEach(sc => {
        const orthoP = parseFloat(item.orthoPct) || 25;
        const { totalClinicAmount } = calculateCommission(sc, item.revenue, orthoP);
        results[`comm_${sc.id}`] = totalClinicAmount;
      });
      return results;
    });
  }, [historicalMonthlyData, scenarios]);

  // Handlers para Criar / Editar Cenários
  const handleOpenNewScenario = () => {
    setEditingScenario(null);
    setFormScenario({
      id: 'custom_' + Date.now(),
      name: 'Novo Cenário Personalizado',
      description: 'Regra de incentivo customizada.',
      targetGroup: 'Toda a Equipe',
      ruleType: 'flat',
      triggerAmount: 0,
      percentage: 1.0,
      applyOnSurplusOnly: false,
      excludeOrtho: false,
      beneficiariesCount: 4,
      customRevenue: 80000,
      customOrthoPct: 25,
      bonusFixedAmount: 0,
      bonusTriggerAmount: 0,
      color: '#06b6d4'
    });
    setIsModalOpen(true);
  };

  const handleEditScenario = (sc: ScenarioRule) => {
    setEditingScenario(sc);
    setFormScenario({ ...sc });
    setIsModalOpen(true);
  };

  const handleSaveScenario = () => {
    if (!formScenario.name.trim()) {
      toast.error('Informe o nome do cenário.');
      return;
    }

    if (editingScenario) {
      setScenarios(prev => prev.map(s => s.id === editingScenario.id ? { ...formScenario } : s));
      toast.success('Cenário atualizado com sucesso!');
    } else {
      setScenarios(prev => [...prev, { ...formScenario, id: 'custom_' + Date.now() }]);
      toast.success('Novo cenário adicionado!');
    }
    setIsModalOpen(false);
  };

  const handleDeleteScenario = (id: string) => {
    const sc = scenarios.find(s => s.id === id);
    if (sc?.isCurrent) {
      toast.error('Não é possível excluir o Modelo Atual.');
      return;
    }
    if (confirm('Deseja realmente remover este cenário?')) {
      setScenarios(prev => prev.filter(s => s.id !== id));
      toast.success('Cenário removido.');
    }
  };

  const handleResetDefaults = () => {
    if (confirm('Restaurar os 4 cenários padrão do sistema (incluindo as regras de 2 Dentistas, Comercial e Time Todo)?')) {
      setScenarios(DEFAULT_SCENARIOS);
      toast.success('Cenários restaurados para o padrão.');
    }
  };

  // Copiar parecer executivo
  const handleCopySummary = () => {
    let report = `📊 PARECER DE VIABILIDADE & COMISSIONAMENTO\n\n`;
    
    simulationResults.forEach(res => {
      report += `🔹 ${res.scenario.name}\n`;
      report += `   - Faturamento Testado: R$ ${res.rev.toLocaleString('pt-BR')} (Orto: ${res.orthoP}% | Base Comercial: R$ ${res.commEligible.toLocaleString('pt-BR')})\n`;
      report += `   - Beneficiários: ${res.peopleCount} ${res.peopleCount > 1 ? 'pessoas' : 'pessoa'}\n`;
      report += `   - CUSTO TOTAL DA CLÍNICA: R$ ${res.totalClinicAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${res.commPct.toFixed(2)}% do faturamento)\n`;
      if (res.breakdownDetails && res.breakdownDetails.length > 0) {
        res.breakdownDetails.forEach(b => {
          report += `     • ${b.label}: R$ ${b.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
        });
      } else {
        report += `   - Valor Pago A CADA UM: R$ ${res.amountPerPerson.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
      }
      report += `   - Lucro Líquido dos Sócios: R$ ${res.netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (Margem: ${res.netMarginPct.toFixed(1)}%)\n`;
      if (!res.scenario.isCurrent) {
        report += `   - Diferença vs Atual: ${res.costDiff >= 0 ? '+' : ''}R$ ${res.costDiff.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
        if (res.costDiff > 0) {
          report += `   - Vendas Extras Necessárias: +R$ ${res.requiredExtraSales.toLocaleString('pt-BR', { minimumFractionDigits: 0 })} (+${res.requiredGrowthPct.toFixed(1)}%)\n`;
        }
      }
      report += `\n`;
    });

    navigator.clipboard.writeText(report);
    toast.success('Parecer copiado para a área de transferência!');
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      {/* HEADER EXECUTIVO & NAVEGAÇÃO INTERNA */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-border">
        <div className="flex items-center gap-4">
          <div className="size-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <Calculator className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-text font-display">Viabilidade Financeira & Comissionamento</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Exclusivo Sócios
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Simulador com edição individual por cenário (Faturamento, Ortodontia, Pessoas e Regras específicas).
            </p>
          </div>
        </div>

        {/* Botões de Ação do Topo */}
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={handleCopySummary}
            className="px-4 py-2.5 rounded-xl bg-surface hover:bg-panel border border-border text-slate-300 hover:text-white text-xs font-bold flex items-center gap-2 transition-all shadow-sm active:scale-95"
            title="Copiar resumo para enviar no WhatsApp da diretoria"
          >
            <Copy className="w-3.5 h-3.5 text-indigo-400" /> Copiar Parecer
          </button>
          <button 
            onClick={handleOpenNewScenario}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/25 active:scale-95"
          >
            <Plus className="w-4 h-4" /> Criar Novo Cenário
          </button>
        </div>
      </div>

      {/* SELETOR DE SUB-ABAS INTERNAS */}
      <div className="flex items-center gap-2 border-b border-border pb-3 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('simulator')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all ${
            activeTab === 'simulator' 
              ? 'bg-indigo-600 text-white shadow-md' 
              : 'text-slate-400 hover:text-white hover:bg-panel'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" /> Simulador Individual por Cenário
        </button>
        <button
          onClick={() => setActiveTab('comparison')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all ${
            activeTab === 'comparison' 
              ? 'bg-indigo-600 text-white shadow-md' 
              : 'text-slate-400 hover:text-white hover:bg-panel'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" /> Comparador de Cenários & Margens
        </button>
        <button
          onClick={() => setActiveTab('historical')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all ${
            activeTab === 'historical' 
              ? 'bg-indigo-600 text-white shadow-md' 
              : 'text-slate-400 hover:text-white hover:bg-panel'
          }`}
        >
          <History className="w-3.5 h-3.5" /> Retro-Simulação (Meses Anteriores)
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all ${
            activeTab === 'settings' 
              ? 'bg-indigo-600 text-white shadow-md' 
              : 'text-slate-400 hover:text-white hover:bg-panel'
          }`}
        >
          <Target className="w-3.5 h-3.5" /> Gerenciar Regras ({scenarios.length})
        </button>
      </div>

      {/* ABA 1: SIMULADOR COM EDIÇÃO INDIVIDUAL DENTRO DE CADA CENÁRIO */}
      {activeTab === 'simulator' && (
        <div className="flex flex-col gap-6">
          {/* BARRA DE ATALHOS: MESES ANTERIORES E PREMISSAS FIXAS */}
          <div className="glass-panel p-4 rounded-2xl border border-border flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-panel/50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">Aplicar Mês Histórico em Todos:</span>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  {historicalMonthlyData.slice(-6).map((m: any) => (
                    <button
                      key={m.month}
                      onClick={() => handleApplyHistoricalMonthToAll(m)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 ${
                        selectedHistoricalMonth === m.label
                          ? 'bg-amber-500 text-black font-black shadow-md'
                          : 'bg-surface hover:bg-panel text-slate-300 hover:text-white border border-border'
                      }`}
                      title={`Aplicar ${m.label} em todos: R$ ${m.revenue.toLocaleString('pt-BR')}`}
                    >
                      <span>{m.label}</span>
                      <span className="text-[9px] opacity-75 font-sans">R$ {(m.revenue / 1000).toFixed(0)}k</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* PREMISSAS GERAIS DE CUSTOS DA CLÍNICA */}
            <div className="flex flex-wrap items-center gap-3 border-t lg:border-t-0 lg:border-l border-border pt-3 lg:pt-0 lg:pl-4">
              <div className="flex flex-col">
                <label className="text-[9px] font-bold text-slate-400 uppercase">Custos Fixos</label>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-mono font-bold text-slate-200">R$</span>
                  <input 
                    type="number" 
                    value={fixedExpenses} 
                    onChange={(e) => setFixedExpenses(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-20 bg-surface border border-border rounded px-1.5 py-0.5 text-xs font-mono font-bold text-text outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col">
                <label className="text-[9px] font-bold text-slate-400 uppercase">Impostos/Taxas</label>
                <div className="flex items-center gap-1">
                  <input 
                    type="number" 
                    step="0.5" 
                    value={taxesAndFeesPct} 
                    onChange={(e) => setTaxesAndFeesPct(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-14 bg-surface border border-border rounded px-1.5 py-0.5 text-xs font-mono font-bold text-text outline-none"
                  />
                  <span className="text-xs font-bold text-slate-400">%</span>
                </div>
              </div>

              <div className="flex flex-col">
                <label className="text-[9px] font-bold text-slate-400 uppercase">Insumos/Lab</label>
                <div className="flex items-center gap-1">
                  <input 
                    type="number" 
                    step="0.5" 
                    value={directMaterialsPct} 
                    onChange={(e) => setDirectMaterialsPct(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-14 bg-surface border border-border rounded px-1.5 py-0.5 text-xs font-mono font-bold text-text outline-none"
                  />
                  <span className="text-xs font-bold text-slate-400">%</span>
                </div>
              </div>
            </div>
          </div>

          {/* CARDS DE CADA CENÁRIO COM SEUS PRÓPRIOS CONTROLES INDIVIDUAIS */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {simulationResults.map(({ 
              scenario, 
              rev, 
              orthoP, 
              orthoRev, 
              commEligible, 
              amountPerPerson, 
              totalClinicAmount, 
              commPct, 
              peopleCount, 
              baseRevenueUsed, 
              activeTierLabel, 
              breakdownDetails,
              netProfit, 
              netMarginPct, 
              costDiff, 
              requiredExtraSales, 
              requiredGrowthPct 
            }) => {
              const isBase = scenario.isCurrent;

              return (
                <SpotlightCard 
                  key={scenario.id}
                  className={`glass-panel rounded-2xl p-6 border flex flex-col justify-between transition-all duration-300 relative overflow-hidden ${
                    isBase ? 'border-blue-500/50 bg-blue-950/15 ring-1 ring-blue-500/20' : 'border-border hover:border-slate-600'
                  }`}
                  spotlightColor={scenario.color + '25'}
                >
                  <div className="flex flex-col gap-5">
                    {/* Header do Card */}
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: scenario.color }} />
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {scenario.targetGroup}
                          </span>
                          {isBase && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30">
                              Atual
                            </span>
                          )}
                        </div>
                        <h4 className="text-base font-bold text-text font-display leading-snug">
                          {scenario.name}
                        </h4>
                      </div>
                      <button
                        onClick={() => handleEditScenario(scenario)}
                        className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-panel transition-colors"
                        title="Configurar regras avançadas deste cenário"
                      >
                        <Sliders className="w-4 h-4" />
                      </button>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed">
                      {scenario.description}
                    </p>

                    {/* BLOCO DE CONTROLES INDIVIDUAIS DESTE CENÁRIO */}
                    <div className="bg-panel/70 p-4 rounded-xl border border-border flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-indigo-400 tracking-wider">
                          🎛️ Parâmetros Editáveis Deste Cenário
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* 1. Faturamento Total Deste Cenário */}
                        <div className="flex flex-col gap-1 bg-surface p-2.5 rounded-lg border border-border">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Faturamento Total</label>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-mono text-slate-400">R$</span>
                            <input 
                              type="number" 
                              step="5000"
                              value={rev}
                              onChange={(e) => handleUpdateScenarioField(scenario.id, 'customRevenue', Math.max(0, parseFloat(e.target.value) || 0))}
                              className="w-full bg-transparent text-sm font-black font-mono text-emerald-400 outline-none"
                            />
                          </div>
                        </div>

                        {/* 2. Fatia de Ortodontia Deste Cenário */}
                        <div className="flex flex-col gap-1 bg-surface p-2.5 rounded-lg border border-border">
                          <div className="flex justify-between items-center">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Ortodontia</label>
                            <span className="text-[9px] font-mono text-amber-400">R$ {(orthoRev / 1000).toFixed(0)}k</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <input 
                              type="number" 
                              min={0}
                              max={100}
                              value={orthoP}
                              onChange={(e) => handleUpdateScenarioField(scenario.id, 'customOrthoPct', Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                              className="w-14 bg-transparent text-sm font-black font-mono text-amber-300 outline-none"
                            />
                            <span className="text-xs font-bold text-slate-400">%</span>
                          </div>
                        </div>

                        {/* 3. Pessoas / Beneficiários Deste Cenário */}
                        <div className="flex flex-col gap-1 bg-surface p-2.5 rounded-lg border border-border">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Beneficiários</label>
                          <div className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-purple-400" />
                            <input 
                              type="number" 
                              min={1}
                              max={30}
                              value={peopleCount}
                              onChange={(e) => handleUpdateScenarioField(scenario.id, 'beneficiariesCount', Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-12 bg-transparent text-sm font-black font-mono text-purple-300 outline-none"
                            />
                            <span className="text-[10px] text-slate-500">{peopleCount > 1 ? 'pessoas' : 'pessoa'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Resumo da Base Comercial sem Orto */}
                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-border/50">
                        <span>Vendas Elegíveis Comercial (sem Orto): <strong className="text-slate-200">R$ {commEligible.toLocaleString('pt-BR')}</strong></span>
                        <span className="text-indigo-400 font-bold">{activeTierLabel}</span>
                      </div>
                    </div>

                    {/* BLOCO DE RESULTADO: COMISSÃO A PAGAR */}
                    <div className="bg-panel/40 p-4 rounded-xl border border-border flex flex-col gap-3">
                      {/* Se tiver detalhamento específico (ex: Proposta 3 dos 2 Dentistas) */}
                      {breakdownDetails && breakdownDetails.length > 0 ? (
                        <div className="flex flex-col gap-2 pb-2 border-b border-border/60">
                          <span className="text-[10px] font-bold uppercase text-slate-400">Detalhamento por Função / Colaborador</span>
                          <div className="grid grid-cols-2 gap-2">
                            {breakdownDetails.map((b, idx) => (
                              <div key={idx} className="bg-surface/80 p-2 rounded-lg border border-border/60 flex justify-between items-center">
                                <span className="text-[10px] text-slate-300 font-medium">{b.label}</span>
                                <span className="text-xs font-black font-mono text-emerald-400">R$ {b.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        /* Se for valor único por pessoa */
                        <div className="flex justify-between items-center pb-2 border-b border-border/60">
                          <div>
                            <span className="text-[9px] font-bold uppercase text-slate-400 block">Comissão Paga a CADA UM</span>
                            <span className="text-[10px] text-indigo-400 font-medium">({activeTierLabel})</span>
                          </div>
                          <span className="text-lg font-black text-emerald-400 font-mono">
                            R$ {amountPerPerson.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}

                      {/* Custo Total da Clínica */}
                      <div className="flex justify-between items-baseline">
                        <div>
                          <span className="text-[10px] font-black uppercase text-slate-300 block">Custo Total Clínica</span>
                          <span className="text-[9px] text-slate-500 font-mono">({commPct.toFixed(2)}% do faturamento total)</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-black text-text font-mono">
                            R$ {totalClinicAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                          {!isBase && (
                            <span className={`text-xs font-bold font-mono flex items-center ${costDiff <= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {costDiff <= 0 ? (
                                <>
                                  <ArrowDownRight className="w-3 h-3 inline" />
                                  -R$ {Math.abs(costDiff).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                                </>
                              ) : (
                                <>
                                  <ArrowUpRight className="w-3 h-3 inline" />
                                  +R$ {costDiff.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                                </>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Lucro Líquido dos Sócios & Margem */}
                    <div className="bg-panel/30 p-3.5 rounded-xl border border-border flex justify-between items-center">
                      <div>
                        <span className="text-[9px] font-bold uppercase text-slate-400 block">Lucro Líquido Residual</span>
                        <span className={`text-lg font-black font-mono ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          R$ {netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <span className={`text-xs font-black font-mono px-2.5 py-1 rounded-lg ${
                        netMarginPct >= 20 ? 'bg-emerald-500/20 text-emerald-400' :
                        netMarginPct >= 10 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {netMarginPct.toFixed(1)}% margem
                      </span>
                    </div>

                    {/* Elasticidade / Break-Even */}
                    {!isBase && costDiff > 0 && (
                      <div className="bg-indigo-500/10 p-3 rounded-xl border border-indigo-500/20 flex items-center gap-2 text-indigo-300">
                        <Zap className="w-4 h-4 flex-shrink-0" />
                        <p className="text-[11px] leading-tight">
                          A clínica precisa faturar <strong className="text-white">+R$ {requiredExtraSales.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</strong> (+{requiredGrowthPct.toFixed(1)}%) para que este modelo se pague.
                        </p>
                      </div>
                    )}

                    {!isBase && costDiff <= 0 && (
                      <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 flex items-center gap-2 text-emerald-400">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                        <span className="text-[11px] font-medium leading-tight">
                          Economia de R$ {Math.abs(costDiff).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} em relação ao modelo atual.
                        </span>
                      </div>
                    )}
                  </div>
                </SpotlightCard>
              );
            })}
          </div>

          {/* GRÁFICO COMPARATIVO DE CURVAS */}
          <div className="glass-panel p-6 rounded-2xl border border-border flex flex-col gap-6">
            <div>
              <h3 className="text-base font-bold text-text uppercase tracking-widest flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-400" /> Custo Total de Comissões por Nível de Faturamento
              </h3>
              <p className="text-[11px] text-slate-400">
                Curva de comparação entre o Modelo Atual, Proposta 1, Proposta 2 e Proposta 3 (2 Dentistas).
              </p>
            </div>

            <div className="h-[340px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartRevenuePoints} margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="revenueLabel" stroke="#94a3b8" fontSize={11} tickMargin={10} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(1)}k`} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }}
                    formatter={(val: number, name: string) => {
                      const sc = scenarios.find(s => `comm_${s.id}` === name);
                      return [`R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, sc?.name || name];
                    }}
                  />
                  <Legend 
                    formatter={(val) => {
                      const sc = scenarios.find(s => `comm_${s.id}` === val);
                      return <span className="text-xs font-bold text-slate-300">{sc?.name || val}</span>;
                    }} 
                  />
                  {scenarios.map(sc => (
                    <Line 
                      key={sc.id}
                      type="monotone"
                      dataKey={`comm_${sc.id}`}
                      name={`comm_${sc.id}`}
                      stroke={sc.color}
                      strokeWidth={sc.isCurrent ? 4 : 2}
                      strokeDasharray={sc.isCurrent ? undefined : '3 3'}
                      dot={{ r: 4, fill: sc.color }}
                      activeDot={{ r: 7 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: COMPARADOR DE CENÁRIOS & TABELA DE MARGENS */}
      {activeTab === 'comparison' && (
        <div className="flex flex-col gap-6">
          <div className="glass-panel rounded-2xl border border-border overflow-hidden">
            <div className="p-6 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-text uppercase tracking-widest flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" /> Tabela Comparativa de Comissões e Lucro Líquido
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Comparativo de custo total da clínica e lucro líquido dos sócios em vários patamares de faturamento.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-panel border-b border-border text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    <th className="p-4 pl-6">Cenário / Modelo</th>
                    <th className="p-4">Beneficiários</th>
                    <th className="p-4">Regra Orto</th>
                    <th className="p-4 text-right">R$ 45.000</th>
                    <th className="p-4 text-right">R$ 55.000</th>
                    <th className="p-4 text-right">R$ 60.000</th>
                    <th className="p-4 text-right">R$ 70.000</th>
                    <th className="p-4 text-right">R$ 80.000</th>
                    <th className="p-4 text-right">R$ 100.000</th>
                    <th className="p-4 text-right pr-6">R$ 120.000</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs text-slate-200">
                  {scenarios.map(sc => {
                    const testValues = [45000, 55000, 60000, 70000, 80000, 100000, 120000];
                    const orthoP = sc.customOrthoPct !== undefined ? sc.customOrthoPct : 25;

                    return (
                      <tr key={sc.id} className={`hover:bg-panel/50 transition-colors ${sc.isCurrent ? 'bg-blue-500/5 font-bold' : ''}`}>
                        <td className="p-4 pl-6">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: sc.color }} />
                            <div>
                              <div className="font-bold text-text">{sc.name}</div>
                              {sc.isCurrent && <span className="text-[9px] text-blue-400 font-bold uppercase">Modelo Atual</span>}
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-purple-300 font-mono text-[11px] font-bold">
                          {sc.beneficiariesCount || 1} { (sc.beneficiariesCount || 1) > 1 ? 'pessoas' : 'pessoa' }
                        </td>
                        <td className="p-4 text-slate-400 text-[11px]">
                          {sc.ruleType === 'dentists_2_comm_reception' ? (
                            <span className="text-cyan-400 font-bold">Dent.1 c/ Orto | Dent.2 s/ Orto</span>
                          ) : sc.excludeOrtho ? (
                            <span className="text-amber-400 font-bold">Sem Orto</span>
                          ) : (
                            <span className="text-emerald-400 font-bold">Total</span>
                          )}
                        </td>
                        
                        {testValues.map(v => {
                          const { totalClinicAmount } = calculateCommission(sc, v, orthoP);
                          const taxes = v * (taxesAndFeesPct / 100);
                          const mat = v * (directMaterialsPct / 100);
                          const netProfit = v - (taxes + mat + totalClinicAmount) - fixedExpenses;
                          const netMargin = v > 0 ? (netProfit / v) * 100 : 0;

                          return (
                            <td key={v} className="p-4 text-right font-mono">
                              <div className="font-bold text-text">R$ {totalClinicAmount.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</div>
                              <div className={`text-[10px] mt-0.5 ${netMargin >= 18 ? 'text-emerald-400' : netMargin >= 10 ? 'text-amber-400' : 'text-red-400'}`}>
                                Lucro: {netMargin.toFixed(0)}% (R$ {(netProfit / 1000).toFixed(1)}k)
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA 3: RETRO-SIMULAÇÃO (MESES ANTERIORES VALIDADOS) */}
      {activeTab === 'historical' && (
        <div className="flex flex-col gap-6">
          <div className="glass-panel p-6 rounded-2xl border border-border flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-black uppercase text-amber-400 tracking-widest">Simulação Retroativa Real</span>
                <h3 className="text-lg font-bold text-text flex items-center gap-2">
                  <History className="w-5 h-5 text-amber-400" /> "Quanto teríamos pago em cada modelo nos meses passados?"
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Valores calculados com os dados reais dos meses passados. Clique em "Aplicar Mês" para carregar no simulador.
                </p>
              </div>
            </div>

            {/* TABELA DE MESES REAIS */}
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-panel border-b border-border text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    <th className="p-4 pl-6">Mês</th>
                    <th className="p-4 text-right">Faturamento Total</th>
                    <th className="p-4 text-right text-amber-400">Ortodontia (Isento)</th>
                    <th className="p-4 text-right text-indigo-300">Base Comercial</th>
                    {scenarios.map(sc => (
                      <th key={sc.id} className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: sc.color }} />
                          <span>{sc.name}</span>
                        </div>
                      </th>
                    ))}
                    <th className="p-4 text-center">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs text-slate-200">
                  {historicalCalculatedData.map((row: any) => {
                    const currentComm = row[`comm_${currentScenario.id}`] || 0;

                    return (
                      <tr key={row.month} className="hover:bg-panel/40 transition-colors">
                        <td className="p-4 pl-6 font-bold text-text">{row.label}</td>
                        <td className="p-4 text-right font-mono font-black text-emerald-400">
                          R$ {row.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-4 text-right font-mono text-amber-300">
                          R$ {row.ortho.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="text-[9px] text-slate-500 font-normal">({row.orthoPct}%)</span>
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-white">
                          R$ {row.commEligible.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        {scenarios.map(sc => {
                          const comm = row[`comm_${sc.id}`] || 0;
                          const diff = comm - currentComm;

                          return (
                            <td key={sc.id} className="p-4 text-right font-mono">
                              <div className="font-bold text-text">
                                R$ {comm.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </div>
                              {!sc.isCurrent && (
                                <div className={`text-[10px] ${diff <= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                  {diff <= 0 ? '-' : '+'}R$ {Math.abs(diff).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                                </div>
                              )}
                            </td>
                          );
                        })}
                        <td className="p-4 text-center">
                          <button
                            onClick={() => {
                              handleApplyHistoricalMonthToAll(row);
                              setActiveTab('simulator');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white text-[10px] font-bold uppercase transition-all"
                          >
                            Simular
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA 4: GERENCIAR CENÁRIOS & REGRAS */}
      {activeTab === 'settings' && (
        <div className="flex flex-col gap-6">
          <div className="glass-panel p-6 rounded-2xl border border-border flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-text uppercase tracking-widest">
                  Regras de Comissionamento Cadastradas
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Gerencie as faixas de atingimento, percentuais, quantidade de pessoas e regras de exclusão de Ortodontia.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleResetDefaults}
                  className="px-4 py-2 rounded-xl bg-surface hover:bg-panel border border-border text-slate-400 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Restaurar Padrões
                </button>
                <button
                  onClick={handleOpenNewScenario}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  <Plus className="w-4 h-4" /> Novo Cenário
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {scenarios.map(sc => (
                <div 
                  key={sc.id} 
                  className={`p-5 rounded-2xl border flex flex-col justify-between gap-4 bg-panel/40 ${
                    sc.isCurrent ? 'border-blue-500/40' : 'border-border'
                  }`}
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: sc.color }} />
                        <h4 className="font-bold text-text text-sm">{sc.name}</h4>
                      </div>
                      {sc.isCurrent ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30">
                          Modelo Atual
                        </span>
                      ) : (
                        <div className="flex gap-1">
                          <button 
                            onClick={() => handleEditScenario(sc)} 
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface transition-colors"
                          >
                            <Sliders className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteScenario(sc.id)} 
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-surface transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    <p className="text-xs text-slate-400">{sc.description}</p>

                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="px-2.5 py-1 rounded-lg bg-surface text-[10px] font-bold text-slate-300 border border-border">
                        👥 {sc.targetGroup} ({sc.beneficiariesCount || 1} { (sc.beneficiariesCount || 1) > 1 ? 'pessoas' : 'pessoa' })
                      </span>
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                        sc.ruleType === 'dentists_2_comm_reception' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' :
                        sc.excludeOrtho ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}>
                        {sc.ruleType === 'dentists_2_comm_reception' ? '🦷 2 Dentistas (1 c/ Orto + 1 s/ Orto)' : sc.excludeOrtho ? '🚫 Isenta Ortodontia' : '🌐 Faturamento Total'}
                      </span>
                      {sc.tiers && sc.tiers.length > 0 ? (
                        <span className="px-2.5 py-1 rounded-lg bg-surface text-[10px] font-bold text-indigo-400 border border-border">
                          📊 {sc.tiers.length} Faixas Escalonadas
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg bg-surface text-[10px] font-bold text-indigo-400 border border-border">
                          📈 {sc.percentage}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CRIAÇÃO / EDIÇÃO DE CENÁRIO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-surface border border-border w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-border flex justify-between items-center bg-surface">
              <h3 className="text-lg font-bold text-text font-display">
                {editingScenario ? 'Editar Cenário de Comissionamento' : 'Criar Novo Cenário de Comissionamento'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="p-6 flex flex-col gap-4 overflow-y-auto max-h-[75vh] custom-scrollbar">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Nome do Cenário</label>
                <input 
                  type="text" 
                  value={formScenario.name} 
                  onChange={(e) => setFormScenario({ ...formScenario, name: e.target.value })}
                  placeholder="Ex: Time Todo 1% cada (4 pessoas)"
                  className="w-full bg-panel border border-border rounded-xl px-4 py-2.5 text-sm text-text outline-none focus:border-indigo-500 font-bold"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Descrição Explicativa</label>
                <textarea 
                  value={formScenario.description} 
                  onChange={(e) => setFormScenario({ ...formScenario, description: e.target.value })}
                  placeholder="Explique como essa regra funciona..."
                  className="w-full bg-panel border border-border rounded-xl px-4 py-2 text-xs text-text outline-none focus:border-indigo-500 h-16 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Público / Grupo</label>
                  <select 
                    value={formScenario.targetGroup}
                    onChange={(e: any) => setFormScenario({ ...formScenario, targetGroup: e.target.value })}
                    className="w-full bg-panel border border-border rounded-xl px-3 py-2.5 text-xs text-text outline-none"
                  >
                    <option value="Comercial">Comercial</option>
                    <option value="Toda a Equipe">Toda a Equipe</option>
                    <option value="Recepção & Apoio">Recepção & Apoio</option>
                    <option value="Clínico & Geral">Clínico & Geral</option>
                    <option value="Personalizado">Personalizado</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Quantas Pessoas Receberão?</label>
                  <input 
                    type="number" 
                    min={1} 
                    max={30}
                    value={formScenario.beneficiariesCount || 1}
                    onChange={(e) => setFormScenario({ ...formScenario, beneficiariesCount: Math.max(1, parseInt(e.target.value) || 1) })}
                    placeholder="Ex: 4"
                    className="w-full bg-panel border border-border rounded-xl px-3 py-2.5 text-xs text-text font-bold font-mono outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Tipo de Regra</label>
                  <select 
                    value={formScenario.ruleType}
                    onChange={(e: any) => setFormScenario({ ...formScenario, ruleType: e.target.value })}
                    className="w-full bg-panel border border-border rounded-xl px-3 py-2.5 text-xs text-text outline-none"
                  >
                    <option value="flat">Linear / Fixo em tudo (Ex: 1% de tudo)</option>
                    <option value="trigger">Gatilho Único (Ex: a partir de 70k)</option>
                    <option value="tiered">Escalonado por Faixas</option>
                    <option value="dentists_2_comm_reception">2 Dentistas (1 c/ Orto + 1 s/ Orto) + Com. + Recepção</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Percentual por Pessoa (%)</label>
                  <input 
                    type="number" 
                    step="0.1" 
                    value={formScenario.percentage}
                    onChange={(e) => setFormScenario({ ...formScenario, percentage: parseFloat(e.target.value) || 0 })}
                    placeholder="Ex: 1.0"
                    className="w-full bg-panel border border-border rounded-xl px-4 py-2 text-sm text-text font-mono font-bold outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {formScenario.ruleType === 'trigger' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Gatilho Mínimo (R$)</label>
                  <input 
                    type="number" 
                    step="5000" 
                    value={formScenario.triggerAmount}
                    onChange={(e) => setFormScenario({ ...formScenario, triggerAmount: parseFloat(e.target.value) || 0 })}
                    placeholder="Ex: 70000"
                    className="w-full bg-panel border border-border rounded-xl px-4 py-2 text-sm text-text font-mono font-bold outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              {/* OPÇÃO DE EXCLUIR ORTODONTIA */}
              <div className="flex items-center gap-2 p-3 bg-panel rounded-xl border border-border">
                <input 
                  type="checkbox" 
                  id="modalExcludeOrtho"
                  checked={formScenario.excludeOrtho}
                  onChange={(e) => setFormScenario({ ...formScenario, excludeOrtho: e.target.checked })}
                  className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="modalExcludeOrtho" className="text-xs text-slate-300 font-medium cursor-pointer">
                  <strong>Não contabilizar Ortodontia</strong> (pacientes/procedimentos de ortodontia isentos da base).
                </label>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Cor do Cenário nos Gráficos</label>
                <div className="flex gap-2">
                  {['#3b82f6', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6', '#ec4899', '#e11d48'].map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormScenario({ ...formScenario, color })}
                      className={`size-8 rounded-full transition-transform ${formScenario.color === color ? 'scale-125 ring-2 ring-white' : 'opacity-70'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-border flex justify-end gap-3 bg-surface">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2 text-xs font-bold text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveScenario}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg transition-all active:scale-95"
              >
                Salvar Cenário
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialViability;
