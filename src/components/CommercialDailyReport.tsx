import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { toast } from 'sonner';
import { useRealtimeSubscription, notifyDataChange } from '../lib/realtime';
import { 
    Calendar, 
    Save, 
    History, 
    AlertCircle, 
    CheckCircle2,
    TrendingUp,
    Users,
    FileText,
    MessageSquare,
    Settings,
    Target,
    Clock,
    Smile,
    Activity,
    LineChart as LucideLineChart,
    BarChart3,
    Award,
    Trash2,
    Plus,
    Eye,
    EyeOff,
    Sun,
    Sunset,
    DollarSign,
    Image
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { 
    ResponsiveContainer,
    Cell,
    AreaChart, Area,
    XAxis, YAxis, CartesianGrid, 
    Tooltip, Legend, 
    LineChart, Line,
    PieChart, Pie,
    BarChart, Bar,
    LabelList
} from 'recharts';

// Model to serialize 10 structured answers safely to existing database columns
interface CommercialReportAnswers {
    q1_arrival: 'sim_pontual' | 'sim_atraso' | 'nao_pontual' | 'nao_atraso' | ''; // 1. Como você chegou na empresa hoje?
    q2_contacts_count: number; // 2. Quantas pessoas você contatou hoje?
    q2_rescue_contacts_count: number; // 2.b Contatos de Resgate (não novos)
    q2_positive_rescue_count: number; // Quantos resgates resultaram em agendamento hoje?
    q3_positive_count: number; // 3. Quantas pessoas responderam positivamente ao seu contato?
    q4_positive_details: string; // 4. Nome e telefone das pessoas que responderam positivamente.
    q5_appointments_count: number; // 5. Quantos novos agendamentos você realizou hoje?
    q5_scheduled_for_today_count: number; // 5.b Quantos agendamentos tinha na agenda marcados para hoje?
    q5_attended_count: number; // Compareceram (Presença)
    q5_no_show_count: number; // Faltaram (Ausência)
    q5_rescheduled_count: number; // Quantos remarcaram?
    q5_cancelled_count: number; // Quantos cancelaram?
    q6_timeframe_options: string[]; // 6. Para quando foram os agendamentos? [Hoje, Dia Seguinte, 2 dias, 3 dias, Mais de 3 dias]
    q7_value_sold: number; // 7. Valor vendido
    q7_value_received: number; // 7. Valor recebido
    q8_post_sales_count: number; // 8. Quantos pós-vendas hoje? (clientes 7-15 dias)
    q9_reactivations_count: number; // 9. Quantas reativações hoje? (pacotes/novos procedimentos)
    q10_day_rating: 'ruim' | 'regular' | 'bom' | 'otimo' | ''; // 10. Como foi o seu dia (classificação)
    q10_explanation: string; // 10. Como foi o seu dia (explicação)
    ortho_starts: number; // Quantos pacientes de ortodontia iniciaram hoje?
    objections: { type: string; reason: string }[]; // 11. Objeções e justificativas
    m_contacts_count?: number;
    m_responses_count?: number;
    m_future_appointments_count?: number;
    m_new_presential_appointments_count?: number;
    m_recurrent_leads_count?: number;
    m_recurrent_responses_count?: number;
    m_reactivation_leads_count?: number;
    m_reactivation_responses_count?: number;
    m_new_leads_count?: number;
    m_new_leads_responses_count?: number;
    t_contacts_count?: number;
    t_responses_count?: number;
    t_future_appointments_count?: number;
    t_new_presential_appointments_count?: number;
    t_recurrent_leads_count?: number;
    t_recurrent_responses_count?: number;
    t_reactivation_leads_count?: number;
    t_reactivation_responses_count?: number;
    t_new_leads_count?: number;
    t_new_leads_responses_count?: number;
    shift?: 'Manhã' | 'Tarde';
}

interface CommercialReport {
    id?: string;
    report_date: string;
    user_id?: string;
    leads_received: number;
    new_leads?: number;
    appointments_made: number;
    budgets_presented: number;
    contracts_closed: number;
    objections?: any;
    appointments_by_time?: any;
    main_challenges: string;
    opportunities: string;
    ortho_starts?: number;
    raw_answers?: any;
    created_at?: string;
    updated_at?: string;
}

interface DailyGoals {
    leads: number; // Target for contacts
    contracts: number; // Target for sales (R$)
}

// Custom deserializer helper
const deserializePayload = (dbChallengesText: string, dbOpportunitiesText: string): { answers: CommercialReportAnswers; cleanedChallenges: string; cleanedOpportunities: string } => {
    const defaultAnswers: CommercialReportAnswers = {
        q1_arrival: '',
        q2_contacts_count: 0,
        q2_rescue_contacts_count: 0,
        q2_positive_rescue_count: 0,
        q3_positive_count: 0,
        q4_positive_details: '',
        q5_appointments_count: 0,
        q5_scheduled_for_today_count: 0,
        q5_attended_count: 0,
        q5_no_show_count: 0,
        q5_rescheduled_count: 0,
        q5_cancelled_count: 0,
        q6_timeframe_options: [],
        q7_value_sold: 0,
        q7_value_received: 0,
        q8_post_sales_count: 0,
        q9_reactivations_count: 0,
        q10_day_rating: '',
        q10_explanation: '',
        ortho_starts: 0,
        objections: [],
        m_contacts_count: 0,
        m_responses_count: 0,
        m_future_appointments_count: 0,
        m_new_presential_appointments_count: 0,
        m_recurrent_leads_count: 0,
        m_recurrent_responses_count: 0,
        m_reactivation_leads_count: 0,
        m_reactivation_responses_count: 0,
        m_new_leads_count: 0,
        m_new_leads_responses_count: 0,
        t_contacts_count: 0,
        t_responses_count: 0,
        t_future_appointments_count: 0,
        t_new_presential_appointments_count: 0,
        t_recurrent_leads_count: 0,
        t_recurrent_responses_count: 0,
        t_reactivation_leads_count: 0,
        t_reactivation_responses_count: 0,
        t_new_leads_count: 0,
        t_new_leads_responses_count: 0,
        shift: 'Manhã'
    };

    let answers = { ...defaultAnswers };
    let cleanedChallenges = dbChallengesText || '';
    const cleanedOpportunities = dbOpportunitiesText || '';

    // Search for serialized answers inside main_challenges text
    if (dbChallengesText && dbChallengesText.includes('---COMMERCIAL_ANSWERS_START---')) {
        try {
            const parts = dbChallengesText.split('---COMMERCIAL_ANSWERS_START---\n');
            if (parts.length > 1) {
                const subparts = parts[1].split('\n---COMMERCIAL_ANSWERS_END---');
                const jsonStr = subparts[0];
                answers = { ...defaultAnswers, ...JSON.parse(jsonStr) };
                cleanedChallenges = (subparts[1] || '').trim();
            }
        } catch (e) {
            console.error("Error parsing commercial answers JSON:", e);
        }
    }

    return { answers, cleanedChallenges, cleanedOpportunities };
};

// Safe date parser to avoid UTC/timezone shifts when parsing YYYY-MM-DD
const parseSafeDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    // Use split to ensure local time interpretation
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
};

