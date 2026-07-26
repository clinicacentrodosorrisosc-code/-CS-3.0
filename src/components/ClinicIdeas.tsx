import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Lightbulb, Trash2, Edit2, 
  CheckCircle2, Clock, PlayCircle, Archive,
  X, MessageSquare, Send,
  GripVertical, Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebaseConfig';
import { supabase } from '../supabaseClient';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy
} from 'firebase/firestore';
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragStartEvent,
  DragEndEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ClinicIdea {
  id: string;
  title: string;
  description: string;
  category: string;
  status: 'Idea' | 'Planning' | 'Implementing' | 'Done' | 'Archived';
  priority: 'Low' | 'Medium' | 'High';
  created_at: string;
  creator_id: string;
  creator_email: string;
  due_date?: string;
}

interface IdeaComment {
  id: string;
  text: string;
  user_id: string;
  user_email: string;
  created_at: any;
}

const CATEGORIES = ['Geral', 'Atendimento', 'Marketing', 'Estrutura', 'Processos', 'Tecnologia'];
const STATUS_OPTIONS = [
  { id: 'Idea', label: 'Ideia', icon: Lightbulb, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { id: 'Planning', label: 'Planejando', icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  { id: 'Implementing', label: 'Executando', icon: PlayCircle, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  { id: 'Done', label: 'Concluído', icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { id: 'Archived', label: 'Arquivado', icon: Archive, color: 'text-slate-400', bg: 'bg-slate-500/10' }
];

// Helper Functions
const getInitials = (email?: string) => {
  if (!email) return 'U';
  const parts = email.split('@');
  if (parts.length > 0) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return 'U';
};

const formatDueDate = (dateStr?: string) => {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
};

const getDueDateBadgeClass = (dateStr?: string, status?: string) => {
  if (!dateStr) return '';
  if (status === 'Done') return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
  
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(dateStr);
    dueDate.setHours(0, 0, 0, 0);
    
    if (dueDate < today) {
      return 'bg-rose-500/15 text-rose-400 border border-rose-500/30 font-bold';
    } else if (dueDate.getTime() - today.getTime() <= 24 * 60 * 60 * 1000) {
      return 'bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold';
    }
  } catch {
    // Ignore parsing errors
  }
  return 'bg-panel text-slate-400 border border-border';
};

const SortableIdeaCard = ({ idea, onEdit, onDelete, onStatusChange, onOpenComments }: any) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: idea.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-rose-500/20 text-rose-400';
      case 'Medium': return 'bg-amber-500/20 text-amber-400';
      case 'Low': return 'bg-emerald-500/20 text-emerald-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group bg-surface border border-border p-4 rounded-xl hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/5 transition-all cursor-default relative overflow-hidden flex flex-col gap-2"
    >
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-transparent group-hover:bg-indigo-500/30 transition-colors" />
      
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2">
          <button 
            {...attributes} 
            {...listeners} 
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-panel rounded text-slate-600 hover:text-slate-400 transition-colors"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg ${getPriorityColor(idea.priority)}`}>
            {idea.priority}
          </span>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={() => onEdit(idea)}
            className="p-1 hover:bg-panel/80 rounded text-slate-400 hover:text-text"
          >
            <Edit2 className="w-3 h-3" />
          </button>
          <button 
            onClick={() => onDelete(idea.id)}
            className="p-1 hover:bg-rose-500/10 rounded text-slate-400 hover:text-rose-400"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div>
        <h4 className="text-text text-sm font-bold leading-snug mb-1 group-hover:text-indigo-300 transition-colors">{idea.title}</h4>
        {idea.description && (
          <p className="text-slate-500 text-[11px] line-clamp-2 leading-relaxed">{idea.description}</p>
        )}
      </div>

      {idea.due_date && (
        <div className={`self-start inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-bold ${getDueDateBadgeClass(idea.due_date, idea.status)}`}>
          <Calendar className="w-3 h-3" />
          <span>Prazo: {formatDueDate(idea.due_date)}</span>
        </div>
      )}

      <div className="pt-3 border-t border-border flex items-center justify-between mt-1">
        <span className="text-[9px] font-bold text-indigo-500/60 uppercase tracking-wider">{idea.category}</span>
        <div className="flex items-center gap-2">
          {idea.creator_email && (
            <div 
              title={`Criado por: ${idea.creator_email}`}
              className="w-5 h-5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 flex items-center justify-center text-[8px] font-black"
            >
              {getInitials(idea.creator_email)}
            </div>
          )}
          <button 
            onClick={() => onOpenComments(idea)}
            className="p-1.5 hover:bg-panel rounded-lg text-slate-500 hover:text-indigo-400 transition-colors relative"
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </button>
          {idea.status !== 'Done' && idea.status !== 'Archived' && (
            <button 
              onClick={() => onStatusChange(idea)}
              className="text-[9px] text-indigo-400 hover:text-text bg-indigo-500/10 hover:bg-indigo-600 px-2 py-0.5 rounded-lg transition-all font-black uppercase tracking-wider"
            >
              Avançar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const ClinicIdeas: React.FC = () => {
  const [ideas, setIdeas] = useState<ClinicIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIdea, setEditingIdea] = useState<ClinicIdea | null>(null);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [selectedIdeaForComments, setSelectedIdeaForComments] = useState<ClinicIdea | null>(null);
  const [comments, setComments] = useState<IdeaComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  
  // Custom delete and user session states
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [ideaToDelete, setIdeaToDelete] = useState<string | null>(null);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Geral',
    status: 'Idea' as const,
    priority: 'Medium' as const,
    due_date: ''
  });

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUser(session.user);
      }
    };
    fetchUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'clinic_ideas'), orderBy('created_at', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ideasData: ClinicIdea[] = [];
      snapshot.forEach((doc) => {
        ideasData.push({ id: doc.id, ...doc.data() } as ClinicIdea);
      });
      setIdeas(ideasData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching ideas:", error);
      toast.error("Erro ao carregar ideias do Firestore");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleOpenModal = (idea?: ClinicIdea, initialStatus?: ClinicIdea['status']) => {
    if (idea) {
      setEditingIdea(idea);
      setFormData({
        title: idea.title,
        description: idea.description || '',
        category: idea.category || 'Geral',
        status: idea.status,
        priority: idea.priority,
        due_date: idea.due_date || ''
      });
    } else {
      setEditingIdea(null);
      setFormData({
        title: '',
        description: '',
        category: 'Geral',
        status: initialStatus || 'Idea',
        priority: 'Medium',
        due_date: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSaveIdea = async () => {
    if (!formData.title) return toast.error('O título é obrigatório');
    
    let activeUser = currentUser;
    if (!activeUser) {
      const { data: { user } } = await supabase.auth.getUser();
      activeUser = user;
    }
    
    if (!activeUser) return toast.error('Você precisa estar logado');

    try {
      if (editingIdea) {
        const ideaRef = doc(db, 'clinic_ideas', editingIdea.id);
        await updateDoc(ideaRef, {
          ...formData,
          updated_at: new Date().toISOString()
        });
        toast.success('Ideia atualizada');
      } else {
        const newIdeaData = {
          ...formData,
          created_at: new Date().toISOString(),
          creator_id: activeUser.id,
          creator_email: activeUser.email || ''
        };
        await addDoc(collection(db, 'clinic_ideas'), newIdeaData);
        toast.success('Ideia registrada');
      }
      setIsModalOpen(false);
    } catch (error: any) {
      console.error('Error saving idea:', error);
      toast.error('Erro ao salvar no Firestore');
    }
  };

  const updateIdeaStatus = async (idea: ClinicIdea) => {
    const nextStatusMap: Record<string, string> = {
      'Idea': 'Planning',
      'Planning': 'Implementing',
      'Implementing': 'Done',
      'Done': 'Done'
    };
    
    const nextStatus = nextStatusMap[idea.status] as ClinicIdea['status'];
    if (nextStatus === idea.status) return;

    try {
      const ideaRef = doc(db, 'clinic_ideas', idea.id);
      await updateDoc(ideaRef, {
        status: nextStatus,
        updated_at: new Date().toISOString()
      });
      toast.success(`Movido para ${STATUS_OPTIONS.find(s => s.id === nextStatus)?.label}`);
    } catch {
      toast.error("Erro ao atualizar status");
    }
  };

  const handleDeleteIdea = (id: string) => {
    setIdeaToDelete(id);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeIdea = ideas.find(i => i.id === active.id);
    if (!activeIdea) return;

    // Check if we dropped over a column (using status id as container id)
    const overId = over.id as string;
    const isColumn = STATUS_OPTIONS.some(s => s.id === overId);
    
    let newStatus = activeIdea.status;
    if (isColumn) {
      newStatus = overId as ClinicIdea['status'];
    } else {
      const overIdea = ideas.find(i => i.id === overId);
      if (overIdea) {
        newStatus = overIdea.status;
      }
    }

    if (newStatus !== activeIdea.status) {
      try {
        const ideaRef = doc(db, 'clinic_ideas', activeIdea.id);
        await updateDoc(ideaRef, {
          status: newStatus,
          updated_at: new Date().toISOString()
        });
      } catch {
        toast.error("Erro ao mover ideia");
      }
    }
  };

  const handleOpenComments = (idea: ClinicIdea) => {
    setSelectedIdeaForComments(idea);
    setIsCommentsOpen(true);
  };

  useEffect(() => {
    if (selectedIdeaForComments) {
      const q = query(
        collection(db, 'clinic_ideas', selectedIdeaForComments.id, 'comments'), 
        orderBy('created_at', 'asc')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const commentsData: IdeaComment[] = [];
        snapshot.forEach((doc) => {
          commentsData.push({ id: doc.id, ...doc.data() } as IdeaComment);
        });
        setComments(commentsData);
      });
      return () => unsubscribe();
    }
  }, [selectedIdeaForComments]);

  const handleAddComment = async () => {
    let activeUser = currentUser;
    if (!activeUser) {
      const { data: { user } } = await supabase.auth.getUser();
      activeUser = user;
    }
    if (!newComment.trim() || !selectedIdeaForComments || !activeUser) return;

    try {
      await addDoc(collection(db, 'clinic_ideas', selectedIdeaForComments.id, 'comments'), {
        text: newComment,
        user_id: activeUser.id,
        user_email: activeUser.email || 'Anônimo',
        created_at: new Date().toISOString()
      });
      setNewComment('');
    } catch {
      toast.error("Erro ao enviar comentário");
    }
  };

  const filteredIdeas = ideas.filter(idea => {
    const matchesSearch = idea.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (idea.description && idea.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = categoryFilter === 'All' || idea.category === categoryFilter;
    const matchesPriority = priorityFilter === 'All' || idea.priority === priorityFilter;
    
    return matchesSearch && matchesCategory && matchesPriority;
  });

  return (
    <div className="h-full flex flex-col gap-6 -mt-2">
      {/* Header with Search and Filters */}
      <div className="flex flex-col xl:flex-row gap-4 items-center justify-between bg-panel p-4 rounded-2xl border border-border">
        <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Pesquisar ideias..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface border border-border rounded-xl text-xs text-text focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-600"
            />
          </div>

          <div className="flex items-center gap-2">
            <select 
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-surface border border-border rounded-xl px-3 py-2 text-[10px] text-slate-300 font-bold uppercase focus:outline-none focus:border-indigo-500"
            >
              <option value="All">Todas Categorias</option>
              {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>

            <select 
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-surface border border-border rounded-xl px-3 py-2 text-[10px] text-slate-300 font-bold uppercase focus:outline-none focus:border-indigo-500"
            >
              <option value="All">Todas Prioridades</option>
              <option value="High">Alta</option>
              <option value="Medium">Média</option>
              <option value="Low">Baixa</option>
            </select>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full xl:w-auto justify-end">
          <div className="hidden sm:flex items-center gap-4 px-4 py-2 bg-panel rounded-xl border border-border">
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-slate-500 uppercase font-black tracking-tighter">Total</span>
              <span className="text-text text-xs font-black">{ideas.length}</span>
            </div>
            <div className="w-px h-5 bg-panel/80"></div>
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-indigo-400 uppercase font-black tracking-tighter">Filtradas</span>
              <span className="text-text text-xs font-black">{filteredIdeas.length}</span>
            </div>
          </div>
          
          <button 
            onClick={() => handleOpenModal()}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-text rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" /> Nova Ideia
          </button>
        </div>
      </div>

      {/* Kanban Board with DndContext */}
      <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-x-auto pb-4 custom-scrollbar">
          <div className="flex gap-6 min-w-[1200px] h-full">
            {STATUS_OPTIONS.map((column) => (
              <div key={column.id} className="flex-1 flex flex-col min-w-[280px] bg-panel rounded-2xl border border-border">
                {/* Column Header */}
                <div className="p-4 flex items-center justify-between border-b border-border">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${column.bg}`}>
                      <column.icon className={`w-4 h-4 ${column.color}`} />
                    </div>
                    <h3 className="text-xs font-black text-text uppercase tracking-wider">{column.label}</h3>
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-panel text-slate-500 text-[10px] font-black">
                      {filteredIdeas.filter(i => i.status === column.id).length}
                    </span>
                  </div>
                  <button 
                    onClick={() => handleOpenModal(undefined, column.id as any)}
                    className="p-1.5 hover:bg-panel rounded-lg text-slate-600 hover:text-text transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Column Content */}
                <div className="flex-1 p-3 space-y-3 overflow-y-auto custom-scrollbar bg-gradient-to-b from-transparent to-black/5">
                  <SortableContext 
                    items={filteredIdeas.filter(i => i.status === column.id).map(i => i.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {loading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-28 bg-panel rounded-xl border border-border animate-pulse"></div>
                      ))
                    ) : filteredIdeas.filter(i => i.status === column.id).length === 0 ? (
                      <div className="h-24 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl text-slate-800 opacity-50">
                        <column.icon className="w-5 h-5 mb-1" />
                        <span className="text-[9px] font-bold uppercase">Sem itens</span>
                      </div>
                    ) : (
                      filteredIdeas.filter(i => i.status === column.id).map((idea) => (
                        <SortableIdeaCard 
                          key={idea.id} 
                          idea={idea} 
                          onEdit={handleOpenModal}
                          onDelete={handleDeleteIdea}
                          onStatusChange={updateIdeaStatus}
                          onOpenComments={handleOpenComments}
                        />
                      ))
                    )}
                  </SortableContext>
                </div>
              </div>
            ))}
          </div>
        </div>

        <DragOverlay>
          {activeId ? (
            <div className="bg-surface border-2 border-indigo-500 p-4 rounded-xl shadow-2xl opacity-90 scale-105 rotate-2">
              <h4 className="text-text text-sm font-bold leading-snug">
                {ideas.find(i => i.id === activeId)?.title}
              </h4>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Discussion Drawer/Modal */}
      <AnimatePresence>
        {isCommentsOpen && selectedIdeaForComments && (
          <div className="fixed inset-0 z-[200] flex items-center justify-end">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-2xl"
              onClick={() => setIsCommentsOpen(false)}
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-md h-full bg-surface border-l border-border shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-border flex justify-between items-center bg-indigo-600/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/20 rounded-xl">
                    <MessageSquare className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-text uppercase tracking-wider leading-none mb-1">Discussão</h3>
                    <p className="text-[10px] text-slate-500 font-bold truncate max-w-[200px]">{selectedIdeaForComments.title}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsCommentsOpen(false)}
                  className="p-2 text-slate-400 hover:text-text transition-colors hover:bg-panel rounded-xl"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                {comments.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50 space-y-4">
                    <MessageSquare className="w-12 h-12" />
                    <p className="text-xs font-bold uppercase">Nenhum comentário ainda</p>
                  </div>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className={`flex flex-col gap-2 ${comment.user_id === currentUser?.id ? 'items-end' : 'items-start'}`}>
                      <div className="flex items-center gap-2 text-[9px] text-slate-500 font-black uppercase">
                        <span>{comment.user_email}</span>
                        <span>•</span>
                        <span>{new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className={`max-w-[85%] p-3 rounded-2xl text-[11px] font-semibold leading-relaxed ${
                        comment.user_id === currentUser?.id 
                          ? 'bg-indigo-600 text-text rounded-tr-none' 
                          : 'bg-panel text-slate-300 rounded-tl-none border border-border'
                      }`}>
                        {comment.text}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-6 border-t border-border bg-panel">
                <div className="flex gap-2">
                  <textarea 
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Escreva sua opinião ou sugestão..."
                    className="flex-1 bg-surface border border-border rounded-xl px-4 py-3 text-xs text-text focus:outline-none focus:border-indigo-500 transition-colors resize-none h-12"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAddComment();
                      }
                    }}
                  />
                  <button 
                    onClick={handleAddComment}
                    disabled={!newComment.trim()}
                    className="p-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-text rounded-xl shadow-lg shadow-indigo-600/20 transition-all active:scale-95 flex items-center justify-center"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Idea Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-2xl"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-surface border border-border rounded-3xl shadow-2xl overflow-hidden animate-none"
            >
              <div className="p-6 border-b border-border flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/20 rounded-xl">
                    <Lightbulb className="w-5 h-5 text-indigo-400" />
                  </div>
                  <h3 className="text-lg font-black text-text uppercase tracking-wider">
                    {editingIdea ? 'Editar Ideia' : 'Nova Ideia Clínica'}
                  </h3>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-text transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Título da Ideia</label>
                  <input 
                    type="text" 
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    placeholder="Ex: Novo protocolo de recepção"
                    className="w-full px-4 py-3 bg-panel border border-border rounded-xl text-xs text-text focus:outline-none focus:border-indigo-500 transition-colors font-bold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Descrição Detalhada</label>
                  <textarea 
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Descreva como isso beneficiaria a clínica..."
                    rows={4}
                    className="w-full px-4 py-3 bg-panel border border-border rounded-xl text-xs text-text focus:outline-none focus:border-indigo-500 transition-colors resize-none leading-relaxed font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Categoria</label>
                    <select 
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      className="w-full px-4 py-3 bg-panel border border-border rounded-xl text-xs text-text focus:outline-none focus:border-indigo-500 transition-colors appearance-none cursor-pointer font-bold"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Prioridade</label>
                    <select 
                      value={formData.priority}
                      onChange={(e) => setFormData({...formData, priority: e.target.value as any})}
                      className="w-full px-4 py-3 bg-panel border border-border rounded-xl text-xs text-text focus:outline-none focus:border-indigo-500 transition-colors appearance-none cursor-pointer font-bold"
                    >
                      <option value="Low">Baixa</option>
                      <option value="Medium">Média</option>
                      <option value="High">Alta</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Prazo de Conclusão</label>
                  <input 
                    type="date" 
                    value={formData.due_date}
                    onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                    className="w-full px-4 py-3 bg-panel border border-border rounded-xl text-xs text-text focus:outline-none focus:border-indigo-500 transition-colors font-bold cursor-pointer"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {STATUS_OPTIONS.map(status => (
                      <button
                        key={status.id}
                        type="button"
                        onClick={() => setFormData({...formData, status: status.id as any})}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${
                          formData.status === status.id 
                            ? status.bg + ' ' + status.color + ' border border-' + status.color.split('-')[1] + '-500/50' 
                            : 'bg-panel text-slate-600 border border-transparent hover:bg-panel/80'
                        }`}
                      >
                        <status.icon className="w-3 h-3" />
                        {status.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-border bg-panel flex gap-3">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3 text-slate-500 hover:text-text font-black text-[10px] uppercase tracking-widest transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSaveIdea}
                  className="flex-[2] px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-text rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-500/20 transition-all"
                >
                  {editingIdea ? 'Salvar Alterações' : 'Criar Ideia'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Delete Confirmation Modal */}
      <AnimatePresence>
        {ideaToDelete && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-2xl"
              onClick={() => setIdeaToDelete(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-surface border border-border rounded-3xl p-6 shadow-2xl text-center space-y-4"
            >
              <div className="mx-auto w-12 h-12 bg-rose-500/10 text-rose-400 rounded-full flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-text uppercase tracking-wider">Excluir Ideia?</h3>
                <p className="text-slate-400 text-xs font-medium">Tem certeza que deseja remover esta ideia permanentemente? Esta ação não pode ser desfeita.</p>
              </div>
              <div className="flex gap-2 pt-2">
                <button 
                  onClick={() => setIdeaToDelete(null)}
                  className="flex-1 px-4 py-2.5 bg-panel hover:bg-panel/80 text-slate-300 font-bold text-[10px] uppercase tracking-wider rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={async () => {
                    if (ideaToDelete) {
                      try {
                        await deleteDoc(doc(db, 'clinic_ideas', ideaToDelete));
                        toast.success('Ideia removida');
                      } catch {
                        toast.error("Erro ao remover ideia");
                      } finally {
                        setIdeaToDelete(null);
                      }
                    }
                  }}
                  className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-text font-bold text-[10px] uppercase tracking-wider rounded-xl transition-colors shadow-lg shadow-rose-600/20"
                >
                  Confirmar Exclusão
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
