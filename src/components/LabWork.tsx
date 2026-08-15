
import React, { useState, useEffect, useMemo } from 'react';
import { LabOrder, LabPayment } from '../types';
import { supabase } from '../supabaseClient';
import { SpotlightCard } from './ui/spotlight-card';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts';
import { 
  Briefcase, DollarSign, CheckCircle, TrendingUp, ArrowRight, Edit2, Trash2, 
  Flag, PlusCircle, ChevronLeft, ChevronRight, Plus, X, CreditCard,
  UserCog, Ruler, Package, ClipboardCheck, Search, Clock
} from 'lucide-react';

import { toast } from 'sonner';
import { useRealtimeSubscription, notifyDataChange } from '../lib/realtime';

type ViewMode = 'kanban' | 'settings' | 'dashboard' | 'lab_payments_ctrl';

interface LabWorkProps {
    userRole?: string;
    allowedSubTabs?: string[];
    requestedSubTab?: string | null;
    userEmail?: string;
}

interface LabProsthesisType {
    id: string;
    name: string;
    default_value: number;
    default_cost: number;
}



export const LabWork: React.FC<LabWorkProps> = ({ userRole, allowedSubTabs = [], requestedSubTab, userEmail }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [prosthesisList, setProsthesisList] = useState<LabProsthesisType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [productionPeriod, setProductionPeriod] = useState<'7days' | 'month' | 'custom'>('7days');
  const [kanbanProsthesisFilter, setKanbanProsthesisFilter] = useState<string>('all');
  const [kanbanPatientFilter, setKanbanPatientFilter] = useState<string>('');
  const [kanbanPaymentFilter, setKanbanPaymentFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [customStartDate, setCustomStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [customEndDate, setCustomEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [labRevenueGoal, setLabRevenueGoal] = useState<number>(10000);
  const [labPaymentsMetaMap, setLabPaymentsMetaMap] = useState<Record<string, { paid: boolean; paymentDate: string; paymentMethod: string; invoiceNumber: string }>>(() => {
      try {
          const saved = localStorage.getItem('dental_lab_payments_meta_map');
          if (saved) return JSON.parse(saved);
          const oldSaved = localStorage.getItem('dental_lab_cost_paid_map');
          if (oldSaved) {
              const oldMap = JSON.parse(oldSaved);
              const migrated: Record<string, { paid: boolean; paymentDate: string; paymentMethod: string; invoiceNumber: string }> = {};
              for (const id in oldMap) {
                  if (oldMap[id]) {
                      migrated[id] = { paid: true, paymentDate: new Date().toISOString().split('T')[0], paymentMethod: 'PIX', invoiceNumber: '' };
                  }
              }
              return migrated;
          }
          return {};
      } catch {
          return {};
      }
  });
  const [labPaymentsSearch, setLabPaymentsSearch] = useState('');
  const [labPaymentsStatusFilter, setLabPaymentsStatusFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [showPatientPaymentsRegistry, setShowPatientPaymentsRegistry] = useState(false);
  const [isLabPayModalOpen, setIsLabPayModalOpen] = useState(false);
  const [selectedOrderForLabPay, setSelectedOrderForLabPay] = useState<LabOrder | null>(null);
  const [labPayForm, setLabPayForm] = useState({
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'PIX',
      invoiceNumber: ''
  });

  const handleSaveLabPayment = () => {
      if (!selectedOrderForLabPay) return;
      const updated = {
          ...labPaymentsMetaMap,
          [selectedOrderForLabPay.id]: {
              paid: true,
              paymentDate: labPayForm.paymentDate,
              paymentMethod: labPayForm.paymentMethod,
              invoiceNumber: labPayForm.invoiceNumber
          }
      };
      setLabPaymentsMetaMap(updated);
      try {
          localStorage.setItem('dental_lab_payments_meta_map', JSON.stringify(updated));
          toast.success("Pagamento ao laboratório registrado com sucesso!");
      } catch (e) {
          console.error(e);
      }
      setIsLabPayModalOpen(false);
      setSelectedOrderForLabPay(null);
  };

  const handleUndoLabPayment = (orderId: string) => {
      const updated = { ...labPaymentsMetaMap };
      delete updated[orderId];
      setLabPaymentsMetaMap(updated);
      try {
          localStorage.setItem('dental_lab_payments_meta_map', JSON.stringify(updated));
          toast.success("Status de pagamento ao laboratório removido.");
      } catch (e) {
          console.error(e);
      }
  };

  // Permissões: Recepção e Admin têm poder total de gestão no laboratório
  const canManage = useMemo(() => {
    return userRole === 'admin' || userRole === 'reception' || (Array.isArray(allowedSubTabs) && allowedSubTabs.includes('lab_kanban'));
  }, [userRole, allowedSubTabs]);

  // Modais
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<LabOrder | null>(null);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({});
  const [isPendingModalOpen, setIsPendingModalOpen] = useState(false);
  const [pendingSearchQuery, setPendingSearchQuery] = useState('');

  // Lista de pagamentos pendentes
  const pendingPaymentsList = useMemo(() => {
    return orders
      .map(o => {
        const totalPaid = o.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
        const remaining = Math.max(0, o.saleValue - totalPaid);
        return {
          order: o,
          totalPaid,
          remaining
        };
      })
      .filter(item => item.remaining > 0.01)
      .sort((a, b) => b.remaining - a.remaining);
  }, [orders]);
  
  // Forms
  const [newOrderForm, setNewOrderForm] = useState({
      patient_name: '',
      protese_id: '',
      details: '',
      lab_name: '',
      sale_value: '',
      cost: '',
      start_date: new Date().toISOString().split('T')[0]
  });

  const [paymentForm, setPaymentForm] = useState({
      amount: '',
      date: new Date().toISOString().split('T')[0]
  });

  const [configForm, setConfigForm] = useState({ name: '', value: '', cost: '' });

  // Listener para mudança de aba via Sidebar
  useEffect(() => {
      if (requestedSubTab) {
          if (requestedSubTab === 'dashboard') setViewMode('dashboard');
          if (requestedSubTab === 'kanban') setViewMode('kanban');
          if (requestedSubTab === 'settings') setViewMode('settings');
      }
  }, [requestedSubTab]);

  const loadData = async () => {
      setLoading(true);
      try {
          const currentMonthKey = `lab_goal_${new Date().toISOString().slice(0, 7)}`;
          
          // Carregar meta do laboratório
          const { data: goalData } = await supabase
            .from('dashboard_configs')
            .select('revenue_goal')
            .eq('month_key', currentMonthKey)
            .maybeSingle();
          
          if (goalData) setLabRevenueGoal(Number(goalData.revenue_goal));

          const { data: ordersData, error: ordersError } = await supabase.from('lab_orders').select('*');
          if (ordersError) {
              if (ordersError.code === '42P01') {
                  toast.error("Tabelas de laboratório não encontradas. Execute o SQL de configuração.");
              } else {
                  toast.error("Erro ao carregar pedidos: " + ordersError.message);
              }
              throw ordersError;
          }
          
          const { data: paymentsData } = await supabase.from('lab_payments').select('*');

          if (ordersData) {
              const mappedOrders = ordersData.map(o => {
                  const orderPayments = paymentsData?.filter(p => p.order_id === o.id) || [];
                  return {
                      id: o.id,
                      patientName: o.patient_name,
                      proteseId: o.protese_id,
                      details: o.details,
                      type: o.type,
                      status: o.status as any,
                      startDate: o.start_date,
                      dueDate: o.due_date,
                      cost: Number(o.cost || 0),
                      saleValue: Number(o.sale_value || 0),
                      labName: o.lab_name,
                      payments: orderPayments.map(p => ({
                          id: p.id,
                          orderId: p.order_id,
                          amount: Number(p.amount),
                          paymentDate: p.payment_date,
                          method: p.method
                      }))
                  };
              });
              setOrders(mappedOrders.sort((a, b) => b.id.localeCompare(a.id)));
          }

          const { data: prostData, error: prostError } = await supabase.from('lab_prosthesis_types').select('*').order('name', { ascending: true });
          if (prostError && prostError.code !== '42P01') {
              console.warn("Erro ao carregar tipos de prótese:", prostError.message);
          }
          
          if (prostData) {
              setProsthesisList(prostData.map(p => ({
                  id: p.id,
                  name: p.name,
                  default_value: Number(p.default_value || 0),
                  default_cost: Number(p.default_cost || 0)
              })));
          }

      } catch (err: any) {
          console.error("Erro ao carregar dados:", err.message);
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => { loadData(); }, []);

  useRealtimeSubscription(['lab_orders', 'lab_payments', 'lab_prosthesis_types', 'transactions'], () => {
      loadData();
  });

  // --- DASHBOARD CALCULATIONS ---
  const stats = useMemo(() => {
    const inProgress = orders.filter(o => o.status !== 'Entregue').length;
    
    const currentMonthPrefix = new Date().toISOString().slice(0, 7);
    const completedThisMonth = orders.filter(o => o.status === 'Entregue' && o.startDate.startsWith(currentMonthPrefix)).length;
    
    const readyToDeliver = orders.filter(o => o.status === 'Concluido').length;
    const trabalhosFinalizados = orders.filter(o => (o.status === 'Concluido' || o.status === 'Entregue') && o.startDate.startsWith(currentMonthPrefix)).length;
    
    const monthlyRevenue = orders
        .filter(o => o.startDate.startsWith(currentMonthPrefix))
        .reduce((acc, o) => acc + o.saleValue, 0);

    const pendingPayments = orders.reduce((acc, o) => {
        const orderPaid = o.payments?.reduce((pSum, p) => pSum + p.amount, 0) || 0;
        const remaining = Math.max(0, o.saleValue - orderPaid);
        return acc + remaining;
    }, 0);

    // Chart Data logic based on period
    let chartData: { name: string; value: number }[] = [];
    const rankingMap: Record<string, number> = {};

    const getFilteredOrders = () => {
        if (productionPeriod === '7days') {
            const last7Days = new Date();
            last7Days.setHours(0, 0, 0, 0);
            last7Days.setDate(last7Days.getDate() - 7);
            return orders.filter(o => {
                if (!o.startDate) return false;
                const d = new Date(o.startDate + 'T12:00:00');
                return d >= last7Days;
            });
        } else if (productionPeriod === 'month') {
            return orders.filter(o => o.startDate && o.startDate.startsWith(currentMonthPrefix));
        } else {
            const start = new Date(customStartDate + 'T00:00:00');
            const end = new Date(customEndDate + 'T23:59:59');
            return orders.filter(o => {
                if (!o.startDate) return false;
                const d = new Date(o.startDate + 'T12:00:00');
                return d >= start && d <= end;
            });
        }
    };

    const filteredOrders = getFilteredOrders();
    filteredOrders.forEach(o => {
        const typeName = o.details || 'Outros';
        rankingMap[typeName] = (rankingMap[typeName] || 0) + 1;
    });

    const prosthesisRanking = Object.entries(rankingMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    const statusCounts: Record<string, number> = {
        'Moldagem': 0,
        'Provas': 0,
        'Concluido': 0,
        'Entregue': 0
    };
    orders.forEach(o => {
        if (statusCounts[o.status] !== undefined) {
             statusCounts[o.status]++;
        }
    });
    
    // Highlights the 'Pronto (LAB)' status in the pie chart 
    const pieChartData = [
        { name: 'Moldagem', value: statusCounts['Moldagem'], fill: '#3b82f6' }, // blue-500
        { name: 'Provas', value: statusCounts['Provas'], fill: '#a855f7' }, // purple-500
        { name: 'Pronto (LAB)', value: statusCounts['Concluido'], fill: '#10b981' }, // emerald-500
        { name: 'Entregue', value: statusCounts['Entregue'], fill: '#64748b' } // slate-500
    ].filter(item => item.value > 0);

    if (productionPeriod === '7days') {
        const weekdayMap: Record<string, number> = { 'SEG': 0, 'TER': 0, 'QUA': 0, 'QUI': 0, 'SEX': 0, 'SÁB': 0 };
        filteredOrders.forEach(o => {
            const d = new Date(o.startDate + 'T12:00:00');
            const day = d.getDay();
            const labels = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
            if (day !== 0) weekdayMap[labels[day]]++;
        });
        chartData = Object.entries(weekdayMap).map(([name, value]) => ({ name, value }));
    } else if (productionPeriod === 'month') {
        // Group by week of the current month
        const weeksMap: Record<string, number> = { 'Sem 1': 0, 'Sem 2': 0, 'Sem 3': 0, 'Sem 4': 0 };
        filteredOrders.forEach(o => {
            const day = new Date(o.startDate + 'T12:00:00').getDate();
            if (day <= 7) weeksMap['Sem 1']++;
            else if (day <= 14) weeksMap['Sem 2']++;
            else if (day <= 21) weeksMap['Sem 3']++;
            else weeksMap['Sem 4']++;
        });
        chartData = Object.entries(weeksMap).map(([name, value]) => ({ name, value }));
    } else {
        // Advanced grouping by date for custom period
        const dateMap: Record<string, number> = {};
        filteredOrders.forEach(o => {
            const d = o.startDate; // Full YYYY-MM-DD
            dateMap[d] = (dateMap[d] || 0) + 1;
        });
        
        chartData = Object.entries(dateMap)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, count]) => {
                // Formatting date for display (DD/MM)
                const [ , m, d] = date.split('-');
                return { name: `${d}/${m}`, value: count };
            });
            
        // Limit to reasonable number of ticks if the range is too wide
        if (chartData.length > 15) {
            // If many dates, group by week or just keep it as is but it might get crowded.
            // For now, keep it simple but accurate.
        }
    }

    return {
        inProgress,
        completedThisMonth,
        readyToDeliver,
        trabalhosFinalizados,
        monthlyRevenue,
        pendingPayments,
        weeklyData: chartData,
        prosthesisRanking,
        pieChartData
    };
  }, [orders, productionPeriod, customStartDate, customEndDate]);

  const handleSaveLabGoal = async () => {
    if (!canManage) return alert("Você não tem permissão para alterar metas.");
    setIsSaving(true);
    try {
        const currentMonthKey = `lab_goal_${new Date().toISOString().slice(0, 7)}`;
        const { error } = await supabase.from('dashboard_configs').upsert({
            month_key: currentMonthKey,
            revenue_goal: labRevenueGoal
        }, { onConflict: 'month_key' });

        if (error) throw error;
        alert("Meta de faturamento atualizada!");
    } catch (err: any) {
        alert("Erro ao salvar meta: " + err.message);
    } finally {
        setIsSaving(false);
    }
  };

  const handleProsthesisSelection = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const id = e.target.value;
      const selected = prosthesisList.find(p => p.id === id);
      if (selected) {
          setNewOrderForm(prev => ({
              ...prev,
              protese_id: selected.id,
              details: selected.name,
              sale_value: selected.default_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
              cost: selected.default_cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
          }));
      } else {
          setNewOrderForm(prev => ({ ...prev, protese_id: '', details: '', sale_value: '', cost: '' }));
      }
  };

  const handleSavePriceItem = async () => {
    if (!canManage) return alert("Sem permissão.");
    if (!configForm.name.trim()) {
        alert("Preencha o nome do serviço.");
        return;
    }

    try {
        const val = parseFloat(String(configForm.value).replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '')) || 0;
        const cst = parseFloat(String(configForm.cost).replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '')) || 0;
        
        const { error } = await supabase.from('lab_prosthesis_types').insert([{ 
            name: configForm.name.trim(), 
            default_value: val, 
            default_cost: cst 
        }]);

        if (error) throw error;

        alert("Item salvo com sucesso!");
        setConfigForm({ name: '', value: '', cost: '' });
        await loadData();
    } catch (err: any) {
        console.error("Erro ao salvar item da tabela:", err);
        alert("Falha ao salvar: " + err.message);
    }
  };

  const handleAddOrder = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canManage) return alert("Sem permissão para criar/editar pedidos.");
      
      if (!newOrderForm.patient_name.trim()) {
          alert("Por favor, preencha o nome do paciente.");
          return;
      }

      setIsSaving(true);
      try {
          const cleanSale = String(newOrderForm.sale_value || "0").replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
          const cleanCost = String(newOrderForm.cost || "0").replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');

          const finalSale = parseFloat(cleanSale) || 0;
          const finalCost = parseFloat(cleanCost) || 0;
          
          const startDateString = newOrderForm.start_date || new Date().toISOString().split('T')[0];
          const startDateObj = new Date(startDateString + 'T12:00:00');
          const due = new Date(startDateObj.getTime() + (21 * 24 * 60 * 60 * 1000));

          const payload: any = {
              patient_name: newOrderForm.patient_name.trim(),
              details: newOrderForm.details.trim() || 'Trabalho de Prótese',
              lab_name: newOrderForm.lab_name.trim() || 'Interno',
              start_date: startDateString,
              due_date: due.toISOString().split('T')[0],
              sale_value: finalSale,
              cost: finalCost,
              status: 'Moldagem',
              type: 'Prótese'
          };

          if (newOrderForm.protese_id && newOrderForm.protese_id.length > 10) {
              payload.protese_id = newOrderForm.protese_id;
          } else {
              payload.protese_id = null;
          }

          if (editingOrderId) {
              delete payload.status; // Don't reset status on edit
              const { error } = await supabase.from('lab_orders').update(payload).eq('id', editingOrderId);
              if (error) throw error;
              alert("Pedido atualizado com sucesso!");
          } else {
              payload.id = 'lab_' + Date.now().toString();
              const { error } = await supabase.from('lab_orders').insert([payload]);
              if (error) throw error;
              alert("Pedido criado com sucesso!");
          }

          setIsModalOpen(false);
          setEditingOrderId(null);
          setNewOrderForm({ patient_name: '', protese_id: '', details: '', lab_name: '', sale_value: '', cost: '', start_date: new Date().toISOString().split('T')[0] });
          await loadData();
          notifyDataChange(['lab_orders', 'lab_payments', 'transactions']);

      } catch (err: any) {
          console.error("Falha ao salvar pedido:", err);
          alert("Erro ao salvar trabalho: " + err.message);
      } finally {
          setIsSaving(false);
      }
  };

  const handleEditOrder = (order: LabOrder) => {
      setEditingOrderId(order.id);
      setNewOrderForm({
          patient_name: order.patientName,
          protese_id: order.proteseId || '',
          details: order.details,
          lab_name: order.labName,
          sale_value: order.saleValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
          cost: order.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
          start_date: order.startDate
      });
      setIsModalOpen(true);
  };

  const handleDeleteOrder = async (id: string) => {
      if (!canManage) return alert("Sem permissão.");
      
      setIsDeleting(true);
      try {
          // Deletar pagamentos relacionados primeiro para evitar erro de chave estrangeira
          await supabase.from('lab_payments').delete().eq('order_id', id);
          
          const { error } = await supabase.from('lab_orders').delete().eq('id', id);
          if (error) throw error;
          
          await loadData();
          notifyDataChange(['lab_orders', 'lab_payments', 'transactions']);
          setOrderToDelete(null);
      } catch (err: any) {
          console.error("Erro ao excluir pedido:", err);
          alert("Erro ao excluir: " + (err.message || "Ocorreu um erro inesperado."));
      } finally {
          setIsDeleting(false);
      }
  };

  const handleMoveStatus = async (order: LabOrder, nextStatus: string) => {
      if (!canManage) {
          alert("Acesso Negado: Sua função não permite mover etapas.");
          return;
      }
      
      try {
          const { error } = await supabase.from('lab_orders').update({ status: nextStatus }).eq('id', order.id);
          if (error) {
              console.error("Supabase error:", error);
              throw error;
          }

          if (nextStatus === 'Entregue' && order.cost > 0) {
              const expensePayload = {
                  id: 'tx_lab_cost_' + Date.now().toString(),
                  description: `Custo Lab: ${order.patientName} - ${order.details}`,
                  amount: order.cost,
                  category: 'Laboratório',
                  date: new Date().toISOString().split('T')[0],
                  type: 'expense',
                  status: 'Pending',
                  payment_method: 'Interno',
                  observation: `Gerado automaticamente via Módulo Laboratório (Pedido: ${order.id})`
              };
              
              await supabase.from('transactions').insert([expensePayload]);
          }

          await loadData();
      } catch (err: any) {
          alert("Erro ao atualizar status: " + (err.message || "Verifique sua conexão."));
      }
  };

  const handleAddPayment = async () => {
      if (!canManage) {
          alert("Acesso Negado: Sua função não permite registrar pagamentos.");
          return;
      }
      
      if (!selectedOrderForPayment) return;
      
      const cleanString = String(paymentForm.amount || "0").replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
      const amount = parseFloat(cleanString) || 0;
      
      if (amount <= 0) return alert("Valor inválido");

      setIsSaving(true);
      try {
          if (editingPaymentId) {
              const { error } = await supabase.from('lab_payments').update({
                  amount: amount,
                  payment_date: paymentForm.date
              }).eq('id', editingPaymentId);
              if (error) throw error;
              alert("Pagamento atualizado com sucesso!");
          } else {
              const { error } = await supabase.from('lab_payments').insert([{
                  order_id: selectedOrderForPayment.id,
                  amount: amount,
                  method: 'Geral', // Default value since method is removed from UI
                  payment_date: paymentForm.date
              }]);
              if (error) throw error;
              alert("Pagamento registrado com sucesso!");
          }
          
          setPaymentForm({ ...paymentForm, amount: '' });
          setEditingPaymentId(null);
          await loadData();
          
          const updated = orders.find(o => o.id === selectedOrderForPayment.id);
          if (updated) {
              const { data: updatedPays } = await supabase.from('lab_payments').select('*').eq('order_id', updated.id);
              setSelectedOrderForPayment({
                  ...updated,
                  payments: updatedPays?.map(p => ({
                      id: p.id,
                      orderId: p.order_id,
                      amount: Number(p.amount),
                      paymentDate: p.payment_date,
                      method: p.method
                  })) || []
              });
          }
      } catch (err: any) {
          alert("Erro ao salvar pagamento: " + err.message);
      } finally {
          setIsSaving(false);
      }
  };

  const handleEditPayment = (pay: LabPayment) => {
      setEditingPaymentId(pay.id);
      setPaymentForm({
          amount: pay.amount.toString(),
          date: pay.paymentDate
      });
  };

  const deletePayment = async (id: string) => {
      if (!canManage) return alert("Sem permissão.");
      
      try {
          const { error } = await supabase.from('lab_payments').delete().eq('id', id);
          if (error) throw error;
          
          await loadData();
          if (selectedOrderForPayment) {
              const updated = orders.find(o => o.id === selectedOrderForPayment.id);
              if (updated) {
                  const { data: updatedPays } = await supabase.from('lab_payments').select('*').eq('order_id', updated.id);
                  setSelectedOrderForPayment({
                      ...updated,
                      payments: updatedPays?.map(p => ({
                          id: p.id,
                          orderId: p.order_id,
                          amount: Number(p.amount),
                          paymentDate: p.payment_date,
                          method: p.method
                      })) || []
                  });
              } else {
                  setSelectedOrderForPayment(null);
              }
          }
      } catch (err: any) {
          alert("Erro ao excluir pagamento: " + err.message);
      }
  };

  const renderLabPaymentsControl = () => {
      const ordersWithCost = orders.filter(o => o.cost > 0);
      const totalCost = ordersWithCost.reduce((acc, o) => acc + o.cost, 0);
      const totalPaidToLab = ordersWithCost.reduce((acc, o) => acc + (labPaymentsMetaMap[o.id]?.paid ? o.cost : 0), 0);
      const totalPendingToLab = totalCost - totalPaidToLab;

      const filtered = ordersWithCost.filter(o => {
          const meta = labPaymentsMetaMap[o.id];
          if (labPaymentsStatusFilter === 'pending' && meta?.paid) return false;
          if (labPaymentsStatusFilter === 'paid' && !meta?.paid) return false;
          if (labPaymentsSearch.trim()) {
              const q = labPaymentsSearch.toLowerCase();
              const pMatch = o.patientName.toLowerCase().includes(q);
              const lMatch = o.labName && o.labName.toLowerCase().includes(q);
              const dMatch = o.details && o.details.toLowerCase().includes(q);
              if (!pMatch && !lMatch && !dMatch) return false;
          }
          return true;
      });

      const monthlyDataMap: Record<string, { monthKey: string; labCostPaid: number; patientRevenue: number; margin: number }> = {};

      ordersWithCost.forEach(o => {
          const defaultDateStr = o.dueDate || o.createdAt || new Date().toISOString();

          const meta = labPaymentsMetaMap[o.id];
          if (meta?.paid) {
              const labPayDate = meta.paymentDate || defaultDateStr;
              const labMonthKey = labPayDate.slice(0, 7);
              if (!monthlyDataMap[labMonthKey]) {
                  monthlyDataMap[labMonthKey] = { monthKey: labMonthKey, labCostPaid: 0, patientRevenue: 0, margin: 0 };
              }
              monthlyDataMap[labMonthKey].labCostPaid += o.cost;
          }

          if (o.payments && o.payments.length > 0) {
              o.payments.forEach(pay => {
                  if (pay.paymentDate) {
                      const payMonthKey = pay.paymentDate.slice(0, 7);
                      if (!monthlyDataMap[payMonthKey]) {
                          monthlyDataMap[payMonthKey] = { monthKey: payMonthKey, labCostPaid: 0, patientRevenue: 0, margin: 0 };
                      }
                      monthlyDataMap[payMonthKey].patientRevenue += pay.amount;
                  }
              });
          }
      });

      const chartData = Object.values(monthlyDataMap)
          .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
          .map(item => {
              const [year, month] = item.monthKey.split('-');
              const monthNames = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
              const label = `${monthNames[parseInt(month, 10)] || month}/${year.slice(2)}`;
              return {
                  ...item,
                  label,
                  margin: item.patientRevenue - item.labCostPaid
              };
          });

      return (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <SpotlightCard className="glass-panel rounded-2xl p-6 border border-border" spotlightColor="rgba(255, 255, 255, 0.1)">
                      <div className="flex items-center justify-between mb-4">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Custos Lab</span>
                          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                              <DollarSign className="w-5 h-5" />
                          </div>
                      </div>
                      <div className="text-2xl font-black text-text font-mono">
                          R$ {totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">{ordersWithCost.length} trabalhos com custo de laboratório</p>
                  </SpotlightCard>

                  <SpotlightCard className="glass-panel rounded-2xl p-6 border border-border" spotlightColor="rgba(255, 255, 255, 0.1)">
                      <div className="flex items-center justify-between mb-4">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pago ao Laboratório</span>
                          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle className="w-5 h-5" />
                          </div>
                      </div>
                      <div className="text-2xl font-black text-emerald-400 font-mono">
                          R$ {totalPaidToLab.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">Valores já quitados com os parceiros</p>
                  </SpotlightCard>

                  <SpotlightCard className="glass-panel rounded-2xl p-6 border border-border" spotlightColor="rgba(255, 255, 255, 0.1)">
                      <div className="flex items-center justify-between mb-4">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pendente com Lab</span>
                          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                              <Clock className="w-5 h-5" />
                          </div>
                      </div>
                      <div className="text-2xl font-black text-amber-400 font-mono">
                          R$ {totalPendingToLab.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">Ainda não pago aos laboratórios</p>
                  </SpotlightCard>
              </div>

              {/* Monthly Comparative Chart */}
              <div className="glass-panel border border-border rounded-2xl p-6 bg-panel/30 shadow-xl space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                          <h3 className="text-sm font-bold text-text uppercase tracking-wider">Análise de Margem & Comparativo Mensal</h3>
                          <p className="text-xs text-slate-400">Comparativo entre o Total Pago aos Laboratórios e o Recebimento dos Pacientes</p>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-bold">
                          <span className="flex items-center gap-1.5 text-indigo-400">
                              <span className="w-3 h-3 rounded-full bg-indigo-500 inline-block"></span> Recebido de Pacientes
                          </span>
                          <span className="flex items-center gap-1.5 text-emerald-400">
                              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span> Pago ao Lab
                          </span>
                      </div>
                  </div>

                  <div className="h-72 w-full pt-4">
                      {chartData.length === 0 ? (
                          <div className="h-full flex items-center justify-center text-slate-500 italic text-xs">
                              Nenhum dado financeiro disponível para exibição de gráficos.
                          </div>
                      ) : (
                          <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} />
                                  <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `R$ ${v}`} />
                                  <RechartsTooltip 
                                      contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                                      formatter={(value: any, name: string) => [
                                          `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                                          name === 'patientRevenue' ? 'Recebido Pacientes' : 'Pago ao Laboratório'
                                      ]}
                                  />
                                  <Bar dataKey="patientRevenue" fill="#6366f1" radius={[6, 6, 0, 0]} name="patientRevenue" />
                                  <Bar dataKey="labCostPaid" fill="#10b981" radius={[6, 6, 0, 0]} name="labCostPaid" />
                              </BarChart>
                          </ResponsiveContainer>
                      )}
                  </div>
              </div>

              {/* Filters Bar */}
              <div className="flex flex-wrap items-center gap-4 bg-panel p-4 rounded-2xl border border-border">
                  <div className="relative flex-1 min-w-[220px] max-w-sm">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                          type="text"
                          placeholder="Buscar por paciente, laboratório ou detalhe..."
                          value={labPaymentsSearch}
                          onChange={(e) => setLabPaymentsSearch(e.target.value)}
                          className="w-full bg-panel border border-border rounded-xl text-xs text-text pl-9 pr-4 py-2.5 outline-none focus:border-indigo-500 transition-colors"
                      />
                  </div>

                  <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status:</span>
                      <select
                          value={labPaymentsStatusFilter}
                          onChange={(e) => setLabPaymentsStatusFilter(e.target.value as any)}
                          className="bg-panel border border-border rounded-xl text-xs font-bold text-slate-300 px-3 py-2.5 outline-none cursor-pointer focus:border-indigo-500"
                      >
                          <option value="all">Todos</option>
                          <option value="pending">Pendentes</option>
                          <option value="paid">Pagos</option>
                      </select>
                  </div>

                  <button
                      onClick={() => setShowPatientPaymentsRegistry(!showPatientPaymentsRegistry)}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                          showPatientPaymentsRegistry
                              ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/20'
                              : 'bg-panel hover:bg-panel/80 text-slate-300 border-border'
                      }`}
                  >
                      {showPatientPaymentsRegistry ? 'Ocultar Extrato de Pagamentos' : 'Extrato de Pagamentos de Pacientes'}
                  </button>

                  <div className="ml-auto text-[10px] font-bold text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-3 py-1.5 rounded-xl border border-indigo-500/20">
                      {filtered.length} {filtered.length === 1 ? 'registro' : 'registros'}
                  </div>
              </div>

              {/* Patient Payments Registry Panel */}
              {showPatientPaymentsRegistry && (
                  <div className="glass-panel border border-border rounded-2xl p-6 bg-panel/40 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-300">
                      <div className="flex items-center justify-between border-b border-border pb-4">
                          <div>
                              <h3 className="text-sm font-bold text-text uppercase tracking-wider">Registro de Recebimentos de Pacientes (Trabalhos de Lab)</h3>
                              <p className="text-xs text-slate-400">Histórico detalhado por data, valor e forma de pagamento referente aos pedidos com custo de laboratório</p>
                          </div>
                          <button
                              onClick={() => setShowPatientPaymentsRegistry(false)}
                              className="px-3 py-1.5 rounded-xl bg-panel hover:bg-panel/80 text-slate-400 hover:text-text text-xs border border-border"
                          >
                              Fechar ✕
                          </button>
                      </div>

                      <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                              <thead className="bg-panel text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                  <tr>
                                      <th className="p-3 pl-4">Data do Recebimento</th>
                                      <th className="p-3">Paciente / Trabalho</th>
                                      <th className="p-3">Laboratório</th>
                                      <th className="p-3">Forma de Pagamento</th>
                                      <th className="p-3 text-right">Valor Recebido</th>
                                      <th className="p-3 text-right">Valor Venda Total</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5 text-xs">
                                  {ordersWithCost.flatMap(o => (o.payments || []).map(p => ({ ...p, order: o }))).length === 0 ? (
                                      <tr>
                                          <td colSpan={6} className="text-center py-8 text-slate-500 italic">
                                              Nenhum pagamento de paciente registrado para trabalhos de laboratório.
                                          </td>
                                      </tr>
                                  ) : (
                                      ordersWithCost
                                          .flatMap(o => (o.payments || []).map(p => ({ ...p, order: o })))
                                          .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
                                          .map((item, idx) => {
                                              const payDateFormatted = item.paymentDate ? item.paymentDate.split('T')[0].split('-').reverse().join('/') : 'N/A';
                                              return (
                                                  <tr key={idx} className="hover:bg-panel/50 transition-colors">
                                                      <td className="p-3 pl-4 font-mono font-medium text-emerald-400">
                                                          {payDateFormatted}
                                                      </td>
                                                      <td className="p-3">
                                                          <div className="font-bold text-text">{item.order.patientName}</div>
                                                          <div className="text-[10px] text-slate-400">{item.order.details || item.order.type}</div>
                                                      </td>
                                                      <td className="p-3 text-slate-300 font-medium">
                                                          {item.order.labName || 'Interno / N/I'}
                                                      </td>
                                                      <td className="p-3">
                                                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-panel border border-border text-slate-300">
                                                              {item.paymentMethod || 'PIX'}
                                                          </span>
                                                      </td>
                                                      <td className="p-3 text-right font-mono font-bold text-emerald-400">
                                                          R$ {item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                      </td>
                                                      <td className="p-3 text-right font-mono text-slate-400">
                                                          R$ {item.order.saleValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                      </td>
                                                  </tr>
                                              );
                                          })
                                  )}
                              </tbody>
                          </table>
                      </div>
                  </div>
              )}

              {/* Table */}
              <div className="glass-panel border border-border rounded-2xl overflow-hidden bg-panel/30 shadow-xl">
                  <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                          <thead className="bg-panel text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                              <tr>
                                  <th className="p-4 pl-6">Paciente / Trabalho</th>
                                  <th className="p-4">Laboratório</th>
                                  <th className="p-4">Vencimento</th>
                                  <th className="p-4 text-right">Custo Lab</th>
                                  <th className="p-4 text-center">Situação Pagto. Paciente</th>
                                  <th className="p-4">Dados Pagto. ao Lab</th>
                                  <th className="p-4 text-center">Status Lab</th>
                                  <th className="p-4 text-center">Ação</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 text-xs">
                              {filtered.length === 0 ? (
                                  <tr>
                                      <td colSpan={8} className="text-center py-12 text-slate-500 italic">
                                          Nenhum registro encontrado para os filtros selecionados.
                                      </td>
                                  </tr>
                              ) : (
                                  filtered.map(order => {
                                      const meta = labPaymentsMetaMap[order.id];
                                      const isPaid = !!meta?.paid;
                                      const formattedDueDate = order.dueDate ? order.dueDate.split('T')[0].split('-').reverse().join('/') : 'N/A';
                                      
                                      const totalPaidByPatient = order.payments?.reduce((s, p) => s + p.amount, 0) || 0;
                                      const patientFullyPaid = totalPaidByPatient >= order.saleValue - 0.01;
                                      const patientRemaining = Math.max(0, order.saleValue - totalPaidByPatient);

                                      const formattedPayDate = meta?.paymentDate ? meta.paymentDate.split('-').reverse().join('/') : '';

                                      return (
                                          <tr key={order.id} className="hover:bg-panel/50 transition-colors">
                                              <td className="p-4 pl-6">
                                                  <div className="font-bold text-text">{order.patientName}</div>
                                                  <div className="text-[10px] text-slate-400">{order.details || order.type} (Venda: R$ {order.saleValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})</div>
                                              </td>
                                              <td className="p-4 font-medium text-slate-300">
                                                  {order.labName || 'Interno / N/I'}
                                              </td>
                                              <td className="p-4 font-mono text-slate-400">
                                                  {formattedDueDate}
                                              </td>
                                              <td className="p-4 text-right font-mono font-bold text-text">
                                                  R$ {order.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                              </td>
                                              <td className="p-4 text-center">
                                                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                                      patientFullyPaid
                                                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                                  }`}>
                                                      {patientFullyPaid ? (
                                                          <>Quitado ✅</>
                                                      ) : (
                                                          <>Falta R$ {patientRemaining.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ⚠️</>
                                                      )}
                                                  </span>
                                              </td>
                                              <td className="p-4 text-slate-300">
                                                  {isPaid ? (
                                                      <div className="space-y-0.5 text-[11px]">
                                                          <div className="font-medium text-emerald-400">
                                                              Data: {formattedPayDate}
                                                          </div>
                                                          <div className="text-slate-400">
                                                              Forma: <strong className="text-slate-200">{meta.paymentMethod}</strong>
                                                          </div>
                                                          <div className="text-slate-400">
                                                              Nota: <strong className="text-slate-200">{meta.invoiceNumber || 'N/I'}</strong>
                                                          </div>
                                                      </div>
                                                  ) : (
                                                      <span className="text-slate-500 italic text-[10px]">Aguardando pagamento</span>
                                                  )}
                                              </td>
                                              <td className="p-4 text-center">
                                                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                                      isPaid 
                                                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                                  }`}>
                                                      {isPaid ? 'Pago ao Lab' : 'Pendente'}
                                                  </span>
                                              </td>
                                              <td className="p-4 text-center">
                                                  <div className="flex items-center justify-center gap-1.5">
                                                      <button
                                                          onClick={() => {
                                                              setSelectedOrderForLabPay(order);
                                                              setLabPayForm({
                                                                  paymentDate: meta?.paymentDate || new Date().toISOString().split('T')[0],
                                                                  paymentMethod: meta?.paymentMethod || 'PIX',
                                                                  invoiceNumber: meta?.invoiceNumber || ''
                                                              });
                                                              setIsLabPayModalOpen(true);
                                                          }}
                                                          className="px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border-emerald-500/30"
                                                      >
                                                          {isPaid ? 'Editar' : 'Pagar ao Lab'}
                                                      </button>
                                                      {isPaid && (
                                                          <button
                                                              onClick={() => handleUndoLabPayment(order.id)}
                                                              className="px-2 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border bg-panel hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border-border"
                                                              title="Remover pagamento"
                                                          >
                                                              Remover
                                                          </button>
                                                      )}
                                                  </div>
                                              </td>
                                          </tr>
                                      );
                                  })
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      );
  };

  const renderDashboard = () => {
    const activeWorks = orders.filter(o => o.status !== 'Entregue').slice(0, 5);
    const recentOrders = orders.slice(0, 4);
    const goalProgress = Math.min(100, (stats.monthlyRevenue / (labRevenueGoal || 1)) * 100);

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-10">
            {/* KPI CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
                <SpotlightCard className="glass-panel rounded-2xl p-6 relative overflow-hidden group cursor-pointer hover:border-blue-500/30 transition-all" onClick={() => setViewMode('kanban')} spotlightColor="rgba(59, 130, 246, 0.4)">
                    <div className="flex justify-between items-start">
                        <div className="size-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                            <Briefcase className="w-6 h-6" />
                        </div>
                    </div>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-4">Trabalhos em Curso</p>
                    <h3 className="text-3xl font-bold text-text mt-1">{stats.inProgress}</h3>
                </SpotlightCard>

                <SpotlightCard className="glass-panel rounded-2xl p-6 relative overflow-hidden group cursor-pointer hover:border-emerald-500/30 transition-all" onClick={() => setViewMode('kanban')} spotlightColor="rgba(16, 185, 129, 0.4)">
                    <div className="flex justify-between items-start">
                        <div className="size-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                            <Package className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 bg-panel px-2 py-0.5 rounded-full">Pronto</span>
                    </div>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-4">Pronto para Entrega</p>
                    <h3 className="text-3xl font-bold text-text mt-1">{stats.readyToDeliver}</h3>
                </SpotlightCard>

                <SpotlightCard className="glass-panel rounded-2xl p-6 relative overflow-hidden group cursor-pointer hover:border-indigo-500/30 transition-all" onClick={() => setViewMode('kanban')} spotlightColor="rgba(99, 102, 241, 0.4)">
                    <div className="flex justify-between items-start">
                        <div className="size-10 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                            <CheckCircle className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 bg-panel px-2 py-0.5 rounded-full">Mês</span>
                    </div>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-4">Trabalhos Finalizados (Mês)</p>
                    <h3 className="text-3xl font-bold text-text mt-1">{stats.trabalhosFinalizados}</h3>
                </SpotlightCard>

                <SpotlightCard className="glass-panel rounded-2xl p-6 relative overflow-hidden group cursor-pointer hover:border-amber-500/30 transition-all" onClick={() => setIsPendingModalOpen(true)} spotlightColor="rgba(245, 158, 11, 0.4)">
                    <div className="flex justify-between items-start">
                        <div className="size-10 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                            <DollarSign className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full hover:bg-amber-400/20 transition-all flex items-center gap-1">
                            Ver ({pendingPaymentsList.length}) <ArrowRight className="w-3 h-3" />
                        </span>
                    </div>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-4">Pagamentos Pendentes</p>
                    <h3 className="text-3xl font-bold text-amber-400 mt-1">R$ {stats.pendingPayments.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</h3>
                    <p className="text-[10px] text-slate-500 mt-1">Clique para ver lista detalhada</p>
                </SpotlightCard>

                <SpotlightCard className="glass-panel rounded-2xl p-6 relative overflow-hidden group" spotlightColor="rgba(168, 85, 247, 0.4)">
                    <div className="flex justify-between items-start">
                        <div className="size-10 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] font-bold text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded-full cursor-pointer hover:bg-purple-400/20 transition-all" onClick={() => setViewMode('settings')}>
                            Meta {goalProgress.toFixed(0)}%
                        </span>
                    </div>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-4">Faturamento Mensal</p>
                    <h3 className="text-3xl font-bold text-text mt-1">R$ {stats.monthlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</h3>
                </SpotlightCard>
            </div>

            {/* CHARTS, RANKING & RECENT UPDATES */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <SpotlightCard className="lg:col-span-2 glass-panel rounded-2xl p-6 border border-border" spotlightColor="rgba(255, 255, 255, 0.1)">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                        <h3 className="text-lg font-bold text-text">Produção {productionPeriod === '7days' ? 'Semanal' : productionPeriod === 'month' ? 'Mensal' : 'Personalizada'}</h3>
                        <div className="flex flex-wrap items-center gap-3">
                            {productionPeriod === 'custom' && (
                                <div className="flex items-center gap-2 bg-panel border border-border rounded-lg p-1 animate-in slide-in-from-right-4 duration-300">
                                    <input 
                                        type="date" 
                                        value={customStartDate} 
                                        onChange={(e) => setCustomStartDate(e.target.value)}
                                        className="bg-transparent border-none text-[10px] font-bold text-text outline-none px-2 cursor-pointer"
                                    />
                                    <span className="text-text/30 text-[10px]">até</span>
                                    <input 
                                        type="date" 
                                        value={customEndDate} 
                                        onChange={(e) => setCustomEndDate(e.target.value)}
                                        className="bg-transparent border-none text-[10px] font-bold text-text outline-none px-2 cursor-pointer"
                                    />
                                </div>
                            )}
                            <select 
                                value={productionPeriod} 
                                onChange={(e) => setProductionPeriod(e.target.value as any)}
                                className="bg-panel border border-border rounded-lg text-[10px] font-bold uppercase text-slate-400 px-3 py-1.5 outline-none cursor-pointer hover:bg-panel transition-colors"
                            >
                                <option value="7days">Últimos 7 dias</option>
                                <option value="month">Este Mês</option>
                                <option value="custom">Personalizado</option>
                            </select>
                        </div>
                    </div>
                    <div className="h-[280px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 10, fontWeight: 'bold' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 10 }} />
                                <RechartsTooltip 
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }} 
                                    contentStyle={{ backgroundColor: '#13151f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                />
                                <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={40}>
                                    {stats.weeklyData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index === 2 ? '#d946ef' : '#8b5cf6'} opacity={0.8} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </SpotlightCard>

                <SpotlightCard className="glass-panel rounded-2xl p-6 border border-border flex flex-col justify-between lg:col-span-1" spotlightColor="rgba(255, 255, 255, 0.1)">
                    <h3 className="text-sm font-bold text-text mb-2">Distribuição (Status)</h3>
                    <div className="h-[250px] w-full flex items-center justify-center">
                        {stats.pieChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                                    <Pie
                                        data={stats.pieChartData}
                                        cx="50%"
                                        cy="40%"
                                        innerRadius={36}
                                        outerRadius={56}
                                        paddingAngle={4}
                                        dataKey="value"
                                    >
                                        {stats.pieChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} stroke="rgba(0,0,0,0.3)" strokeWidth={2} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip 
                                        contentStyle={{ backgroundColor: '#13151f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                        itemStyle={{ color: '#fff', fontSize: '10px', fontWeight: 'bold' }}
                                    />
                                    <Legend 
                                        verticalAlign="bottom"
                                        align="center"
                                        iconType="circle"
                                        iconSize={8}
                                        wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '8px' }} 
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex flex-col items-center justify-center text-slate-500 text-xs italic">
                                Nenhum trabalho no período
                            </div>
                        )}
                    </div>
                </SpotlightCard>

                <div className="glass-panel rounded-2xl p-6 border border-border flex flex-col lg:col-span-1">
                    <h3 className="text-lg font-bold text-text mb-6">Ranking de Próteses</h3>
                    <div className="flex flex-col gap-4 flex-1">
                        {stats.prosthesisRanking.map((item, idx) => (
                            <div key={item.name} className="flex items-center gap-3 group">
                                <div className={`size-7 rounded-lg flex items-center justify-center text-[10px] font-bold ${
                                    idx === 0 ? 'bg-amber-500/20 text-amber-500' :
                                    idx === 1 ? 'bg-slate-400/20 text-slate-300' :
                                    idx === 2 ? 'bg-amber-700/20 text-amber-700' :
                                    'bg-panel text-slate-500'
                                }`}>
                                    #{idx + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs font-bold text-text truncate">{item.name}</span>
                                        <span className="text-[10px] font-mono text-slate-500">{item.count}</span>
                                    </div>
                                    <div className="h-1 w-full bg-panel rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-indigo-500 transition-all duration-1000" 
                                            style={{ width: `${(item.count / stats.prosthesisRanking[0].count) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {stats.prosthesisRanking.length === 0 && (
                            <div className="flex-1 flex items-center justify-center">
                                <p className="text-xs text-slate-600 italic">Nenhum trabalho no período.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="glass-panel rounded-2xl p-6 border border-border flex flex-col lg:col-span-1">
                    <div className="flex flex-col gap-6 overflow-y-auto custom-scrollbar flex-1">
                        {recentOrders.map(order => (
                            <div key={order.id} className="flex gap-4 group">
                                <div className="relative">
                                    <div className={`size-2.5 rounded-full mt-1.5 ${
                                        order.status === 'Entregue' ? 'bg-emerald-500' : 
                                        order.status === 'Concluido' ? 'bg-blue-500' : 
                                        'bg-amber-500'
                                    }`}></div>
                                    <div className="absolute top-4 bottom-0 left-1 w-px bg-panel group-last:hidden"></div>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <h4 className="text-sm font-bold text-text leading-none">OS #{order.id.split('_')[1]?.slice(-4) || 'Novo'} {order.status === 'Entregue' ? 'Finalizada' : order.status}</h4>
                                    <p className="text-[11px] text-slate-500 mt-1">Paciente: <span className="text-slate-300 font-medium">{order.patientName}</span></p>
                                    <p className="text-[10px] text-slate-600 mt-1">Acaba de ser atualizado</p>
                                </div>
                            </div>
                        ))}
                        {recentOrders.length === 0 && (
                            <p className="text-xs text-slate-600 italic">Sem atividades recentes.</p>
                        )}
                    </div>
                    <button onClick={() => setViewMode('kanban')} className="w-full py-3 mt-4 text-[10px] font-bold uppercase tracking-widest text-primary border-t border-border hover:text-text transition-colors">
                        Ver todo histórico
                    </button>
                </div>
            </div>

            {/* ACTIVE WORKS TABLE */}
            <div className="glass-panel rounded-2xl border border-border overflow-hidden">
                <div className="p-6 border-b border-border flex justify-between items-center">
                    <h3 className="text-lg font-bold text-text">Trabalhos Ativos</h3>
                    <button onClick={() => setViewMode('kanban')} className="text-xs font-bold text-slate-400 hover:text-text transition-colors flex items-center gap-1">
                        Ver todos <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-panel text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            <tr>
                                <th className="p-4 pl-6">Paciente</th>
                                <th className="p-4">Trabalho</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">Progresso</th>
                                <th className="p-4">Prazo</th>
                                <th className="p-4 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {activeWorks.map(order => {
                                const totalPaid = order.payments?.reduce((s,p) => s+p.amount, 0) || 0;
                                const isPaid = totalPaid >= order.saleValue;
                                const progress = order.status === 'Entregue' ? 100 : order.status === 'Concluido' ? 90 : order.status === 'Provas' ? 65 : 24;
                                const progressColor = order.status === 'Concluido' ? 'bg-emerald-500' : 'bg-fuchsia-500';

                                return (
                                    <tr key={order.id} className="hover:bg-panel transition-colors group">
                                        <td className="p-4 pl-6">
                                            <div className="font-bold text-text text-sm">{order.patientName}</div>
                                            <div className="text-[10px] text-slate-500 uppercase font-mono">OS #{order.id.split('_')[1]?.slice(-4)}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="text-xs font-medium text-slate-300">{order.details}</div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase border ${
                                                isPaid ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                            }`}>
                                                {isPaid ? 'PAGO' : 'PENDENTE'}
                                            </span>
                                        </td>
                                        <td className="p-4 w-[200px]">
                                            <div className="flex items-center gap-3">
                                                <div className="flex-1 h-1.5 bg-panel rounded-full overflow-hidden">
                                                    <div className={`h-full ${progressColor} transition-all duration-1000`} style={{ width: `${progress}%` }}></div>
                                                </div>
                                                <span className="text-[10px] font-bold text-text w-8">{progress}%</span>
                                            </div>
                                            <div className="text-[9px] text-slate-500 uppercase font-bold mt-1">{order.status}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="text-xs font-bold text-slate-400">
                                                {new Date(order.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex justify-center gap-1">
                                                <button onClick={() => handleEditOrder(order)} className="p-1.5 text-slate-600 hover:text-blue-400 rounded hover:bg-panel transition-all"><Edit2 className="w-4 h-4" /></button>
                                                <button onClick={() => setOrderToDelete(order.id)} className="p-1.5 text-slate-600 hover:text-red-400 rounded hover:bg-panel transition-all"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
  };

  const renderSettings = () => (
      <div className="flex flex-col gap-10 animate-in fade-in w-full pb-10">
          <div className="glass-panel p-6 rounded-2xl border border-border bg-panel shadow-xl">
              <h3 className="text-text font-bold mb-4 flex items-center gap-2">
                  <Flag className="text-purple-500 w-5 h-5" />
                  Meta de Faturamento Mensal (Laboratório)
              </h3>
              <div className="flex gap-4 items-center">
                  <div className="relative flex-1 max-w-xs">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-bold">R$</span>
                      <input 
                          type="number" 
                          value={labRevenueGoal} 
                          onChange={e => setLabRevenueGoal(Number(e.target.value))} 
                          className="w-full bg-panel border border-border rounded-xl pl-10 pr-4 py-3 text-text outline-none focus:border-purple-500 font-mono font-bold" 
                      />
                  </div>
                  <button onClick={handleSaveLabGoal} disabled={isSaving || !canManage} className="bg-purple-600 hover:bg-purple-500 text-text font-bold px-8 py-3 rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50">
                      {isSaving ? 'Salvando...' : 'Definir Meta'}
                  </button>
              </div>
          </div>

          <div className="glass-panel p-6 rounded-2xl border border-border bg-panel shadow-xl">
              <h3 className="text-text font-bold mb-4 flex items-center gap-2">
                  <PlusCircle className="text-fuchsia-500 w-5 h-5" />
                  Tabela de Preços e Custos (Laboratório)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <input value={configForm.name} onChange={e => setConfigForm({...configForm, name: e.target.value})} placeholder="Serviço / Prótese" className="bg-panel border border-border rounded-xl px-4 py-3 text-text outline-none focus:border-fuchsia-500" />
                  <input value={configForm.value} onChange={e => setConfigForm({...configForm, value: e.target.value})} placeholder="Valor Venda (0,00)" className="bg-panel border border-border rounded-xl px-4 py-3 text-text outline-none focus:border-fuchsia-500 font-mono" />
                  <input value={configForm.cost} onChange={e => setConfigForm({...configForm, cost: e.target.value})} placeholder="Custo Lab (0,00)" className="bg-panel border border-border rounded-xl px-4 py-3 text-text outline-none focus:border-fuchsia-500 font-mono" />
                  <button onClick={handleSavePriceItem} disabled={!canManage} className="bg-fuchsia-600 hover:bg-fuchsia-500 text-text font-bold py-3 rounded-xl transition-all shadow-lg shadow-fuchsia-900/20 disabled:opacity-50">Salvador Item</button>
              </div>
          </div>
          <div className="glass-panel rounded-2xl border border-border overflow-hidden shadow-2xl">
              <table className="w-full text-left">
                  <thead className="bg-panel text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      <tr><th className="p-4">Serviço / Prótese</th><th className="p-4 text-right">Valor Venda</th><th className="p-4 text-right">Custo Lab</th><th className="p-4 text-center">Ações</th></tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                      {prosthesisList.map(p => (
                          <tr key={p.id} className="hover:bg-panel transition-colors">
                              <td className="p-4 text-sm text-text font-bold">{p.name}</td>
                              <td className="p-4 text-sm text-emerald-400 text-right font-mono">R$ {p.default_value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                              <td className="p-4 text-sm text-red-400 text-right font-mono">R$ {p.default_cost.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                              <td className="p-4 text-center">
                                  {canManage && (
                                    <button onClick={async () => { await supabase.from('lab_prosthesis_types').delete().eq('id', p.id); loadData(); }} className="text-slate-600 hover:text-red-400 p-1"><Trash2 className="w-4 h-4" /></button>
                                  )}
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </div>
  );

  const renderKanban = () => {
      const columns = [
          { id: 'Moldagem', label: 'Moldagem', color: 'blue', icon: <UserCog className="w-5 h-5" /> },
          { id: 'Provas', label: 'Provas & Ajustes', color: 'purple', icon: <Ruler className="w-5 h-5" /> },
          { id: 'Concluido', label: 'PRONTO (LAB)', color: 'emerald', icon: <Package className="w-5 h-5" /> },
          { id: 'Entregue', label: 'Entregue', color: 'slate', icon: <ClipboardCheck className="w-5 h-5" /> },
      ];

      const stages = ['Moldagem', 'Provas', 'Concluido', 'Entregue'];
      
      const filteredOrdersList = orders.filter(o => {
          if (kanbanProsthesisFilter !== 'all') {
              if (o.proteseId !== kanbanProsthesisFilter && o.details !== kanbanProsthesisFilter) return false;
          }
          if (kanbanPatientFilter.trim()) {
              const query = kanbanPatientFilter.toLowerCase();
              const patientMatch = o.patientName.toLowerCase().includes(query);
              const detailsMatch = o.details && o.details.toLowerCase().includes(query);
              const labMatch = o.labName && o.labName.toLowerCase().includes(query);
              if (!patientMatch && !detailsMatch && !labMatch) return false;
          }
          if (kanbanPaymentFilter !== 'all') {
              const totalPaid = o.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
              const remaining = o.saleValue - totalPaid;
              if (kanbanPaymentFilter === 'pending' && remaining <= 0.01) return false;
              if (kanbanPaymentFilter === 'paid' && remaining > 0.01) return false;
          }
          return true;
      });

      return (
          <div className="flex flex-col gap-6 h-full">
              {/* Kanban Filters */}
              <div className="flex flex-wrap items-center gap-4 bg-panel p-4 rounded-2xl border border-border">
                  {/* Patient Search Filter */}
                  <div className="relative flex-1 min-w-[200px] max-w-xs">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                          type="text"
                          placeholder="Buscar por paciente..."
                          value={kanbanPatientFilter}
                          onChange={(e) => setKanbanPatientFilter(e.target.value)}
                          className="w-full bg-panel border border-border rounded-xl text-xs text-text pl-9 pr-8 py-2 outline-none focus:border-indigo-500 transition-colors"
                      />
                      {kanbanPatientFilter && (
                          <button 
                              onClick={() => setKanbanPatientFilter('')}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-text"
                          >
                              <X className="w-3.5 h-3.5" />
                          </button>
                      )}
                  </div>

                  <div className="h-6 w-px bg-panel/80 hidden sm:block"></div>

                  {/* Prosthesis Type Filter */}
                  <div className="flex items-center gap-3">
                      <div className="size-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                          <Package className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden sm:inline">Tipo:</span>
                      <select 
                          value={kanbanProsthesisFilter} 
                          onChange={(e) => setKanbanProsthesisFilter(e.target.value)}
                          className="bg-panel border border-border rounded-xl text-xs font-bold text-slate-300 px-3 py-2 outline-none cursor-pointer focus:border-indigo-500 transition-colors"
                      >
                          <option value="all">Todos os Tipos</option>
                          {prosthesisList.map(type => (
                              <option key={type.id} value={type.id}>{type.name}</option>
                          ))}
                      </select>
                  </div>

                  <div className="h-6 w-px bg-panel/80 hidden sm:block"></div>

                  {/* Payment Status Filter */}
                  <div className="flex items-center gap-3">
                      <div className="size-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                          <DollarSign className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden sm:inline">Pagamento:</span>
                      <select 
                          value={kanbanPaymentFilter} 
                          onChange={(e) => setKanbanPaymentFilter(e.target.value as any)}
                          className="bg-panel border border-border rounded-xl text-xs font-bold text-amber-400/90 px-3 py-2 outline-none cursor-pointer focus:border-amber-500 transition-colors"
                      >
                          <option value="all">Todos os Pagamentos</option>
                          <option value="pending">Apenas Com Saldo a Pagar</option>
                          <option value="paid">Apenas Quitados</option>
                      </select>
                  </div>

                  <div className="h-6 w-px bg-panel/80 hidden sm:block"></div>
                  
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest bg-indigo-400/10 px-2.5 py-1 rounded-full">
                      {filteredOrdersList.length} {filteredOrdersList.length === 1 ? 'Pedido' : 'Pedidos'}
                  </span>
              </div>

              <div className="flex gap-6 overflow-x-auto pb-4 h-full scrollbar-hide scroll-smooth">
                  {columns.map(col => {
                      const colOrders = filteredOrdersList.filter(o => o.status === col.id);
                      return (
                      <div key={col.id} className="min-w-[320px] w-[320px] flex flex-col gap-4 h-full overflow-hidden">
                          <div className={`p-4 rounded-xl bg-panel border-l-4 border-${col.color}-500 flex justify-between items-center`}>
                              <div className="flex items-center gap-2">
                                  <span className="text-slate-400">{col.icon}</span>
                                  <h4 className="font-bold text-text uppercase text-xs tracking-widest">{col.label}</h4>
                              </div>
                              <span className="bg-panel/80 text-text text-[10px] font-bold px-2 py-0.5 rounded-full">{colOrders.length}</span>
                          </div>
                          
                          <div 
                              className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3 scroll-smooth"
                              onScroll={(e) => {
                                  const target = e.currentTarget;
                                  if (target.scrollHeight - target.scrollTop <= target.clientHeight + 100) {
                                      setVisibleCounts(prev => {
                                          const currentLimit = prev[col.id] || 20;
                                          if (currentLimit < colOrders.length) {
                                              return { ...prev, [col.id]: currentLimit + 20 };
                                          }
                                          return prev;
                                      });
                                  }
                              }}
                          >
                              {colOrders.slice(0, visibleCounts[col.id] || 20).map(order => {
                                  const totalPaid = order.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
                                  const percentPaid = Math.min(100, (totalPaid / (order.saleValue || 1)) * 100);
                                  const remaining = Math.max(0, order.saleValue - totalPaid);

                                  const statusConfig = (() => {
                                      switch(order.status) {
                                          case 'Moldagem': return { label: 'Em Progresso', bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' };
                                          case 'Provas': return { label: 'Provas', bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' };
                                          case 'Concluido': return { label: 'Pronto', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' };
                                          case 'Entregue': return { label: 'Entregue', bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/20' };
                                          default: return { label: order.status, bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/20' };
                                      }
                                  })();

                                  return (
                                      <div key={order.id} className="p-4 bg-surface border border-border rounded-xl hover:border-white/20 transition-all group relative animate-in fade-in duration-300">
                                          <div className="flex justify-between items-start mb-2">
                                              <div className="flex flex-col gap-1.5">
                                                  <span className="text-[10px] font-bold text-slate-500 uppercase">OS #{order.id.split('_')[1]?.slice(-4)}</span>
                                                  <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded w-fit border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}>
                                                      {statusConfig.label}
                                                  </span>
                                              </div>
                                              <div className="flex gap-1 items-center">
                                                  {canManage && (
                                                      <>
                                                        <button onClick={() => handleEditOrder(order)} className="text-slate-600 hover:text-text mr-1"><Edit2 className="w-3 h-3" /></button>
                                                        <button onClick={() => setOrderToDelete(order.id)} className="text-slate-600 hover:text-red-400 mr-2"><Trash2 className="w-3 h-3" /></button>
                                                      </>
                                                  )}
                                                  {canManage && stages.indexOf(order.status) > 0 && (
                                                      <button onClick={() => handleMoveStatus(order, stages[stages.indexOf(order.status) - 1])} className="text-slate-600 hover:text-text"><ChevronLeft className="w-4 h-4" /></button>
                                                  )}
                                                  {canManage && stages.indexOf(order.status) < stages.length - 1 && (
                                                      <button onClick={() => handleMoveStatus(order, stages[stages.indexOf(order.status) + 1])} className="text-slate-600 hover:text-text"><ChevronRight className="w-4 h-4" /></button>
                                                  )}
                                              </div>
                                          </div>
                                          <h5 className="font-bold text-text text-sm mb-1">{order.patientName}</h5>
                                          <p className="text-xs text-slate-400 mb-3 line-clamp-2">{order.details}</p>
                                          
                                          <div className="flex justify-between items-center border-t border-border pt-3">
                                              <div className="flex flex-col">
                                                  <span className="text-[8px] font-bold text-slate-500 uppercase">Prazo</span>
                                                  <span className="text-[10px] font-bold text-slate-300">{new Date(order.dueDate).toLocaleDateString('pt-BR')}</span>
                                              </div>
                                              <div className="flex flex-col items-end">
                                                   <span className="text-[8px] font-bold text-slate-500 uppercase">Valor</span>
                                                   <span className="text-[10px] font-bold text-emerald-400">R$ {order.saleValue.toLocaleString('pt-BR')}</span>
                                              </div>
                                          </div>

                                          <div className="mt-3 bg-panel p-2 rounded-lg border border-border">
                                              <div className="flex justify-between items-center mb-1">
                                                  <span className="text-[9px] text-slate-400 font-bold uppercase">Pagamento</span>
                                                  <span className={`text-[9px] font-bold ${remaining <= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                      {remaining <= 0 ? 'Pago' : `Falta R$ ${remaining.toLocaleString('pt-BR')}`}
                                                  </span>
                                              </div>
                                              <div className="w-full h-1.5 bg-panel/80 rounded-full overflow-hidden mb-2">
                                                  <div className="h-full bg-emerald-500" style={{ width: `${percentPaid}%` }}></div>
                                              </div>
                                              <button
                                                  onClick={() => { setSelectedOrderForPayment(order); setPaymentForm({ amount: '', date: new Date().toISOString().split('T')[0] }); }}
                                                  className="w-full py-1.5 bg-panel hover:bg-emerald-500/20 hover:text-emerald-400 text-slate-400 text-[10px] font-bold uppercase rounded transition-colors flex items-center justify-center gap-2"
                                              >
                                                  <CreditCard className="w-3 h-3" /> Gerenciar Pagto
                                              </button>
                                          </div>
                                      </div>
                                  );
                              })}
                              {(visibleCounts[col.id] || 20) < colOrders.length && (
                                  <div className="text-center py-2 text-[10px] font-bold text-slate-500 uppercase flex items-center justify-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-slate-600 animate-pulse"></span>
                                      <span className="w-1.5 h-1.5 rounded-full bg-slate-600 animate-pulse delay-75"></span>
                                      <span className="w-1.5 h-1.5 rounded-full bg-slate-600 animate-pulse delay-150"></span>
                                      Mais cartões...
                                  </div>
                              )}
                          </div>
                      </div>
                  );
              })}
          </div>
      </div>
    );
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
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-600/5 blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-pink-600/5 blur-[120px] pointer-events-none"></div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-8 custom-scrollbar relative z-10 w-full">
           <div className="w-full h-full relative z-10">
               {/* Visual spacing for title */}
               <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-2">
                   <div>
                       <h1 className="text-4xl md:text-5xl font-bold text-text leading-tight tracking-tight mb-2">
                          {viewMode === 'dashboard' ? 'Dashboard' : viewMode === 'kanban' ? 'Quadro Kanban' : 'Configuração de Lab'}
                       </h1>
                       <p className="text-slate-400 text-sm">
                          {viewMode === 'dashboard' 
                             ? 'Controle de produção de próteses e alinhadores.' 
                             : viewMode === 'kanban'
                               ? 'Gerencie o fluxo de trabalho dos pedidos.'
                               : 'Configurações de laboratórios e preços.'}
                       </p>
                   </div>

                   <div className="flex gap-3 text-sm">
                      {canManage && (
                          <button onClick={() => { setIsModalOpen(true); setEditingOrderId(null); setNewOrderForm({ patient_name: '', protese_id: '', details: '', lab_name: '', sale_value: '', cost: '', start_date: new Date().toISOString().split('T')[0] }); }} className="px-6 py-2 glass-button glass-button-primary text-text rounded-xl font-bold shadow-lg transition-all flex items-center gap-2">
                              <Plus className="w-4 h-4" /> Novo Pedido
                          </button>
                      )}
                   </div>
               </div>

               {/* SUB NAVIGATION BAR */}
               <div className="flex items-center gap-1 overflow-x-auto pb-4 no-scrollbar border-b border-border mb-8">
                    {[
                        { id: 'dashboard', label: 'Dashboard', permission: 'lab_dashboard' },
                        { id: 'kanban', label: 'Kanban', permission: 'lab_kanban' },
                        { id: 'settings', label: 'Configurações', permission: 'lab_settings' },
                        ...(userEmail === 'clinica.centrodosorrisosc@gmail.com' ? [{ id: 'lab_payments_ctrl', label: 'Pagamentos ao Lab', permission: 'lab_master' }] : [])
                    ].filter(tab => {
                        if (tab.id === 'lab_payments_ctrl') return userEmail === 'clinica.centrodosorrisosc@gmail.com';
                        return userRole === 'admin' || !allowedSubTabs || allowedSubTabs.length === 0 || (Array.isArray(allowedSubTabs) && allowedSubTabs.includes(tab.permission));
                    }).map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setViewMode(tab.id as ViewMode)}
                            className={`
                                px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap glass-button
                                ${viewMode === tab.id 
                                    ? 'bg-panel/80 text-text shadow-lg' 
                                    : 'text-slate-500 opacity-60 hover:opacity-100'}
                            `}
                        >
                            {tab.label}
                        </button>
                    ))}
               </div>

                {viewMode === 'dashboard' && renderDashboard()}
                {viewMode === 'kanban' && renderKanban()}
                {viewMode === 'lab_payments_ctrl' && renderLabPaymentsControl()}
                {viewMode === 'settings' && renderSettings()}
            </div>
        </div>
      </div>

        {/* New Order Modal */}
        {orderToDelete && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/20 dark:bg-black/60 backdrop-blur-2xl animate-in fade-in duration-200">
                <div className="glass-panel p-6 rounded-2xl border border-border max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 bg-surface">
                    <div className="flex items-center gap-3 text-red-400 mb-4">
                        <Trash2 className="w-6 h-6" />
                        <h3 className="text-lg font-bold">Excluir Pedido?</h3>
                    </div>
                    <p className="text-slate-300 text-sm mb-6">
                        Tem certeza que deseja excluir permanentemente este trabalho? Esta ação não pode ser desfeita e removerá todos os pagamentos vinculados.
                    </p>
                    <div className="flex gap-3">
                        <button 
                            onClick={() => setOrderToDelete(null)}
                            disabled={isDeleting}
                            className="flex-1 py-3 rounded-xl glass-button text-text font-bold transition-all disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={() => handleDeleteOrder(orderToDelete)}
                            disabled={isDeleting}
                            className="flex-1 py-3 rounded-xl glass-button bg-red-600/20 border-red-500/30 text-text font-bold transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isDeleting ? 'Excluindo...' : 'Sim, Excluir'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 dark:bg-black/60 backdrop-blur-2xl p-4 animate-in fade-in">
                <div className="bg-surface border border-border w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="p-6 border-b border-border bg-surface flex justify-between items-center">
                        <h3 className="text-xl font-bold text-text">{editingOrderId ? 'Editar Pedido' : 'Novo Pedido Laboratorial'}</h3>
                        <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-text"><X className="w-6 h-6" /></button>
                    </div>
                    <form onSubmit={handleAddOrder} className="p-6 flex flex-col gap-4 overflow-y-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Paciente</label><input required value={newOrderForm.patient_name} onChange={e => setNewOrderForm({...newOrderForm, patient_name: e.target.value})} className="w-full bg-panel border border-border rounded-lg px-4 py-3 text-text outline-none focus:border-blue-500" placeholder="Nome completo" /></div>
                            <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Data Início</label><input type="date" required value={newOrderForm.start_date} onChange={e => setNewOrderForm({...newOrderForm, start_date: e.target.value})} className="w-full bg-panel border border-border rounded-lg px-4 py-3 text-text outline-none focus:border-blue-500" /></div>
                        </div>
                        <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Tipo de Prótese / Serviço</label><select value={newOrderForm.protese_id} onChange={handleProsthesisSelection} className="w-full bg-panel border border-border rounded-lg px-4 py-3 text-text outline-none focus:border-blue-500"><option value="">Personalizado / Outro</option>{prosthesisList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                        <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Detalhes do Trabalho</label><textarea required value={newOrderForm.details} onChange={e => setNewOrderForm({...newOrderForm, details: e.target.value})} className="w-full bg-panel border border-border rounded-lg px-4 py-3 text-text outline-none focus:border-blue-500 min-h-[80px]" placeholder="Ex: Cor A2, Dente 11 e 21..." /></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Laboratório</label><input value={newOrderForm.lab_name} onChange={e => setNewOrderForm({...newOrderForm, lab_name: e.target.value})} className="w-full bg-panel border border-border rounded-lg px-4 py-3 text-text outline-none focus:border-blue-500" placeholder="Interno ou Externo" /></div>
                            <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Venda (R$)</label><input type="text" value={newOrderForm.sale_value} onChange={e => setNewOrderForm({...newOrderForm, sale_value: e.target.value})} className="w-full bg-panel border border-border rounded-lg px-4 py-3 text-text outline-none focus:border-blue-500 font-mono text-right" placeholder="0,00" /></div>
                        </div>
                        {editingOrderId && (
                            <div className="mt-4 flex justify-end">
                                <button type="button" onClick={() => { setIsModalOpen(false); setSelectedOrderForPayment(orders.find(o => o.id === editingOrderId) || null); setPaymentForm({ amount: '', date: new Date().toISOString().split('T')[0] }); }} className="text-emerald-400 hover:text-emerald-300 text-sm font-bold flex items-center gap-1"><CreditCard className="w-4 h-4" /> Gerenciar Pagamentos</button>
                            </div>
                        )}
                        <div className="mt-4 flex justify-end gap-3 pt-4 border-t border-border">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-400 hover:text-text">Cancelar</button>
                            <button type="submit" disabled={isSaving} className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-text rounded-xl font-bold shadow-lg disabled:opacity-50">{editingOrderId ? 'Salvar Alterações' : 'Criar Pedido'}</button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {/* Payment Management Modal */}
        {selectedOrderForPayment && (
            <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/20 dark:bg-black/60 backdrop-blur-2xl p-4 animate-in fade-in">
                <div className="bg-surface border border-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-border bg-surface flex justify-between items-center">
                        <div>
                            <h3 className="text-lg font-bold text-text">Pagamentos: {selectedOrderForPayment.patientName}</h3>
                            <p className="text-xs text-slate-400">Total Venda: R$ {selectedOrderForPayment.saleValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                        </div>
                        <button onClick={() => setSelectedOrderForPayment(null)} className="text-slate-400 hover:text-text"><X className="w-6 h-6" /></button>
                    </div>
                    <div className="p-6 flex flex-col gap-4">
                        <div className="flex gap-2 items-end bg-panel p-3 rounded-xl border border-border">
                            <div className="flex-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Data Pagto</label>
                                <input type="date" value={paymentForm.date} onChange={e => setPaymentForm({...paymentForm, date: e.target.value})} className="w-full bg-panel border border-border rounded-lg px-3 py-2 text-text outline-none focus:border-emerald-500 text-sm" />
                            </div>
                            <div className="flex-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Valor (R$)</label>
                                <input type="text" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} className="w-full bg-panel border border-border rounded-lg px-3 py-2 text-text outline-none focus:border-emerald-500 text-sm font-mono" placeholder="0,00" />
                            </div>
                            <button onClick={handleAddPayment} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-500 text-text rounded-lg px-4 py-2 font-bold text-xs h-[38px] transition-colors">{editingPaymentId ? 'Atualizar' : 'Registrar'}</button>
                        </div>

                        <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto custom-scrollbar">
                            {selectedOrderForPayment.payments && selectedOrderForPayment.payments.length > 0 ? selectedOrderForPayment.payments.map(pay => (
                                <div key={pay.id} className="flex justify-between items-center p-3 bg-panel rounded-lg border border-border">
                                    <div className="flex flex-col">
                                        <span className="text-text font-mono font-bold text-sm">R$ {pay.amount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                                        <span className="text-[10px] text-slate-500">{new Date(pay.paymentDate).toLocaleDateString('pt-BR')}</span>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => handleEditPayment(pay)} className="text-slate-500 hover:text-blue-400 p-1"><Edit2 className="w-4 h-4" /></button>
                                        <button onClick={() => deletePayment(pay.id)} className="text-slate-500 hover:text-red-400 p-1"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            )) : (
                                <p className="text-xs text-slate-500 text-center py-4">Nenhum pagamento registrado.</p>
                            )}
                        </div>
                        
                        <div className="pt-4 border-t border-border flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-400 uppercase">Total Pago</span>
                            <span className="text-lg font-bold text-emerald-400">R$ {(selectedOrderForPayment.payments?.reduce((s, p) => s + p.amount, 0) || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Modal de Pagamentos Pendentes */}
        {isPendingModalOpen && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/20 dark:bg-black/60 backdrop-blur-2xl p-4 animate-in fade-in">
                <div className="bg-surface border border-border w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                    {/* Header */}
                    <div className="p-6 border-b border-border bg-surface flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                <DollarSign className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-text">Pagamentos Pendentes do Laboratório</h3>
                                <p className="text-xs text-slate-400">
                                    {pendingPaymentsList.length} {pendingPaymentsList.length === 1 ? 'trabalho com saldo pendente' : 'trabalhos com saldo pendente'} &bull; Total Pendente: <span className="font-bold text-amber-400">R$ {stats.pendingPayments.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </p>
                            </div>
                        </div>
                        <button onClick={() => setIsPendingModalOpen(false)} className="p-2 text-slate-400 hover:text-text rounded-lg hover:bg-panel transition-all">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Search Bar */}
                    <div className="p-4 border-b border-border bg-panel/30 flex items-center gap-3">
                        <div className="relative flex-1">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Buscar por paciente, laboratório ou tipo de prótese..."
                                value={pendingSearchQuery}
                                onChange={(e) => setPendingSearchQuery(e.target.value)}
                                className="w-full bg-panel border border-border rounded-xl pl-9 pr-4 py-2.5 text-xs text-text outline-none focus:border-amber-500"
                            />
                        </div>
                    </div>

                    {/* Table / List */}
                    <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                        {(() => {
                            const filtered = pendingPaymentsList.filter(item => {
                                if (!pendingSearchQuery.trim()) return true;
                                const q = pendingSearchQuery.toLowerCase();
                                const formattedDueDate = item.order.dueDate ? item.order.dueDate.split('T')[0].split('-').reverse().join('/') : '';
                                return (
                                    item.order.patientName.toLowerCase().includes(q) ||
                                    (item.order.labName && item.order.labName.toLowerCase().includes(q)) ||
                                    (item.order.details && item.order.details.toLowerCase().includes(q)) ||
                                    (item.order.type && item.order.type.toLowerCase().includes(q)) ||
                                    formattedDueDate.includes(q)
                                );
                            });

                            if (filtered.length === 0) {
                                return (
                                    <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                                        <CheckCircle className="w-12 h-12 mb-3 text-emerald-500/40" />
                                        <p className="text-sm font-bold text-slate-400">Nenhum pagamento pendente encontrado</p>
                                        <p className="text-xs text-slate-600 mt-1">Todos os pagamentos pesquisados estão quitados ou nenhum item corresponde à busca.</p>
                                    </div>
                                );
                            }

                            return (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-panel text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                            <tr>
                                                <th className="p-3 pl-4">Nome do Paciente</th>
                                                <th className="p-3">Data do Vencimento</th>
                                                <th className="p-3 text-right">Valor Original</th>
                                                <th className="p-3 text-right">Valor Pago</th>
                                                <th className="p-3 text-right">Saldo Devedor</th>
                                                <th className="p-3">Laboratório</th>
                                                <th className="p-3">Status</th>
                                                <th className="p-3 text-center">Ação</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5 text-xs">
                                            {filtered.map(({ order, totalPaid, remaining }) => {
                                                const formattedDueDate = order.dueDate ? order.dueDate.split('T')[0].split('-').reverse().join('/') : 'N/A';
                                                return (
                                                    <tr key={order.id} className="hover:bg-panel/50 transition-colors">
                                                        <td className="p-3 pl-4">
                                                            <div className="font-bold text-text">{order.patientName}</div>
                                                            <div className="text-[10px] text-slate-400 truncate max-w-[180px]">{order.details || order.type}</div>
                                                        </td>
                                                        <td className="p-3 font-mono text-slate-300">
                                                            {formattedDueDate}
                                                        </td>
                                                        <td className="p-3 text-right font-mono font-medium text-slate-300">
                                                            R$ {order.saleValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                        </td>
                                                        <td className="p-3 text-right font-mono font-medium text-emerald-400">
                                                            R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                        </td>
                                                        <td className="p-3 text-right font-mono font-bold text-amber-400">
                                                            R$ {remaining.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                        </td>
                                                        <td className="p-3 text-slate-400 text-xs">
                                                            {order.labName || 'Interno / N/I'}
                                                        </td>
                                                        <td className="p-3">
                                                            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-panel border border-border text-slate-300">
                                                                {order.status}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedOrderForPayment(order);
                                                                    setPaymentForm({ amount: remaining.toString(), date: new Date().toISOString().split('T')[0] });
                                                                }}
                                                                className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-lg text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1 mx-auto border border-emerald-500/30"
                                                            >
                                                                <CreditCard className="w-3 h-3" /> Pagar
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })()}
                    </div>
                    
                    {/* Footer */}
                    <div className="p-4 border-t border-border bg-panel/30 flex justify-end">
                        <button
                            onClick={() => setIsPendingModalOpen(false)}
                            className="px-6 py-2 bg-panel hover:bg-panel/80 text-text rounded-xl text-xs font-bold uppercase tracking-wider transition-all border border-border"
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Lab Payment Modal */}
        {isLabPayModalOpen && selectedOrderForLabPay && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                <div className="glass-panel w-full max-w-md rounded-2xl border border-border p-6 shadow-2xl bg-panel space-y-6">
                    <div className="flex items-center justify-between border-b border-border pb-4">
                        <div>
                            <h3 className="text-base font-bold text-text">Registrar Pagamento ao Laboratório</h3>
                            <p className="text-xs text-slate-400 mt-0.5">Paciente: {selectedOrderForLabPay.patientName} | Lab: {selectedOrderForLabPay.labName || 'N/I'}</p>
                        </div>
                        <button
                            onClick={() => setIsLabPayModalOpen(false)}
                            className="p-2 rounded-xl bg-panel hover:bg-panel/80 text-slate-400 hover:text-text border border-border"
                        >
                            ✕
                        </button>
                    </div>

                    <div className="space-y-4 text-xs">
                        <div className="bg-panel/50 p-3 rounded-xl border border-border flex items-center justify-between">
                            <div>
                                <span className="text-slate-400 block text-[10px] uppercase font-bold">Custo do Laboratório</span>
                                <span className="text-sm font-black font-mono text-text">R$ {selectedOrderForLabPay.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="text-right">
                                <span className="text-slate-400 block text-[10px] uppercase font-bold">Pagamento do Paciente</span>
                                <span className={`font-bold ${((selectedOrderForLabPay.payments?.reduce((s, p) => s + p.amount, 0) || 0) >= selectedOrderForLabPay.saleValue - 0.01) ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    {((selectedOrderForLabPay.payments?.reduce((s, p) => s + p.amount, 0) || 0) >= selectedOrderForLabPay.saleValue - 0.01) ? 'Quitado ✅' : 'Pendente ⚠️'}
                                </span>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Data do Pagamento</label>
                            <input
                                type="date"
                                value={labPayForm.paymentDate}
                                onChange={(e) => setLabPayForm({ ...labPayForm, paymentDate: e.target.value })}
                                className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-text outline-none focus:border-indigo-500 font-mono"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Forma de Pagamento</label>
                            <select
                                value={labPayForm.paymentMethod}
                                onChange={(e) => setLabPayForm({ ...labPayForm, paymentMethod: e.target.value })}
                                className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-text outline-none focus:border-indigo-500 font-medium"
                            >
                                <option value="PIX">PIX</option>
                                <option value="Boleto">Boleto</option>
                                <option value="Transferência Bancária">Transferência Bancária</option>
                                <option value="Cartão de Crédito">Cartão de Crédito</option>
                                <option value="Dinheiro">Dinheiro</option>
                                <option value="Outro">Outro</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Nota Fiscal / Referência</label>
                            <input
                                type="text"
                                placeholder="Ex: NF #12345 ou Recibo 098"
                                value={labPayForm.invoiceNumber}
                                onChange={(e) => setLabPayForm({ ...labPayForm, invoiceNumber: e.target.value })}
                                className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-text outline-none focus:border-indigo-500"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-border">
                        <button
                            onClick={() => setIsLabPayModalOpen(false)}
                            className="px-4 py-2 bg-panel hover:bg-panel/80 text-text rounded-xl text-xs font-bold uppercase tracking-wider border border-border transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSaveLabPayment}
                            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg shadow-indigo-600/20 transition-all"
                        >
                            Salvar Pagamento
                        </button>
                    </div>
                </div>
            </div>
        )}
      </div>
  );
};
