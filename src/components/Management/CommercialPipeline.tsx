import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, Plus, Search, DollarSign, 
  XCircle, Clock, MessageSquare, 
  Trash2, Edit3, User, Award, 
  Download, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

export interface CommercialLead {
  id: string;
  patientName: string;
  phone: string;
  specialty: 'Ortodontia' | 'Implantes' | 'Prótese' | 'Estética/Facetas' | 'Endodontia' | 'Clínico Geral' | 'Harmonização';
  estimatedValue: number;
  stage: 'lead' | 'scheduled' | 'attended' | 'presented' | 'negotiation' | 'won' | 'lost';
  evaluator: string;
  source: 'Instagram' | 'Google Ads' | 'Indicação' | 'WhatsApp' | 'Passante' | 'Retorno';
  createdAt: string;
  lastContactDate: string;
  nextFollowUpDate?: string;
  notes?: string;
  lostReason?: string;
}

const PIPELINE_STAGES = [
  { id: 'lead', label: '1. Novos Contatos', color: 'border-slate-500/40 bg-slate-500/5', badge: 'bg-slate-500/20 text-slate-300' },
  { id: 'scheduled', label: '2. Avaliação Agendada', color: 'border-cyan-500/40 bg-cyan-500/5', badge: 'bg-cyan-500/20 text-cyan-300' },
  { id: 'attended', label: '3. Compareceu / Avaliado', color: 'border-blue-500/40 bg-blue-500/5', badge: 'bg-blue-500/20 text-blue-300' },
  { id: 'presented', label: '4. Orçamento Apresentado', color: 'border-indigo-500/40 bg-indigo-500/5', badge: 'bg-indigo-500/20 text-indigo-300' },
  { id: 'negotiation', label: '5. Em Negociação / Follow-up', color: 'border-amber-500/40 bg-amber-500/5', badge: 'bg-amber-500/20 text-amber-300' },
  { id: 'won', label: '6. Fechado / Ganho 🎉', color: 'border-emerald-500/40 bg-emerald-500/5', badge: 'bg-emerald-500/20 text-emerald-300' },
  { id: 'lost', label: '7. Não Fechado', color: 'border-rose-500/40 bg-rose-500/5', badge: 'bg-rose-500/20 text-rose-300' }
] as const;

const INITIAL_LEADS: CommercialLead[] = [
  {
    id: 'lead_1',
    patientName: 'Mariana Silveira',
    phone: '48991234567',
    specialty: 'Implantes',
    estimatedValue: 8500,
    stage: 'negotiation',
    evaluator: 'Dr. Roberto',
    source: 'Instagram',
    createdAt: '2026-08-10',
    lastContactDate: '2026-08-14',
    nextFollowUpDate: '2026-08-16',
    notes: 'Interessada em protocolo superior. Negociando parcelamento em 18x no boleto.'
  },
  {
    id: 'lead_2',
    patientName: 'Carlos Eduardo Mendes',
    phone: '48998765432',
    specialty: 'Ortodontia',
    estimatedValue: 4200,
    stage: 'presented',
    evaluator: 'Dra. Camila',
    source: 'Indicação',
    createdAt: '2026-08-12',
    lastContactDate: '2026-08-13',
    nextFollowUpDate: '2026-08-15',
    notes: 'Apresentado alinhador transparente. Avaliando com a esposa.'
  },
  {
    id: 'lead_3',
    patientName: 'Juliana Castro',
    phone: '48984112233',
    specialty: 'Estética/Facetas',
    estimatedValue: 12000,
    stage: 'won',
    evaluator: 'Dr. Roberto',
    source: 'Google Ads',
    createdAt: '2026-08-05',
    lastContactDate: '2026-08-12',
    notes: 'Fechou 8 lentes de resina composta. Entrada + 10x cartão.'
  },
  {
    id: 'lead_4',
    patientName: 'Fernando Alencar',
    phone: '48988554433',
    specialty: 'Prótese',
    estimatedValue: 3500,
    stage: 'scheduled',
    evaluator: 'Dra. Camila',
    source: 'WhatsApp',
    createdAt: '2026-08-14',
    lastContactDate: '2026-08-14',
    nextFollowUpDate: '2026-08-18',
    notes: 'Avaliação agendada para terça-feira às 14h.'
  }
];

