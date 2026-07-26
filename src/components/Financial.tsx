
import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, Account, Service } from '../types';
import { PricingSystem } from './PricingSystem';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ComposedChart, Label, Line, ReferenceLine, LabelList
} from 'recharts';
import { 
  Filter, AlertTriangle, RefreshCw, FileText, CheckCircle, StickyNote, Edit, 
  Wallet, ShieldCheck, TrendingUp, LineChart,
  Building2, ChevronDown, ChevronUp, Trash2, Banknote, Users, Factory, CreditCard, 
  Percent, List, Plus, Minus, Receipt, Upload, X, Download, Check
} from 'lucide-react';
import { motion } from 'motion/react';
import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient';
import { DateRangePicker } from './ui/date-range-picker';
import { SpotlightCard } from './ui/spotlight-card';
import { toast } from 'sonner';

// --- TYPES & INTERFACES ---

type SubTab = 'overview' | 'transactions' | 'expenses' | 'dre' | 'accounts' | 'settings' | 'pricing';

interface SubCategory {
    id: string;
    name: string;
    defaultValue?: number; 
}

interface IncomeCategory {
    id: string;
    name: string;
    subcategories: SubCategory[];
    type: 'income';
}

interface ExpenseCategory {
    id: string;
    name: string;
    type: 'fixed' | 'variable';
    subcategories: SubCategory[]; 
}

interface Professional {
    id: string;
    name: string;
}

interface SalesTeam {
    id: string;
    name: string;
    color?: string;
}

interface Supplier {
    id: string;
    name: string;
}

interface PaymentMethod {
    id: string;
    name: string;
    daysToReceive: number; 
    defaultAccountId?: string; 
}

interface CardFeeConfig {
    brand: string;
    debit: number;
    credit1x: number;
    installments: Record<number, number>;
}

interface LocalAccount extends Account {
    initialBalance: number;
}

interface LocalTransaction extends Transaction {
    settlementDate?: string; 
    relatedTransferId?: string;
    procedure?: string;
    reconciliationStatus?: 'verified' | 'error' | 'pending';
    reconciliationNote?: string;
    invoiceEmitted?: boolean;
    appliedFeeRate?: number;
    explicitFeeAmount?: number;
    observation?: string;
    cardBrand?: string;
    accountId?: string;
    installments?: number;
    isPartial?: boolean;
}

const COLORS = ['#d946ef', '#8b5cf6', '#2dd4bf', '#fb923c', '#ef4444', '#3b82f6'];

const ALL_TABS_CONFIG = [
  { id: 'overview', label: 'Visão Geral', permissionId: 'financial_overview' },
  { id: 'transactions', label: 'Receitas', permissionId: 'financial_transactions' },
  { id: 'expenses', label: 'Despesas', permissionId: 'financial_expenses' },
  { id: 'dre', label: 'DRE', permissionId: 'financial_dre' },
  { id: 'accounts', label: 'Contas & Extratos', permissionId: 'financial_accounts' },
  { id: 'pricing', label: 'Precificação', permissionId: 'financial_pricing' },
  { id: 'settings', label: 'Configurações', permissionId: 'financial_settings' }
];

interface FinancialProps {
    userRole: string;
    allowedSubTabs?: string[];
    requestedSubTab?: string | null;
    requestedAction?: string | null;
}

