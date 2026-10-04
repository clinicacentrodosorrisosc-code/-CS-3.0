
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Tooltip as RechartsTooltip, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Line, ComposedChart, Area
} from 'recharts';
import { supabase } from '../supabaseClient';
import { useRealtimeSubscription, notifyDataChange } from '../lib/realtime';
import { Banknote, Calendar, ChevronLeft, ChevronRight, ClipboardCheck, ReceiptText, Settings, UserCheck, X } from 'lucide-react';
import { CommercialDailyReport } from './CommercialDailyReport';
import { ReceptionDailyReport } from './ReceptionDailyReport';
import { PerformanceMetrics } from './PerformanceMetrics';
import { ClinicaExpertsAgenda } from './ClinicaExpertsAgenda';
import { AnimatedNumber } from './ui/animated-number';
import { DateRangePicker } from './ui/date-range-picker';
import { DonutChart } from './ui/donut-chart';

// --- TYPES ---
interface DailyData {
  date: string; 
  revenue: number;
  goalRevenue: number;
  salesCount: number;
  teamRevenue: Record<string, number>;
  teamRevenueChart: Record<string, number>;
}

interface DailyTeamStats {
    scheduled: number;
    evaluated: number;
    noShow: number;
}

interface DailyEvalData {
    ana: DailyTeamStats;
    comercial: DailyTeamStats;
}

interface MonthlyGoals {
    revenue: number;
    businessDays: number;
    anaEvalGoal: number;
    comercialEvalGoal: number;
}

interface MonthlyFunnelInput {
    leadsAna: number;
    leadsComercial: number;
    tarefasAtrasadas?: number;
    oportunidadesPorVendedor?: Record<string, { criados: number, ganhos: number, perdidos: number }>;
    procedimentos?: Record<string, number>;
}

interface DashboardProps {
    userRole?: string;
    allowedSubTabs?: string[];
    requestedSubTab?: string | null;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export const Dashboard: React.FC<DashboardProps> = ({ requestedSubTab }) => {
  // Props userRole and allowedSubTabs removed as they were unreferenced

  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeSubTab, setActiveSubTab] = useState<'geral' | 'commercial' | 'reception' | 'agenda'>('geral');
  
  useEffect(() => {
    // Integration cleanup
  }, []);

  const getMonthKey = (date: Date) => date.toISOString().slice(0, 7);
  const currentKey = getMonthKey(currentDate);

  // --- STATES ---
  const [goalsMap, setGoalsMap] = useState<Record<string, MonthlyGoals>>({});
  const [funnelMap, setFunnelMap] = useState<Record<string, MonthlyFunnelInput>>({});
  const [monthRevenueData, setMonthRevenueData] = useState<Record<string, DailyData>>({});
  const [evaluationCounts, setEvaluationCounts] = useState<Record<string, DailyEvalData>>({});
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
  
