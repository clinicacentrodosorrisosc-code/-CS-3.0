import React, { useState, useEffect } from 'react';
import { 
  Target, Plus, Trash2, Edit2, CheckSquare, Square, 
  Calendar, User, X
} from 'lucide-react';

export interface ManagementProject {
  id: string;
  title: string;
  description: string;
  status: 'ideation' | 'planning' | 'in_progress' | 'paused' | 'completed';
  priority: 'high' | 'medium' | 'low';
  owner: string;
  targetDate?: string;
  budget?: number;
  tags: string[];
  tasks: { id: string; text: string; done: boolean }[];
  updatedAt: string;
}

const COLUMNS: { id: ManagementProject['status']; label: string; icon: string; color: string }[] = [
  { id: 'ideation', label: 'Ideação & Radar', icon: '💡', color: 'border-amber-500/30 text-amber-400 bg-amber-950/20' },
  { id: 'planning', label: 'Planejamento', icon: '📋', color: 'border-indigo-500/30 text-indigo-400 bg-indigo-950/20' },
  { id: 'in_progress', label: 'Em Execução', icon: '⚡', color: 'border-rose-500/30 text-rose-400 bg-rose-950/20' },
  { id: 'paused', label: 'Em Espera', icon: '⏸️', color: 'border-slate-500/30 text-slate-400 bg-slate-950/20' },
  { id: 'completed', label: 'Concluído', icon: '✅', color: 'border-emerald-500/30 text-emerald-400 bg-emerald-950/20' }
];

