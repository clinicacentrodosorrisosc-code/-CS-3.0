import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { appointmentData } from '../data/appointmentData';
import { 
    Calendar as CalendarIcon, 
    Save, 
    AlertCircle, 
    Users, 
    CheckCircle2, 
    Activity, 
    CalendarX,
    Clock,
    UserMinus,
    TrendingUp,
    XCircle,
    Plus,
    Minus,
    BarChart3,
    History,
    Eye,
    Trash2,
    Database,
    Image
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid } from 'recharts';

interface ReceptionReportAnswers {
    q1_agendamentos_final_dia: number;
    q2_atendimentos_finalizados: number;
    q3_atendimentos_remarcados: number;
    q4_atendimentos_cancelados: number;
    q5_nao_compareceram: number;
    total_received_value?: number;
    recurrent_objections?: string;
    structure_to_be_resolved?: string;
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
        q5_nao_compareceram: 0,
        total_received_value: 0,
        recurrent_objections: '',
        structure_to_be_resolved: ''
    });

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [history, setHistory] = useState<any[]>([]);

    const [dateRange, setDateRange] = useState<'today' | '7days' | '15days' | '30days' | 'custom' | 'all'>('7days');
    const [customStartDate, setCustomStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d.toISOString().split('T')[0];
    });
    const [customEndDate, setCustomEndDate] = useState(() => {
        return new Date().toISOString().split('T')[0];
    });
    const [exportingImage, setExportingImage] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

    useEffect(() => {
    }, []);

    
    const handleShareWhatsApp = () => {
        let text = "*Relatório Recepção - " + reportDate.split('-').reverse().join('/') + "*\n\n";
        text += "*Agendamentos p/ hoje (final do dia):* " + answers.q1_agendamentos_final_dia + "\n";
        text += "*Atendimentos Finalizados (Compareceram):* " + answers.q2_atendimentos_finalizados + "\n";
        text += "*Atendimentos Remarcados:* " + answers.q3_atendimentos_remarcados + "\n";
        text += "*Atendimentos Cancelados:* " + answers.q4_atendimentos_cancelados + "\n";
        text += "*Faltas (Não Compareceram):* " + answers.q5_nao_compareceram + "\n";
        if (answers.total_received_value) text += "*Valor Total Recebido:* " + answers.total_received_value + "\n";
        if (answers.recurrent_objections) text += "*Objeções Recorrentes:* " + answers.recurrent_objections + "\n";
        if (answers.structure_to_be_resolved) text += "*Estrutura a ser Resolvida:* " + answers.structure_to_be_resolved + "\n";
        
        const url = "https://wa.me/?text=" + encodeURIComponent(text);
        window.open(url, '_blank');
    };

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
            
            // Clear message after 4 seconds
            setTimeout(() => {
                setMessage(null);
            }, 4000);
        } catch (err: any) {
            console.error('Error saving report:', err);
            setMessage({ type: 'error', text: `Erro ao salvar: ${err?.message || 'Erro desconhecido'}` });
        } finally {
            setSaving(false);
        }
    };

    const adjustValue = (key: keyof ReceptionReportAnswers, amount: number) => {
        setAnswers(prev => ({
            ...prev,
            [key]: Math.max(0, (prev[key] || 0) + amount)
        }));
    };

    const parseSafeDate = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-');
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    };

    const filteredReports = useMemo(() => {
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);

        const base = history.filter(h => h.raw_answers && h.raw_answers.reception);

        return base.filter(r => {
            const rDate = parseSafeDate(r.report_date);
            rDate.setHours(0, 0, 0, 0);

            if (dateRange === 'today') {
                return rDate.getTime() === todayDate.getTime();
            } else if (dateRange === '7days') {
                const limit = new Date();
                limit.setDate(todayDate.getDate() - 7);
                limit.setHours(0, 0, 0, 0);
                return rDate >= limit;
            } else if (dateRange === '15days') {
                const limit = new Date();
                limit.setDate(todayDate.getDate() - 15);
                limit.setHours(0, 0, 0, 0);
                return rDate >= limit;
            } else if (dateRange === '30days') {
                const limit = new Date();
                limit.setDate(todayDate.getDate() - 30);
                limit.setHours(0, 0, 0, 0);
                return rDate >= limit;
            } else if (dateRange === 'custom') {
                const start = parseSafeDate(customStartDate);
                const end = parseSafeDate(customEndDate);
                start.setHours(0, 0, 0, 0);
                end.setHours(23, 59, 59, 999);
                return rDate >= start && rDate <= end;
            }
            return true;
        }).sort((a, b) => a.report_date.localeCompare(b.report_date));
    }, [history, dateRange, customStartDate, customEndDate]);

    const handleDelete = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const { data: existingData } = await supabase
                .from('commercial_reports')
                .select('*')
                .eq('report_date', reportDate)
                .maybeSingle();

            if (existingData) {
                const existingRawAnswers = existingData.raw_answers || {};
                const updatedRawAnswers = { ...existingRawAnswers };
                delete updatedRawAnswers.reception;

                // Check if there is commercial data to protect it
                const hasCommercialData = 
                    existingData.q2_contacts_count > 0 || 
                    existingData.q5_appointments_count > 0 || 
                    existingData.q7_value_sold > 0 || 
                    existingData.q7_value_received > 0 ||
                    existingData.q10_day_rating ||
                    Object.keys(updatedRawAnswers).length > 0;

                if (hasCommercialData) {
                    const { error } = await supabase
                        .from('commercial_reports')
                        .update({
                            raw_answers: updatedRawAnswers,
                            updated_at: new Date().toISOString()
                        })
                        .eq('report_date', reportDate);

                    if (error) throw error;
                } else {
                    const { error } = await supabase
                        .from('commercial_reports')
                        .delete()
                        .eq('report_date', reportDate);

                    if (error) throw error;
                }
            }

            setMessage({ type: 'success', text: 'Relatório da recepção excluído com sucesso!' });
            
            setAnswers({
                q1_agendamentos_final_dia: 0,
                q2_atendimentos_finalizados: 0,
                q3_atendimentos_remarcados: 0,
                q4_atendimentos_cancelados: 0,
                q5_nao_compareceram: 0
            });
            
            setShowDeleteConfirm(false);
            loadHistory();
        } catch (err: any) {
            console.error('Error deleting report:', err);
            setMessage({ type: 'error', text: `Erro ao excluir: ${err?.message || 'Erro desconhecido'}` });
        } finally {
            setSaving(false);
        }
    };

    const handleExportImage = async () => {
        const node = document.getElementById('dashboard-export-area');
        if (!node) return;
        
        setExportingImage(true);
        setTimeout(async () => {
            try {
                const dataUrl = await toPng(node, {
                    backgroundColor: '#0c0f1d',
                    style: {
                        transform: 'scale(1)',
                        transformOrigin: 'top left',
                        width: '1200px',
                        maxWidth: '1200px',
                    },
                    width: 1200,
                    height: node.scrollHeight
                });
                const link = document.createElement('a');
                link.download = `Relatorio_Recepcao_${dateRange}_${new Date().toLocaleDateString('pt-BR')}.png`;
                link.href = dataUrl;
                link.click();
            } catch (err) {
                console.error('Error exporting image:', err);
                setMessage({ type: 'error', text: 'Erro ao exportar a imagem.' });
            } finally {
                setExportingImage(false);
            }
        }, 100);
    };

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
        <div className="flex flex-col h-full w-full animate-fade-in text-slate-200">
            <div className="flex-1 w-full space-y-6">
                
                {message && (
                    <div className={`p-4 rounded-2xl border ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'} flex items-center justify-between shadow-lg backdrop-blur-2xl animate-in zoom-in duration-300`}>
                        <div className="flex items-center gap-3">
                            {message.type === 'error' ? <AlertCircle className="w-5 h-5 shrink-0" /> : <CheckCircle2 className="w-5 h-5 shrink-0" />}
                            <span className="text-sm font-bold">{message.text}</span>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 w-full items-start">
                    {/* LEFT COLUMN: Input Form */}
                    <div className="xl:col-span-5 flex flex-col space-y-6">
                        
                        {/* Elegant Control Widget */}
                        <div className="glass-panel p-6 rounded-3xl border border-border relative overflow-hidden flex-shrink-0 group bg-white/[0.02] backdrop-blur-2xl">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full blur-2xl pointer-events-none" />
                            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex flex-col sm:items-end gap-1">
                                    <h2 className="text-lg font-bold text-text tracking-tight">Indicadores da Recepção</h2>
                                    <p className="text-[11px] text-slate-400 mt-0.5">Preencha os números operacionais abaixo.</p>
                                </div>
                                
                                <div className="flex flex-col gap-1 shrink-0">
                                    <div className="relative">
                                        <CalendarIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-teal-400 pointer-events-none" />
                                        <input 
                                            type="date"
                                            value={reportDate}
                                            onChange={(e) => setReportDate(e.target.value)}
                                            className="bg-panel border border-border rounded-xl pl-10 pr-4 py-2 text-text focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 outline-none transition-all font-semibold font-sans text-xs shadow-inner cursor-pointer"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {loading ? (
                            <div className="glass-panel rounded-3xl border border-border bg-white/[0.01] p-12 flex flex-col items-center justify-center min-h-[400px]">
                                <div className="w-10 h-10 rounded-full border-4 border-teal-500/15 border-t-teal-500 animate-spin mb-4" />
                                <span className="text-xs text-slate-400 font-bold tracking-wide">Buscando dados da recepção...</span>
                            </div>
                        ) : (
                            <div className="glass-panel rounded-3xl border border-border flex flex-col overflow-hidden bg-white/[0.01]">
                                <div className="p-4 border-b border-border bg-white/[0.03] flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-1.5 bg-teal-500/10 text-teal-400 rounded-lg">
                                            <Activity className="w-4 h-4" />
                                        </div>
                                        <h3 className="text-xs font-bold text-text uppercase tracking-wider">Formulário de Entrada</h3>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {(appointmentData as any)[reportDate] && (
                                            <button
                                                onClick={() => setAnswers((appointmentData as any)[reportDate])}
                                                className="flex items-center gap-1.5 px-3 py-1 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 text-[10px] font-bold rounded-lg border border-teal-500/30 transition-all cursor-pointer"
                                            >
                                                <Database className="w-3 h-3" />
                                                Preencher Dados
                                            </button>
                                        )}
                                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Valores do Dia</span>
                                    </div>
                                </div>
                                
                                <div className="p-6 space-y-4 flex-1">
                                    
                                    {/* ITEM 1: Agendamentos Fim do Dia */}
                                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-border hover:border-border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden group">
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500/40" />
                                        <div className="flex items-start gap-3">
                                            <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl mt-0.5 group-hover:scale-110 transition-transform">
                                                <CalendarIcon className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-extrabold text-text">Agendados no Fim do Dia</h4>
                                                <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">Pacientes marcados na agenda oficial ao fim do dia.</p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-1.5 self-end md:self-auto shrink-0">
                                            <button 
                                                type="button"
                                                onClick={() => adjustValue('q1_agendamentos_final_dia', -1)}
                                                className="w-8 h-8 rounded-lg bg-panel hover:bg-panel/80 border border-border flex items-center justify-center text-slate-400 hover:text-text transition-all text-xs active:scale-95 shrink-0"
                                            >
                                                <Minus className="w-3.5 h-3.5" />
                                            </button>
                                            <input 
                                                type="number"
                                                value={answers.q1_agendamentos_final_dia || ''}
                                                onChange={(e) => setAnswers({...answers, q1_agendamentos_final_dia: Math.max(0, parseInt(e.target.value) || 0)})}
                                                className="w-16 bg-panel border border-border rounded-lg py-1 text-center text-text focus:border-blue-500 focus:ring-1 focus:ring-blue-500/10 outline-none text-xs font-extrabold font-mono"
                                                placeholder="0"
                                            />
                                            <button 
                                                type="button"
                                                onClick={() => adjustValue('q1_agendamentos_final_dia', 1)}
                                                className="w-8 h-8 rounded-lg bg-panel hover:bg-panel/80 border border-border flex items-center justify-center text-slate-400 hover:text-text transition-all text-xs active:scale-95 shrink-0"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* ITEM 2: Atendimentos Finalizados */}
                                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-border hover:border-border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden group">
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500/40" />
                                        <div className="flex items-start gap-3">
                                            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl mt-0.5 group-hover:scale-110 transition-transform">
                                                <CheckCircle2 className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-extrabold text-text">Compareceram e Concluíram</h4>
                                                <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">Consultas finalizadas com sucesso no dia de hoje.</p>
                                                <div className="mt-2 flex items-center gap-2">
                                                    <div className="h-1 w-24 bg-panel/80 rounded-full overflow-hidden">
                                                        <div className={`h-full rounded-full ${ (answers.q2_atendimentos_finalizados || 0) >= 15 ? 'bg-emerald-500' : 'bg-emerald-400'}`} style={{ width: `${Math.min((answers.q2_atendimentos_finalizados || 0) / 15 * 100, 100)}%` }} />
                                                    </div>
                                                    <span className={`text-[9px] font-bold ${ (answers.q2_atendimentos_finalizados || 0) >= 15 ? 'text-emerald-400' : 'text-slate-400'}`}>
                                                        {answers.q2_atendimentos_finalizados || 0} / 15
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-1.5 self-end md:self-auto shrink-0">
                                            <button 
                                                type="button"
                                                onClick={() => adjustValue('q2_atendimentos_finalizados', -1)}
                                                className="w-8 h-8 rounded-lg bg-panel hover:bg-panel/80 border border-border flex items-center justify-center text-slate-400 hover:text-text transition-all text-xs active:scale-95 shrink-0"
                                            >
                                                <Minus className="w-3.5 h-3.5" />
                                            </button>
                                            <input 
                                                type="number"
                                                value={answers.q2_atendimentos_finalizados || ''}
                                                onChange={(e) => setAnswers({...answers, q2_atendimentos_finalizados: Math.max(0, parseInt(e.target.value) || 0)})}
                                                className="w-16 bg-panel border border-border rounded-lg py-1 text-center text-text focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/10 outline-none text-xs font-extrabold font-mono"
                                                placeholder="0"
                                            />
                                            <button 
                                                type="button"
                                                onClick={() => adjustValue('q2_atendimentos_finalizados', 1)}
                                                className="w-8 h-8 rounded-lg bg-panel hover:bg-panel/80 border border-border flex items-center justify-center text-slate-400 hover:text-text transition-all text-xs active:scale-95 shrink-0"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* ITEM 3: Atendimentos Remarcados */}
                                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-border hover:border-border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden group">
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500/40" />
                                        <div className="flex items-start gap-3">
                                            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl mt-0.5 group-hover:scale-110 transition-transform">
                                                <Clock className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-extrabold text-text">Atendimentos Remarcados</h4>
                                                <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">Solicitações de alteração de data atendidas hoje.</p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-1.5 self-end md:self-auto shrink-0">
                                            <button 
                                                type="button"
                                                onClick={() => adjustValue('q3_atendimentos_remarcados', -1)}
                                                className="w-8 h-8 rounded-lg bg-panel hover:bg-panel/80 border border-border flex items-center justify-center text-slate-400 hover:text-text transition-all text-xs active:scale-95 shrink-0"
                                            >
                                                <Minus className="w-3.5 h-3.5" />
                                            </button>
                                            <input 
                                                type="number"
                                                value={answers.q3_atendimentos_remarcados || ''}
                                                onChange={(e) => setAnswers({...answers, q3_atendimentos_remarcados: Math.max(0, parseInt(e.target.value) || 0)})}
                                                className="w-16 bg-panel border border-border rounded-lg py-1 text-center text-text focus:border-amber-500 focus:ring-1 focus:ring-amber-500/10 outline-none text-xs font-extrabold font-mono"
                                                placeholder="0"
                                            />
                                            <button 
                                                type="button"
                                                onClick={() => adjustValue('q3_atendimentos_remarcados', 1)}
                                                className="w-8 h-8 rounded-lg bg-panel hover:bg-panel/80 border border-border flex items-center justify-center text-slate-400 hover:text-text transition-all text-xs active:scale-95 shrink-0"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* ITEM 4: Atendimentos Cancelados */}
                                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-border hover:border-border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden group">
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-500/40" />
                                        <div className="flex items-start gap-3">
                                            <div className="p-2.5 bg-slate-500/10 text-slate-400 rounded-xl mt-0.5 group-hover:scale-110 transition-transform">
                                                <XCircle className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-extrabold text-text">Atendimentos Cancelados</h4>
                                                <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">Cancelamentos confirmados sem reagendamento previsto.</p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-1.5 self-end md:self-auto shrink-0">
                                            <button 
                                                type="button"
                                                onClick={() => adjustValue('q4_atendimentos_cancelados', -1)}
                                                className="w-8 h-8 rounded-lg bg-panel hover:bg-panel/80 border border-border flex items-center justify-center text-slate-400 hover:text-text transition-all text-xs active:scale-95 shrink-0"
                                            >
                                                <Minus className="w-3.5 h-3.5" />
                                            </button>
                                            <input 
                                                type="number"
                                                value={answers.q4_atendimentos_cancelados || ''}
                                                onChange={(e) => setAnswers({...answers, q4_atendimentos_cancelados: Math.max(0, parseInt(e.target.value) || 0)})}
                                                className="w-16 bg-panel border border-border rounded-lg py-1 text-center text-text focus:border-slate-500 focus:ring-1 focus:ring-slate-500/10 outline-none text-xs font-extrabold font-mono"
                                                placeholder="0"
                                            />
                                            <button 
                                                type="button"
                                                onClick={() => adjustValue('q4_atendimentos_cancelados', 1)}
                                                className="w-8 h-8 rounded-lg bg-panel hover:bg-panel/80 border border-border flex items-center justify-center text-slate-400 hover:text-text transition-all text-xs active:scale-95 shrink-0"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* ITEM 5: Não Compareceram */}
                                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-border hover:border-border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden group">
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500/40" />
                                        <div className="flex items-start gap-3">
                                            <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-xl mt-0.5 group-hover:scale-110 transition-transform">
                                                <UserMinus className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-extrabold text-text">Não Compareceram (Faltas)</h4>
                                                <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">Faltas registradas de pacientes sem qualquer aviso.</p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-1.5 self-end md:self-auto shrink-0">
                                            <button 
                                                type="button"
                                                onClick={() => adjustValue('q5_nao_compareceram', -1)}
                                                className="w-8 h-8 rounded-lg bg-panel hover:bg-panel/80 border border-border flex items-center justify-center text-slate-400 hover:text-text transition-all text-xs active:scale-95 shrink-0"
                                            >
                                                <Minus className="w-3.5 h-3.5" />
                                            </button>
                                            <input 
                                                type="number"
                                                value={answers.q5_nao_compareceram || ''}
                                                onChange={(e) => setAnswers({...answers, q5_nao_compareceram: Math.max(0, parseInt(e.target.value) || 0)})}
                                                className="w-16 bg-panel border border-border rounded-lg py-1 text-center text-text focus:border-rose-500 focus:ring-1 focus:ring-rose-500/10 outline-none text-xs font-extrabold font-mono"
                                                placeholder="0"
                                            />
                                            <button 
                                                type="button"
                                                onClick={() => adjustValue('q5_nao_compareceram', 1)}
                                                className="w-8 h-8 rounded-lg bg-panel hover:bg-panel/80 border border-border flex items-center justify-center text-slate-400 hover:text-text transition-all text-xs active:scale-95 shrink-0"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* ITEM 6: Valor Total Recebido */}
                                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-border hover:border-border transition-all flex flex-col gap-3 relative overflow-hidden group">
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500/40" />
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl group-hover:scale-110 transition-transform">
                                                <TrendingUp className="w-4 h-4" />
                                            </div>
                                            <h4 className="text-xs font-extrabold text-text">Valor total recebido no dia</h4>
                                        </div>
                                        <input 
                                            type="number"
                                            value={answers.total_received_value || ''}
                                            onChange={(e) => setAnswers({...answers, total_received_value: Math.max(0, parseFloat(e.target.value) || 0)})}
                                            className="bg-panel border border-border rounded-xl px-4 py-3 text-text focus:border-emerald-500 outline-none text-sm font-bold w-full font-mono"
                                            placeholder="R$ 0,00"
                                        />
                                    </div>

                                    {/* ITEM 7: Objeções Recorrentes */}
                                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-border hover:border-border transition-all flex flex-col gap-3 relative overflow-hidden group">
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500/40" />
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl group-hover:scale-110 transition-transform">
                                                <AlertCircle className="w-4 h-4" />
                                            </div>
                                            <h4 className="text-xs font-extrabold text-text">Objeções recorrentes do dia</h4>
                                        </div>
                                        <textarea 
                                            value={answers.recurrent_objections || ''}
                                            onChange={(e) => setAnswers({...answers, recurrent_objections: e.target.value})}
                                            className="bg-panel border border-border rounded-xl px-4 py-3 text-text focus:border-amber-500 outline-none text-sm font-bold w-full font-mono min-h-[80px]"
                                            placeholder="Descreva as objeções..."
                                        />
                                    </div>

                                    {/* ITEM 8: Estrutura a ser Resolvida */}
                                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-border hover:border-border transition-all flex flex-col gap-3 relative overflow-hidden group">
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500/40" />
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl group-hover:scale-110 transition-transform">
                                                <BarChart3 className="w-4 h-4" />
                                            </div>
                                            <h4 className="text-xs font-extrabold text-text">Estrutura a ser Resolvida</h4>
                                        </div>
                                        <textarea 
                                            value={answers.structure_to_be_resolved || ''}
                                            onChange={(e) => setAnswers({...answers, structure_to_be_resolved: e.target.value})}
                                            className="bg-panel border border-border rounded-xl px-4 py-3 text-text focus:border-indigo-500 outline-none text-sm font-bold w-full font-mono min-h-[80px]"
                                            placeholder="Descreva a estrutura..."
                                        />
                                    </div>

                                </div>
                                
                                <div className="p-4 border-t border-border bg-panel flex flex-col sm:flex-row gap-3">
                                    <button 
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="flex-1 glass-button glass-button-primary text-text font-black py-3.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 text-xs uppercase tracking-widest active:scale-[0.98] cursor-pointer"
                                    >
                                        {saving ? (
                                            <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                                        ) : (
                                            <>
                                                <Save className="w-4 h-4" />
                                                <span>Gravar Relatório</span>
                                            </>
                                        )}
                                    </button>
                                    <button 
                                        onClick={handleShareWhatsApp}
                                        disabled={saving}
                                        className="flex-1 glass-button bg-green-600/20 border-green-500/30 text-text font-black py-3.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 text-xs uppercase tracking-widest active:scale-[0.98] cursor-pointer"
                                    >
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                                        </svg>
                                        <span>Compartilhar</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN: Dashboard and History */}
                    <div className="xl:col-span-7 flex flex-col space-y-6">
                        
                        {/* Range filters for custom period selection */}
                        <div className="flex flex-col md:flex-row md:items-center gap-4 bg-slate-900/40 p-4 rounded-3xl border border-border">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] text-slate-500 uppercase font-black mr-2">Filtrar Período:</span>
                                {[
                                    { id: 'today', label: 'Hoje' },
                                    { id: '7days', label: '7 Dias' },
                                    { id: '15days', label: '15 Dias' },
                                    { id: '30days', label: '30 Dias' },
                                    { id: 'custom', label: 'Personalizado' },
                                    { id: 'all', label: 'Tudo' }
                                ].map((range) => (
                                    <button
                                        key={range.id}
                                        onClick={() => setDateRange(range.id as any)}
                                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all glass-button ${
                                            dateRange === range.id
                                                ? 'bg-teal-600 text-text shadow-lg shadow-teal-500/20'
                                                : 'text-slate-500 opacity-60 hover:opacity-100'
                                        }`}
                                    >
                                        {range.label}
                                    </button>
                                ))}
                            </div>

                            {dateRange === 'custom' && (
                                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                                    <div className="flex flex-col gap-1">
                                        <input
                                            type="date"
                                            value={customStartDate}
                                            onChange={(e) => setCustomStartDate(e.target.value)}
                                            className="bg-panel border border-border rounded-lg px-3 py-1 text-[11px] text-text outline-none focus:border-teal-500 cursor-pointer"
                                        />
                                    </div>
                                    <span className="text-slate-600 text-xs">a</span>
                                    <div className="flex flex-col gap-1">
                                        <input
                                            type="date"
                                            value={customEndDate}
                                            onChange={(e) => setCustomEndDate(e.target.value)}
                                            className="bg-panel border border-border rounded-lg px-3 py-1 text-[11px] text-text outline-none focus:border-teal-500 cursor-pointer"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="ml-auto flex items-center gap-3">
                                 <div className="text-[10px] text-slate-500 font-bold uppercase font-mono hidden lg:block">
                                      Amostra: {filteredReports.length} Relatórios
                                 </div>
                                 <button
                                     onClick={handleExportImage}
                                     disabled={exportingImage}
                                     className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-text rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-indigo-500/20 cursor-pointer"
                                 >
                                     <Image className="w-3.5 h-3.5" />
                                     Exportar Imagem
                                 </button>
                            </div>
                        </div>
                        
                        <div id="dashboard-export-area" className={`flex flex-col space-y-6 ${exportingImage ? 'w-[1200px] max-w-[1200px] p-8 bg-surface rounded-[24px]' : ''}`}>
                            
                            {/* Dashboard KPI cards */}
                            <div className={`grid gap-4 ${exportingImage ? 'grid-cols-4' : 'grid-cols-2 md:grid-cols-4'}`}>
                                <div className="glass-panel p-4 rounded-2xl border border-border relative overflow-hidden group bg-white/[0.02] flex flex-col justify-between min-h-[100px]">
                                    <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                                        <CalendarIcon className="w-10 h-10 text-blue-400" />
                                    </div>
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500/30" />
                                    <span className="text-[9px] text-blue-400 font-extrabold uppercase tracking-widest block leading-tight">Agendados Fim do Dia</span>
                                    <div className="flex items-baseline gap-1 mt-2">
                                        <span className="text-2xl font-black text-text tracking-tight">{kpiMetrics.agendamentosTotal}</span>
                                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Geral</span>
                                    </div>
                                </div>
                                
                                <div className="glass-panel p-4 rounded-2xl border border-border relative overflow-hidden group bg-white/[0.02] flex flex-col justify-between min-h-[100px]">
                                    <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                                        <Users className="w-10 h-10 text-emerald-400" />
                                    </div>
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500/30" />
                                    <span className="text-[9px] text-emerald-400 font-extrabold uppercase tracking-widest block leading-tight">Comparecidos</span>
                                    <div className="flex items-baseline gap-1 mt-2">
                                        <span className="text-2xl font-black text-text tracking-tight">{kpiMetrics.finalizadosTotal}</span>
                                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Geral</span>
                                    </div>
                                </div>
                                
                                <div className="glass-panel p-4 rounded-2xl border border-border relative overflow-hidden group bg-white/[0.02] flex flex-col justify-between min-h-[100px]">
                                    <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                                        <CalendarX className="w-10 h-10 text-amber-400" />
                                    </div>
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500/30" />
                                    <span className="text-[9px] text-amber-400 font-extrabold uppercase tracking-widest block leading-tight">Total Perdas</span>
                                    <div className="flex items-baseline gap-1 mt-2">
                                        <span className="text-2xl font-black text-text tracking-tight">{kpiMetrics.totalLosses}</span>
                                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Geral</span>
                                    </div>
                                </div>
                                
                                <div className="glass-panel p-4 rounded-2xl border border-border relative overflow-hidden group bg-white/[0.02] flex flex-col justify-between min-h-[100px]">
                                    <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                                        <Activity className="w-10 h-10 text-teal-400" />
                                    </div>
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-teal-500/30" />
                                    <span className="text-[9px] text-teal-400 font-extrabold uppercase tracking-widest block leading-tight">Taxa de Presença</span>
                                    <div className="flex items-baseline gap-1 mt-2">
                                        <span className="text-2xl font-black text-text tracking-tight">{kpiMetrics.attendanceRate.toFixed(1)}%</span>
                                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Média</span>
                                    </div>
                                </div>
                            </div>

                            {/* Attendance Effectiveness */}
                            <div className="glass-panel p-6 rounded-3xl border border-border bg-white/[0.01]">
                                <div className="flex items-center gap-2.5 mb-4 border-b border-border pb-3">
                                    <div className="p-1.5 bg-teal-500/10 text-teal-400 rounded-lg">
                                        <BarChart3 className="w-4 h-4" />
                                    </div>
                                    <h3 className="text-xs font-bold text-text uppercase tracking-wider">Efetividade da Agenda (Média Histórica)</h3>
                                </div>
                                
                                <div className="mb-4">
                                    <div className="flex justify-between items-end mb-2">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] text-teal-400 font-extrabold uppercase tracking-widest">Comparecimentos</span>
                                            <span className="text-base font-black text-text mt-0.5">{kpiMetrics.attendanceRate.toFixed(1)}%</span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-widest">Remarcações / Cancelamentos / Faltas</span>
                                            <span className="text-base font-black text-text mt-0.5">{(kpiMetrics.rescheduledRate + kpiMetrics.noShowRate + kpiMetrics.cancelledRate).toFixed(1)}%</span>
                                        </div>
                                    </div>
                                    <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-slate-800">
                                        <div style={{ width: `${kpiMetrics.attendanceRate}%` }} className="bg-teal-400 h-full transition-all duration-500" title="Compareceram"></div>
                                        <div style={{ width: `${kpiMetrics.rescheduledRate}%` }} className="bg-amber-400 h-full transition-all duration-500" title="Remarcaram"></div>
                                        <div style={{ width: `${kpiMetrics.noShowRate}%` }} className="bg-rose-400 h-full transition-all duration-500" title="Faltaram"></div>
                                        <div style={{ width: `${kpiMetrics.cancelledRate}%` }} className="bg-slate-500 h-full transition-all duration-500" title="Cancelaram"></div>
                                    </div>
                                </div>

                                <div className={`grid gap-4 mt-6 pt-5 border-t border-border ${exportingImage ? 'grid-cols-4' : 'grid-cols-2 md:grid-cols-4'}`}>
                                    <div className="p-3 bg-white/[0.02] hover:bg-white/[0.04] rounded-xl border border-border flex flex-col gap-1 transition-all">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-full bg-teal-400" />
                                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Finalizados</span>
                                        </div>
                                        <span className="text-lg font-black text-text">{kpiMetrics.finalizadosTotal}</span>
                                        <span className="text-[8px] text-slate-500 font-bold">{kpiMetrics.attendanceRate.toFixed(1)}% do total</span>
                                    </div>
                                    
                                    <div className="p-3 bg-white/[0.02] hover:bg-white/[0.04] rounded-xl border border-border flex flex-col gap-1 transition-all">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-full bg-amber-400" />
                                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Remarcados</span>
                                        </div>
                                        <span className="text-lg font-black text-text">{kpiMetrics.remarcadosTotal}</span>
                                        <span className="text-[8px] text-slate-500 font-bold">{kpiMetrics.rescheduledRate.toFixed(1)}% do total</span>
                                    </div>
                                    
                                    <div className="p-3 bg-white/[0.02] hover:bg-white/[0.04] rounded-xl border border-border flex flex-col gap-1 transition-all">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-full bg-rose-400" />
                                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Faltaram</span>
                                        </div>
                                        <span className="text-lg font-black text-text">{kpiMetrics.naoCompareceramTotal}</span>
                                        <span className="text-[8px] text-slate-500 font-bold">{kpiMetrics.noShowRate.toFixed(1)}% do total</span>
                                    </div>
                                    
                                    <div className="p-3 bg-white/[0.02] hover:bg-white/[0.04] rounded-xl border border-border flex flex-col gap-1 transition-all">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-full bg-slate-500" />
                                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Cancelados</span>
                                        </div>
                                        <span className="text-lg font-black text-text">{kpiMetrics.canceladosTotal}</span>
                                        <span className="text-[8px] text-slate-500 font-bold">{kpiMetrics.cancelledRate.toFixed(1)}% do total</span>
                                    </div>
                                </div>
                            </div>

                            {/* Area Chart Card */}
                            <div className="glass-panel p-6 rounded-3xl border border-border bg-white/[0.01] flex flex-col min-h-[300px]">
                                <div className="flex items-center gap-2.5 mb-4 border-b border-border pb-3">
                                    <div className="p-1.5 bg-teal-500/10 text-teal-400 rounded-lg">
                                        <TrendingUp className="w-4 h-4" />
                                    </div>
                                    <h3 className="text-xs font-bold text-text uppercase tracking-wider">Evolução Diária (Últimos 14 Dias)</h3>
                                </div>
                                <div className="flex-1 min-h-[250px] w-full">
                                    {chartData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -22, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="colorFin" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.25} />
                                                        <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                                                    </linearGradient>
                                                    <linearGradient id="colorPerdas" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25} />
                                                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                                                <XAxis 
                                                    dataKey="name" 
                                                    stroke="#ffffff33" 
                                                    fontSize={9} 
                                                    tickMargin={10} 
                                                    axisLine={false} 
                                                    tickLine={false}
                                                    style={{ fontWeight: 600, fontFamily: 'sans-serif' }}
                                                />
                                                <YAxis 
                                                    stroke="#ffffff33" 
                                                    fontSize={9} 
                                                    axisLine={false} 
                                                    tickLine={false}
                                                    style={{ fontWeight: 600, fontFamily: 'sans-serif' }}
                                                />
                                                <RechartsTooltip 
                                                    contentStyle={{ 
                                                        backgroundColor: '#0c0f1a', 
                                                        borderColor: 'rgba(255,255,255,0.08)', 
                                                        borderRadius: '16px', 
                                                        fontSize: '11px',
                                                        boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5)'
                                                    }}
                                                    itemStyle={{ fontWeight: 'bold' }}
                                                />
                                                <Area type="monotone" dataKey="finalizados" name="Finalizados" stroke="#14b8a6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorFin)" />
                                                <Area type="monotone" dataKey="perdas" name="Perdas Totais" stroke="#f43f5e" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPerdas)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex items-center justify-center py-12">
                                            <span className="text-xs text-slate-500 font-extrabold uppercase tracking-wider">Sem dados históricos para exibir</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Box: Histórico das Diárias Preenchidas no Período */}
                            <div className="glass-panel p-6 rounded-3xl border border-border space-y-4 flex flex-col h-[400px]">
                                 <div className="flex items-center justify-between border-b border-border pb-2">
                                      <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                           <History className="w-4 h-4 text-teal-400" />
                                           Histórico das Diárias Preenchidas no Período
                                      </h4>
                                      <span className="text-[10px] text-slate-500 font-bold font-mono">
                                           {filteredReports.length} Relatório(s)
                                      </span>
                                 </div>
                                 <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar">
                                     <table className="w-full text-left border-collapse min-w-[650px]">
                                         <thead>
                                             <tr className="border-b border-border text-[9px] text-slate-500 uppercase tracking-wider font-bold">
                                                 <th className="py-2 px-3">Data</th>
                                                 <th className="py-2 px-3 text-right">Agendados</th>
                                                 <th className="py-2 px-3 text-right">Compareceram</th>
                                                 <th className="py-2 px-3 text-right">Remarcados</th>
                                                 <th className="py-2 px-3 text-right">Cancelados</th>
                                                 <th className="py-2 px-3 text-right">Faltas (Não Comp.)</th>
                                                 <th className="py-2 px-3 text-center">Ações</th>
                                             </tr>
                                         </thead>
                                         <tbody className="divide-y divide-white/5 text-xs">
                                             {filteredReports.length === 0 ? (
                                                 <tr>
                                                     <td colSpan={7} className="py-8 text-center text-slate-500 italic">
                                                         Nenhum relatório preenchido no período selecionado.
                                                     </td>
                                                 </tr>
                                             ) : (
                                                 [...filteredReports].reverse().map((report) => {
                                                     const rec = report.raw_answers.reception;
                                                     return (
                                                         <tr key={report.id} className="hover:bg-white/[0.02] transition-colors">
                                                             <td className="py-2.5 px-3 font-bold text-slate-300 font-mono">
                                                                 {parseSafeDate(report.report_date).toLocaleDateString('pt-BR')}
                                                             </td>
                                                             <td className="py-2.5 px-3 text-right font-mono text-slate-300 font-semibold">
                                                                 {rec.q1_agendamentos_final_dia || 0}
                                                             </td>
                                                             <td className="py-2.5 px-3 text-right font-mono text-teal-400 font-bold">
                                                                 {rec.q2_atendimentos_finalizados || 0}
                                                             </td>
                                                             <td className="py-2.5 px-3 text-right font-mono text-amber-400 font-semibold">
                                                                 {rec.q3_atendimentos_remarcados || 0}
                                                             </td>
                                                             <td className="py-2.5 px-3 text-right font-mono text-slate-400 font-semibold">
                                                                 {rec.q4_atendimentos_cancelados || 0}
                                                             </td>
                                                             <td className="py-2.5 px-3 text-right font-mono text-rose-400 font-semibold">
                                                                 {rec.q5_nao_compareceram || 0}
                                                             </td>
                                                             <td className="py-2.5 px-3">
                                                                 <div className="flex items-center justify-center gap-2">
                                                                     <button
                                                                         type="button"
                                                                         onClick={() => {
                                                                             setReportDate(report.report_date);
                                                                         }}
                                                                         title="Visualizar/Editar"
                                                                         className="p-1 text-slate-400 hover:text-teal-400 transition-colors cursor-pointer"
                                                                     >
                                                                         <Eye className="w-4 h-4" />
                                                                     </button>
                                                                     <button
                                                                         type="button"
                                                                         onClick={() => {
                                                                             setReportDate(report.report_date);
                                                                             setShowDeleteConfirm(true);
                                                                         }}
                                                                         title="Excluir"
                                                                         className="p-1 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                                                                     >
                                                                         <Trash2 className="w-4 h-4" />
                                                                     </button>
                                                                 </div>
                                                             </td>
                                                         </tr>
                                                     );
                                                 })
                                             )}
                                         </tbody>
                                     </table>
                                 </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            {/* Delete Modal Confirmation Alert */}
            {showDeleteConfirm && (
                <div id="delete-confirm-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 dark:bg-black/60 backdrop-blur-2xl">
                    <div className="glass-panel max-w-md w-full p-6 rounded-3xl border shadow-2xl space-y-6 animate-in scale-in duration-200">
                        <div className="flex items-center gap-3 text-rose-400">
                            <div className="p-2.5 bg-rose-500/10 rounded-2xl border border-rose-500/20">
                                <AlertCircle className="w-6 h-6 animate-pulse" />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-text uppercase tracking-wider">Aviso de Exclusão</h3>
                                <p className="text-[9px] text-rose-400/80 font-extrabold uppercase tracking-widest font-mono">Esta ação é irreversível!</p>
                            </div>
                        </div>

                        <div className="space-y-3 font-semibold">
                            <p className="text-xs text-slate-300 leading-relaxed">
                                Você está prestes a excluir permanentemente os **Indicadores da Recepção** do dia:
                            </p>
                            <div className="bg-panel border border-border rounded-2xl p-4 flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-400">Data Selecionada</span>
                                <span className="text-sm font-black text-teal-400 font-mono">
                                    {parseSafeDate(reportDate).toLocaleDateString('pt-BR')}
                                </span>
                            </div>
                            <p className="text-[10px] text-slate-500 leading-relaxed font-normal font-sans">
                                Todos os dados de agendamentos final de dia, comparecimentos, perdas por faltas/cancelamentos e remarcações registrados para a recepção nesta data serão deletados permanentemente de nosso banco de dados. Se houver dados comerciais registrados para esta mesma data, eles serão preservados de forma segura.
                            </p>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 py-3.5 bg-panel hover:bg-panel/80 active:scale-[0.98] text-text rounded-xl font-bold text-xs transition-colors border border-border cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={saving}
                                className="flex-1 py-3.5 bg-rose-600 hover:bg-rose-500 active:scale-[0.98] text-text rounded-xl font-bold text-xs transition-all shadow-lg shadow-rose-600/20 cursor-pointer"
                            >
                                {saving ? 'Excluindo...' : 'Sim, Excluir'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
