
import React, { useState, useEffect, useMemo } from 'react';
import { AppNotification, Tab } from '../types';
import { supabase } from '../supabaseClient';
import { 
  Bell, 
  AlertTriangle, 
  Clock, 
  MessageSquare, 
  Info,
  Check,
  X,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface NotificationCenterProps {
  isOpen: boolean;
  onNotifyCountChange?: (count: number) => void;
  onNavigate: (tab: Tab, subTab?: string) => void;
  onClose: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ 
  isOpen,
  onNotifyCountChange, 
  onNavigate,
  onClose
}) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const generatedNotifications: AppNotification[] = [];

      // 1. Get Critical Support Tickets (Messages)
      const { data: tickets } = await supabase
        .from('support_tickets')
        .select('*')
        .neq('status', 'Resolvido');
      
      if (tickets) {
        tickets.forEach(t => {
          if (t.priority === 'Critica') {
            generatedNotifications.push({
              id: `ticket-${t.id}`,
              title: 'Chamado Crítico',
              message: t.title,
              type: 'message',
              priority: 'urgent',
              isRead: false,
              tab: Tab.SUPPORT,
              createdAt: t.created_at
            });
          } else if (t.status === 'Aberto') {
             generatedNotifications.push({
              id: `ticket-${t.id}`,
              title: 'Novo Chamado',
              message: t.title,
              type: 'message',
              priority: 'medium',
              tab: Tab.SUPPORT,
              isRead: false,
              createdAt: t.created_at
            });
          }
        });
      }

      // 2. Get Lab Deadlines
      const { data: orders } = await supabase
        .from('lab_orders')
        .select('*')
        .neq('status', 'Entregue');

      if (orders) {
        const today = new Date();
        const threeDaysFromNow = new Date();
        threeDaysFromNow.setDate(today.getDate() + 3);

        orders.forEach(o => {
          const dueDate = new Date(o.due_date);
          if (dueDate <= threeDaysFromNow) {
            generatedNotifications.push({
              id: `lab-deadline-${o.id}`,
              title: 'Prazo de Laboratório',
              message: `Pedido de ${o.patient_name} vence em ${dueDate.toLocaleDateString('pt-BR')}`,
              type: 'lab',
              priority: dueDate < today ? 'urgent' : 'high',
              tab: Tab.LABWORK,
              isRead: false,
              createdAt: o.start_date
            });
          }

          if (o.status === 'Concluido') {
            generatedNotifications.push({
              id: `lab-ready-${o.id}`,
              title: 'Trabalho Pronto',
              message: `O trabalho de ${o.patient_name} está pronto para entrega.`,
              type: 'lab',
              priority: 'medium',
              tab: Tab.LABWORK,
              isRead: false,
              createdAt: new Date().toISOString()
            });
          }
        });
      }

      // 3. Get Ortho Problem Notes
      const { data: orthoPatients } = await supabase
        .from('ortho_patients')
        .select('*')
        .not('problem_note', 'is', null);

      if (orthoPatients) {
        orthoPatients.forEach(p => {
          if (p.problem_note && p.problem_note.trim()) {
            generatedNotifications.push({
              id: `ortho-${p.id}`,
              title: 'Pendência Clínica',
              message: `${p.name}: ${p.problem_note}`,
              type: 'deadline',
              priority: 'medium',
              tab: Tab.ORTHODONTICS,
              isRead: false,
              createdAt: new Date().toISOString()
            });
          }
        });
      }

      // Sort by priority and date
      const sorted = generatedNotifications.sort((a, b) => {
        const priorityScore: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
        if (priorityScore[a.priority] !== priorityScore[b.priority]) {
          return priorityScore[b.priority] - priorityScore[a.priority];
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      setNotifications(sorted);
      if (onNotifyCountChange) {
        onNotifyCountChange(sorted.length);
      }
    } catch (error) {
      console.error("Error loading notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
    
    // Set up polling (every 5 minutes)
    const interval = setInterval(loadNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unreadCount = useMemo(() => notifications.filter(n => !n.isRead).length, [notifications]);

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    if (onNotifyCountChange) onNotifyCountChange(0);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const getIcon = (type: string, priority: string) => {
    if (priority === 'urgent') return <AlertTriangle className="text-red-500 w-5 h-5 animate-pulse" />;
    switch (type) {
      case 'deadline': return <Clock className="text-purple-500 w-5 h-5" />;
      case 'lab': return <Clock className="text-emerald-500 w-5 h-5" />;
      case 'message': return <MessageSquare className="text-blue-500 w-5 h-5" />;
      default: return <Info className="text-slate-400 w-5 h-5" />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] pointer-events-none">
          <div 
            className="absolute inset-0 bg-panel pointer-events-auto backdrop-blur-[1px]" 
            onClick={onClose} 
          />
          <motion.div 
            initial={{ opacity: 0, x: 20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            className="absolute right-4 top-4 bottom-4 w-full max-w-[380px] bg-surface border border-border rounded-3xl shadow-2xl overflow-hidden pointer-events-auto flex flex-col"
          >
            <div className="p-6 border-b border-border bg-surface flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                   <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text leading-none">Notificações</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                    {unreadCount} novas mensagens
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {notifications.length > 0 && (
                    <button 
                      onClick={markAllRead}
                      className="p-2 text-slate-500 hover:text-text transition-colors"
                      title="Marcar todas como lidas"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                )}
                <button onClick={onClose} className="p-2 text-slate-500 hover:text-text transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col gap-3">
              {loading && (
                <div className="flex-1 flex items-center justify-center">
                  <div className="size-6 border-2 border-orange-500 border-t-transparent animate-spin rounded-full"></div>
                </div>
              )}

              {!loading && notifications.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-50">
                    <Bell className="w-12 h-12 text-slate-600 mb-4" />
                    <h4 className="text-text font-bold mb-1">Tudo em dia!</h4>
                    <p className="text-xs text-slate-500">Você não tem nenhuma notificação ativa no momento.</p>
                </div>
              )}

              {!loading && notifications.map((n) => (
                <motion.div 
                  layout
                  key={n.id}
                  className={`
                    group relative p-4 rounded-2xl border transition-all duration-200
                    ${n.isRead ? 'bg-white/[0.02] border-border grayscale-[0.5]' : 'bg-white/[0.05] border-border hover:border-white/20'}
                    ${n.priority === 'urgent' ? 'border-l-4 border-l-red-500' : ''}
                  `}
                >
                  <div className="flex gap-4">
                    <div className="shrink-0 pt-0.5">
                      {getIcon(n.type, n.priority)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="text-sm font-bold text-text truncate pr-4">{n.title}</h4>
                        <span className="text-[9px] font-mono text-slate-500 shrink-0">
                          {new Date(n.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{n.message}</p>
                      
                      {n.tab && (
                        <button 
                          onClick={() => {
                            onNavigate(n.tab!, n.link);
                            onClose();
                          }}
                          className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-orange-400 hover:text-orange-300 transition-colors uppercase tracking-widest"
                        >
                          Acessar {n.tab} <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <button 
                      onClick={() => removeNotification(n.id)}
                      className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-panel/80 rounded"
                    >
                      <X className="w-3 h-3 text-slate-500" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="p-4 border-t border-border bg-surface shrink-0">
                <button 
                  onClick={loadNotifications}
                  className="w-full py-3 bg-panel hover:bg-panel/80 text-text rounded-xl text-xs font-bold transition-all border border-border"
                >
                  Atualizar Agora
                </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