  useEffect(() => {
    if (requestedSubTab === 'commercial') {
      setActiveSubTab('commercial');
    } else if (requestedSubTab === 'reception') {
      setActiveSubTab('reception');
    } else if (requestedSubTab === 'geral') {
      setActiveSubTab('geral');
    } else if (requestedSubTab === 'agenda') {
      setActiveSubTab('agenda');
    }
  }, [requestedSubTab]);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [trendViewMode, setTrendViewMode] = useState<'diaria' | 'mensal' | 'personalizado'>('diaria');
  const [insightView, setInsightView] = useState<'trend' | 'performance'>('trend');
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [customEndDate, setCustomEndDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });

  const defaultGoals = useMemo<MonthlyGoals>(() => ({ revenue: 120000, businessDays: 22, anaEvalGoal: 30, comercialEvalGoal: 30 }), []);
  const defaultFunnel = useMemo<MonthlyFunnelInput>(() => ({ 
      leadsAna: 0, 
      leadsComercial: 0,
      oportunidadesPorVendedor: {
          'ana': { criados: 0, ganhos: 0, perdidos: 0 },
          'comercial': { criados: 0, ganhos: 0, perdidos: 0 }
      }
  }), []);

  const currentGoals = (goalsMap[currentKey] || defaultGoals) as MonthlyGoals;
  const currentFunnel = (funnelMap[currentKey] || defaultFunnel) as MonthlyFunnelInput;

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // --- DATA LOADING ---
  const loadDashboardData = useCallback(async () => {
      try {
          setIsLoadingDashboard(true);
          
          const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
          const startDate = `${currentMonthStr}-01`;
          const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
          const endDate = `${currentMonthStr}-${String(lastDayOfMonth).padStart(2, '0')}`;

          const [configsRes, evalsRes] = await Promise.all([
              supabase.from('dashboard_configs').select('*'),
              supabase.from('daily_evaluations').select('*').gte('date', startDate).lte('date', endDate)
          ]);

          if (configsRes.error) console.error("Erro ao carregar configs:", configsRes.error);
          if (configsRes.data) {
              const newGoals: Record<string, MonthlyGoals> = {};
              const newFunnel: Record<string, MonthlyFunnelInput> = {};
              configsRes.data.forEach((c: any) => {
                  newGoals[c.month_key] = {
                      revenue: Number(c.revenue_goal) || 0,
                      businessDays: Number(c.business_days) || 22,
                      anaEvalGoal: Number(c.ana_eval_goal) || 0,
                      comercialEvalGoal: Number(c.comercial_eval_goal) || 0
                  };
                  newFunnel[c.month_key] = {
                      leadsAna: Number(c.leads_ana) || 0,
                      leadsComercial: Number(c.leads_com) || 0
                  };
              });
              setGoalsMap(prev => ({ ...prev, ...newGoals }));
              setFunnelMap(prev => ({ ...prev, ...newFunnel }));
          }

          if (evalsRes.error) console.error("Erro ao carregar avaliações:", evalsRes.error);
          if (evalsRes.data) {
              const evalMap: Record<string, DailyEvalData> = {};
              evalsRes.data.forEach((ev: any) => {
                  evalMap[ev.date] = {
                      ana: { 
                        scheduled: ev.ana_scheduled || 0, 
                        evaluated: ev.ana_evaluated || 0,
                        noShow: ev.ana_no_show || 0
                      },
                      comercial: { 
                        scheduled: ev.com_scheduled || 0, 
                        evaluated: ev.com_evaluated || 0,
                        noShow: ev.com_no_show || 0
                      }
                  };
              });
              setEvaluationCounts(prev => ({ ...prev, ...evalMap }));
          }

          let allTxs: any[] = [];
          let offset = 0;
          let hasMore = true;
          const yearStartDate = `${currentYear}-01-01`;
          const yearEndDate = `${currentYear}-12-31`;
          while (hasMore) {
              const { data: pageTxs, error: pageError } = await supabase.from('transactions')
                  .select('date, amount, category, description, procedure, sales_team, status')
                  .eq('type', 'income')
                  .gte('date', yearStartDate)
                  .lte('date', yearEndDate)
                  .order('date', { ascending: false })
                  .range(offset, offset + 999);
                  
              if (pageError) throw pageError;
              if (!pageTxs || pageTxs.length === 0) {
                  hasMore = false;
              } else {
                  allTxs = [...allTxs, ...pageTxs];
                  offset += 1000;
                  if (pageTxs.length < 1000) hasMore = false;
              }
          }
          const txs = allTxs;
          if (txs) {
              const incomeMap: Record<string, DailyData> = {};
              txs.forEach((tx: any) => {
                  if (!tx.date || tx.status !== 'Paid') return;
                  const amount = Number(tx.amount);
                  const cat = (tx.category || '').toLowerCase();
                  const desc = (tx.description || '').toLowerCase();
                  const proc = (tx.procedure || '').toLowerCase();
                  const team = tx.sales_team || 'Sem Time';
                  const isExcluded = 
                      cat.includes('panorâmica') || cat.includes('documentação') ||
                      desc.includes('panorâmica') || desc.includes('documentação') ||
                      proc.includes('panorâmica') || proc.includes('documentação');
                  
                  const isOrto = 
                      cat.includes('ortodontia') || cat.includes('orto') ||
                      desc.includes('ortodontia') || desc.includes('orto') ||
                      proc.includes('ortodontia') || proc.includes('orto');
                  
                  if (!incomeMap[tx.date]) {
                      incomeMap[tx.date] = { date: tx.date, revenue: 0, goalRevenue: 0, salesCount: 0, teamRevenue: {}, teamRevenueChart: {} };
                  }
                  
                  incomeMap[tx.date].revenue += amount;
                  incomeMap[tx.date].salesCount += 1;
                  
                  if (!incomeMap[tx.date].teamRevenue[team]) {
                      incomeMap[tx.date].teamRevenue[team] = 0;
                  }
                  incomeMap[tx.date].teamRevenue[team] += amount;

                  if (!isOrto) {
                      if (!incomeMap[tx.date].teamRevenueChart[team]) {
                          incomeMap[tx.date].teamRevenueChart[team] = 0;
                      }
                      incomeMap[tx.date].teamRevenueChart[team] += amount;
                  }

                  if (!isExcluded) {
                      incomeMap[tx.date].goalRevenue += amount;
                  }
              });
              setMonthRevenueData(prev => ({ ...prev, ...incomeMap }));
          }

      } catch (error) {
          console.error("Erro ao carregar dashboard:", error);
      } finally {
          setIsLoadingDashboard(false);
      }
  }, [currentDate]);

  useEffect(() => { loadDashboardData(); }, [currentDate, loadDashboardData]);

  useRealtimeSubscription(['dashboard_configs', 'daily_evaluations', 'transactions', 'commercial_daily_reports', 'commercial_reports'], () => {
      loadDashboardData();
  });

  const saveDashboardConfig = async (monthKey: string, goals: MonthlyGoals, funnel: MonthlyFunnelInput) => {
      const payload = {
          month_key: monthKey,
          revenue_goal: Number(goals.revenue),
          business_days: Number(goals.businessDays),
          ana_eval_goal: Number(goals.anaEvalGoal),
          comercial_eval_goal: Number(goals.comercialEvalGoal),
          leads_ana: Number(funnel.leadsAna),
          leads_com: Number(funnel.leadsComercial)
      };
      const { error } = await supabase.from('dashboard_configs').upsert(payload, { onConflict: 'month_key' });
      if (error) console.error("Error saving dashboard data:", error.message);
      else notifyDataChange('dashboard_configs');
  };

  const updateGoalConfig = (field: keyof MonthlyGoals, value: number) => {
      setGoalsMap(prev => ({
          ...prev,
          [currentKey]: { ...(prev[currentKey] || defaultGoals), [field]: value }
      }));
  };

  const handleSaveConfigModal = async () => {
      setIsSaving(true);
      await saveDashboardConfig(currentKey, currentGoals, currentFunnel);
      setIsConfigModalOpen(false);
      setIsSaving(false);
  };

  // --- AUTO REFRESH ---
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadDashboardData();
      }
    }, 1800000); 
    return () => clearInterval(interval);
  }, [currentKey, loadDashboardData]);

  // --- CALCULATIONS ---
  const currentMonthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  const currentMonthEvaluations = Object.entries(evaluationCounts)
    .filter(([date]) => date.startsWith(currentMonthPrefix))
    .map(([, data]) => data);

  const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const renderFinancialView = () => {
    const now = new Date();
    const isThisMonth = now.getFullYear() === currentYear && now.getMonth() === currentMonth;
    const daysInMonthCount = new Date(currentYear, currentMonth + 1, 0).getDate();

    const totalRev = (Object.values(monthRevenueData) as DailyData[]).reduce((acc, curr) => {
        const parts = curr.date.split('-');
        if (Number(parts[0]) === currentYear && (Number(parts[1]) - 1) === currentMonth) return acc + curr.revenue;
        return acc;
    }, 0);

    const teamRevenues = (Object.values(monthRevenueData) as DailyData[]).reduce((acc, curr) => {
        const parts = curr.date.split('-');
        if (Number(parts[0]) === currentYear && (Number(parts[1]) - 1) === currentMonth) {
            if (curr.teamRevenue) {
                Object.entries(curr.teamRevenue).forEach(([team, amount]) => {
                    acc[team] = (acc[team] || 0) + amount;
                });
            }
        }
        return acc;
    }, {} as Record<string, number>);

    const totalGoalRev = (Object.values(monthRevenueData) as DailyData[]).reduce((acc, curr) => {
        const parts = curr.date.split('-');
        if (Number(parts[0]) === currentYear && (Number(parts[1]) - 1) === currentMonth) return acc + (curr.goalRevenue || 0);
        return acc;
    }, 0);

    const perc = (totalRev / Math.max(1, Number(currentGoals.revenue))) * 100;

    const getWorkDaysInRange = (start: number, end: number) => {
        let count = 0;
        for (let d = start; d <= end; d++) {
            const dateObj = new Date(currentYear, currentMonth, d);
            const dayOfWeek = dateObj.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
        }
        return count;
    };

    // Lógica para travar o valor do dia no cabeçalho
    const salesBeforeToday = (Object.values(monthRevenueData) as DailyData[]).reduce((acc, curr) => {
        const parts = curr.date.split('-');
        const dateOfSale = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        const todayAtStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        if (dateOfSale < todayAtStart && Number(parts[0]) === currentYear && (Number(parts[1]) - 1) === currentMonth) {
            return acc + (curr.goalRevenue || 0);
        }
        return acc;
    }, 0);

    const workDaysFromTodayOnwards = isThisMonth ? getWorkDaysInRange(now.getDate(), daysInMonthCount) : 0;
    const neededRevenueAtStartOfToday = Math.max(0, Number(currentGoals.revenue) - salesBeforeToday);
    const dailyMetaRequiredLocked = workDaysFromTodayOnwards > 0 ? neededRevenueAtStartOfToday / workDaysFromTodayOnwards : 0;

    const calculateRemainingWorkDays = () => {
        if (!isThisMonth) {
            if (currentYear > now.getFullYear() || (currentYear === now.getFullYear() && currentMonth > now.getMonth())) {
                return getWorkDaysInRange(1, daysInMonthCount);
            }
            return 0;
        }
        return getWorkDaysInRange(now.getDate(), daysInMonthCount);
    };

    const remainingWorkDays = calculateRemainingWorkDays();
    const neededRevenueReal = Math.max(0, Number(currentGoals.revenue) - totalGoalRev);
    const totalSalesCount = (Object.values(monthRevenueData) as DailyData[]).reduce((total, day) => {
        const [year, month] = day.date.split('-').map(Number);
        return year === currentYear && month - 1 === currentMonth ? total + day.salesCount : total;
    }, 0);
    const averageTicket = totalSalesCount > 0 ? totalRev / totalSalesCount : 0;
    const evaluationSummary = currentMonthEvaluations.reduce((total, day) => ({
        scheduled: total.scheduled + day.ana.scheduled + day.comercial.scheduled,
        evaluated: total.evaluated + day.ana.evaluated + day.comercial.evaluated,
        noShow: total.noShow + day.ana.noShow + day.comercial.noShow
    }), { scheduled: 0, evaluated: 0, noShow: 0 });
    const evaluationRate = evaluationSummary.scheduled > 0 ? (evaluationSummary.evaluated / evaluationSummary.scheduled) * 100 : 0;
    const noShowRate = evaluationSummary.scheduled > 0 ? (evaluationSummary.noShow / evaluationSummary.scheduled) * 100 : 0;

    const trendData = Array.from({ length: daysInMonthCount }, (_, i) => {
        const day = i + 1;
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const revenue = monthRevenueData[dateStr]?.revenue || 0;
        
        let sum = 0;
        let count = 0;
        for (let j = i - 8; j <= i; j++) {
            if (j >= 0) {
                const prevDay = j + 1;
                const prevDateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(prevDay).padStart(2, '0')}`;
                sum += monthRevenueData[prevDateStr]?.revenue || 0;
                count++;
            }
        }
        const movingAvg = sum / count;

        return {
            label: String(day).padStart(2, '0'),
            vendas: revenue,
            mediaMovel: parseFloat(movingAvg.toFixed(2))
        };
    });

    const monthlyTrendData = MONTHS.map((monthName, idx) => {
        const mNum = idx + 1;
        const mPrefix = `${currentYear}-${String(mNum).padStart(2, '0')}`;
        let rev = 0;
        Object.entries(monthRevenueData).forEach(([dateStr, data]) => {
            if (dateStr.startsWith(mPrefix)) {
                rev += data.revenue || 0;
            }
        });
        return {
            label: monthName.slice(0, 3),
            vendas: rev,
            mediaMovel: 0
        };
    });

    const customTrendData = (() => {
        if (!customStartDate || !customEndDate) return [];
        const start = new Date(customStartDate);
        const end = new Date(customEndDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return [];

        const data = [];
        const curr = new Date(start);
        while (curr <= end) {
            const dateStr = curr.toISOString().slice(0, 10);
            const revenue = monthRevenueData[dateStr]?.revenue || 0;
            const label = `${String(curr.getDate()).padStart(2, '0')}/${String(curr.getMonth() + 1).padStart(2, '0')}`;
            data.push({
                label,
                vendas: revenue,
                mediaMovel: 0
            });
            curr.setDate(curr.getDate() + 1);
        }
        return data;
    })();

    const activeTrendData = trendViewMode === 'diaria' 
        ? trendData 
        : trendViewMode === 'mensal' 
        ? monthlyTrendData 
        : customTrendData;

    const renderFinancialCalendarCell = (day: number) => {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const revenue = monthRevenueData[dateStr]?.revenue || 0;
        
        // CÁLCULO DA META DINÂMICA PARA O DIA ESPECÍFICO (TRAVADO AO INÍCIO DO DIA)
        let salesBeforeDay = 0;
        for (let d = 1; d < day; d++) {
            const prevDateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            salesBeforeDay += monthRevenueData[prevDateStr]?.revenue || 0;
        }

        const workDaysFromThisDay = getWorkDaysInRange(day, daysInMonthCount);
        const neededAtStartOfThisDay = Math.max(0, Number(currentGoals.revenue) - salesBeforeDay);
        const daySpecificMeta = workDaysFromThisDay > 0 ? neededAtStartOfThisDay / workDaysFromThisDay : 0;

        const isTargetMet = revenue >= daySpecificMeta;
        const bgColor = revenue > 0 ? (isTargetMet ? 'bg-surface' : 'bg-surface') : 'hover:bg-panel';

        return (
            <div title={`${dateStr}\nRealizado: ${formatCurrency(revenue)}\nMeta diária: ${formatCurrency(daySpecificMeta)}`} className={`h-full flex flex-col justify-between p-1 border border-border transition-all group overflow-hidden ${bgColor}`}>
                <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-text-muted">{day}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                    <div className="flex flex-col">
                        <span className="sr-only">Realizado</span>
                        <span className="text-[9px] text-text font-black truncate">R$ {revenue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[8px] text-slate-500 font-bold uppercase">Meta Diária</span>
                        <span className="text-[9px] text-slate-400 font-bold truncate">R$ {daySpecificMeta.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                </div>
            </div>
        );
    };

    return (
      <div className="flex flex-col gap-3.5 animate-in fade-in pb-6">
          <section className="dashboard-kpi-grid grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <article className="metric-card dashboard-kpi-card">
                  <div className="dashboard-kpi-icon dashboard-kpi-icon--blue"><Banknote size={16} /></div>
                  <div className="min-w-0">
                      <AnimatedNumber value={totalRev} format={formatCurrency} className="dashboard-kpi-value block truncate" />
                      <p className="dashboard-kpi-label">Faturamento do mês</p>
                      <p className={`dashboard-kpi-helper ${perc >= 100 ? 'is-positive' : ''}`}>{perc.toFixed(1)}% da meta mensal</p>
                  </div>
              </article>

              <article className="metric-card dashboard-kpi-card">
                  <div className="dashboard-kpi-icon dashboard-kpi-icon--green"><ClipboardCheck size={16} /></div>
                  <div className="min-w-0">
                      <p className="dashboard-kpi-value">{evaluationSummary.evaluated.toLocaleString('pt-BR')}</p>
                      <p className="dashboard-kpi-label">Avaliações realizadas</p>
                      <p className="dashboard-kpi-helper">{evaluationSummary.scheduled.toLocaleString('pt-BR')} agendadas no período</p>
                  </div>
              </article>

              <article className="metric-card dashboard-kpi-card">
                  <div className="dashboard-kpi-icon dashboard-kpi-icon--yellow"><UserCheck size={16} /></div>
                  <div className="min-w-0">
                      <p className="dashboard-kpi-value">{evaluationRate.toFixed(1)}%</p>
                      <p className="dashboard-kpi-label">Comparecimento</p>
                      <p className="dashboard-kpi-helper">{evaluationSummary.noShow.toLocaleString('pt-BR')} faltas · {noShowRate.toFixed(1)}%</p>
                  </div>
              </article>

              <article className="metric-card dashboard-kpi-card">
                  <div className="dashboard-kpi-icon dashboard-kpi-icon--purple"><ReceiptText size={16} /></div>
                  <div className="min-w-0">
                      <p className="dashboard-kpi-value truncate">{formatCurrency(averageTicket)}</p>
                      <p className="dashboard-kpi-label">Ticket médio</p>
                      <p className="dashboard-kpi-helper">{totalSalesCount} recebimento{totalSalesCount === 1 ? '' : 's'} no mês</p>
                  </div>
              </article>
          </section>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                  <h2 className="text-sm font-bold text-[#17211D] dark:text-white">Análise de Resultados</h2>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#5E6D66] dark:text-slate-400">Tendência e performance no mesmo espaço</p>
              </div>
              <div className="flex w-fit rounded-xl border border-[#DFE6E2] bg-[#F0F4F2] p-0.5 dark:border-white/[0.08] dark:bg-white/[0.04]">
                  <button type="button" onClick={() => setInsightView('trend')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-tight transition-all ${insightView === 'trend' ? 'bg-[var(--primary)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text)]'}`}>Tendência</button>
                  <button type="button" onClick={() => setInsightView('performance')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-tight transition-all ${insightView === 'performance' ? 'bg-[var(--primary)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text)]'}`}>Performance</button>
              </div>
          </div>

          <div className="dashboard-insights-grid grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.85fr)]">
          {insightView === 'trend' ? (
          <section className="bg-white dark:bg-[#19231F] p-5 rounded-2xl border border-[#DFE6E2] dark:border-white/[0.08] shadow-sm">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-3">
                  <div>
                      <h3 className="text-sm font-bold text-[#17211D] dark:text-white">Tendência de Vendas</h3>
                      <p className="text-[10px] text-[#5E6D66] dark:text-slate-400 font-bold uppercase tracking-wider">
                          Desempenho ({trendViewMode === 'diaria' ? 'Visão Diária' : trendViewMode === 'mensal' ? 'Visão Mensal (Anual)' : 'Período Personalizado'})
                      </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                      <div className="flex bg-[#F0F4F2] dark:bg-white/[0.04] p-0.5 rounded-xl border border-[#DFE6E2] dark:border-white/[0.08]">
                          <button
                              type="button"
                              onClick={() => setTrendViewMode('diaria')}
                              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${trendViewMode === 'diaria' ? 'bg-[var(--primary)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text)]'}`}
                          >
                              Diária
                          </button>
                          <button
                              type="button"
                              onClick={() => setTrendViewMode('mensal')}
                              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${trendViewMode === 'mensal' ? 'bg-[var(--primary)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text)]'}`}
                          >
                              Mensal
                          </button>
                          <button
                              type="button"
                              onClick={() => setTrendViewMode('personalizado')}
                              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${trendViewMode === 'personalizado' ? 'bg-[var(--primary)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text)]'}`}
                          >
                              Personalizado
                          </button>
                      </div>

                      {trendViewMode === 'personalizado' && (
                          <><DateRangePicker value={{ start: customStartDate, end: customEndDate }} onChange={({ start, end }) => { setCustomStartDate(start); setCustomEndDate(end); }} className="min-w-[220px] max-w-[280px]" />
                          {/*
                              <input
                                  type="date"
                                  value={customStartDate}
                                  onChange={e => setCustomStartDate(e.target.value)}
                                  className="bg-[#F0F4F2] dark:bg-white/[0.06] border border-[#DFE6E2] dark:border-white/10 rounded-lg px-2 py-0.5 text-[#17211D] dark:text-white text-xs focus:outline-none focus:border-[#1F6F5B]"
                              />
                              <span className="text-[#86938D] text-xs">até</span>
                              <input
                                  type="date"
                                  value={customEndDate}
                                  onChange={e => setCustomEndDate(e.target.value)}
                                  className="bg-[#F0F4F2] dark:bg-white/[0.06] border border-[#DFE6E2] dark:border-white/10 rounded-lg px-2 py-0.5 text-[#17211D] dark:text-white text-xs focus:outline-none focus:border-[#1F6F5B]"
                              />
                          </div> */}</>
                      )}

                      <div className="flex gap-3">
                          <div className="flex items-center gap-1.5">
                              <div className="size-2.5 rounded-full bg-[#1F6F5B]"></div>
                              <span className="text-[10px] font-bold text-[#5E6D66] dark:text-slate-400 uppercase">Vendas</span>
                          </div>
                          {trendViewMode === 'diaria' && (
                              <div className="flex items-center gap-1.5">
                                  <div className="size-2.5 rounded-full bg-[#2A8069]"></div>
                                  <span className="text-[10px] font-bold text-[#5E6D66] dark:text-slate-400 uppercase">Média Móvel</span>
                              </div>
                          )}
                      </div>
                  </div>
              </div>
              <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={activeTrendData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                          <defs>
                              <linearGradient id="colorVendasNexus" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#3478F6" stopOpacity={0.22}/>
                                  <stop offset="95%" stopColor="#3478F6" stopOpacity={0}/>
                              </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 9, fontWeight: 'bold' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 9 }} tickFormatter={(val) => `R$${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`} />
                          <RechartsTooltip 
                              contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)', fontSize: '11px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}
                              itemStyle={{ color: 'var(--text)' }}
                              formatter={(val: number) => `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                          />
                          <Area type="monotone" dataKey="vendas" fillOpacity={1} fill="url(#colorVendasNexus)" stroke="none" />
                          <Line type="monotone" dataKey="vendas" stroke="#3478F6" strokeWidth={2.5} dot={{ r: 2.5, fill: '#3478F6', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                          {trendViewMode === 'diaria' && (
                              <Line type="monotone" dataKey="mediaMovel" stroke="#2A8069" strokeWidth={2} dot={false} strokeDasharray="4 4" />
                          )}
                      </ComposedChart>
                  </ResponsiveContainer>
              </div>
          </section>
          ) : (
          <PerformanceMetrics 
              monthRevenueData={monthRevenueData}
              currentGoals={currentGoals}
              currentYear={currentYear}
              currentMonth={currentMonth}
          />
          )}

          <section className="dashboard-team-card flex min-h-[292px] flex-col rounded-xl border border-[var(--border)] bg-white p-4">
              <div className="flex items-center justify-between">
                  <div>
                      <h3 className="text-sm font-semibold text-[var(--text)]">Carga da equipe</h3>
                      <p className="mt-0.5 text-[9px] text-[var(--text-muted)]">Distribuição do faturamento no período</p>
                  </div>
                  <button type="button" className="grid size-7 place-items-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)]" aria-label="Mais opções">•••</button>
              </div>
              <div className="mt-5 grid flex-1 grid-cols-[112px_minmax(0,1fr)] items-center gap-4">
                  <DonutChart
                      data={[{ label: 'Meta alcançada', value: Math.min(Math.max(perc, 0), 100), color: '#3478f6' }]}
                      totalValue={100}
                      size={112}
                      strokeWidth={12}
                      highlightOnHover={false}
                      centerContent={
                          <div>
                              <strong className="block text-xl font-semibold tabular-nums text-[var(--text)]">{Math.round(Math.min(perc, 100))}%</strong>
                              <span className="text-[9px] text-[var(--text-muted)]">da meta</span>
                          </div>
                      }
                  />
                  <div className="min-w-0 space-y-3">
                      {Object.entries(teamRevenues).slice(0, 5).map(([team, amount], index) => {
                          const totalTeams = Math.max(Object.values(teamRevenues).reduce((sum, value) => sum + Number(value), 0), 1);
                          const share = Math.round((Number(amount) / totalTeams) * 100);
                          return (
                              <div key={team} className="grid grid-cols-[minmax(0,1fr)_34px] items-center gap-2 text-[10px]">
                                  <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                          <span className={`size-1.5 shrink-0 rounded-full team-dot-${index % 4}`} />
                                          <span className="truncate font-medium text-[var(--text-secondary)]">{team}</span>
                                      </div>
                                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-[#eef0f3]"><div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${share}%` }} /></div>
                                  </div>
                                  <span className="text-right font-semibold tabular-nums text-[var(--text)]">{share}%</span>
                              </div>
                          );
                      })}
                  </div>
              </div>
              <button type="button" onClick={() => setActiveSubTab('commercial')} className="mt-3 h-8 rounded-lg border border-[var(--border)] text-[10px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]">Ver desempenho comercial</button>
          </section>
          </div>

          <section className="bg-white dark:bg-[#19231F] rounded-2xl border border-[#DFE6E2] dark:border-white/[0.08] overflow-hidden flex flex-col shadow-sm transition-colors duration-300">
                <div className="p-3 bg-[#F5F7F6] dark:bg-white/[0.02] border-b border-[#DFE6E2] dark:border-white/[0.08] flex justify-between items-center">
                    <h3 className="text-xs font-bold text-[#17211D] dark:text-slate-100 flex items-center gap-2">
                        <Calendar className="text-[#1F6F5B] dark:text-[#63B596] w-4 h-4" />
                        Calendário de Faturamento: Realizado vs Meta
                    </h3>
                </div>
                <div className="grid grid-cols-7">
                    {WEEKDAYS.map(day => <div key={day} className="p-1.5 text-center text-[9px] font-extrabold uppercase text-[#86938D] border-b border-[#DFE6E2] dark:border-white/[0.08] bg-[#F5F7F6]/50 dark:bg-white/[0.02]">{day}</div>)}
                    {Array.from({ length: 35 }).map((_, idx) => {
                        const daysInMonthCountCell = new Date(currentYear, currentMonth + 1, 0).getDate();
                        const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
                        const day = idx - firstDayOfMonth + 1;
                        return (
                            <div key={idx} className="min-h-[52px] border-b border-[#DFE6E2] dark:border-white/[0.08] border-r border-[#DFE6E2] dark:border-white/[0.08] last:border-r-0">
                                {(day > 0 && day <= daysInMonthCountCell) ? renderFinancialCalendarCell(day) : <div className="w-full h-full bg-[#F5F7F6]/30 dark:bg-white/[0.01]"></div>}
                            </div>
                        );
                    })}
                </div>
          </section>
      </div>
    );
  };

  return (
    <div className="flex-1 flex w-full h-full bg-transparent text-slate-300 font-sans overflow-hidden">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-transparent relative">
        
        {/* View Content */}
        <div className="flex-1 overflow-y-auto px-3 py-3 lg:px-5 lg:py-4 custom-scrollbar">
           <div className="dashboard-workspace w-full max-w-[1600px] mx-auto">
               
               <div className="dashboard-command-bar flex flex-col gap-5 p-4 md:flex-row md:items-center md:justify-between md:p-5">
                   <div>
                       <span className="dashboard-eyebrow">Centro de operação</span>
                       <h1 className="mt-2 text-2xl font-semibold text-text bg-transparent outline-none w-full block resize-none leading-tight tracking-[-0.035em] md:text-[28px]">
                          {activeSubTab === 'geral' ? 'Visão geral da clínica' : activeSubTab === 'commercial' ? 'Comercial' : activeSubTab === 'reception' ? 'Recepção' : 'Agenda'}
                       </h1>
                       <p className="mt-1 text-xs text-[var(--text-secondary)]">Acompanhe a operação, as metas e os próximos compromissos.</p>
                   </div>

                   <div className="flex items-center gap-2 text-xs text-slate-400">
                      <div className="flex items-center gap-2 bg-[var(--surface-high)] p-1 rounded-full">
                          <button onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth()-1); setCurrentDate(d); }} className="p-1 hover:bg-panel rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"><ChevronLeft className="w-3.5 h-3.5" /></button>
                          <div className="flex items-center gap-1.5 px-2"><span className="text-xs font-bold text-text uppercase">{currentDate.toLocaleDateString('pt-BR', { month: 'short' })}</span><span className="text-[10px] text-slate-400 font-mono font-bold">{currentDate.getFullYear()}</span></div>
                          <button onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth()+1); setCurrentDate(d); }} className="p-1 hover:bg-panel rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"><ChevronRight className="w-3.5 h-3.5" /></button>
                      </div>
                      {activeSubTab === 'geral' && (
                          <button onClick={() => setIsConfigModalOpen(true)} className="px-3 py-1.5 rounded-xl btn btn-primary flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer" title="Definir Metas do Mês"><Settings className="w-3.5 h-3.5" /> Metas</button>
                      )}
                   </div>
               </div>

               {/* SUB NAVIGATION BAR */}
               <div className="dashboard-segmented-control flex items-center gap-1 overflow-x-auto no-scrollbar mb-6">
                    {[
                        { id: 'geral', label: 'Geral' },
                        { id: 'commercial', label: 'Comercial' },
                        { id: 'agenda', label: 'Agenda' },
                        { id: 'reception', label: 'Recepção' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveSubTab(tab.id as 'geral' | 'commercial' | 'reception' | 'agenda')}
                            className={`
                                px-4 py-2 rounded-full text-[11px] font-semibold tracking-[-0.01em] transition-colors whitespace-nowrap cursor-pointer
                                ${activeSubTab === tab.id 
                                    ? 'bg-white text-[var(--primary)] shadow-[0_1px_3px_rgba(0,0,0,0.12)] dark:bg-white/[0.12]'
                                    : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-white/65 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.04]'}
                            `}
                        >
                            {tab.label}
                        </button>
                    ))}
               </div>

              <div className="flex-1 w-full pb-20">
                  {isLoadingDashboard ? (
                    <div className="flex flex-col gap-6 w-full animate-pulse">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="skeleton h-32 rounded-2xl"></div>
                            <div className="skeleton h-32 rounded-2xl"></div>
                            <div className="skeleton h-32 rounded-2xl"></div>
                        </div>
                        <div className="skeleton h-[400px] w-full rounded-2xl mt-4"></div>
                    </div>
                  ) : (
                    activeSubTab === 'geral' ? renderFinancialView() : activeSubTab === 'commercial' ? <CommercialDailyReport /> : activeSubTab === 'reception' ? <ReceptionDailyReport /> : <ClinicaExpertsAgenda />
                  )}
              </div>

           </div>
        </div>
      </div>

      {isConfigModalOpen && (
          <div className="modal-overlay z-[150] animate-in fade-in duration-150">
            <div className="modal-panel flex max-w-lg flex-col gap-6">
              <div className="flex justify-between items-center border-b border-border pb-4">
                  <div>
                    <h3 className="text-xl font-bold text-text leading-tight">Configurações do Mês</h3>
                    <p className="text-[10px] text-slate-500 uppercase font-bold mt-1 tracking-widest">{MONTHS[currentMonth]} {currentYear}</p>
                  </div>
                  <button onClick={() => setIsConfigModalOpen(false)} className="text-slate-500 hover:text-text"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase block mb-1.5 font-bold tracking-wider">Meta de Faturamento (R$)</label>
                  <input 
                    type="number" 
                    value={currentGoals.revenue} 
                    onChange={e => updateGoalConfig('revenue', Number(e.target.value))} 
                    className="form-control"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase block mb-1.5 font-bold tracking-wider">Dias Úteis no Mês</label>
                  <input 
                    type="number" 
                    value={currentGoals.businessDays} 
                    onChange={e => updateGoalConfig('businessDays', Number(e.target.value))} 
                    className="form-control"
                  />
                </div>
                
                <button 
                  onClick={handleSaveConfigModal} 
                  disabled={isSaving}
                  className="w-full mt-4 py-3 glass-button glass-button-primary text-text font-black rounded-xl transition-colors active:scale-95 disabled:opacity-50 text-xs uppercase tracking-widest shadow-lg"
                >
                  Salvar Metas
                </button>
              </div>
            </div>
          </div>
      )}
    </div>
  );
};
