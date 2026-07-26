
import React, { useState, useMemo, useEffect } from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Label, LabelList, LineChart, Line
} from 'recharts';
import { supabase } from '../supabaseClient';
import { SpotlightCard } from './ui/spotlight-card';
import { OrthodonticsCalendar } from './OrthodonticsCalendar';
import { LayoutPanelLeft, Search, BarChart3, X } from 'lucide-react';
import { toast } from 'sonner';

// --- TYPES ---
type OrthoTab = 'vision' | 'grid' | 'patients' | 'settings';

interface OrthoPatient {
  id: string;
  name: string;
  applianceType: string;
  contractType?: 'Digital' | 'Papel';
  startDate: string;
  endDate?: string;
  estimatedDuration: number; // months
  status: 'Active' | 'Finished' | 'Suspended';
  maintenanceValue: number;
  attendance: Record<string, any>;
  problemNote?: string; // New field for issues
}

interface ApplianceType {
  id: string;
  name: string;
  defaultCost: number;
}

interface FinishReason {
  id: string;
  name: string;
}

const isOrthoDay = (date: Date) => {
    const dayOfWeek = date.getDay();
    if (dayOfWeek !== 1 && dayOfWeek !== 3 && dayOfWeek !== 6) return false;

    if (dayOfWeek === 6) { // Saturday
        const dayOfMonth = date.getDate();
        let saturdayCount = 0;
        for (let d = 1; d <= dayOfMonth; d++) {
            const dObj = new Date(date.getFullYear(), date.getMonth(), d);
            if (dObj.getDay() === 6) saturdayCount++;
        }
        if (saturdayCount === 1 || saturdayCount === 3) return false;
    }
    return true;
}

const COLORS = ['#d946ef', '#8b5cf6', '#2dd4bf', '#fb923c', '#ef4444', '#3b82f6'];
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Config for sub-tabs
const ORTHO_TABS_CONFIG = [
    { id: 'vision', label: 'Visão', icon: 'dashboard', permissionId: 'ortho_vision' },
    { id: 'grid', label: 'Grade', icon: 'calendar_view_month', permissionId: 'ortho_grid' },
    { id: 'patients', label: 'Pacientes', icon: 'groups', permissionId: 'ortho_patients' },
    { id: 'settings', label: 'Configurações', icon: 'settings', permissionId: 'ortho_settings' },
];

interface OrthodonticsProps {
    userRole?: string;
    allowedSubTabs?: string[];
    requestedSubTab?: string | null;
    requestedAction?: string | null;
}

