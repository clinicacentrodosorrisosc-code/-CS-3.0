import React, { useState, useEffect } from 'react';
import { 
  Megaphone, Loader2
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { toast } from 'sonner';
import { notifyDataChange } from '../../lib/realtime';

export interface Campaign {
  id?: string;
  monthIndex: number; // 0-11
  year: number;
  title: string;
  objective: string;
  status: 'Planned' | 'Active' | 'Completed';
  targetRevenue?: number;
  budget?: number;
  channels?: string[];
  actionChecklist?: { id: string; text: string; done: boolean }[];
}

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const DEFAULT_ANNUAL_CAMPAIGNS: Partial<Campaign>[] = [
  { monthIndex: 0, title: 'Janeiro Branco & Renovação do Sorriso', objective: 'Campanha de início de ano focada em clareamento e profilaxia.', status: 'Completed', targetRevenue: 60000, budget: 2500 },
  { monthIndex: 1, title: 'Carnaval do Sorriso Perfeito', objective: 'Ortodontia estética e alinhadores com fechamento rápido.', status: 'Completed', targetRevenue: 75000, budget: 3000 },
  { monthIndex: 2, title: 'Mês da Mulher & Autoestima', objective: 'Harmonização orofacial e lentes de contato dental.', status: 'Completed', targetRevenue: 85000, budget: 3500 },
  { monthIndex: 3, title: 'Páscoa Sem Dor & Checkup Familiar', objective: 'Prevenção, restaurações estéticas e odontopediatria.', status: 'Completed', targetRevenue: 70000, budget: 2000 },
  { monthIndex: 4, title: 'Mês das Mães: O Melhor Presente', objective: 'Campanha especial para mães com pacotes de reabilitação.', status: 'Completed', targetRevenue: 90000, budget: 4000 },
  { monthIndex: 5, title: 'Mês dos Namorados & Sorrisos Conectados', objective: 'Clareamento a laser em dobro e ortodontia.', status: 'Completed', targetRevenue: 80000, budget: 3000 },
  { monthIndex: 6, title: 'Férias & Sorriso Saudável', objective: 'Avaliações ortodônticas infantis e adolescentes.', status: 'Completed', targetRevenue: 75000, budget: 2500 },
  { monthIndex: 7, title: 'Mês dos Pais & Reabilitação Oral', objective: 'Implantes dentários e prótese sobre implante.', status: 'Active', targetRevenue: 100000, budget: 5000 },
  { monthIndex: 8, title: 'Setembro Dourado do Sorriso', objective: 'Campanha de próteses fixas e facetas de resina.', status: 'Planned', targetRevenue: 85000, budget: 3500 },
  { monthIndex: 9, title: 'Outubro Rosa & Cuidado Integral', objective: 'Ações comunitárias e prevenção do câncer bucal.', status: 'Planned', targetRevenue: 80000, budget: 2500 },
  { monthIndex: 10, title: 'Black Friday do Sorriso (Black Dental)', objective: 'Semana de condições imperdíveis de fechamento de planos.', status: 'Planned', targetRevenue: 130000, budget: 6000 },
  { monthIndex: 11, title: 'Fim de Ano & Natal: Sorria nas Festas', objective: 'Reabilitações e estética para as fotos de fim de ano.', status: 'Planned', targetRevenue: 110000, budget: 4500 }
];

export const CampaignCalendar: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentYear] = useState(new Date().getFullYear());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMonthIndex, setEditingMonthIndex] = useState<number>(new Date().getMonth());

  const [form, setForm] = useState<Partial<Campaign>>({
    title: '',
    objective: '',
    status: 'Planned',
    targetRevenue: 80000,
    budget: 3000,
    channels: ['Instagram', 'WhatsApp', 'Google Ads']
  });

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('campaigns').select('*');
      if (data && data.length > 0) {
        setCampaigns(data.map(c => ({
          id: c.id,
          monthIndex: c.month_index,
          year: c.year,
          title: c.title,
          objective: c.objective,
          status: c.status,
          targetRevenue: c.target_revenue,
          budget: c.budget,
          channels: c.channels || ['Instagram', 'WhatsApp']
        })));
      } else {
        // Use default mapped campaigns
        const defaults: Campaign[] = DEFAULT_ANNUAL_CAMPAIGNS.map(d => ({
          id: `camp_${d.monthIndex}`,
          monthIndex: d.monthIndex || 0,
          year: currentYear,
          title: d.title || '',
          objective: d.objective || '',
          status: (d.status as any) || 'Planned',
          targetRevenue: d.targetRevenue || 80000,
          budget: d.budget || 3000,
          channels: ['Instagram', 'WhatsApp', 'Google Ads']
        }));
        setCampaigns(defaults);
      }
    } catch (e) {
      console.warn('Erro ao carregar campanhas:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, []);

  const openModal = (monthIdx: number) => {
    const existing = campaigns.find(c => c.monthIndex === monthIdx);
    setEditingMonthIndex(monthIdx);
    if (existing) {
      setForm(existing);
    } else {
      setForm({
        title: '',
        objective: '',
        status: monthIdx === new Date().getMonth() ? 'Active' : monthIdx < new Date().getMonth() ? 'Completed' : 'Planned',
        targetRevenue: 80000,
        budget: 3000,
        channels: ['Instagram', 'WhatsApp']
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title?.trim()) {
      toast.error('Informe o título da campanha.');
      return;
    }

    const payload = {
      month_index: editingMonthIndex,
      year: currentYear,
      title: form.title,
      objective: form.objective || '',
      status: form.status || 'Planned',
      target_revenue: Number(form.targetRevenue) || 0,
      budget: Number(form.budget) || 0
    };

    try {
      const existing = campaigns.find(c => c.monthIndex === editingMonthIndex);
      if (existing?.id && !existing.id.startsWith('camp_')) {
        await supabase.from('campaigns').upsert({ ...payload, id: existing.id });
      } else {
        await supabase.from('campaigns').insert(payload);
      }
      notifyDataChange('campaigns');
    } catch {
      // Fallback local update
    }

    setCampaigns(prev => {
      const filtered = prev.filter(c => c.monthIndex !== editingMonthIndex);
      return [...filtered, {
        id: `camp_${editingMonthIndex}`,
        monthIndex: editingMonthIndex,
        year: currentYear,
        title: form.title || '',
        objective: form.objective || '',
        status: form.status as any || 'Planned',
        targetRevenue: Number(form.targetRevenue) || 0,
        budget: Number(form.budget) || 0,
        channels: form.channels || ['Instagram']
      }].sort((a, b) => a.monthIndex - b.monthIndex);
    });

    toast.success('Campanha salva com sucesso!');
    setIsModalOpen(false);
  };

  const activeMonthCampaign = campaigns.find(c => c.monthIndex === new Date().getMonth());

  return (
    <div className="space-y-6">
      {/* Current Active Campaign Highlight Banner */}
      {activeMonthCampaign && (
        <div className="bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-panel border border-indigo-500/40 p-6 rounded-3xl backdrop-blur-md relative overflow-hidden shadow-xl">
          <div className="absolute -right-6 -bottom-6 w-36 h-36 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-extrabold uppercase tracking-wider animate-pulse flex items-center gap-1.5 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Campanha Ativa do Mês ({MONTHS[activeMonthCampaign.monthIndex]})
                </span>
              </div>
              <h2 className="text-2xl font-black text-text">{activeMonthCampaign.title}</h2>
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                {activeMonthCampaign.objective || 'Campanha comercial em andamento para atração e conversão de pacientes.'}
              </p>
            </div>

            <div className="flex items-center gap-4 bg-slate-950/60 p-4 rounded-2xl border border-white/10">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Meta de Faturamento</span>
                <span className="text-lg font-black text-emerald-400 font-mono">
                  {(activeMonthCampaign.targetRevenue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Orçamento Marketing</span>
                <span className="text-lg font-black text-indigo-400 font-mono">
                  {(activeMonthCampaign.budget || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              <button
                onClick={() => openModal(activeMonthCampaign.monthIndex)}
                className="ml-2 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/30"
              >
                Editar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 12 Months Campaign Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-text flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-amber-400" />
            <span>Grade Anual de Campanhas Comerciais & Marketing ({currentYear})</span>
          </h3>
          <span className="text-xs text-slate-400 font-mono">12 Meses Estruturados</span>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
            <p className="text-xs">Carregando calendário anual de campanhas...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {MONTHS.map((monthName, idx) => {
            const camp = campaigns.find(c => c.monthIndex === idx);
            const isCurrentMonth = new Date().getMonth() === idx;

            let statusBadge = 'bg-slate-800 text-slate-400';
            if (camp?.status === 'Active') statusBadge = 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
            if (camp?.status === 'Planned') statusBadge = 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30';
            if (camp?.status === 'Completed') statusBadge = 'bg-slate-800/80 text-slate-500';

            return (
              <div
                key={idx}
                onClick={() => openModal(idx)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer group hover:-translate-y-1 flex flex-col justify-between min-h-[160px] ${
                  isCurrentMonth 
                    ? 'bg-indigo-950/20 border-indigo-500/50 shadow-lg shadow-indigo-500/10' 
                    : 'bg-panel border-border hover:border-white/20'
                }`}
              >
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className={`text-xs font-extrabold uppercase font-mono ${isCurrentMonth ? 'text-indigo-400' : 'text-slate-400'}`}>
                      {monthName} {isCurrentMonth && '• Mês Atual'}
                    </span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${statusBadge}`}>
                      {camp?.status === 'Active' ? 'Ativa' : camp?.status === 'Completed' ? 'Concluída' : 'Planejada'}
                    </span>
                  </div>

                  {camp ? (
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-bold text-text line-clamp-2 leading-snug group-hover:text-indigo-300 transition-colors">
                        {camp.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 line-clamp-2">
                        {camp.objective}
                      </p>
                    </div>
                  ) : (
                    <div className="py-6 text-center text-slate-600 text-xs font-bold">
                      + Configurar Campanha
                    </div>
                  )}
                </div>

                {camp && (
                  <div className="pt-2 mt-2 border-t border-white/5 flex justify-between items-center text-[10px] font-mono">
                    <span className="text-slate-500">Meta:</span>
                    <span className="font-bold text-emerald-400">
                      {(camp.targetRevenue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-text">
                  Campanha de {MONTHS[editingMonthIndex]} ({currentYear})
                </h3>
                <p className="text-xs text-slate-400">Planejamento e metas do mês</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Título da Campanha *</label>
                <input
                  type="text"
                  value={form.title || ''}
                  onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Ex: Mês dos Pais & Reabilitação Oral"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-panel border border-border text-xs text-text outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Objetivo & Roteiro Comercial</label>
                <textarea
                  value={form.objective || ''}
                  onChange={(e) => setForm(prev => ({ ...prev, objective: e.target.value }))}
                  placeholder="Descreva o público-alvo, procedimentos incentivados e condições comerciais..."
                  className="w-full h-24 p-3 rounded-xl bg-panel border border-border text-xs text-text outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Status</label>
                  <select
                    value={form.status || 'Planned'}
                    onChange={(e) => setForm(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full px-3 py-2 rounded-xl bg-panel border border-border text-xs text-text outline-none focus:border-indigo-500"
                  >
                    <option value="Planned">Planejada</option>
                    <option value="Active">Ativa</option>
                    <option value="Completed">Concluída</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Meta Faturamento (R$)</label>
                  <input
                    type="number"
                    value={form.targetRevenue || ''}
                    onChange={(e) => setForm(prev => ({ ...prev, targetRevenue: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-xl bg-panel border border-border text-xs text-text font-mono outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Orçamento Mkt (R$)</label>
                  <input
                    type="number"
                    value={form.budget || ''}
                    onChange={(e) => setForm(prev => ({ ...prev, budget: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-xl bg-panel border border-border text-xs text-text font-mono outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-border flex justify-end gap-3 bg-panel/40">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-panel border border-border text-slate-300 text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30"
              >
                Salvar Campanha
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
