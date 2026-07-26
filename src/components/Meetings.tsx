
import React, { useState, useEffect } from 'react';
import { Meeting, ActionItem } from '../types';
import { supabase } from '../supabaseClient';
import { 
  Users, FilePlus, Megaphone, Trash2, FolderOpen, X, FileText, 
  ListTodo, Check, User, ClipboardCheck, Circle
} from 'lucide-react';
import { toast } from 'sonner';
import { ClinicIdeas } from './ClinicIdeas';

// --- TYPES FOR CAMPAIGNS ---
interface Campaign {
    id?: string; 
    monthIndex: number; // 0-11
    year: number;
    title: string;
    objective: string;
    status: 'Planned' | 'Active' | 'Completed';
    targetRevenue?: number;
}

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const Meetings: React.FC<{ requestedSubTab?: string | null }> = ({ requestedSubTab }) => {
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<string>('campaign_calendar');
  
  // --- LOCAL STATE ---
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [currentYear] = useState(new Date().getFullYear());

  // Meeting Modal State (Create/Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Detail Modal State (Viewing)
  const [viewingMeeting, setViewingMeeting] = useState<Meeting | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<any>(null);

  const [newActionItem, setNewActionItem] = useState('');
  const [newActionOwner, setNewActionOwner] = useState('');
  const [newActionDeadline, setNewActionDeadline] = useState('');
  
  // Campaign Modal State
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [editingMonthIndex, setEditingMonthIndex] = useState<number | null>(null);
  const [campaignForm, setCampaignForm] = useState<Partial<Campaign>>({
      title: '', objective: '', status: 'Planned', targetRevenue: 0
  });
  
  const emptyForm = {
      title: '',
      date: new Date().toISOString().split('T')[0],
      participants: '',
      content: '',
      tags: '',
      actionItems: [] as ActionItem[]
  };

  const [formData, setFormData] = useState(emptyForm);

  // Init Data
  const loadData = async () => {
      setLoading(true);
      try {
          const { data: mtgs } = await supabase.from('meetings').select('*');
          if (mtgs) {
              setMeetings(mtgs.map(m => ({
                  id: m.id,
                  title: m.title,
                  date: m.date,
                  participants: m.participants || [],
                  content: m.content,
                  tags: m.tags || [],
                  actionItems: m.action_items || [],
                  history: m.history || [{date: m.date ? new Date(m.date).toISOString() : new Date().toISOString(), entry: "Ata criada"}]
              })));
          }
          
          const { data: camps } = await supabase.from('campaigns').select('*');
          if (camps) {
              setCampaigns(camps.map(c => ({
                  id: c.id,
                  monthIndex: c.month_index,
                  year: c.year,
                  title: c.title,
                  objective: c.objective,
                  status: c.status,
                  target_revenue: c.target_revenue
              })));
          }
      } catch (err) {
          console.error(err);
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
      loadData();
  }, []);

  useEffect(() => {
      if (requestedSubTab) {
          setActiveSubTab(requestedSubTab);
      }
  }, [requestedSubTab]);

  useEffect(() => {
    if (!viewingMeeting) {
      setIsEditing(false);
      setEditFormData(null);
    }
  }, [viewingMeeting]);

  // --- ACTIONS: MEETINGS ---

  const handleEditClick = () => {
    if (!viewingMeeting) return;
    setEditFormData({
      title: viewingMeeting.title,
      date: viewingMeeting.date,
      participants: viewingMeeting.participants.join(', '),
      content: viewingMeeting.content,
      tags: viewingMeeting.tags.join(', ')
    });
    setIsEditing(true);
  };

  const handleUpdateMeeting = async () => {
    if (!viewingMeeting || !editFormData) return;
    if (!editFormData.title) return toast.error('O título da reunião é obrigatório.');

    const updatedData = {
      title: editFormData.title,
      date: editFormData.date,
      participants: editFormData.participants.split(',').map((p: string) => p.trim()),
      content: editFormData.content,
      tags: editFormData.tags.split(',').map((t: string) => t.trim()).filter((t: string) => t !== ''),
      history: [
        ...(viewingMeeting.history || []),
        { date: new Date().toISOString(), entry: "Ata editada" }
      ]
    };

    const { error } = await supabase
      .from('meetings')
      .update({
        title: updatedData.title,
        date: updatedData.date,
        participants: updatedData.participants,
        content: updatedData.content,
        tags: updatedData.tags,
        history: updatedData.history
      })
      .eq('id', viewingMeeting.id);

    if (!error) {
      const updatedMeeting = { ...viewingMeeting, ...updatedData };
      setMeetings(meetings.map(m => m.id === viewingMeeting.id ? updatedMeeting : m));
      setViewingMeeting(updatedMeeting);
      setIsEditing(false);
      toast.success('Alterações salvas com sucesso!');
    } else {
      toast.error('Erro ao salvar alterações: ' + error.message);
    }
  };

  const handleAddActionItem = () => {
      if (!newActionItem) return;
      const newItem: ActionItem = {
          id: 'temp_' + Date.now().toString(),
          task: newActionItem,
          owner: newActionOwner || 'Geral',
          done: false,
          deadline: newActionDeadline || undefined
      };
      setFormData(prev => ({ ...prev, actionItems: [...prev.actionItems, newItem] }));
      setNewActionItem('');
      setNewActionOwner('');
      setNewActionDeadline('');
  };

  const handleRemoveActionItem = (id: string) => {
      setFormData(prev => ({ ...prev, actionItems: prev.actionItems.filter(i => i.id !== id) }));
  };

  const handleSaveMeeting = async () => {
      if (!formData.title) return toast.error('O título da reunião é obrigatório.');

      const newMeeting = {
          id: 'mtg_' + Date.now().toString(),
          title: formData.title,
          date: formData.date,
          participants: formData.participants.split(',').map(p => p.trim()),
          content: formData.content,
          tags: formData.tags.split(',').map(t => t.trim()).filter(t => t !== ''),
          action_items: formData.actionItems.map(item => ({...item, id: Date.now().toString() + Math.random()}))
      };

      const { error } = await supabase.from('meetings').insert(newMeeting);
      if (!error) {
          await loadData();
          setIsModalOpen(false);
          setFormData(emptyForm);
          toast.success('Reunião salva com sucesso!');
      } else {
          toast.error('Erro ao salvar reunião: ' + error.message);
      }
  };

  const handleDeleteMeeting = async (id: string) => {
      if (!window.confirm("Tem certeza que deseja excluir esta reunião e todas as tarefas vinculadas?")) return;
      const { error } = await supabase.from('meetings').delete().eq('id', id);
      if (!error) {
          await loadData();
          if (viewingMeeting?.id === id) setViewingMeeting(null);
          toast.success('Reunião excluída com sucesso.');
      } else {
          toast.error('Erro ao excluir reunião: ' + error.message);
      }
  };

  const toggleActionItem = async (meetingId: string, itemId: string) => {
      const meeting = meetings.find(m => m.id === meetingId);
      if (!meeting) return;

      const updatedItems = meeting.actionItems.map(i => 
          i.id === itemId ? { ...i, done: !i.done } : i
      );

      const { error } = await supabase.from('meetings').update({ action_items: updatedItems }).eq('id', meetingId);
      if (!error) {
          // Optimistic
          const updatedMeeting = { ...meeting, actionItems: updatedItems };
          setMeetings(meetings.map(m => m.id === meetingId ? updatedMeeting : m));
          if (viewingMeeting?.id === meetingId) setViewingMeeting(updatedMeeting);
      }
  };

  // --- ACTIONS: CAMPAIGNS ---

  const openCampaignModal = (monthIndex: number) => {
      setEditingMonthIndex(monthIndex);
      const existing = campaigns.find(c => c.monthIndex === monthIndex);
      if (existing) {
          setCampaignForm({ ...existing });
      } else {
          setCampaignForm({ title: '', objective: '', status: 'Planned', targetRevenue: 0 });
      }
      setIsCampaignModalOpen(true);
  };

  const handleSaveCampaign = async () => {
      if (editingMonthIndex === null || !campaignForm.title) return;

      const existing = campaigns.find(c => c.monthIndex === editingMonthIndex);
      
      const payload = {
          id: existing?.id || 'cmp_' + Date.now().toString(),
          month_index: editingMonthIndex,
          year: currentYear,
          title: campaignForm.title,
          objective: campaignForm.objective,
          status: campaignForm.status,
          target_revenue: campaignForm.targetRevenue
      };

      const { error } = await supabase.from('campaigns').upsert(payload);
      if (!error) await loadData();

      setIsCampaignModalOpen(false);
  };

  const handleDeleteCampaign = async (campaignId: string) => {
      if (!window.confirm("Deseja excluir esta campanha?")) return;
      const { error } = await supabase.from('campaigns').delete().eq('id', campaignId);
      if (!error) await loadData();
      if (isCampaignModalOpen) setIsCampaignModalOpen(false); 
  };

  const safeFormatDate = (dateStr: string, options?: Intl.DateTimeFormatOptions) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('pt-BR', options);
  };

  if (loading) return (
    <div className="flex-1 w-full h-full p-8 flex flex-col gap-6 animate-pulse bg-transparent">
      <div className="h-10 w-48 bg-panel rounded-lg mb-4"></div>
      <div className="flex-1 w-full bg-panel rounded-2xl border border-border mt-4"></div>
    </div>
  );

  return (
    <div className="flex-1 flex w-full h-full bg-transparent text-slate-300 font-sans overflow-hidden">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-transparent relative">
        
        {/* Topbar removed or simplified since we use main sidebar now */}
        {/* View Content */}
        <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-8 custom-scrollbar relative z-10 w-full">

           <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.05),transparent_40%),radial-gradient(circle_at_80%_80%,rgba(168,85,247,0.05),transparent_40%)] pointer-events-none fixed"></div>
           
           <div className="w-full h-full space-y-10 relative z-10">
               
               {/* SUB NAVIGATION BAR */}
               <div className="flex items-center gap-1 overflow-x-auto pb-4 no-scrollbar border-b border-border">
                    {[
                        { id: 'campaign_calendar', label: 'Calendário de Campanha' },
                        { id: 'meeting_minutes', label: 'Atas de Reuniões' },
                        { id: 'clinic_ideas', label: 'Ideias para a Clínica' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveSubTab(tab.id)}
                            className={`
                                px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap glass-button
                                ${activeSubTab === tab.id 
                                    ? 'bg-panel/80 text-text shadow-lg' 
                                    : 'text-slate-500 opacity-60 hover:opacity-100'}
                            `}
                        >
                            {tab.label}
                        </button>
                    ))}
               </div>

               <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                   <div>
                       <h1 className="text-4xl md:text-5xl font-bold text-text bg-transparent outline-none w-full block resize-none leading-tight tracking-tight mb-2">
                          {activeSubTab === 'campaign_calendar' ? 'Calendário de Campanhas' : 
                           activeSubTab === 'clinic_ideas' ? 'Ideias para a Clínica' : 'Atas de Reuniões'}
                       </h1>
                       <p className="text-slate-400 text-sm">
                          {activeSubTab === 'campaign_calendar'
                              ? 'Planejamento e acompanhamento das campanhas mensais e metas.'
                              : activeSubTab === 'clinic_ideas'
                              ? 'Espaço para sugerir, planejar e acompanhar inovações e melhorias para a clínica.'
                              : 'Registre e compartilhe os aprendizados e as tarefas de equipe.'}
                       </p>
                   </div>

                   <div className="flex gap-2 text-sm justify-end">
                      {activeSubTab === 'meeting_minutes' && (
                          <button 
                              onClick={() => { setFormData(emptyForm); setIsModalOpen(true); }}
                              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-text rounded-lg font-bold shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
                          >
                              <FilePlus className="w-4 h-4" /> Nova Ata
                          </button>
                      )}
                   </div>
               </div>

        {activeSubTab === 'campaign_calendar' && (
            <section className="relative z-10">
                <h3 className="text-lg font-bold text-text mb-4 flex items-center gap-2">
                    <Megaphone className="text-amber-400 w-5 h-5" /> 
                    Calendário de Campanhas ({currentYear})
                </h3>
                <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                    {MONTHS.map((month, idx) => {
                        const campaign = campaigns.find(c => c.monthIndex === idx);
                        const isCurrentMonth = new Date().getMonth() === idx;
                        
                        let statusColor = 'bg-slate-500/20 text-slate-400 border-slate-500/30';
                        if (campaign?.status === 'Active') statusColor = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
                        if (campaign?.status === 'Planned') statusColor = 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';

                        return (
                            <div 
                                key={idx}
                                onClick={() => openCampaignModal(idx)}
                                className={`
                                    min-w-[200px] p-4 rounded-2xl border transition-all cursor-pointer group hover:-translate-y-1 relative
                                    ${isCurrentMonth ? 'bg-indigo-900/20 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.15)]' : 'bg-panel border-border hover:border-white/20'}
                                `}
                            >
                                <div className="flex justify-between items-center mb-2">
                                    <span className={`text-xs font-bold uppercase ${isCurrentMonth ? 'text-text' : 'text-slate-500'}`}>{month}</span>
                                    {campaign && (
                                        <div className="flex items-center gap-1">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDeleteCampaign(campaign.id!); }}
                                                className="p-1 rounded-md text-slate-500 hover:text-red-400 hover:bg-panel/80 transition-colors z-20"
                                                title="Excluir Campanha"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                            <div className={`size-2 rounded-full ml-1 ${campaign.status === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-indigo-500'}`}></div>
                                        </div>
                                    )}
                                </div>
                                
                                {campaign ? (
                                    <div className="flex flex-col gap-1">
                                        <h4 className="font-bold text-text text-sm truncate">{campaign.title}</h4>
                                        <span className={`text-[10px] px-2 py-0.5 rounded border w-fit font-bold uppercase ${statusColor}`}>
                                            {campaign.status === 'Active' ? 'Ativa' : campaign.status === 'Planned' ? 'Planejada' : 'Concluída'}
                                        </span>
                                        {campaign.targetRevenue && campaign.targetRevenue > 0 && (
                                            <span className="text-[10px] text-slate-400 mt-1">Meta: R$ {campaign.targetRevenue.toLocaleString('pt-BR')}</span>
                                        )}
                                    </div>
                                ) : (
                                    <div className="h-12 flex items-center justify-center border-2 border-dashed border-border rounded-lg text-slate-600 group-hover:text-slate-400 group-hover:border-white/20">
                                        <span className="text-[10px] font-bold uppercase">+ Definir</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </section>
        )}

        {activeSubTab === 'meeting_minutes' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 relative z-10 pb-10">
                {meetings.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center p-12 border-2 border-dashed border-border rounded-3xl text-slate-500">
                        <FolderOpen className="w-10 h-10 mb-2" />
                        <p>Nenhuma ata registrada.</p>
                    </div>
                )}
                
                {meetings.map((meeting) => {
                    const completedActions = meeting.actionItems.filter(i => i.done).length;
                    const totalActions = meeting.actionItems.length;
                    const progress = totalActions === 0 ? 0 : (completedActions / totalActions) * 100;

                    return (
                        <article 
                            key={meeting.id} 
                            onClick={() => setViewingMeeting(meeting)}
                            className="bg-surface rounded-3xl border border-border overflow-hidden flex flex-col group hover:border-indigo-500/50 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300 relative cursor-pointer active:scale-[0.98]"
                        >
                            <div className="p-7 pb-4 border-b border-border">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-2 text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-indigo-500/20">
                                        {safeFormatDate(meeting.date)}
                                    </div>
                                    <div className="flex gap-1 flex-wrap justify-end">
                                        {meeting.tags.slice(0, 2).map(tag => (
                                            <span key={tag} className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-panel text-slate-400 border border-border truncate max-w-[80px]">{tag}</span>
                                        ))}
                                        {meeting.tags.length > 2 && <span className="text-[9px] text-slate-500 self-center">+{meeting.tags.length - 2}</span>}
                                    </div>
                                </div>
                                <h3 className="text-xl font-bold text-text leading-tight mb-3 group-hover:text-indigo-400 transition-colors line-clamp-2">{meeting.title}</h3>
                                <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                                    <Users className="w-4 h-4 text-slate-500" />
                                    <span className="truncate">{meeting.participants.join(', ')}</span>
                                </div>
                            </div>
                            
                            <div className="p-6 pt-4 flex-1 flex flex-col gap-4">
                                <div className="text-sm text-slate-400 leading-relaxed line-clamp-3 font-light">
                                    {meeting.content}
                                </div>
                                
                                <div className="mt-auto pt-4 flex justify-between items-center text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                                    <span>Plano de Ação</span>
                                    <span className={completedActions === totalActions && totalActions > 0 ? "text-emerald-400" : "text-indigo-400"}>{completedActions}/{totalActions} concluídos</span>
                                </div>
                                <div className="w-full h-1.5 bg-panel rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                                </div>
                            </div>
                            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        </article>
                    );
                })}
            </div>
        )}

        {activeSubTab === 'clinic_ideas' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <ClinicIdeas />
            </div>
        )}




        {/* DETAIL VIEW MODAL (EXPANDED) */}
        {viewingMeeting && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20 dark:bg-black/60 backdrop-blur-2xl p-4 animate-in fade-in duration-300">
                <div className="bg-surface border border-border w-full max-w-4xl rounded-3xl shadow-3xl overflow-hidden flex flex-col h-[90vh]">
                    {/* Modal Header */}
                    <div className="p-8 border-b border-border bg-surface flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
                        <div className="flex flex-col gap-2 flex-1">
                            {isEditing ? (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <input 
                                            type="date"
                                            value={editFormData.date}
                                            onChange={e => setEditFormData({...editFormData, date: e.target.value})}
                                            className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20 outline-none focus:border-indigo-500 transition-colors"
                                        />
                                        <input 
                                            type="text"
                                            value={editFormData.tags}
                                            onChange={e => setEditFormData({...editFormData, tags: e.target.value})}
                                            placeholder="Tags (separadas por vírgula)"
                                            className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-panel text-slate-400 border border-border outline-none focus:border-indigo-500 transition-colors flex-1"
                                        />
                                    </div>
                                    <input 
                                        type="text"
                                        value={editFormData.title}
                                        onChange={e => setEditFormData({...editFormData, title: e.target.value})}
                                        className="text-3xl font-bold text-text font-display leading-tight bg-transparent border-b border-border focus:border-indigo-500 outline-none w-full pb-1"
                                        placeholder="Título da Ata"
                                    />
                                    <div className="flex items-center gap-3 text-sm text-slate-400">
                                        <Users className="w-5 h-5 shrink-0" />
                                        <input 
                                            type="text"
                                            value={editFormData.participants}
                                            onChange={e => setEditFormData({...editFormData, participants: e.target.value})}
                                            className="font-medium bg-transparent border-b border-border focus:border-indigo-500 outline-none w-full py-1"
                                            placeholder="Participantes (separados por vírgula)"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                                            {safeFormatDate(viewingMeeting.date, { day: '2-digit', month: 'long', year: 'numeric' })}
                                        </span>
                                        <div className="flex gap-2">
                                            {viewingMeeting.tags.map(tag => (
                                                <span key={tag} className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-panel text-slate-400 border border-border">#{tag}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <h3 className="text-3xl font-bold text-text font-display leading-tight">{viewingMeeting.title}</h3>
                                    <div className="flex items-center gap-3 text-sm text-slate-400">
                                        <Users className="w-5 h-5" />
                                        <span className="font-medium">{viewingMeeting.participants.join(', ')}</span>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="flex gap-3 self-end md:self-center">
                            {isEditing ? (
                                <>
                                    <button 
                                        onClick={handleUpdateMeeting}
                                        className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-text rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg shadow-emerald-600/20"
                                    >
                                        Salvar
                                    </button>
                                    <button 
                                        onClick={() => setIsEditing(false)}
                                        className="px-6 py-3 bg-panel text-slate-400 hover:text-text rounded-xl font-bold text-xs uppercase tracking-widest transition-all"
                                    >
                                        Cancelar
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button 
                                        onClick={handleEditClick}
                                        className="p-3 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-text rounded-xl transition-all"
                                        title="Editar Ata"
                                    >
                                        <FilePlus className="w-5 h-5" />
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteMeeting(viewingMeeting.id)}
                                        className="p-3 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-text rounded-xl transition-all"
                                        title="Excluir Ata"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                    <button 
                                        onClick={() => setViewingMeeting(null)} 
                                        className="p-3 bg-panel text-slate-400 hover:text-text rounded-xl transition-all flex items-center gap-2"
                                    >
                                        <X className="w-5 h-5" />
                                        <span className="text-xs font-bold uppercase hidden sm:inline">Fechar</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Modal Content Area */}
                    <div className="flex-1 overflow-y-auto p-8 md:p-12 custom-scrollbar flex flex-col lg:flex-row gap-12">
                        {/* Text Content */}
                        <div className="flex-1 flex flex-col gap-8">
                            <div>
                                <div className="flex items-center gap-2 mb-6">
                                    <FileText className="text-indigo-400 w-5 h-5" />
                                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Ata da Reunião</h4>
                                </div>
                                {isEditing ? (
                                    <textarea 
                                        value={editFormData.content}
                                        onChange={e => setEditFormData({...editFormData, content: e.target.value})}
                                        className="w-full min-h-[400px] bg-panel border border-border rounded-2xl p-6 text-slate-200 leading-relaxed text-lg font-light outline-none focus:border-indigo-500 transition-all resize-none"
                                        placeholder="Conteúdo da Ata..."
                                    />
                                ) : (
                                    <div className="text-slate-300 leading-relaxed text-lg font-light whitespace-pre-wrap font-sans selection:bg-indigo-500/30">
                                        {viewingMeeting.content}
                                    </div>
                                )}
                            </div>

                            {/* History Section */}
                            {!isEditing && (
                                <div>
                                    <div className="flex items-center gap-2 mb-4">
                                        <ListTodo className="text-indigo-400 w-5 h-5" />
                                        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Histórico de Alterações</h4>
                                    </div>
                                    <div className="bg-panel rounded-xl p-4 border border-border space-y-3">
                                        {viewingMeeting.history?.map((h, i) => (
                                            <div key={i} className="flex gap-3 text-sm">
                                                <span className="text-slate-500 font-mono text-xs shrink-0">{safeFormatDate(h.date, {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'})}</span>
                                                <span className="text-slate-300">{h.entry}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Side Action Panel */}
                        <div className="w-full lg:w-80 shrink-0">
                            <div className="bg-panel rounded-2xl border border-border p-6 sticky top-0">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-2">
                                        <ListTodo className="text-emerald-400 w-5 h-5" />
                                        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-200">Plano de Ação</h4>
                                    </div>
                                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                                        {viewingMeeting.actionItems.filter(a => a.done).length}/{viewingMeeting.actionItems.length}
                                    </span>
                                </div>

                                <div className="flex flex-col gap-3">
                                    {viewingMeeting.actionItems.length > 0 ? viewingMeeting.actionItems.map(item => (
                                        <div 
                                            key={item.id} 
                                            onClick={() => toggleActionItem(viewingMeeting.id, item.id)}
                                            className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3 group/item ${
                                                item.done 
                                                ? 'bg-emerald-500/5 border-emerald-500/10' 
                                                : 'bg-panel border-border hover:border-indigo-500/30'
                                            }`}
                                        >
                                            <div className={`mt-0.5 size-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                                                item.done 
                                                ? 'bg-emerald-500 border-emerald-500' 
                                                : 'border-slate-700 group-hover/item:border-indigo-400'
                                            }`}>
                                                {item.done && <Check className="text-black w-3 h-3 font-bold" />}
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <span className={`text-sm leading-tight ${item.done ? 'text-slate-600 line-through' : 'text-slate-200'}`}>
                                                    {item.task}
                                                </span>
                                                <div className="flex items-center gap-3 opacity-60">
                                                    <div className="flex items-center gap-1.5">
                                                        <User className="w-3 h-3" />
                                                        <span className="text-[10px] font-bold uppercase tracking-tighter">{item.owner}</span>
                                                    </div>
                                                    {item.deadline && (
                                                        <div className="flex items-center gap-1.5 text-amber-400">
                                                            <span className="text-[10px] font-bold uppercase tracking-tighter">Prazo: {safeFormatDate(item.deadline, {day: '2-digit', month: '2-digit', year: 'numeric'})}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="text-center py-6 text-slate-600 border border-dashed border-border rounded-xl">
                                            <p className="text-xs">Nenhuma tarefa definida.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Meeting Modal (Create Form) */}
        {isModalOpen && (
            <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/20 dark:bg-black/60 backdrop-blur-2xl p-4 animate-in fade-in duration-200">
                <div className="bg-surface border border-border w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="p-6 border-b border-border bg-surface flex justify-between items-center shrink-0">
                        <h3 className="text-xl font-bold text-text font-display">Nova Ata de Reunião</h3>
                        <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-text"><X className="w-6 h-6" /></button>
                    </div>
                    <div className="p-6 overflow-y-auto flex flex-col gap-6 custom-scrollbar">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Título da Ata</label>
                                <input 
                                    value={formData.title} 
                                    onChange={e => setFormData({...formData, title: e.target.value})}
                                    placeholder="Ex: Alinhamento Comercial de Outubro" 
                                    className="bg-panel border border-border rounded-lg px-4 py-3 text-text focus:border-indigo-500 outline-none" 
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Data do Evento</label>
                                <input 
                                    type="date"
                                    value={formData.date} 
                                    onChange={e => setFormData({...formData, date: e.target.value})}
                                    className="bg-panel border border-border rounded-lg px-4 py-3 text-text focus:border-indigo-500 outline-none" 
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Participantes</label>
                                <input 
                                    value={formData.participants} 
                                    onChange={e => setFormData({...formData, participants: e.target.value})}
                                    placeholder="Separe por vírgula (ex: Ana, Dr. Pedro)" 
                                    className="bg-panel border border-border rounded-lg px-4 py-3 text-text focus:border-indigo-500 outline-none" 
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tags / Categorias</label>
                                <input 
                                    value={formData.tags} 
                                    onChange={e => setFormData({...formData, tags: e.target.value})}
                                    placeholder="Ex: Comercial, Financeiro, Clínica" 
                                    className="bg-panel border border-border rounded-lg px-4 py-3 text-text focus:border-indigo-500 outline-none" 
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pauta e Discussão</label>
                            <textarea 
                                value={formData.content} 
                                onChange={e => setFormData({...formData, content: e.target.value})}
                                placeholder="Descreva os pontos discutidos e decisões tomadas..." 
                                className="bg-panel border border-border rounded-lg px-4 py-3 text-text focus:border-indigo-500 outline-none min-h-[150px] resize-none" 
                            />
                        </div>

                        <div className="bg-panel rounded-xl p-5 border border-border shadow-inner">
                            <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <ClipboardCheck className="w-4 h-4" /> Definir Plano de Ação
                            </h4>
                            <div className="flex flex-col md:flex-row gap-2 mb-4">
                                <input 
                                    value={newActionItem}
                                    onChange={e => setNewActionItem(e.target.value)}
                                    placeholder="Ação necessária..." 
                                    className="flex-1 bg-panel border border-border rounded-lg px-3 py-2 text-sm text-text focus:border-indigo-500 outline-none"
                                />
                                <input 
                                    value={newActionOwner}
                                    onChange={e => setNewActionOwner(e.target.value)}
                                    placeholder="Responsável" 
                                    className="w-full md:w-1/3 bg-panel border border-border rounded-lg px-3 py-2 text-sm text-text focus:border-indigo-500 outline-none"
                                />
                                <input 
                                    type="date"
                                    value={newActionDeadline}
                                    onChange={e => setNewActionDeadline(e.target.value)}
                                    className="w-full md:w-1/4 bg-panel border border-border rounded-lg px-3 py-2 text-sm text-text focus:border-indigo-500 outline-none"
                                />
                                <button onClick={handleAddActionItem} className="bg-indigo-600 hover:bg-indigo-500 text-text rounded-lg px-6 py-2 font-bold text-sm transition-all">Add</button>
                            </div>
                            <div className="flex flex-col gap-2">
                                {formData.actionItems.map(item => (
                                    <div key={item.id} className="flex justify-between items-center bg-panel p-3 rounded-lg border border-border">
                                        <div className="flex items-center gap-2 text-sm text-slate-300">
                                            <Circle className="text-slate-600 w-3 h-3" />
                                            <span className="font-medium">{item.task}</span>
                                            <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full uppercase tracking-tighter">{item.owner}</span>
                                        </div>
                                        <button onClick={() => handleRemoveActionItem(item.id)} className="text-slate-500 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                ))}
                                {formData.actionItems.length === 0 && <span className="text-xs text-slate-600 italic text-center py-4 border border-dashed border-border rounded-lg">Pressione o botão 'Add' para incluir tarefas ao plano de ação.</span>}
                            </div>
                        </div>
                    </div>
                    <div className="p-6 border-t border-border bg-surface flex justify-end gap-3 shrink-0">
                        <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-semibold text-slate-400 hover:text-text transition-colors">Cancelar</button>
                        <button onClick={handleSaveMeeting} className="px-8 py-2.5 rounded-xl bg-indigo-600 text-text font-bold text-sm hover:bg-indigo-500 shadow-xl shadow-indigo-600/20">Salvar Ata</button>
                    </div>
                </div>
            </div>
        )}

        {/* Campaign Modal */}
        {isCampaignModalOpen && editingMonthIndex !== null && (
            <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/20 dark:bg-black/60 backdrop-blur-2xl p-4 animate-in fade-in duration-200">
                <div className="bg-surface border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-border bg-surface flex justify-between items-center">
                        <h3 className="text-xl font-bold text-text font-display">
                            Campanha Comercial: <span className="text-indigo-400">{MONTHS[editingMonthIndex]}</span>
                        </h3>
                        <div className="flex items-center gap-2">
                            {campaignForm.id && (
                                <button onClick={() => handleDeleteCampaign(campaignForm.id!)} className="text-red-400 hover:text-red-300 mr-2 p-1">
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            )}
                            <button onClick={() => setIsCampaignModalOpen(false)} className="text-slate-400 hover:text-text"><X className="w-6 h-6" /></button>
                        </div>
                    </div>
                    <div className="p-6 flex flex-col gap-5">
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Título da Campanha</label>
                            <input 
                                value={campaignForm.title} 
                                onChange={e => setCampaignForm({...campaignForm, title: e.target.value})}
                                placeholder="Ex: Mês dos Implantes, Novembro Azul" 
                                className="bg-panel border border-border rounded-lg px-4 py-3 text-text focus:border-indigo-500 outline-none" 
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Status Atual</label>
                            <select 
                                value={campaignForm.status} 
                                onChange={e => setCampaignForm({...campaignForm, status: e.target.value as any})}
                                className="bg-panel border border-border rounded-lg px-4 py-3 text-text focus:border-indigo-500 outline-none cursor-pointer"
                            >
                                <option value="Planned">Planejada</option>
                                <option value="Active">Ativa agora</option>
                                <option value="Completed">Concluída</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Meta de Faturamento (R$)</label>
                            <div className="relative">
                                <span className="absolute left-4 top-3.5 text-slate-500 text-sm">R$</span>
                                <input 
                                    type="number"
                                    value={campaignForm.targetRevenue} 
                                    onChange={e => setCampaignForm({...campaignForm, targetRevenue: parseFloat(e.target.value)})}
                                    className="w-full bg-panel border border-border rounded-lg pl-10 pr-4 py-3 text-text focus:border-indigo-500 outline-none" 
                                />
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Objetivo Estratégico</label>
                            <textarea 
                                value={campaignForm.objective} 
                                onChange={e => setCampaignForm({...campaignForm, objective: e.target.value})}
                                placeholder="Quais os principais canais e metas qualitativas?" 
                                className="bg-panel border border-border rounded-lg px-4 py-3 text-text focus:border-indigo-500 outline-none min-h-[100px] resize-none" 
                            />
                        </div>
                    </div>
                    <div className="p-6 border-t border-border bg-surface flex justify-end gap-3 shrink-0">
                        <button onClick={() => setIsCampaignModalOpen(false)} className="px-5 py-2.5 text-sm font-semibold text-slate-400 hover:text-text transition-colors">Cancelar</button>
                        <button onClick={handleSaveCampaign} className="px-8 py-2.5 rounded-xl bg-indigo-600 text-text font-bold text-sm hover:bg-indigo-500 shadow-lg">Salvar Configuração</button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  </div>
</div>
);
};