export const Orthodontics: React.FC<OrthodonticsProps> = ({ userRole, allowedSubTabs = [], requestedSubTab, requestedAction }) => {
  // Filter Tabs
  const visibleTabs = useMemo(() => {
      // Allow all if admin OR if allowedSubTabs is empty (legacy/permissive mode)
      if (userRole === 'admin' || !allowedSubTabs || allowedSubTabs.length === 0) return ORTHO_TABS_CONFIG;
      
      function getActiveTabs() {
          const ALL_TABS = ORTHO_TABS_CONFIG;
          return ALL_TABS.filter(tab => Array.isArray(allowedSubTabs) && allowedSubTabs.includes(tab.permissionId));
      }
      
      const filtered = getActiveTabs();
      return filtered.length > 0 ? filtered : ORTHO_TABS_CONFIG;
  }, [userRole, allowedSubTabs]);

  const [activeSubTab, setActiveSubTab] = useState<OrthoTab>(visibleTabs[0]?.id as OrthoTab || 'vision');

  // Update active if permission removed
  useEffect(() => {
      if (visibleTabs.length > 0 && !visibleTabs.find(t => t.id === activeSubTab)) {
          setActiveSubTab(visibleTabs[0].id as OrthoTab);
      }
  }, [visibleTabs, activeSubTab]);

  // Listener para mudança de aba via Sidebar
  useEffect(() => {
      if (requestedSubTab) {
          const tabExists = visibleTabs.find(t => t.id === requestedSubTab);
          if (tabExists) {
              setActiveSubTab(requestedSubTab as OrthoTab);
          }
      }
  }, [requestedSubTab, visibleTabs]);
  
  // --- LOCAL STATE ---
  const [patients, setPatients] = useState<OrthoPatient[]>([]);
  const [applianceTypes, setApplianceTypes] = useState<ApplianceType[]>([]);
  const [finishReasons, setFinishReasons] = useState<FinishReason[]>([]);
  const [docInitialTransactions, setDocInitialTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate] = useState<Date | null>(null);
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null);
  const [gridEditingInfo, setGridEditingInfo] = useState<{ patientId: string; monthIndex: number } | null>(null);

  // States for filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Finished' | 'Suspended'>('All');
  const [feeFilter, setFeeFilter] = useState<number | 'All'>('All');

  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | 'none' }>({
      key: 'duration',
      direction: 'none'
  });

  const toggleSort = (key: string) => {
      setSortConfig(prev => {
          if (prev.key !== key) return { key, direction: 'desc' };
          if (prev.direction === 'none') return { key, direction: 'desc' };
          if (prev.direction === 'desc') return { key, direction: 'asc' };
          return { key, direction: 'none' };
      });
  };

  // States for filters
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1)); 
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear().toString());

  // Chart Hover State
  const [activeApplianceIndex, setActiveApplianceIndex] = useState<number | null>(null);

  // States for settings
  const [newApplianceName, setNewApplianceName] = useState('');
  const [editingApplianceId, setEditingApplianceId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  
  const [newFinishReason, setNewFinishReason] = useState('');
  const [dayNotes, setDayNotes] = useState<Record<string, string>>({});
  const [selectedNoteDay, setSelectedNoteDay] = useState('');
  const [noteText, setNoteText] = useState('');
  const [gridStatusFilter, setGridStatusFilter] = useState<'all' | 'Scheduled' | 'Present' | 'Absent'>('all');

  // States for Modals
  const [isNewContractModalOpen, setIsNewContractModalOpen] = useState(false);
  const [newContractForm, setNewContractForm] = useState({
      name: '',
      applianceType: '',
      contractType: '' as 'Digital' | 'Papel' | '',
      startDate: new Date().toISOString().split('T')[0],
      maintenanceValue: '',
      estimatedDuration: 24
  });

  const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
  const [selectedPatientToFinish, setSelectedPatientToFinish] = useState<string | null>(null);
  const [finishDate, setFinishDate] = useState(new Date().toISOString().split('T')[0]);

  // Problem Note Modal
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [selectedPatientForNote, setSelectedPatientForNote] = useState<OrthoPatient | null>(null);
  const [noteContent, setNoteContent] = useState('');

  // Init Data
  const loadData = async () => {
      setLoading(true);
      try {
          const { data: pats } = await supabase.from('ortho_patients').select('*');
          if (pats) {
              setPatients(pats.map(p => ({
                  id: p.id,
                  name: p.name,
                  applianceType: p.appliance_type,
                  contractType: p.attendance?.__contract_type || undefined,
                  startDate: p.start_date,
                  endDate: p.end_date,
                  estimatedDuration: p.estimated_duration,
                  status: p.status,
                  maintenanceValue: Number(p.maintenance_value || 0), // Corrigido mapeamento de mensalidade
                  attendance: p.attendance || {},
                  problemNote: p.problem_note // Mapping from DB
              })));
          }
          
          const { data: apps } = await supabase.from('ortho_appliances').select('*');
          if (apps) {
              setApplianceTypes(apps.map(a => ({
                  id: a.id,
                  name: a.name,
                  defaultCost: a.default_cost
              })));
          }

          const { data: reasons } = await supabase.from('ortho_finish_reasons').select('*');
          if (reasons) {
              setFinishReasons(reasons);
          }

          // Fetch initial documentation transactions
          const { data: txs } = await supabase.from('transactions')
            .select('date')
            .eq('procedure', 'Documentação Inicial');
          if (txs) {
              setDocInitialTransactions(txs);
          }
      } catch (error) {
          console.error("Error loading ortho data", error);
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
      loadData();
  }, []);

  useEffect(() => {
      if (requestedAction === 'new_patient') {
          setIsNewContractModalOpen(true);
      }
  }, [requestedAction]);

  // --- FILTERED DATA ---
  const filteredPatients = useMemo(() => {
      let result = [...patients];
      
      if (searchTerm) {
          result = result.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
      }

      if (statusFilter !== 'All') {
          result = result.filter(p => p.status === statusFilter);
      }

      if (feeFilter !== 'All') {
          result = result.filter(p => p.maintenanceValue === feeFilter);
      }

      if (sortConfig.direction !== 'none') {
          result.sort((a, b) => {
              if (sortConfig.key === 'duration') {
                  const getDurationMs = (p: OrthoPatient) => {
                      if (!p.startDate) return 0;
                      const start = new Date(p.startDate).getTime();
                      const end = p.endDate ? new Date(p.endDate).getTime() : new Date().getTime();
                      return end - start;
                  };
                  
                  const durA = getDurationMs(a);
                  const durB = getDurationMs(b);
                  
                  return sortConfig.direction === 'asc' ? durA - durB : durB - durA;
              }
              return 0;
          });
      }
      
      return result;
  }, [patients, searchTerm, statusFilter, feeFilter, sortConfig]);

  // --- ACTIONS ---

  const handleOpenFinishModal = (id: string) => {
      setSelectedPatientToFinish(id);
      setFinishDate(new Date().toISOString().split('T')[0]);
      setIsFinishModalOpen(true);
  };

  const handleConfirmFinish = async () => {
      if (!selectedPatientToFinish) return;
      
      try {
          const { error } = await supabase.from('ortho_patients').update({
              status: 'Finished',
              end_date: finishDate
          }).eq('id', selectedPatientToFinish);
          
          if (!error) {
              // Optimistic update
              setPatients(prev => prev.map(p => p.id === selectedPatientToFinish ? { ...p, status: 'Finished', endDate: finishDate } : p));
              await loadData();
              toast.success('Paciente finalizado com sucesso!');
          } else {
              console.error("Error finishing treatment", error);
              toast.error('Erro ao finalizar tratamento.');
          }
      } catch (err) {
          console.error("Critical error finishing", err);
          toast.error('Erro crítico ao finalizar tratamento.');
      }
      
      setIsFinishModalOpen(false);
      setSelectedPatientToFinish(null);
  };

  const handleReactivate = async (id: string) => {
      if (!confirm('Deseja reativar o tratamento deste paciente?')) return;
      
      try {
          const { error } = await supabase.from('ortho_patients').update({
              status: 'Active',
              end_date: null
          }).eq('id', id);
          
          if (!error) {
              // Optimistic update
              setPatients(prev => prev.map(p => p.id === id ? { ...p, status: 'Active', endDate: undefined } : p));
              toast.success('Paciente reativado com sucesso! Ele agora aparecerá na Grade.');
              setStatusFilter('Active');
              await loadData();
          } else {
              console.error("Error reactivating patient", error);
              toast.error('Erro ao reativar paciente: ' + error.message);
          }
      } catch (err) {
          console.error("Critical error reactivating", err);
          toast.error('Erro crítico ao reativar paciente.');
      }
  };

  const handleSaveContract = async () => {
      if (!newContractForm.name || !newContractForm.maintenanceValue || !newContractForm.applianceType) return;

      const patientId = 'pt_' + Date.now().toString();
      const initialAttendance: any = {};
      if (newContractForm.contractType) {
          initialAttendance.__contract_type = newContractForm.contractType;
      }

      const newPatient = {
          id: patientId,
          name: newContractForm.name,
          appliance_type: newContractForm.applianceType,
          start_date: newContractForm.startDate,
          estimated_duration: newContractForm.estimatedDuration,
          status: 'Active',
          maintenance_value: parseFloat(newContractForm.maintenanceValue),
          attendance: initialAttendance
      };

      const { error } = await supabase.from('ortho_patients').insert(newPatient);
      if (!error) await loadData();

      setIsNewContractModalOpen(false);
      setNewContractForm({
          name: '',
          applianceType: '',
          contractType: '',
          startDate: new Date().toISOString().split('T')[0],
          maintenanceValue: '',
          estimatedDuration: 24
      });
  };

  const handleUpdateContractType = async (patientId: string, value: 'Digital' | 'Papel' | '') => {
      const patient = patients.find(p => p.id === patientId);
      if (!patient) return;

      const updatedAttendance = { ...patient.attendance, __contract_type: value || null };
      
      // Optimistic update
      setPatients(prev => prev.map(p => p.id === patientId ? { 
          ...p, 
          contractType: value || undefined,
          attendance: updatedAttendance
      } : p));

      try {
          const { error } = await supabase
              .from('ortho_patients')
              .update({ attendance: updatedAttendance })
              .eq('id', patientId);
              
          if (error) {
              console.error("Error updating contract type", error);
              toast.error("Erro ao salvar tipo de contrato: " + error.message);
              await loadData(); // rollback
          }
      } catch (err) {
          console.error("Error updating contract type", err);
          await loadData();
      }
  };

  // --- PROBLEM NOTE ACTIONS ---
  const openNoteModal = (patient: OrthoPatient) => {
      setSelectedPatientForNote(patient);
      setNoteContent(patient.problemNote || '');
      setIsNoteModalOpen(true);
  };

  const handleSaveNote = async () => {
      if (!selectedPatientForNote) return;
      
      const { error } = await supabase.from('ortho_patients')
          .update({ problem_note: noteContent || null }) // Send null if empty to clear
          .eq('id', selectedPatientForNote.id);

      if (!error) {
          await loadData();
          setIsNoteModalOpen(false);
          setSelectedPatientForNote(null);
          setNoteContent('');
          toast.success('Nota salva com sucesso!');
      } else {
          toast.error('Erro ao salvar nota: ' + error.message);
      }
  };

  const handleResolveNote = async () => {
      setNoteContent(''); // UI clear
      if (!selectedPatientForNote) return;
      const { error } = await supabase.from('ortho_patients')
          .update({ problem_note: null })
          .eq('id', selectedPatientForNote.id);
      
      if (!error) await loadData();
      setIsNoteModalOpen(false);
  };

  // --- SETTINGS ACTIONS ---

  const handleCreateAppliance = async () => {
      if(!newApplianceName) return;
      const newApp = {
          id: 'app_' + Date.now().toString(),
          name: newApplianceName,
          default_cost: 0
      };
      const { error } = await supabase.from('ortho_appliances').insert(newApp);
      if (!error) await loadData();
      setNewApplianceName('');
  };

  const handleEditAppliance = async (id: string, newName: string) => {
        const { error } = await supabase.from('ortho_appliances').update({ name: newName }).eq('id', id);
        if (!error) await loadData();
        setEditingApplianceId(null);
  };

  const handleAddFinishReason = async () => {
      if (!newFinishReason) return;
      const newReason = {
          id: 'reason_' + Date.now().toString(),
          name: newFinishReason
      };
      const { error } = await supabase.from('ortho_finish_reasons').insert(newReason);
      if (!error) await loadData();
      else console.error(error); 
      setNewFinishReason('');
  };

  const handleDeleteFinishReason = async (id: string) => {
      if (!confirm('Remover este motivo?')) return;
      const { error } = await supabase.from('ortho_finish_reasons').delete().eq('id', id);
      if (!error) await loadData();
  };

  const toggleAttendance = async (patientId: string, monthIndex: number) => {
      const monthKey = `${currentYear}-${String(monthIndex + 1).padStart(2, '0')}`;
      const patient = patients.find(p => p.id === patientId);
      if (!patient) return;

      const currentStatus = patient.attendance[monthKey] || 'None';
      
      // Status cycle: None -> Scheduled -> Present -> Absent -> None
      if (currentStatus === 'None') {
          const updatedAttendance = { ...patient.attendance, [monthKey]: 'Scheduled' };
          const { error } = await supabase.from('ortho_patients').update({ attendance: updatedAttendance }).eq('id', patientId);
          if (!error) setPatients(patients.map(p => p.id === patientId ? { ...p, attendance: updatedAttendance } : p));
      } else if (currentStatus === 'Scheduled') {
          // Trigger calendar to make date selection mandatory
          setGridEditingInfo({ patientId, monthIndex });
      } else if (currentStatus === 'Present') {
          const updatedAttendance = { ...patient.attendance, [monthKey]: 'Absent' };
          const { error } = await supabase.from('ortho_patients').update({ attendance: updatedAttendance }).eq('id', patientId);
          if (!error) setPatients(patients.map(p => p.id === patientId ? { ...p, attendance: updatedAttendance } : p));
      } else if (currentStatus === 'Absent') {
          // Cycle back to None to allow clearing
          const updatedAttendance = { ...patient.attendance };
          delete updatedAttendance[monthKey];
          
          // Also clear any daily records for this month to be clean
          const totalDays = new Date(parseInt(currentYear), monthIndex + 1, 0).getDate();
          for (let d = 1; d <= totalDays; d++) {
              const dateKey = `${currentYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
              delete updatedAttendance[dateKey];
          }

          const { error } = await supabase.from('ortho_patients').update({ attendance: updatedAttendance }).eq('id', patientId);
          if (!error) setPatients(patients.map(p => p.id === patientId ? { ...p, attendance: updatedAttendance } : p));
      }
  };

  const toggleDailyAttendance = async (patientId: string, date: Date) => {
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const patient = patients.find(p => p.id === patientId);
      if (!patient) return;

      const currentDayStatus = patient.attendance[dateKey] || 'None';
      let nextDayStatus: 'Present' | 'Absent' | 'Scheduled' | 'None' = 'None';

      if (currentDayStatus === 'None') nextDayStatus = 'Present';
      else if (currentDayStatus === 'Present') nextDayStatus = 'Absent';
      else if (currentDayStatus === 'Absent') nextDayStatus = 'None';

      const updatedAttendance = { ...patient.attendance, [dateKey]: nextDayStatus };
      
      // Sync month status: if any day is marked Present, the month is Present
      if (nextDayStatus === 'Present') {
          updatedAttendance[monthKey] = 'Present';
      } else {
          // If we unchecked a day, check if there are any other presence days in this month
          const monthPrefix = `${monthKey}-`;
          const hasOtherPresence = Object.keys(updatedAttendance).some(key => 
              key.startsWith(monthPrefix) && key.length > 7 && updatedAttendance[key] === 'Present'
          );
          if (!hasOtherPresence) {
              // Optionally keep as Scheduled if it was scheduled before, 
              // but for simplicity, we'll keep the month status as it is or let the user toggle in the grid
          }
      }
      
      const { error } = await supabase.from('ortho_patients').update({ attendance: updatedAttendance }).eq('id', patientId);
      if (!error) {
          // Optimistic update
          setPatients(patients.map(p => p.id === patientId ? { ...p, attendance: updatedAttendance } : p));
      }
  };

  const calculateDuration = (startDate: string, endDate?: string) => {
      if (!startDate) return '-';
      const start = new Date(startDate);
      const end = endDate ? new Date(endDate) : new Date();
      
      if (isNaN(start.getTime())) return startDate;
      if (isNaN(end.getTime())) return '-';

      // Normalize time to avoid issues
      start.setHours(0,0,0,0);
      end.setHours(0,0,0,0);

      let totalMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
      
      // If the day of end date is less than day of start date, full month hasn't passed
      if (end.getDate() < start.getDate()) {
          totalMonths--;
      }

      const years = Math.floor(totalMonths / 12);
      const months = totalMonths % 12;

      // Calculate the date after full months
      const tempDate = new Date(start);
      tempDate.setMonth(tempDate.getMonth() + totalMonths);
      
      // Calculate remaining days
      const diffTime = Math.abs(end.getTime() - tempDate.getTime());
      const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

      const parts = [];
      if (years > 0) parts.push(`${years}a`);
      if (months > 0) parts.push(`${months}m`);
      if (days > 0) parts.push(`${days}d`);

      return parts.length > 0 ? parts.join(' ') : '0d';
  };

  const { 
    activeCount, 
    estimatedRevenue, 
    applianceDistribution, 
    valueDistribution, 
    attendanceRate, 
    startedInMonth, 
    startedNames, 
    finishedInMonth, 
    finishedNames, 
    problemPatients,
    consecutiveAbsentPatients
  } = useMemo(() => {
      const targetMonthKey = `${currentYear}-${selectedMonth.padStart(2, '0')}`;
      
      const activePatients = patients.filter(p => {
          if (!p.startDate) return false;
          const startMonth = p.startDate.substring(0, 7);
          
          // Se iniciou depois do mês selecionado, não estava ativo
          if (startMonth > targetMonthKey) return false;
          
          // Se está ativo atualmente, conta
          if (p.status === 'Active') return true;
          
          // Se foi finalizado/suspenso, verifica a data de fim
          if (p.endDate) {
              const endMonth = p.endDate.substring(0, 7);
              // Conta como ativo se a data de fim for no mês selecionado ou depois
              return endMonth >= targetMonthKey;
          }
          
          return false;
      });
      
      const count = activePatients.length;
      const revenue = activePatients.reduce((acc, t) => acc + (t.maintenanceValue || 0), 0);

      const startedInMonthPatients = patients.filter(p => p.startDate.startsWith(targetMonthKey));
      const startedInMonth = startedInMonthPatients.length;
      const startedNames = startedInMonthPatients.map(p => p.name);

      const finishedInMonthPatients = patients.filter(p => p.endDate && p.endDate.startsWith(targetMonthKey) && p.status === 'Finished');
      const finishedInMonth = finishedInMonthPatients.length;
      const finishedNames = finishedInMonthPatients.map(p => p.name);

      const problemPatients = activePatients.filter(p => p.problemNote && p.problemNote.trim() !== '');

      const consecutiveAbsentPatients: any[] = [];
      
      const appDistMap: Record<string, number> = {};
      activePatients.forEach(p => {
          appDistMap[p.applianceType] = (appDistMap[p.applianceType] || 0) + 1;
      });
      const appDist = Object.keys(appDistMap).map(key => ({ name: key, value: appDistMap[key] }));

      const valDistMap: Record<string, number> = {};
      activePatients.forEach(p => {
          const val = p.maintenanceValue || 0;
          const key = val.toFixed(2);
          valDistMap[key] = (valDistMap[key] || 0) + 1;
      });
      
      const valDist = Object.entries(valDistMap)
        .map(([valStr, count]) => ({
            name: `R$ ${parseFloat(valStr).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            value: count,
            rawValue: parseFloat(valStr) 
        }))
        .sort((a, b) => a.rawValue - b.rawValue); 

      let present = 0;
      activePatients.forEach(p => {
          const status = p.attendance[targetMonthKey];
          if (status === 'Present') present++;
      });
      // A taxa de presença leva em conta todos os pacientes ativos cadastrados.
      // Quem estiver como agendado, falta ou None é contabilizado como se não tivesse vindo.
      const rate = count > 0 ? (present / count) * 100 : 0;

      return { activeCount: count, estimatedRevenue: revenue, applianceDistribution: appDist, valueDistribution: valDist, attendanceRate: rate, startedInMonth, startedNames, finishedInMonth, finishedNames, problemPatients, consecutiveAbsentPatients };
  }, [patients, selectedMonth, currentYear]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-surface border border-[#334155] p-3 text-xs text-[#f8fafc] rounded-xl shadow-2xl min-w-[200px] max-w-[300px]">
          <div className="flex justify-between items-center mb-2 border-b border-border pb-1">
            <span className="font-bold text-sm text-purple-400">Dia {data.day}</span>
          </div>
          <div className="space-y-1 mb-2">
            <div className="flex justify-between">
              <span className="text-slate-400 font-bold uppercase text-[9px]">Acumulado:</span>
              <span className="font-mono text-emerald-400">{data.atual}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-bold uppercase text-[9px]">Meta:</span>
              <span className="font-mono text-slate-300">{data.meta}</span>
            </div>
            {/* Tendencia removed */}
          </div>

          {((data.presentNames && data.presentNames.length > 0) || 
             (data.absentNames && data.absentNames.length > 0) || 
             (data.scheduledNames && data.scheduledNames.length > 0)) && (
            <div className="mt-2 pt-2 border-t border-border space-y-3">
              {data.presentNames && data.presentNames.length > 0 && (
                <div>
                  <span className="text-emerald-400 font-bold uppercase text-[9px] block mb-1">Presentes ({data.presentNames.length}):</span>
                  <div className="max-h-[80px] overflow-y-auto scrollbar-hide">
                    <ul className="grid grid-cols-1 gap-0.5">
                      {data.presentNames.map((name: string, idx: number) => (
                        <li key={idx} className="text-[10px] text-slate-200 truncate flex items-center gap-1">
                          <span className="size-1 rounded-full bg-emerald-500"></span>
                          {name}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {data.absentNames && data.absentNames.length > 0 && (
                <div>
                  <span className="text-red-400 font-bold uppercase text-[9px] block mb-1">Faltas ({data.absentNames.length}):</span>
                  <div className="max-h-[80px] overflow-y-auto scrollbar-hide">
                    <ul className="grid grid-cols-1 gap-0.5">
                      {data.absentNames.map((name: string, idx: number) => (
                        <li key={idx} className="text-[10px] text-slate-200 truncate flex items-center gap-1">
                          <span className="size-1 rounded-full bg-red-500"></span>
                          {name}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {data.scheduledNames && data.scheduledNames.length > 0 && (
                <div>
                  <span className="text-amber-400 font-bold uppercase text-[9px] block mb-1">Agendados ({data.scheduledNames.length}):</span>
                  <div className="max-h-[80px] overflow-y-auto scrollbar-hide">
                    <ul className="grid grid-cols-1 gap-0.5">
                      {data.scheduledNames.map((name: string, idx: number) => (
                        <li key={idx} className="text-[10px] text-slate-200 truncate flex items-center gap-1">
                          <span className="size-1 rounded-full bg-amber-500"></span>
                          {name}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          {data.note && (
            <div className="mt-2 pt-2 border-t border-border">
              <span className="text-blue-400 font-bold uppercase text-[9px] block mb-1">Observação:</span>
              <p className="text-[10px] text-blue-200 italic leading-relaxed">{data.note}</p>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const orthoPacing = useMemo(() => {
      const monthIndex = parseInt(selectedMonth) - 1;
      const targetMonthKey = `${currentYear}-${selectedMonth.padStart(2, '0')}`;
      
      // Calculate total ortho days in the whole month for the trajectory calculation
      const totalDaysInMonth = new Date(parseInt(currentYear), monthIndex + 1, 0).getDate();
      let totalOrthoDaysInMonth = 0;
      const orthoDayStatus: boolean[] = [];
      for (let d = 1; d <= totalDaysInMonth; d++) {
          const dateObj = new Date(parseInt(currentYear), monthIndex, d);
          const isOrtho = isOrthoDay(dateObj);
          if (isOrtho) totalOrthoDaysInMonth++;
          orthoDayStatus[d] = isOrtho;
      }

      // Calculate total presences from monthly grid as a baseline
      const monthlyPresentPatients = patients.filter(p => p.attendance[targetMonthKey] === 'Present');

      // Calculate active patients for this month
      const activePatientsCount = patients.filter(p => {
          if (!p.startDate) return false;
          const startMonth = p.startDate.substring(0, 7);
          if (startMonth > targetMonthKey) return false;
          if (p.status === 'Active') return true;
          if (p.endDate) {
              const endMonth = p.endDate.substring(0, 7);
              return endMonth >= targetMonthKey;
          }
          return false;
      }).length;

      // Trajectory per ortho day
      const trajectoryIncrement = totalOrthoDaysInMonth > 0 ? activePatientsCount / totalOrthoDaysInMonth : 0;
      
      const chartData = [];
      let cumulativeMeta = 0;
      let cumulativeActual = 0;
      let lastDayWithData = 0;
      
      // Track which patients are already counted in daily records
      const patientsCountedInDaily = new Set<string>();
      const patientsAlreadySeen = new Set<string>();

      // First pass: calculate actuals and meta
      for (let d = 1; d <= totalDaysInMonth; d++) {
          if (orthoDayStatus[d]) {
              cumulativeMeta += trajectoryIncrement;
          }

          let dayActual = 0;
          const presentNames: string[] = [];
          const absentNames: string[] = [];
          const scheduledNames: string[] = [];
          const dateKey = `${currentYear}-${String(selectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          
          let hasAnyAttendanceRecord = false;
          patients.forEach(p => {
             const status = p.attendance[dateKey];
             if (status) {
                hasAnyAttendanceRecord = true;
                if (status === 'Present') {
                    if (!patientsAlreadySeen.has(p.id)) {
                        dayActual++;
                        patientsAlreadySeen.add(p.id);
                    }
                    presentNames.push(p.name);
                    patientsCountedInDaily.add(p.id);
                } else if (status === 'Absent') {
                    absentNames.push(p.name);
                } else if (status === 'Scheduled') {
                    scheduledNames.push(p.name);
                }
             }
          });
          
          // If we have records, update cumulative and lastDay
          if (hasAnyAttendanceRecord) {
              cumulativeActual += dayActual;
              lastDayWithData = d;
          }
          
          chartData.push({
              day: d,
              meta: Number(cumulativeMeta.toFixed(2)),
              atual: cumulativeActual,
              presentNames,
              absentNames,
              scheduledNames,
              note: dayNotes[`${currentYear}-${String(selectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`] || null
          });
      }

      // Add "undated" presences from the monthly grid to the total
      // This happens when a user marks "Present" in the grid but doesn't pick a day in the calendar
      const undatedPresences = monthlyPresentPatients.filter(p => !patientsCountedInDaily.has(p.id));
      if (undatedPresences.length > 0) {
          const adjustment = undatedPresences.length;
          cumulativeActual += adjustment;
          
          // Use the last day with data as a reference point, or the first day if no data exists
          const referenceDay = lastDayWithData > 0 ? lastDayWithData : 1;
          
          // Update chartData for the reference day onwards to include these undated presences
          for (let i = referenceDay - 1; i < chartData.length; i++) {
              chartData[i].atual += adjustment;
          }
          
          if (lastDayWithData === 0) lastDayWithData = referenceDay;
      }

      // Final pass: nullify future 'atual' values to stop line at lastDayWithData
      if (lastDayWithData > 0) {
          for (let i = lastDayWithData; i < chartData.length; i++) {
              // Only nullify if we're in the future of the current month
              // or if we just want the line to stop at the last point of data
              chartData[i].atual = null;
          }
      }

      const goalReached = lastDayWithData > 0 && cumulativeActual >= (chartData.find(d => d.day === lastDayWithData)?.meta || 0);

      return { chartData, goalReached, lastDayWithData, cumulativeActual };
  }, [currentYear, selectedMonth, patients, dayNotes]);

  const monthlyFlowData = useMemo(() => {
    return MONTHS.map((month, i) => {
        const monthKey = `${currentYear}-${String(i + 1).padStart(2, '0')}`;
        
        let started = 0;
        let finished = 0;
        
        patients.forEach(p => {
             if (p.startDate && p.startDate.startsWith(monthKey)) {
                  started++;
             }
             if (p.endDate && p.endDate.startsWith(monthKey) && p.status === 'Finished') {
                  finished++;
             }
        });

        const docInitialCount = docInitialTransactions.filter(tx => tx.date && tx.date.startsWith(monthKey)).length;
        
        return {
            month,
            Iniciou: started,
            Finalizou: finished,
            Documentacao: docInitialCount
        };
    });
  }, [patients, currentYear, docInitialTransactions]);

  // --- RENDERERS ---
  const renderOverview = () => (
      <div className="flex flex-col gap-6 animate-in fade-in duration-500">
          {/* Header & Filter */}
          <div className="flex justify-between items-center bg-surface p-4 rounded-xl border border-border">
              <h3 className="text-text font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-purple-400">monitoring</span>
                  Indicadores de Desempenho
              </h3>
              <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 uppercase">Filtrar Período:</span>
                  <div className="flex gap-2">
                      <select 
                        value={currentYear} 
                        onChange={(e) => setCurrentYear(e.target.value)}
                        className="bg-panel border border-border rounded-lg text-sm text-text px-3 py-1.5 outline-none focus:border-purple-500 font-bold"
                      >
                          <option value="2025">2025</option>
                          <option value="2026">2026</option>
                      </select>
                      <select 
                        value={selectedMonth} 
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="bg-panel border border-border rounded-lg text-sm text-text px-3 py-1.5 outline-none focus:border-purple-500 font-bold"
                      >
                          {MONTHS.map((m, i) => <option key={i} value={String(i+1)}>{m}</option>)}
                      </select>
                  </div>
              </div>
          </div>

          {/* PROBLEM ALERTS INDICATOR */}
          {problemPatients.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center justify-between animate-in slide-in-from-top-2">
                  <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-500 rounded-full text-text shadow-lg shadow-red-500/20">
                          <span className="material-symbols-outlined text-xl">warning</span>
                      </div>
                      <div>
                          <h4 className="text-text font-bold text-sm">Existem Pendências Clínicas</h4>
                          <p className="text-red-300 text-xs">{problemPatients.length} pacientes precisam de atenção</p>
                      </div>
                  </div>
                  <button onClick={() => setActiveSubTab('patients')} className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-bold rounded-lg transition-colors">
                      Ver Pacientes
                  </button>
              </div>
          )}

          {consecutiveAbsentPatients.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex flex-col gap-2 animate-in slide-in-from-top-2">
                  <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-500 rounded-full text-text shadow-lg shadow-amber-500/20">
                          <span className="material-symbols-outlined text-xl">person_remove</span>
                      </div>
                      <div className="flex-1">
                          <h4 className="text-text font-bold text-sm">Aviso de Exclusão por Faltas</h4>
                          <p className="text-amber-300 text-xs mt-1">
                              {consecutiveAbsentPatients.length === 1 ? 'O paciente abaixo teve 3 faltas consecutivas e será removido do quadro de pacientes no final do mês.' : `Os ${consecutiveAbsentPatients.length} pacientes abaixo tiveram 3 faltas consecutivas e serão removidos do quadro de pacientes no final do mês.`}
                          </p>
                      </div>
                      <button onClick={() => setActiveSubTab('patients')} className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold rounded-lg transition-colors">
                          Acessar Cadastro
                      </button>
                  </div>
                  <div className="mt-2 text-xs font-medium text-amber-200 bg-amber-500/10 p-2 rounded-lg break-words">
                      <span className="font-bold">Pacientes: </span>
                      {consecutiveAbsentPatients.map((p: any) => p.name).join(', ')}
                  </div>
              </div>
          )}

          {/* Top KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Active Total */}
              <SpotlightCard className="glass-panel rounded-2xl p-6 relative overflow-hidden group" spotlightColor="rgba(168, 85, 247, 0.4)">
                  <div className="absolute right-0 top-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                      <span className="material-symbols-outlined text-6xl text-purple-500">groups</span>
                  </div>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Pacientes Ativos (Total)</p>
                  <div className="flex items-end gap-2">
                      <span className="text-3xl font-display font-bold text-text">{activeCount}</span>
                  </div>
              </SpotlightCard>

              {/* Started In Month */}
              <SpotlightCard className="glass-panel rounded-2xl p-6 relative overflow-hidden group border-l-4 border-l-emerald-500 flex flex-col min-h-[240px]" spotlightColor="rgba(16, 185, 129, 0.4)">
                  <div className="absolute right-0 top-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                      <span className="material-symbols-outlined text-6xl text-emerald-500">person_add</span>
                  </div>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Iniciados em {MONTHS[parseInt(selectedMonth)-1]}</p>
                  <div className="flex items-end gap-2 mb-2">
                      <span className="text-3xl font-display font-bold text-emerald-400">+{startedInMonth}</span>
                  </div>
                  <div className="flex-1 mt-4 overflow-y-auto pr-1 custom-scrollbar max-h-[110px]">
                    <div className="flex flex-col gap-2">
                      {startedNames.map((name, i) => (
                          <div key={i} className="text-[11px] text-slate-400 truncate hover:text-emerald-400 transition-colors">• {name}</div>
                      ))}
                    </div>
                  </div>
              </SpotlightCard>

              {/* Finished In Month */}
              <SpotlightCard className="glass-panel rounded-2xl p-6 relative overflow-hidden group border-l-4 border-l-blue-500 flex flex-col min-h-[240px]" spotlightColor="rgba(59, 130, 246, 0.4)">
                  <div className="absolute right-0 top-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                      <span className="material-symbols-outlined text-6xl text-blue-500">flag</span>
                  </div>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Finalizados em {MONTHS[parseInt(selectedMonth)-1]}</p>
                  <div className="flex items-end gap-2 mb-2">
                      <span className="text-3xl font-display font-bold text-blue-400">{finishedInMonth}</span>
                  </div>
                  <div className="flex-1 mt-4 overflow-y-auto pr-1 custom-scrollbar max-h-[110px]">
                    <div className="flex flex-col gap-2">
                      {finishedNames.map((name, i) => (
                          <div key={i} className="text-[11px] text-slate-400 truncate hover:text-blue-400 transition-colors">• {name}</div>
                      ))}
                    </div>
                  </div>
              </SpotlightCard>

              {/* Attendance */}
              <SpotlightCard className="glass-panel rounded-2xl p-4 relative overflow-hidden group flex items-center justify-between" spotlightColor="rgba(139, 92, 246, 0.4)">
                  <div>
                      <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Taxa de Presença</p>
                      <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-display font-bold text-text">{attendanceRate.toFixed(0)}%</span>
                          <span className={`text-[10px] font-black uppercase ${
                              attendanceRate < 85 ? 'text-red-500' : 
                              attendanceRate <= 90 ? 'text-amber-500' : 
                              'text-emerald-500'
                          }`}>
                              {attendanceRate < 85 ? 'Ruim' : attendanceRate <= 90 ? 'Bom' : 'Excelente'}
                          </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">No mês selecionado</p>
                  </div>
                  <div className="relative size-14">
                      <svg className="size-full transform -rotate-90">
                          <circle cx="28" cy="28" r="24" stroke="#1e293b" strokeWidth="4" fill="transparent" />
                          <circle 
                            cx="28" 
                            cy="28" 
                            r="24" 
                            stroke={attendanceRate < 85 ? '#ef4444' : attendanceRate <= 90 ? '#f59e0b' : '#10b981'} 
                            strokeWidth="4" 
                            fill="transparent" 
                            strokeDasharray="150.7" 
                            strokeDashoffset={150.7 - (150.7 * attendanceRate) / 100} 
                            strokeLinecap="round" 
                          />
                      </svg>
                  </div>
              </SpotlightCard>

              {/* Ortho Pacing */}
              {(() => {
                const hasData = orthoPacing.chartData && orthoPacing.chartData.length > 0 && orthoPacing.chartData.some(d => d.atual > 0);

                if (!hasData) {
                    return (
                        <SpotlightCard className="glass-panel rounded-2xl p-6 relative overflow-hidden group col-span-2" spotlightColor="rgba(59, 130, 246, 0.4)">
                            <div className="flex flex-col items-center justify-center h-full text-slate-500 py-12">
                                <BarChart3 className="w-12 h-12 mb-4 opacity-40" />
                                <h4 className="text-text font-bold text-sm">Sem dados de presença</h4>
                                <p className="text-[11px] text-slate-400 mt-2 text-center max-w-xs">
                                    Ainda não há dados de presença registrados neste mês. Marque pacientes na grade de presença para visualizar o pacing.
                                </p>
                            </div>
                        </SpotlightCard>
                    );
                }

                const isOnPacing = orthoPacing.goalReached;
                const currentActual = orthoPacing.cumulativeActual;
                const currentMeta = orthoPacing.chartData.find(d => d.day === orthoPacing.lastDayWithData)?.meta || 0;
                
                // Calculate days remaining
                const totalDaysInMonth = new Date(parseInt(currentYear), parseInt(selectedMonth), 0).getDate();
                let orthoDaysTotal = 0;
                let orthoDaysPassed = 0;
                const today = new Date();
                const isCurrentMonth = today.getFullYear() === parseInt(currentYear) && (today.getMonth() + 1) === parseInt(selectedMonth);
                
                for (let d = 1; d <= totalDaysInMonth; d++) {
                    const dateObj = new Date(parseInt(currentYear), parseInt(selectedMonth) - 1, d);
                    if (isOrthoDay(dateObj)) {
                        orthoDaysTotal++;
                        if (isCurrentMonth && d < today.getDate()) orthoDaysPassed++;
                        else if (!isCurrentMonth && d <= totalDaysInMonth) { /* handled */ }
                    }
                }
                const daysRemaining = Math.max(0, orthoDaysTotal - orthoDaysPassed);

                return (
                  <SpotlightCard className="glass-panel rounded-2xl p-6 relative overflow-hidden group col-span-2" spotlightColor="rgba(59, 130, 246, 0.4)">
                      <div className="flex flex-col mb-6">
                          <div className="flex justify-between items-center mb-6">
                              <h4 className="text-text font-bold text-sm">Pacing de Presença Ortodontia</h4>
                              <div className={`px-2 py-1 rounded text-[10px] font-bold ${isOnPacing ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                  {isOnPacing ? 'Meta Atingida' : 'Abaixo da Meta'}
                              </div>
                          </div>
                          
                          {/* Summary KPIs */}
                          <div className="grid grid-cols-3 gap-4 mb-6">
                              <div className="bg-panel p-4 rounded-xl border border-border">
                                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Presenças</p>
                                  <p className="text-xl font-bold text-text mt-1">{currentActual}</p>
                              </div>
                              <div className="bg-panel p-4 rounded-xl border border-border">
                                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Meta Atual</p>
                                  <p className="text-xl font-bold text-text mt-1">{Math.round(currentMeta)}</p>
                              </div>
                              <div className="bg-panel p-4 rounded-xl border border-border">
                                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Dias Restantes</p>
                                  <p className="text-xl font-bold text-text mt-1">{daysRemaining}</p>
                              </div>
                          </div>

                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            O gráfico mostra a evolução da presença real (linha verde) contra a meta linear (tracejada). Se a linha verde estiver acima, estamos no pacing correto.
                          </p>
                      </div>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={orthoPacing.chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                            <XAxis dataKey="day" stroke="#94a3b8" fontSize={10} />
                            <YAxis stroke="#94a3b8" fontSize={10} />
                            <RechartsTooltip 
                              content={<CustomTooltip />}
                            />
                            <Legend verticalAlign="top" height={36} iconType="plainline" formatter={(value) => <span className="text-xs text-slate-400 font-bold uppercase">{value}</span>} />
                            <Line type="monotone" dataKey="meta" stroke="#94a3b8" strokeDasharray="5 5" name="Trajetória Padrão Linear" strokeWidth={2} dot={false} isAnimationActive={true} animationDuration={800} />
                            <Line type="monotone" dataKey="atual" stroke="#10b981" name="Acumulado Realizado" strokeWidth={3} dot={false} isAnimationActive={true} animationDuration={800} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      
                      <div className="mt-4 p-4 bg-slate-800 rounded-lg border border-slate-700">
                        <h4 className="text-text font-bold text-sm mb-3">Adicionar Observação</h4>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                placeholder="Data (AAAA-MM-DD)" 
                                value={selectedNoteDay}
                                onChange={(e) => setSelectedNoteDay(e.target.value)}
                                className="bg-slate-900 text-text p-2 rounded text-xs w-32 border border-slate-700"
                            />
                            <input 
                                type="text" 
                                placeholder="Nota..." 
                                value={noteText}
                                onChange={(e) => setNoteText(e.target.value)}
                                className="bg-slate-900 text-text p-2 rounded text-xs flex-grow border border-slate-700"
                            />
                            <button 
                                onClick={() => {
                                    if (selectedNoteDay && noteText) {
                                        setDayNotes(prev => ({...prev, [selectedNoteDay]: noteText}));
                                        setNoteText('');
                                        setSelectedNoteDay('');
                                    }
                                }}
                                className="bg-blue-600 text-text p-2 rounded text-xs hover:bg-blue-500"
                            >Adicionar</button>
                        </div>
                      </div>

                  </SpotlightCard>
                );
              })()}

              </div>
          
        {/* Espaçamento mantido */}
        <div className="mt-6" />

          <SpotlightCard className="glass-panel rounded-2xl p-6 border border-border" spotlightColor="rgba(255, 255, 255, 0.1)">
              <div className="flex flex-col h-full w-full">
                  <h3 className="text-lg font-bold text-text mb-4">Evolução do Tratamento ({currentYear})</h3>
                  <div className="h-[350px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={monthlyFlowData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                              <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                              <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} />
                              <RechartsTooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px' }} itemStyle={{ color: '#fff' }} />
                              <Legend verticalAlign="top" height={36} iconType="circle" formatter={(value) => <span className="text-xs text-slate-400 font-bold uppercase">{value}</span>} />
                              <Bar dataKey="Iniciou" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                              <Bar dataKey="Finalizou" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                              <Bar dataKey="Documentacao" fill="#a855f7" radius={[4, 4, 0, 0]} maxBarSize={40} name="Doc. Inicial" />
                          </BarChart>
                      </ResponsiveContainer>
                  </div>
              </div>
          </SpotlightCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Distribution Chart */}
              <SpotlightCard className="glass-panel rounded-2xl p-6 border border-border min-h-[350px]" spotlightColor="rgba(255, 255, 255, 0.1)">
                  <div className="flex flex-col h-full w-full">
                      <h3 className="text-lg font-bold text-text mb-4">Pacientes Ativos por Aparelho</h3>
                      <div className="flex-1 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                              <Pie
                                  data={applianceDistribution}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={60}
                                  outerRadius={100}
                                  paddingAngle={5}
                                  cornerRadius={8} // Bordas arredondadas (UI Style)
                                  dataKey="value"
                                  stroke="none" // Remove contorno para visual mais limpo
                                  onMouseEnter={(_, index) => setActiveApplianceIndex(index)}
                                  onMouseLeave={() => setActiveApplianceIndex(null)}
                              >
                                  {applianceDistribution.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                                  <Label 
                                    position="center"
                                    content={({ viewBox }: any) => {
                                        const cx = viewBox?.cx || 0;
                                        const cy = viewBox?.cy || 0;
                                        if (activeApplianceIndex === null || !applianceDistribution[activeApplianceIndex]) return null;
                                        const entry = applianceDistribution[activeApplianceIndex];
                                        return (
                                            <g>
                                                <text x={cx} y={cy - 8} textAnchor="middle" dominantBaseline="middle" className="fill-white font-bold text-3xl font-display">
                                                    {entry.value}
                                                </text>
                                                <text x={cx} y={cy + 22} textAnchor="middle" dominantBaseline="middle" className="fill-slate-400 text-[10px] font-bold uppercase tracking-widest">
                                                    {entry.name}
                                                </text>
                                            </g>
                                        );
                                    }}
                                  />
                              </Pie>
                              {/* RechartsTooltip removed as requested */}
                              <Legend verticalAlign="bottom" height={36} iconType="circle" formatter={(value) => <span className="text-xs text-slate-400 font-bold uppercase ml-1">{value}</span>} />
                          </PieChart>
                      </ResponsiveContainer>
                  </div>
                  </div>
              </SpotlightCard>

              {/* Maintenance Value Chart */}
              <SpotlightCard className="glass-panel rounded-2xl p-6 border border-border min-h-[350px]" spotlightColor="rgba(255, 255, 255, 0.1)">
                  <div className="flex flex-col h-full w-full">
                      <div className="flex justify-between items-start mb-4">
                          <h3 className="text-lg font-bold text-text">Distribuição Financeira</h3>
                      <div className="text-right">
                          <p className="text-[10px] text-slate-400 uppercase font-bold">Receita Estimada (Ativos)</p>
                          <p className="text-xl font-bold text-emerald-400">R$ {estimatedRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </div>
                  </div>
                  <div className="flex-1 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={valueDistribution} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                              <XAxis 
                                dataKey="name" 
                                stroke="#94a3b8" 
                                fontSize={10} 
                                tick={{ fill: '#94a3b8' }}
                                tickMargin={10}
                              />
                              <YAxis 
                                stroke="#94a3b8" 
                                fontSize={10} 
                                tick={{ fill: '#94a3b8' }}
                                allowDecimals={false}
                              />
                              <RechartsTooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)' }} />
                              <Bar dataKey="value" name="Pacientes" fill="#d946ef" radius={[4, 4, 0, 0]}>
                                  {valueDistribution.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                                  <LabelList dataKey="value" position="top" fill="#94a3b8" fontSize={10} offset={10} />
                              </Bar>
                          </BarChart>
                      </ResponsiveContainer>
                  </div>
                  </div>
              </SpotlightCard>
          </div>
      </div>
  );

  const renderPatients = () => (
      <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Filters */}
          <div className="flex flex-wrap gap-4 items-center bg-surface p-4 rounded-xl border border-border">
              <input 
                type="text" 
                placeholder="Buscar paciente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-panel border border-border rounded-lg text-sm text-text px-4 py-2 outline-none focus:border-purple-500"
              />
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-panel border border-border rounded-lg text-sm text-text px-3 py-2 outline-none focus:border-purple-500"
              >
                  <option value="All">Todos Status</option>
                  <option value="Active">Ativo</option>
                  <option value="Finished">Finalizado</option>
                  <option value="Suspended">Suspenso</option>
              </select>
              <select 
                value={feeFilter === 'All' ? 'All' : feeFilter}
                onChange={(e) => setFeeFilter(e.target.value === 'All' ? 'All' : Number(e.target.value))}
                className="bg-panel border border-border rounded-lg text-sm text-text px-3 py-2 outline-none focus:border-purple-500"
              >
                  <option value="All">Todas Mensalidades</option>
                  {Array.from(new Set(patients.map(p => p.maintenanceValue))).sort((a,b)=>a-b).map(fee => (
                      <option key={fee} value={fee}>R$ {fee.toFixed(2)}</option>
                  ))}
              </select>
          </div>

          {/* PROBLEM ALERTS SECTION */}
          {problemPatients.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-red-500 rounded-full text-text shadow-lg shadow-red-500/20">
                          <span className="material-symbols-outlined text-xl">warning</span>
                      </div>
                      <div>
                          <h4 className="text-text font-bold text-lg">Alertas e Pendências Clínicas</h4>
                          <p className="text-red-300 text-xs">{problemPatients.length} pacientes precisam de atenção</p>
                      </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {problemPatients.map(p => (
                          <div key={p.id} className="bg-panel p-3 rounded-xl border border-red-500/30 flex flex-col gap-2">
                              <div className="flex justify-between items-start">
                                  <span className="text-text font-bold text-sm truncate">{p.name}</span>
                                  <button onClick={() => openNoteModal(p)} className="text-xs text-red-400 hover:text-text underline">Ver</button>
                              </div>
                              <p className="text-xs text-slate-300 line-clamp-2 bg-red-900/10 p-2 rounded italic">"{p.problemNote}"</p>
                          </div>
                      ))}
                  </div>
              </div>
          )}

          <div className="glass-panel rounded-2xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                  <thead>
                      <tr className="border-b border-border bg-panel text-gray-400 text-xs uppercase tracking-wider font-medium">
                          <th className="p-5 font-semibold">Paciente</th>
                          {selectedDate && <th className="p-5 font-semibold text-center">Presença ({selectedDate.toLocaleDateString()})</th>}
                          <th className="p-5 font-semibold">Aparelho</th>
                          <th className="p-5 font-semibold">Contrato</th>
                          <th className="p-5 font-semibold">Início</th>
                          <th 
                            className="p-5 font-semibold cursor-pointer hover:text-text transition-colors group/sort"
                            onClick={() => toggleSort('duration')}
                          >
                            <div className="flex items-center gap-1">
                                Duração
                                <span className={`material-symbols-outlined text-sm transition-opacity ${sortConfig.key === 'duration' && sortConfig.direction !== 'none' ? 'opacity-100 text-purple-400' : 'opacity-0 group-hover/sort:opacity-50'}`}>
                                    {sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                                </span>
                            </div>
                          </th>
                          <th className="p-5 font-semibold text-right">Mensalidade</th>
                          <th className="p-5 font-semibold text-center">Status</th>
                          <th className="p-5 font-semibold text-right">Ação</th>
                      </tr>
                  </thead>
                  <tbody className="text-gray-300 text-sm divide-y divide-white/5">
                      {filteredPatients.map((p) => {
                          const hasProblem = p.problemNote && p.problemNote.trim().length > 0;
                          
                          return (
                            <tr 
                                key={p.id} 
                                className={`group transition-colors ${hasProblem ? 'bg-red-500/5 hover:bg-red-500/10 border-l-2 border-l-red-500' : 'hover:bg-panel border-l-2 border-l-transparent'}`}
                            >
                                <td className="p-5 font-bold text-text relative">
                                    {p.name}
                                    {hasProblem && (
                                        <span className="ml-2 inline-flex items-center justify-center bg-red-500 text-text text-[9px] px-1.5 rounded-full" title="Problema Relatado">!</span>
                                    )}
                                    {p.endDate && <div className="text-[10px] text-slate-500 font-normal">Fim: {p.endDate.split('-').reverse().join('/')}</div>}
                                </td>
                                {selectedDate && (
                                    <td className="p-5 text-center">
                                        <button 
                                            onClick={() => toggleDailyAttendance(p.id, selectedDate)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                                                (p.attendance[`${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`] || 'None') === 'Present' 
                                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                                                : 'bg-red-500/10 text-red-400 border border-red-500/30'
                                            }`}
                                        >
                                            {(p.attendance[`${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`] || 'None') === 'Present' ? 'Presente' : 'Ausente'}
                                        </button>
                                    </td>
                                )}
                                <td className="p-5 text-purple-400">{p.applianceType}</td>
                                <td className="p-5">
                                    <button 
                                        onClick={() => setEditingPatientId(p.id)}
                                        className="bg-blue-600 text-text px-3 py-1 rounded text-xs block mb-2 shadow-lg"
                                    >
                                        Marcar Presença
                                    </button>
                                    <select
                                        value={p.contractType || ''}
                                        onChange={(e) => handleUpdateContractType(p.id, e.target.value as 'Digital' | 'Papel' | '')}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border outline-none cursor-pointer transition-all bg-surface hover:bg-surface ${
                                            p.contractType === 'Papel'
                                            ? 'text-amber-400 border-amber-500/30 font-bold focus:border-amber-500'
                                            : p.contractType === 'Digital'
                                            ? 'text-blue-400 border-blue-500/30 font-bold focus:border-blue-500'
                                            : 'text-slate-400 border-border font-medium focus:border-purple-500'
                                        }`}
                                    >
                                        <option value="" className="bg-surface text-slate-500">Vazio</option>
                                        <option value="Digital" className="bg-surface text-blue-400 font-bold">Digital</option>
                                        <option value="Papel" className="bg-surface text-amber-400 font-bold">Papel</option>
                                    </select>
                                </td>
                                <td className="p-5 text-slate-400 text-xs">{p.startDate ? p.startDate.split('-').reverse().join('/') : '-'}</td>
                                <td className="p-5 text-slate-300 text-xs font-mono">
                                    {calculateDuration(p.startDate, p.endDate)}
                                </td>
                                <td className="p-5 text-right font-mono text-text">R$ {(p.maintenanceValue || 0).toFixed(2)}</td>
                                <td className="p-5 text-center">
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${
                                        p.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                                        p.status === 'Finished' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                                        'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                    }`}>
                                        {p.status === 'Active' ? 'Ativo' : p.status === 'Finished' ? 'Finalizado' : 'Suspenso'}
                                    </span>
                                </td>
                                <td className="p-5 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button 
                                            onClick={() => openNoteModal(p)}
                                            className={`size-8 flex items-center justify-center rounded-lg transition-all border ${hasProblem ? 'bg-red-500 text-text border-red-500' : 'bg-panel hover:bg-red-500 hover:text-text border-border text-slate-400'}`}
                                            title="Relatar Problema / Observação"
                                        >
                                            <span className="material-symbols-outlined text-sm">warning</span>
                                        </button>
                                        
                                        {p.status === 'Active' && (
                                            <button 
                                                onClick={() => handleOpenFinishModal(p.id)}
                                                className="px-3 py-1.5 rounded-lg bg-panel hover:bg-purple-500 hover:text-text border border-border transition-all text-xs font-semibold text-slate-400"
                                            >
                                                Finalizar
                                            </button>
                                        )}
                                        {(p.status === 'Finished' || p.status === 'Suspended') && (
                                            <button 
                                                onClick={() => handleReactivate(p.id)}
                                                className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-text border border-emerald-500/20 transition-all text-xs font-bold"
                                            >
                                                Reativar
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                          );
                      })}
                  </tbody>
              </table>
              {filteredPatients.length === 0 && (
                  <div className="p-8 text-center text-slate-500">
                      Nenhum paciente encontrado.
                  </div>
              )}
          </div>
      </div>
      </div>
  );

  const renderGrid = () => {
      const monthKey = `${currentYear}-${selectedMonth.padStart(2, '0')}`;
      
      let activePatients = filteredPatients
          .filter(p => p.status === 'Active')
          .sort((a, b) => a.name.localeCompare(b.name));

      if (gridStatusFilter !== 'all') {
          activePatients = activePatients.filter(p => p.attendance[monthKey] === gridStatusFilter);
      }
      
      return (
          <div className="glass-panel rounded-2xl border border-border overflow-hidden animate-in fade-in duration-500 flex flex-col h-full">
              <div className="p-4 border-b border-border bg-surface flex flex-wrap gap-4 justify-between items-center">
                  <div className="flex items-center gap-4">
                      <h3 className="font-bold text-text text-sm">Grade de Presença - {currentYear}</h3>
                      <div className="flex items-center gap-2 bg-panel border border-border rounded-lg p-1">
                          <button 
                            onClick={() => setCurrentYear('2025')}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${currentYear === '2025' ? 'bg-white text-black shadow-lg' : 'text-slate-500 hover:text-text'}`}
                          >
                              2025
                          </button>
                          <button 
                            onClick={() => setCurrentYear('2026')}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${currentYear === '2026' ? 'bg-white text-black shadow-lg' : 'text-slate-500 hover:text-text'}`}
                          >
                              2026
                          </button>
                      </div>
                  </div>

                  <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Mês de Referência:</span>
                          <select 
                            value={selectedMonth} 
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="bg-panel border border-border rounded-lg text-[10px] text-text px-2 py-1 outline-none focus:border-purple-500 font-bold"
                          >
                              {MONTHS.map((m, i) => <option key={i} value={String(i+1)}>{m}</option>)}
                          </select>
                      </div>

                      <div className="flex items-center gap-2 bg-panel border border-border rounded-lg p-1">
                          <button 
                            onClick={() => setGridStatusFilter('all')}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${gridStatusFilter === 'all' ? 'bg-white text-black shadow-lg' : 'text-slate-500 hover:text-text'}`}
                          >
                              Todos
                          </button>
                          <button 
                            onClick={() => setGridStatusFilter('Scheduled')}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${gridStatusFilter === 'Scheduled' ? 'bg-amber-500 text-text shadow-lg' : 'text-slate-500 hover:text-text'}`}
                          >
                              Agendados
                          </button>
                          <button 
                            onClick={() => setGridStatusFilter('Present')}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${gridStatusFilter === 'Present' ? 'bg-emerald-500 text-text shadow-lg' : 'text-slate-500 hover:text-text'}`}
                          >
                              Presentes
                          </button>
                          <button 
                            onClick={() => setGridStatusFilter('Absent')}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${gridStatusFilter === 'Absent' ? 'bg-red-500 text-text shadow-lg' : 'text-slate-500 hover:text-text'}`}
                          >
                              Faltas
                          </button>
                      </div>
                  </div>

                  <div className="flex gap-4 text-[10px] font-bold uppercase text-slate-400">
                      <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-emerald-500"></span> Presente</span>
                      <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-amber-500"></span> Agendado</span>
                      <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-red-500"></span> Falta</span>
                  </div>
              </div>
              <div className="overflow-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 z-30 bg-surface">
                          <tr className="border-b border-border text-gray-400 text-xs uppercase tracking-wider font-medium">
                              <th className="p-4 font-semibold sticky left-0 top-0 bg-surface z-40 shadow-r border-r border-border min-w-[150px]">Paciente</th>
                              {MONTHS.map(m => (
                                  <th key={m} className="p-4 font-semibold text-center min-w-[60px]">{m}</th>
                              ))}
                          </tr>
                      </thead>
                      <tbody className="text-gray-300 text-sm divide-y divide-white/5">
                          {activePatients.map((p) => {
                              const hasProblem = p.problemNote && p.problemNote.trim().length > 0;
                              
                              // Check for 3 consecutive absences in the current year is disabled
                              const hasThreeConsecutiveAbsences = false;

                              return (
                                <tr key={p.id} className="hover:bg-panel transition-colors">
                                    <td className={`p-4 font-bold text-text sticky left-0 z-10 border-r border-border shadow-lg group-hover:bg-surface transition-colors ${hasProblem ? 'bg-red-900/20' : 'bg-surface'}`}>
                                        <div className="flex flex-col">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    {p.name}
                                                    {hasProblem && <span className="text-red-400 font-normal text-[10px]">(Alert)</span>}
                                                </div>
                                                <button 
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        if (!confirm('Deseja finalizar o tratamento deste paciente e removê-lo da grade?')) return;
                                                        const endDate = new Date().toISOString().split('T')[0];
                                                        const { error } = await supabase.from('ortho_patients').update({ status: 'Finished', end_date: endDate }).eq('id', p.id);
                                                        if (!error) {
                                                            setPatients(patients.map(pat => pat.id === p.id ? { ...pat, status: 'Finished', endDate } : pat));
                                                        } else {
                                                            alert('Erro ao finalizar paciente.');
                                                        }
                                                    }}
                                                    title="Finalizar e Remover da Grade"
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-panel hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400 rounded"
                                                >
                                                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                                </button>
                                            </div>
                                            {hasThreeConsecutiveAbsences && (
                                                <div className="mt-1 flex items-center gap-1 bg-red-500/20 text-red-400 text-[9px] px-1.5 py-0.5 rounded border border-red-500/30 w-fit animate-pulse">
                                                    <span className="material-symbols-outlined text-[10px]">warning</span>
                                                    3 FALTAS CONSECUTIVAS
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    {MONTHS.map((_, idx) => {
                                        const monthKey = `${currentYear}-${String(idx + 1).padStart(2, '0')}`;
                                        const status = p.attendance[monthKey] || 'None';
                                        
                                        let cellClass = "cursor-pointer transition-all duration-200 group/cell";
                                        let content = null;
                                        
                                        if (status === 'Present') {
                                            cellClass += " bg-emerald-500/20 text-emerald-400";
                                            // Find the specific day
                                            const monthKeyPrefix = `${currentYear}-${String(idx + 1).padStart(2, '0')}-`;
                                            const dayKey = Object.keys(p.attendance || {}).find(key => 
                                                key.startsWith(monthKeyPrefix) && p.attendance[key] === 'Present'
                                            );
                                            const day = dayKey ? dayKey.split('-')[2] : '';
                                            content = <span className="text-[10px] font-bold">{day ? parseInt(day) : <span className="material-symbols-outlined text-sm">check</span>}</span>;
                                        } else if (status === 'Scheduled') {
                                            cellClass += " bg-amber-500/20 text-amber-400";
                                            content = <span className="material-symbols-outlined text-sm">event</span>;
                                        } else if (status === 'Absent') {
                                            cellClass += " bg-red-500/20 text-red-400";
                                            content = <span className="material-symbols-outlined text-sm">close</span>;
                                        } else {
                                            cellClass += " hover:bg-panel";
                                        }

                                        return (
                                            <td 
                                                key={idx} 
                                                className={`p-2 text-center border-l border-border relative ${cellClass}`}
                                            >
                                                <div 
                                                    className="w-full h-full flex items-center justify-center min-h-[30px]"
                                                    onClick={() => toggleAttendance(p.id, idx)}
                                                >
                                                    {content}
                                                </div>
                                                
                                                {status !== 'None' && (
                                                    <button
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            const updatedAttendance = { ...p.attendance };
                                                            delete updatedAttendance[monthKey];
                                                            
                                                            // Clear daily records for this month
                                                            const monthPrefix = `${currentYear}-${String(idx + 1).padStart(2, '0')}-`;
                                                            Object.keys(updatedAttendance).forEach(key => {
                                                                if (key.startsWith(monthPrefix) && key.length > 7) {
                                                                    delete updatedAttendance[key];
                                                                }
                                                            });

                                                            const { error } = await supabase.from('ortho_patients').update({ attendance: updatedAttendance }).eq('id', p.id);
                                                            if (!error) setPatients(patients.map(pat => pat.id === p.id ? { ...pat, attendance: updatedAttendance } : pat));
                                                        }}
                                                        className="absolute -top-1 -right-1 opacity-0 group-hover/cell:opacity-100 transition-opacity bg-red-500 text-text rounded-full p-0.5 shadow-lg z-20"
                                                        title="Limpar"
                                                    >
                                                        <X size={10} />
                                                    </button>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                              );
                          })}
                      </tbody>
                  </table>
                  {activePatients.length === 0 && (
                      <div className="p-8 text-center text-slate-500">
                          Nenhum paciente ativo encontrado.
                      </div>
                  )}
              </div>
          </div>
      );
  };

  const renderSettings = () => (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-500">
          {/* APPLIANCE TYPES */}
          <div className="glass-panel rounded-2xl p-6 border border-border">
              <h3 className="text-lg font-bold text-text mb-6 flex items-center gap-2">
                  <span className="material-symbols-outlined text-purple-500">settings_suggest</span>
                  Gerenciar Tipos de Aparelho
              </h3>
              
              <div className="flex gap-2 mb-6 p-4 bg-panel rounded-xl border border-border">
                  <input 
                      value={newApplianceName}
                      onChange={(e) => setNewApplianceName(e.target.value)}
                      placeholder="Novo Tipo de Aparelho..."
                      className="flex-1 bg-panel border border-border rounded-lg px-4 py-2 text-sm text-text focus:outline-none focus:border-purple-500"
                  />
                  <button onClick={handleCreateAppliance} className="px-4 py-2 bg-purple-500 text-text rounded-lg text-sm font-bold hover:bg-purple-600 transition-colors">
                      Adicionar
                  </button>
              </div>

              <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                  {applianceTypes.map(app => (
                      <div key={app.id} className="flex justify-between items-center p-3 bg-panel rounded-lg border border-border group hover:border-purple-500/30 transition-colors">
                          {editingApplianceId === app.id ? (
                              <div className="flex flex-1 gap-2">
                                  <input 
                                      value={editingName}
                                      onChange={(e) => setEditingName(e.target.value)}
                                      autoFocus
                                      className="flex-1 bg-panel border border-white/20 rounded px-2 py-1 text-sm text-text focus:border-purple-500 outline-none"
                                  />
                                  <button onClick={() => handleEditAppliance(app.id, editingName)} className="text-emerald-400 hover:bg-panel/80 p-1 rounded"><span className="material-symbols-outlined text-sm">check</span></button>
                                  <button onClick={() => setEditingApplianceId(null)} className="text-red-400 hover:bg-panel/80 p-1 rounded"><span className="material-symbols-outlined text-sm">close</span></button>
                              </div>
                          ) : (
                              <>
                                  <span className="text-sm font-medium text-slate-300">{app.name}</span>
                                  <button 
                                      onClick={() => { setEditingApplianceId(app.id); setEditingName(app.name); }}
                                      className="text-slate-500 hover:text-text opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                  >
                                      <span className="material-symbols-outlined text-sm">edit</span>
                                  </button>
                              </>
                          )}
                      </div>
                  ))}
              </div>
          </div>

          {/* FINISH REASONS */}
          <div className="glass-panel rounded-2xl p-6 border border-border">
              <h3 className="text-lg font-bold text-text mb-6 flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-500">flag</span>
                  Motivos de Finalização
              </h3>
              
              <div className="flex gap-2 mb-6 p-4 bg-panel rounded-xl border border-border">
                  <input 
                      value={newFinishReason}
                      onChange={(e) => setNewFinishReason(e.target.value)}
                      placeholder="Novo Motivo (ex: Alta, Abandono)..."
                      className="flex-1 bg-panel border border-border rounded-lg px-4 py-3 text-text focus:outline-none focus:border-blue-500"
                  />
                  <button onClick={handleAddFinishReason} className="px-4 py-2 bg-blue-500 text-text rounded-lg text-sm font-bold hover:bg-blue-600 transition-colors">
                      Adicionar
                  </button>
              </div>

              <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                  {finishReasons.length === 0 && <span className="text-sm text-slate-500 italic p-2">Nenhum motivo cadastrado.</span>}
                  {finishReasons.map(reason => (
                      <div key={reason.id} className="flex justify-between items-center p-3 bg-panel rounded-lg border border-border group hover:border-blue-500/30 transition-colors">
                          <span className="text-sm font-medium text-slate-300">{reason.name}</span>
                          <button 
                              onClick={() => handleDeleteFinishReason(reason.id)}
                              className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                          >
                              <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                      </div>
                  ))}
              </div>
          </div>
      </div>
  );

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
                          {activeSubTab === 'vision' ? 'Visão Geral Ortodontia' : 
                           activeSubTab === 'grid' ? 'Grade de Presença' : 
                           activeSubTab === 'patients' ? 'Gestão de Pacientes' : 'Configurações'}
                       </h1>
                       <p className="text-slate-400 text-sm">
                          {activeSubTab === 'vision' 
                              ? 'Acompanhamento de performance, faturamento e fluxo de pacientes.' 
                              : activeSubTab === 'grid' 
                              ? 'Controle de mensalidades e presença mensal dos pacientes.' 
                              : activeSubTab === 'patients' 
                              ? 'Lista completa de pacientes, contratos e histórico de tratamento.' 
                              : 'Gerencie aparelhos, custos e motivos de finalização.'}
                       </p>
                   </div>

                   <div className="flex gap-2 text-sm justify-end">
                      {activeSubTab === 'patients' && (
                          <button 
                              onClick={() => { setIsNewContractModalOpen(true); }}
                              className="px-6 py-2 glass-button glass-button-primary text-text rounded-xl font-bold shadow-lg transition-all flex items-center gap-2"
                          >
                              <LayoutPanelLeft className="w-4 h-4" /> Novo Paciente
                          </button>
                      )}
                      
                      {activeSubTab === 'patients' && (
                          <div className="relative group">
                              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                              <input 
                                  value={searchTerm}
                                  onChange={(e) => setSearchTerm(e.target.value)}
                                  placeholder="Filtrar paciente..."
                                  className="bg-panel border border-border rounded-lg pl-10 pr-4 py-2 text-text text-sm outline-none focus:border-purple-500 transition-colors"
                              />
                          </div>
                      )}
                   </div>
               </div>

               {/* SUB NAVIGATION BAR */}
               <div className="flex items-center gap-1 overflow-x-auto pb-4 no-scrollbar border-b border-border mb-8">
                    {visibleTabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveSubTab(tab.id as OrthoTab)}
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

               {activeSubTab === 'vision' && renderOverview()}
               {activeSubTab === 'grid' && renderGrid()}
               {activeSubTab === 'patients' && renderPatients()}
               {activeSubTab === 'settings' && renderSettings()}
           </div>
        </div>
      </div>

      {/* New Contract Modal */}
      {isNewContractModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 dark:bg-black/60 backdrop-blur-2xl p-4 animate-in fade-in duration-200">
              <div className="bg-surface border border-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                  <div className="p-6 border-b border-border bg-surface flex justify-between items-center">
                      <h3 className="text-xl font-bold text-text font-display">Novo Contrato Ortodôntico</h3>
                      <button onClick={() => setIsNewContractModalOpen(false)} className="text-slate-400 hover:text-text"><span className="material-symbols-outlined">close</span></button>
                  </div>
                  <div className="p-6 flex flex-col gap-4">
                      <div className="flex flex-col gap-2">
                          <label className="text-xs font-bold text-slate-400 uppercase">Nome do Paciente</label>
                          <input 
                              value={newContractForm.name}
                              onChange={(e) => setNewContractForm({...newContractForm, name: e.target.value})}
                              placeholder="Nome Completo"
                              className="bg-panel border border-border rounded-lg px-4 py-3 text-text focus:border-purple-500 outline-none"
                          />
                      </div>
                      <div className="flex flex-col gap-2">
                          <label className="text-xs font-bold text-slate-400 uppercase">Tipo de Aparelho</label>
                          <select 
                              value={newContractForm.applianceType}
                              onChange={(e) => setNewContractForm({...newContractForm, applianceType: e.target.value})}
                              className="bg-panel border border-border rounded-lg px-4 py-3 text-text focus:border-purple-500 outline-none"
                          >
                              <option value="">Selecione...</option>
                              {applianceTypes.map(app => <option key={app.id} value={app.name}>{app.name}</option>)}
                          </select>
                      </div>
                      <div className="flex flex-col gap-2">
                          <label className="text-xs font-bold text-slate-400 uppercase">Contrato</label>
                          <select 
                              value={newContractForm.contractType}
                              onChange={(e) => setNewContractForm({...newContractForm, contractType: e.target.value as 'Digital' | 'Papel' | ''})}
                              className="bg-panel border border-border rounded-lg px-4 py-3 text-text focus:border-purple-500 outline-none font-bold"
                          >
                              <option value="">Vazio (Selecionar depois)</option>
                              <option value="Digital">Digital</option>
                              <option value="Papel">Papel</option>
                          </select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div className="flex flex-col gap-2">
                              <label className="text-xs font-bold text-slate-400 uppercase">Data de Início</label>
                              <input 
                                  type="date"
                                  value={newContractForm.startDate}
                                  onChange={(e) => setNewContractForm({...newContractForm, startDate: e.target.value})}
                                  className="bg-panel border border-border rounded-lg px-4 py-3 text-text focus:border-purple-500 outline-none"
                              />
                          </div>
                          <div className="flex flex-col gap-2">
                              <label className="text-xs font-bold text-slate-400 uppercase">Mensalidade (R$)</label>
                              <input 
                                  type="number"
                                  value={newContractForm.maintenanceValue}
                                  onChange={(e) => setNewContractForm({...newContractForm, maintenanceValue: e.target.value})}
                                  placeholder="0.00"
                                  className="bg-panel border border-border rounded-lg px-4 py-3 text-text focus:border-purple-500 outline-none"
                              />
                          </div>
                      </div>
                  </div>
                  <div className="p-6 border-t border-border bg-surface flex justify-end gap-3">
                      <button onClick={() => setIsNewContractModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-text">Cancelar</button>
                      <button onClick={handleSaveContract} className="px-6 py-2 rounded-lg bg-primary text-text font-bold text-sm shadow-lg hover:shadow-purple-500/20">Salvar Contrato</button>
                  </div>
              </div>
          </div>
      )}

      {/* Finish Treatment Modal */}
      {isFinishModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 dark:bg-black/60 backdrop-blur-2xl p-4 animate-in fade-in duration-200">
              <div className="bg-surface border border-border w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                  <div className="p-6 border-b border-border bg-surface flex justify-between items-center">
                      <h3 className="text-lg font-bold text-text font-display">Finalizar Tratamento</h3>
                      <button onClick={() => setIsFinishModalOpen(false)} className="text-slate-400 hover:text-text"><span className="material-symbols-outlined">close</span></button>
                  </div>
                  <div className="p-6 flex flex-col gap-4">
                      <p className="text-sm text-slate-300">Selecione a data de conclusão do tratamento para arquivar este paciente.</p>
                      <div className="flex flex-col gap-2">
                          <label className="text-xs font-bold text-slate-400 uppercase">Data de Finalização</label>
                          <input 
                              type="date"
                              value={finishDate}
                              onChange={(e) => setFinishDate(e.target.value)}
                              className="bg-panel border border-border rounded-lg px-4 py-3 text-text focus:border-purple-500 outline-none"
                          />
                      </div>
                  </div>
                  <div className="p-6 border-t border-border bg-surface flex justify-end gap-3">
                      <button onClick={() => setIsFinishModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-text">Cancelar</button>
                      <button onClick={handleConfirmFinish} className="px-6 py-2 rounded-lg bg-blue-500 text-text font-bold text-sm hover:bg-blue-400 shadow-lg">Confirmar</button>
                  </div>
              </div>
          </div>
      )}

      {/* Problem Note Modal */}
      {isNoteModalOpen && selectedPatientForNote && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 dark:bg-black/60 backdrop-blur-2xl p-4 animate-in fade-in duration-200">
              <div className="bg-surface border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                  <div className="p-6 border-b border-border bg-surface flex justify-between items-center bg-red-900/10">
                      <div className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-red-400">warning</span>
                          <h3 className="text-lg font-bold text-text font-display">Alerta / Problema</h3>
                      </div>
                      <button onClick={() => setIsNoteModalOpen(false)} className="text-slate-400 hover:text-text"><span className="material-symbols-outlined">close</span></button>
                  </div>
                  <div className="p-6 flex flex-col gap-4">
                      <p className="text-sm text-slate-300">
                          Relatar problema para: <strong className="text-text">{selectedPatientForNote.name}</strong>
                      </p>
                      <div className="flex flex-col gap-2">
                          <label className="text-xs font-bold text-slate-400 uppercase">Descrição do Problema</label>
                          <textarea 
                              value={noteContent}
                              onChange={(e) => setNoteContent(e.target.value)}
                              placeholder="Descreva o problema (ex: bracket quebrado recorrente, falta injustificada...)"
                              className="bg-panel border border-border rounded-lg px-4 py-3 text-text focus:border-red-500 outline-none h-32 resize-none"
                          />
                      </div>
                  </div>
                  <div className="p-6 border-t border-border bg-surface flex justify-between gap-3">
                      <button onClick={handleResolveNote} className="px-4 py-2 text-sm font-bold text-emerald-400 hover:text-emerald-300 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/10">Resolver / Limpar</button>
                      <div className="flex gap-2">
                          <button onClick={() => setIsNoteModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-text">Cancelar</button>
                          <button onClick={handleSaveNote} className="px-6 py-2 rounded-lg bg-red-600 text-text font-bold text-sm hover:bg-red-500 shadow-lg">Salvar Alerta</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Date Selection Modal */}
      {editingPatientId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 dark:bg-black/60 backdrop-blur-2xl p-4 animate-in fade-in duration-200">
              <div className="bg-surface border border-border w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                  <div className="p-6 border-b border-border bg-surface flex justify-between items-center">
                      <h3 className="text-lg font-bold text-text font-display">Selecione o Dia</h3>
                      <button onClick={() => setEditingPatientId(null)} className="text-slate-400 hover:text-text"><span className="material-symbols-outlined">close</span></button>
                  </div>
                  <div className="p-4">
                      <OrthodonticsCalendar 
                        currentYear={currentYear} 
                        selectedMonth={selectedMonth} 
                        isOrthoDay={isOrthoDay} 
                        onDayClick={(date) => {
                            toggleDailyAttendance(editingPatientId, date);
                            setEditingPatientId(null);
                        }}
                      />
                  </div>
              </div>
          </div>
      )}

      {/* Grid Date Selection Modal */}
      {gridEditingInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 dark:bg-black/60 backdrop-blur-2xl p-4 animate-in fade-in duration-200">
              <div className="bg-surface border border-border w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                  <div className="p-6 border-b border-border bg-surface flex justify-between items-center">
                      <h3 className="text-lg font-bold text-text font-display">Selecione o Dia de Presença</h3>
                      <button onClick={() => setGridEditingInfo(null)} className="text-slate-400 hover:text-text"><span className="material-symbols-outlined">close</span></button>
                  </div>
                  <div className="p-4">
                      <OrthodonticsCalendar 
                        currentYear={currentYear} 
                        selectedMonth={(gridEditingInfo.monthIndex + 1).toString()} 
                        isOrthoDay={isOrthoDay} 
                        onDayClick={(date) => {
                            toggleDailyAttendance(gridEditingInfo.patientId, date);
                            setGridEditingInfo(null);
                        }}
                      />
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
