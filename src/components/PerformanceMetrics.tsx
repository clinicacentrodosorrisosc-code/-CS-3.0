import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { Target, TrendingUp, DollarSign, Calendar, Award, HelpCircle } from 'lucide-react';

interface DailyData {
  date: string;
  revenue: number;
  goalRevenue: number;
}

interface MonthlyGoals {
  revenue: number;
  businessDays: number;
}

interface PerformanceMetricsProps {
  monthRevenueData: Record<string, DailyData>;
  currentGoals: MonthlyGoals;
  currentYear: number;
  currentMonth: number;
}

// Helper to determine weekday count
const getWorkDaysInRange = (start: number, end: number, currentYear: number, currentMonth: number) => {
  let count = 0;
  for (let d = start; d <= end; d++) {
    const dateObj = new Date(currentYear, currentMonth, d);
    const dayOfWeek = dateObj.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
  }
  return count;
};

export const PerformanceMetrics: React.FC<PerformanceMetricsProps> = ({
  monthRevenueData,
  currentGoals,
  currentYear,
  currentMonth,
}) => {
  const [activeTab, setActiveTab] = useState<'cumulative' | 'daily'>('cumulative');

  const daysInMonthCount = useMemo(() => {
    return new Date(currentYear, currentMonth + 1, 0).getDate();
  }, [currentYear, currentMonth]);

  const monthName = useMemo(() => {
    const dateObj = new Date(currentYear, currentMonth, 1);
    return dateObj.toLocaleDateString('pt-BR', { month: 'long' });
  }, [currentYear, currentMonth]);

  const totalBusinessDays = useMemo(() => {
    return getWorkDaysInRange(1, daysInMonthCount, currentYear, currentMonth);
  }, [currentYear, currentMonth, daysInMonthCount]);

  // Static Target per Business Day
  const staticDailyTarget = useMemo(() => {
    const totalGoal = Number(currentGoals.revenue) || 0;
    const days = Number(currentGoals.businessDays) || totalBusinessDays || 22;
    return totalGoal / Math.max(1, days);
  }, [currentGoals, totalBusinessDays]);

  // Transform raw data to analytical targets
  const dailyMetrics = useMemo(() => {
    let cumulativeActual = 0;
    let cumulativeTarget = 0;

    return Array.from({ length: daysInMonthCount }, (_, i) => {
      const day = i + 1;
      const dateObj = new Date(currentYear, currentMonth, day);
      const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const actualRevenue = monthRevenueData[dateStr]?.revenue || 0;

      // Expected target cumulative pacing (linear progression over workdays)
      const expectedPaceDayTarget = !isWeekend ? staticDailyTarget : 0;
      cumulativeTarget += expectedPaceDayTarget;
      cumulativeActual += actualRevenue;

      // Dynamic required target at start of this day
      let salesBeforeDay = 0;
      for (let d = 1; d < day; d++) {
        const prevDateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        salesBeforeDay += monthRevenueData[prevDateStr]?.revenue || 0;
      }
      const remainingWorkDays = getWorkDaysInRange(day, daysInMonthCount, currentYear, currentMonth);
      const neededAtStart = Math.max(0, (Number(currentGoals.revenue) || 0) - salesBeforeDay);
      const dynamicDailyTarget = remainingWorkDays > 0 ? neededAtStart / remainingWorkDays : 0;

      return {
        day: String(day).padStart(2, '0'),
        dateStr,
        isWeekend,
        actual: actualRevenue,
        target: !isWeekend ? staticDailyTarget : 0,
        dynamicTarget: !isWeekend ? dynamicDailyTarget : 0,
        cumulativeActual,
        cumulativeTarget,
        difference: actualRevenue - (!isWeekend ? staticDailyTarget : 0),
        pacingDiff: cumulativeActual - cumulativeTarget
      };
    });
  }, [monthRevenueData, currentGoals, currentYear, currentMonth, daysInMonthCount, staticDailyTarget]);

  // Overall metric highlights
  const summary = useMemo(() => {
    let totalRevenue = 0;
    let highestDayRevenue = 0;
    let highestDayDate = '';
    let daysWithSales = 0;
    let workDaysWithSalesMet = 0;

    dailyMetrics.forEach(m => {
      totalRevenue += m.actual;
      if (m.actual > highestDayRevenue) {
        highestDayRevenue = m.actual;
        highestDayDate = m.day;
      }
      if (m.actual > 0) {
        daysWithSales++;
      }
      if (!m.isWeekend && m.actual >= m.target) {
        workDaysWithSalesMet++;
      }
    });

    const netGoal = Number(currentGoals.revenue) || 0;
    const progressPerc = netGoal > 0 ? (totalRevenue / netGoal) * 100 : 0;
    const avgDailyRev = daysWithSales > 0 ? totalRevenue / daysWithSales : 0;

    // Pacing evaluation (based on today's progress vs standard linear timeline)
    const today = new Date();
    const isThisMonth = today.getFullYear() === currentYear && today.getMonth() === currentMonth;
    const currentActiveDay = isThisMonth ? today.getDate() : daysInMonthCount;
    
    const activeDayMetric = dailyMetrics[currentActiveDay - 1];
    const pacingStatus = activeDayMetric 
      ? (activeDayMetric.pacingDiff >= 0 ? 'ahead' : 'behind')
      : 'on-track';
    const pacingValue = activeDayMetric ? Math.abs(activeDayMetric.pacingDiff) : 0;

    return {
      totalRevenue,
      progressPerc,
      avgDailyRev,
      highestDayRevenue,
      highestDayDate,
      workDaysWithSalesMet,
      totalWorkDays: totalBusinessDays,
      pacingStatus,
      pacingValue
    };
  }, [dailyMetrics, currentGoals, currentYear, currentMonth, daysInMonthCount, totalBusinessDays]);

  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  return (
    <section id="performance-metrics-wrapper" className="glass-panel p-6 rounded-2xl border border-border bg-panel/30 flex flex-col gap-6 shadow-xl transition-all duration-300">
      <div id="performance-header" className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Target className="text-[#D63FA3] w-5 h-5 animate-pulse" />
            <h3 className="text-lg font-bold text-text">Métricas de Performance</h3>
          </div>
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">
            Análise detalhada de faturamento diário vs metas planejadas para {monthName}
          </p>
        </div>

        {/* View Mode Switcher */}
        <div id="performance-tab-triggers" className="flex bg-panel p-1.5 rounded-xl border border-border self-start lg:self-center">
          <button
            id="tab-trigger-cumulative"
            onClick={() => setActiveTab('cumulative')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all uppercase tracking-wider ${
              activeTab === 'cumulative'
                ? 'bg-gradient-to-r from-indigo-500 to-[#D63FA3] text-text shadow-md'
                : 'text-slate-400 hover:text-text hover:bg-panel'
            }`}
          >
            Ritmo Mensal (Pacing)
          </button>
          <button
            id="tab-trigger-daily"
            onClick={() => setActiveTab('daily')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all uppercase tracking-wider ${
              activeTab === 'daily'
                ? 'bg-gradient-to-r from-indigo-500 to-[#D63FA3] text-text shadow-md'
                : 'text-slate-400 hover:text-text hover:bg-panel'
            }`}
          >
            Detalhamento Diário
          </button>
        </div>
      </div>

      {/* Mini Widget Cards */}
      <div id="performance-kpis-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Ritmo de Pacing */}
        <div id="kpi-card-pacing" className="bg-panel border border-border p-4 rounded-xl flex flex-col justify-between">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Ritmo Mensal (Pacing)</span>
            <TrendingUp className={`w-4 h-4 ${summary.pacingStatus === 'ahead' ? 'text-emerald-500' : 'text-rose-500'}`} />
          </div>
          <div className="my-2">
            <div className="flex justify-between items-baseline mb-1">
              <h4 className={`text-lg font-black ${summary.pacingStatus === 'ahead' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {summary.pacingStatus === 'ahead' ? 'Adiantado' : 'Atrasado'}
              </h4>
              <span className="text-xs font-bold text-text/90">
                {summary.pacingStatus === 'ahead' ? '+' : '-'}{formatBRL(Math.abs(summary.pacingValue))}
              </span>
            </div>
            {/* Visual indicator of the pacing status */}
            <div className="w-full bg-panel h-1.5 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${summary.pacingStatus === 'ahead' ? 'bg-emerald-500' : 'bg-rose-500'}`}
                  style={{ width: '100%' }} 
                />
            </div>
          </div>
          <span className="text-[9px] text-slate-500 font-bold">Projeção linear do mês</span>
        </div>

        {/* KPI 2: Realizado vs Meta */}
        <div id="kpi-card-realized" className="bg-panel border border-border p-4 rounded-xl flex flex-col justify-between">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Atingimento da Meta</span>
            <Award className="text-yellow-500 w-4 h-4" />
          </div>
          <div className="my-2">
            <h4 className="text-xl font-black text-text">{summary.progressPerc.toFixed(1)}%</h4>
            <div className="w-full bg-panel h-1.5 rounded-full mt-2 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-yellow-500 to-emerald-500 rounded-full" 
                style={{ width: `${Math.min(summary.progressPerc, 100)}%` }}
              />
            </div>
          </div>
          <span className="text-[9px] text-slate-500 font-bold">
            {formatBRL(summary.totalRevenue)} de {formatBRL(Number(currentGoals.revenue) || 0)}
          </span>
        </div>

        {/* KPI 3: Desempenho Operacional */}
        <div id="kpi-card-average" className="bg-panel border border-border p-4 rounded-xl flex flex-col justify-between">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Média por Dia Ativo</span>
            <DollarSign className="text-cyan-500 w-4 h-4" />
          </div>
          <div className="my-2">
            <h4 className="text-xl font-black text-text">{formatBRL(summary.avgDailyRev)}</h4>
            <p className="text-[10px] text-slate-400 font-bold mt-1">
              Meta ideal por dia útil: <span className="text-[#D63FA3]">{formatBRL(staticDailyTarget)}</span>
            </p>
          </div>
          <span className="text-[9px] text-slate-500 font-bold">Exclui dias sem receita</span>
        </div>

        {/* KPI 4: Meta Batida */}
        <div id="kpi-card-days" className="bg-panel border border-border p-4 rounded-xl flex flex-col justify-between">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Dias Acima da Meta</span>
            <Calendar className="text-indigo-400 w-4 h-4" />
          </div>
          <div className="my-2">
            <h4 className="text-xl font-black text-text">
              {summary.workDaysWithSalesMet} <span className="text-xs text-slate-500 font-bold">de {summary.totalWorkDays} dias úteis</span>
            </h4>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-md font-mono font-bold">
                {((summary.workDaysWithSalesMet / Math.max(1, summary.totalWorkDays)) * 100).toFixed(0)}% de aproveitamento
              </span>
            </div>
          </div>
          <span className="text-[9px] text-slate-500 font-bold">Dias úteis com receita ≥ meta diária</span>
        </div>
      </div>

      {/* Main Graph Area */}
      <div id="performance-chart-container" className="bg-panel border border-border p-5 rounded-xl">
        {activeTab === 'daily' ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
              <div>
                <h4 className="text-sm font-bold text-text">Faturamento Diário Geral vs Alvos</h4>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Contraste diário entre a receita realizada e o alvo padrão</p>
              </div>
              <div className="flex flex-wrap gap-4 text-[10px] font-black uppercase font-mono">
                <div className="flex items-center gap-1.5 text-indigo-400">
                  <div className="w-3 h-3 bg-indigo-500/20 border border-indigo-400 rounded-sm" />
                  <span>Realizado</span>
                </div>
                <div className="flex items-center gap-1.5 text-[#D63FA3]">
                  <div className="w-4 h-0.5 bg-surface" />
                  <span>Meta Diária Padrão</span>
                </div>
                <div className="flex items-center gap-1.5 text-cyan-400">
                  <div className="w-4 h-0.5 border-t border-dashed border-cyan-400" />
                  <span>Meta Dinâmica Recalculada</span>
                </div>
              </div>
            </div>

            <div className="h-[320px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dailyMetrics} margin={{ top: 10, right: 10, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis 
                    dataKey="day" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 'bold' }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'var(--text-muted)', fontSize: 10 }} 
                    tickFormatter={(val) => `R$${(val/1000).toFixed(0)}k`}
                  />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#f8fafc' }}
                    itemStyle={{ color: '#f1f5f9' }}
                    labelStyle={{ fontWeight: 'bold', color: '#94a3b8', fontSize: '11px', marginBottom: '4px' }}
                    formatter={(val: number, name: string) => {
                      if (name === 'Realizado') return [formatBRL(val), 'Realizado'];
                      if (name === 'Meta Diária') return [formatBRL(val), 'Meta Diária Padrão'];
                      if (name === 'Meta Dinâmica') return [formatBRL(val), 'Meta Dinâmica'];
                      return [val, name];
                    }}
                    labelFormatter={(label) => `Dia ${label}`}
                  />
                  <Bar 
                    name="Realizado" 
                    dataKey="actual" 
                    fill="url(#barRevenueGrad)" 
                    radius={[4, 4, 0, 0]} 
                    maxBarSize={32}
                  />
                  <Line 
                    name="Meta Diária" 
                    type="monotone" 
                    dataKey="target" 
                    stroke="#D63FA3" 
                    strokeWidth={2} 
                    dot={false}
                  />
                  <Line 
                    name="Meta Dinâmica" 
                    type="monotone" 
                    dataKey="dynamicTarget" 
                    stroke="#22d3ee" 
                    strokeWidth={1.5} 
                    strokeDasharray="4 4" 
                    dot={false}
                  />
                  <defs>
                    <linearGradient id="barRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.8}/>
                      <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
              <div>
                <h4 className="text-sm font-bold text-text">Faturamento Acumulado vs Curva Ideal (Pacing)</h4>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Acompanhe se a clínica está no compasso para atingir o faturamento mensal total</p>
              </div>
              <div className="flex flex-wrap gap-4 text-[10px] font-black uppercase font-mono">
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <div className="w-3 h-3 bg-emerald-500/20 border border-emerald-400 rounded-sm" />
                  <span>Acumulado Realizado</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-500">
                  <div className="w-4 h-0.5 border-t border-dashed border-slate-400" />
                  <span>Trajetória Padrão Linear</span>
                </div>
              </div>
            </div>

            <div className="h-[320px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dailyMetrics} margin={{ top: 10, right: 10, left: 20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="areaCumulativeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis 
                    dataKey="day" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 'bold' }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'var(--text-muted)', fontSize: 10 }} 
                    tickFormatter={(val) => `R$${(val/1000).toFixed(0)}k`}
                  />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#f8fafc' }}
                    itemStyle={{ color: '#f1f5f9' }}
                    labelStyle={{ fontWeight: 'bold', color: '#94a3b8', fontSize: '11px', marginBottom: '4px' }}
                    formatter={(val: number, name: string) => {
                      if (name === 'Acumulado Realizado') return [formatBRL(val), 'Faturamento Acumulado'];
                      if (name === 'Meta Acumulada') return [formatBRL(val), 'Meta Projetada Linear'];
                      return [val, name];
                    }}
                    labelFormatter={(label) => `Até Dia ${label}`}
                  />
                  <Area 
                    name="Acumulado Realizado" 
                    type="monotone" 
                    dataKey="cumulativeActual" 
                    fill="url(#areaCumulativeGrad)" 
                    stroke="#10b981" 
                    strokeWidth={2.5}
                    dot={{ r: 2, fill: '#10b981', strokeWidth: 0 }}
                  />
                  <Line 
                    name="Meta Acumulada" 
                    type="monotone" 
                    dataKey="cumulativeTarget" 
                    stroke="#94a3b8" 
                    strokeWidth={1.5} 
                    strokeDasharray="4 4" 
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      <div id="pacing-helpful-context" className="flex items-start gap-2.5 p-3.5 bg-indigo-500/5 border border-indigo-500/10 rounded-xl text-xs text-indigo-300">
        <HelpCircle className="w-4.5 h-4.5 text-indigo-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Como interpretar o Pacing:</strong> O ritmo acumulado analisa se o faturamento diário está alinhado com a média necessária por dia útil para atingir <span className="text-text font-bold">{formatBRL(Number(currentGoals.revenue) || 0)}</span> até o fechamento. Estar <strong>Adiantado</strong> indica progresso acima do planejado no mês corrente, facilitando o atingimento sem desgastes de última hora.
        </p>
      </div>
    </section>
  );
};
