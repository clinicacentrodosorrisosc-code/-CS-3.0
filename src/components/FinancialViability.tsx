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
  Settings
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
  ruleType: 'trigger' | 'flat' | 'tiered'; // gatilho único, fixo em tudo, ou escalonado
  triggerAmount: number; // Ex: 45000 ou 70000
  percentage: number; // Ex: 2% ou 1%
  applyOnSurplusOnly: boolean; // se true: aplica % apenas sobre o que passar da meta; se false: aplica sobre o faturamento total assim que bate a meta
  excludeOrtho: boolean; // se true: NÃO contabiliza pacientes/receitas de Ortodontia
  bonusFixedAmount?: number; // bônus fixo extra ao atingir supermeta
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
    description: 'Comercial ganha sobre o total vendido (sem Ortodontia): 0% (<45k), 2% (45k a 54.9k), 3% (55k a 59.9k) e 5% (≥ 60k). Ortodontia não contabiliza.',
    isCurrent: true,
    targetGroup: 'Comercial',
    ruleType: 'tiered',
    triggerAmount: 45000,
    percentage: 2.0,
    applyOnSurplusOnly: false,
    excludeOrtho: true,
    tiers: [
      { minRevenue: 0, maxRevenue: 45000, percentage: 0.0, label: 'Abaixo de 45k (0%)' },
      { minRevenue: 45000, maxRevenue: 55000, percentage: 2.0, label: '45k a 55k (2%)' },
      { minRevenue: 55000, maxRevenue: 60000, percentage: 3.0, label: '55k a 60k (3%)' },
      { minRevenue: 60000, percentage: 5.0, label: 'A partir de 60k (5%)' }
    ],
    color: '#3b82f6' // Azul
  },
  {
    id: 'team_flat_1pct',
    name: 'Proposta 1 (Time Todo 1% de Tudo)',
    description: 'Toda a equipe (comercial, recepção, suporte) ganha 1% linear sobre todo o faturamento da clínica (todas as especialidades).',
    targetGroup: 'Toda a Equipe',
    ruleType: 'flat',
    triggerAmount: 0,
    percentage: 1.0,
    applyOnSurplusOnly: false,
    excludeOrtho: false,
    color: '#10b981' // Verde Esmeralda
  },
  {
    id: 'commercial_70k_2pct',
    name: 'Proposta 2 (Comercial 2% a partir de 70k)',
    description: 'Comercial ganha 2% sobre o vendido (sem Ortodontia) apenas ao atingir R$ 70.000 ou mais.',
    targetGroup: 'Comercial',
    ruleType: 'trigger',
    triggerAmount: 70000,
    percentage: 2.0,
    applyOnSurplusOnly: false,
    excludeOrtho: true,
    color: '#f59e0b' // Âmbar
  },
  {
    id: 'commercial_progressive_70k',
    name: 'Proposta 3 (Comercial Escalonado 50k / 70k / 90k)',
    description: 'Comercial sem Orto: 0% (<50k), 2% (50k a 70k), 3% (70k a 90k) e 4% (≥ 90k) + bônus de R$ 500 se atingir 100k.',
    targetGroup: 'Comercial',
    ruleType: 'tiered',
    triggerAmount: 50000,
    percentage: 2.0,
    applyOnSurplusOnly: false,
    excludeOrtho: true,
    bonusFixedAmount: 500,
    bonusTriggerAmount: 100000,
    tiers: [
      { minRevenue: 0, maxRevenue: 50000, percentage: 0.0, label: '< 50k (0%)' },
      { minRevenue: 50000, maxRevenue: 70000, percentage: 2.0, label: '50k a 70k (2%)' },
      { minRevenue: 70000, maxRevenue: 90000, percentage: 3.0, label: '70k a 90k (3%)' },
      { minRevenue: 90000, percentage: 4.0, label: '≥ 90k (4%)' }
    ],
    color: '#8b5cf6' // Roxo
  },
  {
    id: 'hybrid_comm_team',
    name: 'Proposta 4 (Híbrido: Comercial 2% > 55k + Time 0.5%)',
    description: 'Comercial ganha 2% a partir de 55k (sem Orto) + Toda a equipe ganha 0.5% sobre o faturamento total da clínica.',
    targetGroup: 'Personalizado',
    ruleType: 'tiered',
    triggerAmount: 55000,
    percentage: 2.5,
    applyOnSurplusOnly: false,
    excludeOrtho: false,
    tiers: [
      { minRevenue: 0, maxRevenue: 55000, percentage: 0.5, label: '< 55k: Time 0.5%' },
      { minRevenue: 55000, percentage: 2.5, label: '≥ 55k: Com. 2% + Time 0.5% (2.5%)' }
    ],
    color: '#ec4899' // Rosa
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
      const saved = localStorage.getItem('om_viability_scenarios_v2');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Erro ao carregar cenários:', e);
    }
    return DEFAULT_SCENARIOS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('om_viability_scenarios_v2', JSON.stringify(scenarios));
    } catch (e) {
      console.warn('Erro ao salvar cenários:', e);
    }
  }, [scenarios]);

  // Estados de Simulação
  const [simulatedTotalRevenue, setSimulatedTotalRevenue] = useState<number>(80000); // R$ 80.000 faturamento total clínica
  const [orthoSharePct, setOrthoSharePct] = useState<number>(25); // 25% do faturamento da clínica é Ortodontia
  const [activeTab, setActiveTab] = useState<'simulator' | 'comparison' | 'historical' | 'settings'>('simulator');
  
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
    targetGroup: 'Comercial',
    ruleType: 'tiered',
    triggerAmount: 45000,
    percentage: 2.0,
    applyOnSurplusOnly: false,
    excludeOrtho: true,
    bonusFixedAmount: 0,
    bonusTriggerAmount: 0,
    tiers: [
      { minRevenue: 0, maxRevenue: 45000, percentage: 0.0, label: '< 45k (0%)' },
      { minRevenue: 45000, maxRevenue: 55000, percentage: 2.0, label: '45k a 55k (2%)' },
      { minRevenue: 55000, maxRevenue: 60000, percentage: 3.0, label: '55k a 60k (3%)' },
      { minRevenue: 60000, percentage: 5.0, label: '≥ 60k (5%)' }
    ],
    color: '#06b6d4'
  });

  // Função para calcular a comissão de uma regra dado o faturamento total e a fatia de Orto
  const calculateCommission = (
    rule: ScenarioRule, 
    totalRevenue: number, 
    orthoPct: number = orthoSharePct
  ): { amount: number; effectivePct: number; baseRevenueUsed: number; activeTierLabel?: string } => {
    if (totalRevenue <= 0) return { amount: 0, effectivePct: 0, baseRevenueUsed: 0 };

    // Se a regra exclui ortodontia, o faturamento base para atingir a meta e calcular o % é apenas o que não é Orto
    const baseRevenueUsed = rule.excludeOrtho 
      ? totalRevenue * (1 - (orthoPct / 100))
      : totalRevenue;

    let amount = 0;
    let activeTierLabel: string | undefined = undefined;

    if (rule.ruleType === 'flat') {
      amount = baseRevenueUsed * (rule.percentage / 100);
      activeTierLabel = `${rule.percentage}% de tudo`;
    } else if (rule.ruleType === 'trigger') {
      if (baseRevenueUsed >= rule.triggerAmount) {
        if (rule.applyOnSurplusOnly) {
          amount = (baseRevenueUsed - rule.triggerAmount) * (rule.percentage / 100);
        } else {
          amount = baseRevenueUsed * (rule.percentage / 100);
        }
        activeTierLabel = `${rule.percentage}% (meta atingida)`;
      } else {
        amount = 0;
        activeTierLabel = 'Meta não atingida (0%)';
      }
    } else if (rule.ruleType === 'tiered' && rule.tiers && rule.tiers.length > 0) {
      const activeTier = rule.tiers.find(t => baseRevenueUsed >= t.minRevenue && (t.maxRevenue === undefined || baseRevenueUsed < t.maxRevenue)) 
        || rule.tiers[rule.tiers.length - 1];
      if (activeTier) {
        amount = baseRevenueUsed * (activeTier.percentage / 100);
        activeTierLabel = activeTier.label || `${activeTier.percentage}%`;
      }
    }

    // Adiciona bônus fixo se atingiu a supermeta
    if (rule.bonusFixedAmount && rule.bonusTriggerAmount && baseRevenueUsed >= rule.bonusTriggerAmount) {
      amount += rule.bonusFixedAmount;
    }

    const effectivePct = totalRevenue > 0 ? (amount / totalRevenue) * 100 : 0;
    return { amount, effectivePct, baseRevenueUsed, activeTierLabel };
  };

  // Cálculo detalhado de viabilidade para o faturamento simulado
  const currentScenario = scenarios.find(s => s.isCurrent) || scenarios[0];

  const simulatedOrthoRevenue = simulatedTotalRevenue * (orthoSharePct / 100);
  const simulatedCommercialEligibleRevenue = simulatedTotalRevenue - simulatedOrthoRevenue;

  const simulationResults = useMemo(() => {
    return scenarios.map(scenario => {
      const { amount: commAmount, effectivePct: commPct, baseRevenueUsed, activeTierLabel } = calculateCommission(scenario, simulatedTotalRevenue, orthoSharePct);
      
      const taxesAndFees = simulatedTotalRevenue * (taxesAndFeesPct / 100);
      const directMaterials = simulatedTotalRevenue * (directMaterialsPct / 100);
      const totalVariableCosts = taxesAndFees + directMaterials + commAmount;
      const contributionMarginR$ = simulatedTotalRevenue - totalVariableCosts;
      const contributionMarginPct = simulatedTotalRevenue > 0 ? (contributionMarginR$ / simulatedTotalRevenue) * 100 : 0;

      const netProfit = contributionMarginR$ - fixedExpenses;
      const netMarginPct = simulatedTotalRevenue > 0 ? (netProfit / simulatedTotalRevenue) * 100 : 0;

      // Comparação com o Modelo Atual
      const currentComm = calculateCommission(currentScenario, simulatedTotalRevenue, orthoSharePct).amount;
      const currentNetProfit = (simulatedTotalRevenue - (taxesAndFees + directMaterials + currentComm)) - fixedExpenses;
      const costDiff = commAmount - currentComm;
      const profitDiff = netProfit - currentNetProfit;

      // Elasticidade / Break-even do aumento: Quanto precisa vender a mais para compensar o custo extra de comissão?
      const baseContributionMarginRate = Math.max(0.1, (contributionMarginPct / 100));
      const requiredExtraSales = costDiff > 0 ? costDiff / baseContributionMarginRate : 0;
      const requiredGrowthPct = (costDiff > 0 && simulatedTotalRevenue > 0) ? (requiredExtraSales / simulatedTotalRevenue) * 100 : 0;

      return {
        scenario,
        commAmount,
        commPct,
        baseRevenueUsed,
        activeTierLabel,
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
  }, [scenarios, simulatedTotalRevenue, orthoSharePct, taxesAndFeesPct, directMaterialsPct, fixedExpenses, currentScenario]);

  // Curva de Faturamento para Gráficos Comparativos (de 30k a 160k)
  const chartRevenuePoints = useMemo(() => {
    const points: number[] = [30000, 45000, 55000, 60000, 70000, 80000, 90000, 100000, 120000, 140000, 160000];
    return points.map(rev => {
      const pointData: any = {
        revenue: rev,
        revenueLabel: `R$ ${(rev / 1000).toFixed(0)}k`
      };

      scenarios.forEach(sc => {
        const { amount: comm } = calculateCommission(sc, rev, orthoSharePct);
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
  }, [scenarios, orthoSharePct, taxesAndFeesPct, directMaterialsPct, fixedExpenses]);

  // Histórico Real da Clínica (Separando Ortodontia a partir das Transactions)
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
      // Mock inteligente com meses recentes e separação de Orto
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
        const results: any = { 
          ...item, 
          commEligible, 
          orthoPct: realOrthoPct.toFixed(0) 
        };
        scenarios.forEach(sc => {
          const { amount } = calculateCommission(sc, item.revenue, realOrthoPct);
          results[`comm_${sc.id}`] = amount;
        });
        return results;
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
      
      const results: any = { 
        month: mKey, 
        label, 
        revenue, 
        ortho, 
        commEligible, 
        orthoPct: realOrthoPct.toFixed(0) 
      };

      scenarios.forEach(sc => {
        const { amount } = calculateCommission(sc, revenue, realOrthoPct);
        results[`comm_${sc.id}`] = amount;
      });
      return results;
    });
  }, [transactions, scenarios]);

  // Handlers para Criar / Editar Cenários
  const handleOpenNewScenario = () => {
    setEditingScenario(null);
    setFormScenario({
      id: 'custom_' + Date.now(),
      name: 'Novo Cenário Personalizado',
      description: 'Regra de incentivo customizada.',
      targetGroup: 'Comercial',
      ruleType: 'tiered',
      triggerAmount: 45000,
      percentage: 2.0,
      applyOnSurplusOnly: false,
      excludeOrtho: true,
      bonusFixedAmount: 0,
      bonusTriggerAmount: 0,
      tiers: [
        { minRevenue: 0, maxRevenue: 45000, percentage: 0.0, label: '< 45k (0%)' },
        { minRevenue: 45000, maxRevenue: 60000, percentage: 2.0, label: '45k a 60k (2%)' },
        { minRevenue: 60000, percentage: 4.0, label: '≥ 60k (4%)' }
      ],
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
    if (confirm('Restaurar os cenários padrão do sistema (incluindo as faixas de 45k/55k/60k sem Orto)?')) {
      setScenarios(DEFAULT_SCENARIOS);
      toast.success('Cenários restaurados para o padrão.');
    }
  };

  // Copiar parecer executivo
  const handleCopySummary = () => {
    let report = `📊 PARECER DE VIABILIDADE & COMISSIONAMENTO\n`;
    report += `Faturamento Total Clínica: R$ ${simulatedTotalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
    report += `Ortodontia (${orthoSharePct}% - Isento no Comercial): R$ ${simulatedOrthoRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
    report += `Faturamento Elegível Comercial: R$ ${simulatedCommercialEligibleRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n`;
    
    simulationResults.forEach(res => {
      report += `🔹 ${res.scenario.name}\n`;
      report += `   - Base Usada: R$ ${res.baseRevenueUsed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${res.scenario.excludeOrtho ? 'Sem Orto' : 'Total'})\n`;
      report += `   - Faixa/Status: ${res.activeTierLabel || '-'}\n`;
      report += `   - Comissão a Pagar: R$ ${res.commAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${res.commPct.toFixed(2)}% do faturamento total)\n`;
      report += `   - Lucro Líquido dos Sócios: R$ ${res.netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (Margem: ${res.netMarginPct.toFixed(1)}%)\n`;
      if (!res.scenario.isCurrent) {
        report += `   - Diferença vs Atual: ${res.costDiff >= 0 ? '+' : ''}R$ ${res.costDiff.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
        if (res.costDiff > 0) {
          report += `   - Vendas Extras Necessárias: +R$ ${res.requiredExtraSales.toLocaleString('pt-BR', { minimumFractionDigits: 0 })} (+${res.requiredGrowthPct.toFixed(1)}% de crescimento)\n`;
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
              Simulação de comissões com regras de gatilho (45k / 55k / 60k), isenção de Ortodontia e impacto em margens.
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
          <Sliders className="w-3.5 h-3.5" /> Simulador Interativo
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
          <History className="w-3.5 h-3.5" /> Retro-Simulação (Dados Reais)
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

      {/* ABA 1: SIMULADOR INTERATIVO */}
      {activeTab === 'simulator' && (
        <div className="flex flex-col gap-6">
          {/* CONTROLE DE FATURAMENTO TOTAL & SEPARAÇÃO DE ORTODONTIA */}
          <div className="glass-panel p-6 rounded-2xl border border-border flex flex-col gap-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Card 1: Faturamento Total */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">1. Faturamento Total Clínica</span>
                <span className="text-3xl font-black text-emerald-400 font-mono">
                  R$ {simulatedTotalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
                <input 
                  type="range" 
                  min={20000} 
                  max={200000} 
                  step={2500} 
                  value={simulatedTotalRevenue}
                  onChange={(e) => setSimulatedTotalRevenue(parseFloat(e.target.value))}
                  className="w-full h-2.5 bg-panel rounded-lg appearance-none cursor-pointer accent-indigo-500 mt-2"
                />
                <div className="flex flex-wrap gap-1 mt-1">
                  {[45000, 60000, 75000, 85000, 100000, 120000].map(v => (
                    <button
                      key={v}
                      onClick={() => setSimulatedTotalRevenue(v)}
                      className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all ${
                        simulatedTotalRevenue === v ? 'bg-indigo-600 text-white' : 'bg-panel text-slate-400 border border-border'
                      }`}
                    >
                      {(v / 1000)}k
                    </button>
                  ))}
                </div>
              </div>

              {/* Card 2: Fatia de Ortodontia (Isenta no Comercial) */}
              <div className="flex flex-col gap-2 bg-panel/50 p-4 rounded-xl border border-border">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase text-amber-400 tracking-widest">2. Ortodontia (Isento Com. Comercial)</span>
                  <span className="text-xs font-mono font-bold text-amber-400">{orthoSharePct}% da clínica</span>
                </div>
                <span className="text-2xl font-black text-amber-300 font-mono">
                  R$ {simulatedOrthoRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
                <input 
                  type="range" 
                  min={0} 
                  max={60} 
                  step={1} 
                  value={orthoSharePct}
                  onChange={(e) => setOrthoSharePct(parseFloat(e.target.value))}
                  className="w-full h-2 bg-panel rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <p className="text-[10px] text-slate-400">
                  Manutenções ortodônticas e documentações não entram no cálculo de comissão do Comercial.
                </p>
              </div>

              {/* Card 3: Faturamento Elegível do Comercial */}
              <div className="flex flex-col gap-2 bg-indigo-500/10 p-4 rounded-xl border border-indigo-500/25">
                <span className="text-[10px] font-black uppercase text-indigo-300 tracking-widest">3. Vendas Elegíveis Comercial</span>
                <span className="text-2xl font-black text-white font-mono">
                  R$ {simulatedCommercialEligibleRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                    simulatedCommercialEligibleRevenue >= 60000 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                    simulatedCommercialEligibleRevenue >= 55000 ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' :
                    simulatedCommercialEligibleRevenue >= 45000 ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                    'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                  }`}>
                    {simulatedCommercialEligibleRevenue >= 60000 ? '🔥 Faixa Máxima: 5%' :
                     simulatedCommercialEligibleRevenue >= 55000 ? '⚡ Faixa Intermediária: 3%' :
                     simulatedCommercialEligibleRevenue >= 45000 ? '✅ Faixa Inicial: 2%' :
                     '❌ Abaixo de 45k: 0%'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Base que determina o gatilho e o percentual de comissão do Comercial no Modelo Atual.
                </p>
              </div>
            </div>

            {/* PREMISSAS DE CUSTOS DA CLÍNICA */}
            <div className="border-t border-border pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1 bg-panel/60 p-3 rounded-xl border border-border">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Custos Fixos Totais</label>
                  <span className="text-xs font-mono font-bold text-text">R$ {fixedExpenses.toLocaleString('pt-BR')}</span>
                </div>
                <input 
                  type="number" 
                  value={fixedExpenses} 
                  onChange={(e) => setFixedExpenses(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="bg-surface border border-border rounded-lg px-2.5 py-1 text-xs font-mono text-text outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex flex-col gap-1 bg-panel/60 p-3 rounded-xl border border-border">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Impostos + Taxas Maquininha (%)</label>
                  <span className="text-xs font-mono font-bold text-text">{taxesAndFeesPct}%</span>
                </div>
                <input 
                  type="number" 
                  step="0.5" 
                  value={taxesAndFeesPct} 
                  onChange={(e) => setTaxesAndFeesPct(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="bg-surface border border-border rounded-lg px-2.5 py-1 text-xs font-mono text-text outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex flex-col gap-1 bg-panel/60 p-3 rounded-xl border border-border">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Insumos & Prótese/Lab (%)</label>
                  <span className="text-xs font-mono font-bold text-text">{directMaterialsPct}%</span>
                </div>
                <input 
                  type="number" 
                  step="0.5" 
                  value={directMaterialsPct} 
                  onChange={(e) => setDirectMaterialsPct(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="bg-surface border border-border rounded-lg px-2.5 py-1 text-xs font-mono text-text outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* CARDS COMPARATIVOS DOS CENÁRIOS */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {simulationResults.map(({ scenario, commAmount, commPct, baseRevenueUsed, activeTierLabel, netProfit, netMarginPct, costDiff, requiredExtraSales, requiredGrowthPct }) => {
              const isBase = scenario.isCurrent;

              return (
                <SpotlightCard 
                  key={scenario.id}
                  className={`glass-panel rounded-2xl p-6 border flex flex-col justify-between transition-all duration-300 relative overflow-hidden ${
                    isBase ? 'border-blue-500/50 bg-blue-950/15 ring-1 ring-blue-500/20' : 'border-border hover:border-slate-600'
                  }`}
                  spotlightColor={scenario.color + '25'}
                >
                  <div className="flex flex-col gap-4">
                    {/* Header do Card */}
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span 
                            className="w-2.5 h-2.5 rounded-full" 
                            style={{ backgroundColor: scenario.color }}
                          />
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {scenario.targetGroup}
                          </span>
                          {isBase && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30">
                              Modelo Atual
                            </span>
                          )}
                          {scenario.excludeOrtho ? (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              Sem Orto
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Faturamento Total
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
                        title="Editar parâmetros deste cenário"
                      >
                        <Sliders className="w-4 h-4" />
                      </button>
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {scenario.description}
                    </p>

                    {/* Bloco 1: Comissão a Pagar & Base Usada */}
                    <div className="bg-panel/70 p-4 rounded-xl border border-border flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold uppercase text-slate-400">Comissão a Pagar</span>
                        <span className="text-[11px] font-mono font-bold text-indigo-400">{activeTierLabel || `${commPct.toFixed(2)}%`}</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-text font-mono">
                          R$ {commAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                      <div className="text-[10px] text-slate-500 font-mono">
                        Base de cálculo: R$ {baseRevenueUsed.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} ({commPct.toFixed(2)}% da clínica)
                      </div>
                    </div>

                    {/* Bloco 2: Lucro Líquido dos Sócios & Margem */}
                    <div className="bg-panel/40 p-4 rounded-xl border border-border flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold uppercase text-slate-400">Lucro Líquido Residual</span>
                        <span className={`text-xs font-black font-mono px-2 py-0.5 rounded-lg ${
                          netMarginPct >= 20 ? 'bg-emerald-500/20 text-emerald-400' :
                          netMarginPct >= 10 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {netMarginPct.toFixed(1)}% margem
                        </span>
                      </div>
                      <span className={`text-xl font-black font-mono ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        R$ {netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* Bloco 3: Elasticidade / Break-Even do Incentivo */}
                    {!isBase && costDiff > 0 && (
                      <div className="bg-indigo-500/10 p-3.5 rounded-xl border border-indigo-500/20 flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5 text-indigo-300">
                          <Zap className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Meta para se Pagar</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-snug">
                          A clínica precisa faturar <strong className="text-white">+R$ {requiredExtraSales.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</strong> (+{requiredGrowthPct.toFixed(1)}%) para compensar a comissão extra sem reduzir o lucro dos sócios.
                        </p>
                      </div>
                    )}

                    {!isBase && costDiff <= 0 && (
                      <div className="bg-emerald-500/10 p-3.5 rounded-xl border border-emerald-500/20 flex items-center gap-2 text-emerald-400">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                        <span className="text-[11px] font-medium leading-tight">
                          Economia de R$ {Math.abs(costDiff).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} em relação ao modelo atual neste faturamento.
                        </span>
                      </div>
                    )}
                  </div>
                </SpotlightCard>
              );
            })}
          </div>

          {/* GRÁFICO COMPARATIVO DE CURVAS (COMISSÕES VS FATURAMENTO) */}
          <div className="glass-panel p-6 rounded-2xl border border-border flex flex-col gap-6">
            <div>
              <h3 className="text-base font-bold text-text uppercase tracking-widest flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-400" /> Curva de Comissões por Nível de Faturamento Total
              </h3>
              <p className="text-[11px] text-slate-400">
                Considerando {orthoSharePct}% do faturamento como Ortodontia (isento no Comercial) para os modelos correspondentes.
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
                  Valores calculados com {orthoSharePct}% do faturamento sendo Ortodontia para cada degrau de receita da clínica.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-panel border-b border-border text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    <th className="p-4 pl-6">Cenário / Modelo</th>
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
                        <td className="p-4 text-slate-400 text-[11px]">
                          {sc.excludeOrtho ? (
                            <span className="text-amber-400 font-bold">Sem Orto</span>
                          ) : (
                            <span className="text-emerald-400 font-bold">Total</span>
                          )}
                        </td>
                        
                        {testValues.map(v => {
                          const { amount: comm } = calculateCommission(sc, v, orthoSharePct);
                          const taxes = v * (taxesAndFeesPct / 100);
                          const mat = v * (directMaterialsPct / 100);
                          const netProfit = v - (taxes + mat + comm) - fixedExpenses;
                          const netMargin = v > 0 ? (netProfit / v) * 100 : 0;

                          return (
                            <td key={v} className="p-4 text-right font-mono">
                              <div className="font-bold text-text">R$ {comm.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</div>
                              <div className={`text-[10px] ${netMargin >= 18 ? 'text-emerald-400' : netMargin >= 10 ? 'text-amber-400' : 'text-red-400'}`}>
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

      {/* ABA 3: RETRO-SIMULAÇÃO (DADOS HISTÓRICOS REAIS) */}
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
                  O sistema analisa cada lançamento individualmente, subtraindo os pacientes e procedimentos de Ortodontia para o Comercial.
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs text-slate-200">
                  {historicalMonthlyData.map((row: any) => {
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
                  Gerencie as faixas de atingimento, percentuais e regras de exclusão de Ortodontia.
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
                        👥 Grupo: {sc.targetGroup}
                      </span>
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                        sc.excludeOrtho ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}>
                        {sc.excludeOrtho ? '🚫 Isenta Ortodontia' : '🌐 Faturamento Total'}
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
                  placeholder="Ex: Comercial 2% > 45k | 3% > 55k | 5% > 60k"
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
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Tipo de Regra</label>
                  <select 
                    value={formScenario.ruleType}
                    onChange={(e: any) => setFormScenario({ ...formScenario, ruleType: e.target.value })}
                    className="w-full bg-panel border border-border rounded-xl px-3 py-2.5 text-xs text-text outline-none"
                  >
                    <option value="tiered">Escalonado por Faixas (Ex: 45k/55k/60k)</option>
                    <option value="trigger">Gatilho Único (Ex: a partir de 70k)</option>
                    <option value="flat">Linear / Fixo em tudo (Ex: 1% de tudo)</option>
                  </select>
                </div>
              </div>

              {/* OPÇÃO DE EXCLUIR ORTODONTIA */}
              <div className="flex items-center gap-2 p-3 bg-panel rounded-xl border border-border">
                <input 
                  type="checkbox" 
                  id="excludeOrthoCheckbox"
                  checked={formScenario.excludeOrtho}
                  onChange={(e) => setFormScenario({ ...formScenario, excludeOrtho: e.target.checked })}
                  className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="excludeOrthoCheckbox" className="text-xs text-slate-300 font-medium cursor-pointer">
                  <strong>Não contabilizar Ortodontia</strong> (pacientes e procedimentos de ortodontia são isentos de comissão comercial).
                </label>
              </div>

              {formScenario.ruleType === 'trigger' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Percentual (%)</label>
                    <input 
                      type="number" 
                      step="0.1" 
                      value={formScenario.percentage}
                      onChange={(e) => setFormScenario({ ...formScenario, percentage: parseFloat(e.target.value) || 0 })}
                      placeholder="Ex: 2.0"
                      className="w-full bg-panel border border-border rounded-xl px-4 py-2 text-sm text-text font-mono font-bold outline-none focus:border-indigo-500"
                    />
                  </div>

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
                </div>
              )}

              {formScenario.ruleType === 'flat' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Percentual Fixo (%)</label>
                  <input 
                    type="number" 
                    step="0.1" 
                    value={formScenario.percentage}
                    onChange={(e) => setFormScenario({ ...formScenario, percentage: parseFloat(e.target.value) || 0 })}
                    placeholder="Ex: 1.0"
                    className="w-full bg-panel border border-border rounded-xl px-4 py-2 text-sm text-text font-mono font-bold outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Cor do Cenário nos Gráficos</label>
                <div className="flex gap-2">
                  {['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#e11d48'].map(color => (
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
