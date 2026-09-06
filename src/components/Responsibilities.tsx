import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Responsibility } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  Edit, 
  ClipboardCheck, 
  User, 
  Search, 
  Loader2, 
  Info,
  Mail,
  Sparkles,
  FolderOpen,
  DollarSign,
  Users,
  Settings,
  Printer,
  Check,
  X,
  FileText,
  TrendingUp,
  BookOpen,
  RefreshCw
} from 'lucide-react';
import { ProcessAssistant } from './ProcessAssistant';

const MASTER_EMAIL = 'clinica.centrodosorrisosc@gmail.com';

const PERIODICITIES = [
  { value: 'daily', label: 'Diária', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  { value: 'weekly', label: 'Semanal', color: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30' },
  { value: 'monthly', label: 'Mensal', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  { value: 'occasional', label: 'Única / Ocasional', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' }
];

interface WorkInstruction {
  id: string;
  title: string;
  sector: 'Clínico' | 'Recepção' | 'Financeiro' | 'Geral' | 'Outro';
  objective: string;
  handler: string;
  steps: string[];
  createdAt: string;
  updatedAt: string;
}

interface ResponsibilitiesProps {
  requestedSubTab?: string | null;
}

export const Responsibilities: React.FC<ResponsibilitiesProps> = ({ requestedSubTab }) => {
  const [activeSubTab, setActiveSubTab] = useState<'processes' | 'responsibilities' | 'instructions'>('processes');
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Responsibilities & Profiles
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; email: string; role: string }[]>([]);

  // Search & Filter state for Responsibilities
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserFilter, setSelectedUserFilter] = useState('all');
  const [periodicityFilter, setPeriodicityFilter] = useState('all');

  // Form Modals State for Responsibilities
  const [showModal, setShowModal] = useState(false);
  const [editingResp, setEditingResp] = useState<Responsibility | null>(null);

  // New/Edit Responsibility Form Field States
  const [targetEmail, setTargetEmail] = useState('');
  const [isManualEmail, setIsManualEmail] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [periodicity, setPeriodicity] = useState<'daily' | 'weekly' | 'monthly' | 'occasional'>('daily');

  // Work Instructions State
  const [instructions, setInstructions] = useState<WorkInstruction[]>([]);
  const [instructionsLoading, setInstructionsLoading] = useState(false);
  const [showInstructionModal, setShowInstructionModal] = useState(false);
  const [editingInstruction, setEditingInstruction] = useState<WorkInstruction | null>(null);
  const [viewingInstruction, setViewingInstruction] = useState<WorkInstruction | null>(null);
  const [searchInstruction, setSearchInstruction] = useState('');
  const [sectorFilter, setSectorFilter] = useState('all');

  // Form Field States for Instruction
  const [instTitle, setInstTitle] = useState('');
  const [instSector, setInstSector] = useState<'Clínico' | 'Recepção' | 'Financeiro' | 'Geral' | 'Outro'>('Geral');
  const [instObjective, setInstObjective] = useState('');
  const [instHandler, setInstHandler] = useState('');
  const [instSteps, setInstSteps] = useState<string[]>(['']);

  // Print instruction reference for hidden container
  const [printData, setPrintData] = useState<WorkInstruction | null>(null);

  // Feedback Notification
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  const triggerFeedback = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setFeedback({ message, type });
  };

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Synchronize external requestedSubTab
  useEffect(() => {
    if (requestedSubTab) {
      if (requestedSubTab === 'processes') setActiveSubTab('processes');
      if (requestedSubTab === 'responsibilities') setActiveSubTab('responsibilities');
      if (requestedSubTab === 'instructions') setActiveSubTab('instructions');
    }
  }, [requestedSubTab]);

  // Read current user session and setup admin rights
  const loadSession = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setSessionUser(user);
        const isMaster = user.email === MASTER_EMAIL;
        
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        
        const isProfileAdmin = profile?.role === 'admin';
        setIsAdmin(isMaster || isProfileAdmin);
      }
    } catch (err) {
      console.error('Error fetching session data:', err);
    }
  };

  // Synchronized loaders
  const loadData = async () => {
    setLoading(true);
    await loadSession();

    // 1. Fetch user profiles list for assignment choice
    try {
      const { data } = await supabase.from('profiles').select('id, email, role');
      if (data) {
        setProfiles(data);
      }
    } catch (err) {
      console.error('Error loading profiles list:', err);
    }

    // 2. Fetch responsibilities list
    try {
      const { data, error } = await supabase
        .from('commercial_settings')
        .select('value')
        .eq('key', 'user_responsibilities')
        .single();

      if (!error && data && data.value && Array.isArray(data.value)) {
        setResponsibilities(data.value);
      } else {
        let local = null;
        try {
          local = localStorage.getItem('backup_responsibilities');
        } catch (e) {
          console.warn("Could not read backup_responsibilities in Responsibilities.tsx:", e);
        }
        if (local) {
          try {
            setResponsibilities(JSON.parse(local));
          } catch {
            setResponsibilities([]);
          }
        } else {
          setResponsibilities([]);
        }
      }
    } catch (err) {
      console.error('Error loading responsibilities from Supabase, loading fallback:', err);
      let local = null;
      try {
        local = localStorage.getItem('backup_responsibilities');
      } catch (e) {
        console.warn("Could not read fallback backup_responsibilities in Responsibilities.tsx:", e);
      }
      if (local) {
        try {
          setResponsibilities(JSON.parse(local));
        } catch {
          setResponsibilities([]);
        }
      }
    }

    // 3. Load work instructions
    await loadWorkInstructions();

    setLoading(false);
  };

  const loadWorkInstructions = async () => {
    setInstructionsLoading(true);
    try {
      const { data, error } = await supabase
        .from('commercial_settings')
        .select('value')
        .eq('key', 'clinical_work_instructions')
        .single();

      if (!error && data && data.value && Array.isArray(data.value)) {
        setInstructions(data.value);
      } else {
        // Formulate standard initial CLINICAL operational procedures (POPs)
        const defaultInstructions: WorkInstruction[] = [
          {
            id: 'pop-recepcao-checklist',
            title: 'Checklist Operacional da Recepção (v1.0)',
            sector: 'Recepção',
            objective: 'Padronizar o atendimento de novos pacientes, garantindo organização, acolhimento e o fluxo correto para a avaliação e setor comercial.',
            handler: 'Recepcionista e Secretária',
            steps: [
              'Preparação (Pré-chegada): Conferir agenda (nome, horário, profissional) e preparar ambiente (café, água, música ambiente).',
              'Recepção Inicial: Cumprimentar com postura cordial ("Bom dia, bem-vindo à Clínica Centro do Sorriso") e confirmar o nome e horário.',
              'Cadastro Inicial: Coletar dados obrigatórios (Nome, Nascimento, CPF, Telefone, Endereço, Origem, Queixa Principal).',
              'Orientação do Fluxo: Explicar as etapas: Avaliação com dentista -> Apresentação comercial de planos e valores.',
              'Encaminhamento: Chamar pelo nome, encaminhar até a sala correta e apresentar ao profissional responsável.',
              'Retorno Pós-Avaliação: Receber o paciente e direcioná-lo imediatamente ao setor comercial para negociação.',
              'Finalização: Registrar no sistema, agendar próximo horário ou programar follow-up caso não haja fechamento imediato.'
            ],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: 'pop-agenda-protocolo',
            title: 'Protocolo de Organização da Agenda',
            sector: 'Recepção',
            objective: 'Aumentar a produtividade e reduzir horários vagos, visando metas de 15 atendimentos diários (clínicos) ou 30 (clínico + orto).',
            handler: 'Equipe de Recepção e Gestão',
            steps: [
              'Metas de Atendimento: Planejar a agenda visando 15 presenças reais (dias clínicos) ou 30 (clínico+orto).',
              'Margem de Faltas: Agendar com 20-30% de gordura (ex: 19-21 pacientes para meta de 15) para compensar absenteísmo.',
              'Classificação de Horários: Diferenciar visualmente entre Avaliação Inicial, Procedimento, Retornos e Encaixes.',
              'Regra de Encaixe: Priorizar casos de dor, urgência estética e pacientes com alta chance de fechamento comercial.',
              'Confirmação Ativa: Realizar confirmação individual via WhatsApp 1 dia antes e lembrete rápido 2 horas antes da consulta.',
              'Controle de Absenteísmo: Registrar motivos de falta e reagendar o paciente imediatamente para não perder o ciclo de tratamento.',
              'Priorização: Pacientes que já pagaram ou que estão em meio a procedimentos longos têm prioridade total de horário.'
            ],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: 'pop-comercial-protocolo',
            title: 'Protocolo Comercial Pós-Avaliação',
            sector: 'Geral',
            objective: 'Garantir profissionalismo e clareza na apresentação de valores e formas de pagamento para converter avaliações em tratamentos.',
            handler: 'Setor Comercial e Consultores',
            steps: [
              'Divisão de Papéis: O dentista foca no diagnóstico clínico; o comercial foca na negociação, valores e fechamento.',
              'Transferência de Informação: O dentista deve reportar ao comercial a queixa, urgência e perfil psicológico do paciente.',
              'Sondagem de Necessidade: Entender as dores do paciente (autoestima, mastigação) antes de apresentar o preço.',
              'Apresentação da Proposta: Explicar o plano de tratamento focado em benefícios práticos e longevidade da saúde bucal.',
              'Condições de Pagamento: Oferecer Pix, Cartões ou Financiamento, buscando a parcela que cabe no orçamento do paciente.',
              'Gestão de Objeções: Tratar dúvidas sobre valores ou prazos de forma resolutiva ("O que te impede de começar hoje?").',
              'Fluxo de Fechamento: Se aprovado, emitir contrato e encaminhar à recepção para recebimento. Se não, programar follow-up.'
            ],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: 'pop-jornada-paciente',
            title: 'Jornada do Paciente (12 Etapas)',
            sector: 'Geral',
            objective: 'Padronizar a experiência completa do paciente, do primeiro contato à reativação de inativos, visando fidelização.',
            handler: 'Toda a Equipe',
            steps: [
              'Prospecção e Agendamento: Primeiro contato rápido e eficiente gerando autoridade e confiança.',
              'Confirmação Especializada: Lembretes estratégicos feitos pelo comercial para reduzir no-show.',
              'Acolhimento na Chegada: Recepção com hospitalidade, café e explicação clara do fluxo de atendimento.',
              'Protocolo de Avaliação: Diagnóstico humanizado pelo dentista com foco na queixa principal.',
              'Conversão Comercial: Apresentação profissional do plano de tratamento e negociação financeira.',
              'Pós-Venda Imediato: Contato em 7 dias após o primeiro procedimento para monitorar satisfação.',
              'Manutenção e Reavaliação: Campanhas de retorno preventivo a cada 6 meses para pacientes concluídos.',
              'Indicação Ativa: Solicitar indicações para pacientes satisfeitos (" Member Get Member").',
              'Reativação de Inativos: Contato para pacientes sem consultas há mais de 12 meses.'
            ],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: 'pop-experiencia-cliente',
            title: 'Protocolo de Experiência (Os 5 Sentidos)',
            sector: 'Recepção',
            objective: 'Encantar o paciente através do ambiente, transmitindo organização, confiança e higiene impecável.',
            handler: 'Recepcionista e Auxiliares',
            steps: [
              'Ambiente Visual: Recepção limpa, sem copos usados ou fios expostos; TV com antes/depois e depoimentos.',
              'Conforto Auditivo: Música instrumental ou jazz leve em volume baixo para reduzir a ansiedade clínica.',
              'Padrão Olfativo: Aroma suave (Lavanda ou Algodão) para neutralizar o "cheiro de consultório".',
              'Linguagem Positiva: Substituir "vai demorar" por "já estamos finalizando"; chamar sempre pelo nome.',
              'Hospitalidade: Água gelada e café sempre disponíveis e organizados com guardanapos.',
              'Apresentação Pessoal: Uniforme impecável, crachá visível e postura acolhedora (sorriso no rosto).'
            ],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: 'pop-prontuario-padrao',
            title: 'Padronização do Prontuário Clínico',
            sector: 'Clínico',
            objective: 'Garantir segurança jurídica, histórico completo e continuidade dos tratamentos via evoluções detalhadas.',
            handler: 'Cirurgião-Dentista e ASB',
            steps: [
              'Evolução Completa: Registrar obrigatoriamente: Queixa, Avaliação, Procedimento executado e Orientações.',
              'As 5 Perguntas: O que o paciente tinha? O que foi achado? O que foi feito? O que foi orientado? Próximo passo?',
              'Validação Legal: Coletar assinatura do paciente em cada atendimento (digital ou manual conforme sistema).',
              'Registro Comercial: Indicar no prontuário se a avaliação inicial foi encaminhada e aceita pelo setor comercial.',
              'Auditoria Semanal: Cordenação deve revisar 5 prontuários aleatórios por semana para garantir padrão de 95%.'
            ],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: 'pop-limpeza-esterilizacao',
            title: 'POP - Limpeza e Esterilização (Autoclave)',
            sector: 'Clínico',
            objective: 'Garantir a eliminação de microrganismos de todos os instrumentais para evitar contaminação cruzada.',
            handler: 'ASB e Dentistas',
            steps: [
              'Paramentação: Uso de luvas de borracha, máscara, jaleco e proteção facial.',
              'Limpeza: Imersão em detergente enzimático por 10 min seguido de escovação cuidadosa.',
              'Secagem: Secar completamente as peças (a umidade impede a esterilização correta).',
              'Embalagem: Envelopes em papel grau cirúrgico selados termicamente.',
              'Autoclavação: Ciclos completos com monitoramento químico e temperatura registrada diariamente.'
            ],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ];
        
        await supabase
          .from('commercial_settings')
          .upsert({ key: 'clinical_work_instructions', value: defaultInstructions }, { onConflict: 'key' });
        setInstructions(defaultInstructions);
      }
    } catch (err) {
      console.error('Error loading work instructions:', err);
    } finally {
      setInstructionsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save responsibilities list
  const persistChanges = async (updatedList: Responsibility[]) => {
    setSaving(true);
    try {
      localStorage.setItem('backup_responsibilities', JSON.stringify(updatedList));
    } catch (e) {
      console.warn("Could not write backup_responsibilities in Responsibilities.tsx:", e);
    }
    setResponsibilities(updatedList);

    try {
      const { data: exists } = await supabase
        .from('commercial_settings')
        .select('id')
        .eq('key', 'user_responsibilities')
        .single();

      if (exists) {
        await supabase
          .from('commercial_settings')
          .update({ value: updatedList, updated_at: new Date().toISOString() })
          .eq('key', 'user_responsibilities');
      } else {
        await supabase
          .from('commercial_settings')
          .insert({ key: 'user_responsibilities', value: updatedList });
      }
    } catch (err) {
      console.error('Database write error, local changes persisted:', err);
      triggerFeedback('Gravado localmente (erro ao sincronizar na rede).', 'warning');
    } finally {
      setSaving(false);
    }
  };

  // Open creation modal for Responsibilities
  const handleOpenCreateModal = () => {
    setEditingResp(null);
    setTitle('');
    setDescription('');
    setPeriodicity('daily');
    
    if (profiles.length > 0) {
      setTargetEmail(profiles[0].email || '');
      setIsManualEmail(false);
    } else {
      setTargetEmail('');
      setIsManualEmail(true);
    }
    
    setShowModal(true);
  };

  // Open edit modal for Responsibilities
  const handleOpenEditModal = (resp: Responsibility) => {
    setEditingResp(resp);
    setTitle(resp.title);
    setDescription(resp.description || '');
    setPeriodicity(resp.periodicity);
    
    const emailExists = profiles.some(p => p.email === resp.userEmail);
    setTargetEmail(resp.userEmail);
    setIsManualEmail(!emailExists);
    
    setShowModal(true);
  };

  // Responsibility submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      triggerFeedback('O título da responsabilidade é obrigatório.', 'error');
      return;
    }
    if (!targetEmail.trim()) {
      triggerFeedback('Informe o email da pessoa responsável.', 'error');
      return;
    }

    const emailToUse = targetEmail.trim().toLowerCase();

    if (editingResp) {
      const idx = responsibilities.findIndex(r => r.id === editingResp.id);
      if (idx !== -1) {
        const copy = [...responsibilities];
        copy[idx] = {
          ...copy[idx],
          userEmail: emailToUse,
          title: title.trim(),
          description: description.trim(),
          periodicity: periodicity,
          updatedAt: new Date().toISOString()
        };
        await persistChanges(copy);
        triggerFeedback('Responsabilidade atualizada com sucesso!');
      }
    } else {
      const newElement: Responsibility = {
        id: 'resp-' + Math.random().toString(36).substr(2, 9),
        userEmail: emailToUse,
        title: title.trim(),
        description: description.trim(),
        periodicity: periodicity,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await persistChanges([...responsibilities, newElement]);
      triggerFeedback('Nova responsabilidade criada!');
    }
    setShowModal(false);
  };

  // Delete responsibility
  const handleDelete = async (id: string, text: string) => {
    if (!confirm(`Excluir permanentemente a responsabilidade "${text}"?`)) return;
    const filtered = responsibilities.filter(r => r.id !== id);
    await persistChanges(filtered);
    triggerFeedback('Responsabilidade removida com sucesso.', 'warning');
  };

  // Toggle status of responsibility
  const handleToggleStatus = async (id: string) => {
    const updated = responsibilities.map(r => {
      if (r.id === id) {
        return {
          ...r,
          status: r.status === 'completed' ? 'pending' : 'completed' as any,
          updatedAt: new Date().toISOString()
        };
      }
      return r;
    });
    await persistChanges(updated);
    triggerFeedback('Status de compromisso alterado.');
  };

  // Filtered lists
  const loggedInEmail = sessionUser?.email ? sessionUser.email.toLowerCase() : '';

  const filteredItems = responsibilities.filter(item => {
    if (!isAdmin) {
      if (item.userEmail.toLowerCase() !== loggedInEmail) return false;
    } else {
      if (selectedUserFilter !== 'all' && item.userEmail.toLowerCase() !== selectedUserFilter.toLowerCase()) {
        return false;
      }
    }

    if (searchTerm.trim() !== '') {
      const query = searchTerm.toLowerCase();
      const inTitle = item.title.toLowerCase().includes(query);
      const inDesc = item.description?.toLowerCase().includes(query);
      const inEmail = item.userEmail.toLowerCase().includes(query);
      if (!inTitle && !inDesc && !inEmail) return false;
    }

    if (periodicityFilter !== 'all' && item.periodicity !== periodicityFilter) return false;

    return true;
  });

  // Calculate statistics
  const totalMyTasks = responsibilities.filter(item => item.userEmail.toLowerCase() === loggedInEmail).length;
  const allTasksCount = responsibilities.length;

  // Work Instructions actions
  const handleOpenInstructionModal = (inst: WorkInstruction | null = null) => {
    if (inst) {
      setEditingInstruction(inst);
      setInstTitle(inst.title);
      setInstSector(inst.sector);
      setInstObjective(inst.objective);
      setInstHandler(inst.handler);
      setInstSteps(inst.steps);
    } else {
      setEditingInstruction(null);
      setInstTitle('');
      setInstSector('Geral');
      setInstObjective('');
      setInstHandler('');
      setInstSteps(['']);
    }
    setShowInstructionModal(true);
  };

  const handleStepChange = (index: number, val: string) => {
    const copy = [...instSteps];
    copy[index] = val;
    setInstSteps(copy);
  };

  const addStepField = () => {
    setInstSteps([...instSteps, '']);
  };

  const removeStepField = (index: number) => {
    if (instSteps.length <= 1) return;
    setInstSteps(instSteps.filter((_, i) => i !== index));
  };

  const handleInstructionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instTitle.trim() || !instObjective.trim() || !instHandler.trim()) {
      triggerFeedback('Por favor preencha todos os campos obrigatórios da instrução.', 'error');
      return;
    }

    const filteredSteps = instSteps.map(s => s.trim()).filter(Boolean);
    if (filteredSteps.length === 0) {
      triggerFeedback('Informe pelo menos um passo prático na rotina.', 'error');
      return;
    }

    let updatedInstructions: WorkInstruction[] = [];

    if (editingInstruction) {
      updatedInstructions = instructions.map(i => {
        if (i.id === editingInstruction.id) {
          return {
            ...i,
            title: instTitle.trim(),
            sector: instSector,
            objective: instObjective.trim(),
            handler: instHandler.trim(),
            steps: filteredSteps,
            updatedAt: new Date().toISOString()
          };
        }
        return i;
      });
      triggerFeedback('Instrução de Trabalho atualizada com sucesso!', 'success');
    } else {
      const newInst: WorkInstruction = {
        id: 'pop-' + Math.random().toString(36).substr(2, 9),
        title: instTitle.trim(),
        sector: instSector,
        objective: instObjective.trim(),
        handler: instHandler.trim(),
        steps: filteredSteps,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      updatedInstructions = [...instructions, newInst];
      triggerFeedback('Instrução de Trabalho cadastrada com sucesso!', 'success');
    }

    // Persist list to database
    try {
      const { error } = await supabase
        .from('commercial_settings')
        .upsert({ key: 'clinical_work_instructions', value: updatedInstructions }, { onConflict: 'key' });
      if (error) throw error;
      setInstructions(updatedInstructions);
    } catch (err) {
      console.error(err);
      triggerFeedback('Erro ao salvar as instruções no servidor.', 'error');
    }

    setShowInstructionModal(false);
  };

  const handleDeleteInstruction = async (id: string, name: string) => {
    if (!confirm(`Deseja apagar permanentemente a instrução "${name}"?`)) return;
    const filtered = instructions.filter(i => i.id !== id);
    try {
      const { error } = await supabase
        .from('commercial_settings')
        .upsert({ key: 'clinical_work_instructions', value: filtered }, { onConflict: 'key' });
      if (error) throw error;
      setInstructions(filtered);
      triggerFeedback('Instrução removida com sucesso.', 'warning');
    } catch (err) {
      console.error(err);
      triggerFeedback('Erro ao salvar exclusão.', 'error');
    }
  };

  const triggerPrintContent = (inst: WorkInstruction) => {
    setPrintData(inst);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  // Instructions search/filtered
  const filteredInstructions = instructions.filter(inst => {
    if (sectorFilter !== 'all' && inst.sector !== sectorFilter) return false;
    if (searchInstruction.trim() !== '') {
      const q = searchInstruction.toLowerCase();
      const inTitle = inst.title.toLowerCase().includes(q);
      const inObj = inst.objective.toLowerCase().includes(q);
      const inHandler = inst.handler.toLowerCase().includes(q);
      if (!inTitle && !inObj && !inHandler) return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center h-full min-h-[400px] bg-transparent">
        <Loader2 className="w-10 h-10 text-teal-400 animate-spin" />
        <span className="text-xs font-bold font-mono text-slate-400 mt-3 uppercase tracking-wider animate-pulse">
          Carregando Módulo de Processos...
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex w-full h-full bg-transparent text-slate-300 font-sans overflow-hidden">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-transparent relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(45,212,191,0.05),transparent_50%)] pointer-events-none fixed"></div>
        {/* Hidden Print Frame */}
        {printData && (
          <div id="print-section" className="hidden print:block absolute inset-0 bg-white text-[#1e293b] p-12 z-[999999]">
            <div className="border-b-2 border-teal-600 pb-4 mb-6">
              <h1 className="text-2xl font-black uppercase text-slate-900 tracking-wide">{printData.title}</h1>
              <p className="text-xs text-slate-500 mt-2">
                <strong>Setor:</strong> {printData.sector} | <strong>Responsáculo de Execução:</strong> {printData.handler}
              </p>
            </div>
            <div className="mb-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-[#0d9488] mb-2 leading-none">Objetivo e Diretriz</h3>
              <p className="text-sm font-medium text-slate-700 leading-relaxed bg-slate-50 p-4 border border-slate-200 rounded-xl">{printData.objective}</p>
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-[#0d9488] mb-4 leading-none">Passo a Passo Prático</h3>
              <ol className="list-decimal pl-6 space-y-4">
                {printData.steps.map((step, sIdx) => (
                  <li key={sIdx} className="text-sm font-light text-slate-800 leading-relaxed pl-2">{step}</li>
                ))}
              </ol>
            </div>
            <div className="mt-12 pt-6 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-400">
              <span>Centro do Sorriso - Manual Oficial de Processos</span>
              <span>Atualizado: {new Date(printData.updatedAt).toLocaleDateString('pt-BR')}</span>
            </div>
          </div>
        )}

        {/* View Content */}
        <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-8 custom-scrollbar relative z-10 w-full">
           <div className="w-full min-h-full space-y-10 relative z-10">
               
               <div className="flex flex-col gap-6 mb-2">
                   <div>
                       <h1 className="text-4xl md:text-5xl font-bold text-text bg-transparent outline-none w-full block resize-none leading-tight tracking-tight mb-2">
                          {activeSubTab === 'processes' ? 'Manual de Processos' : activeSubTab === 'responsibilities' ? 'Responsabilidades' : 'Instruções de Trabalho'}
                       </h1>
                       <p className="text-slate-400 text-sm">Centralize os manuais, popule rotinas operacionais permanentes (SOPs) e acompanhe as responsabilidades.</p>
                   </div>
               </div>

               {/* SUB NAVIGATION BAR */}
               <div className="flex items-center gap-1 overflow-x-auto pb-4 no-scrollbar border-b border-border mb-8">
                    {[
                        { id: 'processes', label: 'IA Assistente' },
                        { id: 'responsibilities', label: 'Responsabilidades' },
                        { id: 'instructions', label: 'Instruções (IT)' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveSubTab(tab.id as any)}
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

      {/* CORE DISPLAY RENDER */}

      {/* 1. PROCESSES & IA PLAYGROUND MANUALS */}
      {activeSubTab === 'processes' && (
        <div className="flex flex-col gap-8 animate-in fade-in-30">
          <div className="scale-in">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="text-teal-400 w-5 h-5 animate-pulse" />
              <h3 className="text-sm font-bold text-text uppercase tracking-wider">Treinamento Interativo por IA</h3>
            </div>
            <ProcessAssistant />
          </div>

          <div className="flex items-center gap-2 mt-4 mb-2">
            <FolderOpen className="text-teal-400 w-5 h-5" />
            <h3 className="text-lg font-bold text-text uppercase tracking-wider">Acervo Geral de Processos</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
            {/* Financial Section */}
            <article className="bg-surface rounded-2xl border border-border overflow-hidden flex flex-col hover:border-emerald-500/35 transition-all duration-300">
              <div className="p-5 border-b border-border bg-gradient-to-r from-emerald-500/10 to-transparent flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-lg shadow-lg shadow-emerald-500/10">
                  <DollarSign className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-black text-text uppercase tracking-wide">Área Financeira</h3>
              </div>
              <div className="p-5 text-slate-300 leading-relaxed space-y-3 font-light text-xs">
                <p><strong>Objetivo:</strong> Garantir a integridade financeira e contábil através do rastreamento unificado de todas as receitas e despesas.</p>
                <ul className="list-disc pl-4 space-y-1.5 text-slate-400">
                  <li><strong>Contas a Pagar:</strong> Todas as faturas de fornecedores e laboratoriais devem ser registradas no ato de sua recepção.</li>
                  <li><strong>Contas a Receber:</strong> Conciliação diária de todas as transações, checando tarifas aplicadas por operadoras.</li>
                  <li><strong>Controle de Metas:</strong> Relatórios DRE mensais submetidos aos sócios até o 5º dia útil.</li>
                </ul>
              </div>
            </article>

            {/* HR Section */}
            <article className="bg-surface rounded-2xl border border-border overflow-hidden flex flex-col hover:border-purple-500/35 transition-all duration-300">
              <div className="p-5 border-b border-border bg-gradient-to-r from-purple-500/10 to-transparent flex items-center gap-3">
                <div className="p-2.5 bg-purple-500/20 text-purple-400 rounded-lg shadow-lg shadow-purple-500/10">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-black text-text uppercase tracking-wide">Gestão de Pessoas</h3>
              </div>
              <div className="p-5 text-slate-300 leading-relaxed space-y-3 font-light text-xs">
                <p><strong>Objetivo:</strong> Manter a cultura de tratamento humanizado e engajamento da equipe clínica e comercial.</p>
                <ul className="list-disc pl-4 space-y-1.5 text-slate-400">
                  <li><strong>Onboarding:</strong> Integração planejada de 3 dias cobrindo sistemas operacionais e scripts de excelência.</li>
                  <li><strong>Avaliações:</strong> Reunião mensal 1:1 com os colaboradores e avaliações gerais de clima de 6 em 6 meses.</li>
                  <li><strong>Padrões Técnicos:</strong> Treinamentos de biossegurança periódicos para dentistas e auxiliares de consultório.</li>
                </ul>
              </div>
            </article>

            {/* Processes Section */}
            <article className="bg-surface rounded-2xl border border-border overflow-hidden flex flex-col hover:border-blue-500/35 transition-all duration-300">
              <div className="p-5 border-b border-border bg-gradient-to-r from-blue-500/10 to-transparent flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-lg shadow-lg shadow-blue-500/10">
                  <Settings className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-black text-text uppercase tracking-wide">Procedimentos Clínicos</h3>
              </div>
              <div className="p-5 text-slate-300 leading-relaxed space-y-3 font-light text-xs">
                <p><strong>Objetivo:</strong> Padronizar as metodologias de esterilização, desinfecção e manuseio para máxima segurança.</p>
                <ul className="list-disc pl-4 space-y-1.5 text-slate-400">
                  <li><strong>Paramentação:</strong> Uso obrigatório de EPI completo em sala de lavagem médica e esterilização.</li>
                  <li><strong>Controle de Lotes:</strong> Colocação de fita teste química interna em cada kit de grau cirúrgico.</li>
                  <li><strong>Rastreamento Autoclave:</strong> Armazenamento estruturado de testes físicos de esterilização.</li>
                </ul>
              </div>
            </article>

            {/* Commercial Section */}
            <article className="bg-surface rounded-2xl border border-border overflow-hidden flex flex-col hover:border-orange-500/35 transition-all duration-300">
              <div className="p-5 border-b border-border bg-gradient-to-r from-orange-500/10 to-transparent flex items-center gap-3">
                <div className="p-2.5 bg-orange-500/20 text-orange-400 rounded-lg shadow-lg shadow-orange-500/10">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-black text-text uppercase tracking-wide">Área Comercial</h3>
              </div>
              <div className="p-5 text-slate-300 leading-relaxed space-y-3 font-light text-xs">
                <p><strong>Objetivo:</strong> Tração de captação e eficiência de vendas na conversão de planos de tratamento estéticos e ortodônticos.</p>
                <ul className="list-disc pl-4 space-y-1.5 text-slate-400">
                  <li><strong>Follow-up Dinâmico:</strong> Contatos estratégicos nos dias 1, 3 e 7 após elaboração e envio de orçamentos.</li>
                  <li><strong>Agendamento:</strong> Rotina ativa de conversão e campanhas mensais de recall para pacientes ausentes.</li>
                  <li><strong>Parcerias Locais:</strong> Divulgação em empresas comerciais locais para fidelização de convênios.</li>
                </ul>
              </div>
            </article>
          </div>
        </div>
      )}

      {/* 2. RESPONSIBILITIES PORTAL CHECKLIST */}
      {activeSubTab === 'responsibilities' && (
        <div className="flex flex-col animate-in fade-in-30">
          
          {/* STATS HERO GRID */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-surface border border-border rounded-2xl p-5 flex items-center gap-4">
              <div className="size-11 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">COLABORADOR CONECTADO</span>
                <span className="text-xs font-black text-text truncate block">{loggedInEmail || 'carregando...'}</span>
                <span className="text-[10px] text-teal-400 font-bold uppercase tracking-widest block font-mono mt-0.5">
                  {isAdmin ? 'Perfil Master' : 'Membro Operacional'}
                </span>
              </div>
            </div>

            <div className="bg-surface border border-border rounded-2xl p-5 flex items-center gap-4">
              <div className="size-11 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
                <ClipboardCheck className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">SUAS DIRETRIZES ATIVAS</span>
                <span className="text-base font-extrabold text-text block">
                  {totalMyTasks} {totalMyTasks === 1 ? 'Rotina Cadastrada' : 'Rotinas Cadastradas'}
                </span>
              </div>
            </div>

            <div className="bg-surface border border-border rounded-2xl p-5 flex items-center gap-4">
              <div className="size-11 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
                <Info className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">DIRETRIZES DA CLÍNICA</span>
                <span className="text-base font-extrabold text-text block">
                  {allTasksCount} Cadastradas
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <h3 className="text-base font-bold text-text uppercase tracking-wider">Checklist de Responsabilidades Clínicas</h3>
            {isAdmin && (
              <button
                onClick={handleOpenCreateModal}
                className="w-full md:w-auto bg-teal-600 hover:bg-teal-500 text-text font-extrabold text-xs tracking-wider px-4 py-2.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-text" />
                NOVA DIRETRIZ
              </button>
            )}
          </div>

          {/* FILTER CONTROLS BAR */}
          <div className="p-4 bg-surface border border-border rounded-2xl mb-6 flex flex-col xl:flex-row gap-4 items-stretch xl:items-center justify-between shadow-lg">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Pesquisar por título, instrução ou email de colaborador..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-panel border border-border rounded-xl pl-10 pr-4 py-2 text-xs text-text outline-none focus:border-teal-500 transition-colors"
                id="responsibilities-search"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase whitespace-nowrap">Filtro Perfil:</span>
                  <select
                    value={selectedUserFilter}
                    onChange={(e) => setSelectedUserFilter(e.target.value)}
                    className="bg-panel border border-border rounded-xl px-3 py-1.5 text-xs text-text outline-none focus:border-teal-400 min-w-[140px] cursor-pointer"
                  >
                    <option value="all">Todos Colaboradores</option>
                    {profiles.map(p => (
                      <option key={p.id} value={p.email}>{p.email}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase whitespace-nowrap">Rotina:</span>
                <select
                  value={periodicityFilter}
                  onChange={(e) => setPeriodicityFilter(e.target.value)}
                  className="bg-panel border border-border rounded-xl px-3 py-1.5 text-xs text-text outline-none focus:border-teal-450 cursor-pointer"
                >
                  <option value="all">Frequência: Todas</option>
                  {PERIODICITIES.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* LIST WRAPPER */}
          {filteredItems.length === 0 ? (
            <div className="text-center py-20 bg-surface border border-dashed border-border rounded-2xl flex flex-col items-center justify-center p-6">
              <ClipboardCheck className="w-12 h-12 text-slate-600 mb-2 animate-pulse" />
              <h3 className="text-xs font-bold text-text uppercase tracking-wider">Nenhum compromisso correspondente</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs leading-normal">
                Pode ser que você não tenha compromissos cadastrados para esse filtro de pesquisa ou esta frequência ativa.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-20">
              <AnimatePresence mode="popLayout">
                {filteredItems.map(item => {
                  const matchesPeriodicity = PERIODICITIES.find(p => p.value === item.periodicity);

                  return (
                    <motion.div
                      layout
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-surface border border-border hover:border-border hover:bg-white/[0.01] rounded-2xl p-5 flex justify-between items-start gap-4 transition-all relative overflow-hidden"
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {/* Interactive toggle for user */}
                        <button
                          onClick={() => handleToggleStatus(item.id)}
                          className={`mt-1.5 size-5 flex items-center justify-center border rounded-md cursor-pointer transition-all ${
                            item.status === 'completed'
                              ? 'bg-teal-500 border-teal-500 text-black shadow-lg shadow-teal-500/10'
                              : 'border-white/20 hover:border-teal-400/50 hover:bg-panel'
                          }`}
                        >
                          {item.status === 'completed' && <Check className="w-3.5 h-3.5 stroke-[4px]" />}
                        </button>

                        <div className="flex-1 min-w-0">
                          {/* Title */}
                          <h4 className={`text-sm font-bold tracking-wide transition-colors ${
                            item.status === 'completed' ? 'text-slate-500 line-through' : 'text-text'
                          }`}>
                            {item.title}
                          </h4>

                          {/* Description */}
                          {item.description && (
                            <p className={`text-xs mt-1.5 leading-relaxed break-words whitespace-pre-line ${
                              item.status === 'completed' ? 'text-slate-600' : 'text-slate-400 font-light'
                            }`}>
                              {item.description}
                            </p>
                          )}

                          {/* Metadata */}
                          <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-white/[0.03] text-[10px] text-slate-500">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${matchesPeriodicity?.color || 'bg-slate-800 text-slate-400'}`}>
                              {matchesPeriodicity?.label}
                            </span>
                            <span className="flex items-center gap-1 min-w-0 max-w-[180px] truncate">
                              <Mail className="w-3 h-3 flex-shrink-0" />
                              <strong className="truncate font-semibold text-slate-400">{item.userEmail}</strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Gestor Controls */}
                      {isAdmin && (
                        <div className="flex items-center gap-1 shrink-0 self-start">
                          <button
                            onClick={() => handleOpenEditModal(item)}
                            className="p-1.5 border border-border bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-text transition-all cursor-pointer"
                            title="Editar Diretriz"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id, item.title)}
                            className="p-1.5 border border-red-500/10 bg-red-500/5 hover:bg-red-500 text-slate-500 hover:text-text rounded-lg transition-all cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      {/* 3. INSTRUÇÕES DE TRABALHO (POP / SOP MODULE) */}
      {activeSubTab === 'instructions' && (
        <div className="flex flex-col animate-in fade-in-30">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h3 className="text-base font-bold text-text uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="text-teal-400 w-5 h-5" /> Procedimentos Operacionais Padrão (POPs)
              </h3>
              <p className="text-xs text-slate-500 mt-1">Consulte os passos detalhados para a execução correta de rotinas clínicas, financeiras e de atendimento.</p>
            </div>
            {isAdmin && (
              <div className="flex gap-2 w-full md:w-auto">
                <button
                  onClick={async () => {
                    if (window.confirm("Isso irá restaurar os manuais padrão da Clínica Centro do Sorriso. Deseja continuar?")) {
                      const defaultInstructions: WorkInstruction[] = [
                        {
                          id: 'pop-recepcao-checklist',
                          title: 'Checklist Operacional da Recepção (v1.0)',
                          sector: 'Recepção',
                          objective: 'Padronizar o atendimento de novos pacientes, garantindo organização, acolhimento e o fluxo correto para a avaliação e setor comercial.',
                          handler: 'Recepcionista e Secretária',
                          steps: [
                            'Preparação (Pré-chegada): Conferir agenda (nome, horário, profissional) e preparar ambiente (café, água, música ambiente).',
                            'Recepção Inicial: Cumprimentar com postura cordial ("Bom dia, bem-vindo à Clínica Centro do Sorriso") e confirmar o nome e horário.',
                            'Cadastro Inicial: Coletar dados obrigatórios (Nome, Nascimento, CPF, Telefone, Endereço, Origem, Queixa Principal).',
                            'Orientação do Fluxo: Explicar as etapas: Avaliação com dentista -> Apresentação comercial de planos e valores.',
                            'Encaminhamento: Chamar pelo nome, encaminhar até a sala correta e apresentar ao profissional responsável.',
                            'Retorno Pós-Avaliação: Receber o paciente e direcioná-lo imediatamente ao setor comercial para negociação.',
                            'Finalização: Registrar no sistema, agendar próximo horário ou programar follow-up caso não haja fechamento imediato.'
                          ],
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString()
                        },
                        {
                          id: 'pop-agenda-protocolo',
                          title: 'Protocolo de Organização da Agenda',
                          sector: 'Recepção',
                          objective: 'Aumentar a produtividade e reduzir horários vagos, visando metas de 15 atendimentos diários (clínicos) ou 30 (clínico + orto).',
                          handler: 'Equipe de Recepção e Gestão',
                          steps: [
                            'Metas de Atendimento: Planejar a agenda visando 15 presenças reais (dias clínicos) ou 30 (clínico+orto).',
                            'Margem de Faltas: Agendar com 20-30% de gordura (ex: 19-21 pacientes para meta de 15) para compensar absenteísmo.',
                            'Classificação de Horários: Diferenciar visualmente entre Avaliação Inicial, Procedimento, Retornos e Encaixes.',
                            'Regra de Encaixe: Priorizar casos de dor, urgência estética e pacientes com alta chance de fechamento comercial.',
                            'Confirmação Ativa: Realizar confirmação individual via WhatsApp 1 dia antes e lembrete rápido 2 horas antes da consulta.',
                            'Controle de Absenteísmo: Registrar motivos de falta e reagendar o paciente imediatamente para não perder o ciclo de tratamento.',
                            'Priorização: Pacientes que já pagaram ou que estão em meio a procedimentos longos têm prioridade total de horário.'
                          ],
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString()
                        },
                        {
                          id: 'pop-comercial-protocolo',
                          title: 'Protocolo Comercial Pós-Avaliação',
                          sector: 'Geral',
                          objective: 'Garantir profissionalismo e clareza na apresentação de valores e formas de pagamento para converter avaliações em tratamentos.',
                          handler: 'Setor Comercial e Consultores',
                          steps: [
                            'Divisão de Papéis: O dentista foca no diagnóstico clínico; o comercial foca na negociação, valores e fechamento.',
                            'Transferência de Informação: O dentista deve reportar ao comercial a queixa, urgência e perfil psicológico do paciente.',
                            'Sondagem de Necessidade: Entender as dores do paciente (autoestima, mastigação) antes de apresentar o preço.',
                            'Apresentação da Proposta: Explicar o plano de tratamento focado em benefícios práticos e longevidade da saúde bucal.',
                            'Condições de Pagamento: Oferecer Pix, Cartões ou Financiamento, buscando a parcela que cabe no orçamento do paciente.',
                            'Gestão de Objeções: Tratar dúvidas sobre valores ou prazos de forma resolutiva ("O que te impede de começar hoje?").',
                            'Fluxo de Fechamento: Se aprovado, emitir contrato e encaminhar à recepção para recebimento. Se não, programar follow-up.'
                          ],
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString()
                        },
                        {
                          id: 'pop-jornada-paciente',
                          title: 'Jornada do Paciente (12 Etapas)',
                          sector: 'Geral',
                          objective: 'Padronizar a experiência completa do paciente, do primeiro contato à reativação de inativos, visando fidelização.',
                          handler: 'Toda a Equipe',
                          steps: [
                            'Prospecção e Agendamento: Primeiro contato rápido e eficiente gerando autoridade e confiança.',
                            'Confirmação Especializada: Lembretes estratégicos feitos pelo comercial para reduzir no-show.',
                            'Acolhimento na Chegada: Recepção com hospitalidade, café e explicação clara do fluxo de atendimento.',
                            'Protocolo de Avaliação: Diagnóstico humanizado pelo dentista com foco na queixa principal.',
                            'Conversão Comercial: Apresentação profissional do plano de tratamento e negociação financeira.',
                            'Pós-Venda Imediato: Contato em 7 dias após o primeiro procedimento para monitorar satisfação.',
                            'Manutenção e Reavaliação: Campanhas de retorno preventivo a cada 6 meses para pacientes concluídos.',
                            'Indicação Ativa: Solicitar indicações para pacientes satisfeitos (" Member Get Member").',
                            'Reativação de Inativos: Contato para pacientes sem consultas há mais de 12 meses.'
                          ],
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString()
                        },
                        {
                          id: 'pop-experiencia-cliente',
                          title: 'Protocolo de Experiência (Os 5 Sentidos)',
                          sector: 'Recepção',
                          objective: 'Encantar o paciente através do ambiente, transmitindo organização, confiança e higiene impecável.',
                          handler: 'Recepcionista e Auxiliares',
                          steps: [
                            'Ambiente Visual: Recepção limpa, sem copos usados ou fios expostos; TV com antes/depois e depoimentos.',
                            'Conforto Auditivo: Música instrumental ou jazz leve em volume baixo para reduzir a ansiedade clínica.',
                            'Padrão Olfativo: Aroma suave (Lavanda ou Algodão) para neutralizar o "cheiro de consultório".',
                            'Linguagem Positiva: Substituir "vai demorar" por "já estamos finalizando"; chamar sempre pelo nome.',
                            'Hospitalidade: Água gelada e café sempre disponíveis e organizados com guardanapos.',
                            'Apresentação Pessoal: Uniforme impecável, crachá visível e postura acolhedora (sorriso no rosto).'
                          ],
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString()
                        },
                        {
                          id: 'pop-prontuario-padrao',
                          title: 'Padronização do Prontuário Clínico',
                          sector: 'Clínico',
                          objective: 'Garantir segurança jurídica, histórico completo e continuidade dos tratamentos via evoluções detalhadas.',
                          handler: 'Cirurgião-Dentista e ASB',
                          steps: [
                            'Evolução Completa: Registrar obrigatoriamente: Queixa, Avaliação, Procedimento executado e Orientações.',
                            'As 5 Perguntas: O que o paciente tinha? O que foi achado? O que foi feito? O que foi orientado? Próximo passo?',
                            'Validação Legal: Coletar assinatura do paciente em cada atendimento (digital ou manual conforme sistema).',
                            'Registro Comercial: Indicar no prontuário se a avaliação inicial foi encaminhada e aceita pelo setor comercial.',
                            'Auditoria Semanal: Cordenação deve revisar 5 prontuários aleatórios por semana para garantir padrão de 95%.'
                          ],
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString()
                        },
                        {
                          id: 'pop-limpeza-esterilizacao',
                          title: 'POP - Limpeza e Esterilização (Autoclave)',
                          sector: 'Clínico',
                          objective: 'Garantir a eliminação de microrganismos de todos os instrumentais para evitar contaminação cruzada.',
                          handler: 'ASB e Dentistas',
                          steps: [
                            'Paramentação: Uso de luvas de borracha, máscara, jaleco e proteção facial.',
                            'Limpeza: Imersão em detergente enzimático por 10 min seguido de escovação cuidadosa.',
                            'Secagem: Secar completamente as peças (a umidade impede a esterilização correta).',
                            'Embalagem: Envelopes em papel grau cirúrgico selados termicamente.',
                            'Autoclavação: Ciclos completos com monitoramento químico e temperatura registrada diariamente.'
                          ],
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString()
                        }
                      ];
                      
                      await supabase
                        .from('commercial_settings')
                        .upsert({ key: 'clinical_work_instructions', value: defaultInstructions }, { onConflict: 'key' });
                      setInstructions(defaultInstructions);
                    }
                  }}
                  className="w-full md:w-auto bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] tracking-wider px-4 py-2.5 rounded-xl transition-all border border-border flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  RESTAURAR MANUAIS Padrão
                </button>
                <button
                  onClick={() => handleOpenInstructionModal(null)}
                  className="w-full md:w-auto bg-teal-600 hover:bg-teal-500 text-text font-extrabold text-xs tracking-wider px-4 py-2.5 rounded-xl transition-all shadow-md  flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-text" />
                  NOVA INSTRUÇÃO (POP)
                </button>
              </div>
            )}
          </div>

          {/* SEARCH & FILTERS FOR POP */}
          <div className="p-4 bg-surface border border-border rounded-2xl mb-6 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between shadow-lg">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Pesquisar POP por título, objetivo ou responsável..."
                value={searchInstruction}
                onChange={(e) => setSearchInstruction(e.target.value)}
                className="w-full bg-panel border border-border rounded-xl pl-10 pr-4 py-2 text-xs text-text outline-none focus:border-teal-500 transition-colors"
                id="instructions-search"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] font-bold text-slate-500 uppercase whitespace-nowrap">Setor:</span>
              <select
                value={sectorFilter}
                onChange={(e) => setSectorFilter(e.target.value)}
                className="bg-panel border border-border rounded-xl px-4 py-1.5 text-xs text-text outline-none focus:border-teal-500 cursor-pointer min-w-[120px]"
              >
                <option value="all">Todos Setores</option>
                <option value="Clínico">Clínico</option>
                <option value="Recepção">Recepção</option>
                <option value="Financeiro">Financeiro</option>
                <option value="Geral">Geral</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
          </div>

          {/* POP LISTING */}
          {instructionsLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
              <span className="text-xs font-bold text-slate-500 mt-2 font-mono">CARREGANDO POPs COMERCIAIS...</span>
            </div>
          ) : filteredInstructions.length === 0 ? (
            <div className="text-center py-20 bg-surface border border-dashed border-border rounded-2xl flex flex-col items-center justify-center p-6">
              <BookOpen className="w-12 h-12 text-slate-600 mb-2 animate-pulse" />
              <h3 className="text-xs font-bold text-text uppercase tracking-wider">Nenhuma Instrução de Trabalho cadastrada</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs leading-normal">Nenhum POP clínico encontrado para esse filtro de pesquisa corporativa.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
              {filteredInstructions.map(inst => (
                <div
                  key={inst.id}
                  className="bg-surface border border-border hover:border-teal-500/20 hover:scale-[1.01] rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 relative group"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className={`text-[9px] font-black uppercase tracking-wider border px-2 py-0.5 rounded-md ${
                        inst.sector === 'Clínico' ? 'bg-pink-500/10 text-pink-400 border-pink-500/20' :
                        inst.sector === 'Recepção' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                        inst.sector === 'Financeiro' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        'bg-slate-800 text-slate-400 border-border'
                      }`}>
                        {inst.sector}
                      </span>
                      <span className="text-[9px] font-mono text-slate-500">
                        {new Date(inst.updatedAt).toLocaleDateString('pt-BR')}
                      </span>
                    </div>

                    {/* Title */}
                    <h4 className="text-sm font-black text-text group-hover:text-teal-400 transition-colors leading-snug line-clamp-2" title={inst.title}>
                      {inst.title}
                    </h4>

                    {/* Objective */}
                    <p className="text-xs text-slate-400 leading-relaxed font-light mt-2.5 line-clamp-3">
                      {inst.objective}
                    </p>

                    {/* Execution Scope */}
                    <div className="mt-4 pt-3 border-t border-white/[0.03] space-y-2">
                      <div className="flex items-start gap-1.5 text-[10px] text-slate-500">
                        <Users className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                        <span className="truncate leading-normal">
                          Executado por: <strong className="text-slate-300 font-semibold">{inst.handler}</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                        <ClipboardCheck className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                        <span>Passos ordenados: <strong className="text-teal-400 font-semibold">{inst.steps.length} passos</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex gap-2.5 mt-5">
                    <button
                      onClick={() => setViewingInstruction(inst)}
                      className="flex-1 bg-panel hover:bg-panel/80 text-text text-xs font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-border"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      Acessar POP
                    </button>

                    <button
                      onClick={() => triggerPrintContent(inst)}
                      className="p-2 bg-teal-500/10 hover:bg-teal-500 hover:text-black rounded-xl text-teal-400 transition-colors cursor-pointer"
                      title="Imprimir POP Corporativo"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>

                    {isAdmin && (
                      <>
                        <button
                          onClick={() => handleOpenInstructionModal(inst)}
                          className="p-2 hover:bg-panel text-slate-500 hover:text-text rounded-xl transition-colors cursor-pointer"
                          title="Editar"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteInstruction(inst.id, inst.title)}
                          className="p-2 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded-xl transition-colors cursor-pointer"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: RESPONSIBILITY ADD / EDIT */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20 dark:bg-black/60 backdrop-blur-2xl p-4 animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface border border-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 bg-surface border-b border-border shrink-0 animate-in slide-in-from-top-4">
                <h3 className="text-sm font-bold text-text uppercase tracking-wider flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5 text-teal-400" />
                  {editingResp ? 'Editar Diretriz Clínica' : 'Cadastrar Nova Diretriz'}
                </h3>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 custom-scrollbar">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                      Colaborador Responsável
                    </label>
                    {profiles.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsManualEmail(!isManualEmail);
                          setTargetEmail(isManualEmail ? (profiles[0]?.email || '') : '');
                        }}
                        className="text-[10px] text-teal-400 hover:text-teal-300 font-extrabold uppercase underline border-none bg-transparent cursor-pointer"
                      >
                        {isManualEmail ? 'Selecionar de Perfis' : 'Digitar e-mail manual'}
                      </button>
                    )}
                  </div>

                  {isManualEmail ? (
                    <input
                      type="email"
                      required
                      placeholder="exemplo@clinicasorriso.com"
                      value={targetEmail}
                      onChange={(e) => setTargetEmail(e.target.value)}
                      className="w-full bg-panel border border-border rounded-xl px-4 py-2.5 text-xs text-text outline-none focus:border-teal-500 transition-colors"
                      id="resp-manual-email"
                    />
                  ) : (
                    <select
                      value={targetEmail}
                      onChange={(e) => setTargetEmail(e.target.value)}
                      className="w-full bg-panel border border-border rounded-xl px-4 py-2.5 text-xs text-text outline-none focus:border-teal-500 cursor-pointer"
                    >
                      {profiles.map(p => (
                        <option key={p.id} value={p.email} className="bg-surface text-text">
                          {p.email} ({p.role === 'admin' ? 'Gestor' : p.role === 'reception' ? 'Recepção' : 'Dentista/Paciente'})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Nome da Tarefa / Diretriz
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Checagem da Autoclave e Indicador Biológico"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-panel border border-border rounded-xl px-4 py-2.5 text-xs text-text outline-none focus:border-teal-500 transition-colors"
                    id="resp-title"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Instruções Operacionais e Detalhes
                  </label>
                  <textarea
                    placeholder="Descreva detalhadamente o passo a passo a ser seguido na execução..."
                    value={description}
                    rows={4}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-panel border border-border rounded-xl px-4 py-2.5 text-xs text-text outline-none focus:border-teal-500 transition-colors resize-none"
                    id="resp-description"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-2">
                    Frequência Recomendada
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {PERIODICITIES.map(p => {
                      const isSelected = periodicity === p.value;
                      return (
                        <button
                          type="button"
                          key={p.value}
                          onClick={() => setPeriodicity(p.value as any)}
                          className={`px-3 py-2.5 rounded-xl text-xs font-black border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                            isSelected 
                              ? 'bg-teal-500/10 border-teal-500/50 text-teal-300 font-extrabold' 
                              : 'bg-panel border-border text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          <span>{p.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border shrink-0 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-text rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2.5 bg-teal-600 hover:bg-teal-500 text-text rounded-lg text-xs font-extrabold cursor-pointer disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirmar e Salvar'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: WORK INSTRUCTION ADD / EDIT */}
      <AnimatePresence>
        {showInstructionModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20 dark:bg-black/60 backdrop-blur-2xl p-4 animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface border border-border w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 bg-surface border-b border-border shrink-0">
                <h3 className="text-sm font-bold text-text uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-5 h-5 text-teal-400" />
                  {editingInstruction ? 'Editar POP Clínico' : 'Cadastrar Nova Instrução de Trabalho'}
                </h3>
              </div>

              <form onSubmit={handleInstructionSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1.5">Setor do POP</label>
                    <select
                      value={instSector}
                      onChange={(e) => setInstSector(e.target.value as any)}
                      className="w-full bg-panel border border-border rounded-xl px-4 py-2.5 text-xs text-text outline-none focus:border-teal-500 cursor-pointer"
                    >
                      <option value="Clínico">Setor Clínico</option>
                      <option value="Recepção">Recepção / Acolhimento</option>
                      <option value="Financeiro">Setor Financeiro</option>
                      <option value="Geral">Administrativo / Geral</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1.5">Título / Código</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: POP 04 - Cadastro de Ficha de Anamnese"
                      value={instTitle}
                      onChange={(e) => setInstTitle(e.target.value)}
                      className="w-full bg-panel border border-border rounded-xl px-4 py-2.5 text-xs text-text outline-none focus:border-teal-500 transition-colors"
                      id="pop-title"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1.5">Responsáveis pela Execução</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Recepcionistas, ASB"
                    value={instHandler}
                    onChange={(e) => setInstHandler(e.target.value)}
                    className="w-full bg-panel border border-border rounded-xl px-4 py-2.5 text-xs text-text outline-none focus:border-teal-500 transition-colors"
                    id="pop-handler"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1.5">Objetivo do Procedimento</label>
                  <textarea
                    required
                    placeholder="Delineie o propósito final, garantindo clareza técnica e relevância clínica..."
                    value={instObjective}
                    rows={3}
                    onChange={(e) => setInstObjective(e.target.value)}
                    className="w-full bg-panel border border-border rounded-xl px-4 py-2.5 text-xs text-text outline-none focus:border-teal-500 transition-colors resize-none"
                    id="pop-objective"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Passo a Passo Prático</label>
                    <button
                      type="button"
                      onClick={addStepField}
                      className="text-[10px] text-teal-400 hover:text-teal-300 font-extrabold uppercase border-none bg-transparent cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[3px]" /> Adicionar Passo
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                    {instSteps.map((step, idx) => (
                      <div key={idx} className="flex gap-2 items-center animate-in slide-in-from-left-2 duration-150">
                        <span className="size-6 bg-panel text-teal-400 text-xs font-mono font-bold flex items-center justify-center shrink-0 rounded-full border border-teal-500/10">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          required
                          placeholder={`Descreva a ação de execução do passo nº ${idx + 1}...`}
                          value={step}
                          onChange={(e) => handleStepChange(idx, e.target.value)}
                          className="flex-1 bg-panel border border-border rounded-xl px-4 py-2 text-xs text-text outline-none focus:border-teal-500 transition-colors"
                        />
                        {instSteps.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeStepField(idx)}
                            className="p-1 px-2.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-text rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border shrink-0 mt-3">
                  <button
                    type="button"
                    onClick={() => setShowInstructionModal(false)}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-text rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-teal-600 hover:bg-teal-500 text-text rounded-lg text-xs font-extrabold cursor-pointer"
                  >
                    Salvar POP Corporativo
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* POP DOCUMENT DETAILS VIEW (Acessar POP modal) */}
      <AnimatePresence>
        {viewingInstruction && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20 dark:bg-black/60 backdrop-blur-2xl p-4 animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface border border-border w-full max-w-2xl rounded-3xl shadow-3xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-6 md:p-8 border-b border-border bg-surface flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0 animate-in slide-in-from-top-4 duration-300">
                <div className="flex flex-col gap-2 min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border ${
                      viewingInstruction.sector === 'Clínico' ? 'bg-pink-500/10 text-pink-400 border-pink-500/20' :
                      viewingInstruction.sector === 'Recepção' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                      viewingInstruction.sector === 'Financeiro' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      'bg-slate-800 text-slate-400 border-border'
                    }`}>
                      {viewingInstruction.sector}
                    </span>
                    <span className="text-[10px] font-mono font-medium text-slate-500">Procedimento Operacional Padrão</span>
                  </div>
                  <h3 className="text-xl md:text-2xl font-black text-text leading-tight font-display pr-5">{viewingInstruction.title}</h3>
                </div>
                <button
                  onClick={() => setViewingInstruction(null)}
                  className="p-1 px-2.5 bg-panel hover:bg-panel/80 border border-border rounded-xl text-slate-400 hover:text-text transition-all self-end sm:self-center cursor-pointer"
                >
                  <X className="w-4 h-4 stroke-[2.5px]" />
                </button>
              </div>

              {/* Viewer scroll area */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 custom-scrollbar text-xs">
                
                {/* Objective block */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-teal-400 font-sans">Objetivo do Procedimento</h4>
                  <div className="p-5 bg-panel border border-border rounded-2xl text-slate-350 leading-relaxed font-light text-slate-300">
                    {viewingInstruction.objective}
                  </div>
                </div>

                {/* Handler */}
                <div className="flex items-center gap-2 p-4 bg-surface rounded-2xl border border-border text-slate-300">
                  <User className="text-teal-400 w-5 h-5 flex-shrink-0" />
                  <div>
                    <span className="text-[10px] font-extrabold text-slate-500 block uppercase tracking-wider">Responsabilidade de Execução</span>
                    <span className="text-sm font-bold text-text">{viewingInstruction.handler}</span>
                  </div>
                </div>

                {/* Steps process listing */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-teal-400 font-sans">Instruções Passo a Passo</h4>
                  <div className="space-y-3">
                    {viewingInstruction.steps.map((step, idx) => (
                      <div key={idx} className="flex gap-4 items-start p-4 bg-surface border border-border rounded-2xl relative overflow-hidden group">
                        <div className="flex-shrink-0 size-8 bg-teal-500/10 text-teal-400 text-sm font-mono font-bold flex items-center justify-center rounded-full border border-teal-500/20 group-hover:bg-teal-500 group-hover:text-black group-hover:scale-105 transition-all duration-300">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0 pr-4 mt-0.5">
                          <p className="text-xs text-slate-300 font-light leading-relaxed">{step}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer control panel */}
              <div className="p-6 border-t border-border bg-surface flex justify-between items-center shrink-0">
                <span className="text-[9px] text-slate-600 font-mono">Última atualização em: {new Date(viewingInstruction.updatedAt).toLocaleDateString('pt-BR')}</span>
                <button
                  onClick={() => triggerPrintContent(viewingInstruction)}
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-text rounded-xl text-xs font-black tracking-wide flex items-center gap-2 cursor-pointer shadow-lg shadow-teal-500/10"
                >
                  <Printer className="w-4 h-4 text-text" /> Imprimir POP
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

          </div>
        </div>
      </div>

      {/* CUSTOM BANNER FOR FEEDBACK IN CORNER */}
      {feedback && (
        <div className="fixed bottom-4 right-4 z-[220] flex items-center gap-3 px-4 py-3 rounded-xl border border-border shadow-2xl bg-surface text-text text-sm font-medium animate-in slide-in-from-bottom-2 duration-200">
          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
            feedback.type === 'success' ? 'bg-surface' : feedback.type === 'error' ? 'bg-surface' : 'bg-surface'
          }`} />
          <span className="text-xs text-slate-200">{feedback.message}</span>
        </div>
      )}
      </div>
    </div>
  );
};