export const CommercialDailyReport: React.FC = () => {
    const today = new Date().toLocaleDateString('en-CA');
    const [reportDate, setReportDate] = useState(today);
    const [activeTab, setActiveTab] = useState<'form' | 'dashboard'>('form');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [history, setHistory] = useState<CommercialReport[]>([]);
    const [showSettings, setShowSettings] = useState(false);
    const [dailyGoals, setDailyGoals] = useState<DailyGoals>({ leads: 20, contracts: 5000 });
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [exportingImage, setExportingImage] = useState(false);

    // Fetch current user
    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setCurrentUser(user);
        };
        fetchUser();
    }, []);

    // Visibility state for activity chart metrics
    const [visibleActivityLines, setVisibleActivityLines] = useState<string[]>([
        'Contatos', 'Agendamentos', 'Compareceram', 'Faltaram', 'Cancelados'
    ]);

    const [dateRange, setDateRange] = useState<'today' | '7days' | '15days' | '30days' | 'custom'>('7days');
    const [customStartDate, setCustomStartDate] = useState(today);
    const [customEndDate, setCustomEndDate] = useState(today);

    // State for the 10 core questions
    const [answers, setAnswers] = useState<CommercialReportAnswers>(() => {
        const defaultState: CommercialReportAnswers = {
            q1_arrival: '',
            q2_contacts_count: 0,
            q2_rescue_contacts_count: 0,
            q2_positive_rescue_count: 0,
            q3_positive_count: 0,
            q4_positive_details: '',
            q5_appointments_count: 0,
            q5_scheduled_for_today_count: 0,
            q5_attended_count: 0,
            q5_no_show_count: 0,
            q5_rescheduled_count: 0,
            q5_cancelled_count: 0,
            q6_timeframe_options: [],
            q7_value_sold: 0,
            q7_value_received: 0,
            q8_post_sales_count: 0,
            q9_reactivations_count: 0,
            q10_day_rating: '',
            q10_explanation: '',
            ortho_starts: 0,
            objections: [],
            m_contacts_count: 0,
            m_responses_count: 0,
            m_future_appointments_count: 0,
            m_new_presential_appointments_count: 0,
            m_recurrent_leads_count: 0,
            m_recurrent_responses_count: 0,
            m_reactivation_leads_count: 0,
            m_reactivation_responses_count: 0,
            m_new_leads_count: 0,
            m_new_leads_responses_count: 0,
            t_contacts_count: 0,
            t_responses_count: 0,
            t_future_appointments_count: 0,
            t_new_presential_appointments_count: 0,
            t_recurrent_leads_count: 0,
            t_recurrent_responses_count: 0,
            t_reactivation_leads_count: 0,
            t_reactivation_responses_count: 0,
            t_new_leads_count: 0,
            t_new_leads_responses_count: 0,
            shift: 'Manhã'
        };

        let saved = null;
        try {
            saved = localStorage.getItem(`commercial_report_draft_${today}`);
        } catch (e) {
            console.warn("Could not read draft from localStorage in CommercialDailyReport.tsx:", e);
        }
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return { 
                    ...defaultState, 
                    ...parsed, 
                    objections: Array.isArray(parsed.objections) ? parsed.objections : [] 
                };
            } catch (e) {
                console.error("Error parsing draft:", e);
                return defaultState;
            }
        }
        return defaultState;
    });

    useEffect(() => {
        try {
            localStorage.setItem(`commercial_report_draft_${today}`, JSON.stringify(answers));
        } catch (e) {
            console.warn("Could not write draft to localStorage in CommercialDailyReport.tsx:", e);
        }
    }, [answers, today]);

    const loadGoals = async () => {
        try {
            const { data } = await supabase
                .from('commercial_settings')
                .select('value')
                .eq('key', 'daily_goals')
                .maybeSingle();
            
            if (data?.value) {
                setDailyGoals(data.value as DailyGoals);
            }
        } catch (err) {
            console.error('Error loading goals:', err);
        }
    };

    const saveGoals = async () => {
        setSaving(true);
        try {
            const { error } = await supabase
                .from('commercial_settings')
                .upsert({ key: 'daily_goals', value: dailyGoals }, { onConflict: 'key' });
            
            if (error) throw error;
            setMessage({ type: 'success', text: 'Metas atualizadas com sucesso!' });
            setShowSettings(false);
        } catch (err) {
            console.error('Error saving goals:', err);
            setMessage({ type: 'error', text: 'Erro ao salvar metas.' });
        } finally {
            setSaving(false);
        }
    };

    const loadReportForDate = async (date: string) => {
        setLoading(true);
        setMessage(null);
        try {
            // Load record from daily_performance with fallback to commercial_reports
            let data = null;
            let { data: perfData, error: perfError } = await supabase
                .from('daily_performance')
                .select('*')
                .eq('report_date', date)
                .maybeSingle();

            if (!perfError && perfData) {
                data = perfData;
            } else {
                const { data: commData, error: commError } = await supabase
                    .from('commercial_reports')
                    .select('*')
                    .eq('report_date', date)
                    .maybeSingle();
                if (commError && !commError.message?.includes('not found')) throw commError;
                data = commData;
            }

            if (data) {
                const { answers: parsedAnswers } = deserializePayload(data.main_challenges || '', data.opportunities || '');
                
                // Merge data from structured columns if available (priority to parsed JSON for completeness)
                const mergedAnswers = {
                    ...parsedAnswers,
                    objections: data.objections || parsedAnswers.objections || [],
                    q6_timeframe_options: data.appointments_by_time || parsedAnswers.q6_timeframe_options || []
                };

                // Keep backward compatibility in case they were stored without JSON
                setAnswers({
                    q1_arrival: mergedAnswers.q1_arrival || '',
                    q2_contacts_count: mergedAnswers.q2_contacts_count || data.leads_received || 0,
                    q2_rescue_contacts_count: mergedAnswers.q2_rescue_contacts_count || 0,
                    q2_positive_rescue_count: mergedAnswers.q2_positive_rescue_count || 0,
                    q3_positive_count: mergedAnswers.q3_positive_count || 0,
                    q4_positive_details: mergedAnswers.q4_positive_details || data.opportunities || '',
                    q5_appointments_count: mergedAnswers.q5_appointments_count || data.appointments_made || 0,
                    q5_scheduled_for_today_count: mergedAnswers.q5_scheduled_for_today_count || 0,
                    q5_attended_count: mergedAnswers.q5_attended_count || 0,
                    q5_no_show_count: mergedAnswers.q5_no_show_count || 0,
                    q5_rescheduled_count: mergedAnswers.q5_rescheduled_count || 0,
                    q5_cancelled_count: mergedAnswers.q5_cancelled_count || 0,
                    q6_timeframe_options: mergedAnswers.q6_timeframe_options || [],
                    q7_value_sold: mergedAnswers.q7_value_sold || Number(data.contracts_closed) || 0,
                    q7_value_received: mergedAnswers.q7_value_received || Number(data.budgets_presented) || 0,
                    q8_post_sales_count: mergedAnswers.q8_post_sales_count || 0,
                    q9_reactivations_count: mergedAnswers.q9_reactivations_count || 0,
                    q10_day_rating: mergedAnswers.q10_day_rating || '',
                    q10_explanation: mergedAnswers.q10_explanation || '',
                    ortho_starts: mergedAnswers.ortho_starts || data.ortho_starts || 0,
                    objections: mergedAnswers.objections || [],
                    m_contacts_count: mergedAnswers.m_contacts_count || 0,
                    m_responses_count: mergedAnswers.m_responses_count || 0,
                    m_future_appointments_count: mergedAnswers.m_future_appointments_count || 0,
                    m_new_presential_appointments_count: mergedAnswers.m_new_presential_appointments_count || 0,
                    m_recurrent_leads_count: mergedAnswers.m_recurrent_leads_count || 0,
                    m_recurrent_responses_count: mergedAnswers.m_recurrent_responses_count || 0,
                    m_reactivation_leads_count: mergedAnswers.m_reactivation_leads_count || 0,
                    m_reactivation_responses_count: mergedAnswers.m_reactivation_responses_count || 0,
                    m_new_leads_count: mergedAnswers.m_new_leads_count || 0,
                    m_new_leads_responses_count: mergedAnswers.m_new_leads_responses_count || 0,
                    t_contacts_count: mergedAnswers.t_contacts_count || 0,
                    t_responses_count: mergedAnswers.t_responses_count || 0,
                    t_future_appointments_count: mergedAnswers.t_future_appointments_count || 0,
                    t_new_presential_appointments_count: mergedAnswers.t_new_presential_appointments_count || 0,
                    t_recurrent_leads_count: mergedAnswers.t_recurrent_leads_count || 0,
                    t_recurrent_responses_count: mergedAnswers.t_recurrent_responses_count || 0,
                    t_reactivation_leads_count: mergedAnswers.t_reactivation_leads_count || 0,
                    t_reactivation_responses_count: mergedAnswers.t_reactivation_responses_count || 0,
                    t_new_leads_count: mergedAnswers.t_new_leads_count || 0,
                    t_new_leads_responses_count: mergedAnswers.t_new_leads_responses_count || 0
                });
            } else {
                // Reset form with today's defaults
                setAnswers({
                    q1_arrival: '',
                    q2_contacts_count: 0,
                    q2_rescue_contacts_count: 0,
                    q2_positive_rescue_count: 0,
                    q3_positive_count: 0,
                    q4_positive_details: '',
                    q5_appointments_count: 0,
                    q5_scheduled_for_today_count: 0,
                    q5_attended_count: 0,
                    q5_no_show_count: 0,
                    q5_rescheduled_count: 0,
                    q5_cancelled_count: 0,
                    q6_timeframe_options: [],
                    q7_value_sold: 0,
                    q7_value_received: 0,
                    q8_post_sales_count: 0,
                    q9_reactivations_count: 0,
                    q10_day_rating: '',
                    q10_explanation: '',
                    ortho_starts: 0,
                    objections: [],
                    m_contacts_count: 0,
                    m_responses_count: 0,
                    m_future_appointments_count: 0,
                    m_new_presential_appointments_count: 0,
                    m_recurrent_leads_count: 0,
                    m_recurrent_responses_count: 0,
                    m_reactivation_leads_count: 0,
                    m_reactivation_responses_count: 0,
                    m_new_leads_count: 0,
                    m_new_leads_responses_count: 0,
                    t_contacts_count: 0,
                    t_responses_count: 0,
                    t_future_appointments_count: 0,
                    t_new_presential_appointments_count: 0,
                    t_recurrent_leads_count: 0,
                    t_recurrent_responses_count: 0,
                    t_reactivation_leads_count: 0,
                    t_reactivation_responses_count: 0,
                    t_new_leads_count: 0,
                    t_new_leads_responses_count: 0
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
            // Load records from daily_performance with fallback to commercial_reports
            let { data } = await supabase
                .from('daily_performance')
                .select('*')
                .order('report_date', { ascending: false })
                .limit(90);

            if (!data || data.length === 0) {
                const { data: commData } = await supabase
                    .from('commercial_reports')
                    .select('*')
                    .order('report_date', { ascending: false })
                    .limit(90);
                data = commData;
            }

            setHistory(data || []);
        } catch (err) {
            console.error('Error loading history:', err);
        }
    };

    useEffect(() => {
        loadReportForDate(reportDate);
        loadGoals();
        loadHistory();
    }, [reportDate]);

    useRealtimeSubscription(['daily_performance', 'commercial_reports', 'commercial_daily_reports', 'daily_evaluations', 'monthly_goals', 'commercial_settings'], () => {
        loadReportForDate(reportDate);
        loadGoals();
        loadHistory();
    });

    // Automatically synchronize total contacts count and responses count based on questions 5, 6 and new leads
    useEffect(() => {
        setAnswers(prev => {
            const m_sum = (prev.m_recurrent_leads_count || 0) + (prev.m_reactivation_leads_count || 0) + (prev.m_new_leads_count || 0);
            const t_sum = (prev.t_recurrent_leads_count || 0) + (prev.t_reactivation_leads_count || 0) + (prev.t_new_leads_count || 0);
            
            const m_resp_sum = (prev.m_new_leads_responses_count || 0);
            const t_resp_sum = (prev.t_new_leads_responses_count || 0);

            if (
                prev.m_contacts_count !== m_sum || 
                prev.t_contacts_count !== t_sum ||
                prev.m_responses_count !== m_resp_sum ||
                prev.t_responses_count !== t_resp_sum
            ) {
                return {
                    ...prev,
                    m_contacts_count: m_sum,
                    t_contacts_count: t_sum,
                    m_responses_count: m_resp_sum,
                    t_responses_count: t_resp_sum
                };
            }
            return prev;
        });
    }, [
        answers.m_recurrent_leads_count,
        answers.m_reactivation_leads_count,
        answers.m_new_leads_count,
        answers.t_recurrent_leads_count,
        answers.t_reactivation_leads_count,
        answers.t_new_leads_count,
        answers.m_recurrent_responses_count,
        answers.m_reactivation_responses_count,
        answers.m_new_leads_responses_count,
        answers.t_recurrent_responses_count,
        answers.t_reactivation_responses_count,
        answers.t_new_leads_responses_count
    ]);

    // Parse and deserialize full commercial history list
    const parsedHistory = useMemo(() => {
        return history.map(report => {
            let parsed: any = {};
            let cleanedChallenges = report.main_challenges || '';
            
            if (report.raw_answers) {
                parsed = report.raw_answers;
            } else {
                const deserialized = deserializePayload(report.main_challenges || '', report.opportunities || '');
                parsed = deserialized.answers;
                cleanedChallenges = deserialized.cleanedChallenges;
            }

            return {
                ...report,
                answers: {
                    q1_arrival: parsed.q1_arrival || '',
                    q2_contacts_count: parsed.q2_contacts_count || report.leads_received || 0,
                    q2_rescue_contacts_count: parsed.q2_rescue_contacts_count || 0,
                    q2_positive_rescue_count: parsed.q2_positive_rescue_count || 0,
                    q3_positive_count: parsed.q3_positive_count || 0,
                    q4_positive_details: parsed.q4_positive_details || report.opportunities || '',
                    q5_appointments_count: parsed.q5_appointments_count || report.appointments_made || 0,
                    q5_scheduled_for_today_count: parsed.q5_scheduled_for_today_count || 0,
                    q5_attended_count: parsed.q5_attended_count || 0,
                    q5_no_show_count: parsed.q5_no_show_count || 0,
                    q5_rescheduled_count: parsed.q5_rescheduled_count || 0,
                    q5_cancelled_count: parsed.q5_cancelled_count || 0,
                    q6_timeframe_options: parsed.q6_timeframe_options || [],
                    q7_value_sold: parsed.q7_value_sold || Number(report.contracts_closed) || 0,
                    q7_value_received: parsed.q7_value_received || Number(report.budgets_presented) || 0,
                    q8_post_sales_count: parsed.q8_post_sales_count || 0,
                    q9_reactivations_count: parsed.q9_reactivations_count || 0,
                    q10_day_rating: parsed.q10_day_rating || '',
                    q10_explanation: parsed.q10_explanation || '',
                    ortho_starts: parsed.ortho_starts || report.ortho_starts || 0,
                    objections: parsed.objections || [],
                    m_contacts_count: parsed.m_contacts_count || 0,
                    m_responses_count: parsed.m_responses_count || 0,
                    m_future_appointments_count: parsed.m_future_appointments_count || 0,
                    m_new_presential_appointments_count: parsed.m_new_presential_appointments_count || 0,
                    m_recurrent_leads_count: parsed.m_recurrent_leads_count || 0,
                    m_recurrent_responses_count: parsed.m_recurrent_responses_count || 0,
                    m_reactivation_leads_count: parsed.m_reactivation_leads_count || 0,
                    m_reactivation_responses_count: parsed.m_reactivation_responses_count || 0,
                    m_new_leads_count: parsed.m_new_leads_count || 0,
                    m_new_leads_responses_count: parsed.m_new_leads_responses_count || 0,
                    t_contacts_count: parsed.t_contacts_count || 0,
                    t_responses_count: parsed.t_responses_count || 0,
                    t_future_appointments_count: parsed.t_future_appointments_count || 0,
                    t_new_presential_appointments_count: parsed.t_new_presential_appointments_count || 0,
                    t_recurrent_leads_count: parsed.t_recurrent_leads_count || 0,
                    t_recurrent_responses_count: parsed.t_recurrent_responses_count || 0,
                    t_reactivation_leads_count: parsed.t_reactivation_leads_count || 0,
                    t_reactivation_responses_count: parsed.t_reactivation_responses_count || 0,
                    t_new_leads_count: parsed.t_new_leads_count || 0,
                    t_new_leads_responses_count: parsed.t_new_leads_responses_count || 0
                },
                challengesText: cleanedChallenges
            };
        });
    }, [history]);



    const handleShareWhatsApp = () => {
        const totalContacts = Number(answers.m_contacts_count || 0) + Number(answers.t_contacts_count || 0);
        const totalResponses = Number(answers.m_new_leads_responses_count || 0) + Number(answers.m_recurrent_responses_count || 0) + Number(answers.t_new_leads_responses_count || 0) + Number(answers.t_recurrent_responses_count || 0);
        const totalFutureAppointments = Number(answers.m_future_appointments_count || 0) + Number(answers.t_future_appointments_count || 0);

        const text = `📊 *Relatório Diário Comercial - ${reportDate}*\n\n` +
            `• Contatos / Prospecções: ${totalContacts || answers.q2_contacts_count || 0}\n` +
            `• Respostas Positivas: ${totalResponses || answers.q3_positive_count || 0}\n` +
            `• Novos Agendamentos: ${totalFutureAppointments || answers.q5_appointments_count || 0}\n` +
            `• Comparecimentos (Hoje): ${answers.q5_attended_count || 0}\n` +
            `• Faltas / Ausências: ${answers.q5_no_show_count || 0}\n` +
            `• Inícios Ortodontia: ${answers.ortho_starts || 0}\n` +
            `• Valor Vendido: R$ ${(answers.q7_value_sold || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
            `• Valor Recebido: R$ ${(answers.q7_value_received || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
            (answers.q10_day_rating ? `• Avaliação do Dia: ${answers.q10_day_rating.toUpperCase()}\n` : '');

        navigator.clipboard.writeText(text);
        toast.success('Relatório comercial copiado e WhatsApp Web aberto!');
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        try {
            // Automatically calculate totals for compatibility and accurate dashboards/reporting
            const totalContacts = Number(answers.m_contacts_count || 0) + Number(answers.t_contacts_count || 0);
            const totalResponses = Number(answers.m_new_leads_responses_count || 0) + Number(answers.m_recurrent_responses_count || 0) + Number(answers.t_new_leads_responses_count || 0) + Number(answers.t_recurrent_responses_count || 0);
            const totalFutureAppointments = Number(answers.m_future_appointments_count || 0) + Number(answers.t_future_appointments_count || 0);

            const updatedAnswers = {
                ...answers,
                q2_contacts_count: totalContacts,
                q3_positive_count: totalResponses,
                q5_appointments_count: totalFutureAppointments,
            };

            // Format serialized JSON containing all responses inside main_challenges text column
            const serializedChallenges = `---COMMERCIAL_ANSWERS_START---\n${JSON.stringify(updatedAnswers)}\n---COMMERCIAL_ANSWERS_END---\n\n${updatedAnswers.q10_explanation}`;

            const fullPayload = {
                report_date: reportDate,
                user_id: currentUser?.id,
                leads_received: totalContacts,
                new_leads: (answers.m_new_leads_count || 0) + (answers.t_new_leads_count || 0),
                appointments_made: totalFutureAppointments,
                budgets_presented: Number(answers.q7_value_received),
                contracts_closed: Number(answers.q7_value_sold),
                objections: answers.objections || [],
                appointments_by_time: answers.q6_timeframe_options || [],
                main_challenges: serializedChallenges,
                opportunities: answers.q4_positive_details,
                raw_answers: updatedAnswers,
                updated_at: new Date().toISOString()
            };

            // Save to daily_performance (primary) and commercial_reports (backward compatibility sync)
            let primaryError = null;

            const { data: existingPerf } = await supabase
                .from('daily_performance')
                .select('id')
                .eq('report_date', reportDate)
                .maybeSingle();

            if (existingPerf) {
                const { error: updateErr } = await supabase
                    .from('daily_performance')
                    .update(fullPayload)
                    .eq('report_date', reportDate);
                primaryError = updateErr;
            } else {
                const { error: insertErr } = await supabase
                    .from('daily_performance')
                    .insert([fullPayload]);
                primaryError = insertErr;
            }

            // Sync with commercial_reports as fallback
            try {
                const { data: existingComm } = await supabase
                    .from('commercial_reports')
                    .select('id')
                    .eq('report_date', reportDate)
                    .maybeSingle();

                if (existingComm) {
                    await supabase.from('commercial_reports').update(fullPayload).eq('report_date', reportDate);
                } else {
                    await supabase.from('commercial_reports').insert([fullPayload]);
                }
            } catch (syncErr) {
                console.warn('Commercial reports sync notice:', syncErr);
            }

            if (primaryError) throw primaryError;

            setMessage({ type: 'success', text: 'Relatório diário comercial registrado com sucesso!' });
            loadHistory();
            notifyDataChange(['daily_performance', 'commercial_reports', 'commercial_daily_reports', 'daily_evaluations']);
        } catch (err: any) {
            console.error('Error saving report:', err);
            const errorMsg = err?.message || err?.details || 'Erro desconhecido';
            setMessage({ type: 'error', text: `Erro ao salvar o relatório comercial: ${errorMsg}` });
        } finally {
            setSaving(false);
        }
    };

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const handleDelete = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const { error: perfErr } = await supabase
                .from('daily_performance')
                .delete()
                .eq('report_date', reportDate);

            // Delete from commercial_reports as well
            try {
                await supabase.from('commercial_reports').delete().eq('report_date', reportDate);
            } catch (e) {}

            if (perfErr && !perfErr.message?.includes('not found')) throw perfErr;

            setMessage({ type: 'success', text: 'Relatório diário comercial excluído com sucesso!' });
            notifyDataChange(['daily_performance', 'commercial_reports', 'commercial_daily_reports', 'daily_evaluations']);
            
            // Reset form
            setAnswers({
                q1_arrival: '',
                q2_contacts_count: 0,
                q2_rescue_contacts_count: 0,
                q2_positive_rescue_count: 0,
                q3_positive_count: 0,
                q4_positive_details: '',
                q5_appointments_count: 0,
                q5_scheduled_for_today_count: 0,
                q5_attended_count: 0,
                q5_no_show_count: 0,
                q5_rescheduled_count: 0,
                q5_cancelled_count: 0,
                q6_timeframe_options: [],
                q7_value_sold: 0,
                q7_value_received: 0,
                q8_post_sales_count: 0,
                q9_reactivations_count: 0,
                q10_day_rating: '',
                q10_explanation: '',
                ortho_starts: 0,
                objections: [],
                m_contacts_count: 0,
                m_responses_count: 0,
                m_future_appointments_count: 0,
                m_new_presential_appointments_count: 0,
                m_recurrent_leads_count: 0,
                m_recurrent_responses_count: 0,
                m_reactivation_leads_count: 0,
                m_reactivation_responses_count: 0,
                m_new_leads_count: 0,
                m_new_leads_responses_count: 0,
                t_contacts_count: 0,
                t_responses_count: 0,
                t_future_appointments_count: 0,
                t_new_presential_appointments_count: 0,
                t_recurrent_leads_count: 0,
                t_recurrent_responses_count: 0,
                t_reactivation_leads_count: 0,
                t_reactivation_responses_count: 0,
                t_new_leads_count: 0,
                t_new_leads_responses_count: 0
            });

            loadHistory();
            setShowDeleteConfirm(false);
        } catch (err) {
            console.error('Error deleting report:', err);
            setMessage({ type: 'error', text: 'Erro ao excluir o relatório.' });
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
                link.download = `Relatorio_Comercial_${dateRange}_${new Date().toLocaleDateString('pt-BR')}.png`;
                link.href = dataUrl;
                link.click();
            } catch (err) {
                console.error('Error exporting image:', err);
            } finally {
                setExportingImage(false);
            }
        }, 300);
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    // FILTERED STATS AND GRAPHS CALCULATION
    const filteredReports = useMemo(() => {
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);

        return parsedHistory.filter(r => {
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
        }).sort((a,b) => a.report_date.localeCompare(b.report_date));
    }, [parsedHistory, dateRange, customStartDate, customEndDate]);

    // KPI Metrics compiler
    const kpiMetrics = useMemo(() => {
        let totalSold = 0;
        let totalReceived = 0;
        let totalContacts = 0;
        let totalPositives = 0;
        let totalAppointments = 0;
        let totalScheduled = 0;
        let totalAttended = 0;
        let totalNoShow = 0;
        let totalRescheduled = 0;
        let totalCancelled = 0;
        let totalPostSales = 0;
        let totalReactivations = 0;
        let totalOrthoStarts = 0;
        
        let mTotalContacts = 0;
        let mTotalResponses = 0;
        let mTotalAppointments = 0;
        
        let tTotalContacts = 0;
        let tTotalResponses = 0;
        let tTotalAppointments = 0;

        const objectionsList: string[] = [];
        const objectionsMap: Record<string, number> = {};
        
        const ratingsMap = { ruim: 0, regular: 0, bom: 0, otimo: 0 };
        const arrivalMap = { sim_pontual: 0, sim_atraso: 0, nao_pontual: 0, nao_atraso: 0 };

        let timeframeScoreSum = 0;
        let timeframeCount = 0;
        const timeframeOptionScores = {
            'Hoje': 0,
            'Dia Seguinte': 1,
            '2 dias': 2,
            '3 dias': 3,
            'Mais de 3 dias': 4,
            'Amanhã': 1,
            'Daqui a 2 dias': 2,
            'Daqui a 3 dias': 3
        };
        const timeframeCounts = {
            'Hoje': 0,
            'Dia Seguinte': 0,
            '2 dias': 0,
            '3 dias': 0,
            'Mais de 3 dias': 0
        };

        filteredReports.forEach(r => {
            const ans = r.answers;
            totalSold += ans.q7_value_sold || 0;
            totalReceived += ans.q7_value_received || 0;
            totalContacts += ans.q2_contacts_count || 0;
            totalPositives += ans.q3_positive_count || 0;
            totalAppointments += ans.q5_appointments_count || 0;
            totalScheduled += ans.q5_scheduled_for_today_count || 0;
            totalAttended += ans.q5_attended_count || 0;
            totalNoShow += ans.q5_no_show_count || 0;
            totalRescheduled += ans.q5_rescheduled_count || 0;
            totalCancelled += ans.q5_cancelled_count || 0;
            totalPostSales += ans.q8_post_sales_count || 0;
            totalReactivations += ans.q9_reactivations_count || 0;
            totalOrthoStarts += ans.ortho_starts || 0;
            
            mTotalContacts += ans.m_contacts_count || 0;
            mTotalResponses += ans.m_responses_count || 0;
            mTotalAppointments += (ans.m_future_appointments_count || 0) + (ans.m_new_presential_appointments_count || 0);

            tTotalContacts += ans.t_contacts_count || 0;
            tTotalResponses += ans.t_responses_count || 0;
            tTotalAppointments += (ans.t_future_appointments_count || 0) + (ans.t_new_presential_appointments_count || 0);

            if (ans.objections && Array.isArray(ans.objections)) {
                ans.objections.forEach(objection => {
                    const entry = `${objection.type}: ${objection.reason}`;
                    objectionsList.push(entry);
                    objectionsMap[entry] = (objectionsMap[entry] || 0) + 1;
                });
            }

            if (ans.q10_day_rating && ans.q10_day_rating in ratingsMap) {
                ratingsMap[ans.q10_day_rating as keyof typeof ratingsMap]++;
            }
            if (ans.q1_arrival && ans.q1_arrival in arrivalMap) {
                arrivalMap[ans.q1_arrival as keyof typeof arrivalMap]++;
            }

            if (ans.q6_timeframe_options && Array.isArray(ans.q6_timeframe_options)) {
                ans.q6_timeframe_options.forEach(opt => {
                    let mappedOpt = opt;
                    if (opt === 'Amanhã') mappedOpt = 'Dia Seguinte';
                    else if (opt === 'Daqui a 2 dias') mappedOpt = '2 dias';
                    else if (opt === 'Daqui a 3 dias') mappedOpt = '3 dias';

                    if (mappedOpt in timeframeCounts) {
                        timeframeCounts[mappedOpt as keyof typeof timeframeCounts]++;
                        timeframeCount++;
                        if (mappedOpt in timeframeOptionScores) {
                            timeframeScoreSum += timeframeOptionScores[mappedOpt as keyof typeof timeframeOptionScores];
                        }
                    }
                });
            }
        });

        const recPercent = totalSold > 0 ? (totalReceived / totalSold) * 100 : 0;
        const conversionContactToPositive = totalContacts > 0 ? (totalPositives / totalContacts) * 100 : 0;
        const conversionPositiveToAppointment = totalPositives > 0 ? (totalAppointments / totalPositives) * 100 : 0;

        const avgTimeframeDays = timeframeCount > 0 ? (timeframeScoreSum / timeframeCount) : 0;

        let mainTimeframe = 'Nenhum';
        let maxCount = -1;
        Object.entries(timeframeCounts).forEach(([opt, count]) => {
            if (count > maxCount && count > 0) {
                 maxCount = count;
                 mainTimeframe = opt;
            }
        });

        return {
            totalSold,
            totalReceived,
            recPercent,
            totalContacts,
            totalPositives,
            totalAppointments,
            totalScheduled,
            totalAttended,
            totalNoShow,
            totalRescheduled,
            totalCancelled,
            totalPostSales,
            totalReactivations,
            totalOrthoStarts,
            
            mTotalContacts,
            mTotalResponses,
            mTotalAppointments,
            tTotalContacts,
            tTotalResponses,
            tTotalAppointments,

            conversionContactToPositive,
            conversionPositiveToAppointment,
            ratingsMap,
            arrivalMap,
            avgTimeframeDays,
            mainTimeframe,
            timeframeCounts,
            objectionsList,
            objectionsMap,
            totalAgendaOutcomes: totalAttended + totalNoShow + totalRescheduled + totalCancelled || 1,
            attendanceRate: (totalAttended / (totalAttended + totalNoShow + totalRescheduled + totalCancelled || 1)) * 100,
            noShowRate: (totalNoShow / (totalAttended + totalNoShow + totalRescheduled + totalCancelled || 1)) * 100,
            rescheduledRate: (totalRescheduled / (totalAttended + totalNoShow + totalRescheduled + totalCancelled || 1)) * 100,
            cancelledRate: (totalCancelled / (totalAttended + totalNoShow + totalRescheduled + totalCancelled || 1)) * 100,
            avgContacts: filteredReports.length > 0 ? (totalContacts / filteredReports.length) : 0,
            avgSold: filteredReports.length > 0 ? (totalSold / filteredReports.length) : 0
        };
    }, [filteredReports]);

    // Graph visualizer data formatters
    const financialChartData = useMemo(() => {
        return filteredReports.map(r => ({
            date: parseSafeDate(r.report_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            Vendido: r.answers.q7_value_sold || 0,
            Recebido: r.answers.q7_value_received || 0
        }));
    }, [filteredReports]);

    const activityChartData = useMemo(() => {
        return filteredReports.map(r => ({
            date: parseSafeDate(r.report_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            Contatos: r.answers.q2_contacts_count || 0,
            Agendamentos: r.answers.q5_appointments_count || 0,
            Agenda: r.answers.q5_scheduled_for_today_count || 0,
            Compareceram: r.answers.q5_attended_count || 0,
            Faltaram: r.answers.q5_no_show_count || 0,
            OrtoInicios: r.answers.ortho_starts || 0,
            Remarcados: r.answers.q5_rescheduled_count || 0,
            Cancelados: r.answers.q5_cancelled_count || 0
        }));
    }, [filteredReports]);

    const funnelData = useMemo(() => {
        return [
            { name: 'Novos Contatos', value: kpiMetrics.totalContacts, color: '#3b82f6' },
            { name: 'Novos Agendados', value: kpiMetrics.totalAppointments, color: '#a855f7' },
            { name: 'Compareceram', value: kpiMetrics.totalAttended, color: '#10b981' },
            { name: 'Remarcados', value: kpiMetrics.totalRescheduled, color: '#f59e0b' },
            { name: 'Faltas No-Show', value: kpiMetrics.totalNoShow, color: '#94a3b8' },
            { name: 'Cancelados', value: kpiMetrics.totalCancelled, color: '#ef4444' }
        ];
    }, [kpiMetrics]);

    const objectionsChartData = useMemo(() => {
        return Object.entries(kpiMetrics.objectionsMap).map(([name, value]) => ({ name, value }));
    }, [kpiMetrics.objectionsMap]);

    const arrivalPieData = useMemo(() => {
        return [
            { name: 'Organizado e Pontual', value: kpiMetrics.arrivalMap.sim_pontual, color: '#10b981' },
            { name: 'Organizado, c/ Atraso', value: kpiMetrics.arrivalMap.sim_atraso, color: '#f59e0b' },
            { name: 'Desordenado, Pontual', value: kpiMetrics.arrivalMap.nao_pontual, color: '#f97316' },
            { name: 'Desordenado e Atrasado', value: kpiMetrics.arrivalMap.nao_atraso, color: '#ef4444' }
        ].filter(item => item.value > 0);
    }, [kpiMetrics]);

    const ratingPieData = useMemo(() => {
        return [
            { name: 'Ótimo', value: kpiMetrics.ratingsMap.otimo, color: '#10b981' },
            { name: 'Bom', value: kpiMetrics.ratingsMap.bom, color: '#6366f1' },
            { name: 'Mais ou Menos', value: kpiMetrics.ratingsMap.regular, color: '#f59e0b' },
            { name: 'Ruim', value: kpiMetrics.ratingsMap.ruim, color: '#ef4444' }
        ].filter(item => item.value > 0);
    }, [kpiMetrics]);

    return (
        <div className="flex flex-col gap-6 max-w-none w-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            {/* Header Area */}
            <div className="glass-panel p-6 rounded-3xl border border-border flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                     <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full text-[10px] font-bold uppercase tracking-wider mb-2 inline-block">
                         Relatório & KPIs
                     </span>
                     <h3 className="text-2xl font-black text-text flex items-center gap-2 tracking-tight">
                         <TrendingUp className="text-indigo-400 w-7 h-7" />
                         Relatório de Performance Comercial
                     </h3>
                     <p className="text-sm text-slate-400 mt-1">Acompanhamento das 10 diretrizes diárias comerciais e painel de análise comercial.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <button 
                         onClick={() => setShowSettings(!showSettings)}
                         className={`p-3 rounded-2xl border transition-all ${showSettings ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400' : 'bg-panel border-border text-slate-400 hover:text-text hover:bg-panel/80'}`}
                         title="Configurar Metas Diárias"
                    >
                         <Settings className={`w-5 h-5 ${showSettings ? 'animate-spin-slow' : ''}`} />
                    </button>
                    {activeTab === 'form' && (
                         <div className="flex items-center gap-2 bg-panel p-2 rounded-2xl border border-border">
                             <Calendar className="text-indigo-400 w-4 h-4 ml-1" />
                             <input 
                                 type="date" 
                                 value={reportDate}
                                 onChange={(e) => setReportDate(e.target.value)}
                                 className="bg-transparent border-none text-text text-xs outline-none cursor-pointer pr-3 font-semibold"
                             />
                         </div>
                    )}
                </div>
            </div>

            {/* Config Metas Panel */}
            {showSettings && (
                <div className="glass-panel p-6 rounded-3xl border border-indigo-500/20 bg-indigo-500/5 animate-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center gap-2 mb-4">
                        <Target className="text-indigo-400 w-5 h-5" />
                        <h4 className="text-sm font-bold text-text uppercase tracking-wider">Definição de Referências Diárias</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-semibold text-slate-400">Meta Diária de Contatos / Prospecções</label>
                            <input 
                                type="number" 
                                value={dailyGoals.leads}
                                onChange={(e) => setDailyGoals({...dailyGoals, leads: Number(e.target.value)})}
                                className="bg-panel border border-border rounded-xl px-4 py-3 text-text focus:border-indigo-500 outline-none text-sm font-bold"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-semibold text-slate-400">Meta Diária de Vendas / Contratos (R$)</label>
                            <input 
                                type="number" 
                                value={dailyGoals.contracts}
                                onChange={(e) => setDailyGoals({...dailyGoals, contracts: Number(e.target.value)})}
                                className="bg-panel border border-border rounded-xl px-4 py-3 text-text focus:border-indigo-500 outline-none text-sm font-bold"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end mt-4">
                        <button 
                            onClick={saveGoals}
                            className="px-5 py-2.5 glass-button glass-button-primary text-text rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
                        >
                            Salvar Configurações
                        </button>
                    </div>
                </div>
            )}

            {/* Notification messages */}
            {message && (
                <div className={`p-4 rounded-2xl border flex items-center gap-3 animate-in zoom-in duration-300 ${
                    message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
                }`}>
                    {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    <span className="text-sm font-semibold">{message.text}</span>
                </div>
            )}

            {/* Navigation Tabs (Report vs KPIs) */}
            <div className="flex bg-slate-900/60 p-1.5 rounded-2xl border border-border w-full md:w-fit self-center">
                <button 
                    onClick={() => setActiveTab('form')}
                    className={`flex-1 md:flex-initial px-6 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2.5 transition-all glass-button ${activeTab === 'form' ? 'bg-panel/80 text-text shadow-lg' : 'text-slate-500 opacity-60 hover:opacity-100'}`}
                >
                    <FileText className="w-4 h-4" />
                    Preencher Relatório Diário
                </button>
                <button 
                    onClick={() => {
                        setActiveTab('dashboard');
                        loadHistory();
                    }}
                    className={`flex-1 md:flex-initial px-6 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2.5 transition-all glass-button ${activeTab === 'dashboard' ? 'bg-panel/80 text-text shadow-lg' : 'text-slate-500 opacity-60 hover:opacity-100'}`}
                >
                    <BarChart3 className="w-4 h-4" />
                    Dashboard & Indicadores (BI)
                </button>
            </div>

            {/* PANEL CONTENT */}
            {activeTab === 'form' ? (
                /* SECTION 1: FORMULÁRIO COMAS 10 DIRETRIZES */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    
                    {/* Shift Selector */}
                    <div className="lg:col-span-12 flex gap-2 p-1 bg-panel rounded-xl border border-border shrink-0 w-fit mb-4">
                        {(['Manhã', 'Tarde'] as const).map(s => (
                            <button key={s} onClick={() => setAnswers({...answers, shift: s})} className={`px-4 py-2 rounded-lg text-[10px] font-bold transition-all glass-button ${answers.shift === s ? 'bg-panel/80 text-text shadow-lg' : 'text-slate-500 opacity-60 hover:opacity-100'}`}>
                                {s}
                            </button>
                        ))}
                    </div>

                    {/* Left Form: Q1 to q10 */}
                    <div className="lg:col-span-8 flex flex-col gap-6">
                        {loading ? (
                            <div className="glass-panel p-20 flex flex-col items-center justify-center text-slate-400">
                                <Activity className="w-10 h-10 animate-spin text-indigo-400 mb-4" />
                                <span className="text-sm font-semibold">Buscando dados do dia...</span>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-6">
                                
                                {/* CARD Q1: CHEGADA */}
                                <div className="glass-panel p-6 rounded-3xl border border-border space-y-4">
                                     <div className="flex items-center gap-2 border-b border-border pb-3">
                                          <div className="bg-indigo-500/10 p-2 rounded-xl text-indigo-400">
                                              <Clock className="w-4 h-4" />
                                          </div>
                                          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">1. Como você chegou na empresa hoje?</h4>
                                     </div>
                                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                                          {[
                                              { value: 'sim_pontual', label: 'Organizada e pontual ✅' },
                                              { value: 'sim_atraso', label: 'Organizada, mas com atraso ⏱️' },
                                              { value: 'nao_pontual', label: 'Desorganizada, mas pontual 🌀' },
                                              { value: 'nao_atraso', label: 'Desorganizada e atrasada ❌' }
                                          ].map((opt) => (
                                              <button
                                                  key={opt.value}
                                                  type="button"
                                                  onClick={() => setAnswers({...answers, q1_arrival: opt.value as any})}
                                                  className={`p-3.5 text-left rounded-xl text-xs font-bold border transition-all flex items-center justify-between ${
                                                      answers.q1_arrival === opt.value 
                                                          ? 'bg-indigo-600/20 border-indigo-500 text-text shadow-md' 
                                                          : 'bg-panel border-border text-slate-400 hover:text-text hover:border-border hover:bg-panel'
                                                  }`}
                                              >
                                                  <span>{opt.label}</span>
                                                  <div className={`w-3.1 h-3 flex items-center justify-center rounded-full border ${answers.q1_arrival === opt.value ? 'border-indigo-400 bg-indigo-500' : 'border-slate-600'}`}>
                                                      {answers.q1_arrival === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                                  </div>
                                              </button>
                                          ))}
                                     </div>
                                </div>

                                {/* BLOCKS FOR MORNING & AFTERNOON SPLIT */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* PERÍODO DA MANHÃ */}
                                    <div className="glass-panel p-6 rounded-3xl border border-border space-y-5">
                                        <div className="flex items-center gap-2 border-b border-border pb-3">
                                            <div className="bg-amber-500/10 p-2 rounded-xl text-amber-400">
                                                <Sun className="w-4 h-4" />
                                            </div>
                                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-300 font-sans">Período da Manhã ☀️</h4>
                                        </div>

                                        <div className="space-y-4">
                                            {/* Novos Leads */}
                                            <div className="space-y-3 bg-panel p-4 rounded-2xl border border-border">
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <label className="text-xs font-bold text-slate-300 font-sans">Quantos novos Leads entraram hoje?</label>
                                                        <div className="group relative inline-block">
                                                            <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-panel/80 hover:bg-white/20 text-slate-300 hover:text-text text-[10px] font-black cursor-help transition-colors select-none">?</span>
                                                            <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 p-2.5 bg-slate-950 border border-border text-slate-200 text-[11px] font-normal rounded-xl shadow-2xl transition-all duration-200 opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 origin-bottom z-50 leading-relaxed font-sans">
                                                                Quantidade de leads novos inseridos no período
                                                                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-950" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <input 
                                                        type="number"
                                                        min="0"
                                                        value={answers.m_new_leads_count || ''}
                                                        onChange={(e) => setAnswers({...answers, m_new_leads_count: Number(e.target.value)})}
                                                        className="bg-panel border border-border rounded-xl px-4 py-3 text-text focus:border-indigo-500 outline-none text-sm font-bold w-full font-mono"
                                                        placeholder="0"
                                                    />
                                                </div>
                                            </div>

                                            {/* Question Recurrent & Reactivation */}
                                            <div className="space-y-3 bg-panel p-4 rounded-2xl border border-border">
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <label className="text-xs font-bold text-slate-300 font-sans">Quantas mensagens de Acompanhamento Recorrente e Reativamento da Carteira?</label>
                                                        <div className="group relative inline-block">
                                                            <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-panel/80 hover:bg-white/20 text-slate-300 hover:text-text text-[10px] font-black cursor-help transition-colors select-none">?</span>
                                                            <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 p-2.5 bg-slate-950 border border-border text-slate-200 text-[11px] font-normal rounded-xl shadow-2xl transition-all duration-200 opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 origin-bottom z-50 leading-relaxed font-sans">
                                                                Das mensagens que você enviou, quantas eram de acompanhamento de pacientes/leads ativos no CRM ou reativação de leads perdidos
                                                                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-950" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <input 
                                                        type="number"
                                                        min="0"
                                                        value={answers.m_recurrent_leads_count || ''}
                                                        onChange={(e) => setAnswers({...answers, m_recurrent_leads_count: Number(e.target.value)})}
                                                        className="bg-panel border border-border rounded-xl px-4 py-3 text-text focus:border-indigo-500 outline-none text-sm font-bold w-full font-mono"
                                                        placeholder="0"
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-xs font-bold text-slate-400 font-sans pl-1">↳ Total de Respostas (Leads + Recorrentes)</label>
                                                    <input 
                                                        type="number"
                                                        min="0"
                                                        value={answers.m_new_leads_responses_count || ''}
                                                        onChange={(e) => setAnswers({...answers, m_new_leads_responses_count: Number(e.target.value), m_recurrent_responses_count: 0})}
                                                        className="bg-panel border border-border rounded-xl px-4 py-2.5 text-slate-200 focus:border-indigo-500 outline-none text-xs font-bold w-full font-mono"
                                                        placeholder="0"
                                                    />
                                                </div>
                                            </div>

                                            {/* Question 3 */}
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex items-center gap-1.5">
                                                    <label className="text-xs font-bold text-slate-300 font-sans">Quantos agendamentos Futuros?</label>
                                                    <div className="group relative inline-block">
                                                        <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-panel/80 hover:bg-white/20 text-slate-300 hover:text-text text-[10px] font-black cursor-help transition-colors select-none">?</span>
                                                        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 p-2.5 bg-slate-950 border border-border text-slate-200 text-[11px] font-normal rounded-xl shadow-2xl transition-all duration-200 opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 origin-bottom z-50 leading-relaxed font-sans">
                                                            Preencher com a quantidade de agendamentos realizados no período
                                                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-950" />
                                                        </div>
                                                    </div>
                                                </div>
                                                <input 
                                                    type="number"
                                                    min="0"
                                                    value={answers.m_future_appointments_count || ''}
                                                    onChange={(e) => setAnswers({...answers, m_future_appointments_count: Number(e.target.value)})}
                                                    className="bg-panel border border-border rounded-xl px-4 py-3 text-text focus:border-indigo-500 outline-none text-sm font-bold w-full font-mono"
                                                    placeholder="0"
                                                />
                                            </div>

                                            {/* Question 4 */}
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex items-center gap-1.5">
                                                    <label className="text-xs font-bold text-slate-300 font-sans">Quantos agendamentos presenciais novos?</label>
                                                    <div className="group relative inline-block">
                                                        <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-panel/80 hover:bg-white/20 text-slate-300 hover:text-text text-[10px] font-black cursor-help transition-colors select-none">?</span>
                                                        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 p-2.5 bg-slate-950 border border-border text-slate-200 text-[11px] font-normal rounded-xl shadow-2xl transition-all duration-200 opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 origin-bottom z-50 leading-relaxed font-sans">
                                                            Preencher com a quantidade de agendamentos de leads que compareceram diretamente na recepção
                                                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-950" />
                                                        </div>
                                                    </div>
                                                </div>
                                                <input 
                                                    type="number"
                                                    min="0"
                                                    value={answers.m_new_presential_appointments_count || ''}
                                                    onChange={(e) => setAnswers({...answers, m_new_presential_appointments_count: Number(e.target.value)})}
                                                    className="bg-panel border border-border rounded-xl px-4 py-3 text-text focus:border-indigo-500 outline-none text-sm font-bold w-full font-mono"
                                                    placeholder="0"
                                                />
                                            </div>

                                            {/* Question 1 (Calculated) */}
                                            <div className="flex flex-col gap-1.5 bg-indigo-500/5 p-4 rounded-2xl border border-indigo-500/10">
                                                <div className="flex items-center gap-1.5">
                                                    <label className="text-xs font-bold text-indigo-300 font-sans">Quantas pessoas você entrou em contato? (Calculado automaticamente)</label>
                                                    <div className="group relative inline-block">
                                                        <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 hover:text-text text-[10px] font-black cursor-help transition-colors select-none">?</span>
                                                        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 p-2.5 bg-slate-950 border border-border text-slate-200 text-[11px] font-normal rounded-xl shadow-2xl transition-all duration-200 opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 origin-bottom z-50 leading-relaxed font-sans">
                                                            Soma automática (Novos Leads + Acompanhamento Recorrente + Reativamento)
                                                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-950" />
                                                        </div>
                                                    </div>
                                                </div>
                                                <input 
                                                    type="number"
                                                    readOnly
                                                    disabled
                                                    value={answers.m_contacts_count || 0}
                                                    className="bg-panel border border-indigo-500/15 rounded-xl px-4 py-3 text-indigo-200 cursor-not-allowed outline-none text-sm font-bold w-full font-mono"
                                                    placeholder="0"
                                                />
                                            </div>

                                            {/* Question 2 (Calculated) */}
                                            <div className="flex flex-col gap-1.5 bg-indigo-500/5 p-4 rounded-2xl border border-indigo-500/10">
                                                <div className="flex items-center gap-1.5">
                                                    <label className="text-xs font-bold text-indigo-300 font-sans">Quantas responderam? (Calculado automaticamente)</label>
                                                    <div className="group relative inline-block">
                                                        <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 hover:text-text text-[10px] font-black cursor-help transition-colors select-none">?</span>
                                                        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 p-2.5 bg-slate-950 border border-border text-slate-200 text-[11px] font-normal rounded-xl shadow-2xl transition-all duration-200 opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 origin-bottom z-50 leading-relaxed font-sans">
                                                            Soma automática das respostas (Novos Leads + Acompanhamento Recorrente + Reativamento)
                                                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-950" />
                                                        </div>
                                                    </div>
                                                </div>
                                                <input 
                                                    type="number"
                                                    readOnly
                                                    disabled
                                                    value={answers.m_responses_count || 0}
                                                    className="bg-panel border border-indigo-500/15 rounded-xl px-4 py-3 text-indigo-200 cursor-not-allowed outline-none text-sm font-bold w-full font-mono"
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* PERÍODO DA TARDE */}
                                    <div className="glass-panel p-6 rounded-3xl border border-border space-y-5">
                                        <div className="flex items-center gap-2 border-b border-border pb-3">
                                            <div className="bg-indigo-500/10 p-2 rounded-xl text-indigo-400">
                                                <Sunset className="w-4 h-4" />
                                            </div>
                                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-300 font-sans">Período da Tarde 🌇</h4>
                                        </div>

                                        <div className="space-y-4">
                                            {/* Novos Leads */}
                                            <div className="space-y-3 bg-panel p-4 rounded-2xl border border-border">
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <label className="text-xs font-bold text-slate-300 font-sans">Quantos novos Leads entraram hoje?</label>
                                                        <div className="group relative inline-block">
                                                            <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-panel/80 hover:bg-white/20 text-slate-300 hover:text-text text-[10px] font-black cursor-help transition-colors select-none">?</span>
                                                            <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 p-2.5 bg-slate-950 border border-border text-slate-200 text-[11px] font-normal rounded-xl shadow-2xl transition-all duration-200 opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 origin-bottom z-50 leading-relaxed font-sans">
                                                                Quantidade de leads novos inseridos no período
                                                                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-950" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <input 
                                                        type="number"
                                                        min="0"
                                                        value={answers.t_new_leads_count || ''}
                                                        onChange={(e) => setAnswers({...answers, t_new_leads_count: Number(e.target.value)})}
                                                        className="bg-panel border border-border rounded-xl px-4 py-3 text-text focus:border-indigo-500 outline-none text-sm font-bold w-full font-mono"
                                                        placeholder="0"
                                                    />
                                                </div>
                                            </div>

                                            {/* Question Recurrent & Reactivation */}
                                            <div className="space-y-3 bg-panel p-4 rounded-2xl border border-border">
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <label className="text-xs font-bold text-slate-300 font-sans">Quantas mensagens de Acompanhamento Recorrente e Reativamento da Carteira?</label>
                                                        <div className="group relative inline-block">
                                                            <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-panel/80 hover:bg-white/20 text-slate-300 hover:text-text text-[10px] font-black cursor-help transition-colors select-none">?</span>
                                                            <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 p-2.5 bg-slate-950 border border-border text-slate-200 text-[11px] font-normal rounded-xl shadow-2xl transition-all duration-200 opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 origin-bottom z-50 leading-relaxed font-sans">
                                                                Das mensagens que você enviou, quantas eram de acompanhamento de pacientes/leads ativos no CRM ou reativação de leads perdidos
                                                                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-950" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <input 
                                                        type="number"
                                                        min="0"
                                                        value={answers.t_recurrent_leads_count || ''}
                                                        onChange={(e) => setAnswers({...answers, t_recurrent_leads_count: Number(e.target.value)})}
                                                        className="bg-panel border border-border rounded-xl px-4 py-3 text-text focus:border-indigo-500 outline-none text-sm font-bold w-full font-mono"
                                                        placeholder="0"
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-xs font-bold text-slate-400 font-sans pl-1">↳ Total de Respostas (Leads + Recorrentes)</label>
                                                    <input 
                                                        type="number"
                                                        min="0"
                                                        value={answers.t_new_leads_responses_count || ''}
                                                        onChange={(e) => setAnswers({...answers, t_new_leads_responses_count: Number(e.target.value), t_recurrent_responses_count: 0})}
                                                        className="bg-panel border border-border rounded-xl px-4 py-2.5 text-slate-200 focus:border-indigo-500 outline-none text-xs font-bold w-full font-mono"
                                                        placeholder="0"
                                                    />
                                                </div>
                                            </div>

                                            {/* Question 3 */}
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex items-center gap-1.5">
                                                    <label className="text-xs font-bold text-slate-300 font-sans">Quantos agendamentos Futuros?</label>
                                                    <div className="group relative inline-block">
                                                        <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-panel/80 hover:bg-white/20 text-slate-300 hover:text-text text-[10px] font-black cursor-help transition-colors select-none">?</span>
                                                        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 p-2.5 bg-slate-950 border border-border text-slate-200 text-[11px] font-normal rounded-xl shadow-2xl transition-all duration-200 opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 origin-bottom z-50 leading-relaxed font-sans">
                                                            Preencher com a quantidade de agendamentos realizados no período
                                                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-950" />
                                                        </div>
                                                    </div>
                                                </div>
                                                <input 
                                                    type="number"
                                                    min="0"
                                                    value={answers.t_future_appointments_count || ''}
                                                    onChange={(e) => setAnswers({...answers, t_future_appointments_count: Number(e.target.value)})}
                                                    className="bg-panel border border-border rounded-xl px-4 py-3 text-text focus:border-indigo-500 outline-none text-sm font-bold w-full font-mono"
                                                    placeholder="0"
                                                />
                                            </div>

                                            {/* Question 4 */}
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex items-center gap-1.5">
                                                    <label className="text-xs font-bold text-slate-300 font-sans">Quantos agendamentos presenciais novos?</label>
                                                    <div className="group relative inline-block">
                                                        <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-panel/80 hover:bg-white/20 text-slate-300 hover:text-text text-[10px] font-black cursor-help transition-colors select-none">?</span>
                                                        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 p-2.5 bg-slate-950 border border-border text-slate-200 text-[11px] font-normal rounded-xl shadow-2xl transition-all duration-200 opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 origin-bottom z-50 leading-relaxed font-sans">
                                                            Preencher com a quantidade de agendamentos de leads que compareceram diretamente na recepção
                                                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-950" />
                                                        </div>
                                                    </div>
                                                </div>
                                                <input 
                                                    type="number"
                                                    min="0"
                                                    value={answers.t_new_presential_appointments_count || ''}
                                                    onChange={(e) => setAnswers({...answers, t_new_presential_appointments_count: Number(e.target.value)})}
                                                    className="bg-panel border border-border rounded-xl px-4 py-3 text-text focus:border-indigo-500 outline-none text-sm font-bold w-full font-mono"
                                                    placeholder="0"
                                                />
                                            </div>

                                            {/* Question 1 (Calculated) */}
                                            <div className="flex flex-col gap-1.5 bg-indigo-500/5 p-4 rounded-2xl border border-indigo-500/10">
                                                <div className="flex items-center gap-1.5">
                                                    <label className="text-xs font-bold text-indigo-300 font-sans">Quantas pessoas você entrou em contato? (Calculado automaticamente)</label>
                                                    <div className="group relative inline-block">
                                                        <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 hover:text-text text-[10px] font-black cursor-help transition-colors select-none">?</span>
                                                        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 p-2.5 bg-slate-950 border border-border text-slate-200 text-[11px] font-normal rounded-xl shadow-2xl transition-all duration-200 opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 origin-bottom z-50 leading-relaxed font-sans">
                                                            Soma automática (Novos Leads + Acompanhamento Recorrente + Reativamento)
                                                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-950" />
                                                        </div>
                                                    </div>
                                                </div>
                                                <input 
                                                    type="number"
                                                    readOnly
                                                    disabled
                                                    value={answers.t_contacts_count || 0}
                                                    className="bg-panel border border-indigo-500/15 rounded-xl px-4 py-3 text-indigo-200 cursor-not-allowed outline-none text-sm font-bold w-full font-mono"
                                                    placeholder="0"
                                                />
                                            </div>

                                            {/* Question 2 (Calculated) */}
                                            <div className="flex flex-col gap-1.5 bg-indigo-500/5 p-4 rounded-2xl border border-indigo-500/10">
                                                <div className="flex items-center gap-1.5">
                                                    <label className="text-xs font-bold text-indigo-300 font-sans">Quantas responderam? (Calculado automaticamente)</label>
                                                    <div className="group relative inline-block">
                                                        <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 hover:text-text text-[10px] font-black cursor-help transition-colors select-none">?</span>
                                                        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 p-2.5 bg-slate-950 border border-border text-slate-200 text-[11px] font-normal rounded-xl shadow-2xl transition-all duration-200 opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 origin-bottom z-50 leading-relaxed font-sans">
                                                            Soma automática das respostas (Novos Leads + Acompanhamento Recorrente + Reativamento)
                                                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-950" />
                                                        </div>
                                                    </div>
                                                </div>
                                                <input 
                                                    type="number"
                                                    readOnly
                                                    disabled
                                                    value={answers.t_responses_count || 0}
                                                    className="bg-panel border border-indigo-500/15 rounded-xl px-4 py-3 text-indigo-200 cursor-not-allowed outline-none text-sm font-bold w-full font-mono"
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>



                                {/* CARD Q5: ACOMPANHAMENTO E RESULTADOS DA AGENDA */}
                                <div className="glass-panel p-6 rounded-3xl border border-border space-y-4">
                                     <div className="flex items-center gap-2 border-b border-border pb-3">
                                          <div className="bg-purple-500/10 p-2 rounded-xl text-purple-400">
                                              <Calendar className="w-4 h-4" />
                                          </div>
                                          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">2. Resultados e Controle da Agenda de Hoje</h4>
                                     </div>
                                     
                                     <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                          <div className="flex flex-col gap-1.5">
                                               <div className="flex items-center gap-1.5">
                                                   <label className="text-xs font-bold text-indigo-300 font-sans">Agendamentos na agenda para hoje</label>
                                                   <div className="group relative inline-block">
                                                       <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 hover:text-text text-[10px] font-black cursor-help transition-colors select-none">?</span>
                                                       <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 p-2.5 bg-slate-950 border border-indigo-500/10 text-slate-200 text-[11px] font-normal rounded-xl shadow-2xl transition-all duration-200 opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 origin-bottom z-50 leading-relaxed font-sans">
                                                           Total de pacientes que já tinham agenda agendada marcados para comparecer no dia de hoje.
                                                           <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-950" />
                                                       </div>
                                                   </div>
                                               </div>
                                               <input 
                                                   type="number"
                                                   min="0"
                                                   value={answers.q5_scheduled_for_today_count || ''}
                                                   onChange={(e) => setAnswers({...answers, q5_scheduled_for_today_count: Number(e.target.value)})}
                                                   className="bg-indigo-950/10 border border-indigo-500/20 hover:border-indigo-500/40 rounded-xl px-4 py-3 text-indigo-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none text-sm font-bold w-full font-mono transition-all"
                                                   placeholder="0"
                                               />
                                          </div>

                                          <div className="flex flex-col gap-1.5">
                                               <div className="flex items-center gap-1.5">
                                                   <label className="text-xs font-bold text-emerald-400 font-sans">Quantos compareceram?</label>
                                                   <div className="group relative inline-block">
                                                       <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 hover:text-text text-[10px] font-black cursor-help transition-colors select-none">?</span>
                                                       <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 p-2.5 bg-slate-950 border border-emerald-500/10 text-slate-200 text-[11px] font-normal rounded-xl shadow-2xl transition-all duration-200 opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 origin-bottom z-50 leading-relaxed font-sans">
                                                           Quantos pacientes agendados compareceram no dia de hoje.
                                                           <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-950" />
                                                       </div>
                                                   </div>
                                               </div>
                                               <input 
                                                   type="number"
                                                   min="0"
                                                   value={answers.q5_attended_count || ''}
                                                   onChange={(e) => setAnswers({...answers, q5_attended_count: Number(e.target.value)})}
                                                   className="bg-emerald-950/10 border border-emerald-500/20 hover:border-emerald-500/40 rounded-xl px-4 py-3 text-emerald-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none text-sm font-bold w-full font-mono transition-all"
                                                   placeholder="0"
                                               />
                                          </div>

                                          <div className="flex flex-col gap-1.5">
                                               <div className="flex items-center gap-1.5">
                                                   <label className="text-xs font-bold text-amber-400 font-sans">Quantos remarcaram?</label>
                                                   <div className="group relative inline-block">
                                                       <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 hover:text-text text-[10px] font-black cursor-help transition-colors select-none">?</span>
                                                       <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 p-2.5 bg-slate-950 border border-amber-500/10 text-slate-200 text-[11px] font-normal rounded-xl shadow-2xl transition-all duration-200 opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 origin-bottom z-50 leading-relaxed font-sans">
                                                           Pacientes agendados para hoje que solicitaram reagendamento/remarcação para outra data.
                                                           <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-950" />
                                                       </div>
                                                   </div>
                                               </div>
                                               <input 
                                                   type="number"
                                                   min="0"
                                                   value={answers.q5_rescheduled_count || ''}
                                                   onChange={(e) => setAnswers({...answers, q5_rescheduled_count: Number(e.target.value)})}
                                                   className="bg-amber-950/10 border border-amber-500/20 hover:border-amber-500/40 rounded-xl px-4 py-3 text-amber-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 outline-none text-sm font-bold w-full font-mono transition-all"
                                                   placeholder="0"
                                               />
                                          </div>

                                          <div className="flex flex-col gap-1.5">
                                               <div className="flex items-center gap-1.5">
                                                   <label className="text-xs font-bold text-slate-400 font-sans">Quantos não compareceram (Faltaram)?</label>
                                                   <div className="group relative inline-block">
                                                       <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-slate-500/10 hover:bg-slate-500/20 text-slate-400 hover:text-text text-[10px] font-black cursor-help transition-colors select-none">?</span>
                                                       <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 p-2.5 bg-slate-950 border border-slate-500/10 text-slate-200 text-[11px] font-normal rounded-xl shadow-2xl transition-all duration-200 opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 origin-bottom z-50 leading-relaxed font-sans">
                                                           Pacientes agendados para hoje que faltaram sem avisar (No-show).
                                                           <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-950" />
                                                       </div>
                                                   </div>
                                               </div>
                                               <input 
                                                   type="number"
                                                   min="0"
                                                   value={answers.q5_no_show_count || ''}
                                                   onChange={(e) => setAnswers({...answers, q5_no_show_count: Number(e.target.value)})}
                                                   className="bg-slate-900/20 border border-slate-500/20 hover:border-slate-500/40 rounded-xl px-4 py-3 text-slate-300 focus:border-slate-400 focus:ring-1 focus:ring-slate-400/20 outline-none text-sm font-bold w-full font-mono transition-all"
                                                   placeholder="0"
                                               />
                                          </div>

                                          <div className="flex flex-col gap-1.5 sm:col-span-2">
                                               <div className="flex items-center gap-1.5">
                                                   <label className="text-xs font-bold text-red-400 font-sans">Quantos cancelaram?</label>
                                                   <div className="group relative inline-block">
                                                       <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-300 hover:text-text text-[10px] font-black cursor-help transition-colors select-none">?</span>
                                                       <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 p-2.5 bg-slate-950 border border-red-500/10 text-slate-200 text-[11px] font-normal rounded-xl shadow-2xl transition-all duration-200 opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 origin-bottom z-50 leading-relaxed font-sans">
                                                           Pacientes agendados para hoje que cancelaram o agendamento em definitivo.
                                                           <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-950" />
                                                       </div>
                                                   </div>
                                               </div>
                                               <input 
                                                   type="number"
                                                   min="0"
                                                   value={answers.q5_cancelled_count || ''}
                                                   onChange={(e) => setAnswers({...answers, q5_cancelled_count: Number(e.target.value)})}
                                                   className="bg-red-950/10 border border-red-500/20 hover:border-red-500/40 rounded-xl px-4 py-3 text-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500/20 outline-none text-sm font-bold w-full font-mono transition-all"
                                                   placeholder="0"
                                               />
                                          </div>
                                     </div>

                                     {/* CARD Q6: HORIZONTE DE NOVOS AGENDAMENTOS */}
                                     <div className="border-t border-border pt-5 mt-5 space-y-4">
                                          <div className="flex items-center gap-1.5">
                                              <label className="text-xs font-bold text-slate-300 font-sans">
                                                  6. Para quando foram os novos agendamentos realizados hoje? (Marque todos que se aplicam)
                                              </label>
                                              <div className="group relative inline-block">
                                                  <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-panel/80 hover:bg-white/20 text-slate-300 hover:text-text text-[10px] font-black cursor-help transition-colors select-none">?</span>
                                                  <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 p-2.5 bg-slate-950 border border-border text-slate-200 text-[11px] font-normal rounded-xl shadow-2xl transition-all duration-200 opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 origin-bottom z-50 leading-relaxed font-sans">
                                                      Indique os horizontes de tempo para os quais você conseguiu agendar novos pacientes hoje.
                                                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-950" />
                                                  </div>
                                              </div>
                                          </div>
                                          
                                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                                              {[
                                                  { value: 'Hoje', label: 'Hoje 📅' },
                                                  { value: 'Dia Seguinte', label: 'Dia Seguinte 🌅' },
                                                  { value: '2 dias', label: '2 dias 🗓️' },
                                                  { value: '3 dias', label: '3 dias 🗓️' },
                                                  { value: 'Mais de 3 dias', label: 'Mais de 3 dias 🚀' }
                                              ].map((opt) => {
                                                  const isSelected = (answers.q6_timeframe_options || []).includes(opt.value);
                                                  return (
                                                      <button
                                                          key={opt.value}
                                                          type="button"
                                                          onClick={() => {
                                                              const current = answers.q6_timeframe_options || [];
                                                              const updated = current.includes(opt.value)
                                                                  ? current.filter(o => o !== opt.value)
                                                                  : [...current, opt.value];
                                                              setAnswers({ ...answers, q6_timeframe_options: updated });
                                                          }}
                                                          className={`py-3 px-3 rounded-xl text-xs font-bold border transition-all text-center flex flex-col items-center justify-center gap-1.5 ${
                                                              isSelected
                                                                  ? 'bg-purple-600/20 border-purple-500 text-purple-300 scale-[1.02] shadow-md'
                                                                  : 'bg-panel border-border text-slate-400 hover:text-text'
                                                          }`}
                                                      >
                                                          <span className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[9px] ${
                                                              isSelected ? 'bg-purple-500 border-purple-400 text-text font-black' : 'border-slate-500/30 bg-panel'
                                                          }`}>
                                                              {isSelected && '✓'}
                                                          </span>
                                                          <span>{opt.label}</span>
                                                      </button>
                                                  );
                                              })}
                                          </div>
                                     </div>
                                </div>



                                {/* CARD Q7: FINANCEIRO */}
                                <div className="glass-panel p-6 rounded-3xl border border-border space-y-4">
                                     <div className="flex items-center gap-2 border-b border-border pb-3">
                                          <div className="bg-amber-500/10 p-2 rounded-xl text-amber-400">
                                              <DollarSign className="w-4 h-4" />
                                          </div>
                                          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">3. Resultados Financeiros do Dia</h4>
                                     </div>
                                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                          <div className="flex flex-col gap-1.5">
                                               <label className="text-xs font-bold text-slate-400 font-mono">Valor vendido hoje (R$)</label>
                                               <div className="relative">
                                                   <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">R$</span>
                                                   <input 
                                                       type="number"
                                                       step="0.01"
                                                       value={answers.q7_value_sold || ''}
                                                       onChange={(e) => setAnswers({...answers, q7_value_sold: Number(e.target.value)})}
                                                       className="w-full bg-panel border border-border rounded-xl pl-10 pr-4 py-3 text-text focus:border-indigo-500 outline-none text-sm font-bold"
                                                       placeholder="0,00"
                                                   />
                                               </div>
                                          </div>
                                          <div className="flex flex-col gap-1.5">
                                               <label className="text-xs font-bold text-slate-400 font-mono">Valor recebido hoje (R$)</label>
                                               <div className="relative">
                                                   <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">R$</span>
                                                   <input 
                                                       type="number"
                                                       step="0.01"
                                                       value={answers.q7_value_received || ''}
                                                       onChange={(e) => setAnswers({...answers, q7_value_received: Number(e.target.value)})}
                                                       className="w-full bg-panel border border-border rounded-xl pl-10 pr-4 py-3 text-text focus:border-indigo-500 outline-none text-sm font-bold"
                                                       placeholder="0,00"
                                                   />
                                               </div>
                                          </div>
                                     </div>
                                </div>

                                {/* CARD Q10: COMO FOI O DIA/CLASSIFICAÇÃO */}
                                 {/* CARD: ORTODONTIA */}
                                 <div className="glass-panel p-6 rounded-3xl border border-border space-y-4">
                                      <div className="flex items-center gap-2 border-b border-border pb-3">
                                           <div className="bg-blue-500/10 p-2 rounded-xl text-blue-400">
                                               <Users className="w-4 h-4" />
                                           </div>
                                           <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">4. Ortodontia</h4>
                                      </div>
                                      <div className="grid grid-cols-1 gap-4">
                                           <div className="flex flex-col gap-1.5">
                                                <label className="text-xs font-bold text-slate-400 font-sans">Quantos pacientes de ortodontia iniciaram hoje?</label>
                                                <input 
                                                    type="number"
                                                    min="0"
                                                    value={answers.ortho_starts || ''}
                                                    onChange={(e) => setAnswers({...answers, ortho_starts: Number(e.target.value)})}
                                                    className="bg-panel border border-border rounded-xl px-4 py-3 text-text focus:border-indigo-500 outline-none text-sm font-bold w-full font-mono"
                                                    placeholder="0"
                                                />
                                           </div>
                                      </div>
                                 </div>

                                 {/* CARD Q10: COMO FOI O DIA/CLASSIFICACAO */}
                                 <div className="glass-panel p-6 rounded-3xl border border-border space-y-4">
                                      <div className="flex items-center gap-2 border-b border-border pb-3">
                                           <div className="bg-rose-500/10 p-2 rounded-xl text-rose-400">
                                               <Smile className="w-4 h-4" />
                                           </div>
                                           <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">5. Como foi o seu dia?</h4>
                                      </div>
                                     <div className="grid grid-cols-4 gap-2">
                                          {[
                                              { value: 'ruim', label: 'Ruim 🔴', color: 'hover:bg-red-500/5 active:bg-red-500/10' },
                                              { value: 'regular', label: 'Regular 🟡', color: 'hover:bg-amber-500/5 active:bg-amber-500/10' },
                                              { value: 'bom', label: 'Bom 🟢', color: 'hover:bg-indigo-500/5 active:bg-indigo-500/10' },
                                              { value: 'otimo', label: 'Ótimo 🌟', color: 'hover:bg-emerald-500/5 active:bg-emerald-500/10' }
                                          ].map((opt) => (
                                              <button
                                                  key={opt.value}
                                                  type="button"
                                                  onClick={() => setAnswers({...answers, q10_day_rating: opt.value as any})}
                                                  className={`py-3 rounded-xl text-xs font-bold border transition-all text-center flex flex-col items-center justify-center gap-1 ${
                                                      answers.q10_day_rating === opt.value 
                                                          ? 'bg-indigo-600/20 border-indigo-500 text-text font-black scale-102 shadow-md' 
                                                          : 'bg-panel border-border text-slate-400 hover:text-text'
                                                  }`}
                                              >
                                                  <span>{opt.label}</span>
                                              </button>
                                          ))}
                                     </div>
                                     <div className="flex flex-col gap-1.5 mt-2">
                                          <label className="text-xs font-bold text-slate-400">Explique por que classificou assim:</label>
                                          <textarea 
                                              value={answers.q10_explanation}
                                              onChange={(e) => setAnswers({...answers, q10_explanation: e.target.value})}
                                              placeholder="Detalhe os motivos principais, o humor da equipe, se houve cancelamento em massa, etc..."
                                              className="w-full bg-panel border border-border rounded-xl px-4 py-3 text-text focus:border-indigo-500 outline-none min-h-[100px] resize-none text-xs leading-relaxed"
                                          />
                                     </div>
                                </div>

                                {/* Save Button */}

                                 <div className="flex flex-col gap-3 mt-5 border-t border-border pt-5">
                                      <label className="text-xs font-bold text-slate-400">Objeções e Justificativas</label>
                                      {(answers.objections || []).map((objection, index) => (
                                          <div key={index} className="flex gap-2">
                                              <input
                                                  value={objection.type}
                                                  onChange={(e) => {
                                                      const newObjections = [...answers.objections];
                                                      newObjections[index].type = e.target.value;
                                                      setAnswers({...answers, objections: newObjections});
                                                  }}
                                                  placeholder="Objeção"
                                                  className="w-1/3 bg-panel border border-border rounded-lg px-2 py-1 text-text text-xs"
                                              />
                                              <input
                                                  value={objection.reason}
                                                  onChange={(e) => {
                                                      const newObjections = [...answers.objections];
                                                      newObjections[index].reason = e.target.value;
                                                      setAnswers({...answers, objections: newObjections});
                                                  }}
                                                  placeholder="Justificativa"
                                                  className="w-2/3 bg-panel border border-border rounded-lg px-2 py-1 text-text text-xs"
                                              />
                                              <button
                                                  onClick={() => {
                                                      const newObjections = answers.objections.filter((_, i) => i !== index);
                                                      setAnswers({...answers, objections: newObjections});
                                                  }}
                                                  className="text-red-400 hover:text-red-300"
                                              >
                                                  <Trash2 className="w-4 h-4" />
                                              </button>
                                          </div>
                                      ))}
                                      <button
                                          onClick={() => {
                                              setAnswers({...answers, objections: [...answers.objections, { type: '', reason: '' }]});
                                          }}
                                          className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-bold"
                                      >
                                          <Plus className="w-4 h-4" /> Adicionar Objeção
                                      </button>
                                 </div>

                                                                 {/* Save / Delete actions */}
                                 <div className="flex flex-col sm:flex-row gap-3 mt-2">
                                     <button 
                                          onClick={handleSave}
                                          disabled={saving || loading}
                                          className="flex-1 py-4.5 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-text rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-xl shadow-indigo-600/15 disabled:opacity-50 hover:shadow-indigo-600/25 text-sm"
                                     >
                                          {saving ? 'Gravando dados...' : (
                                               <>
                                                   <Save className="w-5 h-5 animate-pulse" />
                                                   Gravar Relatório
                                               </>
                                          )}
                                     </button>
                                     <button 
                                          type="button"
                                          onClick={handleShareWhatsApp}
                                          disabled={saving || loading}
                                          className="flex-1 py-4.5 bg-green-600/20 hover:bg-green-600/30 active:scale-[0.98] text-green-300 rounded-2xl font-bold flex items-center justify-center gap-2 border border-green-500/30 transition-all text-sm shadow-lg shadow-green-600/10"
                                     >
                                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                                          </svg>
                                          Compartilhar WhatsApp
                                     </button>


                                     {history.some(r => r.report_date && r.report_date.substring(0, 10) === reportDate.substring(0, 10)) && (
                                         <button 
                                              type="button"
                                              onClick={() => setShowDeleteConfirm(true)}
                                              disabled={saving || loading}
                                              className="py-4.5 px-6 bg-rose-500/11 hover:bg-rose-500/20 active:scale-[0.98] text-rose-400 hover:text-rose-300 rounded-2xl font-bold flex items-center justify-center gap-2 border border-rose-500/20 transition-all text-sm"
                                         >
                                              <Trash2 className="w-5 h-5" />
                                              Excluir
                                         </button>
                                     )}
                                 </div>

                            </div>
                        )}
                    </div>

                    {/* Right Side: Quick guidance, Checklist instructions and Recent logs */}
                    <div className="lg:col-span-4 space-y-6">
                        {/* Guideline card */}
                        <div className="glass-panel p-6 rounded-3xl border border-border space-y-4">
                             <div className="flex items-center gap-2 text-indigo-400">
                                 <Award className="w-5 h-5" />
                                 <h4 className="text-sm font-black uppercase tracking-wider">Comprometimento Diário</h4>
                             </div>
                             <p className="text-xs text-slate-300 leading-relaxed">
                                 O envio diário do Relatório Comercial é de extrema importância para analisar o progresso comercial da clínica, monitorar pós-vendas e planejar ações futuras.
                             </p>
                             <ul className="text-[10px] text-slate-400 space-y-2 list-none pl-0">
                                 <li className="flex gap-2">🟢 <span className="font-bold">Prospecção constante:</span> Contatar pelo menos toda a meta diária de leads.</li>
                                 <li className="flex gap-2">🔄 <span className="font-bold">Estreitar laços:</span> Manter pós-venda ativo com históricos recentes.</li>
                             </ul>
                         </div>

                        {/* Recent reports widget */}
                        <div className="glass-panel p-6 rounded-3xl border border-border space-y-4">
                             <div className="flex items-center justify-between border-b border-border pb-2">
                                 <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                     <History className="w-4 h-4 text-purple-400" />
                                     Histórico de Diárias
                                 </h4>
                                 <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider font-mono">Últimas 30</span>
                             </div>
                             <div className="space-y-3.5 max-h-[480px] overflow-y-auto pr-1 custom-scrollbar">
                                 {parsedHistory.length === 0 ? (
                                      <p className="text-xs text-slate-600 italic">Nenhum histórico recente criado.</p>
                                 ) : (
                                      parsedHistory.slice(0, 30).map((log) => {
                                          const ratingMap: Record<string, string> = {
                                              'ruim': '👎 Ruim',
                                              'regular': '😐 Regular',
                                              'bom': '👍 Bom',
                                              'otimo': '🌟 Ótimo'
                                          };
                                          return (
                                              <div 
                                                   key={log.id}
                                                   className="p-3 bg-panel border border-border rounded-xl hover:border-indigo-500/40 hover:bg-white/[0.02] transition-all cursor-pointer flex flex-col gap-2 group relative"
                                              >
                                                   <div className="flex justify-between items-center text-[10px]" onClick={() => setReportDate(log.report_date)}>
                                                       <span className="font-bold text-slate-300 group-hover:text-indigo-400 transition-colors">
                                                           {parseSafeDate(log.report_date).toLocaleDateString('pt-BR')}
                                                       </span>
                                                       <span className="font-bold text-[9px] text-indigo-400">
                                                           {ratingMap[log.answers.q10_day_rating] || 'Sem nota'}
                                                       </span>
                                                   </div>
                                                   <div className="grid grid-cols-2 gap-1 text-[10px]" onClick={() => setReportDate(log.report_date)}>
                                                       <div className="text-slate-500">Contatados: <span className="font-bold text-text">{log.answers.q2_contacts_count}</span></div>
                                                       <div className="text-teal-500">Agendados: <span className="font-bold text-text">{log.answers.q5_appointments_count}</span></div>
                                                       <div className="text-slate-500 text-right col-span-2">Venda: <span className="font-bold text-emerald-400">{formatCurrency(log.answers.q7_value_sold)}</span></div>
                                                       <div className="text-slate-500 text-right col-span-2">Recebido: <span className="font-bold text-emerald-400">{formatCurrency(log.answers.q7_value_received)}</span></div>
                                                    </div>
                                                    
                                                    {/* Always Visible Delete Shortcut */}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setReportDate(log.report_date);
                                                            setShowDeleteConfirm(true);
                                                        }}
                                                        className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 hover:text-rose-300 opacity-70 hover:opacity-100 transition-all border border-rose-500/10 flex items-center justify-center z-10"
                                                        title="Excluir relatório"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                              </div>
                                          );
                                      })
                                 )}
                             </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* SECTION 2: DASHBOARD & INDICADORES (BI & KPIS) */
                <div className="space-y-6">

                    {/* Range filters for custom period selection */}
                    <div className="flex flex-col md:flex-row md:items-center gap-4 bg-slate-900/40 p-4 rounded-3xl border border-border">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] text-slate-500 uppercase font-black mr-2">Filtrar Período:</span>
                            {[
                                { id: 'today', label: 'Hoje' },
                                { id: '7days', label: '7 Dias' },
                                { id: '15days', label: '15 Dias' },
                                { id: '30days', label: '30 Dias' },
                                { id: 'custom', label: 'Personalizado' }
                            ].map((range) => (
                                <button
                                    key={range.id}
                                    onClick={() => setDateRange(range.id as any)}
                                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${
                                        dateRange === range.id
                                            ? 'bg-indigo-600 border-indigo-500 text-text shadow-lg shadow-indigo-500/20'
                                            : 'bg-panel border-border text-slate-400 hover:text-slate-200'
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
                                        className="bg-panel border border-border rounded-lg px-3 py-1 text-[11px] text-text outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <span className="text-slate-600">a</span>
                                <div className="flex flex-col gap-1">
                                    <input
                                        type="date"
                                        value={customEndDate}
                                        onChange={(e) => setCustomEndDate(e.target.value)}
                                        className="bg-panel border border-border rounded-lg px-3 py-1 text-[11px] text-text outline-none focus:border-indigo-500"
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

                    {filteredReports.length === 0 ? (
                        <div className="glass-panel p-20 flex flex-col items-center justify-center text-slate-400">
                             <TrendingUp className="w-12 h-12 text-slate-600 mb-4 animate-bounce" />
                             <h4 className="text-base font-bold text-text mb-1">Nenhum dado registrado para este intervalo</h4>
                             <p className="text-xs text-slate-500 text-center max-w-sm leading-relaxed">
                                 Comece a preencher o relatório diário comercial selecionando datas recentes e salvando o questionário das 10 diretrizes diárias.
                             </p>
                        </div>
                    ) : (
                        <div id="dashboard-export-area" className={`space-y-6 ${exportingImage ? 'w-[1200px] max-w-[1200px] p-8 bg-surface rounded-[24px]' : ''}`}>
                            
                            {/* KPI Grid Header Cards */}
                            <div className={`grid gap-4 ${exportingImage ? 'grid-cols-4' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'}`}>
                                
                                {/* Card 1: Efetividade da Agenda (Mini Dashboard) */}
                                <div className={`glass-panel p-6 rounded-3xl border border-border hover:border-emerald-500/30 transition-all duration-300 flex flex-col justify-between group ${exportingImage ? 'col-span-2' : 'lg:col-span-2'}`}>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="text-[12px] text-emerald-400 uppercase font-black tracking-widest block mb-1 font-mono">Efetividade da Agenda</h3>
                                            <p className="text-[10px] text-slate-400 font-medium max-w-[280px] leading-relaxed mt-1">
                                                Monitora a retenção real da agenda: compara o volume de pacientes que compareceram (efetividade macro) contra as perdas (remarcações, faltas e cancelamentos).
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex flex-col items-end">
                                                <span className="text-[10px] font-black text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">{kpiMetrics.attendanceRate.toFixed(1)}%</span>
                                                <span className="text-[8px] text-slate-500 font-bold uppercase mt-0.5">Efetividade Macro</span>
                                            </div>
                                            <TrendingUp className="w-5 h-5 text-emerald-400" />
                                        </div>
                                    </div>
                                    
                                    <div className="mt-5">
                                        <div className="flex justify-between items-end mb-2">
                                            <div className="flex flex-col">
                                                <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-tight">Comparecimentos</span>
                                                <span className="text-sm font-black text-text">{kpiMetrics.attendanceRate.toFixed(1)}%</span>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Remarc. + Falt. + Cancel.</span>
                                                <span className="text-sm font-black text-text">{(kpiMetrics.rescheduledRate + kpiMetrics.noShowRate + kpiMetrics.cancelledRate).toFixed(1)}%</span>
                                            </div>
                                        </div>
                                        <div className="flex h-2 w-full rounded-full overflow-hidden bg-slate-800">
                                            <div style={{ width: `${kpiMetrics.attendanceRate}%` }} className="bg-emerald-400 h-full" title="Compareceram"></div>
                                            <div style={{ width: `${kpiMetrics.rescheduledRate}%` }} className="bg-amber-400 h-full" title="Remarcaram"></div>
                                            <div style={{ width: `${kpiMetrics.noShowRate}%` }} className="bg-rose-400 h-full" title="Faltaram"></div>
                                            <div style={{ width: `${kpiMetrics.cancelledRate}%` }} className="bg-slate-400 h-full" title="Cancelaram"></div>
                                        </div>
                                    </div>

                                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-x-2 gap-y-4">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] text-blue-400 font-bold uppercase tracking-tight mb-1">Novos Agend.</span>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-lg font-black text-blue-400">{kpiMetrics.totalAppointments}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-tight mb-1">Compareceram</span>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-lg font-black text-emerald-400">{kpiMetrics.totalAttended}</span>
                                                <span className="text-[10px] text-emerald-400/50 font-medium">{kpiMetrics.attendanceRate.toFixed(0)}%</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[9px] text-amber-400 font-bold uppercase tracking-tight mb-1">Remarcaram</span>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-lg font-black text-amber-400">{kpiMetrics.totalRescheduled}</span>
                                                <span className="text-[10px] text-amber-400/50 font-medium">{kpiMetrics.rescheduledRate.toFixed(0)}%</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[9px] text-rose-400 font-bold uppercase tracking-tight mb-1">Faltaram</span>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-lg font-black text-rose-400">{kpiMetrics.totalNoShow}</span>
                                                <span className="text-[10px] text-rose-400/50 font-medium">{kpiMetrics.noShowRate.toFixed(0)}%</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight mb-1">Cancelaram</span>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-lg font-black text-slate-400">{kpiMetrics.totalCancelled}</span>
                                                <span className="text-[10px] text-slate-400/50 font-medium">{kpiMetrics.cancelledRate.toFixed(0)}%</span>
                                            </div>
                                        </div>
                                        <div className="sm:col-span-2 flex flex-col justify-end pt-2">
                                            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                                                <span className="text-[10px] text-emerald-300 font-bold">
                                                    A cada 10 agendados, {((kpiMetrics.totalAttended / (kpiMetrics.totalScheduled || 1)) * 10).toFixed(2)} comparecem.
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Card 2: Performance Financeira */}
                                <div className={`glass-panel p-6 rounded-3xl border border-border hover:border-emerald-500/30 transition-all duration-300 flex flex-col justify-between group ${exportingImage ? 'col-span-2' : 'lg:col-span-2'}`}>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="text-[12px] text-emerald-400 uppercase font-black tracking-widest block mb-1 font-mono">Performance Financeira</h3>
                                            <p className="text-[10px] text-slate-400 font-medium max-w-[280px] leading-relaxed mt-1">
                                                Monitora o volume financeiro gerado, relacionando o total vendido em contratos com o valor que já foi recebido em caixa.
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex flex-col items-end">
                                                <span className="text-[10px] font-black text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">{kpiMetrics.recPercent.toFixed(1)}%</span>
                                                <span className="text-[8px] text-slate-500 font-bold uppercase mt-0.5">Tx. Recebimento</span>
                                            </div>
                                            <DollarSign className="w-5 h-5 text-emerald-400" />
                                        </div>
                                    </div>
                                    
                                    <div className="mt-5">
                                        <div className="flex justify-between items-end mb-2">
                                            <div className="flex flex-col">
                                                <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-tight">Valor Recebido</span>
                                                <span className="text-sm font-black text-text">{formatCurrency(kpiMetrics.totalReceived)}</span>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">A Receber</span>
                                                <span className="text-sm font-black text-text">{formatCurrency(Math.max(0, kpiMetrics.totalSold - kpiMetrics.totalReceived))}</span>
                                            </div>
                                        </div>
                                        <div className="flex h-2 w-full rounded-full overflow-hidden bg-slate-800">
                                            <div style={{ width: `${kpiMetrics.recPercent}%` }} className="bg-emerald-400 h-full" title="Recebido"></div>
                                            <div style={{ width: `${100 - kpiMetrics.recPercent}%` }} className="bg-slate-700 h-full" title="A Receber"></div>
                                        </div>
                                    </div>

                                    <div className="mt-4 grid grid-cols-2 gap-x-2 gap-y-4">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] text-blue-400 font-bold uppercase tracking-tight mb-1">Total Vendido</span>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-lg font-black text-blue-400">{formatCurrency(kpiMetrics.totalSold)}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-tight mb-1">Total Recebido</span>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-lg font-black text-emerald-400">{formatCurrency(kpiMetrics.totalReceived)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Card 3: Atividade de Leads */}
                                <div className="glass-panel p-6 rounded-3xl border border-border hover:border-slate-500/30 transition-all duration-300 flex flex-col justify-between group">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="text-[12px] text-slate-400 uppercase font-black tracking-widest block mb-1 font-mono">Atividade de Leads</h3>
                                            <p className="text-[10px] text-slate-400 font-medium max-w-[280px] leading-relaxed mt-1">
                                                Acompanha o número total de contatos com leads e negociações em andamento.
                                            </p>
                                        </div>
                                        <Users className="w-5 h-5 text-slate-400" />
                                    </div>
                                    <div className="mt-3">
                                        <h3 className="text-xl font-black text-text">{kpiMetrics.totalContacts} Contatos</h3>
                                    </div>
                                </div>

                                {/* Card 4: Ortodontia (Removido Conversão de Agenda Redundante) */}
                                 <div className="glass-panel p-6 rounded-3xl border border-border hover:border-blue-500/30 transition-all duration-300 flex flex-col justify-between group">
                                     <div className="flex justify-between items-start">
                                         <div>
                                             <h3 className="text-[12px] text-blue-400 uppercase font-black tracking-widest block mb-1 font-mono">Ortodontia</h3>
                                             <p className="text-[10px] text-blue-400/80 font-medium max-w-[280px] leading-relaxed mt-1">
                                                 Monitora o número de pacientes que iniciaram tratamento ortodôntico no mês.
                                             </p>
                                         </div>
                                         <Users className="w-5 h-5 text-blue-400" />
                                     </div>
                                     <div className="mt-3">
                                         <h3 className="text-xl font-black text-text">{kpiMetrics.totalOrthoStarts} Inícios</h3>
                                     </div>
                                 </div>

                                

                                {/* Card 5: Comparativo de Períodos */}
                                <div className={`glass-panel p-6 rounded-3xl border border-border hover:border-violet-500/30 transition-all duration-300 flex flex-col justify-between group ${exportingImage ? 'col-span-2' : 'lg:col-span-2'}`}>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="text-[12px] text-violet-400 uppercase font-black tracking-widest block mb-1 font-mono">Desempenho por Turno</h3>
                                            <p className="text-[10px] text-slate-400 font-medium max-w-[280px] leading-relaxed mt-1">
                                                Compara o engajamento e a conversão de agendamentos entre os períodos da Manhã e da Tarde.
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex flex-col items-end">
                                                <span className="text-[10px] font-black text-violet-400 bg-violet-400/10 px-2 py-0.5 rounded-full">
                                                    {kpiMetrics.mTotalAppointments > kpiMetrics.tTotalAppointments ? 'Manhã Vence' : kpiMetrics.tTotalAppointments > kpiMetrics.mTotalAppointments ? 'Tarde Vence' : 'Empate'}
                                                </span>
                                                <span className="text-[8px] text-slate-500 font-bold uppercase mt-0.5">Destaque</span>
                                            </div>
                                            <TrendingUp className="w-5 h-5 text-violet-400" />
                                        </div>
                                    </div>
                                    
                                    <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4">
                                        {/* Manhã */}
                                        <div className="flex flex-col p-3 rounded-2xl bg-panel border border-border">
                                            <span className="text-[10px] text-amber-400 font-bold uppercase tracking-tight mb-2 text-center border-b border-border pb-2">🌅 Manhã</span>
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[9px] text-slate-400 font-bold uppercase">Contatos</span>
                                                <span className="text-[11px] font-black text-text">{kpiMetrics.mTotalContacts}</span>
                                            </div>
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[9px] text-slate-400 font-bold uppercase">Respostas</span>
                                                <span className="text-[11px] font-black text-emerald-400">{kpiMetrics.mTotalResponses}</span>
                                            </div>
                                            <div className="flex justify-between items-center mt-2 pt-2 border-t border-border">
                                                <span className="text-[9px] text-violet-400 font-bold uppercase">Agendamentos</span>
                                                <span className="text-sm font-black text-violet-400">{kpiMetrics.mTotalAppointments}</span>
                                            </div>
                                        </div>
                                        
                                        {/* Tarde */}
                                        <div className="flex flex-col p-3 rounded-2xl bg-panel border border-border">
                                            <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-tight mb-2 text-center border-b border-border pb-2">🌇 Tarde</span>
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[9px] text-slate-400 font-bold uppercase">Contatos</span>
                                                <span className="text-[11px] font-black text-text">{kpiMetrics.tTotalContacts}</span>
                                            </div>
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[9px] text-slate-400 font-bold uppercase">Respostas</span>
                                                <span className="text-[11px] font-black text-emerald-400">{kpiMetrics.tTotalResponses}</span>
                                            </div>
                                            <div className="flex justify-between items-center mt-2 pt-2 border-t border-border">
                                                <span className="text-[9px] text-violet-400 font-bold uppercase">Agendamentos</span>
                                                <span className="text-sm font-black text-violet-400">{kpiMetrics.tTotalAppointments}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                 
                                 {/* Objections Panel */}
                                 {kpiMetrics.objectionsList.length > 0 && (
                                    <div className="glass-panel p-6 rounded-3xl border border-border col-span-1 lg:col-span-4">
                                        <h3 className="text-sm font-black text-text mb-4">Objeções e Justificativas</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {kpiMetrics.objectionsList.map((obj, i) => (
                                                obj.split(';').map((o, j) => {
                                                    const parts = o.split(',');
                                                    if (parts[0].trim() === '') return null;
                                                    return (
                                                        <div key={`${i}-${j}`} className="p-3 bg-panel border border-border rounded-xl text-xs flex flex-col gap-1">
                                                            <span className="font-bold text-rose-400">{parts[0].trim()}</span>
                                                            <span className="text-slate-400 italic">Justificativa: {parts[1] ? parts[1].trim() : 'sem justificativa'}</span>
                                                        </div>
                                                    );
                                                })
                                            ))}
                                        </div>
                                    </div>
                                 )}

                            </div>

                            {/* Main Charts Row */}
                            <div className={`grid gap-6 ${exportingImage ? 'grid-cols-2' : 'grid-cols-1 lg:grid-cols-2'}`}>
                                
                                {/* Chart 1: Conversão Comercial Funnel */}
                                <div className="glass-panel p-6 rounded-3xl border border-border space-y-4 flex flex-col justify-between">
                                     <div className="flex items-center justify-between border-b border-border pb-2">
                                          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                               <Users className="w-4 h-4 text-blue-400" />
                                               Comportamento & Funil de Conversão Comercial
                                          </h4>
                                     </div>
                                     <div className="h-[210px] w-full pt-2">
                                          <ResponsiveContainer width="100%" height="100%">
                                               <BarChart
                                                    data={funnelData}
                                                    layout="vertical"
                                                    margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                                               >
                                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" horizontal={false} />
                                                    <XAxis type="number" stroke="rgba(255,255,255,0.2)" fontSize={9} tickLine={false} />
                                                    <YAxis dataKey="name" type="category" stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} />
                                                    <Tooltip
                                                         contentStyle={{ background: 'rgba(15,23,42,0.95)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                                         labelStyle={{ color: '#fff', fontSize: '11px', fontWeight: 'bold' }}
                                                    />
                                                    <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={25}>
                                                         {funnelData.map((entry, index) => (
                                                              <Cell key={`cell-${index}`} fill={entry.color} />
                                                         ))}
                                                    </Bar>
                                               </BarChart>
                                          </ResponsiveContainer>
                                     </div>
                                     
                                     <div className={`grid gap-2 text-center ${exportingImage ? 'grid-cols-7' : 'grid-cols-2 sm:grid-cols-4 md:grid-cols-7'}`}>
                                             <div className="p-2 bg-slate-900/40 rounded-xl border border-border">
                                                  <span className="text-[8px] text-slate-500 uppercase font-black block">Novos Contatos</span>
                                                   <span className="text-xs font-bold text-blue-400">{kpiMetrics.totalContacts}</span>
                                              </div>
                                              <div className="p-2 bg-slate-900/40 rounded-xl border border-border">
                                                   <span className="text-[8px] text-slate-500 uppercase font-black block">Novos Agend.</span>
                                                   <span className="text-xs font-bold text-purple-400">{kpiMetrics.totalAppointments}</span>
                                              </div>
                                              <div className="p-2 bg-slate-900/40 rounded-xl border border-border">
                                                   <span className="text-[8px] text-slate-500 uppercase font-black block">Compareceram</span>
                                                   <span className="text-xs font-bold text-emerald-400">{kpiMetrics.totalAttended} ({((kpiMetrics.totalAttended / kpiMetrics.totalAgendaOutcomes) * 100).toFixed(1)}%)</span>
                                              </div>
                                             <div className="p-2 bg-slate-900/40 rounded-xl border border-border">
                                                  <span className="text-[8px] text-slate-500 uppercase font-black block">Remarcados</span>
                                                  <span className="text-xs font-bold text-amber-400">{kpiMetrics.totalRescheduled} ({((kpiMetrics.totalRescheduled / kpiMetrics.totalAgendaOutcomes) * 100).toFixed(1)}%)</span>
                                             </div>
                                             <div className="p-2 bg-slate-900/40 rounded-xl border border-border">
                                                  <span className="text-[8px] text-slate-500 uppercase font-black block">Faltaram</span>
                                                  <span className="text-xs font-bold text-slate-400">{kpiMetrics.totalNoShow} ({((kpiMetrics.totalNoShow / kpiMetrics.totalAgendaOutcomes) * 100).toFixed(1)}%)</span>
                                             </div>
                                             <div className="p-2 bg-slate-900/40 rounded-xl border border-border">
                                                  <span className="text-[8px] text-slate-550 uppercase font-black block">Cancelados</span>
                                                  <span className="text-xs font-bold text-red-400">{kpiMetrics.totalCancelled} ({((kpiMetrics.totalCancelled / kpiMetrics.totalAgendaOutcomes) * 100).toFixed(1)}%)</span>
                                             </div>
                                             <div className="p-2 bg-slate-900/40 rounded-xl border border-border">
                                                  <span className="text-[8px] text-slate-500 uppercase font-black block">Conv. Geral</span>
                                                  <span className="text-xs font-bold text-indigo-400">
                                                       {((kpiMetrics.totalAppointments / (kpiMetrics.totalContacts || 1)) * 100).toFixed(1)}%
                                                  </span>
                                             </div>
                                        </div>
                                       
                                       <div className="bg-slate-900/40 p-4 border border-border rounded-2xl flex flex-col gap-1.5 mt-2">
                                            <div className="flex justify-between items-center text-[11px] font-bold text-slate-400">
                                                 <span className="flex items-center gap-1.5">
                                                      <Activity className="w-3.5 h-3.5 text-blue-400" />
                                                      Conversão Geral de Leads
                                                 </span>
                                                 <span className="text-indigo-400">{((kpiMetrics.totalAppointments / (kpiMetrics.totalContacts || 1)) * 100).toFixed(1)}%</span>
                                            </div>
                                            <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">
                                                  Este funil ilustra a eficiência de conversão da equipe comercial: de {kpiMetrics.totalContacts} novos contatos realizados, {kpiMetrics.totalAppointments} agendamentos foram consolidados. Dos previstos para a agenda, {kpiMetrics.totalAttended} compareceram ({((kpiMetrics.totalAttended / kpiMetrics.totalAgendaOutcomes) * 100).toFixed(1)}%), {kpiMetrics.totalRescheduled} remarcaram ({((kpiMetrics.totalRescheduled / kpiMetrics.totalAgendaOutcomes) * 100).toFixed(1)}%) e {kpiMetrics.totalNoShow} faltaram / cancelaram ({((kpiMetrics.totalNoShow / kpiMetrics.totalAgendaOutcomes) * 100).toFixed(1)}% no-show).
                                             </p>
                                       </div>
                                   </div>

                                 {/* Chart 2: Evolução das Vendas e Recebimentos */}
                                <div className="glass-panel p-6 rounded-3xl border border-border space-y-4">
                                     <div className="flex items-center justify-between border-b border-border pb-2">
                                          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                               <LucideLineChart className="w-4 h-4 text-emerald-400" />
                                               Comportamento Financeiro (Evolução de Fluxo)
                                          </h4>
                                     </div>
                                     <div className="h-[380px] mt-4 w-full">
                                          <ResponsiveContainer width="100%" height="100%">
                                               <AreaChart data={financialChartData}>
                                                    <defs>
                                                         <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                                                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                                         </linearGradient>
                                                         <linearGradient id="colorReceived" x1="0" y1="0" x2="0" y2="1">
                                                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                                                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                                         </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                                    <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} />
                                                    <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} />
                                                    <Tooltip 
                                                         contentStyle={{ background: 'rgba(15,23,42,0.95)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                                         labelStyle={{ color: '#fff', fontSize: '11px', fontWeight: 'bold' }}
                                                         itemStyle={{ fontSize: '11px' }}
                                                    />
                                                    <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                                                    <Area name="Vendido (R$)" type="monotone" dataKey="Vendido" stroke="#10b981" fillOpacity={1} fill="url(#colorSales)" strokeWidth={2} />
                                                    <Area name="Recebido (R$)" type="monotone" dataKey="Recebido" stroke="#6366f1" fillOpacity={1} fill="url(#colorReceived)" strokeWidth={2} />
                                               </AreaChart>
                                          </ResponsiveContainer>
                                     </div>
                                </div>

                                 {/* Chart 3: Objeções Mais Comuns */}
                                 <div className="glass-panel p-6 rounded-3xl border border-border space-y-4">
                                      <div className="flex items-center justify-between border-b border-border pb-2">
                                           <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                                <AlertCircle className="w-4 h-4 text-red-400" />
                                                Objeções Mais Comuns
                                           </h4>
                                      </div>
                                      <div className="h-[300px] mt-4 w-full">
                                           <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={objectionsChartData} layout="vertical">
                                                     <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                                                     <XAxis type="number" stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} />
                                                     <YAxis dataKey="name" type="category" stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} width={100} />
                                                     <Tooltip 
                                                          contentStyle={{ background: "rgba(15,23,42,0.95)", borderColor: "rgba(255,255,255,0.1)", borderRadius: "12px" }}
                                                          labelStyle={{ color: "#fff", fontSize: "11px", fontWeight: "bold" }}
                                                          itemStyle={{ fontSize: "11px" }}
                                                     />
                                                     <Bar dataKey="value" fill="#ef4444" radius={[0, 6, 6, 0]} barSize={25}>
                                                         {objectionsChartData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={['#ef4444', '#f87171', '#fb923c'][index % 3]} />
                                                         ))}
                                                         <LabelList dataKey="value" position="right" fill="#fff" fontSize={10} fontWeight="bold" />
                                                     </Bar>
                                                </BarChart>
                                           </ResponsiveContainer>
                                      </div>
                                 </div>
                                {/* Row 2: Atividades Diárias vs Rating/Chegada */}
                                <div className="glass-panel p-6 rounded-3xl border border-border space-y-4">
                                     <div className={`flex justify-between border-b border-border pb-3 gap-3 ${exportingImage ? 'flex-row items-center' : 'flex-col sm:flex-row items-start sm:items-center'}`}>
                                          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                               <Activity className="w-4 h-4 text-purple-400" />
                                               Métricas de Atendimento e Comparecimento
                                          </h4>
                                          
                                          {/* Metric Visibility Toggles */}
                                          <div className="flex flex-wrap gap-2">
                                               {[
                                                    { id: 'Contatos', color: '#3b82f6', label: 'Contatos' },
                                                    { id: 'Resgates', color: '#60a5fa', label: 'Resgates' },
                                                    { id: 'Agendamentos', color: '#a855f7', label: 'Agendamentos' },
                                                    { id: 'Agenda', color: '#6366f1', label: 'Agenda' },
                                                    { id: 'Compareceram', color: '#10b981', label: 'Compareceram' },
                                                     { id: 'Faltaram', color: '#94a3b8', label: 'Faltas' },
                                                      { id: 'OrtoInicios', color: '#3b82f6', label: 'Orto' },
                                                      { id: 'Remarcados', color: '#f59e0b', label: 'Remarc' },
                                                     { id: 'Cancelados', color: '#ef4444', label: 'Cancelados' }
                                               ].map(metric => {
                                                    const isVisible = visibleActivityLines.includes(metric.id);
                                                    return (
                                                         <button 
                                                              key={metric.id}
                                                              onClick={() => {
                                                                   setVisibleActivityLines(prev => 
                                                                        isVisible ? prev.filter(id => id !== metric.id) : [...prev, metric.id]
                                                                   );
                                                              }}
                                                              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-tight transition-all border ${
                                                                   isVisible 
                                                                        ? 'bg-panel border-border text-text shadow-sm' 
                                                                        : 'bg-panel border-border text-slate-500 opacity-60'
                                                              }`}
                                                         >
                                                              <div className="size-1.5 rounded-full" style={{ backgroundColor: isVisible ? metric.color : 'transparent', border: isVisible ? 'none' : '1px solid #475569' }} />
                                                              {metric.label}
                                                              {isVisible ? <Eye className="w-2.5 h-2.5 ml-0.5" /> : <EyeOff className="w-2.5 h-2.5 ml-0.5" />}
                                                         </button>
                                                    );
                                               })}
                                          </div>
                                     </div>
                                     <div className="h-[380px] mt-4 w-full">
                                          <ResponsiveContainer width="100%" height="100%">
                                               <LineChart data={activityChartData}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                                    <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} />
                                                    <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} />
                                                    <Tooltip
                                                         contentStyle={{ background: 'rgba(15,23,42,0.95)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                                         labelStyle={{ color: '#fff', fontSize: '11px', fontWeight: 'bold' }}
                                                         itemStyle={{ fontSize: '11px' }}
                                                    />
                                                    <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                                                    {visibleActivityLines.includes('Contatos') && <Line name="Contatos" type="monotone" dataKey="Contatos" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3 }} />}
                                                    {visibleActivityLines.includes('Resgates') && <Line name="Contatos Resgate" type="monotone" dataKey="Resgates" stroke="#60a5fa" strokeWidth={2.5} dot={{ r: 3 }} />}
                                                    {visibleActivityLines.includes('Agendamentos') && <Line name="Novos Agendados" type="monotone" dataKey="Agendamentos" stroke="#a855f7" strokeWidth={2.5} dot={{ r: 3 }} />}
                                                    {visibleActivityLines.includes('Agenda') && <Line name="Agenda p/ Hoje" type="monotone" dataKey="Agenda" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3 }} />}
                                                    {visibleActivityLines.includes('Compareceram') && <Line name="Compareceram" type="monotone" dataKey="Compareceram" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />}
                                                    {visibleActivityLines.includes('OrtoInicios') && <Line name="Orto Inícios" type="monotone" dataKey="OrtoInicios" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3 }} />}
                                                    {visibleActivityLines.includes('Faltaram') && <Line name="Faltaram" type="monotone" dataKey="Faltaram" stroke="#94a3b8" strokeWidth={2.5} dot={{ r: 3 }} />}
                                                    {visibleActivityLines.includes('Remarcados') && <Line name="Remarcados" type="monotone" dataKey="Remarcados" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} />}
                                                    {visibleActivityLines.includes('Cancelados') && <Line name="Cancelados" type="monotone" dataKey="Cancelados" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3 }} />}
                                               </LineChart>
                                          </ResponsiveContainer>
                                     </div>
                                </div>
                            </div>
                                {/* Row 4: Distribuição de Avaliações & Pontualidade */}
                                 <div className={`grid gap-6 ${exportingImage ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-2'}`}>
                                      
                                      {/* Card Clima Diário */}
                                      <div className={`glass-panel p-6 rounded-3xl border border-border flex items-center gap-6 justify-between animate-fade-in ${exportingImage ? 'flex-row' : 'flex-col md:flex-row'}`}>
                                           <div className="space-y-4 flex-1 w-full">
                                                <div>
                                                     <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 border-b border-border pb-2">
                                                          <Smile className="w-4 h-4 text-yellow-400" />
                                                          Classificação do Clima Diário
                                                     </h4>
                                                     <p className="text-[10px] text-slate-500 mt-1 leading-relaxed font-semibold">Avaliação de clima e resultados.</p>
                                                </div>
                                                {(() => {
                                                     const totalRatings = kpiMetrics.ratingsMap.otimo + kpiMetrics.ratingsMap.bom + kpiMetrics.ratingsMap.regular + kpiMetrics.ratingsMap.ruim;
                                                     const pct = (val: number) => totalRatings > 0 ? ((val / totalRatings) * 100).toFixed(0) : '0';
                                                     return (
                                                          <div className="space-y-1.5 text-[11px] font-bold">
                                                               <div className="flex items-center gap-2 justify-between">
                                                                    <span className="text-emerald-400 font-bold">🌟 Ótimo:</span>
                                                                    <span className="text-text font-bold">{kpiMetrics.ratingsMap.otimo} dias <span className="text-emerald-400/80 font-mono font-medium">({pct(kpiMetrics.ratingsMap.otimo)}%)</span></span>
                                                               </div>
                                                               <div className="flex items-center gap-2 justify-between">
                                                                    <span className="text-indigo-400 font-bold">🟢 Bom:</span>
                                                                    <span className="text-text font-bold">{kpiMetrics.ratingsMap.bom} dias <span className="text-indigo-400/85 font-mono font-medium">({pct(kpiMetrics.ratingsMap.bom)}%)</span></span>
                                                               </div>
                                                               <div className="flex items-center gap-2 justify-between">
                                                                    <span className="text-amber-400 font-bold">🟡 Regular:</span>
                                                                    <span className="text-text font-bold">{kpiMetrics.ratingsMap.regular} dias <span className="text-amber-400/85 font-mono font-medium">({pct(kpiMetrics.ratingsMap.regular)}%)</span></span>
                                                               </div>
                                                               <div className="flex items-center gap-2 justify-between">
                                                                    <span className="text-rose-400 font-bold">🔴 Ruim:</span>
                                                                    <span className="text-text font-bold">{kpiMetrics.ratingsMap.ruim} dias <span className="text-rose-400/85 font-mono font-medium">({pct(kpiMetrics.ratingsMap.ruim)}%)</span></span>
                                                               </div>
                                                          </div>
                                                     );
                                                })()}
                                           </div>
                                           <div className="h-44 w-44 flex items-center justify-center shrink-0">
                                                {ratingPieData.length === 0 ? (
                                                     <span className="text-[10px] text-slate-500 italic font-bold">Sem dados climáticos</span>
                                                ) : (
                                                     <ResponsiveContainer width="100%" height="100%">
                                                          <PieChart>
                                                               <Pie
                                                                    data={ratingPieData}
                                                                    cx="50%"
                                                                    cy="50%"
                                                                    innerRadius={45}
                                                                    outerRadius={65}
                                                                    paddingAngle={3}
                                                                    dataKey="value"
                                                               >
                                                                    {ratingPieData.map((entry, index) => (
                                                                         <Cell key={`cell-rating-${index}`} fill={entry.color} />
                                                                    ))}
                                                               </Pie>
                                                               <Tooltip />
                                                          </PieChart>
                                                     </ResponsiveContainer>
                                                )}
                                           </div>
                                      </div>

                                      {/* Card Organização & Pontualidade */}
                                      <div className={`glass-panel p-6 rounded-3xl border border-border flex items-center gap-6 justify-between animate-fade-in ${exportingImage ? 'flex-row' : 'flex-col md:flex-row'}`}>
                                           <div className="space-y-4 flex-1 w-full">
                                                <div>
                                                     <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 border-b border-border pb-2">
                                                          <Clock className="w-4 h-4 text-violet-400" />
                                                          Organização & Pontualidade
                                                     </h4>
                                                     <p className="text-[10px] text-slate-500 mt-1 leading-relaxed font-semibold">Postura no início da jornada.</p>
                                                </div>
                                                {(() => {
                                                     const totalArrivals = kpiMetrics.arrivalMap.sim_pontual + kpiMetrics.arrivalMap.sim_atraso + kpiMetrics.arrivalMap.nao_pontual + kpiMetrics.arrivalMap.nao_atraso;
                                                     const pct = (val: number) => totalArrivals > 0 ? ((val / totalArrivals) * 100).toFixed(0) : '0';
                                                     return (
                                                          <div className="space-y-1.5 text-[11px] font-bold">
                                                               <div className="flex items-center gap-2 justify-between">
                                                                    <span className="text-emerald-400 font-bold font-semibold">✅ Sim, pontual:</span>
                                                                    <span className="text-text font-bold">{kpiMetrics.arrivalMap.sim_pontual} dias <span className="text-emerald-400/80 font-mono font-medium">({pct(kpiMetrics.arrivalMap.sim_pontual)}%)</span></span>
                                                               </div>
                                                               <div className="flex items-center gap-2 justify-between">
                                                                    <span className="text-amber-400 font-bold font-semibold">⏱️ Pontual c/ atraso:</span>
                                                                    <span className="text-text font-bold">{kpiMetrics.arrivalMap.sim_atraso} dias <span className="text-amber-400/80 font-mono font-medium">({pct(kpiMetrics.arrivalMap.sim_atraso)}%)</span></span>
                                                               </div>
                                                               <div className="flex items-center gap-2 justify-between">
                                                                    <span className="text-orange-400 font-bold font-semibold">🌀 Desordenada pontual:</span>
                                                                    <span className="text-text font-bold">{kpiMetrics.arrivalMap.nao_pontual} dias <span className="text-orange-400/80 font-mono font-medium">({pct(kpiMetrics.arrivalMap.nao_pontual)}%)</span></span>
                                                               </div>
                                                               <div className="flex items-center gap-2 justify-between">
                                                                    <span className="text-rose-400 font-bold font-semibold">❌ Desordenada atrasada:</span>
                                                                    <span className="text-text font-bold">{kpiMetrics.arrivalMap.nao_atraso} dias <span className="text-rose-400/80 font-mono font-medium">({pct(kpiMetrics.arrivalMap.nao_atraso)}%)</span></span>
                                                               </div>
                                                          </div>
                                                     );
                                                })()}
                                           </div>
                                           <div className="h-44 w-44 flex items-center justify-center shrink-0">
                                                {arrivalPieData.length === 0 ? (
                                                     <span className="text-[10px] text-slate-500 italic font-bold">Sem dados logísticos</span>
                                                ) : (
                                                     <ResponsiveContainer width="100%" height="100%">
                                                          <PieChart>
                                                               <Pie
                                                                    data={arrivalPieData}
                                                                    cx="50%"
                                                                    cy="50%"
                                                                    innerRadius={45}
                                                                    outerRadius={65}
                                                                    paddingAngle={3}
                                                                    dataKey="value"
                                                               >
                                                                    {arrivalPieData.map((entry, index) => (
                                                                         <Cell key={`cell-arrival-${index}`} fill={entry.color} />
                                                                    ))}
                                                               </Pie>
                                                               <Tooltip />
                                                          </PieChart>
                                                     </ResponsiveContainer>
                                                )}
                                           </div>
                                      </div>

                                 </div>
                                 

                            {/* Row 3: Histórico de Diárias e Feedbacks Qualitativos */}
                            <div className={`grid gap-6 ${exportingImage ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-12'}`}>
                                
                                {/* Box 1: Histórico das Diárias Preenchidas no Período */}
                                <div className={`glass-panel p-6 rounded-3xl border border-border space-y-4 flex flex-col ${exportingImage ? 'h-auto' : 'lg:col-span-8 h-[400px]'}`}>
                                     <div className="flex items-center justify-between border-b border-border pb-2">
                                          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                               <History className="w-4 h-4 text-indigo-400" />
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
                                                     <th className="py-2 px-3 text-center">Clima</th>
                                                     <th className="py-2 px-3 text-right">Contatos</th>
                                                     <th className="py-2 px-3 text-right">Agendamentos</th>
                                                     <th className="py-2 px-3 text-right">Compareceram</th>
                                                     <th className="py-2 px-3 text-right">Vendido</th>
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
                                                         const ratingMap: Record<string, string> = {
                                                             'ruim': '👎 Ruim',
                                                             'regular': '😐 Regular',
                                                             'bom': '👍 Bom',
                                                             'otimo': '🌟 Ótimo'
                                                         };
                                                         const ratingColor: Record<string, string> = {
                                                             ruim: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
                                                             regular: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
                                                             bom: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
                                                             otimo: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                                                         };
                                                         return (
                                                             <tr key={report.id} className="hover:bg-white/[0.02] transition-colors">
                                                                 <td className="py-2.5 px-3 font-bold text-slate-300 font-mono">
                                                                     {parseSafeDate(report.report_date).toLocaleDateString('pt-BR')}
                                                                 </td>
                                                                 <td className="py-2.5 px-3 text-center">
                                                                     <span className={`inline-block text-[9px] px-2 py-0.5 rounded-full border font-bold capitalize ${ratingColor[report.answers.q10_day_rating] || 'border-slate-500 text-slate-400'}`}>
                                                                         {ratingMap[report.answers.q10_day_rating] || 'Sem nota'}
                                                                     </span>
                                                                 </td>
                                                                 <td className="py-2.5 px-3 text-right font-mono text-slate-300 font-semibold">
                                                                     {report.answers.q2_contacts_count}
                                                                 </td>
                                                                 <td className="py-2.5 px-3 text-right font-mono text-slate-300 font-semibold">
                                                                     {report.answers.q5_appointments_count}
                                                                 </td>
                                                                 <td className="py-2.5 px-3 text-right font-mono text-slate-300 font-semibold">
                                                                     {report.answers.q5_attended_count}
                                                                 </td>
                                                                 <td className="py-2.5 px-3 text-right font-mono text-emerald-400 font-bold">
                                                                     {formatCurrency(report.answers.q7_value_sold)}
                                                                 </td>
                                                                 <td className="py-2.5 px-3">
                                                                     <div className="flex items-center justify-center gap-2">
                                                                         <button
                                                                             type="button"
                                                                             onClick={() => {
                                                                                 setReportDate(report.report_date);
                                                                                 setActiveTab('form');
                                                                             }}
                                                                             title="Visualizar/Editar"
                                                                             className="p-1 text-slate-400 hover:text-indigo-400 transition-colors"
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
                                                                             className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
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

                                {/* Box 2: Feedbacks qualitativos e justificativas */}
                                <div className={`glass-panel p-6 rounded-3xl border border-border space-y-4 flex flex-col ${exportingImage ? 'col-span-1 h-auto' : 'lg:col-span-4 h-[400px]'}`}>
                                     <div className="flex items-center justify-between border-b border-border pb-2">
                                          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                               <MessageSquare className="w-4 h-4 text-yellow-400" />
                                               Histórico Qualitativo e Feedback do Clima
                                          </h4>
                                     </div>
                                     <div className={`flex-1 pr-1 space-y-3 mt-2 ${exportingImage ? 'overflow-visible h-auto' : 'overflow-y-auto h-[320px] custom-scrollbar'}`}>
                                          {filteredReports.filter(r => r.answers.q10_explanation).length === 0 ? (
                                               <p className="text-xs text-slate-500 italic mt-4 text-center">Nenhuma explicação registrada pelos vendedores no período.</p>
                                          ) : (
                                               [...filteredReports]
                                                   .reverse()
                                                   .filter(r => r.answers.q10_explanation)
                                                   .map((r, i) => {
                                                        const ratingColor: Record<string, string> = {
                                                             ruim: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
                                                             regular: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                                                             bom: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
                                                             otimo: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                        };
                                                        return (
                                                             <div key={i} className="p-3 bg-panel border border-border rounded-xl space-y-1.5">
                                                                  <div className="flex justify-between items-center">
                                                                       <span className="text-[10px] font-extrabold text-indigo-400 font-mono">
                                                                            📅 {parseSafeDate(r.report_date).toLocaleDateString('pt-BR')}
                                                                       </span>
                                                                       <span className={`text-[9.5px] px-2 py-0.5 rounded-full border font-bold capitalize ${ratingColor[r.answers.q10_day_rating] || 'border-slate-500 text-slate-400'}`}>
                                                                            Clima: {r.answers.q10_day_rating === 'otimo' ? 'Ótimo' : r.answers.q10_day_rating === 'regular' ? 'Regular' : r.answers.q10_day_rating}
                                                                       </span>
                                                                  </div>
                                                                  <p className="text-xs text-slate-300 italic leading-relaxed font-semibold">
                                                                       "{r.answers.q10_explanation}"
                                                                  </p>
                                                             </div>
                                                        );
                                                   })
                                          )}
                                     </div>
                                </div>

                            </div>

                        </div>
                    )}
                </div>
            )}
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
                                Você está prestes a excluir permanentemente o **Relatório Comercial** do dia:
                            </p>
                            <div className="bg-panel border border-border rounded-2xl p-4 flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-400">Data Selecionada</span>
                                <span className="text-sm font-black text-indigo-400 font-mono">
                                    {parseSafeDate(reportDate).toLocaleDateString('pt-BR')}
                                </span>
                            </div>
                            <p className="text-[10px] text-slate-500 leading-relaxed font-normal">
                                Todos os dados de prospecção, novos agendamentos, comparecimentos, faturamento de vendas e notas de clima deste dia serão deletados permanentemente de nosso banco de dados.
                            </p>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 py-3.5 bg-panel hover:bg-panel/80 active:scale-[0.98] text-text rounded-xl font-bold text-xs transition-colors border border-border"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={saving}
                                className="flex-1 py-3.5 bg-rose-600 hover:bg-rose-500 active:scale-[0.98] text-text rounded-xl font-bold text-xs transition-all shadow-lg shadow-rose-600/20"
                            >
                                {saving ? 'Excluindo...' : 'Sim, Excluir'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Loading Snapshot Overlay */}
            {exportingImage && (
                <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-black/20 dark:bg-black/60 backdrop-blur-2xl">
                    <div className="flex flex-col items-center gap-4 text-center max-w-sm">
                        <div className="relative flex items-center justify-center">
                            <div className="w-16 h-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-400 animate-spin" />
                            <Image className="w-6 h-6 text-indigo-400 absolute animate-pulse" />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-text uppercase tracking-wider">Processando Painel</h3>
                            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                                Renderizando e convertendo os gráficos e KPIs acumulados em uma imagem de alta resolução...
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
