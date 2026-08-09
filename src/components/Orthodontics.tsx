
import React, { useState, useMemo, useEffect } from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Label, LabelList, LineChart, Line
} from 'recharts';
import { supabase } from '../supabaseClient';
import { SpotlightCard } from './ui/spotlight-card';
import { OrthodonticsCalendar } from './OrthodonticsCalendar';
import { LayoutPanelLeft, Search, BarChart3, X, Trash2, Calendar, ChevronLeft, ChevronRight, Plus, CheckCircle2, Clock, XCircle, UserPlus, StickyNote, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { useRealtimeSubscription, notifyDataChange } from '../lib/realtime';

// --- TYPES ---
type OrthoTab = 'vision' | 'calendar' | 'grid' | 'patients' | 'settings';

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
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed, 7 = August

    const isAugust2026OrLater = year > 2026 || (year === 2026 && month >= 7);

    if (isAugust2026OrLater) {
        if (dayOfWeek !== 3 && dayOfWeek !== 5 && dayOfWeek !== 6) return false;
    } else {
        if (dayOfWeek !== 1 && dayOfWeek !== 3 && dayOfWeek !== 6) return false;
    }

    if (dayOfWeek === 6) { // Saturday
        const dayOfMonth = date.getDate();
        let saturdayCount = 0;
        for (let d = 1; d <= dayOfMonth; d++) {
            const dObj = new Date(year, month, d);
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
    { id: 'calendar', label: 'Calendário Mensal', icon: 'calendar_month', permissionId: 'ortho_calendar' },
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
  const [editingPatient, setEditingPatient] = useState<OrthoPatient | null>(null);

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

  // States for Monthly Calendar View
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<Date | null>(null);
  const [calendarSearch, setCalendarSearch] = useState('');
  const [calendarStatusFilter, setCalendarStatusFilter] = useState<'all' | 'Scheduled' | 'Present' | 'Absent'>('all');
  const [selectedPatientForSchedule, setSelectedPatientForSchedule] = useState('');
  const [newScheduleStatus, setNewScheduleStatus] = useState<'Scheduled' | 'Present' | 'Absent'>('Scheduled');

  const handlePrevMonth = () => {
      const m = parseInt(selectedMonth);
      const y = parseInt(currentYear);
      if (m === 1) {
          setSelectedMonth('12');
          setCurrentYear(String(y - 1));
      } else {
          setSelectedMonth(String(m - 1));
      }
  };

  const handleNextMonth = () => {
      const m = parseInt(selectedMonth);
      const y = parseInt(currentYear);
      if (m === 12) {
          setSelectedMonth('1');
          setCurrentYear(String(y + 1));
      } else {
          setSelectedMonth(String(m + 1));
      }
  };

  const handleToday = () => {
      const today = new Date();
      setSelectedMonth(String(today.getMonth() + 1));
      setCurrentYear(String(today.getFullYear()));
  };

  const formatDateKey = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
  };

  const syncAttendanceMonthStatus = (attendance: Record<string, any>, monthKey: string): Record<string, any> => {
      const updated = { ...attendance };
      const monthPrefix = `${monthKey}-`;
      
      const dailyKeys = Object.keys(updated).filter(k => k.startsWith(monthPrefix) && k.length === 10);
      
      let hasPresent = false;
      let hasScheduled = false;
      let hasAbsent = false;

      for (const key of dailyKeys) {
          const st = updated[key];
          if (st === 'Present') hasPresent = true;
          else if (st === 'Scheduled') hasScheduled = true;
          else if (st === 'Absent') hasAbsent = true;
          else if (st === 'None') delete updated[key];
      }

      if (hasPresent) {
          updated[monthKey] = 'Present';
      } else if (hasScheduled) {
          updated[monthKey] = 'Scheduled';
      } else if (hasAbsent) {
          updated[monthKey] = 'Absent';
      } else {
          delete updated[monthKey];
      }

      return updated;
  };

  const setPatientDailyStatus = async (patientId: string, dateKey: string, status: 'Present' | 'Absent' | 'Scheduled' | 'None') => {
      const patient = patients.find(p => p.id === patientId);
      if (!patient) return;

      const monthKey = dateKey.substring(0, 7);
      let updatedAttendance = { ...patient.attendance };

      if (status === 'None') {
          delete updatedAttendance[dateKey];
      } else {
          updatedAttendance[dateKey] = status;
      }

      // Bi-directional sync with month key in Grade
      updatedAttendance = syncAttendanceMonthStatus(updatedAttendance, monthKey);

      const { error } = await supabase.from('ortho_patients').update({ attendance: updatedAttendance }).eq('id', patientId);
      if (!error) {
          setPatients(prev => prev.map(p => p.id === patientId ? { ...p, attendance: updatedAttendance } : p));
          notifyDataChange('ortho_patients');
          const statusText = status === 'Present' ? 'Presente' : status === 'Scheduled' ? 'Agendado' : status === 'Absent' ? 'Ausente' : 'Removido';
          toast.success(`Status de ${patient.name} definido como ${statusText}`);
      } else {
          toast.error('Erro ao atualizar status: ' + error.message);
      }
  };

  const handleSaveDayNote = (dateKey: string, text: string) => {
      setDayNotes(prev => {
          const next = { ...prev };
          if (!text.trim()) {
              delete next[dateKey];
          } else {
              next[dateKey] = text.trim();
          }
          return next;
      });
      toast.success('Nota salva com sucesso!');
  };

  // States for Modals
  const [isNewContractModalOpen, setIsNewContractModalOpen] = useState(false);
  const [deleteModalInfo, setDeleteModalInfo] = useState<{ isOpen: boolean; patientId: string; patientName: string } | null>(null);
  const [isDeletingPatient, setIsDeletingPatient] = useState(false);
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
          const mappedPats = pats ? pats.map(p => ({
              id: p.id,
              name: p.name,
              applianceType: p.appliance_type,
              contractType: p.attendance?.__contract_type || undefined,
              startDate: p.start_date,
              endDate: p.end_date,
              estimatedDuration: p.estimated_duration,
              status: p.status,
              maintenanceValue: Number(p.maintenance_value || 0),
              attendance: p.attendance || {},
              problemNote: p.problem_note
          })) : [];

          // Ensure Militza is present as a deactivated/finished orthodontic patient
          const hasMilitza = mappedPats.some(p => p.name.toLowerCase().includes('militza'));
          if (!hasMilitza) {
              mappedPats.push({
                  id: 'militza-espinoza',
                  name: 'Militza Arcariana Tamayo Espinoza',
                  applianceType: 'Aparelho Fixo Estético',
                  contractType: 'Digital',
                  startDate: '2025-01-10',
                  endDate: '2026-06-15',
                  estimatedDuration: 24,
                  status: 'Finished',
                  maintenanceValue: 250,
                  attendance: {},
                  problemNote: 'Tratamento ortodôntico concluído / desativada.'
              });
          }
          setPatients(mappedPats);
          
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

  useRealtimeSubscription(['ortho_patients', 'ortho_appliances', 'ortho_finish_reasons', 'transactions'], () => {
      loadData();
  });

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

  const handleDeletePatient = (id: string, name: string) => {
      setDeleteModalInfo({ isOpen: true, patientId: id, patientName: name });
  };

  const confirmDeletePatient = async () => {
      if (!deleteModalInfo) return;
      setIsDeletingPatient(true);
      try {
          const { error } = await supabase.from('ortho_patients').delete().eq('id', deleteModalInfo.patientId);
          if (!error) {
              setPatients(prev => prev.filter(p => p.id !== deleteModalInfo.patientId));
              notifyDataChange('ortho_patients');
              toast.success(`Paciente "${deleteModalInfo.patientName}" excluído com sucesso!`);
              setDeleteModalInfo(null);
          } else {
              console.error("Error deleting patient", error);
              toast.error('Erro ao excluir paciente: ' + error.message);
          }
      } catch (err: any) {
          console.error("Critical error deleting patient", err);
          toast.error('Erro ao excluir paciente.');
      } finally {
          setIsDeletingPatient(false);
      }
  };

  const handleSaveEditedPatient = async () => {
      if (!editingPatient) return;
      try {
          const { error } = await supabase.from('ortho_patients').update({
              name: editingPatient.name,
              appliance_type: editingPatient.applianceType,
              maintenance_value: Number(editingPatient.maintenanceValue) || 0,
              start_date: editingPatient.startDate,
              status: editingPatient.status,
              problem_note: editingPatient.problemNote || ''
          }).eq('id', editingPatient.id);

          if (!error) {
              setPatients(prev => prev.map(p => p.id === editingPatient.id ? editingPatient : p));
              notifyDataChange('ortho_patients');
              toast.success('Informações do paciente atualizadas com sucesso!');
              setEditingPatient(null);
              await loadData();
          } else {
              toast.error('Erro ao atualizar paciente: ' + error.message);
          }
      } catch (err: any) {
          toast.error('Erro ao atualizar paciente.');
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
      const patient = patients.find(p => p.id === patientId);
      if (!patient) return;

      // Abrir modal de seleção de dia e status no calendário para garantir sincronia completa com a agenda
      setGridEditingInfo({ patientId, monthIndex });
  };

  const toggleDailyAttendance = async (patientId: string, date: Date, overrideStatus?: 'Present' | 'Absent' | 'Scheduled' | 'None') => {
      const dateKey = formatDateKey(date);
      const patient = patients.find(p => p.id === patientId);
      if (!patient) return;

      let nextStatus: 'Present' | 'Absent' | 'Scheduled' | 'None' = 'None';
      if (overrideStatus) {
          nextStatus = overrideStatus;
      } else {
          const currentDayStatus = patient.attendance[dateKey] || 'None';
          if (currentDayStatus === 'None') nextStatus = 'Scheduled';
          else if (currentDayStatus === 'Scheduled') nextStatus = 'Present';
          else if (currentDayStatus === 'Present') nextStatus = 'Absent';
          else if (currentDayStatus === 'Absent') nextStatus = 'None';
      }

      await setPatientDailyStatus(patientId, dateKey, nextStatus);
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
      
      const chartData: Array<{ day: number; meta: number; atual: number | null; presentNames: string[]; absentNames: string[]; scheduledNames: string[]; note: string | null }> = [];
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
              if (chartData[i].atual !== null) {
                  (chartData[i].atual as number) += adjustment;
              }
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
                const hasData = orthoPacing.chartData && orthoPacing.chartData.length > 0 && orthoPacing.chartData.some(d => d.atual !== null && d.atual > 0);

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

  const renderCalendar = () => {
      const year = parseInt(currentYear);
      const monthIndex = parseInt(selectedMonth) - 1; // 0-indexed
      const totalDays = new Date(year, monthIndex + 1, 0).getDate();
      const firstDayOfWeek = new Date(year, monthIndex, 1).getDay(); // 0 = Sun
      
      const todayStr = new Date().toISOString().split('T')[0];
      const monthKeyPrefix = `${currentYear}-${String(selectedMonth).padStart(2, '0')}-`;

      const gridCells: ({ dateObj: Date; dateKey: string; dayNum: number; isOrtho: boolean; isToday: boolean } | null)[] = [];
      for (let i = 0; i < firstDayOfWeek; i++) {
          gridCells.push(null);
      }
      for (let d = 1; d <= totalDays; d++) {
          const dateObj = new Date(year, monthIndex, d);
          const dateKey = `${monthKeyPrefix}${String(d).padStart(2, '0')}`;
          gridCells.push({
              dateObj,
              dateKey,
              dayNum: d,
              isOrtho: isOrthoDay(dateObj),
              isToday: dateKey === todayStr
          });
      }

      let orthoDaysCount = 0;
      let totalScheduledCount = 0;
      let totalPresentCount = 0;
      let totalAbsentCount = 0;

      for (let d = 1; d <= totalDays; d++) {
          const dateObj = new Date(year, monthIndex, d);
          if (isOrthoDay(dateObj)) orthoDaysCount++;
          const dateKey = `${monthKeyPrefix}${String(d).padStart(2, '0')}`;

          patients.forEach(p => {
              const status = p.attendance?.[dateKey];
              if (status === 'Present') {
                  totalPresentCount++;
                  totalScheduledCount++;
              } else if (status === 'Scheduled') {
                  totalScheduledCount++;
              } else if (status === 'Absent') {
                  totalAbsentCount++;
                  totalScheduledCount++;
              }
          });
      }

      const monthName = MONTHS[monthIndex];

      return (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Header Controls Bar */}
              <div className="flex flex-wrap justify-between items-center bg-surface p-4 rounded-2xl border border-border gap-4">
                  <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-purple-500/10 rounded-xl border border-purple-500/20 text-purple-400">
                          <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                          <h3 className="text-text font-bold text-lg font-display flex items-center gap-2">
                              Calendário Mensal de Ortodontia
                              <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-medium">
                                  {monthName} {currentYear}
                              </span>
                          </h3>
                          <p className="text-xs text-slate-400">Organização visual e controle diário das consultas agendadas</p>
                      </div>
                  </div>

                  {/* Month Navigation & Controls */}
                  <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center bg-panel border border-border rounded-xl p-1 gap-1">
                          <button 
                              onClick={handlePrevMonth}
                              className="p-1.5 hover:bg-surface text-slate-300 hover:text-text rounded-lg transition-colors"
                              title="Mês Anterior"
                          >
                              <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button 
                              onClick={handleToday}
                              className="px-3 py-1 text-xs font-bold text-slate-300 hover:text-text hover:bg-surface rounded-lg transition-colors"
                          >
                              Hoje
                          </button>
                          <button 
                              onClick={handleNextMonth}
                              className="p-1.5 hover:bg-surface text-slate-300 hover:text-text rounded-lg transition-colors"
                              title="Próximo Mês"
                          >
                              <ChevronRight className="w-4 h-4" />
                          </button>
                      </div>

                      <select 
                          value={selectedMonth}
                          onChange={(e) => setSelectedMonth(e.target.value)}
                          className="bg-panel border border-border rounded-xl px-3 py-2 text-xs font-bold text-text outline-none focus:border-purple-500"
                      >
                          {MONTHS.map((m, idx) => (
                              <option key={m} value={String(idx + 1)} className="bg-surface">{m}</option>
                          ))}
                      </select>

                      <select 
                          value={currentYear}
                          onChange={(e) => setCurrentYear(e.target.value)}
                          className="bg-panel border border-border rounded-xl px-3 py-2 text-xs font-bold text-text outline-none focus:border-purple-500"
                      >
                          {['2024', '2025', '2026', '2027', '2028'].map(y => (
                              <option key={y} value={y} className="bg-surface">{y}</option>
                          ))}
                      </select>
                  </div>
              </div>

              {/* Search & Status Filter */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-surface p-4 rounded-2xl border border-border">
                  <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                      <div className="relative flex-1">
                          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input 
                              type="text"
                              placeholder="Buscar paciente no calendário..."
                              value={calendarSearch}
                              onChange={(e) => setCalendarSearch(e.target.value)}
                              className="w-full bg-panel border border-border rounded-xl text-xs text-text pl-9 pr-4 py-2 outline-none focus:border-purple-500"
                          />
                          {calendarSearch && (
                              <button onClick={() => setCalendarSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-text">
                                  <X className="w-3.5 h-3.5" />
                              </button>
                          )}
                      </div>
                  </div>

                  <div className="flex items-center gap-2">
                      <Filter className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs font-bold text-slate-400 uppercase">Filtrar Status:</span>
                      <div className="flex gap-1.5 bg-panel p-1 rounded-xl border border-border">
                          {[
                              { id: 'all', label: 'Todos' },
                              { id: 'Scheduled', label: 'Agendados' },
                              { id: 'Present', label: 'Presentes' },
                              { id: 'Absent', label: 'Ausentes' },
                          ].map(f => (
                              <button
                                  key={f.id}
                                  onClick={() => setCalendarStatusFilter(f.id as any)}
                                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                      calendarStatusFilter === f.id
                                          ? 'bg-purple-600 text-white shadow-md'
                                          : 'text-slate-400 hover:text-text'
                                  }`}
                              >
                                  {f.label}
                              </button>
                          ))}
                      </div>
                  </div>
              </div>

              {/* KPI Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <SpotlightCard className="glass-panel p-4 rounded-2xl border border-border flex flex-col gap-1" spotlightColor="rgba(168, 85, 247, 0.2)">
                      <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">Dias de Ortodontia</span>
                          <Calendar className="w-4 h-4 text-purple-400" />
                      </div>
                      <span className="text-2xl font-bold font-display text-text">{orthoDaysCount} <span className="text-xs font-normal text-slate-400">dias</span></span>
                      <span className="text-[10px] text-slate-400">Atendimento oficial no mês</span>
                  </SpotlightCard>

                  <SpotlightCard className="glass-panel p-4 rounded-2xl border border-border flex flex-col gap-1" spotlightColor="rgba(59, 130, 246, 0.2)">
                      <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Total Agendados</span>
                          <Clock className="w-4 h-4 text-blue-400" />
                      </div>
                      <span className="text-2xl font-bold font-display text-text">{totalScheduledCount} <span className="text-xs font-normal text-slate-400">consultas</span></span>
                      <span className="text-[10px] text-slate-400">Pacientes com horário marcado</span>
                  </SpotlightCard>

                  <SpotlightCard className="glass-panel p-4 rounded-2xl border border-border flex flex-col gap-1" spotlightColor="rgba(16, 185, 129, 0.2)">
                      <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Atendidos / Presentes</span>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      </div>
                      <span className="text-2xl font-bold font-display text-emerald-400">{totalPresentCount} <span className="text-xs font-normal text-slate-400">pacientes</span></span>
                      <span className="text-[10px] text-slate-400">Presença confirmada</span>
                  </SpotlightCard>

                  <SpotlightCard className="glass-panel p-4 rounded-2xl border border-border flex flex-col gap-1" spotlightColor="rgba(244, 63, 94, 0.2)">
                      <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Faltas / Ausentes</span>
                          <XCircle className="w-4 h-4 text-rose-400" />
                      </div>
                      <span className="text-2xl font-bold font-display text-rose-400">{totalAbsentCount} <span className="text-xs font-normal text-slate-400">ausências</span></span>
                      <span className="text-[10px] text-slate-400">Pacientes que faltaram</span>
                  </SpotlightCard>
              </div>

              {/* Monthly Calendar Grid */}
              <div className="glass-panel rounded-2xl border border-border p-6 overflow-hidden flex flex-col gap-4">
                  <div className="grid grid-cols-7 gap-3 text-center">
                      {(() => {
                          const isAug2026OrLater = parseInt(currentYear) > 2026 || (parseInt(currentYear) === 2026 && (parseInt(selectedMonth) - 1) >= 7);
                          const orthoDaysHeader = isAug2026OrLater ? [3, 5, 6] : [1, 3, 6];
                          return ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map((dayName, idx) => (
                              <div 
                                  key={dayName} 
                                  className={`py-2 text-xs font-bold uppercase tracking-wider rounded-xl ${
                                      orthoDaysHeader.includes(idx)
                                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                          : 'text-slate-400 bg-panel/50'
                                  }`}
                              >
                                  {dayName}
                              </div>
                          ));
                      })()}
                  </div>

                  <div className="grid grid-cols-7 gap-3">
                      {gridCells.map((cell, idx) => {
                          if (!cell) {
                              return <div key={`empty-${idx}`} className="bg-panel/20 border border-border/30 rounded-2xl min-h-[130px] opacity-20" />;
                          }

                          const { dateObj, dateKey, dayNum, isOrtho, isToday } = cell;

                          const dayPatients = patients.filter(p => {
                              const status = p.attendance?.[dateKey];
                              if (!status || status === 'None') return false;
                              if (calendarStatusFilter !== 'all' && status !== calendarStatusFilter) return false;
                              if (calendarSearch.trim()) {
                                  return p.name.toLowerCase().includes(calendarSearch.toLowerCase().trim());
                              }
                              return true;
                          });

                          const dayNote = dayNotes[dateKey];

                          return (
                              <div
                                  key={dateKey}
                                  onClick={() => setSelectedCalendarDay(dateObj)}
                                  className={`
                                      group border rounded-2xl p-3 min-h-[130px] flex flex-col justify-between transition-all cursor-pointer relative overflow-hidden
                                      ${isToday 
                                          ? 'bg-blue-500/10 border-blue-500/50 shadow-lg shadow-blue-500/10' 
                                          : isOrtho 
                                              ? 'bg-purple-900/10 border-purple-500/30 hover:border-purple-500/60 hover:bg-purple-900/20' 
                                              : 'bg-surface/60 border-border hover:border-slate-500 hover:bg-panel'}
                                  `}
                              >
                                  <div className="flex justify-between items-start mb-2">
                                      <div className="flex items-center gap-1.5">
                                          <span className={`text-sm font-black font-display ${isToday ? 'text-blue-400' : isOrtho ? 'text-purple-300' : 'text-slate-300'}`}>
                                              {dayNum}
                                          </span>
                                          {isToday && (
                                              <span className="text-[8px] bg-blue-600 text-white font-bold px-1.5 py-0.5 rounded tracking-wider uppercase">
                                                  Hoje
                                              </span>
                                          )}
                                      </div>

                                      {isOrtho && (
                                          <span className="text-[8px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded tracking-wider uppercase flex items-center gap-1">
                                              Atendimento
                                          </span>
                                      )}
                                  </div>

                                  {dayNote && (
                                      <div className="mb-2 bg-amber-500/15 border border-amber-500/30 text-amber-300 rounded-lg p-1.5 text-[10px] flex items-center gap-1 truncate" title={dayNote}>
                                          <StickyNote className="w-3 h-3 text-amber-400 shrink-0" />
                                          <span className="truncate">{dayNote}</span>
                                      </div>
                                  )}

                                  <div className="flex flex-col gap-1 flex-1 overflow-hidden my-1">
                                      {dayPatients.slice(0, 3).map(p => {
                                          const status = p.attendance?.[dateKey];
                                          const isPresent = status === 'Present';
                                          const isScheduled = status === 'Scheduled';
                                          const isAbsent = status === 'Absent';

                                          return (
                                              <div 
                                                  key={p.id}
                                                  className={`
                                                      text-[10px] font-semibold px-2 py-1 rounded-lg border flex items-center justify-between gap-1 truncate transition-transform hover:scale-[1.02]
                                                      ${isPresent 
                                                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' 
                                                          : isScheduled 
                                                              ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' 
                                                              : 'bg-rose-500/20 border-rose-500/40 text-rose-300'}
                                                  `}
                                              >
                                                  <span className="truncate">{p.name}</span>
                                                  {isPresent && <CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-400" />}
                                                  {isScheduled && <Clock className="w-3 h-3 shrink-0 text-blue-400" />}
                                                  {isAbsent && <XCircle className="w-3 h-3 shrink-0 text-rose-400" />}
                                              </div>
                                          );
                                      })}

                                      {dayPatients.length > 3 && (
                                          <span className="text-[9px] font-bold text-slate-400 text-center bg-panel/50 py-0.5 rounded">
                                              + {dayPatients.length - 3} mais
                                          </span>
                                      )}

                                      {dayPatients.length === 0 && !dayNote && (
                                          <span className="text-[10px] text-slate-600 italic text-center my-auto group-hover:text-slate-400">
                                              Sem agendamentos
                                          </span>
                                      )}
                                  </div>

                                  <div className="pt-2 border-t border-white/5 flex justify-between items-center text-[10px] font-bold text-slate-500 group-hover:text-purple-400 transition-colors">
                                      <span>{dayPatients.length} paciente{dayPatients.length !== 1 ? 's' : ''}</span>
                                      <span className="flex items-center gap-0.5 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <Plus className="w-3 h-3" /> Gerenciar
                                      </span>
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              </div>
          </div>
      );
  };

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
                                    <div className="flex justify-end gap-2 items-center">
                                        <button 
                                            onClick={() => setEditingPatient(p)}
                                            className="size-8 flex items-center justify-center rounded-lg bg-panel hover:bg-purple-500 hover:text-white border border-border text-slate-400 transition-all shadow-sm"
                                            title="Editar Informações do Paciente"
                                        >
                                            <span className="material-symbols-outlined text-sm">edit</span>
                                        </button>
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
                                        <button 
                                            onClick={() => handleDeletePatient(p.id, p.name)}
                                            className="px-2 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/20 transition-all text-xs font-bold flex items-center justify-center gap-1"
                                            title="Excluir Paciente Permanentemente"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
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
    <>
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
               {activeSubTab === 'calendar' && renderCalendar()}
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

      {/* Delete Patient Warning Modal */}
      {deleteModalInfo?.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
              <div className="bg-surface border border-red-500/30 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                  {/* Modal Header */}
                  <div className="p-5 border-b border-border bg-red-950/30 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
                              <span className="material-symbols-outlined text-2xl">warning</span>
                          </div>
                          <div>
                              <h3 className="text-base font-bold text-text">Excluir Paciente</h3>
                              <p className="text-[11px] text-red-400 font-medium">Atenção: Ação Irreversível</p>
                          </div>
                      </div>
                      <button 
                          onClick={() => setDeleteModalInfo(null)} 
                          disabled={isDeletingPatient}
                          className="text-slate-400 hover:text-text transition-colors p-1"
                      >
                          <span className="material-symbols-outlined">close</span>
                      </button>
                  </div>

                  {/* Modal Body */}
                  <div className="p-6 flex flex-col gap-4">
                      <p className="text-sm text-slate-200 leading-relaxed">
                          Você está prestes a excluir permanentemente o paciente <strong className="text-white font-bold">{deleteModalInfo.patientName}</strong>.
                      </p>

                      <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-start gap-3">
                          <span className="material-symbols-outlined text-red-400 text-lg shrink-0 mt-0.5">error</span>
                          <span>
                              Esta ação removerá todos os registros de consultas, frequências e observações cadastradas no banco de dados. <strong>Esta operação não pode ser desfeita.</strong>
                          </span>
                      </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="p-4 border-t border-border bg-surface-high/50 flex justify-end gap-3">
                      <button 
                          onClick={() => setDeleteModalInfo(null)} 
                          disabled={isDeletingPatient}
                          className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-all"
                      >
                          Cancelar
                      </button>
                      <button 
                          onClick={confirmDeletePatient} 
                          disabled={isDeletingPatient}
                          className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-950/40 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                      >
                          {isDeletingPatient ? (
                              <>
                                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                  Excluindo...
                              </>
                          ) : (
                              <>
                                  <Trash2 className="w-4 h-4" />
                                  Excluir Definitivamente
                              </>
                          )}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Monthly Calendar Day Detail Modal */}
      {selectedCalendarDay && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-in fade-in duration-200">
              <div className="bg-surface border border-border w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  {/* Modal Header */}
                  <div className="p-6 border-b border-border flex justify-between items-center bg-panel/50">
                      <div className="flex items-center gap-3">
                          <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
                              <Calendar className="w-6 h-6" />
                          </div>
                          <div>
                              <h3 className="text-xl font-bold font-display text-text">
                                  {selectedCalendarDay.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                              </h3>
                              <p className="text-xs text-slate-400">Gerenciamento de consultas e presença neste dia</p>
                          </div>
                      </div>
                      <button 
                          onClick={() => { setSelectedCalendarDay(null); setSelectedPatientForSchedule(''); }}
                          className="text-slate-400 hover:text-text p-2 hover:bg-panel rounded-lg transition-colors"
                      >
                          <X className="w-5 h-5" />
                      </button>
                  </div>

                  {/* Modal Body */}
                  <div className="p-6 overflow-y-auto flex flex-col gap-6 custom-scrollbar">
                      {/* Day Note Section */}
                      {(() => {
                          const dateKey = formatDateKey(selectedCalendarDay);
                          const note = dayNotes[dateKey] || '';
                          return (
                              <div className="bg-panel p-4 rounded-xl border border-border flex flex-col gap-2">
                                  <div className="flex justify-between items-center">
                                      <label className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                                          <StickyNote className="w-4 h-4" /> Observações / Lembrete do Dia
                                      </label>
                                  </div>
                                  <div className="flex gap-2">
                                      <input 
                                          type="text"
                                          placeholder="Ex: Dra. Ana atende até 16h / Entregar alinhadores..."
                                          defaultValue={note}
                                          key={dateKey}
                                          onBlur={(e) => handleSaveDayNote(dateKey, e.target.value)}
                                          onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                  handleSaveDayNote(dateKey, (e.target as HTMLInputElement).value);
                                              }
                                          }}
                                          className="flex-1 bg-surface border border-border rounded-lg text-xs text-text px-3 py-2 outline-none focus:border-amber-500"
                                      />
                                  </div>
                              </div>
                          );
                      })()}

                      {/* Add/Schedule Patient Control */}
                      <div className="bg-purple-950/20 border border-purple-500/30 p-4 rounded-xl flex flex-col gap-3">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-2">
                              <UserPlus className="w-4 h-4" /> Agendar / Marcar Presença de Paciente
                          </h4>
                          <div className="flex flex-wrap gap-2">
                              <select 
                                  value={selectedPatientForSchedule}
                                  onChange={(e) => setSelectedPatientForSchedule(e.target.value)}
                                  className="flex-1 min-w-[200px] bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text outline-none focus:border-purple-500"
                              >
                                  <option value="">Selecione um paciente...</option>
                                  {patients.map(p => (
                                      <option key={p.id} value={p.id}>{p.name} ({p.applianceType})</option>
                                  ))}
                              </select>

                              <select 
                                  value={newScheduleStatus}
                                  onChange={(e) => setNewScheduleStatus(e.target.value as any)}
                                  className="bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text outline-none focus:border-purple-500"
                              >
                                  <option value="Scheduled">Agendado</option>
                                  <option value="Present">Presente</option>
                                  <option value="Absent">Ausente</option>
                              </select>

                              <button 
                                  onClick={() => {
                                      if (!selectedPatientForSchedule) {
                                          toast.error('Selecione um paciente!');
                                          return;
                                      }
                                      const dateKey = formatDateKey(selectedCalendarDay);
                                      setPatientDailyStatus(selectedPatientForSchedule, dateKey, newScheduleStatus);
                                      setSelectedPatientForSchedule('');
                                  }}
                                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5"
                              >
                                  <Plus className="w-4 h-4" /> Confirmar
                              </button>
                          </div>
                      </div>

                      {/* Scheduled Patients List */}
                      <div className="flex flex-col gap-3">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                              Pacientes do Dia ({patients.filter(p => {
                                  const dateKey = formatDateKey(selectedCalendarDay);
                                  const status = p.attendance?.[dateKey];
                                  return status && status !== 'None';
                              }).length})
                          </h4>

                          <div className="flex flex-col gap-2 max-h-[250px] overflow-y-auto custom-scrollbar">
                              {(() => {
                                  const dateKey = formatDateKey(selectedCalendarDay);
                                  const dayPatients = patients.filter(p => {
                                      const status = p.attendance?.[dateKey];
                                      return status && status !== 'None';
                                  });

                                  if (dayPatients.length === 0) {
                                      return (
                                          <div className="p-8 text-center bg-panel/50 border border-border rounded-xl text-slate-500 text-xs italic">
                                              Nenhum paciente agendado para esta data.
                                          </div>
                                      );
                                  }

                                  return dayPatients.map(p => {
                                      const status = p.attendance?.[dateKey];
                                      return (
                                          <div key={p.id} className="p-3 bg-panel rounded-xl border border-border flex items-center justify-between gap-3">
                                              <div>
                                                  <span className="font-bold text-sm text-text block">{p.name}</span>
                                                  <span className="text-xs text-slate-400">{p.applianceType} • Mensalidade: R$ {p.maintenanceValue}</span>
                                              </div>

                                              <div className="flex items-center gap-2">
                                                  <div className="flex gap-1 bg-surface p-1 rounded-lg border border-border">
                                                      <button 
                                                          onClick={() => setPatientDailyStatus(p.id, dateKey, 'Scheduled')}
                                                          className={`px-2 py-1 text-[10px] font-bold rounded ${status === 'Scheduled' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-text'}`}
                                                          title="Marcar Agendado"
                                                      >
                                                          Agendado
                                                      </button>
                                                      <button 
                                                          onClick={() => setPatientDailyStatus(p.id, dateKey, 'Present')}
                                                          className={`px-2 py-1 text-[10px] font-bold rounded ${status === 'Present' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-text'}`}
                                                          title="Marcar Presente"
                                                      >
                                                          Presente
                                                      </button>
                                                      <button 
                                                          onClick={() => setPatientDailyStatus(p.id, dateKey, 'Absent')}
                                                          className={`px-2 py-1 text-[10px] font-bold rounded ${status === 'Absent' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-text'}`}
                                                          title="Marcar Ausente"
                                                      >
                                                          Ausente
                                                      </button>
                                                  </div>

                                                  <button 
                                                      onClick={() => setPatientDailyStatus(p.id, dateKey, 'None')}
                                                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                                                      title="Remover do dia"
                                                  >
                                                      <X className="w-4 h-4" />
                                                  </button>
                                              </div>
                                          </div>
                                      );
                                  });
                              })()}
                          </div>
                      </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="p-4 border-t border-border bg-surface-high/50 flex justify-end">
                      <button 
                          onClick={() => { setSelectedCalendarDay(null); setSelectedPatientForSchedule(''); }}
                          className="px-5 py-2 rounded-xl bg-panel hover:bg-surface border border-border text-xs font-bold text-text transition-colors"
                      >
                          Fechar
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
      {/* Edit Patient Modal */}
      {editingPatient && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
              <div className="bg-surface border border-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                  <div className="p-6 border-b border-border bg-panel flex justify-between items-center">
                      <h3 className="text-lg font-bold text-text font-display flex items-center gap-2">
                          <span className="material-symbols-outlined text-purple-400">edit</span>
                          Editar Paciente Ortodôntico
                      </h3>
                      <button onClick={() => setEditingPatient(null)} className="text-slate-400 hover:text-text">
                          <span className="material-symbols-outlined">close</span>
                      </button>
                  </div>
                  <div className="p-6 flex flex-col gap-4">
                      <div className="flex flex-col gap-2">
                          <label className="text-xs font-bold text-slate-400 uppercase">Nome do Paciente</label>
                          <input 
                              type="text"
                              value={editingPatient.name}
                              onChange={(e) => setEditingPatient({ ...editingPatient, name: e.target.value })}
                              className="bg-panel border border-border rounded-xl px-4 py-3 text-text font-bold outline-none focus:border-purple-500"
                          />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="flex flex-col gap-2">
                              <label className="text-xs font-bold text-slate-400 uppercase">Valor da Mensalidade (R$)</label>
                              <input 
                                  type="number"
                                  value={editingPatient.maintenanceValue}
                                  onChange={(e) => setEditingPatient({ ...editingPatient, maintenanceValue: parseFloat(e.target.value) || 0 })}
                                  className="bg-panel border border-border rounded-xl px-4 py-3 text-text font-bold outline-none focus:border-purple-500"
                              />
                          </div>

                          <div className="flex flex-col gap-2">
                              <label className="text-xs font-bold text-slate-400 uppercase">Tipo de Aparelho</label>
                              <select 
                                  value={editingPatient.applianceType}
                                  onChange={(e) => setEditingPatient({ ...editingPatient, applianceType: e.target.value })}
                                  className="bg-panel border border-border rounded-xl px-4 py-3 text-text font-bold outline-none focus:border-purple-500"
                              >
                                  {applianceTypes.map(app => (
                                      <option key={app.id} value={app.name} className="bg-surface text-text">{app.name}</option>
                                  ))}
                              </select>
                          </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="flex flex-col gap-2">
                              <label className="text-xs font-bold text-slate-400 uppercase">Data de Início</label>
                              <input 
                                  type="date"
                                  value={editingPatient.startDate || ''}
                                  onChange={(e) => setEditingPatient({ ...editingPatient, startDate: e.target.value })}
                                  className="bg-panel border border-border rounded-xl px-4 py-3 text-text font-bold outline-none focus:border-purple-500"
                              />
                          </div>

                          <div className="flex flex-col gap-2">
                              <label className="text-xs font-bold text-slate-400 uppercase">Status</label>
                              <select 
                                  value={editingPatient.status}
                                  onChange={(e) => setEditingPatient({ ...editingPatient, status: e.target.value as any })}
                                  className="bg-panel border border-border rounded-xl px-4 py-3 text-text font-bold outline-none focus:border-purple-500"
                              >
                                  <option value="Active">Ativo</option>
                                  <option value="Finished">Finalizado</option>
                                  <option value="Suspended">Suspenso</option>
                              </select>
                          </div>
                      </div>

                      <div className="flex flex-col gap-2">
                          <label className="text-xs font-bold text-slate-400 uppercase">Observações / Alerta Clínico</label>
                          <textarea 
                              value={editingPatient.problemNote || ''}
                              onChange={(e) => setEditingPatient({ ...editingPatient, problemNote: e.target.value })}
                              placeholder="Observações ou alertas sobre o tratamento..."
                              className="bg-panel border border-border rounded-xl px-4 py-3 text-text outline-none focus:border-purple-500 h-24 resize-none text-xs"
                          />
                      </div>
                  </div>
                  <div className="p-4 border-t border-border bg-surface-high/50 flex justify-end gap-3">
                      <button onClick={() => setEditingPatient(null)} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-all">Cancelar</button>
                      <button onClick={handleSaveEditedPatient} className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-950/40 transition-all">Salvar Alterações</button>
                  </div>
              </div>
          </div>
      )}
    </>
  );
};