export const Financial: React.FC<FinancialProps> = ({ userRole, allowedSubTabs = [], requestedSubTab, requestedAction }) => {
  const visibleTabs = useMemo(() => {
      if (userRole === 'admin' || !allowedSubTabs || allowedSubTabs.length === 0) return ALL_TABS_CONFIG;
      const filtered = ALL_TABS_CONFIG.filter(tab => Array.isArray(allowedSubTabs) && allowedSubTabs.includes(tab.permissionId));
      return filtered.length > 0 ? filtered : ALL_TABS_CONFIG;
  }, [userRole, allowedSubTabs]);

  const [activeSubTab, setActiveSubTab] = useState<SubTab>(visibleTabs[0]?.id as SubTab || 'overview');
  const [isPaymentMethodFilterOpen, setIsPaymentMethodFilterOpen] = useState(false);

  useEffect(() => {
      if (visibleTabs.length > 0 && !visibleTabs.find(t => t.id === activeSubTab)) {
          setActiveSubTab(visibleTabs[0].id as SubTab);
      }
  }, [visibleTabs, activeSubTab]);

  // Listener para mudança de aba via Sidebar
  useEffect(() => {
      if (requestedSubTab) {
          const tabExists = visibleTabs.find(t => t.id === requestedSubTab);
          if (tabExists) {
              setActiveSubTab(requestedSubTab as SubTab);
          }
      }
  }, [requestedSubTab, visibleTabs]);

  const today = new Date().toISOString().split('T')[0];

  const safeGenerateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  };

  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [transactions, setTransactions] = useState<LocalTransaction[]>([]);
  const [selectedExpenses, setSelectedExpenses] = useState<string[]>([]);
  const [selectedIncomes, setSelectedIncomes] = useState<string[]>([]);
  const [accountsList, setAccountsList] = useState<LocalAccount[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<IncomeCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [salesTeams, setSalesTeams] = useState<SalesTeam[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [monthlyRevenueGoal, setMonthlyRevenueGoal] = useState<number>(0);

  const [cardFees, setCardFees] = useState<CardFeeConfig[]>([]);

  // Settings UI States
  const [newIncomeCategory, setNewIncomeCategory] = useState('');
  const [newExpenseCategory, setNewExpenseCategory] = useState('');
  const [newExpenseType, setNewExpenseType] = useState<'fixed' | 'variable'>('variable');
  const [newSupplier, setNewSupplier] = useState('');
  const [newProfessional, setNewProfessional] = useState('');
  const [newSalesTeam, setNewSalesTeam] = useState('');
  const [newSalesTeamColor, setNewSalesTeamColor] = useState('#8b5cf6');
  const [newPaymentMethod, setNewPaymentMethod] = useState('');
  const [expandedCatId, setExpandedCatId] = useState<string | null>(null);
  const [expandedExpId, setExpandedExpId] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState('');
  const [newSubValue, setNewSubValue] = useState('');

  // States for Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'income' | 'expense'>('income');
  const [isSaving, setIsSaving] = useState(false);
  
  // Bulk States
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isBulkChangeCatOpen, setIsBulkChangeCatOpen] = useState(false);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [isBulkChangeCatExpensesOpen, setIsBulkChangeCatExpensesOpen] = useState(false);
  const [isBulkDeleteExpensesConfirmOpen, setIsBulkDeleteExpensesConfirmOpen] = useState(false);
  const [activeBulkActionTab, setActiveBulkActionTab] = useState<'income' | 'expense' | null>(null);
  const [bulkRows, setBulkRows] = useState<any[]>([]);
  const [pastedData, setPastedData] = useState('');
  const [selectedDreMonth, setSelectedDreMonth] = useState(new Date().toISOString().slice(0, 7));

  // Observation Modal
  const [isObsModalOpen, setIsObsModalOpen] = useState(false);
  const [selectedTxForObs, setSelectedTxForObs] = useState<LocalTransaction | null>(null);
  const [tempObs, setTempObs] = useState('');

  // Account Statement Modal
  const [selectedAccountForStatement, setSelectedAccountForStatement] = useState<LocalAccount | null>(null);
  
  // Account Creation Modal
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [newAccount, setNewAccount] = useState({ name: '', bank: '', initialBalance: '' });

  const handleSaveAccount = async () => {
      if (!newAccount.name || !newAccount.bank) return toast.error('Preencha nome e banco.');
      setIsSaving(true);
      const { error } = await supabase.from('accounts').insert({
          id: 'acc_' + safeGenerateId(),
          name: newAccount.name,
          bank: newAccount.bank,
          initial_balance: parseFloat(newAccount.initialBalance.replace(',', '.')) || 0,
          type: 'checking',
          color: '#3b82f6'
      });
      if (!error) {
          await fetchAllData();
          setIsAccountModalOpen(false);
          setNewAccount({ name: '', bank: '', initialBalance: '' });
          toast.success('Conta criada com sucesso!');
      } else {
          toast.error('Erro ao criar conta: ' + error.message);
      }
      setIsSaving(false);
  };

  // States for Charts Interaction
  const [activeCategoryIndex, setActiveCategoryIndex] = useState<number | null>(null);
  const [activeProcedureIndex, setActiveProcedureIndex] = useState<number | null>(null);
  const [activePaymentIndex, setActivePaymentIndex] = useState<number | null>(null);

  const [payingTxId, setPayingTxId] = useState<string | null>(null);
  const [tempPaymentDate, setTempPaymentDate] = useState('');

  const confirmPayment = async (tx: LocalTransaction) => {
      if (!tempPaymentDate) return toast.error('Informe a data do pagamento.');
      const { error } = await supabase.from('transactions').update({ 
          status: 'Paid', 
          settlement_date: tempPaymentDate 
      }).eq('id', tx.id);
      
      if (!error) {
          setTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, status: 'Paid', settlementDate: tempPaymentDate } : t));
          setPayingTxId(null);
          toast.success('Pagamento confirmado com sucesso!');
      } else {
          toast.error('Erro ao confirmar pagamento: ' + error.message);
      }
  };

  const bulkDeleteExpenses = async () => {
      if (selectedExpenses.length === 0) return;
      
      const { error } = await supabase.from('transactions').delete().in('id', selectedExpenses);
      if (!error) {
          setTransactions(prev => prev.filter(t => !selectedExpenses.includes(t.id)));
          setSelectedExpenses([]);
          setIsBulkDeleteExpensesConfirmOpen(false);
          toast.success(`${selectedExpenses.length} despesas excluídas.`);
      } else {
          console.error('Erro ao excluir despesas selecionadas.', error);
          toast.error('Erro ao excluir despesas: ' + error.message);
      }
  };

  const bulkDeleteIncomes = async () => {
      if (selectedIncomes.length === 0) return;
      
      const { error } = await supabase.from('transactions').delete().in('id', selectedIncomes);
      if (!error) {
          setTransactions(prev => prev.filter(t => !selectedIncomes.includes(t.id)));
          setSelectedIncomes([]);
          setIsBulkDeleteConfirmOpen(false);
          toast.success(`${selectedIncomes.length} receitas excluídas.`);
      } else {
          console.error('Erro ao excluir receitas selecionadas.', error);
          toast.error('Erro ao excluir receitas: ' + error.message);
      }
  };

  const bulkChangeCategoryIncomes = async (newCategory: string) => {
      if (selectedIncomes.length === 0) return;
      
      const { error } = await supabase
          .from('transactions')
          .update({ category: newCategory })
          .in('id', selectedIncomes);
          
      if (!error) {
          setTransactions(prev => prev.map(t => selectedIncomes.includes(t.id) ? { ...t, category: newCategory } : t));
          setSelectedIncomes([]);
          setIsBulkChangeCatOpen(false);
          toast.success(`Categoria de ${selectedIncomes.length} receita(s) alterada para "${newCategory}".`);
      } else {
          console.error('Erro ao alterar categoria em lote.', error);
          toast.error('Erro ao alterar categoria: ' + error.message);
      }
  };

  const bulkChangeCategoryExpenses = async (newCategory: string) => {
      if (selectedExpenses.length === 0) return;
      
      const { error } = await supabase
          .from('transactions')
          .update({ category: newCategory })
          .in('id', selectedExpenses);
          
      if (!error) {
          setTransactions(prev => prev.map(t => selectedExpenses.includes(t.id) ? { ...t, category: newCategory } : t));
          setSelectedExpenses([]);
          setIsBulkChangeCatExpensesOpen(false);
          toast.success(`Categoria de ${selectedExpenses.length} despesa(s) alterada para "${newCategory}".`);
      } else {
          console.error('Erro ao alterar categoria em lote.', error);
          toast.error('Erro ao alterar categoria: ' + error.message);
      }
  };

  const togglePaymentStatus = async (tx: LocalTransaction) => {
      if (tx.status === 'Paid') {
          if (!confirm('Marcar como pendente (A Pagar)?')) return;
          const { error } = await supabase.from('transactions').update({ 
              status: 'Pending', 
              settlement_date: null 
          }).eq('id', tx.id);
          
          if (!error) {
              setTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, status: 'Pending', settlementDate: undefined } : t));
          }
      }
  };

  const [overviewFilters, setOverviewFilters] = useState({
      start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
      end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
  });

  const initialTxFilters = {
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
    category: 'all', 
    status: 'all', 
    paymentMethods: [] as string[], 
    professional: 'all', 
    procedure: 'all', 
    auditStatus: 'all',
    hasNF: 'all',
    isPartial: 'all',
    search: ''
  };

  const [txFilters, setTxFilters] = useState(initialTxFilters);
  
  const [expFilters, setExpFilters] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
    category: 'all',
    search: '',
    statuses: ['Paid', 'Pending'] as string[]
  });

  const [formData, setFormData] = useState({
    id: '', description: '', amount: '', category: '', procedure: '', accountId: '',
    date: today, status: 'Paid' as 'Paid' | 'Pending', paymentMethod: 'Dinheiro', professional: '', installments: 1, observation: '',
    isPartial: false,
    cardBrand: '',
    settlementDate: '',
    supplier: '',
    salesTeam: '',
    recurrence: 1
  });

  const overviewMetrics = useMemo(() => {
    const periodIncome = transactions.filter(t => {
      if (t.type !== 'income' || t.status !== 'Paid') return false;
      if (!t.date) return false;
      return t.date >= overviewFilters.start && t.date <= overviewFilters.end;
    });

    const errorCount = transactions.filter(t => 
        t.type === 'income' && 
        t.reconciliationStatus === 'error' && 
        t.date >= overviewFilters.start && 
        t.date <= overviewFilters.end
    ).length;

    const currentMonthIncome = periodIncome.reduce((acc, curr) => acc + curr.amount, 0);
    const ticketAverage = periodIncome.length > 0 ? currentMonthIncome / periodIncome.length : 0;

    // --- AGGREGATION FOR CHARTS ---
    const groupData = (key: keyof LocalTransaction, fallback: string = 'Outros') => {
        const map: Record<string, number> = {};
        periodIncome.forEach(t => {
            const label = (t[key] as string) || fallback;
            map[label] = (map[label] || 0) + t.amount;
        });
        return Object.entries(map)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10); // Limit to Top 10 items
    };

    const categoryData = groupData('category');
    const procedureData = groupData('procedure', 'Geral');
    const paymentData = groupData('paymentMethod');

    const categoryTicketAverage = (() => {
        const map: Record<string, { total: number, count: number }> = {};
        periodIncome.forEach(t => {
            const label = t.category || 'Outros';
            if (!map[label]) map[label] = { total: 0, count: 0 };
            map[label].total += t.amount;
            map[label].count += 1;
        });
        return Object.entries(map).map(([name, data]) => ({
            name,
            average: data.total / data.count
        })).sort((a, b) => b.average - a.average);
    })();

    return {
      currentMonthIncome,
      ticketAverage,
      errorCount,
      categoryData,
      procedureData,
      paymentData,
      categoryTicketAverage
    };
  }, [transactions, overviewFilters]);

  const monthlyRevenueData = useMemo(() => {
      const data2025Map: Record<string, number> = {
          '2025-01': 31864,
          '2025-02': 50402,
          '2025-03': 35091,
          '2025-04': 41134,
          '2025-05': 42382,
          '2025-06': 42618,
          '2025-07': 42679,
          '2025-08': 52777,
          '2025-09': 61995,
          '2025-10': 67175,
          '2025-11': 76109,
          '2025-12': 47282,
      };

      const systemDataMap: Record<string, number> = {};
      transactions.forEach(t => {
          if (t.type === 'income' && t.status === 'Paid' && t.date) {
              const [year, month] = t.date.split('-');
              const key = `${year}-${month}`;
              systemDataMap[key] = (systemDataMap[key] || 0) + t.amount;
          }
      });

      const last12Months: { month: string; monthRaw: string; revenue: number; goal: number }[] = [];
      const now = new Date();
      for (let i = 11; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const mmText = d.toLocaleString('pt-BR', { month: 'short' });
          const key = `${y}-${m}`;
          const monthStr = `${mmText}/${String(y).substring(2)}`;
          
          let revenue = 0;
          if (y === 2025 && data2025Map[key]) {
             revenue += data2025Map[key];
          }
          revenue += (systemDataMap[key] || 0);

          last12Months.push({
              month: monthStr,
              monthRaw: key,
              revenue: revenue,
              goal: monthlyRevenueGoal
          });
      }

      return last12Months.map((item, index) => {
          let variance = 0;
          if (index > 0) {
              const prevRevenue = last12Months[index - 1].revenue;
              if (prevRevenue > 0) {
                  variance = ((item.revenue - prevRevenue) / prevRevenue) * 100;
              } else if (item.revenue > 0) {
                  variance = 100;
              }
          }
          return {
              ...item,
              variance: Math.round(variance),
              revenueLabel: item.revenue > 0 ? item.revenue.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : '0'
          };
      });
  }, [transactions, monthlyRevenueGoal]);

  const calculateRemainingWorkDays = () => {
    const now = new Date();
    let count = 0;
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    while (d <= lastDay) {
        const dayOfWeek = d.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            count++;
        }
        d.setDate(d.getDate() + 1);
    }
    return count;
  };

  const dailyMetaRequired = useMemo(() => {
    const now = new Date();
    const currentMonthPrefix = now.toISOString().slice(0, 7);
    const currentMonthRealized = transactions
      .filter(t => t.type === 'income' && t.status === 'Paid' && t.date && t.date.startsWith(currentMonthPrefix))
      .reduce((acc, curr) => acc + curr.amount, 0);

    const remainingDays = calculateRemainingWorkDays();
    const needed = Math.max(0, monthlyRevenueGoal - currentMonthRealized);
    
    return remainingDays > 0 ? needed / remainingDays : 0;
  }, [transactions, monthlyRevenueGoal]);

  const fetchAllData = async () => {
      setLoading(true);
      try {
          const { data: { user }, error: userError } = await supabase.auth.getUser();
          if (user && user.email) setUserEmail(user.email);

          let allTxs: any[] = [];
          
          const { count } = await supabase.from('transactions').select('*', { count: 'exact', head: true });
          const totalCount = count || 0;
          
          if (totalCount > 0) {
              const fetchPromises = [];
              const pageSize = 1000;
              for (let i = 0; i < totalCount; i += pageSize) {
                  fetchPromises.push(
                      supabase.from('transactions').select('*').order('date', { ascending: false }).range(i, i + pageSize - 1)
                  );
              }
              const results = await Promise.all(fetchPromises);
              results.forEach(res => {
                  if (res.data) allTxs = [...allTxs, ...res.data];
              });
          }
          const txData = allTxs;
          if (txData) {
              setTransactions(txData.map(t => ({
                  id: t.id, date: t.date, description: t.description, category: t.category,
                  type: t.type, amount: t.amount, status: t.status, payment_method: t.payment_method, 
                  paymentMethod: t.payment_method, 
                  professional: t.professional,
                  installments: t.installments, accountId: t.account_id, reconciliationStatus: t.reconciliation_status,
                  invoiceEmitted: t.invoice_emitted, observation: t.observation, procedure: t.procedure,
                  isPartial: t.is_partial,
                  appliedFeeRate: t.applied_fee_rate,
                  explicitFeeAmount: t.explicit_fee_amount,
                  cardBrand: t.card_brand,
                  externalId: t.external_id, 
                  source: t.source,
                  settlementDate: t.settlement_date,
                  supplier: t.supplier,
                  salesTeam: t.sales_team
              })));
          }
          
          const currentKey = new Date().toISOString().slice(0, 7);
          const { data: goalData } = await supabase.from('dashboard_configs').select('revenue_goal').eq('month_key', currentKey).maybeSingle();
          if (goalData) setMonthlyRevenueGoal(Number(goalData.revenue_goal));

          const { data: accData } = await supabase.from('accounts').select('*');
          if (accData) setAccountsList(accData.map(a => ({ ...a, initialBalance: a.initial_balance })));
          const { data: incCats } = await supabase.from('income_categories').select('*');
          if (incCats) setIncomeCategories(incCats.map(c => ({ ...c, subcategories: Array.isArray(c.subcategories) ? c.subcategories : [] })));
          const { data: expCats } = await supabase.from('expense_categories').select('*');
          if (expCats) setExpenseCategories(expCats.map(c => ({ ...c, subcategories: Array.isArray(c.subcategories) ? c.subcategories : [] })));
          const { data: profs } = await supabase.from('professionals').select('*');
          if (profs) setProfessionals(profs);
          const { data: supps } = await supabase.from('suppliers').select('*');
          if (supps) setSuppliers(supps);
          const { data: teams } = await supabase.from('sales_teams').select('*');
          if (teams) setSalesTeams(teams);
          const { data: payMethods } = await supabase.from('payment_methods').select('*');
          if (payMethods) setPaymentMethods(payMethods.map(p => ({ id: p.id, name: p.name, daysToReceive: p.days_to_receive, defaultAccountId: p.default_account_id })));
          const { data: fees } = await supabase.from('card_fees').select('*');
          if (fees && fees.length > 0) setCardFees(fees);
      } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  useEffect(() => { 
    fetchAllData(); 
  }, []);

  const handleSaveTransaction = async () => {
      try {
          const amountVal = parseFloat((formData.amount || '0').toString().replace(',', '.'));
          
          // Validação de Campos Obrigatórios
          if (!formData.date) return toast.error('Selecione a data do lançamento.');
          if (!formData.description?.trim()) return toast.error(modalType === 'income' ? 'Informe o nome do paciente.' : 'Informe a descrição da despesa.');
          if (!formData.category) return toast.error('Selecione uma categoria.');
          
          const currentCategoryObj = (modalType === 'income' ? incomeCategories : expenseCategories).find(c => c.name === formData.category);
          const hasSubcategories = currentCategoryObj && currentCategoryObj.subcategories && currentCategoryObj.subcategories.length > 0;
          if (hasSubcategories && !formData.procedure) return toast.error('Selecione um sub-categoria / procedimento.');
          
          if (isNaN(amountVal) || amountVal <= 0) return toast.error('Informe um valor válido maior que zero.');
          if (!formData.accountId) return toast.error('Selecione a conta de destino/origem.');
          if (!formData.paymentMethod) return toast.error('Selecione a forma de pagamento.');

          if (modalType === 'income') {
              if (!formData.professional) return toast.error('Selecione o profissional responsável.');
              
              const method = (formData.paymentMethod || '').toLowerCase();
              const isCard = method.includes('cartão') || method.includes('crédito') || method.includes('débito');
              if (isCard && !formData.cardBrand) {
                  return toast.error('Selecione a bandeira do cartão para cálculo de taxas.');
              }
          }

          setIsSaving(true);
          
          const transactionsToInsert = [];
          const baseDate = new Date(formData.date);
          // Fix timezone offset issue when parsing YYYY-MM-DD
          baseDate.setMinutes(baseDate.getMinutes() + baseDate.getTimezoneOffset());
          
          let baseSettlementDate = null;
          if (formData.settlementDate) {
              baseSettlementDate = new Date(formData.settlementDate);
              if (!isNaN(baseSettlementDate.getTime())) {
                baseSettlementDate.setMinutes(baseSettlementDate.getMinutes() + baseSettlementDate.getTimezoneOffset());
              } else {
                baseSettlementDate = null;
              }
          }

          const recurrenceCount = (modalType === 'expense' && !formData.id) ? (formData.recurrence || 1) : 1;

          for (let i = 0; i < recurrenceCount; i++) {
              const currentTxDate = new Date(baseDate);
              currentTxDate.setMonth(currentTxDate.getMonth() + i);
              
              let currentSettlementDate = null;
              if (baseSettlementDate) {
                  const tempSettlement = new Date(baseSettlementDate);
                  tempSettlement.setMonth(tempSettlement.getMonth() + i);
                  currentSettlementDate = tempSettlement.toISOString().split('T')[0];
              }

              const isRestrictedProcedure = formData.procedure === 'Panorâmica' || formData.procedure === 'Documentação Inicial';

              transactionsToInsert.push({
                  id: (i === 0 && formData.id) ? formData.id : 'tx_' + safeGenerateId(), 
                  description: recurrenceCount > 1 ? `${formData.description} (${i + 1}/${recurrenceCount})` : formData.description, 
                  amount: amountVal, 
                  category: formData.category,
                  procedure: formData.procedure, 
                  date: currentTxDate.toISOString().split('T')[0], 
                  type: modalType, 
                  status: formData.status,
                  payment_method: formData.paymentMethod, 
                  account_id: formData.accountId, 
                  professional: formData.professional,
                  installments: formData.installments, 
                  observation: formData.observation,
                  is_partial: formData.isPartial,
                  card_brand: formData.cardBrand,
                  settlement_date: currentSettlementDate || null,
                  supplier: formData.supplier,
                  sales_team: isRestrictedProcedure ? '' : formData.salesTeam
              });
          }

          const { error } = await supabase.from('transactions').upsert(transactionsToInsert);
          if (!error) { 
              await fetchAllData(); 
              setIsModalOpen(false);
              toast.success('Lançamento salvo com sucesso!');
          } else { 
              toast.error('Erro ao salvar no banco de dados: ' + error.message); 
          }
      } catch (err: any) {
          console.error("Erro no handleSaveTransaction:", err);
          toast.error('Ocorreu um erro inesperado: ' + err.message);
      } finally {
          setIsSaving(false);
      }
  };

  const openBulkModal = (type: 'income' | 'expense' = 'income') => {
    const defaultAcc = accountsList[0]?.id || '';
    setBulkRows([{
        date: today, description: '', amount: '', category: (type === 'income' ? incomeCategories : expenseCategories)[0]?.name || '', 
        procedure: '', type: type, status: 'Paid', paymentMethod: 'Dinheiro', professional: '', salesTeam: '', accountId: defaultAcc
    }]);
    setPastedData('');
    setIsBulkModalOpen(true);
  };

  const addBulkRow = () => {
    const lastRow = bulkRows[bulkRows.length - 1];
    setBulkRows([...bulkRows, { ...lastRow, description: '', amount: '' }]);
  };

  const removeBulkRow = (index: number) => {
    if (bulkRows.length <= 1) return;
    setBulkRows(bulkRows.filter((_, i) => i !== index));
  };

  const handleBulkChange = (index: number, field: string, value: any) => {
    const newRows = [...bulkRows];
    newRows[index] = { ...newRows[index], [field]: value };
    
    // Auto-update procedural details if category changes
    if (field === 'category') {
        newRows[index].procedure = '';
    }

    // Restriction rule for specific procedures
    if (field === 'procedure') {
        if (value === 'Panorâmica' || value === 'Documentação Inicial') {
            newRows[index].salesTeam = '';
        }
    }
    
    setBulkRows(newRows);
  };

  // --- LOGICA DE BUSCA INTELIGENTE PARA IMPORTAÇÃO ---
  
  const findBestMatch = (input: string, list: {name: string}[]) => {
      if (!input) return '';
      const search = input.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
      // 1. Busca Exata (sem acentos)
      let match = list.find(item => item.name.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === search);
      if (match) return match.name;
      
      // 2. Busca por Início do texto
      match = list.find(item => item.name.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").startsWith(search));
      if (match) return match.name;

      // 3. Busca por "Contém"
      match = list.find(item => item.name.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(search));
      if (match) return match.name;

      return input.trim(); // Se não achar nada, retorna o texto original para o usuário ver o erro na grade
  };

  const parseImportDate = (val: string) => {
      if (!val) return today;
      const clean = val.trim();
      if (clean.includes('/')) {
          const parts = clean.split('/');
          if (parts.length === 3) {
              const day = parts[0].padStart(2, '0');
              const month = parts[1].padStart(2, '0');
              let year = parts[2];
              if (year.length === 2) year = '20' + year;
              return `${year}-${month}-${day}`;
          }
      }
      if (clean.includes('-')) {
          const parts = clean.split('-');
          if (parts[0].length === 4) return clean;
          if (parts[2].length === 4) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
      return clean;
  };

  const processImportRows = (lines: string[], separator: string = '\t') => {
      const defaultAcc = accountsList[0]?.id || '';
      return lines.map((line: any) => {
          const cols = line.split(separator);
          const importedType = cols[4]?.toLowerCase().includes('desp') ? 'expense' : 'income';
          const importedCatText = cols[2]?.trim() || '';
          
          // Mapeia Categoria
          const matchedCatName = findBestMatch(importedCatText, importedType === 'income' ? incomeCategories : expenseCategories);
          
          // Mapeia Profissional
          const matchedProf = findBestMatch(cols[7]?.trim() || '', professionals);
          
          // Mapeia Forma de Pagamento
          const matchedPayment = findBestMatch(cols[6]?.trim() || '', paymentMethods);

          // Mapeia Procedimento (busca dentro da categoria mapeada)
          const currentCatObj = (importedType === 'income' ? incomeCategories : expenseCategories).find(c => c.name === matchedCatName);
          const matchedProcedure = findBestMatch(cols[3]?.trim() || '', currentCatObj?.subcategories || []);

          return {
              date: parseImportDate(cols[0]),
              description: cols[1]?.trim() || '',
              category: matchedCatName || (importedType === 'income' ? incomeCategories[0]?.name : expenseCategories[0]?.name),
              procedure: matchedProcedure,
              type: importedType,
              amount: cols[5]?.replace('R$', '').replace(/\./g, '').replace(',', '.').trim() || '',
              paymentMethod: matchedPayment || 'Dinheiro',
              professional: matchedProf,
              salesTeam: '',
              accountId: defaultAcc
          };
      });
  };

  const handleProcessPastedData = () => {
      if (!pastedData.trim()) return;
      const lines = pastedData.split('\n').filter(l => l.trim());
      const newParsedRows = processImportRows(lines, '\t');
      setBulkRows(newParsedRows);
      setPastedData('');
      toast.success(`${newParsedRows.length} linhas processadas.`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
          const text = event.target?.result as string;
          const lines = text.split('\n').filter(l => l.trim());
          const startIdx = (lines[0].toLowerCase().includes('data') || lines[0].toLowerCase().includes('paciente')) ? 1 : 0;
          const separator = lines[0].includes(';') ? ';' : ',';
          const newParsedRows = processImportRows(lines.slice(startIdx), separator);
          setBulkRows(newParsedRows);
          toast.success(`${newParsedRows.length} linhas carregadas.`);
      };
      reader.readAsText(file);
  };

  const handleSaveBulk = async () => {
    const validRows = bulkRows.filter(r => r.description.trim() && parseFloat(r.amount.toString().replace(',', '.')) > 0);
    if (validRows.length === 0) return toast.error("Preencha ao menos um lançamento válido.");

    setIsSaving(true);
    const toInsert = validRows.map(r => {
        const isRestrictedProcedure = r.procedure === 'Panorâmica' || r.procedure === 'Documentação Inicial';
        return {
            id: 'tx_' + safeGenerateId(),
            description: r.description,
            amount: parseFloat(r.amount.toString().replace(',', '.')),
            category: r.category,
            procedure: r.procedure,
            date: r.date,
            type: r.type,
            status: r.status || (r.type === 'expense' ? 'Pending' : 'Paid'),
            payment_method: r.paymentMethod,
            account_id: r.accountId,
            professional: r.professional,
            sales_team: isRestrictedProcedure ? '' : r.salesTeam,
            installments: 1
        };
    });

    const { error } = await supabase.from('transactions').insert(toInsert);
    if (!error) { 
        await fetchAllData(); 
        setIsBulkModalOpen(false); 
        toast.success('Processamento concluído com sucesso!');
    }
    else toast.error("Erro ao salvar: " + error.message);
    setIsSaving(false);
  };

  const openModal = (type: 'income' | 'expense', editData?: LocalTransaction) => {
    setModalType(type);
    if (editData) {
        setFormData({
            id: editData.id, description: editData.description,
            amount: (editData.amount || 0).toString(), category: editData.category, procedure: editData.procedure || '',
            accountId: editData.accountId || '', date: editData.date, status: editData.status as any,
            paymentMethod: editData.paymentMethod || '', professional: editData.professional || '',
            installments: editData.installments || 1, observation: editData.observation || '',
            isPartial: !!editData.isPartial, cardBrand: editData.cardBrand || '',
            settlementDate: editData.settlementDate || '',
            supplier: editData.supplier || '',
            salesTeam: editData.salesTeam || '',
            recurrence: 1
        });
    } else {
        const defaultCat = (type === 'income' ? incomeCategories[0]?.name : expenseCategories[0]?.name) || '';
        const defaultAcc = accountsList[0]?.id || '';
        setFormData({
            id: '', description: '', amount: '', category: defaultCat, procedure: '',
            accountId: defaultAcc, date: today, status: type === 'expense' ? 'Pending' : 'Paid', paymentMethod: 'Dinheiro',
            professional: '', installments: 1, observation: '', isPartial: false, cardBrand: '',
            settlementDate: '',
            supplier: '',
            salesTeam: '',
            recurrence: 1
        });
    }
    setIsModalOpen(true);
  };

  useEffect(() => {
      if (requestedAction === 'new_income') {
          setActiveSubTab('transactions');
          // Precisa garantir que as categorias/contas já foram carregadas, mas openModal usa o estado atual
          openModal('income');
      } else if (requestedAction === 'new_expense') {
          setActiveSubTab('transactions');
          openModal('expense');
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedAction, accountsList]);

  const openObsModal = (tx: LocalTransaction) => {
      setSelectedTxForObs(tx);
      setTempObs(tx.observation || '');
      setIsObsModalOpen(true);
  };

  const handleSaveObservation = async () => {
      if (!selectedTxForObs) return;
      const { error } = await supabase.from('transactions').update({ observation: tempObs }).eq('id', selectedTxForObs.id);
      if (!error) {
          setTransactions(prev => prev.map(t => t.id === selectedTxForObs.id ? { ...t, observation: tempObs } : t));
          setIsObsModalOpen(false);
      }
  };

  const handleUpdateFee = async (txId: string, newFee: number) => {
      const { error } = await supabase.from('transactions').update({ explicit_fee_amount: newFee }).eq('id', txId);
      if (!error) setTransactions(prev => prev.map(t => t.id === txId ? { ...t, explicitFeeAmount: newFee } : t));
  };

  const toggleNF = async (tx: LocalTransaction) => {
      const nextValue = !tx.invoiceEmitted;
      const { error } = await supabase.from('transactions').update({ invoice_emitted: nextValue }).eq('id', tx.id);
      if (!error) setTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, invoiceEmitted: nextValue } : t));
  };

  const toggleAuditStatus = async (tx: LocalTransaction, nextStatus: 'verified' | 'error' | 'pending') => {
      const finalStatus = tx.reconciliationStatus === nextStatus ? 'pending' : nextStatus;
      const { error } = await supabase.from('transactions').update({ reconciliation_status: finalStatus }).eq('id', tx.id);
      if (!error) setTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, reconciliationStatus: finalStatus } : t));
  };

  const handleCategoryChange = (catName: string) => {
    setFormData(prev => ({ ...prev, category: catName, procedure: '', amount: '' }));
  };

  const handleSubCategoryChange = (subName: string) => {
    const categories = modalType === 'income' ? incomeCategories : expenseCategories;
    const currentCat = categories.find(c => c.name === formData.category);
    const sub = currentCat?.subcategories.find((s: any) => s.name === subName);
    
    const isRestrictedProcedure = subName === 'Panorâmica' || subName === 'Documentação Inicial';
    
    setFormData(prev => ({ 
        ...prev, 
        procedure: subName, 
        amount: (sub && 'defaultValue' in sub && sub.defaultValue) ? sub.defaultValue.toString() : prev.amount,
        salesTeam: isRestrictedProcedure ? '' : prev.salesTeam
    }));
  };

  const handlePaymentMethodChange = (pmName: string) => {
    const method = paymentMethods.find(m => m.name === pmName);
    setFormData(prev => ({ 
        ...prev, 
        paymentMethod: pmName, 
        accountId: method?.defaultAccountId || prev.accountId,
        installments: (pmName.toLowerCase().includes('cartão') || pmName.toLowerCase().includes('crédito')) ? prev.installments : 1
    }));
  };

  const getEffectiveFee = (tx: LocalTransaction) => {
      if (tx.explicitFeeAmount !== undefined && tx.explicitFeeAmount !== null && tx.explicitFeeAmount !== 0) return tx.explicitFeeAmount;
      const method = (tx.paymentMethod || '').toLowerCase();
      
      if (method === 'financiamento dentalcred') {
          return (tx.amount * 6.59) / 100;
      }
      
      const isCard = method.includes('cartão') || method.includes('crédito') || method.includes('débito');
      if (isCard && cardFees.length > 0) {
          const feeConfig = cardFees.find(f => f && f.brand === tx.cardBrand) || cardFees[0];
          let rate = 0;
          if (feeConfig) {
              if (method.includes('débito')) rate = feeConfig.debit || 0;
              else if (tx.installments && tx.installments > 1) rate = (feeConfig.installments && feeConfig.installments[tx.installments]) || 0;
              else rate = feeConfig.credit1x || 0;
          }
          return (tx.amount * rate) / 100;
      }
      return 0;
  };

  const handleExport = (data: LocalTransaction[]) => {
    const headers = ['Data', 'Descrição', 'Categoria', 'Procedimento', 'Profissional', 'Forma Pagto', 'Valor', 'Status', 'Obs'];
    const csvContent = [
      headers.join(','),
      ...data.map(row => [
        row.date,
        `"${row.description.replace(/"/g, '""')}"`,
        `"${row.category}"`,
        `"${row.procedure || ''}"`,
        `"${row.professional || ''}"`,
        `"${row.paymentMethod}"`,
        row.amount.toFixed(2),
        row.status,
        `"${(row.observation || '').replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `receitas_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderTransactionsTable = () => {
    const showFees = userEmail !== 'recepcao.centrodosorriso@gmail.com';
    const filtered = transactions.filter(t => {
        if (t.type !== 'income') return false;
        
        // Debugging filter
        const matches = (
         (txFilters.category === 'all' || t.category === txFilters.category) &&
         (txFilters.status === 'all' || t.status === txFilters.status) &&
         (txFilters.paymentMethods.length === 0 || txFilters.paymentMethods.includes(t.paymentMethod)) &&
         (txFilters.professional === 'all' || t.professional === txFilters.professional) &&
         (txFilters.auditStatus === 'all' || t.reconciliationStatus === txFilters.auditStatus) &&
         (txFilters.hasNF === 'all' || String(!!t.invoiceEmitted) === txFilters.hasNF) &&
         (txFilters.isPartial === 'all' || String(!!t.isPartial) === txFilters.isPartial) &&
         (txFilters.procedure === 'all' || t.procedure === txFilters.procedure) &&
         (!txFilters.search || (t.description || '').toLowerCase().includes((txFilters.search || '').toLowerCase())) &&
         (t.date >= txFilters.start && t.date <= txFilters.end)
        );
        
        if (!matches) {
            // commented out to avoid performance issues
        }
        
        return matches;
    }).sort((a, b) => b.date.localeCompare(a.date));
    const totalRevenue = filtered.reduce((acc, curr) => acc + curr.amount, 0);
    const selectedIncomesSum = filtered.filter(t => selectedIncomes.includes(t.id)).reduce((acc, curr) => acc + curr.amount, 0);
    const selectedIncomesNetSum = filtered.filter(t => selectedIncomes.includes(t.id)).reduce((acc, curr) => acc + (curr.amount - getEffectiveFee(curr)), 0);
    const totalNF = filtered.filter(t => t.invoiceEmitted).reduce((acc, curr) => acc + curr.amount, 0);
    const errorCount = filtered.filter(t => t.reconciliationStatus === 'error').length;
    return (
        <div className="flex flex-col gap-4 animate-in fade-in h-full">
            <div className="glass-panel p-3 rounded-2xl border border-border flex flex-col gap-3 bg-surface relative z-20">
                <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold text-text uppercase tracking-widest flex items-center gap-2">
                        <Filter className="text-blue-400 w-3 h-3" /> Filtros
                    </h3>
                    <div className="flex gap-2">
                        <button onClick={() => handleExport(filtered)} className="text-[9px] font-bold text-emerald-500 hover:text-emerald-400 uppercase tracking-wider transition-colors px-2 py-0.5 rounded-lg hover:bg-emerald-500/10 flex items-center gap-1">
                            <Download className="w-3 h-3" /> Exportar
                        </button>
                        <button onClick={() => setTxFilters(initialTxFilters)} className="text-[9px] font-bold text-slate-500 hover:text-text uppercase tracking-wider transition-colors px-2 py-0.5 rounded-lg hover:bg-panel">
                            Limpar Filtros
                        </button>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                    <div className="col-span-1 md:col-span-2 lg:col-span-2 flex flex-col gap-0.5">
                        <label className="text-[9px] font-bold text-slate-500 uppercase px-1">Período</label>
                        <DateRangePicker 
                            value={{ start: txFilters.start, end: txFilters.end }} 
                            onChange={(range) => setTxFilters({...txFilters, start: range.start, end: range.end})} 
                            className="h-7"
                        />
                    </div>
                    
                    <div className="flex flex-col gap-0.5">
                        <label className="text-[9px] font-bold text-slate-500 uppercase px-1">Categoria</label>
                        <div className="relative">
                            <select value={txFilters.category} onChange={e => setTxFilters({...txFilters, category: e.target.value, procedure: 'all'})} className="w-full bg-surface border border-border rounded-lg px-2.5 py-1 text-[10px] font-bold text-text outline-none appearance-none cursor-pointer hover:bg-panel transition-colors [&>option]:bg-surface [&>option]:text-text">
                                <option value="all">Todas</option>
                                {incomeCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-slate-400 pointer-events-none" />
                        </div>
                    </div>

                    <div className="flex flex-col gap-0.5">
                        <label className="text-[9px] font-bold text-slate-500 uppercase px-1">Procedimento</label>
                        <div className="relative">
                            <select value={txFilters.procedure} onChange={e => setTxFilters({...txFilters, procedure: e.target.value})} className="w-full bg-surface border border-border rounded-lg px-2.5 py-1 text-[10px] font-bold text-text outline-none appearance-none cursor-pointer hover:bg-panel transition-colors [&>option]:bg-surface [&>option]:text-text">
                                <option value="all">Todos</option>
                                {txFilters.category !== 'all' ? (
                                    incomeCategories.find(c => c.name === txFilters.category)?.subcategories.map(s => (
                                        <option key={s.id} value={s.name}>{s.name}</option>
                                    ))
                                ) : (
                                    Array.from(new Set(incomeCategories.flatMap(c => c.subcategories.map(s => s.name)))).sort().map(name => (
                                        <option key={name} value={name}>{name}</option>
                                    ))
                                )}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-slate-400 pointer-events-none" />
                        </div>
                    </div>

                    <div className="flex flex-col gap-0.5">
                        <label className="text-[9px] font-bold text-slate-500 uppercase px-1">Profissional</label>
                        <div className="relative">
                            <select value={txFilters.professional} onChange={e => setTxFilters({...txFilters, professional: e.target.value})} className="w-full bg-surface border border-border rounded-lg px-2.5 py-1 text-[10px] font-bold text-text outline-none appearance-none cursor-pointer hover:bg-panel transition-colors [&>option]:bg-surface [&>option]:text-text">
                                <option value="all">Todos</option>
                                {professionals.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-slate-400 pointer-events-none" />
                        </div>
                    </div>

                    <div className="flex flex-col gap-0.5">
                        <label className="text-[9px] font-bold text-slate-500 uppercase px-1">Forma Pagto</label>
                        <div className="relative">
                            <button 
                                onClick={() => setIsPaymentMethodFilterOpen(!isPaymentMethodFilterOpen)}
                                className="w-full bg-surface border border-border rounded-lg px-2.5 py-1 text-[10px] font-bold text-text outline-none flex items-center justify-between hover:bg-panel transition-colors h-7"
                            >
                                <span className="truncate max-w-[80px]">
                                    {txFilters.paymentMethods.length === 0 ? 'Todas' : 
                                     txFilters.paymentMethods.length === 1 ? txFilters.paymentMethods[0] : 
                                     `${txFilters.paymentMethods.length} Selecionadas`}
                                </span>
                                <ChevronDown className={`w-2.5 h-2.5 text-slate-400 transition-transform ${isPaymentMethodFilterOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isPaymentMethodFilterOpen && (
                                <>
                                    <div 
                                        className="fixed inset-0 z-[60]" 
                                        onClick={() => setIsPaymentMethodFilterOpen(false)}
                                    />
                                    <div className="absolute top-full left-0 mt-1 w-48 bg-surface border border-border rounded-xl shadow-2xl z-[70] py-2 animate-in fade-in zoom-in-95 duration-150">
                                        <div className="px-2 pb-1 mb-1 border-b border-border flex justify-between items-center">
                                            <span className="text-[9px] font-bold text-slate-500 uppercase">Selecionar</span>
                                            {txFilters.paymentMethods.length > 0 && (
                                                <button 
                                                    onClick={() => setTxFilters({...txFilters, paymentMethods: []})}
                                                    className="text-[9px] font-bold text-blue-400 hover:text-blue-300 transition-colors"
                                                >
                                                    Limpar
                                                </button>
                                            )}
                                        </div>
                                        <div className="max-h-48 overflow-y-auto scrollbar-hide">
                                            {paymentMethods.map(pm => {
                                                const isSelected = txFilters.paymentMethods.includes(pm.name);
                                                return (
                                                    <button
                                                        key={pm.id}
                                                        onClick={() => {
                                                            const newMethods = isSelected
                                                                ? txFilters.paymentMethods.filter(m => m !== pm.name)
                                                                : [...txFilters.paymentMethods, pm.name];
                                                            setTxFilters({...txFilters, paymentMethods: newMethods});
                                                        }}
                                                        className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-panel transition-colors text-left"
                                                    >
                                                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-white/20'}`}>
                                                            {isSelected && <Check className="w-2.5 h-2.5 text-text" />}
                                                        </div>
                                                        <span className={`text-[10px] font-medium transition-colors ${isSelected ? 'text-text' : 'text-slate-400'}`}>
                                                            {pm.name}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-0.5">
                        <label className="text-[9px] font-bold text-slate-500 uppercase px-1">Recebimento</label>
                        <div className="relative">
                            <select value={txFilters.status} onChange={e => setTxFilters({...txFilters, status: e.target.value})} className="w-full bg-surface border border-border rounded-lg px-2.5 py-1 text-[10px] font-bold text-text outline-none appearance-none cursor-pointer hover:bg-panel transition-colors [&>option]:bg-surface [&>option]:text-text">
                                <option value="all">Todos</option>
                                <option value="Paid">Recebido</option>
                                <option value="Pending">Pendente</option>
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-slate-400 pointer-events-none" />
                        </div>
                    </div>

                    <div className="flex flex-col gap-0.5">
                        <label className="text-[9px] font-bold text-slate-500 uppercase px-1">Auditoria</label>
                        <div className="relative">
                            <select value={txFilters.auditStatus} onChange={e => setTxFilters({...txFilters, auditStatus: e.target.value})} className="w-full bg-surface border border-border rounded-lg px-2.5 py-1 text-[10px] font-bold text-text outline-none appearance-none cursor-pointer hover:bg-panel transition-colors [&>option]:bg-surface [&>option]:text-text">
                                <option value="all">Todas</option>
                                <option value="verified">Verificado</option>
                                <option value="error">Divergência</option>
                                <option value="pending">Pendente</option>
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-slate-400 pointer-events-none" />
                        </div>
                    </div>

                    <div className="flex flex-col gap-0.5">
                        <label className="text-[9px] font-bold text-slate-500 uppercase px-1">Nota Fiscal</label>
                        <div className="relative">
                            <select value={txFilters.hasNF} onChange={e => setTxFilters({...txFilters, hasNF: e.target.value})} className="w-full bg-surface border border-border rounded-lg px-2.5 py-1 text-[10px] font-bold text-text outline-none appearance-none cursor-pointer hover:bg-panel transition-colors [&>option]:bg-surface [&>option]:text-text">
                                <option value="all">Todas</option>
                                <option value="true">Emitida</option>
                                <option value="false">Não Emitida</option>
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-slate-400 pointer-events-none" />
                        </div>
                    </div>

                    <div className="flex flex-col gap-0.5">
                        <label className="text-[9px] font-bold text-slate-500 uppercase px-1">Tipo</label>
                        <div className="relative">
                            <select value={txFilters.isPartial} onChange={e => setTxFilters({...txFilters, isPartial: e.target.value})} className="w-full bg-surface border border-border rounded-lg px-2.5 py-1 text-[10px] font-bold text-text outline-none appearance-none cursor-pointer hover:bg-panel transition-colors [&>option]:bg-surface [&>option]:text-text">
                                <option value="all">Todos</option>
                                <option value="false">Integral</option>
                                <option value="true">Parcial</option>
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-slate-400 pointer-events-none" />
                        </div>
                    </div>

                    <div className="flex flex-col gap-0.5">
                        <label className="text-[9px] font-bold text-slate-500 uppercase px-1">Paciente</label>
                        <input type="text" placeholder="Buscar..." value={txFilters.search} onChange={e => setTxFilters({...txFilters, search: e.target.value})} className="w-full bg-surface border border-border rounded-lg px-2.5 py-1 text-[10px] font-bold text-text outline-none focus:border-blue-500 transition-colors placeholder-slate-600" />
                    </div>
                </div>

                <div className="flex gap-4 justify-end border-t border-border pt-2 mt-0.5">
                    {selectedIncomes.length > 0 && (
                        <div className="flex gap-4 items-center bg-emerald-500/10 px-3 py-1 rounded border border-emerald-500/20 mr-auto animate-in fade-in slide-in-from-left-2 duration-200">
                            <span className="text-[9px] text-emerald-400 font-extrabold uppercase tracking-widest">Selecionados ({selectedIncomes.length})</span>
                            <div className="flex gap-3">
                                <div className="flex flex-col items-end">
                                    <span className="text-[7px] text-slate-500 font-bold uppercase tracking-widest mb-0">Bruto</span>
                                    <span className="text-[10px] text-emerald-300 font-bold">R$ {selectedIncomesSum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex flex-col items-end border-l border-border pl-3">
                                    <span className="text-[7px] text-slate-400 font-bold uppercase tracking-widest mb-0">Líquido</span>
                                    <span className="text-[10px] text-blue-300 font-bold">R$ {selectedIncomesNetSum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                            
                            <div className="relative border-l border-border pl-3 flex items-center">
                                <button 
                                    onClick={() => {
                                        setIsBulkChangeCatOpen(false);
                                        setIsBulkDeleteConfirmOpen(false);
                                        setActiveBulkActionTab(activeBulkActionTab === 'income' ? null : 'income');
                                    }} 
                                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-text rounded-lg text-[9px] font-extrabold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md shadow-indigo-600/10"
                                >
                                    Ações em Massa <ChevronDown className="w-2.5 h-2.5" />
                                </button>
                                
                                {activeBulkActionTab === 'income' && (
                                    <div className="absolute right-0 bottom-full mb-1.5 w-48 bg-surface border border-border rounded-xl shadow-2xl py-1 z-30 animate-in fade-in slide-in-from-bottom-2 duration-150">
                                        {!isBulkDeleteConfirmOpen && !isBulkChangeCatOpen && (
                                            <>
                                                <button 
                                                    onClick={() => setIsBulkChangeCatOpen(true)}
                                                    className="w-full text-left px-3 py-1.5 text-[10px] font-bold text-slate-200 hover:bg-panel flex items-center gap-1.5 uppercase tracking-wider transition-all"
                                                >
                                                    <Edit className="w-3 h-3 text-indigo-400" /> Alterar Categoria
                                                </button>
                                                <button 
                                                    onClick={() => setIsBulkDeleteConfirmOpen(true)}
                                                    className="w-full text-left px-3 py-1.5 text-[10px] font-bold text-red-400 hover:bg-red-500/10 flex items-center gap-1.5 uppercase tracking-wider transition-all border-t border-border"
                                                >
                                                    <Trash2 className="w-3 h-3 text-red-400" /> Excluir Selecionados
                                                </button>
                                            </>
                                        )}
                                        
                                        {isBulkDeleteConfirmOpen && (
                                            <div className="p-2 flex flex-col gap-1.5">
                                                <span className="text-[8px] font-extrabold text-text uppercase text-center">Confirmar exclusão?</span>
                                                <div className="flex gap-1">
                                                    <button 
                                                        onClick={bulkDeleteIncomes}
                                                        className="flex-1 py-1 bg-red-600 hover:bg-red-500 text-text rounded text-[8px] font-bold uppercase transition-all"
                                                    >
                                                        Sim
                                                    </button>
                                                    <button 
                                                        onClick={() => setIsBulkDeleteConfirmOpen(false)}
                                                        className="flex-1 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-[8px] font-bold uppercase transition-all"
                                                    >
                                                        Não
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        
                                        {isBulkChangeCatOpen && (
                                            <div className="p-2 flex flex-col gap-1.5">
                                                <span className="text-[8px] font-extrabold text-text uppercase mb-1">Selecionar Categoria:</span>
                                                <div className="flex flex-col gap-1 max-h-32 overflow-y-auto custom-scrollbar">
                                                    {incomeCategories.map(cat => (
                                                        <button
                                                            key={cat.id}
                                                            onClick={() => bulkChangeCategoryIncomes(cat.name)}
                                                            className="w-full text-left px-2 py-1 text-[9px] text-slate-300 hover:bg-panel hover:text-text rounded transition-all truncate"
                                                        >
                                                            {cat.name}
                                                        </button>
                                                    ))}
                                                </div>
                                                <button 
                                                    onClick={() => setIsBulkChangeCatOpen(false)}
                                                    className="w-full py-0.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-[8px] font-bold uppercase mt-1 transition-all"
                                                >
                                                    Voltar
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    <div className="flex flex-col items-end">
                        <span className="text-[8px] text-amber-500 font-bold uppercase tracking-widest mb-0">Meta Diária</span>
                        <span className="text-[10px] text-amber-400 font-bold">R$ {dailyMetaRequired.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mb-0">Receita</span>
                        <span className="text-[10px] text-emerald-400 font-bold">R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-[8px] text-blue-500 font-bold uppercase tracking-widest mb-0">Total NF</span>
                        <span className="text-[10px] text-blue-400 font-bold">R$ {totalNF.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                </div>
            </div>
            {errorCount > 0 && (<div className="bg-red-500/20 border border-red-500/30 p-1.5 rounded-xl flex items-center gap-2 animate-in slide-in-from-top-1"><AlertTriangle className="text-red-500 w-3 h-3" /><span className="text-[9px] font-bold text-red-400 uppercase tracking-widest">Atenção: {errorCount} lançamentos com erro na auditoria.</span></div>)}
            <div className="glass-panel rounded-2xl border border-border overflow-hidden flex flex-col flex-1 bg-surface"><div className="overflow-auto flex-1 custom-scrollbar"><table className="w-full text-left border-collapse"><thead className="sticky top-0 bg-surface text-[10px] font-bold text-slate-400 uppercase tracking-wider z-10"><tr><th className="p-4 w-10 text-center"><input type="checkbox" onChange={(e) => { if (e.target.checked) setSelectedIncomes(filtered.map(tx => tx.id)); else setSelectedIncomes([]); }} checked={filtered.length > 0 && selectedIncomes.length === filtered.length} className="w-3.5 h-3.5 rounded border-border bg-panel text-blue-500 cursor-pointer" /></th><th className="p-4">Data</th><th className="p-4">Paciente</th><th className="p-4">Categoria</th><th className="p-4">Profissional</th><th className="p-4">Time de Venda</th><th className="p-4">Forma Pagto</th><th className="p-4 text-right">Valor</th>{showFees && <th className="p-4 text-right">Taxa</th>}{showFees && <th className="p-4 text-right">Líquido</th>}<th className="p-4 text-center">Auditoria</th><th className="p-4 text-right">AÇÕES</th></tr></thead><tbody className="text-xs text-slate-300 divide-y divide-white/5">{filtered.map(tx => { const isSelected = selectedIncomes.includes(tx.id); return (<tr key={tx.id} className={`hover:bg-panel transition-colors ${tx.reconciliationStatus === 'verified' ? 'bg-emerald-500/20' : tx.reconciliationStatus === 'error' ? 'bg-red-500/20' : ''} ${isSelected ? 'bg-blue-500/10' : ''}`}><td className="p-4 text-center"><input type="checkbox" checked={isSelected} onChange={e => { if (e.target.checked) setSelectedIncomes(prev => [...prev, tx.id]); else setSelectedIncomes(prev => prev.filter(id => id !== tx.id)); }} className="w-3.5 h-3.5 rounded border-border bg-panel text-blue-500 cursor-pointer" /></td><td className="p-4 font-mono">{tx.date.split('-').reverse().join('/')}</td><td className="p-4 font-bold text-text"><div className="flex items-center gap-2">{tx.description}{tx.isPartial && <span className="bg-amber-500/10 text-amber-500 text-[8px] font-black uppercase border border-amber-500/20 px-1 rounded">Parcial</span>}{tx.externalId && <RefreshCw className="w-3 h-3 text-blue-400" />}</div></td><td className="p-4"><div className="flex flex-col"><span className="font-medium text-text">{tx.category}</span>{tx.procedure && <span className="text-[10px] text-slate-500 font-medium">{tx.procedure}</span>}</div></td><td className="p-4 text-slate-400">{tx.professional || 'Clínica'}</td><td className="p-4 text-slate-400">{tx.salesTeam ? <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: salesTeams.find(t => t.name === tx.salesTeam)?.color || '#8b5cf6' }}></div><span>{tx.salesTeam}</span></div> : '-'}</td><td className="p-4">{tx.paymentMethod} {tx.installments && tx.installments > 1 ? `(${tx.installments}x)` : ''}</td><td className="p-4 text-right font-bold text-emerald-400">R$ {tx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>{showFees && (<td className="p-4 text-right"><div className="flex items-center justify-end text-red-400/60 group/fee"><span className="text-[10px] mr-1">- R$</span><input type="number" step="0.01" value={getEffectiveFee(tx).toFixed(2)} onChange={(e) => { const val = parseFloat(e.target.value) || 0; setTransactions(prev => prev.map(item => item.id === tx.id ? {...item, explicitFeeAmount: val} : item)); }} onBlur={(e) => { const val = parseFloat(e.target.value) || 0; handleUpdateFee(tx.id, val); }} className="bg-transparent text-right w-20 outline-none border-b border-transparent group-hover/fee:border-border focus:border-red-500/50 transition-all font-mono" /></div></td>)}{showFees && (<td className="p-4 text-right font-bold text-blue-400">R$ {(tx.amount - getEffectiveFee(tx)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>)}<td className="p-4"><div className="flex justify-center gap-1.5"><button onClick={() => toggleNF(tx)} className={`size-7 rounded-lg flex items-center justify-center border transition-all ${tx.invoiceEmitted ? 'bg-blue-600 border-blue-500 text-text' : 'bg-panel border-border text-slate-600'}`} title="NF Emitida"><FileText className="w-3.5 h-3.5" /></button><button onClick={() => toggleAuditStatus(tx, 'verified')} className={`size-7 rounded-lg flex items-center justify-center border transition-all ${tx.reconciliationStatus === 'verified' ? 'bg-emerald-500 border-emerald-400 text-black' : 'bg-panel border-border text-slate-600'}`} title="Verificado"><CheckCircle className="w-3.5 h-3.5" /></button><button onClick={() => toggleAuditStatus(tx, 'error')} className={`size-7 rounded-lg flex items-center justify-center border transition-all ${tx.reconciliationStatus === 'error' ? 'bg-red-500 border-red-400 text-text' : 'bg-panel border-border text-slate-600'}`} title="Erro / Divergência"><AlertTriangle className="w-3.5 h-3.5" /></button></div></td><td className="p-4 text-right"><div className="flex justify-end gap-2"><button onClick={() => openObsModal(tx)} className={`p-1.5 rounded hover:bg-panel/80 transition-colors ${tx.observation ? 'text-amber-400' : 'text-slate-600 hover:text-text'}`} title="Ver/Escrever Nota"><StickyNote className="w-3.5 h-3.5" /></button><button onClick={() => openModal('income', tx)} className="text-slate-500 hover:text-text p-1.5"><Edit className="w-3.5 h-3.5" /></button></div></td></tr>)})}</tbody></table></div></div>
        </div>
    );
  };

  const renderExpensesTable = () => {
    const filtered = transactions.filter(t => {
        if (t.type !== 'expense') return false;
        if (!expFilters.statuses.includes(t.status)) return false;
        if (expFilters.category !== 'all' && t.category !== expFilters.category) return false;
        if (expFilters.search && !(t.description || '').toLowerCase().includes((expFilters.search || '').toLowerCase())) return false;
        
        const effectiveDate = (t.status === 'Paid' && t.settlementDate) ? t.settlementDate : t.date;
        return effectiveDate >= expFilters.start && effectiveDate <= expFilters.end;
    }).sort((a, b) => {
        const dateA = (a.status === 'Paid' && a.settlementDate) ? a.settlementDate : a.date;
        const dateB = (b.status === 'Paid' && b.settlementDate) ? b.settlementDate : b.date;
        return dateB.localeCompare(dateA);
    });

    const totalExpense = filtered.reduce((acc, curr) => acc + curr.amount, 0);
    const totalPaid = filtered.filter(t => t.status === 'Paid').reduce((acc, curr) => acc + curr.amount, 0);
    const totalPending = filtered.filter(t => t.status === 'Pending').reduce((acc, curr) => acc + curr.amount, 0);
    const selectedExpensesSum = filtered.filter(t => selectedExpenses.includes(t.id)).reduce((acc, curr) => acc + curr.amount, 0);

    return (
        <div className="flex flex-col gap-4 animate-in fade-in h-full">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SpotlightCard className="glass-panel p-4 rounded-2xl flex flex-col gap-1" spotlightColor="rgba(255, 255, 255, 0.2)">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Despesas</span>
                    <h3 className="text-2xl font-black text-text">R$ {totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                </SpotlightCard>
                <SpotlightCard className="glass-panel p-4 rounded-2xl flex flex-col gap-1" spotlightColor="rgba(16, 185, 129, 0.4)">
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Total Pago</span>
                    <h3 className="text-2xl font-black text-emerald-400">R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                </SpotlightCard>
                <SpotlightCard className="glass-panel p-4 rounded-2xl flex flex-col gap-1" spotlightColor="rgba(239, 68, 68, 0.4)">
                    <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Total Pendente</span>
                    <h3 className="text-2xl font-black text-red-400">R$ {totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                </SpotlightCard>
            </div>
            <div className="glass-panel p-3 rounded-2xl border border-border flex flex-col gap-3 bg-surface relative z-20">
                <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold text-text uppercase tracking-widest flex items-center gap-2">
                        <Filter className="text-red-400 w-3 h-3" /> Filtros Despesas
                    </h3>
                    <button onClick={() => setExpFilters({start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0], category: 'all', search: '', statuses: ['Paid', 'Pending']})} className="text-[9px] font-bold text-slate-500 hover:text-text uppercase tracking-wider transition-colors px-2 py-0.5 rounded-lg hover:bg-panel">
                        Limpar Filtros
                    </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
                    <div className="col-span-1 md:col-span-2 lg:col-span-2 flex flex-col gap-0.5">
                        <label className="text-[9px] font-bold text-slate-500 uppercase px-1">Período</label>
                        <DateRangePicker 
                            value={{ start: expFilters.start, end: expFilters.end }} 
                            onChange={(range) => setExpFilters({...expFilters, start: range.start, end: range.end})} 
                            className="h-7"
                        />
                    </div>
                    
                    <div className="flex flex-col gap-0.5">
                        <label className="text-[9px] font-bold text-slate-500 uppercase px-1">Status</label>
                        <div className="flex bg-surface rounded-lg border border-border p-0.5 h-[28px]">
                            <button 
                                onClick={() => setExpFilters(prev => ({ ...prev, statuses: prev.statuses.includes('Paid') ? prev.statuses.filter(s => s !== 'Paid') : [...prev.statuses, 'Paid'] }))} 
                                className={`flex-1 text-[10px] font-bold rounded-md transition-all ${expFilters.statuses.includes('Paid') ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
                            >Pago</button>
                            <button 
                                onClick={() => setExpFilters(prev => ({ ...prev, statuses: prev.statuses.includes('Pending') ? prev.statuses.filter(s => s !== 'Pending') : [...prev.statuses, 'Pending'] }))} 
                                className={`flex-1 text-[10px] font-bold rounded-md transition-all ${expFilters.statuses.includes('Pending') ? 'bg-red-500/20 text-red-400' : 'text-slate-500 hover:text-slate-300'}`}
                            >Pendente</button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-0.5">
                        <label className="text-[9px] font-bold text-slate-500 uppercase px-1">Categoria</label>
                        <div className="relative h-[28px]">
                            <select value={expFilters.category} onChange={e => setExpFilters({...expFilters, category: e.target.value})} className="w-full h-full bg-surface border border-border rounded-lg px-2.5 text-[10px] font-bold text-text outline-none appearance-none cursor-pointer hover:bg-panel transition-colors [&>option]:bg-surface [&>option]:text-text">
                                <option value="all">Todas</option>
                                {expenseCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-slate-400 pointer-events-none" />
                        </div>
                    </div>

                    <div className="flex flex-col gap-0.5">
                        <label className="text-[9px] font-bold text-slate-500 uppercase px-1">Descrição</label>
                        <input type="text" placeholder="Buscar..." value={expFilters.search} onChange={e => setExpFilters({...expFilters, search: e.target.value})} className="w-full h-[28px] bg-surface border border-border rounded-lg px-2.5 text-[10px] font-bold text-text outline-none focus:border-red-500 transition-colors placeholder-slate-600" />
                    </div>
                </div>
            </div>
            {selectedExpenses.length > 0 && (
                <div className="flex gap-4 items-center bg-red-500/10 px-3 py-1.5 rounded-xl border border-red-500/20 mr-auto animate-in fade-in slide-in-from-top-2 duration-200 mb-2">
                    <span className="text-[9px] text-red-400 font-extrabold uppercase tracking-widest">Selecionados ({selectedExpenses.length})</span>
                    <div className="flex gap-3">
                        <div className="flex flex-col items-end">
                            <span className="text-[7px] text-slate-500 font-bold uppercase tracking-widest mb-0">Total</span>
                            <span className="text-[10px] text-red-300 font-bold">R$ {selectedExpensesSum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                    
                    <div className="relative border-l border-border pl-3 flex items-center">
                        <button 
                            onClick={() => {
                                setIsBulkChangeCatExpensesOpen(false);
                                setIsBulkDeleteExpensesConfirmOpen(false);
                                setActiveBulkActionTab(activeBulkActionTab === 'expense' ? null : 'expense');
                            }} 
                            className="px-2.5 py-1 bg-surface hover:bg-panel border border-border text-slate-300 rounded-lg text-[9px] font-extrabold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md"
                        >
                            Ações em Massa <ChevronDown className="w-2.5 h-2.5" />
                        </button>
                        
                        {activeBulkActionTab === 'expense' && (
                            <div className="absolute right-0 bottom-full mb-1.5 w-48 bg-surface border border-border rounded-xl shadow-2xl py-1 z-30 animate-in fade-in slide-in-from-bottom-2 duration-150">
                                {!isBulkDeleteExpensesConfirmOpen && !isBulkChangeCatExpensesOpen && (
                                    <>
                                        <button 
                                            onClick={() => setIsBulkChangeCatExpensesOpen(true)}
                                            className="w-full text-left px-3 py-1.5 text-[10px] font-bold text-slate-200 hover:bg-panel flex items-center gap-1.5 uppercase tracking-wider transition-all"
                                        >
                                            <Edit className="w-3 h-3 text-indigo-400" /> Alterar Categoria
                                        </button>
                                        <button 
                                            onClick={() => setIsBulkDeleteExpensesConfirmOpen(true)}
                                            className="w-full text-left px-3 py-1.5 text-[10px] font-bold text-red-400 hover:bg-red-500/10 flex items-center gap-1.5 uppercase tracking-wider transition-all border-t border-border"
                                        >
                                            <Trash2 className="w-3 h-3 text-red-400" /> Excluir Selecionados
                                        </button>
                                    </>
                                )}
                                
                                {isBulkDeleteExpensesConfirmOpen && (
                                    <div className="p-2 flex flex-col gap-1.5">
                                        <span className="text-[8px] font-extrabold text-text uppercase text-center">Confirmar exclusão?</span>
                                        <div className="flex gap-1">
                                            <button 
                                                onClick={bulkDeleteExpenses}
                                                className="flex-1 py-1 bg-red-600 hover:bg-red-500 text-text rounded text-[8px] font-bold uppercase transition-all"
                                            >
                                                Sim
                                            </button>
                                            <button 
                                                onClick={() => setIsBulkDeleteExpensesConfirmOpen(false)}
                                                className="flex-1 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-[8px] font-bold uppercase transition-all"
                                            >
                                                Não
                                            </button>
                                        </div>
                                    </div>
                                )}
                                
                                {isBulkChangeCatExpensesOpen && (
                                    <div className="p-2 flex flex-col gap-1.5">
                                        <span className="text-[8px] font-extrabold text-text uppercase mb-1">Selecionar Categoria:</span>
                                        <div className="flex flex-col gap-1 max-h-32 overflow-y-auto custom-scrollbar">
                                            {expenseCategories.map(cat => (
                                                <button
                                                    key={cat.id}
                                                    onClick={() => bulkChangeCategoryExpenses(cat.name)}
                                                    className="w-full text-left px-2 py-1 text-[9px] text-slate-300 hover:bg-panel hover:text-text rounded transition-all truncate"
                                                >
                                                    {cat.name}
                                                </button>
                                            ))}
                                        </div>
                                        <button 
                                            onClick={() => setIsBulkChangeCatExpensesOpen(false)}
                                            className="w-full py-0.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-[8px] font-bold uppercase mt-1 transition-all"
                                        >
                                            Voltar
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
            <div className="glass-panel rounded-2xl border border-border overflow-hidden flex flex-col flex-1 bg-surface"><div className="overflow-auto flex-1 custom-scrollbar"><table className="w-full text-left border-collapse"><thead className="sticky top-0 bg-surface text-[10px] font-bold text-slate-400 uppercase tracking-wider z-10"><tr><th className="p-4 w-10 text-center"><input type="checkbox" onChange={(e) => { const pendingTxs = filtered.filter(tx => tx.status === 'Pending').map(tx => tx.id); if (e.target.checked) setSelectedExpenses(pendingTxs); else setSelectedExpenses([]); }} checked={selectedExpenses.length > 0 && selectedExpenses.length === filtered.filter(tx => tx.status === 'Pending').length} className="w-3.5 h-3.5 rounded border-border bg-panel text-red-500 cursor-pointer" /></th><th className="p-4">Data</th><th className="p-4">Descrição</th><th className="p-4">Categoria</th><th className="p-4">Forma Pagto</th><th className="p-4 text-right">Valor</th><th className="p-4 text-center">Status</th><th className="p-4 text-right">AÇÕES</th></tr></thead><tbody className="text-xs text-slate-300 divide-y divide-white/5">{filtered.map(tx => {
                const displayDate = (tx.status === 'Paid' && tx.settlementDate) ? tx.settlementDate : tx.date;
                return (
                <tr key={tx.id} className="hover:bg-panel transition-colors"><td className="p-4 text-center">{tx.status === 'Pending' && <input type="checkbox" checked={selectedExpenses.includes(tx.id)} onChange={e => { if (e.target.checked) setSelectedExpenses(prev => [...prev, tx.id]); else setSelectedExpenses(prev => prev.filter(id => id !== tx.id)); }} className="w-3.5 h-3.5 rounded border-border bg-panel text-red-500 cursor-pointer" />}</td><td className="p-4 font-mono">{displayDate.split('-').reverse().join('/')}</td><td className="p-4 font-bold text-text"><div className="flex items-center gap-2">{tx.description}{tx.externalId && <RefreshCw className="w-3 h-3 text-blue-400" />}</div></td><td className="p-4"><div className="flex flex-col"><span className="font-medium text-text">{tx.category}</span>{tx.procedure && <span className="text-[10px] text-slate-500 font-medium">{tx.procedure}</span>}</div></td><td className="p-4">{tx.paymentMethod}</td><td className="p-4 text-right font-bold text-red-400">R$ {tx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            <td className="p-4 text-center">
                {payingTxId === tx.id ? (
                    <div className="flex items-center justify-center gap-2 animate-in fade-in">
                        <input type="date" value={tempPaymentDate} onChange={e => setTempPaymentDate(e.target.value)} className="bg-panel border border-border rounded px-2 py-1 text-[10px] text-text outline-none w-24" />
                        <button onClick={() => confirmPayment(tx)} className="text-emerald-400 hover:text-emerald-300"><CheckCircle className="w-4 h-4" /></button>
                        <button onClick={() => setPayingTxId(null)} className="text-red-400 hover:text-red-300"><X className="w-4 h-4" /></button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center">
                        <button onClick={() => { if (tx.status === 'Pending') { setPayingTxId(tx.id); setTempPaymentDate(today); } else { togglePaymentStatus(tx); } }} className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase w-24 transition-all ${tx.status === 'Paid' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'}`}>{tx.status === 'Paid' ? 'Pago' : 'A Pagar'}</button>
                        {tx.status === 'Paid' && tx.settlementDate && (<span className="text-[9px] text-slate-500 mt-1 font-mono">{tx.settlementDate.split('-').reverse().join('/')}</span>)}
                    </div>
                )}
            </td>
            <td className="p-4 text-right"><div className="flex justify-end gap-2"><button onClick={() => openObsModal(tx)} className={`p-1.5 rounded hover:bg-panel/80 transition-colors ${tx.observation ? 'text-amber-400' : 'text-slate-600 hover:text-text'}`} title="Ver/Escrever Nota"><StickyNote className="w-3.5 h-3.5" /></button><button onClick={() => openModal('expense', tx)} className="text-slate-500 hover:text-text p-1.5"><Edit className="w-3.5 h-3.5" /></button></div></td></tr>
            );})}</tbody></table></div></div>
        </div>
    );
  };

  const renderDRE = () => {
    const [year, month] = selectedDreMonth.split('-');
    const currentMonthDate = new Date(parseInt(year), parseInt(month) - 1, 1);

    // Calculate 12-month data for chart
    const monthlyData = [];
    for (let i = 11; i >= 0; i--) {
        const d = new Date(currentMonthDate);
        d.setMonth(d.getMonth() - i);
        const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        
        const monthTxs = transactions.filter(t => {
            if (t.status !== 'Paid') return false;
            const effectiveDate = t.settlementDate || t.date;
            return effectiveDate?.startsWith(mKey);
        });
        
        const income = monthTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const expense = monthTxs.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        
        monthlyData.push({ month: d.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase(), income, expense });
    }

    const prevMonthDate = new Date(currentMonthDate);
    prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
    const prevYearMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

    const getMonthData = (monthKey: string) => {
        const monthTxs = transactions.filter(t => {
            if (t.status !== 'Paid') return false;
            const effectiveDate = t.settlementDate || t.date;
            return effectiveDate?.startsWith(monthKey);
        });

        const incomeByCategory = incomeCategories.map(cat => ({
            name: cat.name,
            amount: monthTxs.filter(t => t.type === 'income' && t.category === cat.name).reduce((sum, t) => sum + t.amount, 0)
        })).filter(c => c.amount > 0);

        const expenseByCategory = expenseCategories.map(cat => ({
            name: cat.name,
            amount: monthTxs.filter(t => t.type === 'expense' && t.category === cat.name).reduce((sum, t) => sum + t.amount, 0)
        })).filter(c => c.amount > 0);

        const totalRevenue = incomeByCategory.reduce((sum, c) => sum + c.amount, 0);
        const totalExpense = expenseByCategory.reduce((sum, c) => sum + c.amount, 0);
        const result = totalRevenue - totalExpense;

        return { incomeByCategory, expenseByCategory, totalRevenue, totalExpense, result };
    };

    const currentData = getMonthData(selectedDreMonth);
    const prevData = getMonthData(prevYearMonth);

    const getDiffDisplay = (current: number, prev: number) => {
        if (prev === 0) return null;
        const diff = current - prev;
        const percent = (diff / prev) * 100;
        return (
            <span className={`text-[10px] uppercase font-bold flex items-center gap-1 ${diff >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                <TrendingUp className="w-3 h-3" />
                {diff >= 0 ? '+' : ''}{percent.toFixed(1)}% vs mês anterior
            </span>
        );
    };

    return (
        <div className="flex flex-col gap-6 animate-in fade-in h-full p-4 text-text relative overflow-hidden">
            {/* Decorative background glows */}
            <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-600/5 blur-[120px] rounded-full pointer-events-none" />
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-panel border border-primary text-primary flex items-center justify-center shadow-lg shadow-primary/10">
                        <LineChart className="w-5 h-5 text-text" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-text uppercase tracking-tight">Demonstrativo de Resultados</h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">{currentMonthDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 bg-panel p-1 rounded-xl border border-border">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider px-2">Mês:</label>
                    <input type="month" value={selectedDreMonth} onChange={e => setSelectedDreMonth(e.target.value)} className="bg-surface border-none rounded-lg px-3 py-1.5 text-xs text-text focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative z-10">
                <div className="glass-panel p-6 rounded-2xl border-t-2 border-t-emerald-500 border border-border bg-surface flex flex-col gap-1 shadow-xl group hover:bg-surface transition-all duration-300">
                    <p className="text-emerald-400 font-bold uppercase text-[10px] tracking-wider mb-1">Total Entradas</p>
                    <p className="text-3xl text-text font-black tracking-tight group-hover:scale-105 transition-transform origin-left">R$ {currentData.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <div className="mt-2">{getDiffDisplay(currentData.totalRevenue, prevData.totalRevenue)}</div>
                </div>
                <div className="glass-panel p-6 rounded-2xl border-t-2 border-t-rose-500 border border-border bg-surface flex flex-col gap-1 shadow-xl group hover:bg-surface transition-all duration-300">
                    <p className="text-rose-400 font-bold uppercase text-[10px] tracking-wider mb-1">Total Saídas</p>
                    <p className="text-3xl text-text font-black tracking-tight group-hover:scale-105 transition-transform origin-left">R$ {currentData.totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <div className="mt-2">{getDiffDisplay(currentData.totalExpense, prevData.totalExpense)}</div>
                </div>
                <div className="glass-panel p-6 rounded-2xl border-t-2 border-t-blue-500 border border-border bg-surface flex flex-col gap-1 shadow-xl group hover:bg-surface transition-all duration-300">
                    <p className="text-blue-400 font-bold uppercase text-[10px] tracking-wider mb-1">Resultado Líquido</p>
                    <p className={`text-3xl font-black tracking-tight group-hover:scale-105 transition-transform origin-left ${currentData.result >= 0 ? 'text-text' : 'text-rose-500'}`}>R$ {currentData.result.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <div className="mt-2">{getDiffDisplay(currentData.result, prevData.result)}</div>
                </div>
                <div className="glass-panel p-6 rounded-2xl border border-primary/30 shadow-xl flex flex-col gap-1 group  transition-all">
                    <p className="text-blue-300 font-bold uppercase text-[10px] tracking-widest mb-1">Projeção {new Date(new Date(currentMonthDate).setMonth(currentMonthDate.getMonth() + 1)).toLocaleDateString('pt-BR', { month: 'short' })}</p>
                    <p className="text-3xl font-black tracking-tight text-text/90">R$ {((currentData.totalRevenue * 1.05) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <p className="text-[10px] text-blue-400/80 font-bold uppercase mt-2 flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin-slow" /> Baseado em tendência (+5%)</p>
                </div>
            </div>

            <div className="glass-panel p-6 rounded-2xl border border-border bg-surface h-[350px] shadow-2xl flex flex-col relative z-10">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-text font-bold uppercase text-xs tracking-wider opacity-80 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-blue-500" /> Fluxo de Caixa (12 Meses)
                    </h3>
                    <div className="flex gap-4">
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div><span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Entradas</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div><span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Saídas</span></div>
                    </div>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.03)" />
                        <XAxis dataKey="month" fontSize={10} axisLine={false} tickLine={false} stroke="#64748b" dy={10} />
                        <YAxis axisLine={false} tickLine={false} fontSize={10} stroke="#64748b" />
                        <RechartsTooltip 
                            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)' }}
                            itemStyle={{ color: '#fff', fontSize: '12px' }}
                        />
                        <Bar dataKey="income" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={24} />
                        <Bar dataKey="expense" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={24} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10 pb-4">
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="glass-panel p-6 rounded-2xl border border-border bg-surface shadow-xl">
                        <h3 className="text-text font-bold mb-6 uppercase text-xs tracking-wider opacity-80 flex items-center gap-2">
                            <Plus className="w-4 h-4 text-emerald-500" /> Receitas Detalhadas
                        </h3>
                        <div className="flex flex-col gap-5">
                            {currentData.incomeByCategory.map(cat => (
                                <div key={cat.name} className="flex flex-col gap-1.5">
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-400 text-xs font-bold uppercase tracking-tight">{cat.name}</span>
                                        <span className="text-emerald-400 font-black text-sm">R$ {cat.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="w-full bg-panel h-1 rounded-full overflow-hidden">
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(cat.amount / currentData.totalRevenue) * 100}%` }}
                                            className="h-full bg-emerald-500"
                                        />
                                    </div>
                                </div>
                            ))}
                            {currentData.incomeByCategory.length === 0 && <p className="text-slate-500 text-xs italic">Nenhuma receita registrada.</p>}
                        </div>
                    </div>

                    <div className="glass-panel p-6 rounded-2xl border border-border bg-surface shadow-xl">
                        <h3 className="text-text font-bold mb-6 uppercase text-xs tracking-wider opacity-80 flex items-center gap-2">
                            <Minus className="w-4 h-4 text-rose-500" /> Despesas Detalhadas
                        </h3>
                        <div className="flex flex-col gap-5">
                            {currentData.expenseByCategory.map(cat => (
                                <div key={cat.name} className="flex flex-col gap-1.5">
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-400 text-xs font-bold uppercase tracking-tight">{cat.name}</span>
                                        <span className="text-rose-400 font-black text-sm">R$ {cat.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="w-full bg-panel h-1 rounded-full overflow-hidden">
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(cat.amount / currentData.totalExpense) * 100}%` }}
                                            className="h-full bg-rose-500"
                                        />
                                    </div>
                                </div>
                            ))}
                            {currentData.expenseByCategory.length === 0 && <p className="text-slate-500 text-xs italic">Nenhuma despesa registrada.</p>}
                        </div>
                    </div>
                </div>

                <div className="glass-panel p-6 rounded-2xl border border-border flex flex-col gap-8 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <ShieldCheck className="w-24 h-24 text-text" />
                    </div>
                    
                    <h3 className="text-text font-bold uppercase text-xs tracking-wider opacity-80 flex items-center gap-2 relative z-10">
                        <TrendingUp className="w-4 h-4 text-indigo-400" /> Saúde Financeira
                    </h3>
                    
                    <div className="flex flex-col gap-8 relative z-10">
                        <div>
                            <div className="flex justify-between items-end mb-2">
                                <p className="text-[10px] uppercase text-slate-400 font-bold tracking-[0.15em]">Margem de Lucro</p>
                                <p className="text-2xl font-black text-text">{(currentData.totalRevenue > 0 ? (currentData.result / currentData.totalRevenue * 100).toFixed(1) : 0)}%</p>
                            </div>
                            <div className="w-full bg-panel h-2.5 rounded-full overflow-hidden border border-border">
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min(100, Math.max(0, currentData.totalRevenue > 0 ? (currentData.result / currentData.totalRevenue * 100) : 0))}%` }}
                                    className={`h-full rounded-full ${currentData.result > 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-end mb-2">
                                <p className="text-[10px] uppercase text-slate-400 font-bold tracking-[0.15em]">Comprometimento de Receita</p>
                                <p className="text-2xl font-black text-text">{(currentData.totalRevenue > 0 ? (currentData.totalExpense / currentData.totalRevenue * 100).toFixed(1) : 0)}%</p>
                            </div>
                            <div className="w-full bg-panel h-2.5 rounded-full overflow-hidden border border-border">
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min(100, Math.max(0, currentData.totalRevenue > 0 ? (currentData.totalExpense / currentData.totalRevenue * 100) : 0))}%` }}
                                    className="h-full bg-primary rounded-full"
                                />
                            </div>
                        </div>

                        <div className="bg-indigo-600/10 p-5 rounded-2xl border border-indigo-500/20 shadow-inner group hover:bg-indigo-600/15 transition-colors">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                                </div>
                                <p className="text-[10px] text-indigo-300 font-black uppercase tracking-widest">Recomendação Estratégica</p>
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed font-medium">
                                {currentData.result > 0 
                                    ? "Sua clínica apresenta uma taxa de lucro saudável. Este é o momento ideal para investir em tecnologias ou treinamento de equipe para aumentar o valor percebido pelo paciente." 
                                    : "Atenção crítica: A operação está consumindo mais do que gera. É recomendável uma auditoria imediata nas despesas operacionais e revisão da tabela de procedimentos."}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

  };


  const renderPricing = () => {
      const allServices: Service[] = incomeCategories.flatMap(c => c.subcategories.map(s => ({
          id: s.id,
          name: s.name,
          defaultValue: s.defaultValue || 0
      })));
      return <PricingSystem services={allServices} />;
  };

  const renderSettings = () => (
    <div className="flex flex-col gap-10 pb-20 animate-in fade-in custom-scrollbar">
        <div className="glass-panel rounded-2xl border border-border bg-surface p-6"><h3 className="text-base font-bold text-text mb-6 flex items-center gap-2"><Building2 className="text-emerald-500 w-4 h-4" /> Categorias de Receita & Procedimentos</h3><div className="flex gap-2 mb-4"><input value={newIncomeCategory} onChange={e => setNewIncomeCategory(e.target.value)} placeholder="Nova categoria (ex: Ortodontia)..." className="flex-1 bg-panel border border-border rounded-lg px-4 py-2 text-sm text-text" /><button onClick={async () => { if(newIncomeCategory) { await supabase.from('income_categories').insert({id: 'inc_'+Date.now(), name: newIncomeCategory, subcategories: [], type: 'income'}); fetchAllData(); setNewIncomeCategory(''); } }} className="px-6 py-2 bg-emerald-600 text-text rounded-lg text-xs font-bold uppercase transition-all hover:bg-emerald-500">Add</button></div><div className="flex flex-col gap-3">{incomeCategories.map(cat => (<div key={cat.id} className="flex flex-col gap-2 p-3 bg-panel rounded-xl border border-border"><div className="flex justify-between items-center"><span className="text-sm font-black text-slate-200 uppercase">{cat.name}</span><div className="flex gap-2"><button onClick={() => setExpandedCatId(expandedCatId === cat.id ? null : cat.id)} className="text-slate-500 hover:text-text transition-colors">{expandedCatId === cat.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button><button onClick={async () => { if(confirm("Excluir categoria?")) { await supabase.from('income_categories').delete().eq('id', cat.id); fetchAllData(); } }} className="text-slate-700 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button></div></div>{expandedCatId === cat.id && (<div className="mt-4 pl-4 border-l-2 border-border flex flex-col gap-3 animate-in slide-in-from-top-1"><div className="flex gap-2"><input value={newSubName} onChange={e => setNewSubName(e.target.value)} placeholder="Novo procedimento..." className="flex-1 bg-panel border border-border rounded px-3 py-1.5 text-xs text-text" /><input type="number" value={newSubValue} onChange={e => setNewSubValue(e.target.value)} placeholder="R$ 0,00" className="w-24 bg-panel border border-border rounded px-3 py-1.5 text-xs text-text font-mono" /><button onClick={async () => { const newSub = { id: 'sub_'+Date.now(), name: newSubName, defaultValue: parseFloat(newSubValue) || 0 }; await supabase.from('income_categories').update({ subcategories: [...cat.subcategories, newSub] }).eq('id', cat.id); setNewSubName(''); setNewSubValue(''); fetchAllData(); }} className="bg-emerald-600/20 text-emerald-400 px-3 rounded text-[10px] font-bold uppercase">Add</button></div><div className="flex flex-col gap-1.5">{cat.subcategories.map(sub => (<div key={sub.id} className="flex justify-between items-center py-1.5 px-3 bg-panel rounded border border-border"><span className="text-xs text-slate-400">{sub.name}</span><span className="text-xs font-mono font-bold text-slate-300">R$ {sub.defaultValue?.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span><button onClick={async () => {
                        const newSubs = cat.subcategories.filter(s => s.id !== sub.id);
                        await supabase.from('income_categories').update({ subcategories: newSubs }).eq('id', cat.id);
                        fetchAllData();
                      }} className="text-slate-600 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>))}</div></div>)}</div>))}</div></div>
        <div className="glass-panel rounded-2xl border border-border bg-surface p-6"><h3 className="text-base font-bold text-text mb-6 flex items-center gap-2"><Banknote className="text-red-500 w-4 h-4" /> Categorias de Despesas</h3><div className="flex gap-2 mb-6"><input value={newExpenseCategory} onChange={e => setNewExpenseCategory(e.target.value)} placeholder="Nova categoria de despesa..." className="flex-1 bg-panel border border-border rounded-lg px-4 py-2 text-sm text-text" /><select value={newExpenseType} onChange={e => setNewExpenseType(e.target.value as any)} className="bg-panel border border-border rounded-lg px-2 text-xs text-text outline-none [&>option]:bg-surface [&>option]:text-text"><option value="variable">Variável</option><option value="fixed">Fixa</option></select><button onClick={async () => { if(newExpenseCategory) { await supabase.from('expense_categories').insert({id: 'exp_'+Date.now(), name: newExpenseCategory, type: newExpenseType, subcategories: []}); fetchAllData(); setNewExpenseCategory(''); } }} className="px-6 py-2 bg-red-600 text-text rounded-lg text-xs font-bold uppercase transition-all hover:bg-red-500">Add</button></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{expenseCategories.map(cat => (<div key={cat.id} className="flex flex-col gap-2 p-3 bg-panel rounded-xl border border-border"><div className="flex justify-between items-center"><div className="flex items-center gap-2"><span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${cat.type === 'fixed' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'}`}>{cat.type === 'fixed' ? 'Fixa' : 'Variável'}</span><input 
                  className="text-sm font-black text-slate-200 uppercase bg-transparent border border-transparent hover:border-white/20 focus:border-white focus:outline-none rounded px-1"
                  value={cat.name}
                  onChange={(e) => {
                    const nextCategories = expenseCategories.map(c => 
                      c.id === cat.id ? { ...c, name: e.target.value } : c
                    );
                    setExpenseCategories(nextCategories);
                  }}
                  onBlur={async () => {
                    await supabase.from('expense_categories').update({ name: cat.name }).eq('id', cat.id);
                    fetchAllData();
                  }}
                /></div>
                <div className="flex gap-2 items-center">
                  <button 
                    onClick={() => setExpandedExpId(expandedExpId === cat.id ? null : cat.id)} 
                    className="text-slate-500 hover:text-text transition-colors"
                  >
                    {expandedExpId === cat.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  <button 
                    onClick={async () => { 
                      if(confirm("Deseja realmente excluir esta categoria de despesas?")) { 
                        await supabase.from('expense_categories').delete().eq('id', cat.id); 
                        fetchAllData(); 
                      } 
                    }} 
                    className="text-slate-500 hover:text-red-600 transition-colors"
                    title="Excluir Categoria"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>{expandedExpId === cat.id && (<div className="mt-4 pl-4 border-l-2 border-border flex flex-col gap-3 animate-in slide-in-from-top-1"><div className="flex gap-2"><input value={newSubName} onChange={e => setNewSubName(e.target.value)} placeholder="Subcategoria..." className="flex-1 bg-panel border border-border rounded px-3 py-1.5 text-xs text-text" /><button onClick={async () => { const newSub = { id: 'sub_'+Date.now(), name: newSubName }; await supabase.from('expense_categories').update({ subcategories: [...cat.subcategories, newSub] }).eq('id', cat.id); setNewSubName(''); fetchAllData(); }} className="bg-red-600/20 text-red-400 px-3 rounded text-[10px] font-bold uppercase">Add</button></div><div className="flex flex-col gap-1.5">{cat.subcategories.map(sub => (<div key={sub.id} className="flex justify-between items-center py-1.5 px-3 bg-panel rounded border border-border"><input 
                  className="text-xs text-slate-400 bg-transparent border border-transparent hover:border-white/20 focus:border-white focus:outline-none rounded px-1"
                  value={sub.name}
                  onChange={(e) => {
                    const nextCategories = expenseCategories.map(c => 
                        c.id === cat.id ? { ...c, subcategories: c.subcategories.map(s => s.id === sub.id ? {...s, name: e.target.value} : s) } : c
                    );
                    setExpenseCategories(nextCategories);
                  }}
                  onBlur={async () => {
                    await supabase.from('expense_categories').update({ subcategories: cat.subcategories }).eq('id', cat.id);
                    fetchAllData();
                  }}
                />
                <button onClick={async () => {
                  const newSubs = cat.subcategories.filter(s => s.id !== sub.id);
                  await supabase.from('expense_categories').update({ subcategories: newSubs }).eq('id', cat.id);
                  fetchAllData();
                }} className="text-slate-600 hover:text-red-500 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                </div>))}</div></div>)}</div>))}</div></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8"><div className="glass-panel rounded-2xl border border-border bg-surface p-6"><h3 className="text-base font-bold text-text mb-6 flex items-center gap-2"><Users className="text-blue-500 w-4 h-4" /> Profissionais</h3><div className="flex gap-2 mb-4"><input value={newProfessional} onChange={e => setNewProfessional(e.target.value)} placeholder="Nome..." className="flex-1 bg-panel border border-border rounded-lg px-4 py-2 text-sm text-text" /><button onClick={async () => { if(newProfessional) { await supabase.from('professionals').insert({id: 'prof_'+Date.now(), name: newProfessional}); fetchAllData(); setNewProfessional(''); } }} className="px-6 py-2 bg-blue-600 text-text rounded-lg text-xs font-bold uppercase">Add</button></div><div className="flex flex-col gap-2 max-h-48 overflow-y-auto custom-scrollbar">{professionals.map(p => (<div key={p.id} className="p-3 bg-panel rounded-xl border border-border flex justify-between group"><span className="text-sm text-slate-300">{p.name}</span><button onClick={async () => { await supabase.from('professionals').delete().eq('id', p.id); fetchAllData(); }} className="text-slate-600 hover:text-red-400 group-hover:opacity-100 opacity-0 transition-all"><Trash2 className="w-3.5 h-3.5" /></button></div>))}</div></div><div className="glass-panel rounded-2xl border border-border bg-surface p-6"><h3 className="text-base font-bold text-text mb-6 flex items-center gap-2"><Factory className="text-orange-500 w-4 h-4" /> Fornecedores</h3><div className="flex gap-2 mb-4"><input value={newSupplier} onChange={e => setNewSupplier(e.target.value)} placeholder="Nome..." className="flex-1 bg-panel border border-border rounded-lg px-4 py-2 text-sm text-text" /><button onClick={async () => { if(newSupplier) { await supabase.from('suppliers').insert({id: 'supp_'+Date.now(), name: newSupplier}); fetchAllData(); setNewSupplier(''); } }} className="px-6 py-2 bg-orange-600 text-text rounded-lg text-xs font-bold uppercase">Add</button></div><div className="flex flex-col gap-2 max-h-48 overflow-y-auto custom-scrollbar">{suppliers.map(s => (<div key={s.id} className="p-3 bg-panel rounded-xl border border-border flex justify-between group"><span className="text-sm text-slate-300">{s.name}</span><button onClick={async () => { await supabase.from('suppliers').delete().eq('id', s.id); fetchAllData(); }} className="text-slate-600 hover:text-red-400 group-hover:opacity-100 opacity-0 transition-all"><Trash2 className="w-3.5 h-3.5" /></button></div>))}</div></div><div className="glass-panel rounded-2xl border border-border bg-surface p-6"><h3 className="text-base font-bold text-text mb-6 flex items-center gap-2"><Users className="text-purple-500 w-4 h-4" /> Times de Venda</h3><div className="flex gap-2 mb-4"><input type="color" value={newSalesTeamColor} onChange={e => setNewSalesTeamColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer bg-transparent border-none p-0" title="Cor do Time" /><input value={newSalesTeam} onChange={e => setNewSalesTeam(e.target.value)} placeholder="Nome do time..." className="flex-1 bg-panel border border-border rounded-lg px-4 py-2 text-sm text-text" /><button onClick={async () => { if(newSalesTeam) { await supabase.from('sales_teams').insert({id: 'team_'+Date.now(), name: newSalesTeam, color: newSalesTeamColor}); fetchAllData(); setNewSalesTeam(''); setNewSalesTeamColor('#8b5cf6'); } }} className="px-6 py-2 bg-purple-600 text-text rounded-lg text-xs font-bold uppercase">Add</button></div><div className="flex flex-col gap-2 max-h-48 overflow-y-auto custom-scrollbar">{salesTeams.map(t => (<div key={t.id} className="p-3 bg-panel rounded-xl border border-border flex justify-between group items-center"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color || '#8b5cf6' }}></div><span className="text-sm text-slate-300">{t.name}</span></div><button onClick={async () => { await supabase.from('sales_teams').delete().eq('id', t.id); fetchAllData(); }} className="text-slate-600 hover:text-red-400 group-hover:opacity-100 opacity-0 transition-all"><Trash2 className="w-3.5 h-3.5" /></button></div>))}</div></div></div>
        <div className="glass-panel rounded-2xl border border-border bg-surface p-6"><h3 className="text-base font-bold text-text mb-6 flex items-center gap-2"><CreditCard className="text-purple-500 w-4 h-4" /> Formas de Pagamento & Taxas</h3><div className="flex gap-2 mb-4"><input value={newPaymentMethod} onChange={e => setNewPaymentMethod(e.target.value)} placeholder="Nova Forma de Pagamento..." className="flex-1 bg-panel border border-border rounded-lg px-4 py-2 text-sm text-text" /><button onClick={async () => { if(newPaymentMethod) { await supabase.from('payment_methods').insert({id: 'pm_'+Date.now(), name: newPaymentMethod, days_to_receive: 0, default_account_id: accountsList[0]?.id || ''}); fetchAllData(); setNewPaymentMethod(''); } }} className="px-6 py-2 bg-purple-600 text-text rounded-lg text-xs font-bold uppercase">Add</button></div><div className="flex flex-col gap-8"><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{paymentMethods.map(pm => (<div key={pm.id} className="p-4 bg-panel border border-border rounded-2xl flex flex-col gap-3"><div className="flex justify-between items-center"><span className="text-sm font-black text-text uppercase">{pm.name}</span><button onClick={async () => { await supabase.from('payment_methods').delete().eq('id', pm.id); fetchAllData(); }} className="text-slate-600 hover:text-red-400 transition-all"><Trash2 className="w-3.5 h-3.5" /></button></div><div className="flex flex-col gap-2"><div className="flex justify-between items-center text-[10px] font-bold text-slate-500"><span>DIAS PARA RECEBIMENTO:</span><input type="number" value={pm.daysToReceive} onChange={async (e) => { await supabase.from('payment_methods').update({days_to_receive: parseInt(e.target.value)}).eq('id', pm.id); fetchAllData(); }} className="w-12 bg-panel border border-border rounded text-center text-text" /></div><div className="flex flex-col gap-1"><span className="text-[10px] font-bold text-slate-500 uppercase">CONTA PADRÃO:</span><select value={pm.defaultAccountId} onChange={async (e) => { await supabase.from('payment_methods').update({default_account_id: e.target.value}).eq('id', pm.id); fetchAllData(); }} className="w-full bg-panel border border-border rounded px-2 py-1 text-xs text-slate-300 [&>option]:bg-surface [&>option]:text-text">{accountsList.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}</select></div></div></div>))}</div><div className="border-t border-border pt-6"><h4 className="text-xs font-bold text-slate-400 uppercase mb-4 tracking-widest flex items-center gap-2"><Percent className="w-3.5 h-3.5" /> Tabela de Taxas das Bandeiras</h4><div className="overflow-x-auto custom-scrollbar"><table className="w-full text-left border-collapse"><thead className="bg-panel text-[9px] font-bold text-slate-500 uppercase"><tr><th className="p-3">Bandeira</th><th className="p-3">Débito</th><th className="p-3">Crédito 1x</th>{[2,3,4,5,6,7,8,9,10,11,12].map(n => <th key={n} className="p-3">{n}x</th>)}</tr></thead><tbody className="text-[11px] text-slate-300 divide-y divide-white/5">{cardFees.map(fee => (<tr key={fee.brand} className="hover:bg-panel"><td className="p-3 font-bold text-text whitespace-nowrap">{fee.brand}</td><td className="p-3"><input type="number" step="0.01" value={fee.debit} onChange={async (e) => { const next = cardFees.map(f => f.brand === fee.brand ? {...f, debit: parseFloat(e.target.value)} : f); setCardFees(next); await supabase.from('card_fees').upsert(next[cardFees.findIndex(f=>f.brand===fee.brand)]); }} className="w-12 bg-panel border border-border rounded px-1 text-center" /> %</td><td className="p-3"><input type="number" step="0.01" value={fee.credit1x} onChange={async (e) => { const next = cardFees.map(f => f.brand === fee.brand ? {...f, credit1x: parseFloat(e.target.value)} : f); setCardFees(next); await supabase.from('card_fees').upsert(next[cardFees.findIndex(f=>f.brand===fee.brand)]); }} className="w-12 bg-panel border border-border rounded px-1 text-center" /> %</td>{[2,3,4,5,6,7,8,9,10,11,12].map(n => (<td key={n} className="p-3"><input type="number" step="0.01" value={fee.installments[n] || 0} onChange={async (e) => { const next = cardFees.map(f => { if (f.brand === fee.brand) { const newInst = { ...f.installments, [n]: parseFloat(e.target.value) }; return { ...f, installments: newInst }; } return f; }); setCardFees(next); await supabase.from('card_fees').upsert(next[cardFees.findIndex(f=>f.brand===fee.brand)]); }} className="w-12 bg-panel border border-border rounded px-1 text-center" /> %</td>))}</tr>))}</tbody></table></div></div></div></div>
    </div>
  );

  if (loading) return (
    <div className="flex-1 w-full h-full p-8 flex flex-col gap-6 animate-pulse bg-transparent">
      <div className="h-10 w-48 bg-panel rounded-lg mb-4"></div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="h-32 bg-panel rounded-2xl border border-border"></div>
        <div className="h-32 bg-panel rounded-2xl border border-border"></div>
        <div className="h-32 bg-panel rounded-2xl border border-border"></div>
        <div className="h-32 bg-panel rounded-2xl border border-border"></div>
      </div>
      <div className="flex-1 w-full bg-panel rounded-2xl border border-border mt-4"></div>
    </div>
  );

  return (
    <div className="flex-1 flex w-full h-full bg-transparent text-slate-300 font-sans overflow-hidden">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-transparent relative">
        {/* View Content */}
        <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-8 custom-scrollbar">

           <div className="w-full h-full space-y-10">
               
               <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-2">
                   <div>
                       <h1 className="text-4xl md:text-5xl font-bold text-text bg-transparent outline-none w-full block resize-none leading-tight tracking-tight mb-2">
                          {visibleTabs.find(t => t.id === activeSubTab)?.label || 'Financeiro'}
                       </h1>
                       <p className="text-slate-400 text-sm">Gestão de fluxo de caixa e auditoria.</p>
                   </div>

                   <div className="flex flex-wrap gap-2 text-sm justify-end">
                      <button onClick={() => openBulkModal('income')} className="px-4 py-2 glass-button text-indigo-400 rounded-xl font-bold flex items-center gap-2 transition-all"><List className="w-4 h-4" /> Massa Receita</button>
                      <button onClick={() => openBulkModal('expense')} className="px-4 py-2 glass-button text-red-400 rounded-xl font-bold flex items-center gap-2 transition-all"><List className="w-4 h-4" /> Massa Despesa</button>
                      <button onClick={() => openModal('income')} className="px-4 py-2 glass-button glass-button-primary text-text rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg"><Plus className="w-4 h-4" /> Receita</button>
                      <button onClick={() => openModal('expense')} className="px-4 py-2 glass-button bg-red-500/20 border-red-500/30 text-text rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg"><Minus className="w-4 h-4" /> Despesa</button>
                   </div>
               </div>

               {/* SUB NAVIGATION BAR */}
               <div className="flex items-center gap-1 overflow-x-auto pb-4 no-scrollbar border-b border-border">
                    {visibleTabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveSubTab(tab.id as SubTab)}
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

               <div className="flex-1 w-full pb-20">
            {activeSubTab === 'overview' && (
                <div className="flex flex-col gap-6 animate-in fade-in duration-500">
                    <div className="glass-panel p-4 rounded-xl border border-border flex flex-wrap gap-4 items-center justify-between relative z-20">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 uppercase font-bold">Período:</span>
                            <div className="w-64">
                                <DateRangePicker 
                                    value={{ start: overviewFilters.start, end: overviewFilters.end }} 
                                    onChange={(range) => setOverviewFilters(p => ({...p, start: range.start, end: range.end}))} 
                                />
                            </div>
                        </div>
                    </div>
                    
                    {overviewMetrics.errorCount > 0 && (<div className="bg-red-500/20 border border-red-500/30 p-3 rounded-xl flex items-center gap-3 animate-pulse"><span className="material-symbols-outlined text-red-500">warning</span><span className="text-xs font-bold text-red-400 uppercase tracking-widest">Atenção: Existem lançamentos com erro na auditoria para este período.</span></div>)}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <SpotlightCard className="glass-panel rounded-2xl p-6 bg-gradient-to-br from-emerald-900/20 to-slate-900/40" spotlightColor="rgba(52, 211, 153, 0.4)"><p className="text-emerald-400 text-xs font-bold uppercase mb-2">Receita Realizada</p><span className="text-3xl font-bold text-text">R$ {overviewMetrics.currentMonthIncome.toLocaleString('pt-BR')}</span></SpotlightCard>
                        <SpotlightCard className="glass-panel rounded-2xl p-6 bg-gradient-to-br from-cyan-900/20 to-slate-900/40" spotlightColor="rgba(34, 211, 238, 0.4)">
                            <p className="text-cyan-400 text-xs font-bold uppercase mb-2">Ticket Médio Total</p>
                            <span className="text-3xl font-bold text-text">R$ {overviewMetrics.ticketAverage.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </SpotlightCard>
                    </div>

                    <div className="flex flex-col gap-4">
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Ticket Médio por Categoria</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {overviewMetrics.categoryTicketAverage.map(cat => (
                                <SpotlightCard key={cat.name} className="glass-panel rounded-2xl p-4 bg-panel/40 border border-border flex flex-col gap-1" spotlightColor="rgba(34, 211, 238, 0.2)">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase truncate" title={cat.name}>{cat.name}</p>
                                    <span className="text-lg font-black text-text">R$ {cat.average.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                                </SpotlightCard>
                            ))}
                        </div>
                    </div>

                    {/* GRÁFICOS FINANCEIROS UI REFINADA */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                            { title: 'Por Categoria', data: overviewMetrics.categoryData, activeIndex: activeCategoryIndex, setActive: setActiveCategoryIndex },
                            { title: 'Por Procedimento', data: overviewMetrics.procedureData, activeIndex: activeProcedureIndex, setActive: setActiveProcedureIndex },
                            { title: 'Por Pagamento', data: overviewMetrics.paymentData, activeIndex: activePaymentIndex, setActive: setActivePaymentIndex }
                        ].map((chart, idx) => (
                            <div key={idx} className="glass-panel rounded-2xl p-6 border border-border flex flex-col min-h-[420px] transition-all hover:border-border">
                                <h3 className="text-sm font-bold text-text mb-6 uppercase tracking-widest text-center">{chart.title}</h3>
                                <div className="flex-1 w-full relative">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={chart.data}
                                                cx="50%"
                                                cy="45%"
                                                innerRadius="60%"
                                                outerRadius="80%"
                                                paddingAngle={5}
                                                cornerRadius={6}
                                                dataKey="value"
                                                stroke="none"
                                                onMouseEnter={(_, index) => chart.setActive(index)}
                                                onMouseLeave={() => chart.setActive(null)}
                                            >
                                                {chart.data.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                                <Label 
                                                    position="center"
                                                    content={({ viewBox }: any) => {
                                                        const cx = viewBox?.cx || 0;
                                                        const cy = viewBox?.cy || 0;
                                                        if (chart.activeIndex === null || !chart.data?.[chart.activeIndex]) return null;
                                                        const entry = chart.data[chart.activeIndex];
                                                        return (
                                                            <g>
                                                                <text x={cx} y={cy - 5} textAnchor="middle" dominantBaseline="middle" className="fill-white font-bold text-sm font-display">
                                                                    R$ {entry.value?.toLocaleString('pt-BR', { notation: "compact", maximumFractionDigits: 1 })}
                                                                </text>
                                                                <text x={cx} y={cy + 15} textAnchor="middle" dominantBaseline="middle" className="fill-slate-400 text-[9px] font-bold uppercase tracking-widest">
                                                                    {entry.name?.slice(0, 12)}
                                                                </text>
                                                            </g>
                                                        );
                                                    }}
                                                />
                                            </Pie>
                                            <Legend 
                                                verticalAlign="bottom" 
                                                align="center"
                                                iconType="circle" 
                                                layout="horizontal"
                                                formatter={(value) => <span className="text-[10px] text-slate-400 font-bold uppercase ml-1">{value}</span>}
                                                wrapperStyle={{ paddingTop: '20px', bottom: -10 }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    {chart.data.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-600 italic">Sem dados no período</div>}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* VISUALIZAÇÃO MENSAL (COM DADOS HISTÓRICOS 2025) */}
                    <div className="glass-panel rounded-2xl p-6 border border-border flex flex-col gap-6 mt-2">
                        <h3 className="text-sm font-bold text-text uppercase tracking-widest">Visualização Mensal (Últimos 12 Meses)</h3>
                        
                        <div className="h-[350px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={monthlyRevenueData} margin={{ top: 30, right: 30, bottom: 60, left: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                    <XAxis 
                                        dataKey="month" 
                                        stroke="#94a3b8" 
                                        fontSize={10} 
                                        tickMargin={15} 
                                        angle={-45}
                                        textAnchor="end"
                                    />
                                    <YAxis 
                                        stroke="#94a3b8" 
                                        fontSize={10} 
                                        tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                                    />
                                    <RechartsTooltip 
                                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                                        formatter={(value: number, name: string) => [`R$ ${value.toLocaleString('pt-BR')}`, name === 'revenue' ? 'Receita' : 'Meta']}
                                        labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                                    />
                                    <Legend verticalAlign="top" height={36} formatter={(value) => <span className="text-xs text-slate-400 font-bold uppercase">{value === 'revenue' ? 'Receita' : 'Meta Mensal'}</span>} />
                                    <Bar dataKey="revenue" name="revenue" fill="#0ea5e9" radius={[4, 4, 0, 0]} maxBarSize={50}>
                                        <LabelList dataKey="revenueLabel" position="top" fill="#94a3b8" fontSize={10} offset={12} />
                                    </Bar>
                                    <Line type="monotone" dataKey="goal" name="goal" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="h-[200px] w-full mt-4 border-t border-border pt-6">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center mb-4">Variance (%)</h4>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={monthlyRevenueData} margin={{ top: 20, right: 20, bottom: 40, left: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                    <ReferenceLine y={0} stroke="#94a3b8" />
                                    <XAxis 
                                        dataKey="month" 
                                        stroke="#94a3b8" 
                                        fontSize={10} 
                                        tickMargin={10} 
                                        angle={-45}
                                        textAnchor="end"
                                    />
                                    <YAxis 
                                        stroke="#94a3b8" 
                                        fontSize={10} 
                                        tickFormatter={(value) => `${value}%`}
                                    />
                                    <RechartsTooltip 
                                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                                        formatter={(value: number) => [`${value}%`, 'Variação']}
                                        labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                                    />
                                    <Bar dataKey="variance" radius={[4, 4, 0, 0]} maxBarSize={50}>
                                        {monthlyRevenueData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill="#93c5fd" opacity={entry.variance >= 0 ? 0.8 : 0.5} />
                                        ))}
                                        <LabelList dataKey="variance" position="top" fill="#94a3b8" fontSize={10} formatter={(val: number) => `${val}%`} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}
            {activeSubTab === 'transactions' && renderTransactionsTable()}
            {activeSubTab === 'expenses' && renderExpensesTable()}
            {activeSubTab === 'dre' && renderDRE()}
            {activeSubTab === 'pricing' && renderPricing()}
            {activeSubTab === 'settings' && renderSettings()}
            {activeSubTab === 'accounts' && (
                <div className="flex flex-col gap-8 animate-in fade-in h-full">
                    <div className="flex justify-end">
                        <button onClick={() => setIsAccountModalOpen(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-text rounded-lg text-sm font-bold flex items-center gap-2 transition-all active:scale-95 shadow-lg">
                            <Plus className="w-5 h-5" /> Nova Conta Bancária
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {accountsList.map(acc => { const accTxs = transactions.filter(t => t.accountId === acc.id && t.status === 'Paid'); const balance = (acc.initialBalance || 0) + accTxs.reduce((sum, t) => { const isIncome = t.type === 'income'; const gross = t.amount; const fee = getEffectiveFee(t); const net = gross - fee; return sum + (isIncome ? net : -gross); }, 0); return (<SpotlightCard key={acc.id} className="glass-panel rounded-2xl border border-border bg-surface p-6 relative overflow-hidden flex flex-col group transition-all hover:border-white/20" spotlightColor="rgba(59, 130, 246, 0.3)"><h4 className="text-text font-bold text-base">{acc.name}</h4><p className="text-[10px] text-slate-500 font-bold uppercase mb-8">{acc.bank}</p><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">SALDO DISPONÍVEL</p><span className={`text-2xl font-bold mb-6 ${balance < 0 ? 'text-red-400' : 'text-text'}`}>R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span><button onClick={() => setSelectedAccountForStatement(acc)} className="w-full py-2 bg-panel hover:bg-panel/80 text-text rounded-xl text-xs font-bold uppercase tracking-wider transition-all border border-border flex items-center justify-center gap-2"><Receipt className="w-4 h-4" />Visualizar Extrato</button></SpotlightCard>); })}
                    </div>
                </div>
            )}
          </div>
        </div>
      </div>

        {/* MODAL NOVA CONTA */}
        {isAccountModalOpen && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20 dark:bg-black/60 backdrop-blur-2xl p-4 animate-in fade-in duration-200">
                <div className="bg-surface border border-border w-full max-w-md rounded-2xl shadow-3xl overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-border bg-surface flex justify-between items-center"><h3 className="text-xl font-bold text-text font-display">Nova Conta Bancária</h3><button onClick={() => setIsAccountModalOpen(false)} className="text-slate-400 hover:text-text transition-colors"><X className="w-6 h-6" /></button></div>
                    <div className="p-6 flex flex-col gap-4">
                        <div className="flex flex-col gap-2"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">NOME DA CONTA</label><input value={newAccount.name} onChange={e => setNewAccount({...newAccount, name: e.target.value})} placeholder="Ex: Conta Principal" className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text outline-none font-bold" /></div>
                        <div className="flex flex-col gap-2"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">BANCO / INSTITUIÇÃO</label><input value={newAccount.bank} onChange={e => setNewAccount({...newAccount, bank: e.target.value})} placeholder="Ex: Nubank, Itaú..." className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text outline-none font-bold" /></div>
                        <div className="flex flex-col gap-2"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">SALDO INICIAL (R$)</label><input type="number" value={newAccount.initialBalance} onChange={e => setNewAccount({...newAccount, initialBalance: e.target.value})} placeholder="0.00" className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text font-bold" /></div>
                    </div>
                    <div className="p-6 border-t border-border bg-surface flex justify-end gap-4"><button onClick={() => setIsAccountModalOpen(false)} className="text-sm font-semibold text-slate-400 hover:text-text transition-colors">Cancelar</button><button onClick={handleSaveAccount} disabled={isSaving} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-text font-bold rounded-xl text-sm shadow-xl transition-all active:scale-95 disabled:opacity-50">Criar Conta</button></div>
                </div>
            </div>
        )}

        {/* MODAL LANÇAMENTO EM MASSA - FORMATO EXCEL */}
        {isBulkModalOpen && (
            <div className="fixed inset-0 z-[190] flex items-center justify-center bg-black/20 dark:bg-black/60 backdrop-blur-2xl p-4 animate-in fade-in">
                <div className="bg-surface border border-border w-full max-w-[95vw] h-[90vh] rounded-3xl shadow-3xl overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-border bg-surface flex justify-between items-center">
                        <div>
                            <h3 className="text-xl font-black text-text uppercase tracking-tight">Lançamentos em Massa (Grade Excel)</h3>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">A busca inteligente agora mapeia Profissionais, Pagamentos e Procedimentos do Excel.</p>
                        </div>
                        <button onClick={() => setIsBulkModalOpen(false)} className="text-slate-400 hover:text-text transition-colors"><X className="w-6 h-6" /></button>
                    </div>

                    <div className="p-4 bg-panel border-b border-border flex flex-col md:flex-row gap-4">
                        <div className="flex-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase px-1 mb-1 block">Copiar e Colar do Excel (Data | Desc | Cat | SubCat | Forn | Valor | Conta | Pagto | Status | DataPagto)</label>
                            <div className="flex gap-2">
                                <textarea value={pastedData} onChange={(e) => setPastedData(e.target.value)} placeholder="Cole aqui as linhas copiadas do seu Excel..." className="flex-1 h-10 bg-panel border border-border rounded-lg px-3 py-1.5 text-xs text-text outline-none focus:border-blue-500 resize-none font-mono" />
                                <button onClick={handleProcessPastedData} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-text rounded-lg text-xs font-bold uppercase transition-all">Processar Cola</button>
                            </div>
                        </div>
                        <div className="w-full md:w-auto flex flex-col justify-end"><label className="text-[10px] font-bold text-slate-500 uppercase px-1 mb-1 block">Ou subir arquivo CSV</label><label className="cursor-pointer px-4 py-2 bg-panel border border-border hover:bg-panel/80 text-slate-300 rounded-lg text-xs font-bold uppercase flex items-center gap-2 transition-all"><Upload className="w-4 h-4" />Selecionar .CSV<input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" /></label></div>
                    </div>
                    
                    <div className="flex-1 overflow-auto p-4 custom-scrollbar bg-surface">
                        <table className="w-full border-collapse border border-border">
                            <thead className="sticky top-0 bg-surface z-10 text-[9px] font-black text-slate-500 uppercase tracking-widest text-left">
                                <tr>
                                    <th className="p-3 border border-border min-w-[120px]">Data Comp.</th>
                                    <th className="p-3 border border-border min-w-[200px]">Descrição</th>
                                    <th className="p-3 border border-border min-w-[150px]">Categoria</th>
                                    <th className="p-3 border border-border min-w-[150px]">Sub-Categoria</th>
                                    <th className="p-3 border border-border min-w-[150px]">Fornecedor</th>
                                    <th className="p-3 border border-border min-w-[100px]">Valor (R$)</th>
                                    <th className="p-3 border border-border min-w-[150px]">Conta / Banco</th>
                                    <th className="p-3 border border-border min-w-[120px]">Forma de Pagto</th>
                                    <th className="p-3 border border-border min-w-[100px]">Status</th>
                                    <th className="p-3 border border-border min-w-[120px]">Data Pagto</th>
                                    <th className="p-3 border border-border w-[40px]"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {bulkRows.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-panel group">
                                        <td className="p-0 border border-border focus-within:ring-1 focus-within:ring-blue-500 focus-within:z-20 relative"><input type="date" value={row.date} onChange={e => handleBulkChange(idx, 'date', e.target.value)} className="w-full h-full bg-transparent border-none p-2.5 text-xs text-text outline-none focus:bg-blue-500/5 transition-colors" /></td>
                                        <td className="p-0 border border-border focus-within:ring-1 focus-within:ring-blue-500 focus-within:z-20 relative"><input value={row.description} onChange={e => handleBulkChange(idx, 'description', e.target.value)} placeholder="Descrição..." className="w-full h-full bg-transparent border-none p-2.5 text-xs text-text outline-none focus:bg-blue-500/5 transition-colors" /></td>
                                        <td className="p-0 border border-border focus-within:ring-1 focus-within:ring-blue-500 focus-within:z-20 relative">
                                            <select value={row.category} onChange={e => handleBulkChange(idx, 'category', e.target.value)} className="w-full h-full bg-transparent border-none p-2.5 text-xs text-text outline-none focus:bg-blue-500/5 cursor-pointer appearance-none">
                                                {expenseCategories.map(c => <option key={c.id} value={c.name} className="bg-surface">{c.name}</option>)}
                                            </select>
                                        </td>
                                        <td className="p-0 border border-border focus-within:ring-1 focus-within:ring-blue-500 focus-within:z-20 relative">
                                            <select value={row.procedure} onChange={e => handleBulkChange(idx, 'procedure', e.target.value)} className="w-full h-full bg-transparent border-none p-2.5 text-xs text-text outline-none focus:bg-blue-500/5 cursor-pointer appearance-none">
                                                <option value="" className="bg-surface">Selecione...</option>
                                                {(expenseCategories.find(c => c.name === row.category)?.subcategories || []).map(s => <option key={s.id} value={s.name} className="bg-surface">{s.name}</option>)}
                                            </select>
                                        </td>
                                        <td className="p-0 border border-border focus-within:ring-1 focus-within:ring-blue-500 focus-within:z-20 relative"><input value={row.supplier || ''} onChange={e => handleBulkChange(idx, 'supplier', e.target.value)} placeholder="Fornecedor..." className="w-full h-full bg-transparent border-none p-2.5 text-xs text-text outline-none focus:bg-blue-500/5 transition-colors" /></td>
                                        <td className="p-0 border border-border focus-within:ring-1 focus-within:ring-blue-500 focus-within:z-20 relative"><input value={row.amount} onChange={e => handleBulkChange(idx, 'amount', e.target.value)} placeholder="0.00" className="w-full h-full bg-transparent border-none p-2.5 text-xs text-text outline-none focus:bg-blue-500/5 font-mono font-bold text-right" /></td>
                                        <td className="p-0 border border-border focus-within:ring-1 focus-within:ring-blue-500 focus-within:z-20 relative"><select value={row.accountId} onChange={e => handleBulkChange(idx, 'accountId', e.target.value)} className="w-full h-full bg-transparent border-none p-2.5 text-xs text-text outline-none focus:bg-blue-500/5 cursor-pointer appearance-none">{accountsList.map(acc => <option key={acc.id} value={acc.id} className="bg-surface">{acc.name}</option>)}</select></td>
                                        <td className="p-0 border border-border focus-within:ring-1 focus-within:ring-blue-500 focus-within:z-20 relative">
                                            <select value={row.paymentMethod} onChange={e => handleBulkChange(idx, 'paymentMethod', e.target.value)} className="w-full h-full bg-transparent border-none p-2.5 text-xs text-text outline-none focus:bg-blue-500/5 cursor-pointer appearance-none">
                                                {paymentMethods.map(pm => <option key={pm.id} value={pm.name} className="bg-surface">{pm.name}</option>)}
                                            </select>
                                        </td>
                                        <td className="p-0 border border-border focus-within:ring-1 focus-within:ring-blue-500 focus-within:z-20 relative">
                                            <select value={row.status} onChange={e => handleBulkChange(idx, 'status', e.target.value)} className="w-full h-full bg-transparent border-none p-2.5 text-xs text-text outline-none focus:bg-blue-500/5 cursor-pointer appearance-none">
                                                <option value="Paid" className="bg-surface">Pago</option>
                                                <option value="Pending" className="bg-surface">A Pagar</option>
                                            </select>
                                        </td>
                                        <td className="p-0 border border-border focus-within:ring-1 focus-within:ring-blue-500 focus-within:z-20 relative"><input type="date" value={row.paymentDate || ''} onChange={e => handleBulkChange(idx, 'paymentDate', e.target.value)} className="w-full h-full bg-transparent border-none p-2.5 text-xs text-text outline-none focus:bg-blue-500/5 transition-colors" /></td>
                                        <td className="p-0 border border-border text-center"><button onClick={() => removeBulkRow(idx)} className="w-full h-full flex items-center justify-center text-slate-700 hover:text-red-400 transition-colors p-2.5"><Trash2 className="w-3.5 h-3.5" /></button></td>

                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <button onClick={addBulkRow} className="mt-4 w-full py-4 border-2 border-dashed border-border rounded-xl text-slate-500 hover:text-text hover:border-border transition-all font-bold text-xs uppercase tracking-widest">+ Adicionar Nova Linha de Célula</button>
                    </div>
                    
                    <div className="p-8 border-t border-border bg-surface flex justify-end gap-6 items-center"><div className="mr-auto flex gap-6 text-[10px] font-black uppercase text-slate-500 tracking-tighter"><span>{bulkRows.length} linhas preparadas</span><span className="text-slate-700">|</span><span>Dica: Use [TAB] para navegar ou cole do Excel acima</span></div><button onClick={() => setIsBulkModalOpen(false)} className="text-sm font-semibold text-slate-400 hover:text-text">Cancelar</button><button onClick={handleSaveBulk} disabled={isSaving} className="px-10 py-3 bg-indigo-600 hover:bg-indigo-500 text-text font-black rounded-xl text-sm shadow-xl transition-all active:scale-95 disabled:opacity-50 uppercase tracking-widest">Processar Planilha</button></div>
                </div>
            </div>
        )}

        {/* MODAL LANÇAMENTO INDIVIDUAL */}
        {isModalOpen && (
            <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/20 dark:bg-black/60 backdrop-blur-2xl p-4 animate-in fade-in duration-200">
                <div className="bg-surface border border-border w-full max-w-2xl rounded-2xl shadow-3xl overflow-hidden flex flex-col relative">
                    <div className="p-6 border-b border-border bg-surface flex justify-between items-center"><h3 className="text-xl font-bold text-text font-display">{formData.id ? 'Editar Lançamento' : (modalType === 'income' ? 'Nova Receita' : 'Nova Despesa')}</h3><button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-text transition-colors"><X className="w-6 h-6" /></button></div>
                    <div className="p-8 flex flex-col gap-6 overflow-y-auto max-h-[80vh] custom-scrollbar bg-surface">
                        {modalType === 'expense' ? (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">DATA DE COMPETÊNCIA</label>
                                        <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text outline-none font-bold" />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">DESCRIÇÃO</label>
                                        <input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text outline-none" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">CATEGORIA</label>
                                        <select value={formData.category} onChange={e => handleCategoryChange(e.target.value)} className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text outline-none font-bold [&>option]:bg-surface [&>option]:text-text">
                                            {expenseCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">SUB-CATEGORIA / PROCEDIMENTO</label>
                                        <select value={formData.procedure} onChange={e => handleSubCategoryChange(e.target.value)} className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text outline-none font-bold [&>option]:bg-surface [&>option]:text-text">
                                            <option value="">Selecione...</option>
                                            {(expenseCategories.find(c => c.name === formData.category)?.subcategories || []).map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">FORNECEDOR</label>
                                        <select value={formData.supplier} onChange={e => setFormData({...formData, supplier: e.target.value})} className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text outline-none font-bold [&>option]:bg-surface [&>option]:text-text">
                                            <option value="">Selecione...</option>
                                            {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">VALOR (R$)</label>
                                        <input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} placeholder="0.00" className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text font-bold" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">CONTA / BANCO (AUTOMÁTICO)</label>
                                        <select value={formData.accountId} onChange={e => setFormData({...formData, accountId: e.target.value})} className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text outline-none font-bold [&>option]:bg-surface [&>option]:text-text">
                                            {accountsList.map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({acc.bank})</option>)}
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">FORMA PAGTO</label>
                                        <select value={formData.paymentMethod} onChange={e => handlePaymentMethodChange(e.target.value)} className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text outline-none font-bold [&>option]:bg-surface [&>option]:text-text">
                                            {paymentMethods.map(pm => <option key={pm.id} value={pm.name}>{pm.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top-1">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">STATUS DO PAGAMENTO</label>
                                        <div className="flex bg-surface p-1 rounded-xl border border-border w-fit">
                                            <button type="button" onClick={() => setFormData({...formData, status: 'Pending', settlementDate: ''})} className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${formData.status === 'Pending' ? 'bg-red-600 text-text shadow-lg' : 'text-slate-400 hover:text-text'}`}>A Pagar</button>
                                            <button type="button" onClick={() => setFormData({...formData, status: 'Paid', settlementDate: today})} className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${formData.status === 'Paid' ? 'bg-emerald-600 text-text shadow-lg' : 'text-slate-400 hover:text-text'}`}>Pago</button>
                                        </div>
                                    </div>
                                    {formData.status === 'Paid' && (
                                        <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-left-2">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">DATA DO PAGAMENTO</label>
                                            <input type="date" value={formData.settlementDate} onChange={e => setFormData({...formData, settlementDate: e.target.value})} className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text outline-none font-bold" />
                                        </div>
                                    )}
                                </div>
                                {!formData.id && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top-1">
                                        <div className="flex flex-col gap-2">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">RECORRÊNCIA (MESES)</label>
                                            <select value={formData.recurrence} onChange={e => setFormData({...formData, recurrence: parseInt(e.target.value) || 1})} className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text outline-none font-bold [&>option]:bg-surface [&>option]:text-text">
                                                {[1,2,3,4,5,6,7,8,9,10,11,12,24,36,48,60].map(n => <option key={n} value={n}>{n === 1 ? 'Lançamento Único' : `${n} Meses`}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="flex flex-col gap-2"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">DATA</label><input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text outline-none font-bold" /></div><div className="flex flex-col gap-2"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">PACIENTE</label><input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text outline-none" /></div></div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="flex flex-col gap-2"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">CATEGORIA</label><select value={formData.category} onChange={e => handleCategoryChange(e.target.value)} className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text outline-none font-bold [&>option]:bg-surface [&>option]:text-text">{(modalType === 'income' ? incomeCategories : expenseCategories).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div><div className="flex flex-col gap-2"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">SUB-CATEGORIA / PROCEDIMENTO</label><select value={formData.procedure} onChange={e => handleSubCategoryChange(e.target.value)} className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text outline-none font-bold [&>option]:bg-surface [&>option]:text-text"><option value="">Selecione...</option>{((modalType === 'income' ? incomeCategories : expenseCategories).find(c => c.name === formData.category)?.subcategories || []).map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</select></div></div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="flex flex-col gap-2"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">VALOR (R$)</label><input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} placeholder="0.00" className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text font-bold" /></div><div className="flex flex-col gap-2"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">CONTA / BANCO (AUTOMÁTICO)</label><select value={formData.accountId} onChange={e => setFormData({...formData, accountId: e.target.value})} className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text outline-none font-bold [&>option]:bg-surface [&>option]:text-text">{accountsList.map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({acc.bank})</option>)}</select></div></div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top-1">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">PROFISSIONAL</label>
                                        <select value={formData.professional} onChange={e => setFormData({...formData, professional: e.target.value})} className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text outline-none font-bold [&>option]:bg-surface [&>option]:text-text">
                                            <option value="">Selecione...</option>
                                            {professionals.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                        </select>
                                    </div>
                                    {(!(formData.date >= '2026-06-01') || formData.salesTeam) && (
                                        <div className="flex flex-col gap-2">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">TIME DE VENDA</label>
                                            <select 
                                                value={formData.salesTeam} 
                                                onChange={e => setFormData({...formData, salesTeam: e.target.value})} 
                                                disabled={formData.procedure === 'Panorâmica' || formData.procedure === 'Documentação Inicial'}
                                                className={`w-full bg-surface border border-border rounded-xl px-4 py-3 text-text outline-none font-bold [&>option]:bg-surface [&>option]:text-text ${
                                                    (formData.procedure === 'Panorâmica' || formData.procedure === 'Documentação Inicial') ? 'opacity-50 cursor-not-allowed' : ''
                                                }`}
                                            >
                                                <option value="">Selecione...</option>
                                                {salesTeams.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                                                {formData.salesTeam && !salesTeams.find(t => t.name === formData.salesTeam) && (
                                                    <option value={formData.salesTeam}>{formData.salesTeam}</option>
                                                )}
                                            </select>
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top-1">
                                    <div className="flex flex-col gap-2"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">FORMA PAGTO</label><select value={formData.paymentMethod} onChange={e => handlePaymentMethodChange(e.target.value)} className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text outline-none font-bold [&>option]:bg-surface [&>option]:text-text">{paymentMethods.map(pm => <option key={pm.id} value={pm.name}>{pm.name}</option>)}</select></div>
                                    {formData.status === 'Paid' && (
                                        <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-left-2">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">DATA DO RECEBIMENTO</label>
                                            <input type="date" value={formData.settlementDate} onChange={e => setFormData({...formData, settlementDate: e.target.value})} className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text outline-none font-bold" />
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top-1">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">STATUS DO RECEBIMENTO</label>
                                        <div className="flex bg-surface p-1 rounded-xl border border-border w-fit">
                                            <button type="button" onClick={() => setFormData({...formData, status: 'Pending', settlementDate: ''})} className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${formData.status === 'Pending' ? 'bg-amber-600 text-text shadow-lg' : 'text-slate-400 hover:text-text'}`}>A Receber</button>
                                            <button type="button" onClick={() => setFormData({...formData, status: 'Paid', settlementDate: today})} className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${formData.status === 'Paid' ? 'bg-emerald-600 text-text shadow-lg' : 'text-slate-400 hover:text-text'}`}>Recebido</button>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top-1">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">TIPO DE RECEBIMENTO</label>
                                        <div className="flex bg-surface p-1 rounded-xl border border-border w-fit">
                                            <button type="button" onClick={() => setFormData({...formData, isPartial: false})} className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${!formData.isPartial ? 'bg-emerald-600 text-text shadow-lg' : 'text-slate-400 hover:text-text'}`}>Integral</button>
                                            <button type="button" onClick={() => setFormData({...formData, isPartial: true})} className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${formData.isPartial ? 'bg-amber-600 text-text shadow-lg' : 'text-slate-400 hover:text-text'}`}>Parcial</button>
                                        </div>
                                    </div>
                                    {(((formData.paymentMethod || '').toLowerCase().includes('cartão') || (formData.paymentMethod || '').toLowerCase().includes('crédito') || (formData.paymentMethod || '').toLowerCase().includes('débito'))) && (
                                        <div className="flex flex-col gap-2 animate-in slide-in-from-top-1">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">BANDEIRA DO CARTÃO</label>
                                            <select value={formData.cardBrand} onChange={e => setFormData({...formData, cardBrand: e.target.value})} className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text outline-none font-bold">
                                                <option value="">Selecione...</option>
                                                {cardFees.map(f => <option key={f.brand} value={f.brand}>{f.brand}</option>)}
                                            </select>
                                        </div>
                                    )}
                                </div>
                                {(((formData.paymentMethod || '').toLowerCase().includes('cartão') || (formData.paymentMethod || '').toLowerCase().includes('crédito'))) && !(formData.paymentMethod || '').toLowerCase().includes('débito') && (
                                    <div className="flex flex-col gap-2 animate-in slide-in-from-top-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">NÚMERO DE PARCELAS</label>
                                        <select value={formData.installments} onChange={e => setFormData({...formData, installments: parseInt(e.target.value) || 1})} className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text outline-none font-bold">
                                            {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => <option key={n} value={n}>{n}x</option>)}
                                        </select>
                                    </div>
                                )}
                            </>
                        )}
                        <div className="flex flex-col gap-2"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">OBSERVAÇÕES / COMENTÁRIOS</label><textarea value={formData.observation} onChange={e => setFormData({...formData, observation: e.target.value})} placeholder="Notas internas sobre este lançamento..." className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text outline-none h-20 resize-none" /></div>
                    </div>
                    <div className="p-8 border-t border-border bg-surface flex justify-end gap-6 items-center"><button onClick={() => setIsModalOpen(false)} className="text-sm font-semibold text-slate-400 hover:text-text transition-colors">Cancelar</button><button onClick={handleSaveTransaction} disabled={isSaving} className={`px-10 py-3 rounded-xl ${modalType === 'income' ? 'bg-surface' : 'bg-surface'} text-text font-bold text-sm shadow-xl transition-all active:scale-95`}>Confirmar</button></div>
                </div>
            </div>
        )}

        {/* MODAL OBSERVAÇÃO RÁPIDA */}
        {isObsModalOpen && selectedTxForObs && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20 dark:bg-black/60 backdrop-blur-2xl p-4 animate-in fade-in duration-200">
                <div className="bg-surface border border-border w-full max-w-md rounded-2xl shadow-3xl overflow-hidden"><div className="p-5 border-b border-border bg-surface flex justify-between items-center"><h3 className="text-sm font-bold text-text uppercase">Observação do Lançamento</h3><button onClick={() => setIsObsModalOpen(false)} className="text-slate-400 hover:text-text"><X className="w-5 h-5" /></button></div><div className="p-6"><p className="text-[10px] text-slate-500 font-bold uppercase mb-2">DESCRIÇÃO: {selectedTxForObs.description}</p><textarea value={tempObs} onChange={e => setTempObs(e.target.value)} placeholder="Escreva aqui..." className="w-full bg-surface border border-border rounded-xl p-4 text-sm text-text outline-none h-40 resize-none focus:border-amber-500 transition-colors" /></div><div className="p-4 border-t border-border bg-surface flex justify-end gap-3"><button onClick={() => setIsObsModalOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-400">Cancelar</button><button onClick={handleSaveObservation} className="px-6 py-2 bg-amber-600 text-text rounded-lg text-xs font-bold uppercase shadow-lg">Salvar Nota</button></div></div>
            </div>
        )}

        {/* MODAL EXTRATO DE CONTA */}
        {selectedAccountForStatement && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20 dark:bg-black/60 backdrop-blur-2xl p-4 animate-in fade-in duration-200">
                <div className="bg-surface border border-border w-full max-w-5xl rounded-3xl shadow-3xl overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="p-6 border-b border-border bg-surface flex justify-between items-center"><div className="flex items-center gap-4"><div className="size-10 bg-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/10"><Wallet className="w-6 h-6" /></div><div><h3 className="text-xl font-bold text-text leading-none mb-1">Extrato: {selectedAccountForStatement.name}</h3><p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{selectedAccountForStatement.bank}</p></div></div><button onClick={() => setSelectedAccountForStatement(null)} className="text-slate-400 hover:text-text transition-colors"><X className="w-6 h-6" /></button></div>
                    <div className="flex-1 overflow-y-auto p-0 custom-scrollbar bg-surface"><table className="w-full text-left border-collapse"><thead className="sticky top-0 bg-surface text-[10px] font-bold text-slate-400 uppercase tracking-wider z-10"><tr><th className="p-4 pl-8">Data</th><th className="p-4">Descrição</th><th className="p-4 text-right">Valor Bruto</th><th className="p-4 text-right">Taxas</th><th className="p-4 text-right pr-8">Líquido (Saldo)</th></tr></thead><tbody className="text-xs text-slate-300 divide-y divide-white/5"><tr className="bg-panel"><td className="p-4 pl-8 font-mono text-slate-500 italic">Inicial</td><td className="p-4 font-bold text-slate-400 uppercase tracking-widest text-[10px]">Saldo Inicial da Conta</td><td className="p-4 text-right">-</td><td className="p-4 text-right">-</td><td className="p-4 text-right font-bold text-text pr-8">R$ {selectedAccountForStatement.initialBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>{transactions.filter(t => t.accountId === selectedAccountForStatement.id && t.status === 'Paid').sort((a, b) => { const dateA = a.settlementDate || a.date; const dateB = b.settlementDate || b.date; return dateB.localeCompare(dateA); }).map(tx => { const isIncome = tx.type === 'income'; const gross = tx.amount; const fee = getEffectiveFee(tx); const net = gross - fee; const displayDate = tx.settlementDate || tx.date; return (<tr key={tx.id} className="hover:bg-panel transition-colors"><td className="p-4 pl-8 font-mono">{displayDate.split('-').reverse().join('/')}</td><td className="p-4"><div className="flex flex-col"><span className="font-bold text-text">{tx.description}</span><span className="text-[10px] text-slate-500 uppercase font-medium">{tx.category} • {tx.paymentMethod}</span></div></td><td className="p-4 text-right text-slate-400">R$ {gross.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td><td className="p-4 text-right"><div className="flex items-center justify-end text-red-400/60 group/fee"><span className="text-[10px] mr-1">- R$</span><input type="number" step="0.01" value={fee.toFixed(2)} onChange={(e) => { const val = parseFloat(e.target.value) || 0; setTransactions(prev => prev.map(item => item.id === tx.id ? {...item, explicitFeeAmount: val} : item)); }} onBlur={(e) => { const val = parseFloat(e.target.value) || 0; handleUpdateFee(tx.id, val); }} className="bg-transparent text-right w-20 outline-none border-b border-transparent group-hover/fee:border-border focus:border-red-500/50 transition-all font-mono" /></div></td><td className={`p-4 text-right font-black pr-8 ${isIncome ? 'text-emerald-400' : 'text-red-400'}`}>{isIncome ? '+' : '-'} R$ {(isIncome ? net : gross).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>); })}</tbody></table>{transactions.filter(t => t.accountId === selectedAccountForStatement.id && t.status === 'Paid').length === 0 && (<div className="p-20 text-center text-slate-500 italic">Nenhum lançamento encontrado para esta conta.</div>)}</div>
                    <div className="p-8 border-t border-border bg-surface flex justify-between items-center"><div className="flex gap-8"><div className="flex flex-col"><span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Saldo Atual Real</span><span className="text-2xl font-bold text-text">R$ {((selectedAccountForStatement.initialBalance || 0) + transactions.filter(t => t.accountId === selectedAccountForStatement.id && t.status === 'Paid').reduce((sum, t) => { const isIncome = t.type === 'income'; const gross = t.amount; const fee = getEffectiveFee(t); const net = gross - fee; return sum + (isIncome ? net : -gross); }, 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div></div><button onClick={() => setSelectedAccountForStatement(null)} className="px-8 py-3 bg-white text-black font-bold rounded-xl text-sm transition-all active:scale-95">Fechar Extrato</button></div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default Financial;