export const CommercialPipeline: React.FC = () => {
  const [leads, setLeads] = useState<CommercialLead[]>(() => {
    try {
      const saved = localStorage.getItem('clinic_commercial_leads');
      return saved ? JSON.parse(saved) : INITIAL_LEADS;
    } catch {
      return INITIAL_LEADS;
    }
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [filterSpecialty, setFilterSpecialty] = useState<string>('all');
  const [filterEvaluator, setFilterEvaluator] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<CommercialLead | null>(null);

  const [formData, setFormData] = useState<Partial<CommercialLead>>({
    patientName: '',
    phone: '',
    specialty: 'Ortodontia',
    estimatedValue: 3000,
    stage: 'lead',
    evaluator: 'Dr. Roberto',
    source: 'Instagram',
    notes: '',
    nextFollowUpDate: new Date().toISOString().split('T')[0]
  });

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('clinic_commercial_leads', JSON.stringify(leads));
    } catch (e) {
      console.warn('Erro ao salvar leads comerciais no localStorage:', e);
    }
  }, [leads]);

  // Metrics
  const metrics = useMemo(() => {
    const activePipeline = leads.filter(l => l.stage !== 'lost');
    const wonLeads = leads.filter(l => l.stage === 'won');
    const lostLeads = leads.filter(l => l.stage === 'lost');
    const totalNegotiation = activePipeline.reduce((acc, curr) => acc + (Number(curr.estimatedValue) || 0), 0);
    const totalWon = wonLeads.reduce((acc, curr) => acc + (Number(curr.estimatedValue) || 0), 0);
    
    const decidedCount = wonLeads.length + lostLeads.length;
    const conversionRate = decidedCount > 0 ? (wonLeads.length / decidedCount) * 100 : 0;
    const avgTicket = wonLeads.length > 0 ? totalWon / wonLeads.length : 0;

    const todayStr = new Date().toISOString().split('T')[0];
    const pendingFollowUps = leads.filter(l => 
      l.stage !== 'won' && 
      l.stage !== 'lost' && 
      l.nextFollowUpDate && 
      l.nextFollowUpDate <= todayStr
    ).length;

    return {
      totalNegotiation,
      totalWon,
      conversionRate,
      avgTicket,
      pendingFollowUps,
      totalLeads: leads.length
    };
  }, [leads]);

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      const matchSearch = l.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          l.phone.includes(searchTerm) ||
                          (l.notes && l.notes.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchSpec = filterSpecialty === 'all' || l.specialty === filterSpecialty;
      const matchEval = filterEvaluator === 'all' || l.evaluator === filterEvaluator;
      return matchSearch && matchSpec && matchEval;
    });
  }, [leads, searchTerm, filterSpecialty, filterEvaluator]);

  const handleOpenModal = (lead?: CommercialLead) => {
    if (lead) {
      setEditingLead(lead);
      setFormData(lead);
    } else {
      setEditingLead(null);
      setFormData({
        patientName: '',
        phone: '',
        specialty: 'Ortodontia',
        estimatedValue: 3000,
        stage: 'lead',
        evaluator: 'Dr. Roberto',
        source: 'Instagram',
        notes: '',
        nextFollowUpDate: new Date().toISOString().split('T')[0]
      });
    }
    setIsModalOpen(true);
  };

  const handleSaveLead = () => {
    if (!formData.patientName?.trim()) {
      toast.error('Informe o nome do paciente.');
      return;
    }

    if (editingLead) {
      setLeads(prev => prev.map(l => l.id === editingLead.id ? { 
        ...l, 
        ...formData, 
        lastContactDate: new Date().toISOString().split('T')[0] 
      } as CommercialLead : l));
      toast.success('Oportunidade comercial atualizada com sucesso!');
    } else {
      const newLead: CommercialLead = {
        id: `lead_${Date.now()}`,
        patientName: formData.patientName || '',
        phone: formData.phone || '',
        specialty: formData.specialty || 'Ortodontia',
        estimatedValue: Number(formData.estimatedValue) || 0,
        stage: formData.stage || 'lead',
        evaluator: formData.evaluator || 'Geral',
        source: formData.source || 'Instagram',
        createdAt: new Date().toISOString().split('T')[0],
        lastContactDate: new Date().toISOString().split('T')[0],
        nextFollowUpDate: formData.nextFollowUpDate,
        notes: formData.notes
      };
      setLeads(prev => [newLead, ...prev]);
      toast.success('Nova oportunidade cadastrada no funil!');
    }
    setIsModalOpen(false);
  };

  const handleDeleteLead = (id: string) => {
    setLeads(prev => prev.filter(l => l.id !== id));
    toast.success('Oportunidade removida do funil.');
  };

  const handleMoveStage = (id: string, newStage: CommercialLead['stage']) => {
    setLeads(prev => prev.map(l => l.id === id ? { 
      ...l, 
      stage: newStage, 
      lastContactDate: new Date().toISOString().split('T')[0] 
    } : l));
    const stageName = PIPELINE_STAGES.find(s => s.id === newStage)?.label || newStage;
    toast.success(`Movido para: ${stageName}`);
  };

  const handleSendWhatsApp = (phone: string, patientName: string, specialty: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const text = encodeURIComponent(`Olá ${patientName}, tudo bem? Aqui é da equipe da clínica! Entrando em contato sobre a sua avaliação de ${specialty}. Como podemos te ajudar a conquistar o seu melhor sorriso?`);
    window.open(`https://wa.me/${fullPhone}?text=${text}`, '_blank');
  };

  const handleExportCSV = () => {
    const headers = ['Paciente,Telefone,Especialidade,Valor,Estágio,Avaliador,Origem,Data Cadastro,Próximo Follow-up,Notas'];
    const rows = leads.map(l => 
      `"${l.patientName}","${l.phone}","${l.specialty}",${l.estimatedValue},"${l.stage}","${l.evaluator}","${l.source}","${l.createdAt}","${l.nextFollowUpDate || ''}","${(l.notes || '').replace(/"/g, '""')}"`
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `funil_comercial_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Relatório comercial exportado com sucesso!');
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Quick Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-panel border border-border p-4 rounded-2xl flex flex-col justify-between">
          <div className="flex justify-between items-center text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span>Volume em Negociação</span>
            <DollarSign className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="my-2">
            <h3 className="text-2xl font-black text-text font-mono">
              {metrics.totalNegotiation.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Oportunidades ativas no funil</p>
          </div>
          <div className="h-1 bg-indigo-500/30 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full w-3/4" />
          </div>
        </div>

        <div className="bg-panel border border-border p-4 rounded-2xl flex flex-col justify-between">
          <div className="flex justify-between items-center text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span>Fechamento no Mês</span>
            <Award className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="my-2">
            <h3 className="text-2xl font-black text-emerald-400 font-mono">
              {metrics.totalWon.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Tratamentos ganhos e formalizados</p>
          </div>
          <div className="h-1 bg-emerald-500/30 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full w-full" />
          </div>
        </div>

        <div className="bg-panel border border-border p-4 rounded-2xl flex flex-col justify-between">
          <div className="flex justify-between items-center text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span>Taxa de Conversão</span>
            <TrendingUp className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="my-2">
            <h3 className="text-2xl font-black text-cyan-400 font-mono">
              {metrics.conversionRate.toFixed(1)}%
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Ganhos / Decididos no ciclo</p>
          </div>
          <div className="h-1 bg-cyan-500/30 rounded-full overflow-hidden">
            <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${Math.min(100, metrics.conversionRate)}%` }} />
          </div>
        </div>

        <div className="bg-panel border border-border p-4 rounded-2xl flex flex-col justify-between">
          <div className="flex justify-between items-center text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span>Ticket Médio Fechado</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="my-2">
            <h3 className="text-2xl font-black text-amber-400 font-mono">
              {metrics.avgTicket.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Valor médio por plano aceito</p>
          </div>
          <div className="h-1 bg-amber-500/30 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500 rounded-full w-2/3" />
          </div>
        </div>
      </div>

      {/* Action Bar & Filters */}
      <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 bg-panel/60 border border-border p-4 rounded-2xl backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por paciente, telefone ou anotação..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950/60 border border-border rounded-xl text-xs text-text placeholder:text-slate-500 outline-none focus:border-indigo-500/50"
            />
          </div>

          <select
            value={filterSpecialty}
            onChange={(e) => setFilterSpecialty(e.target.value)}
            className="bg-slate-950/60 border border-border rounded-xl px-3 py-2 text-xs text-text outline-none focus:border-indigo-500/50"
          >
            <option value="all">Todas Especialidades</option>
            <option value="Ortodontia">Ortodontia</option>
            <option value="Implantes">Implantes</option>
            <option value="Prótese">Prótese</option>
            <option value="Estética/Facetas">Estética / Facetas</option>
            <option value="Endodontia">Endodontia</option>
            <option value="Clínico Geral">Clínico Geral</option>
            <option value="Harmonização">Harmonização</option>
          </select>

          <select
            value={filterEvaluator}
            onChange={(e) => setFilterEvaluator(e.target.value)}
            className="bg-slate-950/60 border border-border rounded-xl px-3 py-2 text-xs text-text outline-none focus:border-indigo-500/50"
          >
            <option value="all">Todos Avaliadores</option>
            <option value="Dr. Roberto">Dr. Roberto</option>
            <option value="Dra. Camila">Dra. Camila</option>
            <option value="Geral">Equipe Geral</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-border text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-indigo-600/30"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Oportunidade</span>
          </button>
        </div>
      </div>

      {/* Kanban Pipeline Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4 overflow-x-auto pb-4 custom-scrollbar">
        {PIPELINE_STAGES.map((stage) => {
          const stageLeads = filteredLeads.filter(l => l.stage === stage.id);
          const stageTotal = stageLeads.reduce((acc, curr) => acc + (Number(curr.estimatedValue) || 0), 0);

          return (
            <div 
              key={stage.id}
              className={`flex flex-col rounded-2xl border ${stage.color} p-3 min-w-[260px] max-w-[320px] xl:max-w-none flex-1`}
            >
              {/* Stage Header */}
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/5">
                <div>
                  <h4 className="text-xs font-black text-text uppercase tracking-tight">{stage.label}</h4>
                  <span className="text-[10px] font-mono text-slate-400 font-bold">
                    {stageTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${stage.badge}`}>
                  {stageLeads.length}
                </span>
              </div>

              {/* Stage Cards */}
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px] pr-1 custom-scrollbar">
                {stageLeads.length === 0 ? (
                  <div className="py-8 text-center border border-dashed border-white/5 rounded-xl text-slate-600 text-xs">
                    Nenhum paciente
                  </div>
                ) : (
                  stageLeads.map((lead) => {
                    const isFollowUpDue = lead.nextFollowUpDate && lead.nextFollowUpDate <= new Date().toISOString().split('T')[0] && lead.stage !== 'won' && lead.stage !== 'lost';

                    return (
                      <div 
                        key={lead.id}
                        className="bg-panel border border-border/80 hover:border-indigo-500/40 p-3.5 rounded-xl shadow-md transition-all group relative flex flex-col gap-2.5"
                      >
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h5 className="text-xs font-extrabold text-text leading-snug group-hover:text-indigo-300 transition-colors">
                              {lead.patientName}
                            </h5>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {lead.specialty} • {lead.source}
                            </span>
                          </div>
                          <span className="text-xs font-black text-emerald-400 font-mono">
                            {lead.estimatedValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })}
                          </span>
                        </div>

                        {/* Notes if any */}
                        {lead.notes && (
                          <p className="text-[11px] text-slate-400 line-clamp-2 bg-slate-950/40 p-2 rounded-lg border border-white/5 leading-relaxed">
                            {lead.notes}
                          </p>
                        )}

                        {/* Footer & Meta */}
                        <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[10px]">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3 h-3 text-slate-500" />
                            <span className="text-slate-400">{lead.evaluator}</span>
                          </div>

                          {lead.nextFollowUpDate && (
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-1 ${
                              isFollowUpDue ? 'bg-rose-500/20 text-rose-300 animate-pulse' : 'text-slate-500'
                            }`}>
                              <Clock className="w-2.5 h-2.5" />
                              {lead.nextFollowUpDate.split('-').reverse().slice(0, 2).join('/')}
                            </span>
                          )}
                        </div>

                        {/* Action Buttons on Hover */}
                        <div className="flex items-center justify-between pt-1 mt-1 border-t border-white/5">
                          <div className="flex items-center gap-1">
                            {lead.phone && (
                              <button
                                onClick={() => handleSendWhatsApp(lead.phone, lead.patientName, lead.specialty)}
                                className="p-1 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all"
                                title="Chamar no WhatsApp"
                              >
                                <MessageSquare className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenModal(lead)}
                              className="p-1 rounded bg-slate-800 text-slate-400 hover:text-slate-200 transition-all"
                              title="Editar Detalhes"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteLead(lead.id)}
                              className="p-1 rounded bg-slate-800 text-slate-500 hover:text-rose-400 transition-all"
                              title="Excluir Oportunidade"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Quick Stage Mover */}
                          <div className="flex items-center gap-1">
                            {stage.id !== 'won' && (
                              <button
                                onClick={() => handleMoveStage(lead.id, 'won')}
                                className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-[9px] font-bold"
                                title="Marcar como Fechado / Ganho"
                              >
                                Fechar 🎉
                              </button>
                            )}
                            {stage.id !== 'lost' && (
                              <button
                                onClick={() => handleMoveStage(lead.id, 'lost')}
                                className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 text-[9px] font-bold"
                                title="Marcar como Perdido"
                              >
                                Perdido
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal for Creating / Editing Lead */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 flex items-center justify-between border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-text">
                    {editingLead ? 'Editar Oportunidade Comercial' : 'Nova Oportunidade Comercial'}
                  </h3>
                  <p className="text-xs text-slate-400">Cadastro de negociação de plano de tratamento</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-panel text-slate-400 hover:text-slate-200"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Nome do Paciente *</label>
                  <input
                    type="text"
                    value={formData.patientName || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, patientName: e.target.value }))}
                    placeholder="Ex: Mariana Silveira"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-panel border border-border text-xs text-text outline-none focus:border-indigo-500/50"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Telefone / WhatsApp</label>
                  <input
                    type="text"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="(48) 99999-9999"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-panel border border-border text-xs text-text outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Especialidade</label>
                  <select
                    value={formData.specialty || 'Ortodontia'}
                    onChange={(e) => setFormData(prev => ({ ...prev, specialty: e.target.value as any }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-panel border border-border text-xs text-text outline-none focus:border-indigo-500/50"
                  >
                    <option value="Ortodontia">Ortodontia</option>
                    <option value="Implantes">Implantes</option>
                    <option value="Prótese">Prótese</option>
                    <option value="Estética/Facetas">Estética / Facetas</option>
                    <option value="Endodontia">Endodontia</option>
                    <option value="Clínico Geral">Clínico Geral</option>
                    <option value="Harmonização">Harmonização</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Valor Estimado (R$)</label>
                  <input
                    type="number"
                    value={formData.estimatedValue || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, estimatedValue: Number(e.target.value) }))}
                    placeholder="0,00"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-panel border border-border text-xs text-text outline-none focus:border-indigo-500/50 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Estágio do Funil</label>
                  <select
                    value={formData.stage || 'lead'}
                    onChange={(e) => setFormData(prev => ({ ...prev, stage: e.target.value as any }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-panel border border-border text-xs text-text outline-none focus:border-indigo-500/50"
                  >
                    {PIPELINE_STAGES.map(s => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Avaliador / Responsável</label>
                  <input
                    type="text"
                    value={formData.evaluator || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, evaluator: e.target.value }))}
                    placeholder="Ex: Dr. Roberto"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-panel border border-border text-xs text-text outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Origem do Lead</label>
                  <select
                    value={formData.source || 'Instagram'}
                    onChange={(e) => setFormData(prev => ({ ...prev, source: e.target.value as any }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-panel border border-border text-xs text-text outline-none focus:border-indigo-500/50"
                  >
                    <option value="Instagram">Instagram</option>
                    <option value="Google Ads">Google Ads</option>
                    <option value="Indicação">Indicação</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Passante">Passante</option>
                    <option value="Retorno">Retorno de Paciente</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Próximo Follow-up</label>
                  <input
                    type="date"
                    value={formData.nextFollowUpDate || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, nextFollowUpDate: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-panel border border-border text-xs text-text outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Anotações Estratégicas & Objeções</label>
                <textarea
                  value={formData.notes || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Descreva detalhes do orçamento, condições negociadas, objeções de preço ou preferências do paciente..."
                  className="w-full h-24 p-3 rounded-xl bg-panel border border-border text-xs text-text outline-none focus:border-indigo-500/50 resize-none"
                />
              </div>
            </div>

            <div className="p-6 border-t border-border flex items-center justify-end gap-3 bg-panel/40">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-panel border border-border text-slate-300 text-xs font-bold hover:bg-panel/80 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveLead}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all"
              >
                Salvar Oportunidade
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
