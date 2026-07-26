const fs = require('fs');

const code = `import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { 
    Calendar as CalendarIcon, 
    Save, 
    Trash2, 
    AlertCircle, 
    Users, 
    CheckCircle2, 
    Clock, 
    Activity, 
    UserX, 
    CalendarX, 
    TrendingUp, 
    BarChart3
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid } from 'recharts';

interface ReceptionReportAnswers {
    q1_agendamentos_final_dia: number;
    q2_atendimentos_finalizados: number;
    q3_atendimentos_remarcados: number;
    q4_atendimentos_cancelados: number;
    q5_nao_compareceram: number;
}

export const ReceptionDailyReport: React.FC = () => {
    const [reportDate, setReportDate] = useState(() => {
        const today = new Date();
        today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
        return today.toISOString().split('T')[0];
    });

    const [answers, setAnswers] = useState<ReceptionReportAnswers>({
        q1_agendamentos_final_dia: 0,
        q2_atendimentos_finalizados: 0,
        q3_atendimentos_remarcados: 0,
        q4_atendimentos_cancelados: 0,
        q5_nao_compareceram: 0
    });

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [history, setHistory] = useState<any[]>([]);

    const loadReportForDate = async (date: string) => {
        setLoading(true);
        setMessage(null);
        try {
            const { data, error } = await supabase
                .from('commercial_reports')
                .select('*')
                .eq('report_date', date)
                .maybeSingle();

            if (error && !error.message?.includes('not found')) throw error;

            if (data && data.raw_answers && data.raw_answers.reception) {
                setAnswers(data.raw_answers.reception);
            } else {
                setAnswers({
                    q1_agendamentos_final_dia: 0,
                    q2_atendimentos_finalizados: 0,
                    q3_atendimentos_remarcados: 0,
                    q4_atendimentos_cancelados: 0,
                    q5_nao_compareceram: 0
                });
            }
        } catch (err) {
            console.error('Error loading report:', err);
            setMessage({ type: 'error', text: 'Erro ao carregar relatório.' });
        } finally {
            setLoading(false);
        }
    };

    const loadHistory = async () => {
        try {
            const { data } = await supabase
                .from('commercial_reports')
                .select('*')
                .order('report_date', { ascending: false })
                .limit(90);

            setHistory(data || []);
        } catch (err) {
            console.error('Error loading history:', err);
        }
    };

    useEffect(() => {
        loadReportForDate(reportDate);
        loadHistory();
    }, [reportDate]);

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            
            // First, get existing report to avoid overwriting commercial data
            const { data: existingData } = await supabase
                .from('commercial_reports')
                .select('*')
                .eq('report_date', reportDate)
                .maybeSingle();
                
            let existingRawAnswers = {};
            if (existingData && existingData.raw_answers) {
                existingRawAnswers = existingData.raw_answers;
            }

            const updatedRawAnswers = {
                ...existingRawAnswers,
                reception: answers
            };

            const fullPayload = {
                report_date: reportDate,
                user_id: user?.id || existingData?.user_id,
                raw_answers: updatedRawAnswers,
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase
                .from('commercial_reports')
                .upsert(fullPayload, { onConflict: 'report_date' });

            if (error) throw error;

            setMessage({ type: 'success', text: 'Relatório da recepção registrado com sucesso!' });
            loadHistory();
        } catch (err: any) {
            console.error('Error saving report:', err);
            setMessage({ type: 'error', text: \`Erro ao salvar: \${err?.message || 'Erro desconhecido'}\` });
        } finally {
            setSaving(false);
        }
    };

    const parseSafeDate = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-');
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    };

    const filteredReports = useMemo(() => {
        return history.filter(h => h.raw_answers && h.raw_answers.reception);
    }, [history]);

    const kpiMetrics = useMemo(() => {
        let agendamentosTotal = 0;
        let finalizadosTotal = 0;
        let remarcadosTotal = 0;
        let canceladosTotal = 0;
        let naoCompareceramTotal = 0;

        filteredReports.forEach(report => {
            const rec = report.raw_answers.reception;
            agendamentosTotal += rec.q1_agendamentos_final_dia || 0;
            finalizadosTotal += rec.q2_atendimentos_finalizados || 0;
            remarcadosTotal += rec.q3_atendimentos_remarcados || 0;
            canceladosTotal += rec.q4_atendimentos_cancelados || 0;
            naoCompareceramTotal += rec.q5_nao_compareceram || 0;
        });

        const totalLosses = remarcadosTotal + canceladosTotal + naoCompareceramTotal;
        const totalScheduledMacro = finalizadosTotal + totalLosses;
        
        return {
            agendamentosTotal,
            finalizadosTotal,
            remarcadosTotal,
            canceladosTotal,
            naoCompareceramTotal,
            totalLosses,
            totalScheduledMacro,
            attendanceRate: totalScheduledMacro > 0 ? (finalizadosTotal / totalScheduledMacro) * 100 : 0,
            noShowRate: totalScheduledMacro > 0 ? (naoCompareceramTotal / totalScheduledMacro) * 100 : 0,
            rescheduledRate: totalScheduledMacro > 0 ? (remarcadosTotal / totalScheduledMacro) * 100 : 0,
            cancelledRate: totalScheduledMacro > 0 ? (canceladosTotal / totalScheduledMacro) * 100 : 0,
        };
    }, [filteredReports]);

    const chartData = useMemo(() => {
        return [...filteredReports].reverse().slice(-14).map(report => {
            const dateObj = parseSafeDate(report.report_date);
            const r = report.raw_answers.reception;
            return {
                name: dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                agendamentos: r.q1_agendamentos_final_dia || 0,
                finalizados: r.q2_atendimentos_finalizados || 0,
                perdas: (r.q3_atendimentos_remarcados || 0) + (r.q4_atendimentos_cancelados || 0) + (r.q5_nao_compareceram || 0)
            };
        });
    }, [filteredReports]);

    return (
        <div className="flex flex-col h-full bg-slate-950 text-slate-200">
            <div className="flex-1 w-full max-w-7xl mx-auto space-y-6">
                
                {message && (
                    <div className={\`p-4 rounded-xl border \${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'} flex items-center justify-between\`}>
                        <div className="flex items-center gap-3">
                            {message.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                            <span className="text-sm font-bold">{message.text}</span>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                    {/* LEFT COLUMN: Input Form */}
                    <div className="xl:col-span-4 flex flex-col h-full space-y-6">
                        
                        <div className="glass-panel p-6 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden flex-shrink-0">
                            <div className="absolute top-0 right-0 w-40 h-40 bg-teal-500/10 rounded-full blur-3xl -mr-10 -mt-10" />
                            <div className="relative">
                                <h2 className="text-2xl font-black text-white tracking-tight mb-2">Relatório de Recepção</h2>
                                <p className="text-xs text-slate-400 font-semibold mb-6">Preencha os indicadores do dia atual na recepção.</p>
                                
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Data do Relatório</label>
                                    <div className="relative">
                                        <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-teal-400" />
                                        <input 
                                            type="date"
                                            value={reportDate}
                                            onChange={(e) => setReportDate(e.target.value)}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:border-teal-500 outline-none transition-all font-mono text-sm shadow-inner"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex-1 flex items-center justify-center min-h-[400px]">
                                <div className="w-8 h-8 rounded-full border-4 border-teal-500/20 border-t-teal-500 animate-spin" />
                            </div>
                        ) : (
                            <div className="glass-panel rounded-3xl border border-white/5 flex flex-col flex-1 overflow-hidden shadow-xl">
                                <div className="p-4 border-b border-white/5 bg-white/5 flex items-center gap-3">
                                    <div className="p-2 bg-teal-500/20 text-teal-400 rounded-lg">
                                        <Activity className="w-4 h-4" />
                                    </div>
                                    <h3 className="text-sm font-black text-white uppercase tracking-wider">Indicadores do Dia</h3>
                                </div>
                                
                                <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                                    
                                    <div className="space-y-4">
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-xs font-bold text-slate-300">Agendamentos no Final do Dia</label>
                                            <input 
                                                type="number"
                                                value={answers.q1_agendamentos_final_dia || ''}
                                                onChange={(e) => setAnswers({...answers, q1_agendamentos_final_dia: parseInt(e.target.value) || 0})}
                                                className="bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-teal-500 outline-none text-sm font-bold font-mono"
                                                placeholder="0"
                                            />
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-xs font-bold text-slate-300">Atendimentos Finalizados (Compareceram)</label>
                                            <input 
                                                type="number"
                                                value={answers.q2_atendimentos_finalizados || ''}
                                                onChange={(e) => setAnswers({...answers, q2_atendimentos_finalizados: parseInt(e.target.value) || 0})}
                                                className="bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-teal-500 outline-none text-sm font-bold font-mono"
                                                placeholder="0"
                                            />
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-xs font-bold text-slate-300">Atendimentos Remarcados</label>
                                            <input 
                                                type="number"
                                                value={answers.q3_atendimentos_remarcados || ''}
                                                onChange={(e) => setAnswers({...answers, q3_atendimentos_remarcados: parseInt(e.target.value) || 0})}
                                                className="bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500 outline-none text-sm font-bold font-mono"
                                                placeholder="0"
                                            />
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-xs font-bold text-slate-300">Atendimentos Cancelados</label>
                                            <input 
                                                type="number"
                                                value={answers.q4_atendimentos_cancelados || ''}
                                                onChange={(e) => setAnswers({...answers, q4_atendimentos_cancelados: parseInt(e.target.value) || 0})}
                                                className="bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-rose-500 outline-none text-sm font-bold font-mono"
                                                placeholder="0"
                                            />
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-xs font-bold text-slate-300">Atendimentos Não Compareceram (Faltas)</label>
                                            <input 
                                                type="number"
                                                value={answers.q5_nao_compareceram || ''}
                                                onChange={(e) => setAnswers({...answers, q5_nao_compareceram: parseInt(e.target.value) || 0})}
                                                className="bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-rose-500 outline-none text-sm font-bold font-mono"
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 border-t border-white/5 bg-black/20">
                                    <button 
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="w-full bg-teal-600 hover:bg-teal-500 text-white font-black py-4 rounded-xl transition-all shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2"
                                    >
                                        {saving ? (
                                            <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                                        ) : (
                                            <>
                                                <Save className="w-5 h-5" />
                                                <span>Salvar Relatório de Recepção</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN: Dashboard and History */}
                    <div className="xl:col-span-8 flex flex-col h-full space-y-6">
                        
                        <div className="flex flex-col">
                            
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                                <div className="glass-panel p-6 rounded-3xl border border-white/5 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <Users className="w-12 h-12 text-teal-400" />
                                    </div>
                                    <span className="text-[10px] text-teal-400 font-bold uppercase tracking-widest mb-1 block">Atendimentos Finalizados</span>
                                    <div className="flex items-end gap-2">
                                        <span className="text-3xl font-black text-white">{kpiMetrics.finalizadosTotal}</span>
                                        <span className="text-xs text-slate-500 font-medium mb-1">período</span>
                                    </div>
                                </div>
                                <div className="glass-panel p-6 rounded-3xl border border-white/5 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <CalendarX className="w-12 h-12 text-amber-400" />
                                    </div>
                                    <span className="text-[10px] text-amber-400 font-bold uppercase tracking-widest mb-1 block">Total de Perdas</span>
                                    <div className="flex items-end gap-2">
                                        <span className="text-3xl font-black text-white">{kpiMetrics.totalLosses}</span>
                                        <span className="text-xs text-slate-500 font-medium mb-1">período</span>
                                    </div>
                                </div>
                                <div className="glass-panel p-6 rounded-3xl border border-white/5 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <Activity className="w-12 h-12 text-emerald-400" />
                                    </div>
                                    <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mb-1 block">Taxa de Presença</span>
                                    <div className="flex items-end gap-2">
                                        <span className="text-3xl font-black text-white">{kpiMetrics.attendanceRate.toFixed(1)}%</span>
                                        <span className="text-xs text-slate-500 font-medium mb-1">média</span>
                                    </div>
                                </div>
                            </div>

                            <div className="glass-panel p-6 rounded-3xl border border-white/5 mb-6">
                                <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4">Efetividade da Agenda (Recepção)</h3>
                                
                                <div className="mb-4">
                                    <div className="flex justify-between items-end mb-2">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] text-teal-400 font-bold uppercase tracking-tight">Comparecimentos</span>
                                            <span className="text-sm font-black text-white">{kpiMetrics.attendanceRate.toFixed(1)}%</span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Remarc. + Falt. + Cancel.</span>
                                            <span className="text-sm font-black text-white">{(kpiMetrics.rescheduledRate + kpiMetrics.noShowRate + kpiMetrics.cancelledRate).toFixed(1)}%</span>
                                        </div>
                                    </div>
                                    <div className="flex h-2 w-full rounded-full overflow-hidden bg-slate-800">
                                        <div style={{ width: \`\${kpiMetrics.attendanceRate}%\` }} className="bg-teal-400 h-full" title="Compareceram"></div>
                                        <div style={{ width: \`\${kpiMetrics.rescheduledRate}%\` }} className="bg-amber-400 h-full" title="Remarcaram"></div>
                                        <div style={{ width: \`\${kpiMetrics.noShowRate}%\` }} className="bg-rose-400 h-full" title="Faltaram"></div>
                                        <div style={{ width: \`\${kpiMetrics.cancelledRate}%\` }} className="bg-slate-400 h-full" title="Cancelaram"></div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/5">
                                    <div>
                                        <span className="text-[10px] text-teal-400 font-bold block mb-1">Finalizados</span>
                                        <span className="text-xl font-black text-white">{kpiMetrics.finalizadosTotal}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-amber-400 font-bold block mb-1">Remarcados</span>
                                        <span className="text-xl font-black text-white">{kpiMetrics.remarcadosTotal}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-rose-400 font-bold block mb-1">Não Compareceram</span>
                                        <span className="text-xl font-black text-white">{kpiMetrics.naoCompareceramTotal}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-slate-400 font-bold block mb-1">Cancelados</span>
                                        <span className="text-xl font-black text-white">{kpiMetrics.canceladosTotal}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="glass-panel p-6 rounded-3xl border border-white/5 mb-6 flex-1 flex flex-col min-h-[300px]">
                                <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4">Evolução Diária</h3>
                                <div className="flex-1 min-h-[250px]">
                                    {chartData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="colorFin" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                                                    </linearGradient>
                                                    <linearGradient id="colorPerdas" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" vertical={false} />
                                                <XAxis dataKey="name" stroke="#ffffff40" fontSize={10} tickMargin={10} axisLine={false} tickLine={false} />
                                                <YAxis stroke="#ffffff40" fontSize={10} axisLine={false} tickLine={false} />
                                                <RechartsTooltip 
                                                    contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', borderRadius: '12px', fontSize: '12px' }}
                                                    itemStyle={{ fontWeight: 'bold' }}
                                                />
                                                <Area type="monotone" dataKey="finalizados" name="Finalizados" stroke="#14b8a6" strokeWidth={2} fillOpacity={1} fill="url(#colorFin)" />
                                                <Area type="monotone" dataKey="perdas" name="Perdas Totais" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorPerdas)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex items-center justify-center">
                                            <span className="text-xs text-slate-500 font-bold">Sem dados suficientes para o gráfico.</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};
`

fs.writeFileSync('src/components/ReceptionDailyReport.tsx', code);
