import React, { useState, useEffect } from 'react';
import { 
  FilePlus, Trash2, FolderOpen, X, FileText, 
  Calendar, CheckCircle2, Circle, Search, Loader2
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { toast } from 'sonner';
import { notifyDataChange } from '../../lib/realtime';

export interface ActionItem {
  id: string;
  task: string;
  owner: string;
  done: boolean;
  deadline?: string;
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  participants: string[];
  content: string;
  tags: string[];
  actionItems: ActionItem[];
  history?: { date: string; entry: string }[];
}

export const MeetingMinutes: React.FC = () => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewingMeeting, setViewingMeeting] = useState<Meeting | null>(null);

  // Form State
  const emptyForm = {
    title: '',
    date: new Date().toISOString().split('T')[0],
    participants: '',
    content: '',
    tags: '',
    actionItems: [] as ActionItem[]
  };

  const [formData, setFormData] = useState(emptyForm);
  const [newActionItem, setNewActionItem] = useState('');
  const [newActionOwner, setNewActionOwner] = useState('');
  const [newActionDeadline, setNewActionDeadline] = useState('');

  const loadMeetings = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('meetings').select('*');
      if (data) {
        setMeetings(data.map(m => ({
          id: m.id,
          title: m.title,
          date: m.date,
          participants: m.participants || [],
          content: m.content || '',
          tags: m.tags || [],
          actionItems: m.action_items || [],
          history: m.history || []
        })));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeetings();
  }, []);

  const handleAddActionItem = () => {
    if (!newActionItem.trim()) return;
    const item: ActionItem = {
      id: `act_${Date.now()}`,
      task: newActionItem,
      owner: newActionOwner || 'Geral',
      done: false,
      deadline: newActionDeadline || undefined
    };
    setFormData(prev => ({ ...prev, actionItems: [...prev.actionItems, item] }));
    setNewActionItem('');
    setNewActionOwner('');
    setNewActionDeadline('');
  };

  const handleRemoveActionItem = (id: string) => {
    setFormData(prev => ({ ...prev, actionItems: prev.actionItems.filter(i => i.id !== id) }));
  };

  const handleSaveMeeting = async () => {
    if (!formData.title.trim()) {
      toast.error('O título da reunião é obrigatório.');
      return;
    }

    const newMeeting = {
      id: 'mtg_' + Date.now(),
      title: formData.title,
      date: formData.date,
      participants: formData.participants.split(',').map(p => p.trim()).filter(Boolean),
      content: formData.content,
      tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
      action_items: formData.actionItems
    };

    const { error } = await supabase.from('meetings').insert(newMeeting);
    if (!error) {
      await loadMeetings();
      notifyDataChange('meetings');
      setIsModalOpen(false);
      setFormData(emptyForm);
      toast.success('Ata de reunião salva com sucesso!');
    } else {
      toast.error('Erro ao salvar reunião: ' + error.message);
    }
  };

  const handleDeleteMeeting = async (id: string) => {
    if (!window.confirm("Deseja realmente excluir esta ata de reunião?")) return;
    const { error } = await supabase.from('meetings').delete().eq('id', id);
    if (!error) {
      await loadMeetings();
      notifyDataChange('meetings');
      if (viewingMeeting?.id === id) setViewingMeeting(null);
      toast.success('Ata excluída com sucesso.');
    } else {
      toast.error('Erro ao excluir ata: ' + error.message);
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
      const updated = { ...meeting, actionItems: updatedItems };
      setMeetings(prev => prev.map(m => m.id === meetingId ? updated : m));
      if (viewingMeeting?.id === meetingId) setViewingMeeting(updated);
      notifyDataChange('meetings');
    }
  };

  const filteredMeetings = meetings.filter(m => 
    m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.participants.some(p => p.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-panel/60 border border-border p-4 rounded-2xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-text">Atas de Reuniões & Alinhamentos</h3>
            <p className="text-xs text-slate-400">Registro oficial de deliberações e tarefas da equipe</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por pauta ou participante..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-panel border border-border text-xs text-text placeholder:text-slate-500 outline-none focus:border-indigo-500"
            />
          </div>

          <button
            onClick={() => { setFormData(emptyForm); setIsModalOpen(true); }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition-all shrink-0"
          >
            <FilePlus className="w-4 h-4" />
            <span>Nova Ata</span>
          </button>
        </div>
      </div>

      {/* Loading Indicator or Grid of Meetings */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
          <p className="text-xs">Carregando atas de reuniões...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMeetings.length === 0 ? (
          <div className="col-span-full py-12 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-3xl text-slate-500">
            <FolderOpen className="w-10 h-10 mb-2 text-slate-600" />
            <p className="text-xs font-bold">Nenhuma ata registrada até o momento.</p>
          </div>
        ) : (
          filteredMeetings.map((meeting) => {
            const completedActions = meeting.actionItems.filter(i => i.done).length;
            const totalActions = meeting.actionItems.length;
            const progress = totalActions === 0 ? 0 : (completedActions / totalActions) * 100;

            return (
              <div
                key={meeting.id}
                onClick={() => setViewingMeeting(meeting)}
                className="bg-panel border border-border hover:border-indigo-500/40 p-5 rounded-2xl space-y-4 cursor-pointer transition-all hover:-translate-y-1 shadow-sm flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                      {meeting.date.split('-').reverse().join('/')}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteMeeting(meeting.id); }}
                      className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors"
                      title="Excluir Ata"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <h4 className="text-sm font-bold text-text leading-snug">{meeting.title}</h4>

                  <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                    {meeting.content || 'Sem transcrição detalhada.'}
                  </p>
                </div>

                {/* Footer Action Items progress */}
                <div className="pt-3 border-t border-white/5 space-y-2">
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>Plano de Ação:</span>
                    <span className="font-bold text-text">{completedActions}/{totalActions} concluídas</span>
                  </div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
        </div>
      )}

      {/* Modal for Viewing Meeting */}
      {viewingMeeting && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-indigo-400 uppercase font-bold">
                  {viewingMeeting.date.split('-').reverse().join('/')}
                </span>
                <h3 className="text-lg font-black text-text">{viewingMeeting.title}</h3>
              </div>
              <button onClick={() => setViewingMeeting(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
              {viewingMeeting.participants.length > 0 && (
                <div>
                  <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Participantes:</h5>
                  <div className="flex flex-wrap gap-1.5">
                    {viewingMeeting.participants.map((p, idx) => (
                      <span key={idx} className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 text-xs font-medium">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Conteúdo & Pauta:</h5>
                <div className="bg-slate-950/60 p-4 rounded-xl border border-white/5 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {viewingMeeting.content}
                </div>
              </div>

              <div>
                <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Tarefas & Plano de Ação:</h5>
                <div className="space-y-2">
                  {viewingMeeting.actionItems.map((act) => (
                    <div 
                      key={act.id}
                      onClick={() => toggleActionItem(viewingMeeting.id, act.id)}
                      className="flex items-center justify-between p-3 rounded-xl bg-panel border border-border hover:border-indigo-500/40 cursor-pointer transition-all"
                    >
                      <div className="flex items-center gap-2.5 text-xs">
                        {act.done ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Circle className="w-4 h-4 text-slate-500" />}
                        <span className={act.done ? 'line-through text-slate-500' : 'text-slate-200 font-medium'}>
                          {act.task}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded font-mono">
                        {act.owner} {act.deadline && `• ${act.deadline.split('-').reverse().slice(0, 2).join('/')}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-border flex justify-end bg-panel/40">
              <button
                onClick={() => setViewingMeeting(null)}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
              >
                Fechar Visualização
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Creating New Meeting */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="text-base font-extrabold text-text">Nova Ata de Reunião</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Título da Reunião *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Ex: Alinhamento Semanal de Vendas"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-panel border border-border text-xs text-text outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Data</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-panel border border-border text-xs text-text outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Participantes (separados por vírgula)</label>
                <input
                  type="text"
                  value={formData.participants}
                  onChange={(e) => setFormData(prev => ({ ...prev, participants: e.target.value }))}
                  placeholder="Dr. Roberto, Dra. Camila, Juliana (Recepção)..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-panel border border-border text-xs text-text outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Pauta, Decisões & Conteúdo</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Descreva os temas debatidos, decisões estratégicas e conclusões..."
                  className="w-full h-28 p-3 rounded-xl bg-panel border border-border text-xs text-text outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              {/* Action items builder */}
              <div className="space-y-2 pt-2 border-t border-white/5">
                <label className="text-xs font-bold text-slate-300 block">Adicionar Tarefas do Plano de Ação:</label>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    type="text"
                    placeholder="Descrição da tarefa..."
                    value={newActionItem}
                    onChange={(e) => setNewActionItem(e.target.value)}
                    className="sm:col-span-2 px-3 py-1.5 rounded-lg bg-panel border border-border text-xs text-text outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Responsável..."
                    value={newActionOwner}
                    onChange={(e) => setNewActionOwner(e.target.value)}
                    className="px-2 py-1.5 rounded-lg bg-panel border border-border text-xs text-text outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddActionItem}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                  >
                    + Adicionar
                  </button>
                </div>

                <div className="space-y-1.5 mt-2">
                  {formData.actionItems.map((act) => (
                    <div key={act.id} className="flex justify-between items-center p-2 rounded-lg bg-slate-950 border border-white/5 text-xs">
                      <span>• {act.task} (<strong className="text-indigo-400">{act.owner}</strong>)</span>
                      <button onClick={() => handleRemoveActionItem(act.id)} className="text-rose-400 p-1">
                        ✕
                      </button>
                    </div>
                  ))}
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
                onClick={handleSaveMeeting}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30"
              >
                Salvar Ata
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
