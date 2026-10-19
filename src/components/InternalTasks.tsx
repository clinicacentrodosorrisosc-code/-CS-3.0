import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarDays, CheckCircle2, CircleDot, Clock3, Filter, Flag, LayoutGrid, ListChecks, Loader2, Plus, Search, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../supabaseClient';
import { PageHeader } from './ui/operational-ui';

type TaskStatus = 'todo' | 'progress' | 'review' | 'done';
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
type Profile = { id: string; email: string | null };
type Project = { id: string; name: string; description: string | null; color: string };
type ClinicTask = { id: string; project_id: string | null; title: string; description: string | null; status: TaskStatus; priority: TaskPriority; assignee_id: string | null; due_date: string | null; created_at: string };

const columns: { id: TaskStatus; label: string; className: string; icon: React.ElementType }[] = [
  { id: 'todo', label: 'A fazer', className: 'border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300', icon: CircleDot },
  { id: 'progress', label: 'Em andamento', className: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300', icon: Clock3 },
  { id: 'review', label: 'Em revisão', className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300', icon: AlertCircle },
  { id: 'done', label: 'Concluído', className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300', icon: CheckCircle2 },
];
const priorities: Record<TaskPriority, { label: string; className: string }> = {
  low: { label: 'Baixa', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  medium: { label: 'Média', className: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' },
  high: { label: 'Alta', className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' },
  urgent: { label: 'Urgente', className: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300' },
};
const emptyTask = { title: '', description: '', project_id: '', assignee_id: '', due_date: '', priority: 'medium' as TaskPriority };

export const InternalTasks: React.FC<{ currentUserId: string }> = ({ currentUserId }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<ClinicTask[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [projectFilter, setProjectFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [taskModal, setTaskModal] = useState(false);
  const [projectModal, setProjectModal] = useState(false);
  const [taskForm, setTaskForm] = useState(emptyTask);
  const [projectForm, setProjectForm] = useState({ name: '', description: '', color: '#2563eb' });

  const load = useCallback(async () => {
    setLoading(true);
    const [projectResult, taskResult, profileResult] = await Promise.all([
      supabase.from('task_projects').select('id,name,description,color').order('created_at', { ascending: false }),
      supabase.from('clinic_tasks').select('id,project_id,title,description,status,priority,assignee_id,due_date,created_at').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id,email').order('email'),
    ]);
    const error = projectResult.error || taskResult.error || profileResult.error;
    if (error) toast.error('Não foi possível carregar as tarefas.', { description: error.message });
    setProjects((projectResult.data || []) as Project[]);
    setTasks((taskResult.data || []) as ClinicTask[]);
    setProfiles((profileResult.data || []) as Profile[]);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const projectById = useMemo(() => new Map(projects.map(project => [project.id, project])), [projects]);
  const profileById = useMemo(() => new Map(profiles.map(profile => [profile.id, profile])), [profiles]);
  const shownTasks = useMemo(() => tasks.filter(task => {
    const term = search.trim().toLowerCase();
    return (projectFilter === 'all' || task.project_id === projectFilter)
      && (assigneeFilter === 'all' || task.assignee_id === assigneeFilter)
      && (!term || `${task.title} ${task.description || ''}`.toLowerCase().includes(term));
  }), [tasks, projectFilter, assigneeFilter, search]);
  const today = new Date().toISOString().slice(0, 10);
  const openCount = tasks.filter(task => task.status !== 'done').length;
  const myCount = tasks.filter(task => task.status !== 'done' && task.assignee_id === currentUserId).length;
  const overdueCount = tasks.filter(task => task.status !== 'done' && task.due_date && task.due_date < today).length;

  const createProject = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!projectForm.name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.from('task_projects').insert({ ...projectForm, name: projectForm.name.trim(), description: projectForm.description.trim() || null, created_by: currentUserId }).select('id,name,description,color').single();
    setSaving(false);
    if (error) return toast.error('Não foi possível criar o projeto.', { description: error.message });
    setProjects(current => [data as Project, ...current]);
    setProjectFilter(data.id);
    setProjectForm({ name: '', description: '', color: '#2563eb' });
    setProjectModal(false);
    toast.success('Projeto interno criado.');
  };
  const createTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!taskForm.title.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.from('clinic_tasks').insert({ title: taskForm.title.trim(), description: taskForm.description.trim() || null, project_id: taskForm.project_id || null, assignee_id: taskForm.assignee_id || null, due_date: taskForm.due_date || null, priority: taskForm.priority, created_by: currentUserId }).select('id,project_id,title,description,status,priority,assignee_id,due_date,created_at').single();
    setSaving(false);
    if (error) return toast.error('Não foi possível criar a tarefa.', { description: error.message });
    setTasks(current => [data as ClinicTask, ...current]);
    setTaskForm(emptyTask);
    setTaskModal(false);
    toast.success('Tarefa incluída no quadro.');
  };
  const changeStatus = async (task: ClinicTask, status: TaskStatus) => {
    if (task.status === status) return;
    setTasks(current => current.map(item => item.id === task.id ? { ...item, status } : item));
    const { error } = await supabase.from('clinic_tasks').update({ status }).eq('id', task.id);
    if (error) { setTasks(current => current.map(item => item.id === task.id ? task : item)); toast.error('Não foi possível atualizar a tarefa.', { description: error.message }); }
  };
  const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${value}T12:00:00`)) : 'Sem prazo';

  return <div className="tasks-workspace flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[var(--surface)] text-[var(--text)]">
    <PageHeader icon={LayoutGrid} title="Trabalhos e tarefas" description="Demandas internas da clínica, sem misturar com trabalhos de laboratório." actions={<><button type="button" onClick={() => setProjectModal(true)} className="btn btn-secondary"><Plus className="size-4" /> Novo projeto</button><button type="button" onClick={() => setTaskModal(true)} className="btn btn-primary"><Plus className="size-4" /> Nova tarefa</button></>} />
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 lg:px-8 custom-scrollbar"><div className="analytics-metric-grid tasks-metrics mb-4 grid gap-3 sm:grid-cols-3"><Metric icon={ListChecks} label="Em aberto" value={openCount} tone="text-blue-600" /><Metric icon={Users} label="Minhas pendências" value={myCount} tone="text-violet-600" /><Metric icon={AlertCircle} label="Atrasadas" value={overdueCount} tone={overdueCount ? 'text-rose-600' : 'text-emerald-600'} /></div>
      <div className="tasks-filterbar mb-5 flex flex-col gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3 lg:flex-row"><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar tarefa" className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500" /></div><div className="flex gap-2"><Filter className="mt-2 size-4 text-[var(--text-muted)]" /><select value={projectFilter} onChange={event => setProjectFilter(event.target.value)} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-2 py-2 text-sm"><option value="all">Todos os projetos</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select><select value={assigneeFilter} onChange={event => setAssigneeFilter(event.target.value)} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-2 py-2 text-sm"><option value="all">Toda a equipe</option>{profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.email || 'Usuário'}</option>)}</select></div></div>
      {loading ? <div className="grid min-h-56 place-items-center"><Loader2 className="size-6 animate-spin text-blue-600" /></div> : <div className="overflow-x-auto"><div className="tasks-board grid min-w-[920px] grid-cols-4 gap-3 pb-4">{columns.map(column => { const Icon = column.icon; const items = shownTasks.filter(task => task.status === column.id); return <section key={column.id} className="task-column min-h-[340px] rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-2.5"><header className={`mb-2 flex items-center justify-between rounded-lg border px-2.5 py-2 ${column.className}`}><span className="flex items-center gap-2 text-xs font-bold"><Icon className="size-3.5" />{column.label}</span><span className="text-xs font-bold">{items.length}</span></header><div className="space-y-2">{items.map(task => <article key={task.id} className="task-card rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] p-3 shadow-sm"><div className="mb-2 flex items-start justify-between gap-2"><h3 className="text-sm font-semibold leading-snug">{task.title}</h3><span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${priorities[task.priority].className}`}><Flag className="mr-0.5 inline size-2.5" />{priorities[task.priority].label}</span></div>{task.description && <p className="mb-2 line-clamp-2 text-xs text-[var(--text-muted)]">{task.description}</p>}{task.project_id && <p className="mb-2 flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]"><span className="size-2 rounded-full" style={{ backgroundColor: projectById.get(task.project_id)?.color || '#64748b' }} />{projectById.get(task.project_id)?.name || 'Projeto removido'}</p>}<div className="flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-2"><span className="max-w-[120px] truncate text-[11px] text-[var(--text-muted)]">{task.assignee_id ? profileById.get(task.assignee_id)?.email || 'Responsável' : 'Sem responsável'}</span><span className={`flex items-center gap-1 text-[11px] ${task.due_date && task.due_date < today && task.status !== 'done' ? 'font-semibold text-rose-600' : 'text-[var(--text-muted)]'}`}><CalendarDays className="size-3" />{formatDate(task.due_date)}</span></div><select value={task.status} onChange={event => void changeStatus(task, event.target.value as TaskStatus)} aria-label={`Mover ${task.title}`} className="mt-2 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-1.5 text-[11px] font-medium">{columns.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></article>)}{items.length === 0 && <button onClick={() => { setTaskForm(form => ({ ...form, project_id: projectFilter === 'all' ? form.project_id : projectFilter })); setTaskModal(true); }} className="w-full rounded-lg border border-dashed border-[var(--border-subtle)] px-3 py-5 text-xs text-[var(--text-muted)] hover:border-blue-400 hover:text-blue-600">+ Adicionar tarefa</button>}</div></section>; })}</div></div>}
    </div>
    {taskModal && <Dialog title="Nova tarefa" close={() => setTaskModal(false)}><form onSubmit={createTask} className="space-y-3"><Field label="Título"><input required autoFocus value={taskForm.title} onChange={event => setTaskForm(form => ({ ...form, title: event.target.value }))} placeholder="Ex.: Atualizar roteiro de atendimento" /></Field><Field label="Descrição"><textarea rows={3} value={taskForm.description} onChange={event => setTaskForm(form => ({ ...form, description: event.target.value }))} placeholder="Contexto e resultado esperado" /></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Projeto"><select value={taskForm.project_id} onChange={event => setTaskForm(form => ({ ...form, project_id: event.target.value }))}><option value="">Sem projeto</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></Field><Field label="Responsável"><select value={taskForm.assignee_id} onChange={event => setTaskForm(form => ({ ...form, assignee_id: event.target.value }))}><option value="">Definir depois</option>{profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.email || 'Usuário'}</option>)}</select></Field><Field label="Prazo"><input type="date" value={taskForm.due_date} onChange={event => setTaskForm(form => ({ ...form, due_date: event.target.value }))} /></Field><Field label="Prioridade"><select value={taskForm.priority} onChange={event => setTaskForm(form => ({ ...form, priority: event.target.value as TaskPriority }))}>{Object.entries(priorities).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select></Field></div><Submit saving={saving} label="Criar tarefa" /></form></Dialog>}
    {projectModal && <Dialog title="Novo projeto interno" close={() => setProjectModal(false)}><form onSubmit={createProject} className="space-y-3"><Field label="Nome do projeto"><input required autoFocus value={projectForm.name} onChange={event => setProjectForm(form => ({ ...form, name: event.target.value }))} placeholder="Ex.: Melhoria da recepção" /></Field><Field label="Objetivo"><textarea rows={3} value={projectForm.description} onChange={event => setProjectForm(form => ({ ...form, description: event.target.value }))} placeholder="O que a equipe precisa concluir?" /></Field><Field label="Cor"><input type="color" value={projectForm.color} onChange={event => setProjectForm(form => ({ ...form, color: event.target.value }))} className="h-10 p-1" /></Field><Submit saving={saving} label="Criar projeto" /></form></Dialog>}
  </div>;
};

const Metric: React.FC<{ icon: React.ElementType; label: string; value: number; tone: string }> = ({ icon: Icon, label, value, tone }) => <div className="analytics-card analytics-metric analytics-metric--compact analytics-card analytics-metric tasks-metric flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3"><div className={`analytics-icon grid size-9 place-items-center rounded-lg bg-[var(--surface-hover)] ${tone}`}><Icon className="size-4" /></div><div><p className="text-xs text-[var(--text-muted)]">{label}</p><p className="analytics-value text-lg font-bold leading-tight">{value}</p></div></div>;
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => <label className="block text-sm font-medium"><span className="mb-1.5 block">{label}</span><div className="[&>input]:w-full [&>input]:rounded-lg [&>input]:border [&>input]:border-[var(--border-subtle)] [&>input]:bg-[var(--surface)] [&>input]:px-3 [&>input]:py-2 [&>select]:w-full [&>select]:rounded-lg [&>select]:border [&>select]:border-[var(--border-subtle)] [&>select]:bg-[var(--surface)] [&>select]:px-3 [&>select]:py-2 [&>textarea]:w-full [&>textarea]:resize-none [&>textarea]:rounded-lg [&>textarea]:border [&>textarea]:border-[var(--border-subtle)] [&>textarea]:bg-[var(--surface)] [&>textarea]:px-3 [&>textarea]:py-2">{children}</div></label>;
const Dialog: React.FC<{ title: string; close: () => void; children: React.ReactNode }> = ({ title, close, children }) => <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-label={title}><div className="w-full max-w-lg rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 shadow-2xl"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">{title}</h2><button type="button" onClick={close} className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-hover)]" aria-label="Fechar"><X className="size-4" /></button></div>{children}</div></div>;
const Submit: React.FC<{ saving: boolean; label: string }> = ({ saving, label }) => <div className="flex justify-end pt-2"><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving && <Loader2 className="size-4 animate-spin" />}{label}</button></div>;
