import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Check,
  ChevronRight,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Target,
  UserRound,
  X,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "../supabaseClient";
import { LoadingPanel } from "./ui/loading-panel";
import { MetricCard, PageHeader, StatusBadge } from "./ui/operational-ui";

type Seller = "James" | "Priscila";
type LeadStatus =
  | "pending"
  | "in_progress"
  | "contacted"
  | "scheduled"
  | "converted"
  | "unreachable"
  | "closed";
type Lead = {
  id: string;
  patient_name: string;
  phone: string;
  budget_value_cents: number;
  converted_value_cents: number | null;
  budget_date: string | null;
  source_status: "lost" | "expired";
  assignee: Seller | null;
  status: LeadStatus;
  last_contact_at: string | null;
  next_follow_up_at: string | null;
  notes: string | null;
  created_at: string;
};
type Interaction = {
  id: string;
  lead_id: string;
  channel: "call" | "whatsapp";
  outcome: string;
  note: string | null;
  seller: Seller;
  scheduled_for: string | null;
  created_at: string;
};
type MetaTemplate = { name: string; language: string; status: string; category?: string; components?: { type: string; text?: string }[] };
type ActionKey =
  | "whatsapp_message"
  | "whatsapp_interested"
  | "whatsapp_not_interested"
  | "whatsapp_already_treated"
  | "call_answered"
  | "call_no_answer"
  | "call_not_interested"
  | "call_already_treated"
  | "scheduled"
  | "attended"
  | "no_show";

const sellers: Seller[] = ["James", "Priscila"];

const reactivationTemplateMapping = (template: MetaTemplate) => {
  const parts = Array.isArray(template.components) ? template.components : [];
  const body = parts.find((part: any) => String(part?.type || '').toUpperCase() === 'BODY') as any;
  const header = parts.find((part: any) => String(part?.type || '').toUpperCase() === 'HEADER') as any;
  const bodyPositions = [...new Set(Array.from(String(body?.text || '').matchAll(/\{\{(\d+)\}\}/g), match => Number(match[1])))].sort((a, b) => a - b);
  const headerPositions = String(header?.format || '').toUpperCase() === 'TEXT'
    ? [...new Set(Array.from(String(header?.text || '').matchAll(/\{\{(\d+)\}\}/g), match => Number(match[1])))].sort((a, b) => a - b)
    : [];
  const bodyDefaults = ['patient_name', 'amount', 'patient_phone', 'seller_name', 'opportunity_title'];
  const lines = bodyPositions.map((position, index) => `{{${position}}} = ${bodyDefaults[index] || 'patient_name'}`);
  headerPositions.forEach(position => lines.push(`__header_text_${position} = patient_name`));
  const headerFormat = String(header?.format || '').toUpperCase();
  if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat)) {
    throw new Error('Este template possui mídia no cabeçalho. Selecione um template de texto ou configure a mídia antes do disparo.');
  }
  return lines.join('\n');
};
const actionDefinitions: Record<
  ActionKey,
  { channel: Interaction["channel"]; outcome: string; label: string }
> = {
  whatsapp_message: {
    channel: "whatsapp",
    outcome: "message_sent",
    label: "Mensagem enviada",
  },
  whatsapp_interested: {
    channel: "whatsapp",
    outcome: "interested",
    label: "Respondeu com interesse",
  },
  whatsapp_not_interested: {
    channel: "whatsapp",
    outcome: "not_interested",
    label: "Sem interesse",
  },
  whatsapp_already_treated: {
    channel: "whatsapp",
    outcome: "already_treated",
    label: "Já fez o tratamento",
  },
  call_answered: {
    channel: "call",
    outcome: "answered",
    label: "Ligação atendida",
  },
  call_no_answer: {
    channel: "call",
    outcome: "no_answer",
    label: "Não atendeu",
  },
  call_not_interested: {
    channel: "call",
    outcome: "not_interested",
    label: "Sem interesse",
  },
  call_already_treated: {
    channel: "call",
    outcome: "already_treated",
    label: "Já fez o tratamento",
  },
  scheduled: {
    channel: "whatsapp",
    outcome: "scheduled",
    label: "Agendamento realizado",
  },
  attended: { channel: "whatsapp", outcome: "attended", label: "Compareceu" },
  no_show: { channel: "whatsapp", outcome: "no_show", label: "Faltou" },
};
const outcomeLabel: Record<string, string> = {
  answered: "Ligação atendida",
  no_answer: "Não atendeu",
  message_sent: "Mensagem enviada",
  interested: "Respondeu com interesse",
  not_interested: "Sem interesse",
  already_treated: "Já fez o tratamento",
  scheduled: "Agendamento realizado",
  attended: "Compareceu",
  no_show: "Faltou",
  converted: "Convertido",
  lost: "Perdido",
};
const statusLabel: Record<LeadStatus, string> = {
  pending: "Pendente",
  in_progress: "Em contato",
  contacted: "Contatado",
  scheduled: "Retorno agendado",
  converted: "Convertido",
  unreachable: "Sem contato",
  closed: "Encerrado",
};
const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    (Number(cents) || 0) / 100,
  );
const dateTime = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Ainda não contatado";
const dateOnly = (value: string | null) =>
  value
    ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR")
    : "Não informada";
const sourceStatusLabel = (value: Lead["source_status"]) =>
  value === "lost" ? "Perdido" : "Vencido";
const whatsappHref = (phone: string) =>
  `https://wa.me/${phone.replace(/\D/g, "")}`;
const localDayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const whatsappRates: Record<string, number> = { MARKETING: 0.3217, UTILITY: 0.035, AUTHENTICATION: 0.035 };

