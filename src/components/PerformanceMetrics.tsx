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
    const days = totalBusinessDays > 0 ? totalBusinessDays : (Number(currentGoals.businessDays) || 22);
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
        cumulativeTarget: parseFloat(cumulativeTarget.toFixed(2)),
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
    let pacingStatus: 'ahead' | 'warning' | 'behind' = 'ahead';
    if (activeDayMetric) {
      if (activeDayMetric.pacingDiff >= 0) {
        pacingStatus = 'ahead';
      } else if (activeDayMetric.pacingDiff >= -3000) {
        pacingStatus = 'warning';
      } else {
        pacingStatus = 'behind';
      }
    }
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

  // Helper for color classification based on pacing deficit
  const getPointColor = (diff: number) => {
    if (diff < -3000) return '#ef4444'; // Vermelho: atraso superior a R$ 3.000
    if (diff < 0) return '#f59e0b'; // Amarelo: abaixo da meta, atraso até R$ 3.000
    return '#10b981'; // Verde: em cima ou acima da trajetória
  };

  // Custom active dot on hover (clean & subtle)
  const PacingActiveDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null || !payload) return null;
    const diff = payload.pacingDiff ?? (payload.cumulativeActual - payload.cumulativeTarget);
    const color = getPointColor(diff);
    return (
      <g key={`pacing-active-dot-${payload.day}`}>
        <circle cx={cx} cy={cy} r={8} fill={color} fillOpacity={0.25} />
        <circle cx={cx} cy={cy} r={4.5} fill={color} stroke="#0f172a" strokeWidth={2} />
      </g>
    );
  };

  // Custom Tooltip for Pacing Chart
  const PacingCustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0]?.payload;
    if (!data) return null;

    const cumulativeActual = data.cumulativeActual ?? 0;
    const cumulativeTarget = data.cumulativeTarget ?? 0;
    const diff = data.pacingDiff ?? (cumulativeActual - cumulativeTarget);

    let statusBadge = {
      text: 'No Ritmo / Adiantado',
      bg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
      color: '#10b981',
      icon: '🟢'
    };

    if (diff < -3000) {
      statusBadge = {
        text: 'Atraso Crítico (> R$ 3.000)',
        bg: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
        color: '#ef4444',
        icon: '🔴'
      };
    } else if (diff < 0) {
      statusBadge = {
        text: 'Abaixo da Meta (Atraso ≤ R$ 3.000)',
        bg: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
        color: '#f59e0b',
        icon: '🟡'
      };
    }

    return (
      <div className="bg-slate-950/95 border border-white/10 p-3.5 rounded-xl shadow-2xl backdrop-blur-md min-w-[240px]">
        <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-white/10">
          <span className="text-xs font-bold text-slate-200">Até Dia {label}</span>
          <span className="text-[10px] font-mono text-slate-400">{data.dateStr}</span>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusBadge.color }} />
              Acumulado Realizado:
            </span>
            <span className="font-bold text-text font-mono">{formatBRL(cumulativeActual)}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5">
              <span className="w-2 h-0.5 bg-slate-400 border-t border-dashed" />
              Trajetória Linear:
            </span>
            <span className="font-bold text-slate-300 font-mono">{formatBRL(cumulativeTarget)}</span>
          </div>

          <div className="pt-2 border-t border-white/5 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Diferença de Pacing:</span>
            <span className={`font-mono font-bold text-xs ${
              diff >= 0 ? 'text-emerald-400' : diff >= -3000 ? 'text-amber-400' : 'text-rose-400'
            }`}>
              {diff >= 0 ? '+' : ''}{formatBRL(diff)}
            </span>
          </div>

          <div className={`mt-2 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold flex items-center justify-center gap-1.5 ${statusBadge.bg}`}>
            <span>{statusBadge.icon}</span>
            <span>{statusBadge.text}</span>
          </div>
        </div>
      </div>
    );
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
            <TrendingUp className={`w-4 h-4 ${
              summary.pacingStatus === 'ahead'
                ? 'text-emerald-500'
                : summary.pacingStatus === 'warning'
                ? 'text-amber-500'
                : 'text-rose-500'
            }`} />
          </div>
          <div className="my-2">
            <div className="flex justify-between items-baseline mb-1">
              <h4 className={`text-base font-black ${
                summary.pacingStatus === 'ahead'
                  ? 'text-emerald-400'
                  : summary.pacingStatus === 'warning'
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}>
                {summary.pacingStatus === 'ahead'
                  ? 'No Ritmo'
                  : summary.pacingStatus === 'warning'
                  ? 'Abaixo da Meta'
                  : 'Atrasado (> R$3k)'}
              </h4>
              <span className="text-xs font-bold text-text/90">
                {summary.pacingStatus === 'ahead' ? '+' : '-'}{formatBRL(Math.abs(summary.pacingValue))}
              </span>
            </div>
            {/* Visual indicator of the pacing status */}
            <div className="w-full bg-panel h-1.5 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${
                    summary.pacingStatus === 'ahead'
                      ? 'bg-emerald-500'
                      : summary.pacingStatus === 'warning'
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
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
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <div>
                <h4 className="text-sm font-bold text-text">Faturamento Acumulado vs Curva Ideal (Pacing)</h4>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Acompanhe se a clínica está no compasso para atingir o faturamento mensal total</p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 text-[10px] font-black uppercase font-mono">
                <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                  <div className="w-3 h-1 rounded-full bg-emerald-500" />
                  <span>≥ Trajetória (No Ritmo)</span>
                </div>
                <div className="flex items-center gap-1.5 text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20">
                  <div className="w-3 h-1 rounded-full bg-amber-500" />
                  <span>Abaixo (Atraso ≤ R$3k)</span>
                </div>
                <div className="flex items-center gap-1.5 text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-md border border-rose-500/20">
                  <div className="w-3 h-1 rounded-full bg-rose-500" />
                  <span>Atraso Crítico (&gt; R$3k)</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400 bg-slate-500/10 px-2.5 py-1 rounded-md border border-slate-500/20">
                  <div className="w-3 h-0.5 border-t-2 border-dashed border-slate-400" />
                  <span>Trajetória Padrão Linear</span>
                </div>
              </div>
            </div>

            <div className="h-[320px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dailyMetrics} margin={{ top: 10, right: 10, left: 20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="pacingStrokeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      {dailyMetrics.map((item, idx) => {
                        const pct = (idx / Math.max(1, dailyMetrics.length - 1)) * 100;
                        const color = getPointColor(item.pacingDiff);
                        return (
                          <stop key={`stroke-stop-${idx}`} offset={`${pct.toFixed(2)}%`} stopColor={color} />
                        );
                      })}
                    </linearGradient>
                    <linearGradient id="pacingAreaGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      {dailyMetrics.map((item, idx) => {
                        const pct = (idx / Math.max(1, dailyMetrics.length - 1)) * 100;
                        const color = getPointColor(item.pacingDiff);
                        return (
                          <stop key={`area-stop-${idx}`} offset={`${pct.toFixed(2)}%`} stopColor={color} stopOpacity={0.16} />
                        );
                      })}
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
                  <RechartsTooltip content={<PacingCustomTooltip />} />
                  <Area 
                    name="Acumulado Realizado" 
                    type="monotone" 
                    dataKey="cumulativeActual" 
                    fill="url(#pacingAreaGrad)" 
                    stroke="url(#pacingStrokeGrad)" 
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={<PacingActiveDot />}
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
          <strong>Como interpretar o Pacing:</strong> O ritmo acumulado analisa se o faturamento diário está alinhado com a trajetória linear ideal até a meta de <span className="text-text font-bold">{formatBRL(Number(currentGoals.revenue) || 0)}</span>. Pontos e trechos em <strong className="text-emerald-400">Verde</strong> indicam faturamento igual ou superior à meta projetada; em <strong className="text-amber-400">Amarelo</strong> quando abaixo da curva com atraso de até R$ 3.000; e em <strong className="text-rose-400">Vermelho</strong> quando o atraso acumulado ultrapassar R$ 3.000.
        </p>
      </div>
    </section>
  );
};
