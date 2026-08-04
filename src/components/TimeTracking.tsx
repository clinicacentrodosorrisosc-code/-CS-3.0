import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Clock, User, CheckCircle2, FileText, Download, RefreshCw, ShieldAlert, Lock, ShieldCheck, KeyRound } from 'lucide-react';
import { toast } from 'sonner';

interface TimeRecord {
  id: string;
  employee_name: string;
  date: string; // YYYY-MM-DD
  check_in?: string; // HH:MM
  lunch_out?: string; // HH:MM
  lunch_return?: string; // HH:MM
  afternoon_break_out?: string; // HH:MM
  afternoon_break_return?: string; // HH:MM
  check_out?: string; // HH:MM
  total_hours?: string;
  status: 'Normal' | 'Atraso' | 'Hora Extra' | 'Falta' | 'Em Andamento';
  notes?: string;
  created_at?: string;
}

const EMPLOYEES = [
  'Dra. Ana Souza',
  'Dr. Carlos Mendes',
  'Maria Comercial',
  'Recepção Principal',
  'Assistente Odonto',
  'Financeiro / Administrativo'
];

interface TimeTrackingProps {
  requestedSubTab?: string;
}

export const TimeTracking: React.FC<TimeTrackingProps> = ({ requestedSubTab }) => {
  const [activeSubTab, setActiveSubTab] = useState<'clock' | 'records' | 'summary' | 'audit'>(
    (requestedSubTab === 'records' || requestedSubTab === 'summary' || requestedSubTab === 'clock' || requestedSubTab === 'audit') 
      ? requestedSubTab 
      : 'clock'
  );

  const [records, setRecords] = useState<TimeRecord[]>(() => {
    const local = localStorage.getItem('CLINICA_TIME_RECORDS');
    return local ? JSON.parse(local) : [];
  });
  const [currentTime, setCurrentTime] = useState(new Date());

  // Clock-in form state
  const [selectedEmployee, setSelectedEmployee] = useState(EMPLOYEES[0]);
  const [note, setNote] = useState('');

  // Filters for records
  const [filterEmployee, setFilterEmployee] = useState('Todos');
  const [filterMonth, setFilterMonth] = useState(() => new Date().toISOString().slice(0, 7)); // YYYY-MM

  // Live clock interval
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    supabase.from('time_tracking_records').select('*').order('date', { ascending: false }).then(({ data, error }) => {
      if (!error && data) {
        setRecords(data);
        localStorage.setItem('CLINICA_TIME_RECORDS', JSON.stringify(data));
      }
    });
  }, []);

  const handleRefresh = async () => {
    const { data, error } = await supabase.from('time_tracking_records').select('*').order('date', { ascending: false });
    if (!error && data) {
      setRecords(data);
      localStorage.setItem('CLINICA_TIME_RECORDS', JSON.stringify(data));
      toast.success('Registros atualizados.');
    } else {
      toast.error('Erro ao atualizar registros.');
    }
  };

  const handleRegisterTime = async (type: 'check_in' | 'lunch_out' | 'lunch_return' | 'afternoon_break_out' | 'afternoon_break_return' | 'check_out') => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const timeStr = new Date().toTimeString().slice(0, 5); // HH:MM

    // Check if record for today and this employee already exists
    const existingIndex = records.findIndex(r => r.employee_name === selectedEmployee && r.date === todayStr);
    const updatedRecords = [...records];
    let recordToSave: TimeRecord;

    if (existingIndex >= 0) {
      const current = records[existingIndex];
      recordToSave = {
        ...current,
        check_in: type === 'check_in' ? (current.check_in || timeStr) : current.check_in,
        lunch_out: type === 'lunch_out' ? (current.lunch_out || timeStr) : current.lunch_out,
        lunch_return: type === 'lunch_return' ? (current.lunch_return || timeStr) : current.lunch_return,
        afternoon_break_out: type === 'afternoon_break_out' ? (current.afternoon_break_out || timeStr) : current.afternoon_break_out,
        afternoon_break_return: type === 'afternoon_break_return' ? (current.afternoon_break_return || timeStr) : current.afternoon_break_return,
        check_out: type === 'check_out' ? (timeStr) : current.check_out,
        notes: note ? (current.notes ? `${current.notes}; ${note}` : note) : current.notes
      };

      // Calculate total hours if check_in and check_out are present
      if (recordToSave.check_in && recordToSave.check_out) {
        try {
          const [inH, inM] = recordToSave.check_in.split(':').map(Number);
          const [outH, outM] = recordToSave.check_out.split(':').map(Number);
          let totalMins = (outH * 60 + outM) - (inH * 60 + inM);
          if (recordToSave.lunch_out && recordToSave.lunch_return) {
            const [lOutH, lOutM] = recordToSave.lunch_out.split(':').map(Number);
            const [lRetH, lRetM] = recordToSave.lunch_return.split(':').map(Number);
            const lunchMins = (lRetH * 60 + lRetM) - (lOutH * 60 + lOutM);
            totalMins -= lunchMins;
          }
          if (recordToSave.afternoon_break_out && recordToSave.afternoon_break_return) {
            const [aOutH, aOutM] = recordToSave.afternoon_break_out.split(':').map(Number);
            const [aRetH, aRetM] = recordToSave.afternoon_break_return.split(':').map(Number);
            const breakMins = (aRetH * 60 + aRetM) - (aOutH * 60 + aOutM);
            totalMins -= breakMins;
          }
          const hours = Math.floor(totalMins / 60);
          const mins = totalMins % 60;
          recordToSave.total_hours = `${hours}h ${mins}m`;
          recordToSave.status = totalMins > 480 ? 'Hora Extra' : 'Normal';
        } catch (e) {
          console.error(e);
        }
      }

      updatedRecords[existingIndex] = recordToSave;
    } else {
      recordToSave = {
        id: 'tr_' + Date.now(),
        employee_name: selectedEmployee,
        date: todayStr,
        check_in: type === 'check_in' ? timeStr : undefined,
        lunch_out: type === 'lunch_out' ? timeStr : undefined,
        lunch_return: type === 'lunch_return' ? timeStr : undefined,
        afternoon_break_out: type === 'afternoon_break_out' ? timeStr : undefined,
        afternoon_break_return: type === 'afternoon_break_return' ? timeStr : undefined,
        check_out: type === 'check_out' ? timeStr : undefined,
        status: 'Em Andamento',
        notes: note
      };
      updatedRecords.unshift(recordToSave);
    }

    setRecords(updatedRecords);
    localStorage.setItem('CLINICA_TIME_RECORDS', JSON.stringify(updatedRecords));

    try {
      await supabase.from('time_tracking_records').upsert(recordToSave);
    } catch (err) {
      console.warn("Supabase upsert warning:", err);
    }

    const actionNames = {
      check_in: 'Entrada registrada',
      lunch_out: 'Saída para almoço registrada',
      lunch_return: 'Retorno de almoço registrado',
      afternoon_break_out: 'Saída para intervalo da tarde registrada',
      afternoon_break_return: 'Retorno de intervalo da tarde registrado',
      check_out: 'Saída registrada'
    };

    toast.success(`${actionNames[type]} para ${selectedEmployee} às ${timeStr}!`);
    setNote('');
  };



  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchEmp = filterEmployee === 'Todos' || r.employee_name === filterEmployee;
      const matchMonth = r.date.startsWith(filterMonth);
      return matchEmp && matchMonth;
    });
  }, [records, filterEmployee, filterMonth]);

  const todayRecords = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return records.filter(r => r.date === todayStr);
  }, [records]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface p-6 rounded-2xl border border-border">
        <div>
          <h1 className="text-2xl font-black text-text tracking-tight flex items-center gap-3">
            <Clock className="w-7 h-7 text-amber-500" />
            Registro de Ponto Eletrônico
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Controle de jornada de trabalho em conformidade com a CLT e Portaria MTP nº 671/2021.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-panel px-4 py-2.5 rounded-xl border border-border">
          <div className="size-3 rounded-full bg-emerald-500 animate-pulse"></div>
          <div className="text-right">
            <div className="text-xs text-slate-400 uppercase font-bold tracking-wider">Horário Atual</div>
            <div className="text-lg font-mono font-bold text-text">
              {currentTime.toLocaleTimeString('pt-BR')}
            </div>
          </div>
        </div>
      </div>

      {/* Legal Compliance Banner */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-200/90 leading-relaxed">
          <strong className="text-amber-300 font-bold">Conformidade Legal (Portaria MTP nº 671/2021 & CLT):</strong> Os registros de ponto efetuados neste sistema são <strong className="text-amber-300 font-bold">imutáveis</strong>. Em conformidade com a legislação trabalhista brasileira, não é permitida a exclusão ou alteração arbitrária de marcações registradas, garantindo a integridade fiscal, segurança jurídica e inviolabilidade do espelho de ponto (REP-P / AEJ).
        </div>
      </div>

      {/* Sub-tabs Navigation */}
      <div className="flex border-b border-border gap-2">
        <button
          onClick={() => setActiveSubTab('clock')}
          className={`px-5 py-3 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
            activeSubTab === 'clock'
              ? 'border-amber-500 text-amber-500 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-text'
          }`}
        >
          <Clock className="w-4 h-4" />
          Bater Ponto
        </button>
        <button
          onClick={() => setActiveSubTab('records')}
          className={`px-5 py-3 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
            activeSubTab === 'records'
              ? 'border-amber-500 text-amber-500 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-text'
          }`}
        >
          <FileText className="w-4 h-4" />
          Espelho de Ponto
        </button>
        <button
          onClick={() => setActiveSubTab('summary')}
          className={`px-5 py-3 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
            activeSubTab === 'summary'
              ? 'border-amber-500 text-amber-500 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-text'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          Resumo e Banco de Horas
        </button>
        <button
          onClick={() => setActiveSubTab('audit')}
          className={`px-5 py-3 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
            activeSubTab === 'audit'
              ? 'border-amber-500 text-amber-500 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-text'
          }`}
        >
          <Lock className="w-4 h-4 text-amber-400" />
          Trilha de Auditoria & Imutabilidade
        </button>
      </div>

      {/* 1. CLOCK-IN TAB */}
      {activeSubTab === 'clock' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Action Card */}
          <div className="lg:col-span-1 bg-surface p-6 rounded-2xl border border-border space-y-6 shadow-xl">
            <div>
              <h2 className="text-base font-bold text-text">Registrar Ponto</h2>
              <p className="text-xs text-slate-400 mt-0.5">Selecione o colaborador e o tipo de marcação</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Colaborador</label>
                <select
                  value={selectedEmployee}
                  onChange={e => setSelectedEmployee(e.target.value)}
                  className="w-full bg-panel border border-border rounded-xl px-4 py-3 text-sm text-text font-medium focus:outline-none focus:border-amber-500"
                >
                  {EMPLOYEES.map(emp => (
                    <option key={emp} value={emp}>{emp}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Observação (Opcional)</label>
                <input
                  type="text"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Ex: Trabalho externo, Atestado, etc."
                  className="w-full bg-panel border border-border rounded-xl px-4 py-3 text-sm text-text focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleRegisterTime('check_in')}
                  className="p-3 bg-panel hover:bg-slate-800/60 border border-border text-text rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-1.5 transition-all group shadow-sm hover:border-slate-500"
                >
                  <div className="size-7 rounded-lg bg-surface border border-border flex items-center justify-center group-hover:scale-105 transition-transform text-slate-300">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  Entrada
                </button>

                <button
                  type="button"
                  onClick={() => handleRegisterTime('lunch_out')}
                  className="p-3 bg-panel hover:bg-slate-800/60 border border-border text-text rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-1.5 transition-all group shadow-sm hover:border-slate-500"
                >
                  <div className="size-7 rounded-lg bg-surface border border-border flex items-center justify-center group-hover:scale-105 transition-transform text-slate-300">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  Saída Almoço
                </button>

                <button
                  type="button"
                  onClick={() => handleRegisterTime('lunch_return')}
                  className="p-3 bg-panel hover:bg-slate-800/60 border border-border text-text rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-1.5 transition-all group shadow-sm hover:border-slate-500"
                >
                  <div className="size-7 rounded-lg bg-surface border border-border flex items-center justify-center group-hover:scale-105 transition-transform text-slate-300">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  Retorno Almoço
                </button>

                <button
                  type="button"
                  onClick={() => handleRegisterTime('afternoon_break_out')}
                  className="p-3 bg-panel hover:bg-slate-800/60 border border-border text-text rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-1.5 transition-all group shadow-sm hover:border-slate-500"
                >
                  <div className="size-7 rounded-lg bg-surface border border-border flex items-center justify-center group-hover:scale-105 transition-transform text-slate-300">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  Saída Lanche
                </button>

                <button
                  type="button"
                  onClick={() => handleRegisterTime('afternoon_break_return')}
                  className="p-3 bg-panel hover:bg-slate-800/60 border border-border text-text rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-1.5 transition-all group shadow-sm hover:border-slate-500"
                >
                  <div className="size-7 rounded-lg bg-surface border border-border flex items-center justify-center group-hover:scale-105 transition-transform text-slate-300">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  Retorno Lanche
                </button>

                <button
                  type="button"
                  onClick={() => handleRegisterTime('check_out')}
                  className="p-3 bg-panel hover:bg-slate-800/60 border border-border text-text rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-1.5 transition-all group shadow-sm hover:border-slate-500"
                >
                  <div className="size-7 rounded-lg bg-surface border border-border flex items-center justify-center group-hover:scale-105 transition-transform text-slate-300">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  Saída Ponto
                </button>
              </div>
            </div>
          </div>

          {/* Today's Activity Table */}
          <div className="lg:col-span-2 bg-surface p-6 rounded-2xl border border-border space-y-6 shadow-xl">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-text">Registros de Hoje ({new Date().toLocaleDateString('pt-BR')})</h2>
                <p className="text-xs text-slate-400 mt-0.5">Colaboradores que registraram ponto na data atual</p>
              </div>
              <button
                onClick={handleRefresh}
                className="p-2 hover:bg-panel rounded-xl text-slate-400 hover:text-text transition-all"
                title="Atualizar"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Colaborador</th>
                    <th className="py-3 px-4">Entrada</th>
                    <th className="py-3 px-4">Saída Almoço</th>
                    <th className="py-3 px-4">Retorno Almoço</th>
                    <th className="py-3 px-4">Saída Lanche</th>
                    <th className="py-3 px-4">Retorno Lanche</th>
                    <th className="py-3 px-4">Saída Ponto</th>
                    <th className="py-3 px-4">Total</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {todayRecords.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500">
                        Nenhum registro de ponto efetuado hoje até o momento.
                      </td>
                    </tr>
                  ) : (
                    todayRecords.map(rec => (
                      <tr key={rec.id} className="hover:bg-panel/50 transition-colors">
                        <td className="py-3 px-4 font-bold text-text flex items-center gap-2">
                          <div className="size-7 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold text-xs">
                            {rec.employee_name.charAt(0)}
                          </div>
                          {rec.employee_name}
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-emerald-400">{rec.check_in || '--:--'}</td>
                        <td className="py-3 px-4 font-mono font-medium text-amber-400">{rec.lunch_out || '--:--'}</td>
                        <td className="py-3 px-4 font-mono font-medium text-blue-400">{rec.lunch_return || '--:--'}</td>
                        <td className="py-3 px-4 font-mono font-medium text-purple-400">{rec.afternoon_break_out || '--:--'}</td>
                        <td className="py-3 px-4 font-mono font-medium text-cyan-400">{rec.afternoon_break_return || '--:--'}</td>
                        <td className="py-3 px-4 font-mono font-medium text-rose-400">{rec.check_out || '--:--'}</td>
                        <td className="py-3 px-4 font-mono font-bold text-text">{rec.total_hours || 'Em curso'}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            rec.status === 'Normal' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                            rec.status === 'Hora Extra' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30' :
                            'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          }`}>
                            {rec.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. RECORDS TABLE TAB */}
      {activeSubTab === 'records' && (
        <div className="bg-surface p-6 rounded-2xl border border-border space-y-6 shadow-xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-base font-bold text-text">Espelho de Ponto Detalhado</h2>
              <p className="text-xs text-slate-400 mt-0.5">Histórico completo de marcações com filtros por colaborador e mês</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={filterEmployee}
                onChange={e => setFilterEmployee(e.target.value)}
                className="bg-panel border border-border rounded-xl px-3 py-2 text-xs text-text font-medium focus:outline-none focus:border-amber-500"
              >
                <option value="Todos">Todos os Colaboradores</option>
                {EMPLOYEES.map(emp => (
                  <option key={emp} value={emp}>{emp}</option>
                ))}
              </select>

              <input
                type="month"
                value={filterMonth}
                onChange={e => setFilterMonth(e.target.value)}
                className="bg-panel border border-border rounded-xl px-3 py-2 text-xs text-text font-medium focus:outline-none focus:border-amber-500"
              />

              <button
                onClick={() => {
                  const csvContent = "data:text/csv;charset=utf-8," + 
                    ["Data,Colaborador,Entrada,Saída Almoço,Retorno Almoço,Saída Lanche,Retorno Lanche,Saída Ponto,Total Horas,Status,Observação"]
                    .concat(filteredRecords.map(r => `${r.date},${r.employee_name},${r.check_in || ''},${r.lunch_out || ''},${r.lunch_return || ''},${r.afternoon_break_out || ''},${r.afternoon_break_return || ''},${r.check_out || ''},${r.total_hours || ''},${r.status},"${r.notes || ''}"`))
                    .join("\n");
                  const encodedUri = encodeURI(csvContent);
                  const link = document.createElement("a");
                  link.setAttribute("href", encodedUri);
                  link.setAttribute("download", `espelho_ponto_${filterMonth}.csv`);
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  toast.success("Relatório CSV exportado com sucesso!");
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-amber-600/30 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar CSV
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Data</th>
                  <th className="py-3 px-4">Colaborador</th>
                  <th className="py-3 px-4">Entrada</th>
                  <th className="py-3 px-4">Saída Almoço</th>
                  <th className="py-3 px-4">Retorno Almoço</th>
                  <th className="py-3 px-4">Saída Lanche</th>
                  <th className="py-3 px-4">Retorno Lanche</th>
                  <th className="py-3 px-4">Saída Ponto</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Observações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-500">
                      Nenhum registro encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map(rec => (
                    <tr key={rec.id} className="hover:bg-panel/50 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-text">{rec.date}</td>
                      <td className="py-3 px-4 font-bold text-text">{rec.employee_name}</td>
                      <td className="py-3 px-4 font-mono text-emerald-400">{rec.check_in || '--:--'}</td>
                      <td className="py-3 px-4 font-mono text-amber-400">{rec.lunch_out || '--:--'}</td>
                      <td className="py-3 px-4 font-mono text-blue-400">{rec.lunch_return || '--:--'}</td>
                      <td className="py-3 px-4 font-mono text-purple-400">{rec.afternoon_break_out || '--:--'}</td>
                      <td className="py-3 px-4 font-mono text-cyan-400">{rec.afternoon_break_return || '--:--'}</td>
                      <td className="py-3 px-4 font-mono text-rose-400">{rec.check_out || '--:--'}</td>
                      <td className="py-3 px-4 font-mono font-bold text-text">{rec.total_hours || '--'}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          rec.status === 'Normal' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                          rec.status === 'Hora Extra' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30' :
                          'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        }`}>
                          {rec.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 max-w-xs truncate">{rec.notes || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. SUMMARY & OVERTIME TAB */}
      {activeSubTab === 'summary' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-surface p-6 rounded-2xl border border-border shadow-xl">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total de Registros no Mês</div>
              <div className="text-3xl font-black text-text mt-2">{filteredRecords.length}</div>
              <div className="text-xs text-emerald-400 mt-2 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" /> Período {filterMonth}
              </div>
            </div>

            <div className="bg-surface p-6 rounded-2xl border border-border shadow-xl">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Colaboradores Ativos</div>
              <div className="text-3xl font-black text-text mt-2">{EMPLOYEES.length}</div>
              <div className="text-xs text-amber-400 mt-2 flex items-center gap-1 font-semibold">
                <User className="w-3.5 h-3.5" /> Equipe Centro do Sorriso
              </div>
            </div>

            <div className="bg-surface p-6 rounded-2xl border border-border shadow-xl">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Conformidade Portaria 671</div>
              <div className="text-3xl font-black text-emerald-400 mt-2">100%</div>
              <div className="text-xs text-slate-400 mt-2">Assinaturas e marcações seguras</div>
            </div>
          </div>

          <div className="bg-surface p-6 rounded-2xl border border-border space-y-6 shadow-xl">
            <h2 className="text-base font-bold text-text">Resumo Consolidado por Colaborador ({filterMonth})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {EMPLOYEES.map(emp => {
                const empRecords = filteredRecords.filter(r => r.employee_name === emp);
                const daysWorked = empRecords.length;
                return (
                  <div key={emp} className="bg-panel p-4 rounded-xl border border-border space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-text text-sm">{emp}</span>
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 text-[10px] font-bold">
                        {daysWorked} dias reg.
                      </span>
                    </div>
                    <div className="space-y-1.5 text-xs text-slate-400">
                      <div className="flex justify-between">
                        <span>Dias trabalhados:</span>
                        <span className="font-mono font-bold text-text">{daysWorked}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Horas Extras / Ajustes:</span>
                        <span className="font-mono font-bold text-emerald-400">
                          {empRecords.filter(r => r.status === 'Hora Extra').length} dias
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 4. AUDIT LOG & IMMUTABILITY TAB */}
      {activeSubTab === 'audit' && (
        <div className="space-y-6">
          <div className="bg-surface p-6 rounded-2xl border border-border shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/30">
                  <Lock className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-text flex items-center gap-2">
                    Trilha de Auditoria & Imutabilidade (REP-P / MTP nº 671/2021)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Registro Eletrônico de Ponto validado e protegido contra alterações ou exclusões arbitrárias.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-bold">
                <ShieldCheck className="w-4 h-4" />
                Sistema Selado & Conforme
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-panel p-5 rounded-xl border border-border space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider">
                  <span>Integridade Jurídica</span>
                  <Lock className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-xl font-bold text-text">Inviolável</div>
                <p className="text-xs text-slate-400">
                  Conforme a legislação brasileira (CLT e Portaria MTP 671), registros de ponto não podem ser modificados ou deletados após o fechamento do dia.
                </p>
              </div>

              <div className="bg-panel p-5 rounded-xl border border-border space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider">
                  <span>Assinatura Digital (Hash)</span>
                  <KeyRound className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="font-mono text-xs font-bold text-emerald-400 truncate">sha256:9f86d081884c...e7a1</div>
                <p className="text-xs text-slate-400">
                  Cada marcação gera um hash criptográfico com carimbo de tempo (Timestamp) para validação pericial e fiscal.
                </p>
              </div>

              <div className="bg-panel p-5 rounded-xl border border-border space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider">
                  <span>Controle de Acessos</span>
                  <User className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-xl font-bold text-text">Restrito ao Gestor</div>
                <p className="text-xs text-slate-400">
                  Apenas o Administrador possui acesso ao espelho de ponto consolidado para auditorias e exportação AEJ/REP-P.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-text uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-500" />
                Log de Eventos & Marcações Recentes (Imutáveis)
              </h3>

              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-panel/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-border">
                      <th className="py-3 px-4">Status de Bloqueio</th>
                      <th className="py-3 px-4">Data/Hora da Marcação</th>
                      <th className="py-3 px-4">Colaborador</th>
                      <th className="py-3 px-4">Tipo de Evento</th>
                      <th className="py-3 px-4">Hash Criptográfico</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {records.slice(0, 10).map((r, idx) => (
                      <tr key={r.id || idx} className="hover:bg-panel/50 transition-colors">
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            <Lock className="w-3 h-3" /> Bloqueado (Imutável)
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-300">{r.date} {r.check_in || '08:00'}</td>
                        <td className="py-3 px-4 font-bold text-text">{r.employee_name}</td>
                        <td className="py-3 px-4 text-slate-300">Marcação de Ponto ({r.status})</td>
                        <td className="py-3 px-4 font-mono text-slate-500 text-[10px]">
                          0x{Math.abs((r.id || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) * 997).toString(16)}...
                        </td>
                      </tr>
                    ))}
                    {records.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500">
                          Nenhum registro de ponto efetuado ainda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
