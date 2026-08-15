import React, { useState, useEffect } from 'react';
import { 
  Target, TrendingUp, CheckCircle, AlertTriangle, 
  Plus, Trash2, Edit3, Shield, BarChart3, 
  Activity, ArrowUpRight, X, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

export interface ClinicOKR {
  id: string;
  objective: string;
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'Anual';
  year: number;
  category: 'Comercial' | 'Financeiro' | 'Atendimento' | 'Operacional' | 'Qualidade';
  owner: string;
  keyResults: {
    id: string;
    description: string;
    currentValue: number;
    targetValue: number;
    unit: string;
  }[];
}

const INITIAL_OKRS: ClinicOKR[] = [
  {
    id: 'okr_1',
    objective: 'Acelerar a conversão e o volume de tratamentos de alto valor (Implantes & Facetas)',
    quarter: 'Q3',
    year: 2026,
    category: 'Comercial',
    owner: 'Dr. Roberto & Recepção',
    keyResults: [
      { id: 'kr_1_1', description: 'Elevar a taxa de conversão de avaliações de Implantes', currentValue: 55, targetValue: 70, unit: '%' },
      { id: 'kr_1_2', description: 'Faturar R$ 60k/mês apenas em prótese sobre implante e lentes', currentValue: 45000, targetValue: 60000, unit: 'R$' },
      { id: 'kr_1_3', description: 'Realizar follow-up em até 24h para 100% dos orçamentos abertos', currentValue: 88, targetValue: 100, unit: '%' }
    ]
  },
  {
    id: 'okr_2',
    objective: 'Blindar a pontualidade da Ortodontia e zerar faltas não justificadas',
    quarter: 'Q3',
    year: 2026,
    category: 'Operacional',
    owner: 'Dra. Camila & Recepção',
    keyResults: [
      { id: 'kr_2_1', description: 'Reduzir índice de faltas (No-Show) na ortodontia para menos de 8%', currentValue: 12, targetValue: 8, unit: '%' },
      { id: 'kr_2_2', description: 'Confirmar 100% dos agendamentos via WhatsApp com 48h de antecedência', currentValue: 94, targetValue: 100, unit: '%' }
    ]
  },
  {
    id: 'okr_3',
    objective: 'Excelência no Encantamento do Paciente & Pós-Venda Premium',
    quarter: 'Q3',
    year: 2026,
    category: 'Atendimento',
    owner: 'Coordenação de Atendimento',
    keyResults: [
      { id: 'kr_3_1', description: 'Alcançar NPS (Net Promoter Score) médio de 92+', currentValue: 89, targetValue: 92, unit: 'pts' },
      { id: 'kr_3_2', description: 'Tempo médio de espera na recepção inferior a 10 minutos', currentValue: 14, targetValue: 10, unit: 'min' }
    ]
  }
];

export const ManagementStrategy: React.FC = () => {
  const [okrs, setOkrs] = useState<ClinicOKR[]>(() => {
    try {
      const saved = localStorage.getItem('clinic_management_okrs');
      return saved ? JSON.parse(saved) : INITIAL_OKRS;
    } catch {
      return INITIAL_OKRS;
    }
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOkr, setEditingOkr] = useState<ClinicOKR | null>(null);

  // SWOT items in local storage
  const [swot, setSwot] = useState<{
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  }>(() => {
    try {
      const saved = localStorage.getItem('clinic_management_swot');
      return saved ? JSON.parse(saved) : {
        strengths: [
          'Corpo clínico altamente qualificado e humanizado',
          'Localização privilegiada com fácil acesso e estacionamento',
          'Tecnologia de ponta em diagnóstico e laboratório integrado'
        ],
        weaknesses: [
          'Dependência de poucos canais de tráfego pago',
          'Tempo de espera em horários de pico na recepção',
          'Processo de cobrança de inadimplência ainda manual'
        ],
        opportunities: [
          'Expansão da oferta de alinhadores invisíveis e estética dental',
          'Parcerias corporativas com empresas e convênios locais',
          'Campanhas de reativação da base de mais de 3.000 pacientes inativos'
        ],
        threats: [
          'Novas clínicas populares com preços predatórios na região',
          'Aumento nos custos de insumos odontológicos importados',
          'Rotatividade de estagiários e auxiliares de consultório'
        ]
      };
    } catch {
      return { strengths: [], weaknesses: [], opportunities: [], threats: [] };
    }
  });

  const [newSwotText, setNewSwotText] = useState({ s: '', w: '', o: '', t: '' });

  useEffect(() => {
    try {
      localStorage.setItem('clinic_management_okrs', JSON.stringify(okrs));
    } catch (e) {
      console.warn('Erro ao salvar OKRs no localStorage:', e);
    }
  }, [okrs]);

  useEffect(() => {
    try {
      localStorage.setItem('clinic_management_swot', JSON.stringify(swot));
    } catch (e) {
      console.warn('Erro ao salvar SWOT no localStorage:', e);
    }
  }, [swot]);

  // Form State
  const [formObjective, setFormObjective] = useState('');
  const [formCategory, setFormCategory] = useState<ClinicOKR['category']>('Comercial');
  const [formQuarter, setFormQuarter] = useState<ClinicOKR['quarter']>('Q3');
  const [formOwner, setFormOwner] = useState('');
  const [formKrs, setFormKrs] = useState<ClinicOKR['keyResults']>([
    { id: 'kr_temp_1', description: '', currentValue: 0, targetValue: 100, unit: '%' }
  ]);

  const handleOpenModal = (okr?: ClinicOKR) => {
    if (okr) {
      setEditingOkr(okr);
      setFormObjective(okr.objective);
      setFormCategory(okr.category);
      setFormQuarter(okr.quarter);
      setFormOwner(okr.owner);
      setFormKrs(okr.keyResults);
    } else {
      setEditingOkr(null);
      setFormObjective('');
      setFormCategory('Comercial');
      setFormQuarter('Q3');
      setFormOwner('Diretoria');
      setFormKrs([
        { id: `kr_${Date.now()}_1`, description: 'Key Result 1', currentValue: 0, targetValue: 100, unit: '%' }
      ]);
    }
    setIsModalOpen(true);
  };

  const handleSaveOkr = () => {
    if (!formObjective.trim()) {
      toast.error('Informe o objetivo estratégico.');
      return;
    }

    if (editingOkr) {
      setOkrs(prev => prev.map(o => o.id === editingOkr.id ? {
        ...o,
        objective: formObjective,
        category: formCategory,
        quarter: formQuarter,
        owner: formOwner,
        keyResults: formKrs
      } : o));
      toast.success('OKR atualizado com sucesso!');
    } else {
      const newOkr: ClinicOKR = {
        id: `okr_${Date.now()}`,
        objective: formObjective,
        quarter: formQuarter,
        year: 2026,
        category: formCategory,
        owner: formOwner || 'Geral',
        keyResults: formKrs.filter(kr => kr.description.trim() !== '')
      };
      setOkrs(prev => [...prev, newOkr]);
      toast.success('Novo OKR estratégico registrado!');
    }
    setIsModalOpen(false);
  };

  const handleDeleteOkr = (id: string) => {
    setOkrs(prev => prev.filter(o => o.id !== id));
    toast.success('OKR excluído.');
  };

  const handleAddKrRow = () => {
    setFormKrs(prev => [
      ...prev,
      { id: `kr_${Date.now()}`, description: '', currentValue: 0, targetValue: 100, unit: '%' }
    ]);
  };

  const handleUpdateKrValue = (okrId: string, krId: string, val: number) => {
    setOkrs(prev => prev.map(o => {
      if (o.id !== okrId) return o;
      return {
        ...o,
        keyResults: o.keyResults.map(kr => kr.id === krId ? { ...kr, currentValue: val } : kr)
      };
    }));
  };

  const handleAddSwotItem = (type: 'strengths' | 'weaknesses' | 'opportunities' | 'threats', text: string) => {
    if (!text.trim()) return;
    setSwot(prev => ({
      ...prev,
      [type]: [...prev[type], text.trim()]
    }));
    setNewSwotText(prev => ({ ...prev, [type === 'strengths' ? 's' : type === 'weaknesses' ? 'w' : type === 'opportunities' ? 'o' : 't']: '' }));
    toast.success('Item adicionado à matriz.');
  };

  const handleRemoveSwotItem = (type: 'strengths' | 'weaknesses' | 'opportunities' | 'threats', index: number) => {
    setSwot(prev => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="space-y-8">
      {/* Strategic Cockpit Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-panel border border-border p-4 rounded-2xl">
          <div className="flex justify-between items-center text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
            <span>CAC Médio Estimado</span>
            <Activity className="w-4 h-4 text-indigo-400" />
          </div>
          <h4 className="text-2xl font-black text-indigo-400 font-mono">R$ 68,50</h4>
          <p className="text-[11px] text-slate-400 mt-1">Custo de aquisição por paciente novo</p>
        </div>

        <div className="bg-panel border border-border p-4 rounded-2xl">
          <div className="flex justify-between items-center text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
            <span>LTV Médio (Valor Vitalício)</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
          </div>
          <h4 className="text-2xl font-black text-emerald-400 font-mono">R$ 3.840</h4>
          <p className="text-[11px] text-slate-400 mt-1">Receita média gerada por paciente no ciclo</p>
        </div>

        <div className="bg-panel border border-border p-4 rounded-2xl">
          <div className="flex justify-between items-center text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Ocupação dos Consultórios</span>
            <BarChart3 className="w-4 h-4 text-cyan-400" />
          </div>
          <h4 className="text-2xl font-black text-cyan-400 font-mono">81,4%</h4>
          <p className="text-[11px] text-slate-400 mt-1">Eficiência de uso das cadeiras clínicas</p>
        </div>

        <div className="bg-panel border border-border p-4 rounded-2xl">
          <div className="flex justify-between items-center text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
            <span>NPS (Satisfação Pacientes)</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <h4 className="text-2xl font-black text-amber-400 font-mono">91 / 100</h4>
          <p className="text-[11px] text-slate-400 mt-1">Excelente índice de recomendação</p>
        </div>
      </div>

      {/* Strategic OKRs Section */}
      <div className="bg-panel/40 border border-border rounded-3xl p-6 backdrop-blur-md space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-4">
          <div>
            <h3 className="text-lg font-black text-text flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-400" />
              <span>OKRs & Objetivos Estratégicos da Diretoria (2026)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Acompanhamento de metas trimestrais e resultados-chave de performance da clínica
            </p>
          </div>

          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-indigo-600/30"
          >
            <Plus className="w-4 h-4" />
            <span>Novo OKR Estratégico</span>
          </button>
        </div>

        <div className="space-y-4">
          {okrs.map((okr) => {
            // Calculate overall progress of this OKR
            let totalPct = 0;
            if (okr.keyResults.length > 0) {
              const sum = okr.keyResults.reduce((acc, kr) => {
                const ratio = kr.targetValue > 0 ? (kr.currentValue / kr.targetValue) * 100 : 0;
                return acc + Math.min(100, Math.max(0, ratio));
              }, 0);
              totalPct = sum / okr.keyResults.length;
            }

            return (
              <div 
                key={okr.id}
                className="bg-panel border border-border p-5 rounded-2xl space-y-4 shadow-sm hover:border-indigo-500/30 transition-all"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-[10px] font-extrabold uppercase font-mono">
                        {okr.quarter} {okr.year}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-bold">
                        {okr.category}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">
                        • Líder: <strong className="text-slate-200">{okr.owner}</strong>
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-text">{okr.objective}</h4>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-xs font-black text-text font-mono">{totalPct.toFixed(0)}%</span>
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Atingimento</p>
                    </div>
                    <div className="w-24 bg-slate-950 h-2 rounded-full overflow-hidden border border-white/5">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          totalPct >= 100 ? 'bg-emerald-500' : totalPct >= 70 ? 'bg-indigo-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.min(100, totalPct)}%` }}
                      />
                    </div>
                    <button
                      onClick={() => handleOpenModal(okr)}
                      className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all"
                      title="Editar OKR"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteOkr(okr.id)}
                      className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-rose-400 transition-all"
                      title="Excluir OKR"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Key Results list */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2 border-t border-white/5">
                  {okr.keyResults.map((kr) => {
                    const krPct = kr.targetValue > 0 ? (kr.currentValue / kr.targetValue) * 100 : 0;
                    return (
                      <div key={kr.id} className="bg-slate-950/40 border border-white/5 p-3 rounded-xl space-y-2">
                        <div className="flex justify-between items-start text-xs">
                          <span className="text-slate-300 font-medium text-[11px] leading-tight flex-1 pr-2">
                            {kr.description}
                          </span>
                          <span className="font-mono font-bold text-xs text-text shrink-0">
                            {kr.currentValue.toLocaleString('pt-BR')} / {kr.targetValue.toLocaleString('pt-BR')} {kr.unit}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-900 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-indigo-500 rounded-full"
                              style={{ width: `${Math.min(100, Math.max(0, krPct))}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 font-bold">
                            {krPct.toFixed(0)}%
                          </span>
                        </div>

                        {/* Direct fast-updater */}
                        <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
                          <span>Atualizar valor:</span>
                          <input
                            type="number"
                            value={kr.currentValue}
                            onChange={(e) => handleUpdateKrValue(okr.id, kr.id, Number(e.target.value))}
                            className="w-20 px-2 py-0.5 rounded bg-slate-900 border border-white/10 text-right font-mono text-xs text-text outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SWOT Matrix Section */}
      <div className="bg-panel/40 border border-border rounded-3xl p-6 backdrop-blur-md space-y-6">
        <div>
          <h3 className="text-lg font-black text-text flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            <span>Matriz SWOT Estratégica da Clínica (FOFA)</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Diagnóstico contínuo de forças internas, fragilidades operacionais, oportunidades de mercado e ameaças
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Forças (Strengths) */}
          <div className="bg-emerald-950/20 border border-emerald-500/30 p-4 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" />
                <span>Forças (Pontos Fortes)</span>
              </h4>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full font-mono">
                {swot.strengths.length}
              </span>
            </div>
            <ul className="space-y-1.5 text-xs text-slate-300">
              {swot.strengths.map((item, idx) => (
                <li key={idx} className="flex items-center justify-between p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/10 group">
                  <span>• {item}</span>
                  <button onClick={() => handleRemoveSwotItem('strengths', idx)} className="opacity-0 group-hover:opacity-100 text-rose-400 p-0.5">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-2 pt-2">
              <input
                type="text"
                placeholder="Adicionar força interna..."
                value={newSwotText.s}
                onChange={(e) => setNewSwotText(prev => ({ ...prev, s: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSwotItem('strengths', newSwotText.s)}
                className="flex-1 px-3 py-1.5 rounded-xl bg-slate-950/60 border border-emerald-500/20 text-xs text-text outline-none focus:border-emerald-500"
              />
              <button onClick={() => handleAddSwotItem('strengths', newSwotText.s)} className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Fraquezas (Weaknesses) */}
          <div className="bg-amber-950/20 border border-amber-500/30 p-4 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                <span>Fraquezas (Aprimoramentos)</span>
              </h4>
              <span className="text-[10px] font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full font-mono">
                {swot.weaknesses.length}
              </span>
            </div>
            <ul className="space-y-1.5 text-xs text-slate-300">
              {swot.weaknesses.map((item, idx) => (
                <li key={idx} className="flex items-center justify-between p-2 rounded-lg bg-amber-950/40 border border-amber-500/10 group">
                  <span>• {item}</span>
                  <button onClick={() => handleRemoveSwotItem('weaknesses', idx)} className="opacity-0 group-hover:opacity-100 text-rose-400 p-0.5">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-2 pt-2">
              <input
                type="text"
                placeholder="Adicionar ponto de atenção..."
                value={newSwotText.w}
                onChange={(e) => setNewSwotText(prev => ({ ...prev, w: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSwotItem('weaknesses', newSwotText.w)}
                className="flex-1 px-3 py-1.5 rounded-xl bg-slate-950/60 border border-amber-500/20 text-xs text-text outline-none focus:border-amber-500"
              />
              <button onClick={() => handleAddSwotItem('weaknesses', newSwotText.w)} className="p-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Oportunidades (Opportunities) */}
          <div className="bg-cyan-950/20 border border-cyan-500/30 p-4 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" />
                <span>Oportunidades de Crescimento</span>
              </h4>
              <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/20 px-2 py-0.5 rounded-full font-mono">
                {swot.opportunities.length}
              </span>
            </div>
            <ul className="space-y-1.5 text-xs text-slate-300">
              {swot.opportunities.map((item, idx) => (
                <li key={idx} className="flex items-center justify-between p-2 rounded-lg bg-cyan-950/40 border border-cyan-500/10 group">
                  <span>• {item}</span>
                  <button onClick={() => handleRemoveSwotItem('opportunities', idx)} className="opacity-0 group-hover:opacity-100 text-rose-400 p-0.5">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-2 pt-2">
              <input
                type="text"
                placeholder="Adicionar oportunidade..."
                value={newSwotText.o}
                onChange={(e) => setNewSwotText(prev => ({ ...prev, o: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSwotItem('opportunities', newSwotText.o)}
                className="flex-1 px-3 py-1.5 rounded-xl bg-slate-950/60 border border-cyan-500/20 text-xs text-text outline-none focus:border-cyan-500"
              />
              <button onClick={() => handleAddSwotItem('opportunities', newSwotText.o)} className="p-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Ameaças (Threats) */}
          <div className="bg-rose-950/20 border border-rose-500/30 p-4 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                <span>Ameaças Externas</span>
              </h4>
              <span className="text-[10px] font-bold text-rose-400 bg-rose-500/20 px-2 py-0.5 rounded-full font-mono">
                {swot.threats.length}
              </span>
            </div>
            <ul className="space-y-1.5 text-xs text-slate-300">
              {swot.threats.map((item, idx) => (
                <li key={idx} className="flex items-center justify-between p-2 rounded-lg bg-rose-950/40 border border-rose-500/10 group">
                  <span>• {item}</span>
                  <button onClick={() => handleRemoveSwotItem('threats', idx)} className="opacity-0 group-hover:opacity-100 text-rose-400 p-0.5">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-2 pt-2">
              <input
                type="text"
                placeholder="Adicionar ameaça de mercado..."
                value={newSwotText.t}
                onChange={(e) => setNewSwotText(prev => ({ ...prev, t: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSwotItem('threats', newSwotText.t)}
                className="flex-1 px-3 py-1.5 rounded-xl bg-slate-950/60 border border-rose-500/20 text-xs text-text outline-none focus:border-rose-500"
              />
              <button onClick={() => handleAddSwotItem('threats', newSwotText.t)} className="p-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal for Creating / Editing OKR */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 flex items-center justify-between border-b border-border">
              <h3 className="text-base font-extrabold text-text">
                {editingOkr ? 'Editar OKR Estratégico' : 'Novo Objetivo Estratégico (OKR)'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Objetivo Estratégico *</label>
                <textarea
                  value={formObjective}
                  onChange={(e) => setFormObjective(e.target.value)}
                  placeholder="Ex: Aumentar o faturamento de implantes e estética em 30%..."
                  className="w-full h-20 p-3 rounded-xl bg-panel border border-border text-xs text-text outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Trimestre</label>
                  <select
                    value={formQuarter}
                    onChange={(e) => setFormQuarter(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-panel border border-border text-xs text-text outline-none focus:border-indigo-500"
                  >
                    <option value="Q1">Q1 (Jan-Mar)</option>
                    <option value="Q2">Q2 (Abr-Jun)</option>
                    <option value="Q3">Q3 (Jul-Set)</option>
                    <option value="Q4">Q4 (Out-Dez)</option>
                    <option value="Anual">Meta Anual</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Categoria</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-panel border border-border text-xs text-text outline-none focus:border-indigo-500"
                  >
                    <option value="Comercial">Comercial</option>
                    <option value="Financeiro">Financeiro</option>
                    <option value="Atendimento">Atendimento</option>
                    <option value="Operacional">Operacional</option>
                    <option value="Qualidade">Qualidade</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Líder / Responsável</label>
                  <input
                    type="text"
                    value={formOwner}
                    onChange={(e) => setFormOwner(e.target.value)}
                    placeholder="Ex: Dr. Roberto"
                    className="w-full px-3 py-2 rounded-xl bg-panel border border-border text-xs text-text outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Key Results */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">Resultados-Chave (Key Results)</label>
                  <button
                    type="button"
                    onClick={handleAddKrRow}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Adicionar KR
                  </button>
                </div>

                {formKrs.map((kr, idx) => (
                  <div key={kr.id || idx} className="bg-panel border border-border p-3 rounded-xl space-y-2">
                    <input
                      type="text"
                      placeholder={`Key Result ${idx + 1} (Ex: Alcançar taxa de 70%)`}
                      value={kr.description}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormKrs(prev => prev.map((k, i) => i === idx ? { ...k, description: val } : k));
                      }}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-border text-xs text-text outline-none focus:border-indigo-500"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-400 block mb-0.5">Valor Atual</span>
                        <input
                          type="number"
                          value={kr.currentValue}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setFormKrs(prev => prev.map((k, i) => i === idx ? { ...k, currentValue: val } : k));
                          }}
                          className="w-full px-2 py-1 rounded bg-slate-950 border border-border text-xs font-mono text-text outline-none"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block mb-0.5">Valor Meta</span>
                        <input
                          type="number"
                          value={kr.targetValue}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setFormKrs(prev => prev.map((k, i) => i === idx ? { ...k, targetValue: val } : k));
                          }}
                          className="w-full px-2 py-1 rounded bg-slate-950 border border-border text-xs font-mono text-text outline-none"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block mb-0.5">Unidade</span>
                        <input
                          type="text"
                          value={kr.unit}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormKrs(prev => prev.map((k, i) => i === idx ? { ...k, unit: val } : k));
                          }}
                          placeholder="%, R$, pts..."
                          className="w-full px-2 py-1 rounded bg-slate-950 border border-border text-xs font-mono text-text outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-border flex justify-end gap-3 bg-panel/40">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-panel border border-border text-slate-300 text-xs font-bold hover:bg-panel/80"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveOkr}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30"
              >
                Salvar OKR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