export const BudgetReactivation: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resultModal, setResultModal] = useState<"converted" | "lost" | null>(
    null,
  );
  const [resultData, setResultData] = useState({ value: "", loss_reason: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [sellerFilter, setSellerFilter] = useState<"all" | Seller>("all");
  const [chartSeller, setChartSeller] = useState<"all" | Seller>("all");
  const [statusFilter, setStatusFilter] = useState<"open" | LeadStatus>("open");
  const [selected, setSelected] = useState<Lead | null>(null);
  const [showNewLead, setShowNewLead] = useState(false);
  const [newLead, setNewLead] = useState({
    patient_name: "",
    phone: "",
    budget_value: "",
    source_status: "lost" as "lost" | "expired",
    assignee: "James" as Seller,
    budget_date: "",
  });
  const [interaction, setInteraction] = useState({
    actions: [] as ActionKey[],
    note: "",
    seller: "James" as Seller,
    next_follow_up_at: "",
    scheduled_for: "",
    converted_value: "",
  });
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [campaignTemplates, setCampaignTemplates] = useState<MetaTemplate[]>([]);
  const [campaignTemplateKey, setCampaignTemplateKey] = useState("");
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [campaignSending, setCampaignSending] = useState(false);
  const [campaignNotice, setCampaignNotice] = useState("");
  const [campaignStatusByLead, setCampaignStatusByLead] = useState<Record<string, string>>(() => {
    try { return JSON.parse(window.localStorage.getItem("budget-reactivation-whatsapp-status") || "{}"); } catch { return {}; }
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [leadResult, interactionResult] = await Promise.all([
      supabase
        .from("budget_reactivation_leads")
        .select("*")
        .order("next_follow_up_at", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("budget_reactivation_interactions")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);
    if (leadResult.error || interactionResult.error)
      setError(
        leadResult.error?.message ||
          interactionResult.error?.message ||
          "Não foi possível carregar a carteira.",
      );
    setLeads((leadResult.data || []) as Lead[]);
    setInteractions((interactionResult.data || []) as Interaction[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (selected)
      setInteraction((current) => ({
        ...current,
        seller: selected.assignee || current.seller,
      }));
  }, [selected]);

  const filtered = useMemo(
    () =>
      leads.filter((lead) => {
        const searchable =
          `${lead.patient_name} ${lead.phone}`.toLocaleLowerCase("pt-BR");
        const matchesQuery =
          !query || searchable.includes(query.toLocaleLowerCase("pt-BR"));
        const matchesSeller =
          sellerFilter === "all" || lead.assignee === sellerFilter;
        const matchesStatus =
          statusFilter === "open"
            ? !["converted", "closed"].includes(lead.status)
            : lead.status === statusFilter;
        return matchesQuery && matchesSeller && matchesStatus;
      }),
    [leads, query, sellerFilter, statusFilter],
  );

  const metrics = useMemo(() => {
    const callAttempts = interactions.filter(
      (item) => item.channel === "call",
    );
    const effectiveCalls = callAttempts.filter(
      (item) => item.outcome === "answered",
    );
    const portfolioValue = leads.reduce(
      (total, item) => total + Number(item.budget_value_cents || 0),
      0,
    );
    const soldValue = leads
      .filter((item) => item.status === "converted")
      .reduce(
        (total, item) =>
          total +
          Number(item.converted_value_cents ?? item.budget_value_cents ?? 0),
        0,
      );
    return [
      [
        "Tentativas de ligação",
        callAttempts.length,
        "Todas as ligações registradas",
      ],
      [
        "Ligações efetivas",
        effectiveCalls.length,
        "Ligações atendidas pelos pacientes",
      ],
      [
        "Valor da carteira",
        money(portfolioValue),
        "Total dos orçamentos importados",
      ],
      ["Valor vendido", money(soldValue), "Conversões pelo valor efetivo"],
      [
        "Agendamentos",
        interactions.filter((item) => item.outcome === "scheduled").length,
        "Consultas marcadas",
      ],
      [
        "Comparecimentos",
        interactions.filter((item) => item.outcome === "attended").length,
        "Pacientes que compareceram",
      ],
      [
        "Faltas",
        interactions.filter((item) => item.outcome === "no_show").length,
        "Agendamentos não realizados",
      ],
    ];
  }, [leads, interactions]);

  const dailyActivity = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (13 - index));
      return {
        key: localDayKey(date),
        label: date.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        }),
        jamesCalls: 0,
        jamesMessages: 0,
        priscilaCalls: 0,
        priscilaMessages: 0,
      };
    });
    const byDay = new Map(days.map((day) => [day.key, day]));
    interactions.forEach((item) => {
      const day = byDay.get(localDayKey(new Date(item.created_at)));
      if (!day) return;
      if (item.seller === "James") {
        if (item.channel === "call") day.jamesCalls += 1;
        else day.jamesMessages += 1;
      } else {
        if (item.channel === "call") day.priscilaCalls += 1;
        else day.priscilaMessages += 1;
      }
    });
    return days;
  }, [interactions]);

  const createLead = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const value =
      Math.round(
        Number(String(newLead.budget_value).replace(",", ".")) * 100,
      ) || 0;
    const { error: insertError } = await supabase
      .from("budget_reactivation_leads")
      .insert({
        patient_name: newLead.patient_name.trim(),
        phone: newLead.phone.trim(),
        budget_value_cents: value,
        source_status: newLead.source_status,
        assignee: newLead.assignee,
        budget_date: newLead.budget_date || null,
      });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setNewLead({
      patient_name: "",
      phone: "",
      budget_value: "",
      source_status: "lost",
      assignee: "James",
      budget_date: "",
    });
    setShowNewLead(false);
    setNotice("Lead incluído na carteira de reativação.");
    void load();
  };

  const saveInteraction = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    if (interaction.actions.length === 0) {
      setError("Marque ao menos uma ação para registrar.");
      return;
    }
    setSaving(true);
    setError("");
    const now = new Date().toISOString();
    const selectedActions = interaction.actions.map(
      (action) => actionDefinitions[action],
    );
    const outcomes = selectedActions.map((action) => action.outcome);
    const derivedStatus: LeadStatus = outcomes.includes("converted")
      ? "converted"
      : outcomes.includes("scheduled")
        ? "scheduled"
        : outcomes.includes("not_interested")
          ? "closed"
          : outcomes.includes("no_answer") && !outcomes.includes("answered")
            ? "unreachable"
            : "contacted";
    const convertedValue = outcomes.includes("converted")
      ? Math.round(
          Number(String(interaction.converted_value).replace(",", ".")) * 100,
        )
      : selected.converted_value_cents;
    const [interactionResult, leadResult] = await Promise.all([
      supabase.from("budget_reactivation_interactions").insert(
        selectedActions.map((action) => ({
          lead_id: selected.id,
          channel: action.channel,
          outcome: action.outcome,
          note: interaction.note.trim() || null,
          seller: interaction.seller,
          scheduled_for:
            action.outcome === "scheduled" && interaction.scheduled_for
              ? new Date(interaction.scheduled_for).toISOString()
              : null,
        })),
      ),
      supabase
        .from("budget_reactivation_leads")
        .update({
          assignee: interaction.seller,
          status: derivedStatus,
          converted_value_cents: convertedValue,
          last_contact_at: now,
          next_follow_up_at: interaction.next_follow_up_at
            ? new Date(interaction.next_follow_up_at).toISOString()
            : null,
        })
        .eq("id", selected.id),
    ]);
    setSaving(false);
    if (interactionResult.error || leadResult.error) {
      setError(
        interactionResult.error?.message ||
          leadResult.error?.message ||
          "Não foi possível registrar a ação.",
      );
      return;
    }
    setInteraction({
      actions: [],
      note: "",
      seller: selected.assignee || "James",
      next_follow_up_at: "",
      scheduled_for: "",
      converted_value: "",
    });
    setNotice("Ação registrada no histórico do lead.");
    await load();
  };

  const saveSpecialResult = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !resultModal) return;
    const isConversion = resultModal === "converted";
    const value = Math.round(
      Number(String(resultData.value).replace(",", ".")) * 100,
    );
    if (isConversion && (!Number.isFinite(value) || value < 0)) {
      setError("Informe um valor de venda válido.");
      return;
    }
    if (!isConversion && !resultData.loss_reason.trim()) {
      setError("Informe o motivo da perda.");
      return;
    }
    setSaving(true);
    setError("");
    const outcome = isConversion ? "converted" : "lost";
    const [interactionResult, leadResult] = await Promise.all([
      supabase.from("budget_reactivation_interactions").insert({
        lead_id: selected.id,
        channel: "whatsapp",
        outcome,
        note: isConversion ? null : resultData.loss_reason.trim(),
        seller: interaction.seller,
      }),
      supabase
        .from("budget_reactivation_leads")
        .update({
          assignee: interaction.seller,
          status: isConversion ? "converted" : "closed",
          converted_value_cents: isConversion
            ? value
            : selected.converted_value_cents,
          last_contact_at: new Date().toISOString(),
        })
        .eq("id", selected.id),
    ]);
    setSaving(false);
    if (interactionResult.error || leadResult.error) {
      setError(
        interactionResult.error?.message ||
          leadResult.error?.message ||
          "Não foi possível registrar o resultado.",
      );
      return;
    }
    setResultModal(null);
    setResultData({ value: "", loss_reason: "" });
    setNotice(isConversion ? "Venda convertida." : "Perda registrada.");
    await load();
  };

  const selectedInteractions = selected
    ? interactions.filter((item) => item.lead_id === selected.id)
    : [];
  const updateAssignment = async (lead: Lead, assignee: Seller) => {
    await supabase
      .from("budget_reactivation_leads")
      .update({
        assignee,
        status: lead.status === "pending" ? "in_progress" : lead.status,
      })
      .eq("id", lead.id);
    void load();
  };
  const deleteInteraction = async (item: Interaction) => {
    if (!window.confirm("Excluir este registro do histórico?")) return;
    const { error: deleteError } = await supabase
      .from("budget_reactivation_interactions")
      .delete()
      .eq("id", item.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setNotice("Registro excluído do histórico.");
    await load();
  };

  const authHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Sessão expirada. Entre novamente para usar o disparador.");
    return { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" };
  };
  const openCampaign = async () => {
    if (!bulkSelectedIds.size) { setCampaignNotice("Selecione ao menos um orçamento com telefone."); return; }
    setCampaignOpen(true); setCampaignLoading(true); setCampaignNotice("");
    try {
      const response = await fetch("/api/integrations/whatsapp/templates", { headers: await authHeaders() });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível consultar os templates aprovados.");
      const approved = (body.templates || []).filter((item: MetaTemplate) => item.status === "APPROVED") as MetaTemplate[];
      setCampaignTemplates(approved);
      setCampaignTemplateKey(current => current || (approved[0] ? `${approved[0].name}::${approved[0].language}` : ""));
      if (!approved.length) setCampaignNotice("Nenhum template aprovado foi encontrado na conta Meta.");
    } catch (error) { setCampaignNotice(error instanceof Error ? error.message : "Falha ao consultar templates."); }
    finally { setCampaignLoading(false); }
  };
  const sendCampaign = async () => {
    const template = campaignTemplates.find(item => `${item.name}::${item.language}` === campaignTemplateKey);
    if (!template || !bulkSelectedIds.size) return;
    setCampaignSending(true); setCampaignNotice("");
    try {
      const headers = await authHeaders();
      const variableMapping = reactivationTemplateMapping(template);
      const response = await fetch("/api/integrations/whatsapp/bulk-campaigns", { method: "POST", headers, body: JSON.stringify({ source: "budget_reactivation", name: `Reativação · ${new Date().toLocaleDateString("pt-BR")}`, templateName: template.name, language: template.language, selectedLeadIds: Array.from(bulkSelectedIds), variableMapping }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Falha ao criar a campanha.");
      let processBody: { sent?: number; failed?: number; pending?: number; error?: string } = {};
      let totalSent = 0;
      let totalFailed = 0;
      for (let batch = 0; batch < 100; batch += 1) {
        const processResponse = await fetch("/api/integrations/whatsapp/bulk-campaigns", { method: "POST", headers, body: JSON.stringify({ action: "process", campaignId: body.campaignId }) });
        processBody = await processResponse.json();
        if (!processResponse.ok) throw new Error(processBody.error || "Campanha criada, mas não foi processada.");
        totalSent += Number(processBody.sent || 0);
        totalFailed += Number(processBody.failed || 0);
        if (!processBody.pending) break;
      }
      const reportResponse = await fetch(`/api/integrations/whatsapp/bulk-campaigns?campaignId=${encodeURIComponent(body.campaignId)}`, { headers });
      const reportBody = await reportResponse.json();
      if (reportResponse.ok && Array.isArray(reportBody.recipients)) {
        setCampaignStatusByLead(current => {
          const next = { ...current };
          reportBody.recipients.forEach((recipient: { budget_reactivation_lead_id?: string; status?: string }) => { if (recipient.budget_reactivation_lead_id) next[recipient.budget_reactivation_lead_id] = recipient.status || "pending"; });
          window.localStorage.setItem("budget-reactivation-whatsapp-status", JSON.stringify(next));
          return next;
        });
      }
      setCampaignNotice(`Campanha processada: ${totalSent} enviada(s), ${totalFailed} falha(s). O relatório mantém o status e o ID Meta quando disponível.`);
      await load();
    } catch (error) { setCampaignNotice(error instanceof Error ? error.message : "Falha ao disparar a campanha."); }
    finally { setCampaignSending(false); }
  };

  return (
    <div className="crm-suite crm-reactivation-pipedrive flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-transparent text-[var(--text)]">
      <div className="custom-scrollbar flex-1 overflow-y-auto px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        <div className="flex w-full flex-col gap-5">
          <div className="crm-reactivation-toolbar" aria-label="Ferramentas da carteira">
            <div className="crm-reactivation-view-switch" role="group" aria-label="Visualização">
              <button type="button" className="active" title="Lista de reativação"><span aria-hidden="true">☷</span></button>
              <button type="button" title="Histórico de mensagens"><MessageCircle className="h-3.5 w-3.5" /></button>
            </div>
            <span className="crm-reactivation-count">{filtered.length} contatos</span>
            <span className="crm-reactivation-toolbar-spacer" />
            <span className="crm-reactivation-context">Reativação de orçamento</span>
          </div>
          <PageHeader
            icon={Target}
            title="Orçamentos perdidos e vencidos"
            description="Fila compartilhada de ligações e WhatsApp para James e Priscila."
            actions={(
              <>
              <button
                type="button"
                onClick={() => void openCampaign()}
                className="btn btn-primary"
                disabled={!bulkSelectedIds.size}
                title="Enviar template aprovado pela Meta para os orçamentos selecionados"
              >
                <Send className="h-4 w-4" />
                Disparar WhatsApp {bulkSelectedIds.size ? `(${bulkSelectedIds.size})` : ""}
              </button>
              <button
                type="button"
                onClick={() => void load()}
                className="btn btn-secondary"
              >
                <RefreshCw className="h-4 w-4" />
                Atualizar
              </button>
              <button
                type="button"
                onClick={() => setShowNewLead(true)}
                className="btn btn-primary"
              >
                <Plus className="h-4 w-4" />
                Adicionar lead
              </button>
              </>
            )}
          />
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
              {error}
            </div>
          )}
          {notice && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
              {notice}
            </div>
          )}
          <section className="hidden">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-sm font-bold">
                  Atividade diária da equipe
                </h2>
                <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                  Ligações e mensagens registradas nos últimos 14 dias
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-0.5">
                  {(["all", "James", "Priscila"] as const).map((seller) => (
                    <button
                      key={seller}
                      type="button"
                      onClick={() => setChartSeller(seller)}
                      className={`rounded-md px-2.5 py-1 text-[10px] font-bold ${chartSeller === seller ? "bg-[var(--primary)] text-white" : "text-[var(--text-secondary)]"}`}
                    >
                      {seller === "all" ? "Todos" : seller}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3 text-[10px] font-semibold text-[var(--text-secondary)]">
                  <span className="flex items-center gap-1">
                    <i className="h-2 w-2 rounded-full bg-blue-500" />
                    Ligações
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="h-2 w-2 rounded-full bg-emerald-500" />
                    Mensagens
                  </span>
                </div>
              </div>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={dailyActivity}
                  margin={{ top: 8, right: 12, left: -18, bottom: 0 }}
                >
                  <CartesianGrid
                    stroke="var(--border)"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "10px",
                      color: "var(--text)",
                      fontSize: "11px",
                    }}
                  />
                  {chartSeller !== "Priscila" && (
                    <Line
                      type="monotone"
                      dataKey="jamesCalls"
                      name="James · Ligações"
                      stroke="var(--analytics-blue)"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  )}
                  {chartSeller !== "Priscila" && (
                    <Line
                      type="monotone"
                      dataKey="jamesMessages"
                      name="James · Mensagens"
                      stroke="var(--analytics-green)"
                      strokeWidth={2.5}
                      strokeDasharray="5 3"
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  )}
                  {chartSeller !== "James" && (
                    <Line
                      type="monotone"
                      dataKey="priscilaCalls"
                      name="Priscila · Ligações"
                      stroke="#A855F7"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  )}
                  {chartSeller !== "James" && (
                    <Line
                      type="monotone"
                      dataKey="priscilaMessages"
                      name="Priscila · Mensagens"
                      stroke="#059669"
                      strokeWidth={2.5}
                      strokeDasharray="5 3"
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className="analytics-card analytics-chart grid min-h-[620px] grid-cols-1 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] lg:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(760px,800px)_320px_minmax(440px,1fr)]">
            <div className="min-w-0 border-b border-[var(--border)] lg:border-b-0 lg:border-r">
              <div className="hidden">
                <div>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="analytics-chart-title text-xs font-bold">Atividade diária</h2>
                      <p className="text-[10px] text-[var(--text-muted)]">
                        Ligações e mensagens · últimos 14 dias
                      </p>
                    </div>
                    <div className="flex rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-0.5">
                      {(["all", "James", "Priscila"] as const).map((seller) => (
                        <button
                          key={seller}
                          type="button"
                          onClick={() => setChartSeller(seller)}
                          className={`rounded-md px-2 py-1 text-[10px] font-bold ${chartSeller === seller ? "bg-[var(--primary)] text-white" : "text-[var(--text-secondary)]"}`}
                        >
                          {seller === "all" ? "Todos" : seller}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="h-[165px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={dailyActivity}
                        margin={{ top: 4, right: 6, left: -22, bottom: 0 }}
                      >
                        <CartesianGrid
                          stroke="var(--border)"
                          strokeDasharray="3 3"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="label"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "var(--text-muted)", fontSize: 9 }}
                        />
                        <YAxis
                          allowDecimals={false}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "var(--text-muted)", fontSize: 9 }}
                        />
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: "var(--surface)",
                            border: "1px solid var(--border)",
                            borderRadius: "10px",
                            color: "var(--text)",
                            fontSize: "11px",
                          }}
                        />
                        {chartSeller !== "Priscila" && (
                          <Line
                            type="monotone"
                            dataKey="jamesCalls"
                            name="James · Ligações"
                            stroke="var(--analytics-blue)"
                            strokeWidth={2}
                            dot={false}
                          />
                        )}
                        {chartSeller !== "Priscila" && (
                          <Line
                            type="monotone"
                            dataKey="jamesMessages"
                            name="James · Mensagens"
                            stroke="var(--analytics-green)"
                            strokeWidth={2}
                            strokeDasharray="4 3"
                            dot={false}
                          />
                        )}
                        {chartSeller !== "James" && (
                          <Line
                            type="monotone"
                            dataKey="priscilaCalls"
                            name="Priscila · Ligações"
                            stroke="#A855F7"
                            strokeWidth={2}
                            dot={false}
                          />
                        )}
                        {chartSeller !== "James" && (
                          <Line
                            type="monotone"
                            dataKey="priscilaMessages"
                            name="Priscila · Mensagens"
                            stroke="#059669"
                            strokeWidth={2}
                            strokeDasharray="4 3"
                            dot={false}
                          />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    KPIs
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {metrics.map(([label, value, detail]) => (
                      <article
                        key={label}
                        title={String(detail)}
                        className="rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-2 py-1.5"
                      >
                        <p className="text-[9px] font-semibold leading-3 text-[var(--text-secondary)]">
                          {label}
                        </p>
                        <strong className="mt-0.5 block font-mono text-sm">
                          {value}
                        </strong>
                      </article>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 border-b border-[var(--border)] p-3">
                <label className="flex h-9 min-w-[190px] flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3">
                  <Search className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Nome ou telefone"
                    className="min-w-0 flex-1 bg-transparent text-xs outline-none"
                  />
                </label>
                <select
                  value={sellerFilter}
                  onChange={(event) =>
                    setSellerFilter(event.target.value as "all" | Seller)
                  }
                  className="h-9 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 text-xs font-semibold"
                >
                  <option value="all">Todos os vendedores</option>
                  {sellers.map((seller) => (
                    <option key={seller}>{seller}</option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as "open" | LeadStatus)
                  }
                  className="h-9 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 text-xs font-semibold"
                >
                  <option value="open">Carteira aberta</option>
                  {Object.entries(statusLabel).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              {loading ? (
                <LoadingPanel
                  label="Carregando reativação"
                  description="Organizando a carteira de contatos."
                />
              ) : (
                <div className="custom-scrollbar overflow-x-auto overflow-y-auto">
                  <div className="min-w-[840px]">
                    <div className="grid grid-cols-[30px_180px_110px_92px_92px_100px_80px_100px_110px_28px] gap-1.5 border-b border-[var(--border)] bg-[var(--bg-subtle)] px-2 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      <label className="flex items-center justify-center" title="Selecionar todos os leads com telefone"><input type="checkbox" checked={filtered.filter(lead => lead.phone).length > 0 && filtered.filter(lead => lead.phone).every(lead => bulkSelectedIds.has(lead.id))} onChange={event => setBulkSelectedIds(event.target.checked ? new Set(filtered.filter(lead => lead.phone).map(lead => lead.id)) : new Set())} /></label>
                      <span>Lead</span>
                      <span>Telefone</span>
                      <span>Valor</span>
                      <span>Data orçamento</span>
                      <span>Responsável</span>
                      <span>Status</span>
                      <span>Andamento</span>
                      <span>WhatsApp</span>
                      <span />
                    </div>
                    {filtered.map((lead) => (
                      <button
                        type="button"
                        key={lead.id}
                        onClick={() => setSelected(lead)}
                        className={`grid w-full grid-cols-[30px_180px_110px_92px_92px_100px_80px_100px_110px_28px] gap-1.5 border-b border-[var(--border-subtle)] px-2 py-3 text-left transition hover:bg-[var(--surface-hover)] ${selected?.id === lead.id ? "bg-[var(--primary-dim)]/55" : ""}`}
                      >
                        <span className="flex items-center justify-center" onClick={(event) => event.stopPropagation()}><input type="checkbox" disabled={!lead.phone} checked={bulkSelectedIds.has(lead.id)} onChange={(event) => setBulkSelectedIds(current => { const next = new Set(current); if (event.target.checked) next.add(lead.id); else next.delete(lead.id); return next; })} title={lead.phone ? "Selecionar para disparo" : "Sem telefone válido"} /></span>
                        <strong className="min-w-0 self-center whitespace-normal break-words text-xs leading-4">
                          {lead.patient_name}
                        </strong>
                        <span className="self-center font-mono text-[11px] text-[var(--text-secondary)]">
                          {lead.phone}
                        </span>
                        <span className="self-center font-mono text-xs font-semibold text-[var(--text)]">
                          {money(lead.budget_value_cents)}
                        </span>
                        <span className="self-center text-[11px] text-[var(--text-secondary)]">
                          {dateOnly(lead.budget_date)}
                        </span>
                        <span className="self-center text-xs font-semibold">
                          {lead.assignee || "Não atribuído"}
                        </span>
                        <span className="self-center">
                          <StatusBadge tone={lead.source_status === "lost" ? "danger" : "warning"}>
                            {sourceStatusLabel(lead.source_status)}
                          </StatusBadge>
                        </span>
                        <span className="self-center">
                          <span className="inline-flex rounded-full bg-[var(--bg-subtle)] px-2 py-1 text-[10px] font-semibold">
                            {statusLabel[lead.status]}
                          </span>
                        </span>
                        <span className={`self-center text-[10px] font-semibold ${campaignStatusByLead[lead.id] === "sent" ? "text-emerald-600" : campaignStatusByLead[lead.id] === "failed" ? "text-rose-600" : "text-[var(--text-muted)]"}`}>
                          {campaignStatusByLead[lead.id] === "sent" ? "Enviada" : campaignStatusByLead[lead.id] === "failed" ? "Falhou" : campaignStatusByLead[lead.id] === "skipped" ? "Ignorada" : "Não disparada"}
                        </span>
                        <ChevronRight className="my-auto h-4 w-4 text-[var(--text-muted)]" />
                      </button>
                    ))}
                    {filtered.length === 0 && (
                      <div className="py-20 text-center text-sm text-[var(--text-muted)]">
                        Nenhum lead nesta seleção.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <aside className="custom-scrollbar space-y-4 overflow-y-auto bg-[var(--bg-subtle)]/35 p-4">
              <div className="hidden">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Indicadores da campanha
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {metrics.map(([label, value, detail]) => (
                    <article
                      key={label}
                      title={String(detail)}
                      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
                    >
                      <p className="text-[10px] font-semibold leading-4 text-[var(--text-secondary)]">
                        {label}
                      </p>
                      <strong className="mt-1 block font-mono text-xl tracking-[-0.04em]">
                        {value}
                      </strong>
                    </article>
                  ))}
                </div>
              </div>
              {selected ? (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--primary)]">
                        Ficha do lead
                      </p>
                      <h2 className="analytics-chart-title mt-1 text-lg font-bold">
                        {selected.patient_name}
                      </h2>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        {selected.phone} · {money(selected.budget_value_cents)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelected(null)}
                      className="rounded-lg p-2 hover:bg-[var(--surface-hover)]"
                      aria-label="Fechar"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div>
                    <a
                      href={whatsappHref(selected.phone)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 rounded-xl bg-[#1F6F5B] px-3 py-2.5 text-xs font-bold text-white"
                    >
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp
                    </a>
                  </div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                    Responsável
                    <select
                      value={selected.assignee || ""}
                      onChange={(event) =>
                        void updateAssignment(
                          selected,
                          event.target.value as Seller,
                        )
                      }
                      className="mt-1.5 h-9 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-xs"
                    >
                      <option value="">Atribuir vendedor</option>
                      {sellers.map((seller) => (
                        <option key={seller}>{seller}</option>
                      ))}
                    </select>
                  </label>
                  <form
                    onSubmit={saveInteraction}
                    className="space-y-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[var(--primary)]" />
                      <h3 className="analytics-chart-title text-xs font-bold">Registrar ações</h3>
                    </div>
                    <div>
                      <select
                        value={interaction.seller}
                        onChange={(event) =>
                          setInteraction((current) => ({
                            ...current,
                            seller: event.target.value as Seller,
                          }))
                        }
                        className="h-9 rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-2 text-xs"
                      >
                        {sellers.map((seller) => (
                          <option key={seller}>{seller}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {[
                        {
                          title: "WhatsApp",
                          icon: MessageCircle,
                          actions: [
                            "whatsapp_message",
                            "whatsapp_interested",
                            "whatsapp_not_interested",
                            "whatsapp_already_treated",
                          ] as ActionKey[],
                        },
                        {
                          title: "Ligações",
                          icon: Phone,
                          actions: [
                            "call_answered",
                            "call_no_answer",
                            "call_not_interested",
                            "call_already_treated",
                          ] as ActionKey[],
                        },
                      ].map((group) => {
                        const Icon = group.icon;
                        return (
                          <div
                            key={group.title}
                            className="rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-2"
                          >
                            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold">
                              <Icon className="h-3.5 w-3.5 text-[var(--primary)]" />
                              {group.title}
                            </p>
                            <div className="space-y-1">
                              {group.actions.map((action) => (
                                <label
                                  key={action}
                                  className="flex cursor-pointer items-center gap-1.5 text-[11px] leading-4 text-[var(--text-secondary)]"
                                >
                                  <input
                                    type="checkbox"
                                    checked={interaction.actions.includes(
                                      action,
                                    )}
                                    onChange={() =>
                                      setInteraction((current) => ({
                                        ...current,
                                        actions: current.actions.includes(
                                          action,
                                        )
                                          ? current.actions.filter(
                                              (item) => item !== action,
                                            )
                                          : [...current.actions, action],
                                      }))
                                    }
                                    className="clean-checkbox"
                                  />
                                  {actionDefinitions[action].label}
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-2">
                      <p className="mb-1 text-[11px] font-bold">Resultado</p>
                      <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                        {(
                          ["scheduled", "attended", "no_show"] as ActionKey[]
                        ).map((action) => (
                          <label
                            key={action}
                            className="flex cursor-pointer items-center gap-1.5 text-[11px] leading-4 text-[var(--text-secondary)]"
                          >
                            <input
                              type="checkbox"
                              checked={interaction.actions.includes(action)}
                              onChange={() =>
                                setInteraction((current) => ({
                                  ...current,
                                  actions: current.actions.includes(action)
                                    ? current.actions.filter(
                                        (item) => item !== action,
                                      )
                                    : [...current.actions, action],
                                }))
                              }
                              className="clean-checkbox"
                            />
                            {actionDefinitions[action].label}
                          </label>
                        ))}
                      </div>
                    </div>
                    {interaction.actions.includes("scheduled") && (
                      <label className="block text-[11px] text-[var(--text-secondary)]">
                        Data e horário do agendamento
                        <input
                          required
                          value={interaction.scheduled_for}
                          onChange={(event) =>
                            setInteraction((current) => ({
                              ...current,
                              scheduled_for: event.target.value,
                            }))
                          }
                          type="datetime-local"
                          className="mt-1 h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-2 text-xs"
                        />
                      </label>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setResultModal("converted")}
                        className="h-9 rounded-lg bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700"
                      >
                        Converter venda
                      </button>
                      <button
                        type="button"
                        onClick={() => setResultModal("lost")}
                        className="h-9 rounded-lg border border-rose-200 bg-rose-50 text-xs font-bold text-rose-700 hover:bg-rose-100"
                      >
                        Registrar perda
                      </button>
                    </div>
                    <textarea
                      value={interaction.note}
                      onChange={(event) =>
                        setInteraction((current) => ({
                          ...current,
                          note: event.target.value,
                        }))
                      }
                      placeholder="Resumo do contato"
                      className="min-h-20 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-2.5 py-2 text-xs outline-none"
                    />
                    <label className="block text-[11px] text-[var(--text-secondary)]">
                      Próximo retorno
                      <input
                        value={interaction.next_follow_up_at}
                        onChange={(event) =>
                          setInteraction((current) => ({
                            ...current,
                            next_follow_up_at: event.target.value,
                          }))
                        }
                        type="datetime-local"
                        className="mt-1 h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-2 text-xs"
                      />
                    </label>
                    <button
                      disabled={saving || interaction.actions.length === 0}
                      className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] text-xs font-bold text-white disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {saving ? "Salvando..." : "Salvar registro"}
                    </button>
                  </form>
                  <div>
                    <h3 className="analytics-chart-title mb-2 text-xs font-bold">Histórico</h3>
                    <div className="space-y-2">
                      {selectedInteractions.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5"
                        >
                          <div className="flex items-center justify-between gap-2 text-[10px]">
                            <span className="font-bold">
                              {item.channel === "call" ? "Ligação" : "WhatsApp"}{" "}
                              · {item.seller}
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="text-[var(--text-muted)]">
                                Registrado em {dateTime(item.created_at)}
                              </span>
                              <button
                                type="button"
                                onClick={() => void deleteInteraction(item)}
                                className="rounded p-1 text-rose-600 hover:bg-rose-50"
                                aria-label="Excluir registro"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                            {outcomeLabel[item.outcome] || item.outcome}
                            {item.note ? ` · ${item.note}` : ""}
                            {item.scheduled_for
                              ? ` · Agendado para ${dateTime(item.scheduled_for)}`
                              : ""}
                          </p>
                        </div>
                      ))}
                      {selectedInteractions.length === 0 && (
                        <p className="text-xs text-[var(--text-muted)]">
                          Nenhum contato registrado.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
                  <UserRound className="h-9 w-9 text-[var(--primary)] opacity-60" />
                  <p className="mt-3 text-sm font-semibold">
                    Selecione um lead
                  </p>
                  <p className="mt-1 max-w-[250px] text-xs text-[var(--text-muted)]">
                    Abra a ficha para enviar WhatsApp e registrar cada ação.
                  </p>
                </div>
              )}
            </aside>
            <aside className="custom-scrollbar space-y-5 overflow-y-auto border-t border-[var(--border)] bg-[var(--bg-subtle)]/55 p-4 lg:col-span-2 2xl:col-span-1 2xl:border-l 2xl:border-t-0">
              <div>
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--primary)]">
                      Desempenho da equipe
                    </p>
                    <h2 className="analytics-chart-title mt-1 text-base font-bold">
                      Atividade diária
                    </h2>
                    <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                      Ligações e mensagens nos últimos 14 dias
                    </p>
                  </div>
                  <div className="flex rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5">
                    {(["all", "James", "Priscila"] as const).map((seller) => (
                      <button
                        key={seller}
                        type="button"
                        onClick={() => setChartSeller(seller)}
                        className={`rounded-md px-2 py-1 text-[9px] font-bold ${chartSeller === seller ? "bg-[var(--primary)] text-white" : "text-[var(--text-secondary)]"}`}
                      >
                        {seller === "all" ? "Todos" : seller}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="analytics-card analytics-chart h-[190px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2 pt-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={dailyActivity}
                      margin={{ top: 4, right: 6, left: -24, bottom: 2 }}
                    >
                      <CartesianGrid
                        stroke="var(--border)"
                        strokeDasharray="3 3"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "var(--text-muted)", fontSize: 9 }}
                      />
                      <YAxis
                        allowDecimals={false}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "var(--text-muted)", fontSize: 9 }}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: "var(--surface)",
                          border: "1px solid var(--border)",
                          borderRadius: "10px",
                          color: "var(--text)",
                          fontSize: "11px",
                        }}
                      />
                      {chartSeller !== "Priscila" && (
                        <Line
                          type="monotone"
                          dataKey="jamesCalls"
                          name="James · Ligações"
                          stroke="var(--analytics-blue)"
                          strokeWidth={2}
                          dot={false}
                        />
                      )}
                      {chartSeller !== "Priscila" && (
                        <Line
                          type="monotone"
                          dataKey="jamesMessages"
                          name="James · Mensagens"
                          stroke="var(--analytics-green)"
                          strokeWidth={2}
                          strokeDasharray="4 3"
                          dot={false}
                        />
                      )}
                      {chartSeller !== "James" && (
                        <Line
                          type="monotone"
                          dataKey="priscilaCalls"
                          name="Priscila · Ligações"
                          stroke="#A855F7"
                          strokeWidth={2}
                          dot={false}
                        />
                      )}
                      {chartSeller !== "James" && (
                        <Line
                          type="monotone"
                          dataKey="priscilaMessages"
                          name="Priscila · Mensagens"
                          stroke="#059669"
                          strokeWidth={2}
                          strokeDasharray="4 3"
                          dot={false}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                      Indicadores
                    </p>
                    <h3 className="analytics-chart-title mt-1 text-sm font-bold">
                      Resumo da campanha
                    </h3>
                  </div>
                  <span className="rounded-full bg-[var(--primary-dim)] px-2 py-1 text-[9px] font-bold text-[var(--primary)]">
                    Atualizado
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {metrics.map(([label, value, detail], index) => (
                    <MetricCard
                      key={label}
                      label={String(label)}
                      value={value}
                      helper={detail}
                      tone={index === 3 ? "success" : index === 0 || index === 1 ? "primary" : "neutral"}
                      className={index === 2 || index === 3 ? "col-span-2" : ""}
                    />
                  ))}
                </div>
              </div>
            </aside>
          </section>
          {showNewLead && (
            <div className="fixed inset-0 z-50 flex items-end bg-slate-950/40 sm:items-center sm:justify-center sm:p-6">
              <form
                onSubmit={createLead}
                className="w-full max-w-lg rounded-t-2xl bg-[var(--surface)] p-5 shadow-2xl sm:rounded-2xl"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold">Adicionar orçamento</h2>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Inclua o lead para iniciar a reativação.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowNewLead(false)}
                    className="rounded-lg p-2 hover:bg-[var(--surface-hover)]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <label className="sm:col-span-2 text-xs font-semibold">
                    Nome
                    <input
                      required
                      value={newLead.patient_name}
                      onChange={(event) =>
                        setNewLead((current) => ({
                          ...current,
                          patient_name: event.target.value,
                        }))
                      }
                      className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 text-sm"
                    />
                  </label>
                  <label className="text-xs font-semibold">
                    Telefone
                    <input
                      required
                      value={newLead.phone}
                      onChange={(event) =>
                        setNewLead((current) => ({
                          ...current,
                          phone: event.target.value,
                        }))
                      }
                      className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 text-sm"
                    />
                  </label>
                  <label className="text-xs font-semibold">
                    Valor do orçamento
                    <input
                      value={newLead.budget_value}
                      onChange={(event) =>
                        setNewLead((current) => ({
                          ...current,
                          budget_value: event.target.value,
                        }))
                      }
                      inputMode="decimal"
                      placeholder="0,00"
                      className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 text-sm"
                    />
                  </label>
                  <label className="text-xs font-semibold">
                    Origem
                    <select
                      value={newLead.source_status}
                      onChange={(event) =>
                        setNewLead((current) => ({
                          ...current,
                          source_status: event.target.value as
                            "lost" | "expired",
                        }))
                      }
                      className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 text-sm"
                    >
                      <option value="lost">Orçamento perdido</option>
                      <option value="expired">Orçamento vencido</option>
                    </select>
                  </label>
                  <label className="text-xs font-semibold">
                    Responsável
                    <select
                      value={newLead.assignee}
                      onChange={(event) =>
                        setNewLead((current) => ({
                          ...current,
                          assignee: event.target.value as Seller,
                        }))
                      }
                      className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 text-sm"
                    >
                      {sellers.map((seller) => (
                        <option key={seller}>{seller}</option>
                      ))}
                    </select>
                  </label>
                  <label className="sm:col-span-2 text-xs font-semibold">
                    Data do orçamento
                    <input
                      value={newLead.budget_date}
                      onChange={(event) =>
                        setNewLead((current) => ({
                          ...current,
                          budget_date: event.target.value,
                        }))
                      }
                      type="date"
                      className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 text-sm"
                    />
                  </label>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewLead(false)}
                    className="rounded-xl px-4 py-2 text-xs font-bold text-[var(--text-secondary)]"
                  >
                    Cancelar
                  </button>
                  <button
                    disabled={saving}
                    className="rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {saving ? "Salvando..." : "Adicionar à carteira"}
                  </button>
                </div>
              </form>
            </div>
          )}
          {resultModal && selected && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <form
                onSubmit={saveSpecialResult}
                className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl"
              >
                <h3 className="text-base font-bold">
                  {resultModal === "converted"
                    ? "Converter venda"
                    : "Registrar perda"}
                </h3>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  {selected.patient_name}
                </p>
                {resultModal === "converted" ? (
                  <label className="mt-4 block text-xs font-semibold">
                    Valor da venda
                    <input
                      required
                      autoFocus
                      inputMode="decimal"
                      value={resultData.value}
                      onChange={(event) =>
                        setResultData((current) => ({
                          ...current,
                          value: event.target.value,
                        }))
                      }
                      placeholder={money(selected.budget_value_cents)}
                      className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 text-sm"
                    />
                  </label>
                ) : (
                  <label className="mt-4 block text-xs font-semibold">
                    Motivo da perda
                    <textarea
                      required
                      autoFocus
                      value={resultData.loss_reason}
                      onChange={(event) =>
                        setResultData((current) => ({
                          ...current,
                          loss_reason: event.target.value,
                        }))
                      }
                      placeholder="Ex.: fechou em outra clínica"
                      className="mt-1.5 min-h-24 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2 text-sm"
                    />
                  </label>
                )}
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setResultModal(null);
                      setResultData({ value: "", loss_reason: "" });
                    }}
                    className="rounded-xl px-4 py-2 text-xs font-bold text-[var(--text-secondary)]"
                  >
                    Cancelar
                  </button>
                  <button
                    disabled={saving}
                    className="rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {saving ? "Salvando..." : "Confirmar"}
                  </button>
                </div>
              </form>
            </div>
          )}
          {campaignOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
              <section className="w-full max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl">
                <header className="flex items-start justify-between gap-3">
                  <div><p className="text-[10px] font-bold uppercase tracking-wider text-[var(--primary)]">WhatsApp oficial</p><h3 className="mt-1 text-base font-bold">Disparar reativação em massa</h3><p className="mt-1 text-xs text-[var(--text-secondary)]">{bulkSelectedIds.size} orçamento(s) selecionado(s). Só templates atualmente aprovados pela Meta podem ser usados.</p></div>
                  <button type="button" onClick={() => setCampaignOpen(false)} className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"><X className="h-4 w-4" /></button>
                </header>
                {campaignLoading ? <LoadingPanel label="Consultando templates" description="Validando os templates aprovados na Meta." /> : <>
                  <label className="mt-5 block text-xs font-semibold">Template aprovado<select value={campaignTemplateKey} onChange={event => setCampaignTemplateKey(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 text-sm outline-none"><option value="">Selecione um template</option>{campaignTemplates.map(template => <option key={`${template.name}-${template.language}`} value={`${template.name}::${template.language}`}>{template.name} · {template.category || "Meta"} · {template.language}</option>)}</select></label>
                  {(() => { const template = campaignTemplates.find(item => `${item.name}::${item.language}` === campaignTemplateKey); const unit = whatsappRates[String(template?.category || "").toUpperCase()] || 0; return <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] p-3"><div className="flex items-center justify-between text-xs"><span className="text-[var(--text-secondary)]">Estimativa do lote</span><strong className="font-mono text-base">{unit ? money(Math.round(unit * bulkSelectedIds.size * 100)) : "--"}</strong></div><p className="mt-1 text-[10px] leading-4 text-[var(--text-muted)]">{unit ? `Base de ${money(Math.round(unit * 100))} por mensagem · tarifa Brasil para categoria ${template?.category}. O valor real depende da cobrança Meta, créditos e isenções.` : "A categoria deste template não possui tarifa estimável configurada; o custo real será informado pela Meta."}</p></div>; })()}
                  {campaignNotice && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">{campaignNotice}</p>}
                  <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setCampaignOpen(false)} className="rounded-xl px-4 py-2 text-xs font-bold text-[var(--text-secondary)]">Cancelar</button><button type="button" disabled={campaignSending || !campaignTemplateKey || !campaignTemplates.length} onClick={() => void sendCampaign()} className="flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-3.5 w-3.5" />{campaignSending ? "Processando..." : "Disparar agora"}</button></div>
                </>}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
