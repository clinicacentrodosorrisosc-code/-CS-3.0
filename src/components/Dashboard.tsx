
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Tooltip as RechartsTooltip, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Line, ComposedChart, Area
} from 'recharts';
import { supabase } from '../supabaseClient';
import { useRealtimeSubscription, notifyDataChange } from '../lib/realtime';
import { Calendar, ChevronLeft, ChevronRight, Settings, X } from 'lucide-react';
import { CommercialDailyReport } from './CommercialDailyReport';
import { ReceptionDailyReport } from './ReceptionDailyReport';
import { PerformanceMetrics } from './PerformanceMetrics';

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
  const [activeSubTab, setActiveSubTab] = useState<'geral' | 'commercial' | 'reception'>('geral');
  
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
    }
  }, [requestedSubTab]);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [trendViewMode, setTrendViewMode] = useState<'diaria' | 'mensal' | 'personalizado'>('diaria');
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
            <div className={`h-full flex flex-col p-2 border border-border transition-all group overflow-hidden ${bgColor}`}>
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-text-muted">{day}</span>
                </div>
                <div className="flex flex-col gap-1">
                    <div className="flex flex-col">
                        <span className="text-[8px] text-text-muted font-bold uppercase">Realizado</span>
                        <span className="text-[10px] text-text font-black truncate">R$ {revenue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
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
          <section className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {/* KPI 1: Faturamento Total */}
                <div className="bezel-outer">
                  <div className="bezel-inner p-4.5 flex flex-col justify-between h-full relative overflow-hidden">
                    <div className="flex justify-between items-start mb-2.5">
                        <div>
                            <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-300">Faturamento Total</p>
                            <h3 className="text-2xl lg:text-3xl font-black text-slate-50 light:text-slate-900 tabular-nums mt-1 tracking-tight">{formatCurrency(totalRev)}</h3>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1">
                            {Object.entries(teamRevenues).map(([team, amount]) => (
                                <div key={team} className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold uppercase text-slate-400">{team}</span>
                                    <span className="text-[10px] font-bold text-slate-100 tabular-nums">{formatCurrency(amount)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="mt-1.5 w-full bg-white/[0.08] light:bg-black/[0.08] h-2 rounded-full overflow-hidden p-[1px]">
                        <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all duration-500" style={{ width: `${Math.min(perc, 100)}%` }}></div>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-[11px] text-slate-300 font-semibold">Meta: {formatCurrency(Number(currentGoals.revenue))}</span>
                      <span className={`text-[10px] font-extrabold tabular-nums px-2.5 py-0.5 rounded-full ${perc >= 100 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'}`}>
                        {perc.toFixed(1)}% da meta
                      </span>
                    </div>
                  </div>
                </div>

                {/* KPI 2: Falta para Meta */}
                <div className="bezel-outer">
                  <div className="bezel-inner p-4.5 flex flex-col justify-between h-full">
                    <div>
                      <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-300 mb-1">Falta para a Meta</p>
                      <h3 className="text-2xl lg:text-3xl font-black text-slate-50 light:text-slate-900 tabular-nums tracking-tight">{formatCurrency(neededRevenueReal)}</h3>
                    </div>
                    <div className="flex justify-between items-center mt-3 pt-2 border-t border-white/[0.08] text-[11px] text-slate-300">
                        <span>Dias úteis totais</span>
                        <strong className="text-slate-100 font-mono font-extrabold">{getWorkDaysInRange(1, daysInMonthCount)} dias</strong>
                    </div>
                  </div>
                </div>

                {/* KPI 3: Meta Diária Necessária */}
                <div className="bezel-outer">
                  <div className="bezel-inner p-4.5 flex flex-col justify-between h-full">
                    <div>
                      <p className="text-[11px] font-extrabold uppercase tracking-wider text-sky-400 mb-1">Meta Diária Necessária</p>
                      <h3 className="text-2xl lg:text-3xl font-black text-sky-400 tabular-nums tracking-tight">{formatCurrency(dailyMetaRequiredLocked)}</h3>
                    </div>
                    <div className="flex justify-between items-center mt-3 pt-2 border-t border-white/[0.08] text-[11px] text-slate-300">
                        <span>Restam na operação</span>
                        <strong className="text-sky-300 font-mono font-extrabold">{remainingWorkDays} dias úteis</strong>
                    </div>
                  </div>
                </div>
          </section>

          <section className="glass-panel p-4 rounded-xl border border-border bg-panel/30">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-3">
                  <div>
                      <h3 className="text-sm font-bold text-text">Tendência de Vendas</h3>
                      <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">
                          Desempenho ({trendViewMode === 'diaria' ? 'Visão Diária' : trendViewMode === 'mensal' ? 'Visão Mensal (Anual)' : 'Período Personalizado'})
                      </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                      <div className="flex bg-surface p-0.5 rounded-lg border border-border">
                          <button
                              type="button"
                              onClick={() => setTrendViewMode('diaria')}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${trendViewMode === 'diaria' ? 'bg-sky-600/30 text-sky-300 border border-sky-500/40 shadow-sm' : 'text-slate-400 hover:text-text'}`}
                          >
                              Diária
                          </button>
                          <button
                              type="button"
                              onClick={() => setTrendViewMode('mensal')}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${trendViewMode === 'mensal' ? 'bg-sky-600/30 text-sky-300 border border-sky-500/40 shadow-sm' : 'text-slate-400 hover:text-text'}`}
                          >
                              Mensal
                          </button>
                          <button
                              type="button"
                              onClick={() => setTrendViewMode('personalizado')}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${trendViewMode === 'personalizado' ? 'bg-sky-600/30 text-sky-300 border border-sky-500/40 shadow-sm' : 'text-slate-400 hover:text-text'}`}
                          >
                              Personalizado
                          </button>
                      </div>

                      {trendViewMode === 'personalizado' && (
                          <div className="flex items-center gap-1.5 bg-surface p-1 rounded-lg border border-border text-[11px]">
                              <input
                                  type="date"
                                  value={customStartDate}
                                  onChange={e => setCustomStartDate(e.target.value)}
                                  className="bg-panel border border-border rounded px-2 py-0.5 text-text text-xs focus:outline-none focus:border-sky-500"
                              />
                              <span className="text-slate-400 text-xs">até</span>
                              <input
                                  type="date"
                                  value={customEndDate}
                                  onChange={e => setCustomEndDate(e.target.value)}
                                  className="bg-panel border border-border rounded px-2 py-0.5 text-text text-xs focus:outline-none focus:border-sky-500"
                              />
                          </div>
                      )}

                      <div className="flex gap-3">
                          <div className="flex items-center gap-1.5">
                              <div className="size-2.5 rounded-sm bg-sky-500"></div>
                              <span className="text-[9px] font-bold text-slate-400 uppercase">Vendas</span>
                          </div>
                          {trendViewMode === 'diaria' && (
                              <div className="flex items-center gap-1.5">
                                  <div className="size-2.5 rounded-sm bg-indigo-400"></div>
                                  <span className="text-[9px] font-bold text-slate-400 uppercase">Média Móvel (9p)</span>
                              </div>
                          )}
                      </div>
                  </div>
              </div>
              <div className="h-[210px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={activeTrendData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                          <defs>
                              <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25}/>
                                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                              </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 9, fontWeight: 'bold' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 9 }} tickFormatter={(val) => `R$${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`} />
                          <RechartsTooltip 
                              contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: '11px' }}
                              itemStyle={{ color: 'var(--text)' }}
                              formatter={(val: number) => `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                          />
                          <Area type="monotone" dataKey="vendas" fillOpacity={1} fill="url(#colorVendas)" stroke="none" />
                          <Line type="monotone" dataKey="vendas" stroke="#0ea5e9" strokeWidth={2.5} dot={{ r: 2.5, fill: '#0ea5e9', strokeWidth: 0 }} activeDot={{ r: 4.5 }} />
                          {trendViewMode === 'diaria' && (
                              <Line type="monotone" dataKey="mediaMovel" stroke="#818cf8" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                          )}
                      </ComposedChart>
                  </ResponsiveContainer>
              </div>
          </section>

          <PerformanceMetrics 
              monthRevenueData={monthRevenueData}
              currentGoals={currentGoals}
              currentYear={currentYear}
              currentMonth={currentMonth}
          />

          <section className="glass-panel rounded-xl border border-border overflow-hidden flex flex-col shadow-lg transition-colors duration-300">
                <div className="p-3 bg-panel/70 border-b border-border flex justify-between items-center">
                    <h3 className="text-sm font-bold text-text flex items-center gap-2">
                        <Calendar className="text-sky-400 w-4 h-4" />
                        Calendário de Faturamento: Realizado vs Meta
                    </h3>
                </div>
                <div className="grid grid-cols-7">
                    {WEEKDAYS.map(day => <div key={day} className="p-2 text-center text-[9px] font-bold uppercase text-slate-400 border-b border-border bg-panel/30">{day}</div>)}
                    {Array.from({ length: 35 }).map((_, idx) => {
                        const daysInMonthCountCell = new Date(currentYear, currentMonth + 1, 0).getDate();
                        const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
                        const day = idx - firstDayOfMonth + 1;
                        return (
                            <div key={idx} className="min-h-[75px] border-b border-border border-r border-border last:border-r-0">
                                {(day > 0 && day <= daysInMonthCountCell) ? renderFinancialCalendarCell(day) : <div className="w-full h-full bg-panel/30"></div>}
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
        <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-4 custom-scrollbar">
           <div className={`w-full transition-all duration-300`}>
               
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                   <div>
                       <h1 className="text-xl md:text-2xl font-bold text-text bg-transparent outline-none w-full block resize-none leading-tight tracking-tight">
                          {activeSubTab === 'geral' ? 'Dashboard Geral' : activeSubTab === 'commercial' ? 'Comercial' : 'Recepção'}
                       </h1>
                       <p className="text-xs text-slate-400 mt-0.5">Métricas de performance e faturamento em tempo real.</p>
                   </div>

                   <div className="flex items-center gap-2 text-xs text-slate-400">
                      <div className="flex items-center gap-2 bg-surface/80 border border-border p-1 rounded-xl">
                          <button onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth()-1); setCurrentDate(d); }} className="p-1 hover:bg-panel rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"><ChevronLeft className="w-3.5 h-3.5" /></button>
                          <div className="flex items-center gap-1.5 px-2"><span className="text-xs font-bold text-text uppercase">{currentDate.toLocaleDateString('pt-BR', { month: 'short' })}</span><span className="text-[10px] text-slate-400 font-mono font-bold">{currentDate.getFullYear()}</span></div>
                          <button onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth()+1); setCurrentDate(d); }} className="p-1 hover:bg-panel rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"><ChevronRight className="w-3.5 h-3.5" /></button>
                      </div>
                      {activeSubTab === 'geral' && (
                          <button onClick={() => setIsConfigModalOpen(true)} className="px-3 py-1.5 rounded-xl btn btn-primary flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer" title="Definir Metas do Mês"><Settings className="w-3.5 h-3.5" /> Metas</button>
                      )}
                   </div>
               </div>

               {/* SUB NAVIGATION BAR */}
               <div className="flex items-center gap-1.5 overflow-x-auto pb-2.5 no-scrollbar border-b border-border/80 mb-4">
                    {[
                        { id: 'geral', label: 'Geral' },
                        { id: 'commercial', label: 'Comercial' },
                        { id: 'reception', label: 'Recepção' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveSubTab(tab.id as 'geral' | 'commercial' | 'reception')}
                            className={`
                                px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer
                                ${activeSubTab === tab.id 
                                    ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30 shadow-sm' 
                                    : 'text-slate-400 hover:text-white hover:bg-white/[0.04] border border-transparent'}
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
                            <div className="h-32 glass-panel rounded-2xl"></div>
                            <div className="h-32 glass-panel rounded-2xl"></div>
                            <div className="h-32 glass-panel rounded-2xl"></div>
                        </div>
                        <div className="h-[400px] w-full glass-panel rounded-2xl mt-4"></div>
                    </div>
                  ) : (
                    activeSubTab === 'geral' ? renderFinancialView() : activeSubTab === 'commercial' ? <CommercialDailyReport /> : <ReceptionDailyReport />
                  )}
              </div>

           </div>
        </div>
      </div>

      {isConfigModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/20 dark:bg-black/60 backdrop-blur-2xl p-4 animate-in fade-in duration-200">
            <div className="glass-panel w-full max-w-lg rounded-2xl p-6 flex flex-col gap-6 shadow-2xl">
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
                    className="w-full bg-panel border border-border rounded-xl px-4 py-2 text-text outline-none focus:border-purple-500 transition-colors" 
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase block mb-1.5 font-bold tracking-wider">Dias Úteis no Mês</label>
                  <input 
                    type="number" 
                    value={currentGoals.businessDays} 
                    onChange={e => updateGoalConfig('businessDays', Number(e.target.value))} 
                    className="w-full bg-surface border border-border rounded-xl px-4 py-2 text-text outline-none focus:border-purple-500 transition-colors" 
                  />
                </div>
                
                <button 
                  onClick={handleSaveConfigModal} 
                  disabled={isSaving}
                  className="w-full mt-4 py-3 glass-button glass-button-primary text-text font-black rounded-xl transition-all active:scale-95 disabled:opacity-50 text-xs uppercase tracking-widest shadow-lg"
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
