import React, { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, ComposedChart, Area
} from 'recharts';
import { Download, TrendingUp, TrendingDown, DollarSign, Calendar, Users, Target } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Transaction } from '../types';
import { motion } from 'motion/react';

interface SalesDashboardProps {
  transactions: Transaction[];
}

export const SalesDashboard: React.FC<SalesDashboardProps> = ({ transactions }) => {
  // Filter for income transactions only
  const salesData = useMemo(() => {
    return transactions.filter(t => t.type === 'income' && t.status === 'Paid');
  }, [transactions]);

  // Aggregate data by month
  const monthlyData = useMemo(() => {
    const map: Record<string, { month: string; total: number; count: number }> = {};
    
    // Last 12 months placeholder to ensure order
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
      map[key] = { month: label, total: 0, count: 0 };
    }

    salesData.forEach(t => {
      const date = new Date(t.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (map[key]) {
        map[key].total += t.amount;
        map[key].count += 1;
      }
    });

    return Object.values(map);
  }, [salesData]);

  // Aggregate by Category
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    salesData.forEach(t => {
      const cat = t.category || 'Não Categorizado';
      map[cat] = (map[cat] || 0) + t.amount;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [salesData]);

  // Aggregate by Professional
  const professionalData = useMemo(() => {
    const map: Record<string, number> = {};
    salesData.forEach(t => {
      const prof = t.professional || 'Sem Profissional';
      map[prof] = (map[prof] || 0) + t.amount;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [salesData]);

  const stats = useMemo(() => {
    const currentMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;

    const currentTotal = salesData
      .filter(t => t.date.startsWith(currentMonthKey))
      .reduce((acc, curr) => acc + curr.amount, 0);

    const lastTotal = salesData
      .filter(t => t.date.startsWith(lastMonthKey))
      .reduce((acc, curr) => acc + curr.amount, 0);

    const growth = lastTotal > 0 ? ((currentTotal - lastTotal) / lastTotal) * 100 : 0;

    return {
      currentTotal,
      lastTotal,
      growth,
      totalSalesCount: salesData.length,
      averageTicket: salesData.length > 0 ? salesData.reduce((acc, curr) => acc + curr.amount, 0) / salesData.length : 0
    };
  }, [salesData]);

  const handleExport = () => {
    const reportData = monthlyData.map(d => ({
      'Mês': d.month,
      'Total em Vendas (R$)': d.total.toFixed(2),
      'Quantidade de Vendas': d.count
    }));

    const ws = XLSX.utils.json_to_sheet(reportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Relatório Mensal');
    
    // Add Category sheet
    const catWs = XLSX.utils.json_to_sheet(categoryData.map(c => ({
      'Categoria': c.name,
      'Valor Total (R$)': c.value.toFixed(2)
    })));
    XLSX.utils.book_append_sheet(wb, catWs, 'Vendas por Categoria');

    XLSX.writeFile(wb, `Relatorio_Vendas_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-8 p-6 bg-surface min-h-screen text-slate-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-text font-display">Relatório de Vendas</h2>
          <p className="text-slate-400 mt-1">Análise detalhada de performance comercial mes a mes</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-text rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 group"
        >
          <Download className="w-5 h-5 group-hover:scale-110 transition-transform" />
          Exportar Relatório Excel
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Vendas Mês Atual" 
          value={stats.currentTotal} 
          icon={<DollarSign className="w-6 h-6 text-emerald-400" />}
          trend={stats.growth}
          isCurrency
        />
        <StatCard 
          title="Ticket Médio" 
          value={stats.averageTicket} 
          icon={<Target className="w-6 h-6 text-indigo-400" />}
          isCurrency
        />
        <StatCard 
          title="Total de Vendas" 
          value={stats.totalSalesCount} 
          icon={<Calendar className="w-6 h-6 text-purple-400" />}
        />
        <StatCard 
          title="Vendas Mês Anterior" 
          value={stats.lastTotal} 
          icon={<Users className="w-6 h-6 text-amber-400" />}
          isCurrency
        />
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Monthly Trend */}
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-lg text-text">Evolução Mensal de Vendas</h3>
          </div>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#11131f', borderColor: '#1f2937', color: '#fff' }}
                  formatter={(v: number) => [`R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Receita']}
                />
                <Area type="monotone" dataKey="total" fill="url(#colorTotal)" stroke="#6366f1" strokeWidth={3} />
                <Bar dataKey="total" barSize={30} fill="#6366f1" radius={[4, 4, 0, 0]} opacity={0.3} />
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sales by Category */}
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-6">
            <Target className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-lg text-text">Vendas por Categoria</h3>
          </div>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={true} vertical={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} width={120} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#11131f', borderColor: '#1f2937', color: '#fff' }}
                  formatter={(v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                />
                <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sales by Professional */}
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-6">
            <Users className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-lg text-text">Vendas por Profissional</h3>
          </div>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={professionalData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#11131f', borderColor: '#1f2937', color: '#fff' }}
                  formatter={(v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                />
                <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Summary Table View */}
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl overflow-hidden">
          <div className="flex items-center gap-2 mb-6">
            <Calendar className="w-5 h-5 text-purple-400" />
            <h3 className="font-bold text-lg text-text">Resumo Mensal</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-xs uppercase tracking-wider text-slate-500 border-b border-border">
                <tr>
                  <th className="pb-4 font-bold">Mês</th>
                  <th className="pb-4 font-bold text-right">Volume de Vendas</th>
                  <th className="pb-4 font-bold text-right">Quantidade</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {monthlyData.slice().reverse().map((row, idx) => (
                  <tr key={idx} className="border-b border-border last:border-0 hover:bg-panel transition-colors">
                    <td className="py-4 text-slate-300 font-medium">{row.month}</td>
                    <td className="py-4 text-right font-mono text-emerald-400">
                      {row.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="py-4 text-right text-slate-400">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  trend?: number;
  isCurrency?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, trend, isCurrency }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-surface border border-border rounded-2xl p-6 shadow-xl hover:border-white/20 transition-all group"
  >
    <div className="flex justify-between items-start mb-4">
      <div className="p-3 bg-panel rounded-xl group-hover:bg-panel/80 transition-colors">
        {icon}
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${trend >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
          {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {Math.abs(trend).toFixed(1)}%
        </div>
      )}
    </div>
    <div className="space-y-1">
      <h4 className="text-slate-400 text-sm font-medium">{title}</h4>
      <p className="text-2xl font-bold text-text font-mono">
        {isCurrency 
          ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
          : value.toLocaleString('pt-BR')}
      </p>
    </div>
  </motion.div>
);