export const ManagementProjects: React.FC = () => {
  const [projects, setProjects] = useState<ManagementProject[]>(() => {
    try {
      const saved = localStorage.getItem('odontomanager_vault_projects');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Error reading management projects:', e);
    }
    return [
      {
        id: 'proj_1',
        title: 'Aquisição de Scanner Intraoral 3D & Tomógrafo',
        description: 'Negociação de leasing e infraestrutura da sala de exames para fluxo 100% digital.',
        status: 'in_progress',
        priority: 'high',
        owner: 'Diretor Clínico',
        targetDate: '2026-10-30',
        budget: 180000,
        tags: ['Equipamentos', 'Digital', 'Investimento'],
        tasks: [
          { id: 't1', text: 'Cotação com 3 fornecedores (iTero, 3Shape, Medit)', done: true },
          { id: 't2', text: 'Adequação da rede elétrica e blindagem da sala', done: true },
          { id: 't3', text: 'Aprovação de linha de crédito BNDES / Leasing', done: false },
          { id: 't4', text: 'Treinamento da equipe de dentistas', done: false }
        ],
        updatedAt: new Date().toISOString()
      },
      {
        id: 'proj_2',
        title: 'Nova Tabela de Precificação & Repasses 2026',
        description: 'Auditoria de custos de insumos e repasses de especialistas para elevar margem líquida para 28%.',
        status: 'planning',
        priority: 'high',
        owner: 'Gestão Financeira',
        targetDate: '2026-09-15',
        budget: 0,
        tags: ['Financeiro', 'Margem', 'Comissões'],
        tasks: [
          { id: 't5', text: 'Reunião individual com cada especialista', done: true },
          { id: 't6', text: 'Atualização no sistema de precificação do software', done: false },
          { id: 't7', text: 'Elaboração de aditivos contratuais', done: false }
        ],
        updatedAt: new Date().toISOString()
      },
      {
        id: 'proj_3',
        title: 'Estudo de Viabilidade para 2ª Unidade (Filial Sul)',
        description: 'Análise de ponto comercial, fluxo de pedestres e concorrência no novo bairro.',
        status: 'ideation',
        priority: 'medium',
        owner: 'Sócios Administradores',
        targetDate: '2027-01-30',
        budget: 350000,
        tags: ['Expansão', 'Sócios', 'Nova Filial'],
        tasks: [
          { id: 't8', text: 'Visitar 4 imóveis comerciais disponíveis', done: true },
          { id: 't9', text: 'Elaborar estudo demográfico e poder aquisitivo', done: false }
        ],
        updatedAt: new Date().toISOString()
      }
    ];
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<ManagementProject>>({
    status: 'in_progress',
    priority: 'medium',
    tasks: []
  });
  const [newTaskInput, setNewTaskInput] = useState('');

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('odontomanager_vault_projects', JSON.stringify(projects));
    } catch (e) {
      console.warn('Error writing management projects:', e);
    }
  }, [projects]);

  const handleToggleTask = (projectId: string, taskId: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id === projectId) {
        return {
          ...p,
          tasks: p.tasks.map(t => t.id === taskId ? { ...t, done: !t.done } : t),
          updatedAt: new Date().toISOString()
        };
      }
      return p;
    }));
  };

  const handleOpenNew = (status: ManagementProject['status'] = 'in_progress') => {
    setEditingId(null);
    setFormData({
      title: '',
      description: '',
      status: status,
      priority: 'medium',
      owner: 'Gestão',
      targetDate: '',
      budget: 0,
      tags: [],
      tasks: []
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (project: ManagementProject) => {
    setEditingId(project.id);
    setFormData({
      ...project,
      tasks: [...project.tasks],
      tags: [...project.tags]
    });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.title) return;

    const newProj: ManagementProject = {
      id: editingId || 'proj_' + Date.now(),
      title: formData.title.trim(),
      description: formData.description?.trim() || '',
      status: formData.status || 'in_progress',
      priority: formData.priority || 'medium',
      owner: formData.owner?.trim() || 'Gestão',
      targetDate: formData.targetDate || '',
      budget: formData.budget || 0,
      tags: formData.tags || [],
      tasks: formData.tasks || [],
      updatedAt: new Date().toISOString()
    };

    if (editingId) {
      setProjects(prev => prev.map(p => p.id === editingId ? newProj : p));
    } else {
      setProjects(prev => [newProj, ...prev]);
    }

    setIsModalOpen(false);
    setFormData({});
  };

  const handleDelete = (id: string) => {
    if (!confirm('Excluir este projeto estratégico da gestão?')) return;
    setProjects(prev => prev.filter(p => p.id !== id));
  };

  const handleMoveStatus = (projectId: string, nextStatus: ManagementProject['status']) => {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: nextStatus, updatedAt: new Date().toISOString() } : p));
  };

  const handleAddTaskToForm = () => {
    if (!newTaskInput.trim()) return;
    const currentTasks = formData.tasks || [];
    setFormData({
      ...formData,
      tasks: [...currentTasks, { id: 't_' + Date.now(), text: newTaskInput.trim(), done: false }]
    });
    setNewTaskInput('');
  };

  const handleRemoveTaskFromForm = (id: string) => {
    setFormData({
      ...formData,
      tasks: (formData.tasks || []).filter(t => t.id !== id)
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-6 md:p-8">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface/60 border border-border p-4 md:p-6 rounded-3xl backdrop-blur-sm mb-6 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-indigo-400">
            <Target className="w-4 h-4" />
            <span>Quadro de Metas & Projetos Secretos</span>
          </div>
          <h2 className="text-2xl font-bold text-text mt-1">Iniciativas Estratégicas da Diretoria</h2>
          <p className="text-xs text-slate-400">Acompanhamento confidencial de expansões, investimentos e projetos de alta prioridade.</p>
        </div>

        <button
          onClick={() => handleOpenNew('in_progress')}
          className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-rose-900/40 transition-all active:scale-95 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>+ Novo Projeto</span>
        </button>
      </div>

      {/* ================= KANBAN BOARD ================= */}
      <div className="flex-1 overflow-x-auto pb-4 custom-scrollbar">
        <div className="flex items-start gap-4 min-w-[1200px] h-full">
          {COLUMNS.map(col => {
            const colProjects = projects.filter(p => p.status === col.id);
            return (
              <div
                key={col.id}
                className="w-72 md:w-80 flex flex-col h-full bg-surface/40 border border-border rounded-3xl p-3.5 flex-shrink-0"
              >
                {/* Column Header */}
                <div className={`flex items-center justify-between p-3 rounded-2xl border ${col.color} mb-3`}>
                  <div className="flex items-center gap-2">
                    <span className="text-base">{col.icon}</span>
                    <h3 className="text-xs font-bold uppercase tracking-wider">{col.label}</h3>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-black/40 text-slate-200">
                    {colProjects.length}
                  </span>
                </div>

                {/* Column Cards */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                  {colProjects.map(proj => {
                    const completedTasks = proj.tasks.filter(t => t.done).length;
                    const totalTasks = proj.tasks.length;
                    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

                    return (
                      <div
                        key={proj.id}
                        className="bg-panel hover:bg-surface border border-border hover:border-rose-500/40 p-4 rounded-2xl shadow-sm transition-all group flex flex-col gap-3"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                              proj.priority === 'high' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                              proj.priority === 'medium' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                              'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                            }`}>
                              {proj.priority === 'high' ? 'Alta Prioridade' : proj.priority === 'medium' ? 'Média Prioridade' : 'Baixa Prioridade'}
                            </span>

                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleOpenEdit(proj)}
                                className="p-1 text-slate-400 hover:text-white"
                                title="Editar"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(proj.id)}
                                className="p-1 text-slate-400 hover:text-rose-400"
                                title="Excluir"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <h4 className="text-sm font-bold text-text leading-snug">{proj.title}</h4>
                          {proj.description && (
                            <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                              {proj.description}
                            </p>
                          )}
                        </div>

                        {/* Checklist preview */}
                        {totalTasks > 0 && (
                          <div className="space-y-1.5 pt-2 border-t border-border/60">
                            <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                              <span>Checklist de Etapas</span>
                              <span>{completedTasks}/{totalTasks} ({progress}%)</span>
                            </div>
                            <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-rose-500 to-emerald-500 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <div className="space-y-1 mt-2">
                              {proj.tasks.slice(0, 3).map(task => (
                                <div
                                  key={task.id}
                                  onClick={() => handleToggleTask(proj.id, task.id)}
                                  className="flex items-center gap-2 text-xs text-slate-300 hover:text-white cursor-pointer py-0.5 select-none"
                                >
                                  {task.done ? (
                                    <CheckSquare className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                                  ) : (
                                    <Square className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                                  )}
                                  <span className={`text-[11px] truncate ${task.done ? 'line-through text-slate-500' : ''}`}>
                                    {task.text}
                                  </span>
                                </div>
                              ))}
                              {totalTasks > 3 && (
                                <span className="text-[10px] text-slate-500 italic block">
                                  + {totalTasks - 3} etapas...
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Meta Tags & Details */}
                        <div className="flex items-center justify-between pt-2 border-t border-border/60 text-[10px] text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3 h-3 text-slate-500" />
                            <span className="truncate max-w-[90px]">{proj.owner}</span>
                          </div>

                          {proj.targetDate && (
                            <div className="flex items-center gap-1 text-slate-400">
                              <Calendar className="w-3 h-3 text-slate-500" />
                              <span>{new Date(proj.targetDate + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                            </div>
                          )}

                          {proj.budget ? (
                            <div className="flex items-center gap-0.5 text-emerald-400 font-bold">
                              <span>R$ {(proj.budget / 1000).toFixed(0)}k</span>
                            </div>
                          ) : null}
                        </div>

                        {/* Move Status Quick Buttons */}
                        <div className="flex items-center justify-end gap-1 pt-1">
                          {COLUMNS.filter(c => c.id !== proj.status).map(c => (
                            <button
                              key={c.id}
                              onClick={() => handleMoveStatus(proj.id, c.id)}
                              className="px-2 py-0.5 rounded text-[9px] font-bold bg-panel hover:bg-surface border border-border text-slate-400 hover:text-text transition-colors"
                              title={`Mover para ${c.label}`}
                            >
                              {c.icon}
                            </button>
                          ))}
                        </div>

                      </div>
                    );
                  })}

                  {colProjects.length === 0 && (
                    <div className="h-32 rounded-2xl border border-dashed border-border/60 flex items-center justify-center text-slate-500 text-xs italic">
                      Nenhum projeto
                    </div>
                  )}
                </div>

                {/* Add Project to Column */}
                <button
                  onClick={() => handleOpenNew(col.id)}
                  className="w-full mt-2 py-2 px-3 rounded-xl border border-dashed border-border hover:border-rose-500/50 hover:bg-rose-950/20 text-slate-400 hover:text-rose-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ================= MODAL NOVO / EDITAR PROJETO ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-bold text-text">
                {editingId ? 'Editar Projeto Estratégico' : 'Novo Projeto da Gestão'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-text">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase">Título do Projeto *</label>
                <input
                  type="text"
                  value={formData.title || ''}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Aquisição de Scanner 3D, Nova Filial..."
                  className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-xs text-text outline-none focus:border-rose-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Estágio</label>
                  <select
                    value={formData.status || 'in_progress'}
                    onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-xs text-text outline-none font-bold"
                  >
                    {COLUMNS.map(c => (
                      <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Prioridade</label>
                  <select
                    value={formData.priority || 'medium'}
                    onChange={e => setFormData({ ...formData, priority: e.target.value as any })}
                    className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-xs text-text outline-none font-bold"
                  >
                    <option value="high">🔴 Alta Prioridade</option>
                    <option value="medium">🟡 Média Prioridade</option>
                    <option value="low">🟢 Baixa Prioridade</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Responsável</label>
                  <input
                    type="text"
                    value={formData.owner || ''}
                    onChange={e => setFormData({ ...formData, owner: e.target.value })}
                    placeholder="Ex: Sócios, Diretoria"
                    className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-xs text-text outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Prazo Alvo</label>
                  <input
                    type="date"
                    value={formData.targetDate || ''}
                    onChange={e => setFormData({ ...formData, targetDate: e.target.value })}
                    className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-xs text-text outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Orçamento (R$)</label>
                  <input
                    type="number"
                    value={formData.budget || ''}
                    onChange={e => setFormData({ ...formData, budget: Number(e.target.value) })}
                    placeholder="Ex: 50000"
                    className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-xs text-text outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase">Descrição & Objetivos</label>
                <textarea
                  value={formData.description || ''}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detalhes confidenciais, metas e escopo..."
                  className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-xs text-text outline-none min-h-[60px] resize-none"
                />
              </div>

              {/* Checklist builder */}
              <div className="p-4 bg-panel/60 border border-border rounded-2xl space-y-3">
                <span className="text-xs font-bold text-slate-300 uppercase block">Checklist de Etapas</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTaskInput}
                    onChange={e => setNewTaskInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTaskToForm())}
                    placeholder="+ Adicionar etapa do projeto..."
                    className="flex-1 bg-surface border border-border rounded-xl px-3 py-2 text-xs text-text outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddTaskToForm}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold"
                  >
                    Adicionar
                  </button>
                </div>

                <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                  {(formData.tasks || []).map(task => (
                    <div key={task.id} className="flex items-center justify-between p-2 rounded-xl bg-surface border border-border text-xs">
                      <span className="text-slate-200">{task.text}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTaskFromForm(task.id)}
                        className="text-slate-500 hover:text-rose-400"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-border bg-panel flex justify-end gap-2">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-400 hover:text-text text-xs font-bold">
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.title}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md"
              >
                Salvar Projeto
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
