import React, { useState, useEffect, useMemo } from 'react';
import { SupportTicket } from '../types';
import { supabase } from '../supabaseClient';
import { Plus, ClipboardCheck, Trash2, Tag, CheckCircle, Clock, AlertCircle, X } from 'lucide-react';

interface SupportProps {
    userRole?: string;
    allowedSubTabs?: string[];
}

export const Support: React.FC<SupportProps> = () => {
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<'Todas' | 'Aberto' | 'Resolvido'>('Todas');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    
    // New Ticket Form
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        category: 'Sistema',
        priority: 'Media'
    });

    const loadData = async () => {
        setLoading(true);
        setErrorMessage(null);
        try {
            const { data, error } = await supabase.from('support_tickets').select('*');
            if (error) {
                console.error("Supabase error fetching tickets:", error);
                if (error.code === '42P01') {
                    setErrorMessage("A tabela 'support_tickets' não existe no Supabase. Execute o SQL em database_schema.sql.");
                } else {
                    setErrorMessage(`Erro ao carregar chamados: ${error.message}`);
                }
                return;
            }
            if (data) {
                setTickets(data.map(t => ({
                    id: t.id,
                    title: t.title,
                    description: t.description,
                    category: t.category,
                    priority: t.priority,
                    status: t.status,
                    createdAt: t.created_at,
                    createdBy: t.created_by
                })));
            }
        } catch (error: any) {
            console.error("Error loading tickets:", error);
            setErrorMessage("Falha na conexão com o servidor de banco de dados.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleCreateTicket = async () => {
        if (!formData.title || !formData.description) return;

        const newTicket = {
            id: 'tkt_' + Date.now(),
            title: formData.title,
            description: formData.description,
            category: formData.category,
            priority: formData.priority,
            status: 'Aberto',
            created_at: new Date().toISOString(),
            created_by: 'Usuário'
        };

        const { error } = await supabase.from('support_tickets').insert(newTicket);
        
        if (!error) {
            await loadData();
            setIsModalOpen(false);
            setFormData({ title: '', description: '', category: 'Sistema', priority: 'Media' });
        } else {
            alert(`Erro ao criar ticket: ${error.message}`);
        }
    };

    const updateStatus = async (id: string, newStatus: string) => {
        const { error } = await supabase.from('support_tickets').update({ status: newStatus }).eq('id', id);
        if (!error) {
            setTickets(prev => prev.map(t => t.id === id ? { ...t, status: newStatus as any } : t));
        } else {
            alert(`Erro ao atualizar: ${error.message}`);
        }
    };

    const deleteTicket = async (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation(); 
        
        if(!window.confirm("Tem certeza que deseja excluir este chamado permanentemente?")) return;
        
        try {
            const { error } = await supabase.from('support_tickets').delete().eq('id', id);
            
            if (error) {
                throw error;
            }

            setTickets(prev => prev.filter(t => t.id !== id));
        } catch (err: any) {
            console.error("Erro detalhado ao excluir:", err);
            alert(`Não foi possível excluir o ticket.\nErro: ${err.message || 'Desconhecido'}`);
        }
    };

    const filteredTickets = useMemo(() => {
        if (filterStatus === 'Todas') return tickets;
        if (filterStatus === 'Resolvido') return tickets.filter(t => t.status === 'Resolvido');
        return tickets.filter(t => t.status !== 'Resolvido');
    }, [tickets, filterStatus]);

    const stats = useMemo(() => {
        const open = tickets.filter(t => t.status !== 'Resolvido').length;
        const critical = tickets.filter(t => t.status !== 'Resolvido' && t.priority === 'Critica').length;
        return { open, critical };
    }, [tickets]);

    const safeFormatDate = (dateStr: string) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '-';
        return d.toLocaleDateString('pt-BR');
    };

  return (
    <div className="flex-1 flex w-full h-full bg-transparent text-slate-300 font-sans overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 bg-transparent relative">
        <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-8 custom-scrollbar relative z-10 w-full">
           <div className="w-full min-h-full space-y-10 relative z-10">
               
               <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                   <div>
                       <h1 className="text-4xl md:text-5xl font-bold text-text leading-tight tracking-tight mb-2">
                          Chamados & Suporte
                       </h1>
                       <p className="text-slate-400 text-sm">Relate problemas no sistema, operacionais ou de manutenção.</p>
                   </div>

                   <div className="flex gap-4 items-center">
                       <div className="card p-3 flex items-center gap-3">
                           <div className="flex flex-col">
                               <span className="text-[10px] text-slate-400 uppercase font-bold">Pendentes</span>
                               <span className="text-xl font-bold text-text">{stats.open}</span>
                           </div>
                           <div className="w-px h-8 bg-slate-800"></div>
                           <div className="flex flex-col">
                               <span className="text-[10px] text-slate-400 uppercase font-bold">Críticos</span>
                               <span className="text-xl font-bold text-red-400">{stats.critical}</span>
                           </div>
                       </div>
                       <button 
                           onClick={() => setIsModalOpen(true)}
                           className="btn btn-primary h-fit self-center py-3"
                       >
                           <Plus className="w-5 h-5" /> Novo Chamado
                       </button>
                   </div>
               </div>

               <div className="flex-1 w-full pb-20">
                    {errorMessage && (
                        <div className="mb-8 p-6 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-300 relative z-20">
                            <div className="p-2 bg-red-500/20 rounded-lg text-red-400">
                                <AlertCircle className="w-6 h-6" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-text mb-1">Problema Detectado</h3>
                                <p className="text-slate-300 text-sm leading-relaxed">{errorMessage}</p>
                                <button 
                                    onClick={() => loadData()}
                                    className="mt-4 btn btn-ghost text-xs"
                                >
                                    Tentar Novamente
                                </button>
                            </div>
                        </div>
                    )}

            {/* Filters */}
            <div className="flex gap-2 relative z-10 border-b border-border pb-4">
                {['Todas', 'Aberto', 'Resolvido'].map(status => (
                    <button
                        key={status}
                        onClick={() => setFilterStatus(status as any)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            filterStatus === status 
                            ? 'bg-purple-600 text-white shadow-md' 
                            : 'btn-ghost'
                        }`}
                    >
                        {status === 'Aberto' ? 'Em Aberto' : status}
                    </button>
                ))}
            </div>

            {/* Tickets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10 pb-10 mt-6">
                {loading ? (
                    <>
                        {[1, 2, 3].map(i => (
                            <div key={i} className="card p-5 flex flex-col animate-pulse">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="w-12 h-4 bg-slate-800 rounded"></div>
                                    <div className="w-16 h-3 bg-slate-800 rounded"></div>
                                </div>
                                <div className="w-3/4 h-6 bg-slate-800 rounded mb-2"></div>
                                <div className="w-1/2 h-3 bg-slate-800 rounded mb-3"></div>
                                <div className="flex-1 w-full h-12 bg-slate-800 rounded mb-4"></div>
                                <div className="flex justify-between items-end mt-auto pt-4 border-t border-border">
                                    <div className="w-20 h-3 bg-slate-800 rounded"></div>
                                    <div className="w-20 h-8 bg-slate-800 rounded"></div>
                                </div>
                            </div>
                        ))}
                    </>
                ) : filteredTickets.length === 0 ? (
                    <div className="col-span-full p-12 border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center text-slate-500">
                        <ClipboardCheck className="w-10 h-10 mb-2 text-purple-400" />
                        <p>Nenhum chamado encontrado nesta categoria.</p>
                    </div>
                ) : (
                    filteredTickets.map(ticket => {
                        const isResolved = ticket.status === 'Resolvido';
                    let priorityColor = 'text-slate-400 bg-slate-500/10 border-slate-500/20';
                    if (ticket.priority === 'Alta') priorityColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
                    if (ticket.priority === 'Critica') priorityColor = 'text-red-400 bg-red-500/10 border-red-500/20';
                    if (ticket.priority === 'Baixa') priorityColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';

                    return (
                        <div key={ticket.id} className={`card p-5 flex flex-col transition-all hover:-translate-y-1 ${isResolved ? 'opacity-70 hover:opacity-100' : ''}`}>
                            <div className="flex justify-between items-start mb-3">
                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${priorityColor}`}>
                                    {ticket.priority}
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-slate-500 font-mono">{safeFormatDate(ticket.createdAt)}</span>
                                    <button 
                                        type="button"
                                        onClick={(e) => deleteTicket(e, ticket.id)} 
                                        className="size-6 flex items-center justify-center text-slate-500 hover:text-red-400 rounded transition-colors z-20 cursor-pointer"
                                        title="Excluir Chamado"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            
                            <h3 className="text-lg font-bold text-text mb-1 line-clamp-1">{ticket.title}</h3>
                            <div className="text-xs text-purple-400 mb-3 flex items-center gap-1 font-semibold">
                                <Tag className="w-3.5 h-3.5" /> {ticket.category}
                            </div>
                            
                            <p className="text-sm text-slate-300 leading-relaxed line-clamp-3 mb-6 flex-1">
                                {ticket.description}
                            </p>

                            <div className="mt-auto pt-4 border-t border-border flex justify-between items-center">
                                <span className={`text-xs font-bold flex items-center gap-1 ${isResolved ? 'text-emerald-400' : ticket.status === 'Em Andamento' ? 'text-blue-400' : 'text-slate-400'}`}>
                                    {isResolved ? <CheckCircle className="w-4 h-4" /> : ticket.status === 'Em Andamento' ? <Clock className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                    {ticket.status}
                                </span>

                                <div className="flex gap-1">
                                    {!isResolved && (
                                        <>
                                            {ticket.status === 'Aberto' && (
                                                <button onClick={() => updateStatus(ticket.id, 'Em Andamento')} className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white text-xs font-bold rounded-xl transition-all">
                                                    Iniciar
                                                </button>
                                            )}
                                            <button onClick={() => updateStatus(ticket.id, 'Resolvido')} className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white text-xs font-bold rounded-xl transition-all">
                                                Resolver
                                            </button>
                                        </>
                                    )}
                                    {isResolved && (
                                        <button onClick={() => updateStatus(ticket.id, 'Aberto')} className="px-3 py-1.5 btn-ghost text-xs font-bold rounded-xl transition-all">
                                            Reabrir
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                }))}
            </div>
         </div>
       </div>
    </div>

            {/* New Ticket Modal */}
            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-panel flex flex-col">
                        <div className="p-4 border-b border-border flex justify-between items-center">
                            <h3 className="text-xl font-bold text-text">Abrir Novo Chamado</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-text"><X className="w-6 h-6" /></button>
                        </div>
                        <div className="p-4 flex flex-col gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-slate-400 uppercase">Assunto</label>
                                <input 
                                    value={formData.title}
                                    onChange={e => setFormData({...formData, title: e.target.value})}
                                    placeholder="Ex: Impressora travada / Falta de Luvas"
                                    className="input"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-slate-400 uppercase">Categoria</label>
                                    <select 
                                        value={formData.category}
                                        onChange={e => setFormData({...formData, category: e.target.value})}
                                        className="input"
                                    >
                                        <option value="Sistema">Sistema / TI</option>
                                        <option value="Operacional">Operacional</option>
                                        <option value="Manutencao">Manutenção Predial</option>
                                        <option value="Outros">Outros</option>
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-slate-400 uppercase">Prioridade</label>
                                    <select 
                                        value={formData.priority}
                                        onChange={e => setFormData({...formData, priority: e.target.value})}
                                        className="input"
                                    >
                                        <option value="Baixa">Baixa</option>
                                        <option value="Media">Média</option>
                                        <option value="Alta">Alta</option>
                                        <option value="Critica">Crítica</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-slate-400 uppercase">Descrição Detalhada</label>
                                <textarea 
                                    value={formData.description}
                                    onChange={e => setFormData({...formData, description: e.target.value})}
                                    placeholder="Descreva o problema ou solicitação..."
                                    className="input min-h-[120px] resize-none"
                                />
                            </div>
                        </div>
                        <div className="p-4 border-t border-border flex justify-end gap-3">
                            <button onClick={() => setIsModalOpen(false)} className="btn btn-ghost">Cancelar</button>
                            <button onClick={handleCreateTicket} className="btn btn-primary">Criar Ticket</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
    );
};
