import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  Activity,
  AlertTriangle,
  Archive,
  ArchiveRestore,
  Building2,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Columns3,
  Filter,
  FileText,
  FolderOpen,
  GitBranch,
  GripVertical,
  Grid2X2,
  History,
  List,
  Mail,
  MessageSquareText,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Tag,
  Target,
  Trash2,
  Trophy,
  UserRound,
  Users,
  X,
} from "lucide-react";
import "./crm-workspace.css";
import "./crm-workspace-polish.css";

export type CRMSection = "deals" | "leads" | "contacts" | "activities";
type DealStatus = "open" | "won" | "lost" | "deleted";
type ActivityState = "overdue" | "today" | "future" | "none";
type Stage = {
  id: string;
  name: string;
  probability: number;
  rotting: boolean;
  rottingDays: number;
};
type DealActivity = {
  id: number;
  dealId: number;
  subject: string;
  type: string;
  due: string;
  time?: string;
  done: boolean;
  owner: string;
  priority: "Normal" | "Alta";
};
type Note = {
  id: number;
  dealId: number;
  text: string;
  pinned: boolean;
  createdAt: string;
};
type DealLabel = {
  id: number;
  name: string;
  color: string;
};
type OwnerProfile = {
  id: string;
  email: string;
  name: string;
};
type Deal = {
  id: number;
  title: string;
  person: string;
  organization: string;
  value: number;
  owner: string;
  stageId: string;
  status: DealStatus;
  createdAt: number;
  expectedClose?: string;
  probability?: number;
  label?: string;
  source?: string;
  sourceId?: string;
  personPhone?: string;
  personEmail?: string;
  visibility: string;
  isNew?: boolean;
  lostReason?: string;
  lostAt?: string;
  wonAt?: string;
  deletedAt?: string;
  stageEnteredAt?: string;
  stageDurations?: Record<string, number>;
};

const initialStages: Stage[] = [
  {
    id: "entrada",
    name: "Leads em entrada",
    probability: 10,
    rotting: false,
    rottingDays: 7,
  },
  {
    id: "contato",
    name: "Contatados",
    probability: 25,
    rotting: true,
    rottingDays: 0,
  },
  {
    id: "proposta",
    name: "Propostas",
    probability: 50,
    rotting: false,
    rottingDays: 7,
  },
  {
    id: "negociacao",
    name: "Negociação",
    probability: 80,
    rotting: false,
    rottingDays: 7,
  },
];
const defaultNewPipelineStages: Stage[] = [
  { id: "qualificado", name: "Qualificado", probability: 100, rotting: false, rottingDays: 0 },
  { id: "contato-feito", name: "Contato feito", probability: 100, rotting: false, rottingDays: 0 },
  { id: "demo-agendada", name: "Demonstração agendada", probability: 100, rotting: false, rottingDays: 0 },
  { id: "proposta-feita", name: "Proposta feita", probability: 100, rotting: false, rottingDays: 0 },
  { id: "negociacoes-iniciadas", name: "Negociações iniciadas", probability: 100, rotting: false, rottingDays: 0 },
];
const initialLabels: DealLabel[] = [
  { id: 1, name: "Prioridade alta", color: "#d83c38" },
  { id: 2, name: "Retorno", color: "#f0a202" },
  { id: 3, name: "Indicação", color: "#2d8647" },
  { id: 4, name: "Implante", color: "#6150e1" },
];
const initialDeals: Deal[] = [
  {
    id: 1,
    title: "Avaliação de implante · Ana Paula",
    person: "Ana Paula Ribeiro",
    organization: "Clínica Sorriso Leve",
    value: 30000,
    owner: "Camila Ribeiro",
    stageId: "entrada",
    status: "open",
    createdAt: 10,
    visibility: "Grupo de visibilidade do responsável",
  },
  {
    id: 2,
    title: "Plano ortodôntico familiar com acompanhamento completo",
    person: "Lucas Martins",
    organization: "Família Costa",
    value: 1234567.89,
    owner: "Mariana Alves",
    stageId: "entrada",
    status: "open",
    createdAt: 9,
    visibility: "Todos os usuários",
  },
  {
    id: 3,
    title: "Lente de contato dental",
    person: "Marina Souza",
    organization: "Odonto Prime",
    value: 1000,
    owner: "Camila Ribeiro",
    stageId: "entrada",
    status: "open",
    createdAt: 8,
    visibility: "Grupo de visibilidade do responsável",
  },
  {
    id: 4,
    title: "Reabilitação oral completa",
    person: "Roberto Dias",
    organization: "Clínica Vida Plena",
    value: 0,
    owner: "Rafael Mendes",
    stageId: "entrada",
    status: "open",
    createdAt: 7,
    visibility: "Proprietário do item",
  },
  {
    id: 5,
    title: "Protocolo de implantes",
    person: "Patrícia Almeida",
    organization: "Instituto Bem Estar",
    value: 3000,
    owner: "Camila Ribeiro",
    stageId: "contato",
    status: "open",
    createdAt: 6,
    visibility: "Grupo de visibilidade do responsável",
  },
  {
    id: 6,
    title: "Clareamento + limpeza",
    person: "João Pereira",
    organization: "Escola Crescer",
    value: 2000,
    owner: "Mariana Alves",
    stageId: "proposta",
    status: "open",
    createdAt: 5,
    visibility: "Todos os usuários",
  },
  {
    id: 7,
    title: "Tratamento endodôntico",
    person: "Fernanda Lima",
    organization: "Construtora Bela Vista",
    value: 8000,
    owner: "Rafael Mendes",
    stageId: "proposta",
    status: "open",
    createdAt: 4,
    visibility: "Grupo de visibilidade do responsável",
  },
  {
    id: 8,
    title: "Facetas em porcelana",
    person: "Juliana Costa",
    organization: "Clínica Vida Plena",
    value: 5000,
    owner: "Camila Ribeiro",
    stageId: "negociacao",
    status: "open",
    createdAt: 3,
    visibility: "Grupo de visibilidade do responsável",
  },
  {
    id: 9,
    title: "Implante com enxerto",
    person: "Paulo Henrique",
    organization: "Odonto Prime",
    value: 20000,
    owner: "Rafael Mendes",
    stageId: "negociacao",
    status: "open",
    createdAt: 2,
    visibility: "Todos os usuários",
  },
  {
    id: 10,
    title: "Alinhadores estéticos",
    person: "Renata Freitas",
    organization: "Clínica Sorriso Leve",
    value: 50000,
    owner: "Mariana Alves",
    stageId: "negociacao",
    status: "open",
    createdAt: 1,
    visibility: "Grupo de visibilidade do responsável",
  },
];
const localDateKey = (date = new Date()) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};
const dateFromToday = (offset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return localDateKey(date);
};
const localTimeKey = () =>
  `${String(new Date().getHours()).padStart(2, "0")}:${String(
    new Date().getMinutes(),
  ).padStart(2, "0")}`;
const nextQuarterHour = () => {
  const next = new Date();
  next.setSeconds(0, 0);
  next.setMinutes((Math.floor(next.getMinutes() / 15) + 1) * 15);
  return `${String(next.getHours()).padStart(2, "0")}:${String(
    next.getMinutes(),
  ).padStart(2, "0")}`;
};
const timePlusMinutes = (value: string, minutes: number) => {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return "";
  const total = Number(match[1]) * 60 + Number(match[2]) + minutes;
  return `${String(Math.floor((total % 1440) / 60)).padStart(2, "0")}:${String(
    total % 60,
  ).padStart(2, "0")}`;
};

const initialActivities: DealActivity[] = [
  {
    id: 101,
    dealId: 1,
    subject: "Retornar ligação",
    type: "Ligação",
    due: dateFromToday(-1),
    time: "10:00",
    done: false,
    owner: "Camila Ribeiro",
    priority: "Alta",
  },
  {
    id: 102,
    dealId: 5,
    subject: "Enviar proposta atualizada",
    type: "Tarefa",
    due: dateFromToday(0),
    done: false,
    owner: "Camila Ribeiro",
    priority: "Normal",
  },
  {
    id: 103,
    dealId: 6,
    subject: "Confirmar condições",
    type: "Ligação",
    due: dateFromToday(0),
    time: "16:00",
    done: false,
    owner: "Mariana Alves",
    priority: "Normal",
  },
  {
    id: 104,
    dealId: 7,
    subject: "Reunião de apresentação",
    type: "Reunião",
    due: dateFromToday(4),
    time: "09:30",
    done: false,
    owner: "Rafael Mendes",
    priority: "Alta",
  },
  {
    id: 105,
    dealId: 8,
    subject: "Negociar parcelamento",
    type: "Ligação",
    due: dateFromToday(0),
    time: "11:30",
    done: false,
    owner: "Camila Ribeiro",
    priority: "Alta",
  },
  {
    id: 106,
    dealId: 9,
    subject: "Follow-up comercial",
    type: "Tarefa",
    due: dateFromToday(5),
    done: false,
    owner: "Rafael Mendes",
    priority: "Normal",
  },
];

const todayKey = () => localDateKey();
const DAY_MS = 86_400_000;
const elapsedStageDays = (enteredAt?: string) =>
  enteredAt
    ? Math.max(
        0,
        Math.floor((Date.now() - new Date(enteredAt).getTime()) / DAY_MS),
      )
    : 0;
const stageDays = (deal: Deal, stageId: string) =>
  stageId === deal.stageId
    ? elapsedStageDays(deal.stageEnteredAt)
    : deal.stageDurations?.[stageId] || 0;
const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value,
  );
const load = <T,>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
};
const nextOpenActivity = (dealId: number, activities: DealActivity[]) =>
  activities
    .filter((item) => item.dealId === dealId && !item.done)
    .sort((a, b) => {
      const date = a.due.localeCompare(b.due);
      if (date) return date;
      if (!a.time && b.time) return -1;
      if (a.time && !b.time) return 1;
      return (a.time || "").localeCompare(b.time || "");
    })[0];
const activityState = (
  dealId: number,
  activities: DealActivity[],
): ActivityState => {
  const first = nextOpenActivity(dealId, activities);
  const today = todayKey();
  if (!first) return "none";
  if (
    first.due < today ||
    (first.due === today && first.time && first.time < localTimeKey())
  )
    return "overdue";
  if (first.due === today) return "today";
  return "future";
};
const statusCopy: Record<ActivityState, string> = {
  overdue: "Ver atividade vencida",
  today: "Ver atividade programada para hoje",
  future: "Ver próxima atividade",
  none: "Agendar uma atividade",
};

export const CRMWorkspace: React.FC<{ section?: CRMSection }> = ({
  section = "deals",
}) => {
  const [stages, setStages] = useState<Stage[]>(() =>
    load("crm-demo-stages", initialStages),
  );
  const [deals, setDeals] = useState<Deal[]>(() =>
    load<Deal[]>("crm-demo-deals", initialDeals).map((deal) => ({
      ...deal,
      stageEnteredAt:
        deal.stageEnteredAt ||
        new Date(Date.now() - (deal.id % 3) * DAY_MS).toISOString(),
      stageDurations: deal.stageDurations || {},
    })),
  );
  const [activities, setActivities] = useState<DealActivity[]>(() =>
    load("crm-demo-activities", initialActivities),
  );
  const [notes, setNotes] = useState<Note[]>(() => load("crm-demo-notes", []));
  const [labels, setLabels] = useState<DealLabel[]>(() =>
    load("crm-demo-labels", initialLabels),
  );
  const [pipelineName, setPipelineName] = useState(() =>
    load("crm-demo-pipeline-name", "Funil comercial"),
  );
  const [editorMode, setEditorMode] = useState<"edit" | "new">("edit");
  const [ownerProfiles, setOwnerProfiles] = useState<OwnerProfile[]>([]);
  const [screen, setScreen] = useState<
    "board" | "detail" | "editor" | "activities" | "contacts" | "leads"
  >(
    section === "activities"
      ? "activities"
      : section === "contacts"
        ? "contacts"
        : section === "leads"
          ? "leads"
          : "board",
  );
  const [selectedDealId, setSelectedDealId] = useState<number | null>(null);
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [dealModal, setDealModal] = useState(false);
  const [activityModal, setActivityModal] = useState<{
    dealId?: number;
    next?: boolean;
    won?: boolean;
  } | null>(null);
  const [activityPopover, setActivityPopover] = useState<{
    dealId: number;
    left: number;
    top: number;
  } | null>(null);
  const [lostDealId, setLostDealId] = useState<number | null>(null);
  const [wonDealId, setWonDealId] = useState<number | null>(null);
  const [deleteDealId, setDeleteDealId] = useState<number | null>(null);
  const [deleteActivityId, setDeleteActivityId] = useState<number | null>(null);
  const [deleteNoteId, setDeleteNoteId] = useState<number | null>(null);
  const [deleteOrganization, setDeleteOrganization] = useState<string | null>(
    null,
  );
  const [notice, setNotice] = useState<{
    text: string;
    dealId?: number;
  } | null>(null);
  const [quickAdd, setQuickAdd] = useState(false);
  const [currentOwner, setCurrentOwner] = useState<string | null>(null);
  const [clockTick, setClockTick] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => setClockTick((tick) => tick + 1), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(
    () => localStorage.setItem("crm-demo-stages", JSON.stringify(stages)),
    [stages],
  );
  useEffect(
    () => localStorage.setItem("crm-demo-deals", JSON.stringify(deals)),
    [deals],
  );
  useEffect(
    () =>
      localStorage.setItem("crm-demo-activities", JSON.stringify(activities)),
    [activities],
  );
  useEffect(
    () => localStorage.setItem("crm-demo-notes", JSON.stringify(notes)),
    [notes],
  );
  useEffect(
    () => localStorage.setItem("crm-demo-labels", JSON.stringify(labels)),
    [labels],
  );
  useEffect(
    () =>
      localStorage.setItem(
        "crm-demo-pipeline-name",
        JSON.stringify(pipelineName),
      ),
    [pipelineName],
  );
  useEffect(() => {
    let active = true;
    const loadOwners = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      let result = await supabase.from("profiles").select("id,email,full_name").order("email");
      if (result.error) {
        result = await supabase.from("profiles").select("id,email").order("email") as typeof result;
      }
      if (!active || result.error) return;
      const data = result.data;
        setOwnerProfiles(
          (data || []).map((profile: { id: string; email?: string | null; full_name?: string | null }) => ({
            id: profile.id,
            email: profile.email || "",
            name: profile.full_name?.trim() || profile.email?.split("@")[0] || "Usuário",
          })),
        );
      const currentProfile = (data || []).find(
        (profile: { id: string }) => profile.id === user?.id,
      ) as { email?: string | null; full_name?: string | null } | undefined;
      setCurrentOwner(
        currentProfile?.full_name?.trim() ||
          currentProfile?.email?.split("@")[0] ||
          null,
      );
    };
    void loadOwners();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const count = activities.filter(
      (item) =>
        !item.done &&
        item.due <= todayKey() &&
        (!currentOwner || item.owner === currentOwner),
    ).length;
    localStorage.setItem("crm-activity-count", String(count));
    window.dispatchEvent(
      new CustomEvent("crm-activity-count", { detail: count }),
    );
  }, [activities, currentOwner, clockTick]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        (event.target as HTMLElement)?.tagName === "INPUT" ||
        (event.target as HTMLElement)?.tagName === "TEXTAREA"
      )
        return;
      if (event.key.toLowerCase() === "d") setDealModal(true);
      if (event.key.toLowerCase() === "a") setActivityModal({});
      if (event.key.toLowerCase() === "l") setScreen("leads");
      if (event.key.toLowerCase() === "p" || event.key.toLowerCase() === "o")
        setScreen("contacts");
      if (event.key === "Escape") {
        setQuickAdd(false);
        setActivityPopover(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const selectedDeal = deals.find((item) => item.id === selectedDealId) || null;
  const openDeal = (id: number) => {
    setSelectedDealId(id);
    setScreen("detail");
  };
  const updateDeal = (id: number, patch: Partial<Deal>) =>
    setDeals((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  const updateActivity = (id: number, patch: Partial<DealActivity>) =>
    setActivities((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  const moveDeal = (id: number, nextStageId: string) =>
    setDeals((current) =>
      current.map((deal) => {
        if (deal.id !== id || deal.stageId === nextStageId) return deal;
        const accumulated =
          (deal.stageDurations?.[deal.stageId] || 0) +
          elapsedStageDays(deal.stageEnteredAt);
        return {
          ...deal,
          stageId: nextStageId,
          stageEnteredAt: new Date().toISOString(),
          stageDurations: {
            ...(deal.stageDurations || {}),
            [deal.stageId]: accumulated,
          },
        };
      }),
    );
  const completeActivity = (id: number) => {
    const current = activities.find((item) => item.id === id);
    if (!current) return;
    const remaining = activities.filter(
      (item) => item.dealId === current.dealId && !item.done && item.id !== id,
    );
    setActivities((items) =>
      items.map((item) => (item.id === id ? { ...item, done: true } : item)),
    );
    setNotice({ text: `Atividade marcada como concluída (${current.subject})` });
    if (!remaining.length)
      setActivityModal({ dealId: current.dealId, next: true });
  };
  const markWon = (id: number) => {
    updateDeal(id, {
      status: "won",
      wonAt: new Date().toISOString(),
      lostAt: undefined,
      lostReason: undefined,
    });
    setNotice({ text: "Negócio marcado como ganho" });
    window.setTimeout(() => setWonDealId(id), 4000);
  };
  const reopen = (id: number) =>
    updateDeal(id, {
      status: "open",
      wonAt: undefined,
      lostAt: undefined,
      lostReason: undefined,
    });

  return (
    <main className="crmws">
      {screen === "board" && (
        <BoardView
          stages={stages}
          deals={deals}
          activities={activities}
          pipelineName={pipelineName}
          onOpenDeal={openDeal}
          onAdd={() => setDealModal(true)}
          onAddActivity={() => setActivityModal({})}
          onNavigate={setScreen}
          onActivity={(dealId, rect) =>
            setActivityPopover({
              dealId,
              left: Math.max(12, Math.min(rect.right + 6, window.innerWidth - 402)),
              top: Math.max(12, Math.min(rect.top - 24, window.innerHeight - 360)),
            })
          }
          onEditPipeline={() => {
            setEditorMode("edit");
            setScreen("editor");
          }}
          onCreatePipeline={() => {
            setEditorMode("new");
            setScreen("editor");
          }}
          onMove={moveDeal}
          onUpdateDeal={updateDeal}
          onUpdateActivity={updateActivity}
          onDropAction={(id, action) =>
            action === "won"
              ? markWon(id)
              : action === "lost"
                ? setLostDealId(id)
                : action === "delete"
                  ? setDeleteDealId(id)
                  : undefined
          }
          quickAdd={quickAdd}
          setQuickAdd={setQuickAdd}
        />
      )}
      {screen === "detail" && selectedDeal && (
        <DealDetail
          deal={selectedDeal}
          stages={stages}
          activities={activities.filter(
            (item) => item.dealId === selectedDeal.id,
          )}
          notes={notes.filter((item) => item.dealId === selectedDeal.id)}
          labels={labels}
          owners={ownerProfiles}
          onBack={() => setScreen("board")}
          onMove={(stageId) => moveDeal(selectedDeal.id, stageId)}
          onWon={() => markWon(selectedDeal.id)}
          onLost={() => setLostDealId(selectedDeal.id)}
          onReopen={() => reopen(selectedDeal.id)}
          onDelete={() => setDeleteDealId(selectedDeal.id)}
          onRestore={() =>
            updateDeal(selectedDeal.id, {
              status: "open",
              deletedAt: undefined,
            })
          }
          onSchedule={() => setActivityModal({ dealId: selectedDeal.id })}
          onUpdate={(patch) => updateDeal(selectedDeal.id, patch)}
          onDeleteOrganization={() => setDeleteOrganization(selectedDeal.organization)}
          onOpenContact={() => {
            setSelectedContact(selectedDeal.person);
            setScreen("contacts");
          }}
          onCreateLabel={(label) => {
            const created = { ...label, id: Date.now() };
            setLabels((items) => [...items, created]);
            updateDeal(selectedDeal.id, { label: created.name });
          }}
          onComplete={completeActivity}
          onDeleteActivity={setDeleteActivityId}
          onDeleteNote={setDeleteNoteId}
          onAddNote={(text) =>
            setNotes((items) => [
              {
                id: Date.now(),
                dealId: selectedDeal.id,
                text,
                pinned: true,
                createdAt: new Date().toISOString(),
              },
              ...items,
            ])
          }
          onAddActivity={(activity) =>
            setActivities((items) => [{ ...activity, id: Date.now(), done: false }, ...items])
          }
        />
      )}
      {screen === "editor" && (
        <PipelineEditor
          stages={editorMode === "new" ? [] : stages}
          initialName={editorMode === "new" ? "Novo funil" : pipelineName}
          isNew={editorMode === "new"}
          dealCount={deals.filter((deal) => deal.status !== "deleted").length}
          stageDealCounts={Object.fromEntries(
            stages.map((stage) => [
              stage.id,
              deals.filter(
                (deal) => deal.stageId === stage.id && deal.status !== "deleted",
              ).length,
            ]),
          )}
          onCancel={() => setScreen("board")}
          onSave={(name, next) => {
            const nextStageIds = new Set(next.map((stage) => stage.id));
            setDeals((items) =>
              items.map((deal) =>
                nextStageIds.has(deal.stageId)
                  ? deal
                  : {
                      ...deal,
                      status: "deleted",
                      deletedAt: new Date().toISOString(),
                    },
              ),
            );
            setPipelineName(name);
            setStages(next);
            setScreen("board");
            setNotice({
              text:
                editorMode === "new"
                  ? "Novo funil criado"
                  : "Alterações do funil salvas",
            });
          }}
          onDeletePipeline={(choice) => {
            setDeals((items) =>
              items.map((deal) =>
                choice === "delete"
                  ? {
                      ...deal,
                      status: "deleted",
                      deletedAt: new Date().toISOString(),
                    }
                  : {
                      ...deal,
                      stageId: initialStages[0].id,
                      stageEnteredAt: new Date().toISOString(),
                    },
              ),
            );
            setStages(initialStages);
            setPipelineName("Funil comercial");
            setScreen("board");
            setNotice({
              text:
                choice === "delete"
                  ? "Funil excluído; os negócios foram enviados ao arquivo"
                  : "Funil excluído; os negócios foram movidos para o funil padrão",
            });
          }}
        />
      )}
      {screen === "activities" && (
        <ActivitiesView
          activities={activities}
          deals={deals}
          onAdd={() => setActivityModal({})}
          onComplete={completeActivity}
          onOpenDeal={openDeal}
        />
      )}
      {screen === "contacts" && (
        <ContactsView
          deals={deals}
          selectedPerson={selectedContact}
          onOpenDeal={openDeal}
          onDeleteOrganization={setDeleteOrganization}
        />
      )}
      {screen === "leads" && (
        <LeadsView
          deals={deals}
          onOpenDeal={openDeal}
          onAdd={() => setDealModal(true)}
        />
      )}

      {dealModal && (
        <DealForm
          stages={stages}
          owners={ownerProfiles}
          owner={currentOwner || "Camila Ribeiro"}
          deals={deals}
          pipelineName={pipelineName}
          onClose={() => setDealModal(false)}
          onSave={(deal) => {
            const created = {
              ...deal,
              id: Date.now(),
              status: "open" as const,
              createdAt: Date.now(),
              stageEnteredAt: new Date().toISOString(),
              stageDurations: {},
              isNew: true,
            };
            setDeals((items) => [created, ...items]);
            setDealModal(false);
            setNotice({
              text: `Novo negócio “${created.title}” criado`,
              dealId: created.id,
            });
          }}
        />
      )}
      {activityModal && (
        <ActivityForm
          deal={deals.find((item) => item.id === activityModal.dealId)}
          deals={deals}
          owner={currentOwner || "Camila Ribeiro"}
          next={activityModal.next}
          won={activityModal.won}
          onClose={() => setActivityModal(null)}
          onSave={(activity) => {
            setActivities((items) => [
              { ...activity, id: Date.now(), done: false },
              ...items,
            ]);
            setActivityModal(null);
            setNotice({
              text: "Atividade adicionada",
              dealId: activity.dealId,
            });
          }}
        />
      )}
      {activityPopover !== null && (
        <ActivityPopover
          deal={deals.find((item) => item.id === activityPopover.dealId)!}
          activities={activities.filter(
            (item) => item.dealId === activityPopover.dealId && !item.done,
          )}
          position={{ left: activityPopover.left, top: activityPopover.top }}
          onClose={() => setActivityPopover(null)}
          onComplete={completeActivity}
          onSchedule={() => {
            const dealId = activityPopover.dealId;
            setActivityPopover(null);
            setActivityModal({ dealId });
          }}
        />
      )}
      {lostDealId !== null && (
        <LostDialog
          onClose={() => setLostDealId(null)}
          onConfirm={(reason, comment) => {
            updateDeal(lostDealId, {
              status: "lost",
              lostReason: reason,
              lostAt: new Date().toISOString(),
            });
            if (comment.trim())
              setNotes((items) => [
                {
                  id: Date.now(),
                  dealId: lostDealId,
                  text: comment.trim(),
                  pinned: true,
                  createdAt: new Date().toISOString(),
                },
                ...items,
              ]);
            setLostDealId(null);
          }}
        />
      )}
      {wonDealId !== null && (
        <WonDialog
          deal={deals.find((item) => item.id === wonDealId)!}
          activitiesDone={
            activities.filter((item) => item.dealId === wonDealId && item.done)
              .length
          }
          onClose={() => setWonDealId(null)}
          onFollowUp={() => {
            const id = wonDealId;
            setWonDealId(null);
            setActivityModal({ dealId: id, won: true });
          }}
        />
      )}
      {deleteDealId !== null && (
        <ConfirmDialog
          title="Excluir negócio?"
          text="O negócio poderá ser restaurado por 30 dias. Atividades vinculadas serão preservadas."
          danger="Excluir negócio"
          onClose={() => setDeleteDealId(null)}
          onConfirm={() => {
            updateDeal(deleteDealId, {
              status: "deleted",
              deletedAt: new Date().toISOString(),
            });
            setDeleteDealId(null);
            setScreen("detail");
          }}
        />
      )}
      {deleteActivityId !== null && (
        <ConfirmDialog
          title="Excluir atividade?"
          text="A atividade será removida deste negócio."
          danger="Excluir atividade"
          onClose={() => setDeleteActivityId(null)}
          onConfirm={() => {
            setActivities((items) =>
              items.filter((item) => item.id !== deleteActivityId),
            );
            setDeleteActivityId(null);
          }}
        />
      )}
      {deleteNoteId !== null && (
        <ConfirmDialog
          title="Excluir nota?"
          text="Esta ação não pode ser desfeita."
          danger="Excluir nota"
          onClose={() => setDeleteNoteId(null)}
          onConfirm={() => {
            setNotes((items) =>
              items.filter((item) => item.id !== deleteNoteId),
            );
            setDeleteNoteId(null);
          }}
        />
      )}
      {deleteOrganization && (
        <ConfirmDialog
          title="Excluir organização?"
          text="Notas, arquivos, documentos e faturas da organização serão excluídos. Outros itens vinculados permanecerão sem a organização e poderão ser restaurados por 30 dias."
          danger="Excluir organização"
          onClose={() => setDeleteOrganization(null)}
          onConfirm={() => {
            setDeals((items) =>
              items.map((item) =>
                item.organization === deleteOrganization
                  ? { ...item, organization: "" }
                  : item,
              ),
            );
            setDeleteOrganization(null);
            setNotice({
              text: "Organização excluída; negócios vinculados foram preservados",
            });
          }}
        />
      )}
      {notice && (
        <div className="crmws-toast">
          <span>{notice.text}</span>
          {notice.dealId && (
            <button
              onClick={() => {
                openDeal(notice.dealId!);
                setNotice(null);
              }}
            >
              Ver
            </button>
          )}
          <button aria-label="Fechar" onClick={() => setNotice(null)}>
            <X size={15} />
          </button>
        </div>
      )}
    </main>
  );
};

const BoardView: React.FC<{
  stages: Stage[];
  deals: Deal[];
  owner: string;
  activities: DealActivity[];
  pipelineName: string;
  onOpenDeal: (id: number) => void;
  onAdd: () => void;
  onAddActivity: () => void;
  onNavigate: (
    view: "board" | "detail" | "editor" | "activities" | "contacts" | "leads",
  ) => void;
  onActivity: (id: number, rect: DOMRect) => void;
  onEditPipeline: () => void;
  onCreatePipeline: () => void;
  onMove: (id: number, stage: string) => void;
  onUpdateDeal: (id: number, patch: Partial<Deal>) => void;
  onUpdateActivity: (id: number, patch: Partial<DealActivity>) => void;
  onDropAction: (id: number, action: string) => void;
  quickAdd: boolean;
  setQuickAdd: (v: boolean) => void;
}> = (props) => {
  const [view, setView] = useState<
    "pipeline" | "list" | "forecast" | "archive"
  >("pipeline");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("Próxima atividade");
  const [sortOpen, setSortOpen] = useState(false);
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [savedFilter, setSavedFilter] = useState<"all" | "mine" | "team">("all");
  const [showClosed, setShowClosed] = useState(false);
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragStageId, setDragStageId] = useState<string | null>(null);
  const stateRank: Record<ActivityState, number> = {
    overdue: 0,
    today: 1,
    none: 2,
    future: 3,
  };
  const matchesSearch = (deal: Deal) =>
    `${deal.title} ${deal.person} ${deal.organization}`
      .toLowerCase()
      .includes(query.toLowerCase());
  const matchesSavedFilter = (deal: Deal) =>
    savedFilter === "all" ||
    (savedFilter === "mine" && Boolean(props.owner) && deal.owner === props.owner) ||
    (savedFilter === "team" && (!props.owner || deal.owner !== props.owner));
  const visible = props.deals.filter(
    (deal) =>
      (showClosed ? deal.status !== "deleted" : deal.status === "open") &&
      matchesSavedFilter(deal) &&
      matchesSearch(deal),
  );
  const forecastDeals = props.deals.filter(
    (deal) =>
      deal.status !== "deleted" &&
      deal.status !== "lost" &&
      matchesSavedFilter(deal) &&
      matchesSearch(deal),
  );
  const sorted = (items: Deal[]) =>
    [...items].sort((a, b) => {
      if (sort === "Título do negócio") return a.title.localeCompare(b.title);
      if (sort === "Valor do negócio") return b.value - a.value;
      if (sort === "Pessoa vinculada") return a.person.localeCompare(b.person);
      if (sort === "Organização vinculada")
        return a.organization.localeCompare(b.organization);
      if (sort === "Data prevista de fechamento")
        return (a.expectedClose || "9999-12-31").localeCompare(
          b.expectedClose || "9999-12-31",
        );
      if (sort === "Data de criação") return b.createdAt - a.createdAt;
      if (sort === "Responsável") return a.owner.localeCompare(b.owner);
      if (sort === "Atividades concluídas") {
        const done = (deal: Deal) =>
          props.activities.filter(
            (activity) => activity.dealId === deal.id && activity.done,
          ).length;
        return done(b) - done(a) || b.createdAt - a.createdAt;
      }
      if (sort === "Atividades a fazer") {
        const open = (deal: Deal) =>
          props.activities.filter(
            (activity) => activity.dealId === deal.id && !activity.done,
          ).length;
        return open(b) - open(a) || b.createdAt - a.createdAt;
      }
      const stateDifference =
        stateRank[activityState(a.id, props.activities)] -
        stateRank[activityState(b.id, props.activities)];
      if (stateDifference) return stateDifference;
      const aNext = nextOpenActivity(a.id, props.activities);
      const bNext = nextOpenActivity(b.id, props.activities);
      if (aNext && bNext) {
        const dueDifference = aNext.due.localeCompare(bNext.due);
        if (dueDifference) return dueDifference;
        if (!aNext.time && bNext.time) return -1;
        if (aNext.time && !bNext.time) return 1;
        const timeDifference = (aNext.time || "").localeCompare(bNext.time || "");
        if (timeDifference) return timeDifference;
      }
      return b.createdAt - a.createdAt;
    });
  const quickActions = [
    { name: "Pessoa", key: "P", run: () => props.onNavigate("contacts") },
    { name: "Organização", key: "O", run: () => props.onNavigate("contacts") },
    { name: "Atividade", key: "A", run: props.onAddActivity },
    { name: "Negócio", key: "D", run: props.onAdd },
    { name: "Lead", key: "L", run: () => props.onNavigate("leads") },
    {
      name: "Nota",
      key: "N",
      run: () => {
        if (visible[0]) props.onOpenDeal(visible[0].id);
      },
    },
    { name: "Produto", key: "R", run: () => setQuery("") },
    { name: "Projeto", key: "E", run: () => setQuery("") },
  ];
  return (
    <section className="crmws-boardview">
      <header className="crmws-toolbar">
        <div className="crmws-toolbar-group">
          <div className="crmws-viewicons">
            <button
              className={view === "pipeline" ? "active" : ""}
              onClick={() => setView("pipeline")}
              aria-label="Funil"
              data-tooltip="Funil"
            >
              <Columns3 size={16} />
            </button>
            <button
              className={view === "list" ? "active" : ""}
              onClick={() => setView("list")}
              aria-label="Lista"
              data-tooltip="Lista"
            >
              <List size={16} />
            </button>
            <button
              className={view === "forecast" ? "active" : ""}
              onClick={() => setView("forecast")}
              aria-label="Previsão"
              data-tooltip="Previsão"
            >
              <Target size={16} />
            </button>
            <button
              className={view === "archive" ? "active" : ""}
              onClick={() => setView("archive")}
              aria-label="Arquivo"
              data-tooltip="Arquivo"
            >
              <Archive size={16} />
            </button>
          </div>
          <div className="crmws-split">
            <button onClick={props.onAdd}>
              <Plus size={16} /> Negócio
            </button>
            <button
              onClick={() => props.setQuickAdd(!props.quickAdd)}
              aria-label="Menu rápido"
            >
              <ChevronDown size={14} />
            </button>
            {props.quickAdd && (
              <div className="crmws-menu crmws-quick">
                <b>Adicionar rapidamente</b>
                {quickActions.map((action) => (
                  <button
                    key={action.name}
                    onClick={() => {
                      action.run();
                      props.setQuickAdd(false);
                    }}
                  >
                    <span>{action.name}</span>
                    <kbd>{action.key}</kbd>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <label className="crmws-search">
          <Search size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar negócios, pessoas e organizações"
          />
        </label>
        <div className="crmws-toolbar-group">
          <span className="crmws-count">
            {visible.length} negócios <CircleHelp size={14} />
          </span>
          <div className="crmws-relative">
            <button
              className="crmws-select"
              onClick={() => setPipelineOpen((open) => !open)}
              aria-expanded={pipelineOpen}
            >
              <Columns3 size={15} /> {props.pipelineName} <ChevronDown size={14} />
            </button>
            {pipelineOpen && (
              <div className="crmws-menu crmws-pipeline-menu">
                <b>FUNIS</b>
                <button onClick={() => setPipelineOpen(false)}>
                  <span>{props.pipelineName}</span> <Check size={14} />
                </button>
                <hr />
                <button><span>Reordenar funis</span></button>
                <button><span>Visibilidade do funil</span></button>
                <button><span>Personalizar cartões</span></button>
                <button><span>Configurações do layout</span></button>
                <button
                  onClick={() => {
                    setPipelineOpen(false);
                    props.onCreatePipeline();
                  }}
                >
                  <span><Plus size={13} /> Novo funil</span>
                </button>
              </div>
            )}
          </div>
          <button
            className="crmws-icon"
            onClick={props.onEditPipeline}
            title="Editar funil"
          >
            <Pencil size={15} />
          </button>
          <div className="crmws-relative">
            <button
              className="crmws-select"
              onClick={() => setFilterOpen((open) => !open)}
              aria-expanded={filterOpen}
            >
              <Filter size={14} /> Filtrar <ChevronDown size={14} />
            </button>
            {filterOpen && (
              <div className="crmws-menu crmws-filter-menu">
                <b>FILTROS SALVOS</b>
                {([
                  ["all", "Todos os negócios"],
                  ["mine", "Meus negócios"],
                  ["team", "Negócios da equipe"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => {
                      setSavedFilter(value);
                      setFilterOpen(false);
                    }}
                  >
                    <span>{label}</span>
                    {savedFilter === value && <Check size={14} />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="crmws-icon">
            <MoreHorizontal size={17} />
          </button>
        </div>
      </header>
      <div className="crmws-subbar">
        <button>
          <Filter size={13} /> Adicionar condição
        </button>
        <span />
        <button
          onClick={() => setShowClosed(!showClosed)}
          className={showClosed ? "active" : ""}
        >
          Mostrar negócios encerrados
        </button>
        <div className="crmws-relative">
          <button className="crmws-sort" onClick={() => setSortOpen(!sortOpen)}>
            Ordenar por: {sort} <ChevronDown size={14} />
          </button>
          {sortOpen && (
            <div className="crmws-menu crmws-sortmenu">
              <b>ORDENAR POR</b>
              {[
                "Próxima atividade",
                "Título do negócio",
                "Valor do negócio",
                "Data de criação",
                "Pessoa vinculada",
                "Organização vinculada",
                "Data prevista de fechamento",
                "Negócio atualizado em",
                "Atividades concluídas",
                "Atividades a fazer",
                "Número de produtos",
                "Responsável",
                "Último e-mail enviado",
                "Último e-mail recebido",
              ].map((option) => (
                <button
                  key={option}
                  onClick={() => {
                    setSort(option);
                    setSortOpen(false);
                  }}
                >
                  <span>{option}</span>
                  {sort === option && <Check size={14} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {view === "pipeline" && (
        <div className="crmws-board">
          {props.stages.map((stage) => {
            const cards = sorted(visible.filter((d) => d.stageId === stage.id));
            const weighted = cards.reduce(
              (sum, d) =>
                sum + (d.value * (d.probability ?? stage.probability)) / 100,
              0,
            );
            return (
              <article
                className={`crmws-stage${dragId !== null && dragStageId === stage.id ? " drag-target" : ""}`}
                key={stage.id}
                onDragEnter={() => setDragStageId(stage.id)}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDragStageId(stage.id);
                }}
                onDrop={() => {
                  if (dragId) props.onMove(dragId, stage.id);
                  setDragId(null);
                  setDragStageId(null);
                }}
              >
                <header>
                  <h2>{stage.name}</h2>
                  <span>
                    ⚖ {money(weighted)} · {cards.length}{" "}
                    {cards.length === 1 ? "negócio" : "negócios"}
                  </span>
                </header>
                <div className="crmws-cards">
                  {cards.map((deal) => (
                    <DealCard
                      key={deal.id}
                      deal={deal}
                      state={activityState(deal.id, props.activities)}
                      rotten={
                        stage.rotting &&
                        elapsedStageDays(deal.stageEnteredAt) >= stage.rottingDays
                      }
                      onOpen={() => props.onOpenDeal(deal.id)}
                      onActivity={(event) =>
                        props.onActivity(deal.id, event.currentTarget.getBoundingClientRect())
                      }
                      dragging={dragId === deal.id}
                      onDrag={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", String(deal.id));
                        setDragId(deal.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setDragStageId(null);
                      }}
                    />
                  ))}
                  <button className="crmws-addcard" onClick={props.onAdd}>
                    <Plus size={19} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {view === "list" && (
        <DealsTableView
          deals={sorted(visible)}
          stages={props.stages}
          activities={props.activities}
          onOpen={props.onOpenDeal}
          onUpdateDeal={props.onUpdateDeal}
          onUpdateActivity={props.onUpdateActivity}
        />
      )}
      {view === "forecast" && (
        <ForecastView
          deals={sorted(forecastDeals)}
          activities={props.activities}
          onOpen={props.onOpenDeal}
          onActivity={props.onActivity}
        />
      )}
      {view === "archive" && (
        <ArchiveView
          deals={props.deals.filter(
            (deal) =>
              deal.status === "deleted" &&
              `${deal.title} ${deal.person} ${deal.organization}`
                .toLowerCase()
                .includes(query.toLowerCase()),
          )}
          onOpen={props.onOpenDeal}
        />
      )}
      {dragId !== null && (
        <div className="crmws-dropzones">
          {[
            ["delete", "Excluir"],
            ["lost", "Perdido"],
            ["won", "Ganho"],
            ["move", "Mover para"],
          ].map(([action, label]) => (
            <button
              key={action}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                props.onDropAction(dragId, action);
                setDragId(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
};

const DealsTableView: React.FC<{
  deals: Deal[];
  stages: Stage[];
  activities: DealActivity[];
  onOpen: (id: number) => void;
  onUpdateDeal: (id: number, patch: Partial<Deal>) => void;
  onUpdateActivity: (id: number, patch: Partial<DealActivity>) => void;
}> = ({ deals, stages, activities, onOpen, onUpdateDeal, onUpdateActivity }) => (
  <div className="crmws-deals-tablewrap">
    <table className="crmws-deals-table">
      <thead>
        <tr>
          <th className="crmws-table-check"><input type="checkbox" aria-label="Selecionar todos os negócios" /></th>
          <th>Título</th>
          <th>Valor</th>
          <th>Organização</th>
          <th>Pessoa de contato</th>
          <th>Data de fechamento esperada</th>
          <th>Próxima atividade em</th>
          <th>Proprietário</th>
          <th className="crmws-table-actions">Personalizar</th>
        </tr>
      </thead>
      <tbody>
        {deals.map((deal) => {
          const next = activities.find(
            (activity) => activity.dealId === deal.id && !activity.done,
          );
          return (
            <tr key={deal.id} onClick={() => onOpen(deal.id)}>
              <td className="crmws-table-check" onClick={(event) => event.stopPropagation()}><input type="checkbox" aria-label={`Selecionar ${deal.title}`} /></td>
              <InlineTableCell value={deal.title} onSave={(title) => onUpdateDeal(deal.id, { title })} className="crmws-table-title" />
              <InlineTableCell value={String(deal.value)} displayValue={money(deal.value)} inputMode="decimal" onSave={(value) => onUpdateDeal(deal.id, { value: Number(value.replace(/[^0-9,.-]/g, "").replace(",", ".")) || 0 })} className="crmws-table-value" />
              <InlineTableCell value={deal.organization} emptyLabel="—" onSave={(organization) => onUpdateDeal(deal.id, { organization })} />
              <InlineTableCell value={deal.person} onSave={(person) => onUpdateDeal(deal.id, { person })} />
              <InlineTableCell value={deal.expectedClose || ""} displayValue={deal.expectedClose ? new Date(`${deal.expectedClose}T00:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }) : "—"} type="date" emptyLabel="—" onSave={(expectedClose) => onUpdateDeal(deal.id, { expectedClose: expectedClose || undefined })} />
              <InlineTableCell value={next?.due || ""} displayValue={next ? new Date(`${next.due}T00:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }) : "Sem atividade"} type="date" emptyLabel="Sem atividade" className={next && next.due < todayKey() ? "overdue" : ""} onSave={(due) => { if (next) onUpdateActivity(next.id, { due }); }} disabled={!next} />
              <InlineTableCell value={deal.owner} onSave={(owner) => onUpdateDeal(deal.id, { owner })} />
              <td className="crmws-table-actions" onClick={(event) => event.stopPropagation()}><button aria-label={`Mais ações para ${deal.title}`}><MoreHorizontal size={16} /></button></td>
            </tr>
          );
        })}
      </tbody>
    </table>
    {!deals.length && (
      <div className="crmws-view-empty">
        <List size={28} />
        <b>Nenhum negócio encontrado</b>
        <span>Os negócios do funil aparecerão aqui em formato de lista.</span>
      </div>
    )}
  </div>
);

const InlineTableCell: React.FC<{
  value: string;
  displayValue?: string;
  emptyLabel?: string;
  type?: "text" | "date";
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  className?: string;
  disabled?: boolean;
  onSave: (value: string) => void;
}> = ({ value, displayValue, emptyLabel = "", type = "text", inputMode, className = "", disabled = false, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  const save = () => {
    setEditing(false);
    if (draft !== value) onSave(draft.trim());
  };

  return (
    <td className={`crmws-editable-cell ${className}${disabled ? " disabled" : ""}`} onClick={(event) => event.stopPropagation()}>
      {editing ? (
        <input autoFocus type={type} inputMode={inputMode} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={save} onKeyDown={(event) => { if (event.key === "Enter") save(); if (event.key === "Escape") { setDraft(value); setEditing(false); } }} />
      ) : (
        <button type="button" disabled={disabled} onClick={() => setEditing(true)} title={disabled ? "Sem atividade para editar" : "Editar campo"}>
          <span>{displayValue ?? (value || emptyLabel)}</span>
          {!disabled && <Pencil size={13} aria-hidden="true" />}
        </button>
      )}
    </td>
  );
};

const ForecastView: React.FC<{
  deals: Deal[];
  activities: DealActivity[];
  onOpen: (id: number) => void;
  onActivity: (id: number, rect: DOMRect) => void;
}> = ({ deals, activities, onOpen, onActivity }) => {
  const current = new Date();
  const months = Array.from({ length: 4 }, (_, index) => {
    const date = new Date(current.getFullYear(), current.getMonth() + index, 1);
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: date.toLocaleDateString("pt-BR", { month: "long" }),
      year: date.getFullYear(),
    };
  });
  const monthFor = (deal: Deal, index: number) =>
    deal.expectedClose?.slice(0, 7) || months[index % months.length].key;
  return (
    <div className="crmws-forecast">
      {months.map((month) => {
        const cards = deals.filter(
          (deal, index) => monthFor(deal, index) === month.key,
        );
        const total = cards.reduce((sum, deal) => sum + deal.value, 0);
        const won = cards
          .filter((deal) => deal.status === "won")
          .reduce((sum, deal) => sum + deal.value, 0);
        const open = cards
          .filter((deal) => deal.status === "open")
          .reduce((sum, deal) => sum + deal.value, 0);
        return (
          <section className="crmws-forecast-month" key={month.key}>
            <header>
              <h2>
                {month.label}
                {month.year !== current.getFullYear() ? ` ${month.year}` : ""}
              </h2>
              <div>
                <span>⚖ {money(total)}</span>
                <span className="won">+{money(won)}</span>
                <span>{money(open)}</span>
              </div>
            </header>
            <div>
              {cards.map((deal) => {
                const state = activityState(deal.id, activities);
                return (
                  <article
                    className={`crmws-forecast-card ${deal.status}`}
                    key={deal.id}
                  >
                    <button
                      className="crmws-card-title"
                      onClick={() => onOpen(deal.id)}
                    >
                      {deal.title}
                    </button>
                    <p>
                      {deal.organization || deal.person}, {deal.person}
                    </p>
                    <footer>
                      <span className="crmws-avatar">
                        {deal.owner
                          .split(" ")
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)}
                      </span>
                      {deal.status === "won" && <em>Ganho</em>}
                      <b>{money(deal.value)}</b>
                      <button
                        className={`crmws-status ${state}`}
                        onClick={(event) =>
                          onActivity(deal.id, event.currentTarget.getBoundingClientRect())
                        }
                        aria-label="Atividade"
                      >
                        {state === "none" ? (
                          <AlertTriangle size={13} />
                        ) : state === "overdue" ? (
                          <ChevronLeft size={14} />
                        ) : (
                          <ChevronRight size={14} />
                        )}
                      </button>
                    </footer>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
};

const ArchiveView: React.FC<{
  deals: Deal[];
  onOpen: (id: number) => void;
}> = ({ deals, onOpen }) => (
  <div className="crmws-archive-view">
    {deals.length ? (
      deals.map((deal) => (
        <article key={deal.id}>
          <Archive size={17} />
          <div>
            <button onClick={() => onOpen(deal.id)}>{deal.title}</button>
            <span>
              {deal.organization || deal.person} · Excluído em{" "}
              {deal.deletedAt
                ? new Date(deal.deletedAt).toLocaleDateString("pt-BR")
                : "data não informada"}
            </span>
          </div>
          <b>{money(deal.value)}</b>
        </article>
      ))
    ) : (
      <div className="crmws-view-empty">
        <Archive size={30} />
        <b>Arquivo vazio</b>
        <span>
          Negócios excluídos aparecerão aqui e poderão ser restaurados por 30
          dias.
        </span>
      </div>
    )}
  </div>
);

const DealCard: React.FC<{
  deal: Deal;
  state: ActivityState;
  rotten: boolean;
  onOpen: () => void;
  onActivity: (event: React.MouseEvent<HTMLButtonElement>) => void;
  dragging: boolean;
  onDrag: (event: React.DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
}> = ({ deal, state, rotten, onOpen, onActivity, dragging, onDrag, onDragEnd }) => (
  <article
    className={`crmws-card${rotten ? " rotten" : ""}${dragging ? " dragging" : ""}`}
    draggable
    onDragStart={onDrag}
    onDragEnd={onDragEnd}
  >
    <div>
      <button className="crmws-card-title" onClick={onOpen}>
        {deal.title}
        {deal.isNew && <em>NOVO</em>}
      </button>
      <p>{deal.organization || deal.person}</p>
      <footer>
        <span className="crmws-avatar">
          {deal.owner
            .split(" ")
            .map((x) => x[0])
            .join("")
            .slice(0, 2)}
        </span>
        {rotten && (
          <span className="crmws-rotten" title="Sem ações por menos de 1 dia">
            &lt;1d
          </span>
        )}
        <b>{money(deal.value)}</b>
      </footer>
    </div>
    <button
      className={`crmws-status ${state}`}
      title={statusCopy[state]}
      onClick={(event) => {
        event.stopPropagation();
        onActivity(event);
      }}
    >
      {state === "none" ? (
        <AlertTriangle size={14} />
      ) : state === "overdue" ? (
        <ChevronLeft size={15} />
      ) : (
        <ChevronRight size={15} />
      )}
    </button>
  </article>
);

const DealDetail: React.FC<{
  deal: Deal;
  stages: Stage[];
  activities: DealActivity[];
  notes: Note[];
  labels: DealLabel[];
  owners: OwnerProfile[];
  onBack: () => void;
  onMove: (s: string) => void;
  onWon: () => void;
  onLost: () => void;
  onReopen: () => void;
  onDelete: () => void;
  onRestore: () => void;
  onSchedule: () => void;
  onUpdate: (patch: Partial<Deal>) => void;
  onDeleteOrganization: () => void;
  onOpenContact: () => void;
  onCreateLabel: (label: Omit<DealLabel, "id">) => void;
  onComplete: (id: number) => void;
  onDeleteActivity: (id: number) => void;
  onDeleteNote: (id: number) => void;
  onAddNote: (text: string) => void;
  onAddActivity: (activity: Omit<DealActivity, "id" | "done">) => void;
}> = (p) => {
  const [tab, setTab] = useState<"activity" | "note" | "meeting" | "call" | "whatsapp" | "email" | "files" | "documents" | "invoice">("activity");
  const [note, setNote] = useState("");
  const [editingValue, setEditingValue] = useState(false);
  const [valueDraft, setValueDraft] = useState(String(p.deal.value));
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [newLabelOpen, setNewLabelOpen] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#6150e1");
  const [dateOpen, setDateOpen] = useState(false);
  const [probabilityOpen, setProbabilityOpen] = useState(false);
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [followersOpen, setFollowersOpen] = useState(false);
  const [detailMenuOpen, setDetailMenuOpen] = useState(false);
  const [activityMenuId, setActivityMenuId] = useState<number | null>(null);
  const [noteMenuId, setNoteMenuId] = useState<number | null>(null);
  const [historyFilter, setHistoryFilter] = useState<"all" | "activities" | "notes" | "whatsapp" | "emails" | "files" | "documents" | "invoices" | "changes">("all");
  const [expandFocus, setExpandFocus] = useState(false);
  const [activityEditor, setActivityEditor] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set(["Resumo"]));
  const open = p.activities.filter((a) => !a.done);
  const selectedLabel = p.labels.find((label) => label.name === p.deal.label);
  const personNameParts = p.deal.person.trim().split(/\s+/).filter(Boolean);
  const personFirstName = personNameParts[0] || "–";
  const personLastName = personNameParts.slice(1).join(" ") || "–";
  const saveValue = () => {
    const normalized = valueDraft.replace(/\./g, "").replace(",", ".");
    const nextValue = Number(normalized);
    if (Number.isFinite(nextValue) && nextValue >= 0) p.onUpdate({ value: nextValue });
    else setValueDraft(String(p.deal.value));
    setEditingValue(false);
  };
  const toggleSection = (section: string) => {
    setOpenSections((current) => {
      const next = new Set(current);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };
  const done = p.activities.filter((a) => a.done);
  const composerCopy: Record<typeof tab, { prompt: string; action?: string }> = {
    activity: { prompt: "Clique aqui para adicionar uma atividade..." },
    note: { prompt: "Escreva uma nota" },
    meeting: { prompt: "Escolha um horário para compartilhar com o contato.", action: "Abrir agendador" },
    call: { prompt: "Registre ou inicie uma chamada para este negócio.", action: "Registrar chamada" },
    whatsapp: { prompt: "Envie uma mensagem do WhatsApp para o contato.", action: "Abrir WhatsApp" },
    email: { prompt: "Escreva um e-mail para o contato deste negócio.", action: "Escrever e-mail" },
    files: { prompt: "Arraste arquivos aqui ou selecione do seu computador.", action: "Adicionar arquivo" },
    documents: { prompt: "Crie ou vincule documentos deste negócio.", action: "Adicionar documento" },
    invoice: { prompt: "Crie uma fatura vinculada a este negócio.", action: "Criar fatura" },
  };
  const historyRows = [
    ...done.map((activity) => ({ key: `activity-${activity.id}`, type: "activities" as const, icon: <Check size={15} />, title: activity.subject, detail: "Atividade concluída" })),
    ...p.notes.map((item) => ({ key: `note-${item.id}`, type: "notes" as const, icon: <MessageSquareText size={15} />, title: "Nota adicionada", detail: item.text })),
    ...(p.deal.status === "won" || p.deal.status === "lost" ? [{ key: "outcome", type: "changes" as const, icon: p.deal.status === "won" ? <Trophy size={15} /> : <X size={15} />, title: `Negócio marcado como ${p.deal.status === "won" ? "ganho" : "perdido"}`, detail: p.deal.status === "lost" ? `Motivo: ${p.deal.lostReason || "Não informado"}` : "Status atualizado" }] : []),
    { key: "created", type: "changes" as const, icon: <History size={15} />, title: "Negócio criado", detail: "Registro inicial" },
  ].filter((row) => historyFilter === "all" || row.type === historyFilter);
  return (
    <section className="crmws-detail">
      <header className="crmws-detail-head">
        <h1>{p.deal.title}</h1>
        <div className="crmws-detail-actions">
          <div className="crmws-owner-select">
            <button className="crmws-owner-button" onClick={() => setOwnerOpen((open) => !open)} aria-expanded={ownerOpen}>
              <span className="crmws-avatar">{p.deal.owner.slice(0, 2).toUpperCase()}</span>
              <span>
                <b>{p.deal.owner}</b>
                <small>Proprietário</small>
              </span>
              <ChevronDown size={13} />
            </button>
            {ownerOpen && (
              <div className="crmws-owner-menu">
                <header><b>Escolher proprietário</b><button onClick={() => setOwnerOpen(false)}><X size={14} /></button></header>
                <div>
                  {p.owners.map((owner) => (
                    <button key={owner.id} onClick={() => { p.onUpdate({ owner: owner.name }); setOwnerOpen(false); }}>
                      <span className="crmws-avatar">{owner.name.slice(0, 2).toUpperCase()}</span>
                      <span><b>{owner.name}</b><small>{owner.email}</small></span>
                      {p.deal.owner === owner.name && <Check size={14} />}
                    </button>
                  ))}
                  {!p.owners.length && <p>Nenhum usuário cadastrado encontrado.</p>}
                </div>
              </div>
            )}
          </div>
          <div className="crmws-relative">
            <button className="crmws-followers" onClick={() => setFollowersOpen((open) => !open)} aria-expanded={followersOpen}>
              1 seguidor <ChevronDown size={13} />
            </button>
            {followersOpen && (
              <div className="crmws-menu crmws-followers-menu">
                <b>SEGUIDORES</b>
                <button><span>{p.deal.owner}</span><Check size={14} /></button>
                <hr />
                <button><span><Plus size={13} /> Adicionar seguidor</span></button>
                <button onClick={() => setFollowersOpen(false)}><span>Parar de seguir</span></button>
              </div>
            )}
          </div>
          {p.deal.status === "open" ? (
            <>
              <span className="crmws-outcome-split">
                <button className="won" onClick={p.onWon}>
                  Ganho
                </button>
                <button className="won" aria-label="Mais opções de ganho">
                  <ChevronDown size={13} />
                </button>
              </span>
              <button className="lost" onClick={p.onLost}>
                Perdido
              </button>
            </>
          ) : p.deal.status === "deleted" ? (
            <>
              <span className="crmws-deal-status deleted">EXCLUÍDO</span>
              <button onClick={p.onRestore}>
                <ArchiveRestore size={15} /> Restaurar
              </button>
            </>
          ) : (
            <>
              <span className={`crmws-deal-status ${p.deal.status}`}>
                {p.deal.status === "won" ? "GANHO" : "PERDIDO"}
              </span>
              <button onClick={p.onReopen}>
                <RotateCcw size={15} /> Reabrir
              </button>
            </>
          )}
          <button className="crmws-icon" aria-label="Aplicativos">
            <Grid2X2 size={15} />
            <ChevronDown size={11} />
          </button>
          <div className="crmws-relative">
            <button className="crmws-icon" onClick={() => setDetailMenuOpen((open) => !open)} aria-label="Mais ações">
              <MoreHorizontal size={16} />
            </button>
            {detailMenuOpen && (
              <div className="crmws-menu crmws-detail-menu">
                {[
                  "Duplicar",
                  "Mesclar",
                  "Exportar como XLSX",
                  "Converter em lead",
                  "Relatar dados incorretos",
                  "Arquivar",
                  "Gerenciar seções da lateral",
                ].map((item) => <button key={item}><span>{item}</span></button>)}
                <hr />
                <button className="danger" onClick={() => { setDetailMenuOpen(false); p.onDelete(); }}><span>Excluir</span></button>
              </div>
            )}
          </div>
        </div>
      </header>
      {p.deal.status === "deleted" && (
        <div className="crmws-deleted-banner">
          Este negócio será excluído permanentemente em {new Date(new Date(p.deal.deletedAt || Date.now()).getTime() + 30 * DAY_MS).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}. Se necessário, exporte os dados antes dessa data.
        </div>
      )}
      <div className={`crmws-stagebar ${p.deal.status}`}>
        <div>
          {p.stages.map((stage, index) => {
            const current = p.stages.findIndex((s) => s.id === p.deal.stageId);
            return (
              <button
                key={stage.id}
                className={index <= current ? "passed" : ""}
                onClick={() => p.deal.status === "open" && p.onMove(stage.id)}
                title={
                  index === current
                    ? `Está nesta etapa há ${stageDays(p.deal, stage.id)} ${stageDays(p.deal, stage.id) === 1 ? "dia" : "dias"}`
                    : index < current
                      ? `Permaneceu ${stageDays(p.deal, stage.id)} ${stageDays(p.deal, stage.id) === 1 ? "dia" : "dias"} nesta etapa`
                      : "Este negócio ainda não esteve nesta etapa"
                }
              >
                <span>
                  {index <= current
                    ? `${stageDays(p.deal, stage.id)} ${stageDays(p.deal, stage.id) === 1 ? "dia" : "dias"} · ${stage.name}`
                    : stage.name}
                </span>
              </button>
            );
          })}
        </div>
        <button className="crmws-create-project" disabled={p.deal.status === "deleted"}>Criar projeto</button>
      </div>
      <div className="crmws-breadcrumb">
        <button onClick={p.onBack}>Pipeline</button> <ChevronRight size={13} />{" "}
        <button>{p.stages.find((s) => s.id === p.deal.stageId)?.name}</button>
      </div>
      <div className="crmws-detail-grid">
        <aside>
          <section className="crmws-summary-panel">
            <header>
              <button className="crmws-accordion-trigger" onClick={() => toggleSection("Resumo")} aria-expanded={openSections.has("Resumo")}>
                <ChevronDown className={openSections.has("Resumo") ? "open" : ""} size={16} /> <b>Resumo</b>
              </button>
              <button aria-label="Mais opções">
                <MoreHorizontal size={16} />
              </button>
            </header>
            {openSections.has("Resumo") && <div className="crmws-summary-content">
            <div className="crmws-summary-row">
              <div className="crmws-inline-field crmws-value-field">
                <Trophy size={15} />
                {editingValue ? (
                  <span className="crmws-inline-editor">
                    <b>R$</b>
                    <input
                      autoFocus
                      inputMode="decimal"
                      value={valueDraft}
                      onChange={(event) => setValueDraft(event.target.value)}
                      onBlur={saveValue}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") saveValue();
                        if (event.key === "Escape") {
                          setValueDraft(String(p.deal.value));
                          setEditingValue(false);
                        }
                      }}
                      aria-label="Valor do negócio"
                    />
                  </span>
                ) : (
                  <button className="crmws-inline-trigger" onClick={() => setEditingValue(true)}>
                    {money(p.deal.value)} <Pencil size={12} />
                  </button>
                )}
              </div>
              <button>
                <Plus size={14} /> Produtos
              </button>
            </div>
            <div className="crmws-summary-row">
              {p.deal.organization ? (
                <div className="crmws-inline-field crmws-org-field">
                  <Building2 size={14} />
                  <button className="crmws-inline-trigger">{p.deal.organization}</button>
                  <button className="crmws-inline-remove" onClick={p.onDeleteOrganization} aria-label="Excluir organização" title="Excluir organização">
                    <Trash2 size={13} />
                  </button>
                </div>
              ) : (
                <button><Plus size={14} /> Organização</button>
              )}
            </div>
            <div className="crmws-summary-row">
              <button onClick={p.onOpenContact}>
                <UserRound size={14} /> {p.deal.person || "Adicionar pessoa"}
              </button>
              <button>
                <Plus size={14} /> Participantes
              </button>
            </div>
            <div className="crmws-summary-row crmws-popover-anchor">
              <button onClick={() => setLabelsOpen((open) => !open)}>
                <Tag size={14} />
                {selectedLabel ? (
                  <span
                    className="crmws-selected-label"
                    style={{
                      color: selectedLabel.color,
                      backgroundColor: `${selectedLabel.color}18`,
                      borderColor: `${selectedLabel.color}55`,
                    }}
                  >
                    <i style={{ backgroundColor: selectedLabel.color }} />
                    {selectedLabel.name}
                  </span>
                ) : (
                  p.deal.label || "Adicionar etiquetas"
                )}
              </button>
              {labelsOpen && (
                <div className="crmws-field-popover crmws-label-popover">
                  <header><b>Etiquetas</b><button onClick={() => setLabelsOpen(false)}><X size={14} /></button></header>
                  <div className="crmws-label-list">
                    {p.labels.map((label) => (
                      <button key={label.id} onClick={() => { p.onUpdate({ label: label.name }); setLabelsOpen(false); }}>
                        <i style={{ background: label.color }} />
                        <span>{label.name}</span>
                        {p.deal.label === label.name && <Check size={14} />}
                      </button>
                    ))}
                  </div>
                  <button className="crmws-create-label" onClick={() => setNewLabelOpen(true)}><Plus size={14} /> Criar nova etiqueta</button>
                </div>
              )}
            </div>
            <div className="crmws-summary-row crmws-popover-anchor">
              <button onClick={() => setDateOpen((open) => !open)}>
                <CalendarDays size={14} />{" "}
                {p.deal.expectedClose
                  ? new Date(
                      `${p.deal.expectedClose}T12:00:00`,
                    ).toLocaleDateString("pt-BR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : "Definir data de fechamento"}
              </button>
              {dateOpen && (
                <div className="crmws-field-popover crmws-date-popover">
                  <header><b>Data prevista de fechamento</b><button onClick={() => setDateOpen(false)}><X size={14} /></button></header>
                  <input autoFocus type="date" value={p.deal.expectedClose || ""} onChange={(event) => {
                    p.onUpdate({ expectedClose: event.target.value || undefined });
                    if (event.target.value) setDateOpen(false);
                  }} />
                  {p.deal.expectedClose && <button className="crmws-clear-date" onClick={() => { p.onUpdate({ expectedClose: undefined }); setDateOpen(false); }}>Limpar data</button>}
                </div>
              )}
            </div>
            <div className="crmws-summary-row">
              <button>
                <GitBranch size={14} /> Adicionar sequência
              </button>
            </div>
            <div className="crmws-summary-row">
              <button>
                <Plus size={14} /> Projeto
              </button>
            </div>
            <div className="crmws-summary-row crmws-popover-anchor">
              <button onClick={() => setProbabilityOpen((open) => !open)}>
                <Target size={14} /> {p.deal.probability == null ? "Definir probabilidade" : `Probabilidade: ${p.deal.probability}%`}
              </button>
              {probabilityOpen && (
                <div className="crmws-field-popover crmws-probability-popover">
                  <header><b>Probabilidade de ganho</b><button onClick={() => setProbabilityOpen(false)}><X size={14} /></button></header>
                  <div className="crmws-probability-options">
                    {[10, 25, 50, 75, 100].map((probability) => (
                      <button key={probability} className={p.deal.probability === probability ? "selected" : ""} onClick={() => { p.onUpdate({ probability }); setProbabilityOpen(false); }}>
                        {probability}% {probability === p.stages.find((stage) => stage.id === p.deal.stageId)?.probability && <small>da etapa</small>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {(p.deal.status === "won" || p.deal.status === "lost") && (
              <div className="crmws-summary-state">
                {p.deal.status === "won" && (
                  <p className="crmws-state won">
                    Ganho em{" "}
                    {new Date(p.deal.wonAt!).toLocaleDateString("pt-BR")}
                  </p>
                )}
                {p.deal.status === "lost" && (
                  <>
                    <p className="crmws-state lost">
                      Perdido em{" "}
                      {new Date(p.deal.lostAt!).toLocaleDateString("pt-BR")}
                    </p>
                    <p>
                      Motivo: <b>{p.deal.lostReason}</b>
                    </p>
                  </>
                )}
              </div>
            )}
            </div>}
          </section>
          {[
            "Detalhes",
            "Fonte",
            "Pessoa",
            "Participantes",
            "Organização",
            "Produto",
          ].map((label) => {
            const isOpen = openSections.has(label);
            return (
              <section className={`crmws-side-section${isOpen ? " open" : ""}`} key={label}>
                <div className="crmws-side-accordion">
                  <button className="crmws-accordion-trigger" onClick={() => toggleSection(label)} aria-expanded={isOpen}>
                    <ChevronDown className={isOpen ? "open" : ""} size={16} />
                    <span>{label}</span>
                    {label === "Participantes" && <em>1</em>}
                  </button>
                  <button className="crmws-accordion-action" aria-label={`Ações de ${label}`}>
                    {label === "Participantes" ? (
                      <Plus size={15} />
                    ) : label === "Fonte" ? (
                      <CircleHelp size={14} />
                    ) : (
                      <MoreHorizontal size={15} />
                    )}
                  </button>
                </div>
                {isOpen && (
                  <div className="crmws-side-section-content">
                    {label === "Fonte" ? (
                      <dl className="crmws-side-data">
                        <div><dt>Origem</dt><dd>{p.deal.source || "API"}</dd></div>
                        <div><dt>Canal de origem</dt><dd>–</dd></div>
                        <div><dt>ID do canal de origem</dt><dd>{p.deal.sourceId || "–"}</dd></div>
                      </dl>
                    ) : label === "Detalhes" ? (
                      <dl className="crmws-side-data">
                        <div><dt>Probabilidade</dt><dd>{p.deal.probability ?? p.stages.find((stage) => stage.id === p.deal.stageId)?.probability ?? 0}%</dd></div>
                        <div><dt>Visibilidade</dt><dd>{p.deal.visibility}</dd></div>
                        <div><dt>Data de criação</dt><dd>{new Date(Date.now() - p.deal.createdAt * DAY_MS).toLocaleDateString("pt-BR")}</dd></div>
                      </dl>
                    ) : label === "Pessoa" ? (
                      <div className="crmws-person-details">
                        <button className="crmws-person-link" onClick={p.onOpenContact}>
                          <span className="crmws-person-avatar"><UserRound size={18} /></span>
                          <b>{p.deal.person || "Adicionar pessoa"}</b>
                        </button>
                        <dl className="crmws-side-data">
                          <div>
                            <dt>Etiquetas</dt>
                            <dd>{selectedLabel ? <span className="crmws-mini-label" style={{ color: selectedLabel.color }}><i style={{ background: selectedLabel.color }} />{selectedLabel.name}</span> : "–"}</dd>
                          </div>
                          <div><dt>Telefone</dt><dd>{p.deal.personPhone ? <a href={`tel:${p.deal.personPhone}`}>{p.deal.personPhone}</a> : "–"}</dd></div>
                          <div><dt>E-mail</dt><dd>{p.deal.personEmail ? <a href={`mailto:${p.deal.personEmail}`}>{p.deal.personEmail}</a> : "–"}</dd></div>
                          <div><dt>Primeiro nome</dt><dd>{personFirstName}</dd></div>
                          <div><dt>Sobrenome</dt><dd>{personLastName}</dd></div>
                        </dl>
                      </div>
                    ) : (
                      <span>As informações de {label.toLowerCase()} aparecerão aqui.</span>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </aside>
        <div className="crmws-detail-main">
          <section className="crmws-composer">
            <nav>
              <button
                className={tab === "activity" ? "active" : ""}
                onClick={() => { setTab("activity"); setActivityEditor(true); }}
              >
                <CalendarDays size={14} /> Atividade
              </button>
              <button
                className={tab === "note" ? "active" : ""}
                onClick={() => setTab("note")}
              >
                <MessageSquareText size={14} /> Anotações
              </button>
              <button className={tab === "meeting" ? "active" : ""} onClick={() => setTab("meeting")}>
                <CalendarClock size={14} /> Agendador de reuniões
              </button>
              <button className={tab === "call" ? "active" : ""} onClick={() => setTab("call")}>
                <Phone size={14} /> Chamada
              </button>
              <button className={`whatsapp${tab === "whatsapp" ? " active" : ""}`} onClick={() => setTab("whatsapp")}>
                <MessageSquareText size={14} /> WhatsApp
              </button>
              <button className={tab === "email" ? "active" : ""} onClick={() => setTab("email")}>
                <Mail size={14} /> E-mail
              </button>
              <button className={tab === "files" ? "active" : ""} onClick={() => setTab("files")}>
                <FolderOpen size={14} /> Arquivos
              </button>
              <button className={tab === "documents" ? "active" : ""} onClick={() => setTab("documents")}>
                <FileText size={14} /> Documentos
              </button>
              <button className={tab === "invoice" ? "active" : ""} onClick={() => setTab("invoice")}>
                <Trophy size={14} /> Fatura
              </button>
            </nav>
            {p.deal.status === "deleted" ? (
              <p className="crmws-locked">
                Não é possível adicionar atividades a um negócio excluído.
                Restaure o negócio para continuar.
              </p>
            ) : tab === "activity" && activityEditor ? (
              <DealActivityComposer
                deal={p.deal}
                owner={p.deal.owner}
                onCancel={() => setActivityEditor(false)}
                onSave={(activity) => { p.onAddActivity(activity); setActivityEditor(false); }}
              />
            ) : tab === "activity" ? (
              <button className="crmws-compose-action" onClick={p.onSchedule}>
                Clique aqui para adicionar uma atividade...
              </button>
            ) : tab === "note" ? (
              <div className="crmws-noteform">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Escreva uma nota"
                />
                <button
                  onClick={() => {
                    if (note.trim()) {
                      p.onAddNote(note);
                      setNote("");
                    }
                  }}
                >
                  Adicionar nota
                </button>
              </div>
            ) : (
              <div className="crmws-composer-placeholder">
                <p>{composerCopy[tab].prompt}</p>
                <button onClick={() => { if (tab === "meeting" || tab === "call") p.onSchedule(); }}>{composerCopy[tab].action}</button>
              </div>
            )}
          </section>
          <section className="crmws-focus">
            <header>
              <h2>
                Foco <ChevronDown size={15} />
              </h2>
              <label className="crmws-focus-toggle">
                <input type="checkbox" checked={expandFocus} onChange={(event) => setExpandFocus(event.target.checked)} /> <span /> Expandir todos os itens
              </label>
            </header>
            {open.map((a) => (
              <div
                className={`crmws-focus-item ${activityState(a.dealId, [a])}`}
                key={a.id}
              >
                <button
                  onClick={() => p.onComplete(a.id)}
                  aria-label="Concluir"
                >
                  <span />
                </button>
                <Phone size={16} />
                <div className={expandFocus ? "expanded" : ""}>
                  <b>{a.subject}</b>
                  <small>
                    {a.due < todayKey() && <em className="crmws-overdue-badge">ATRASADA</em>}
                    {a.due} {a.time || ""} · {a.owner}
                  </small>
                </div>
                <div className="crmws-item-menu-wrap">
                  <button className="crmws-rowaction" onClick={() => setActivityMenuId(activityMenuId === a.id ? null : a.id)} aria-label="Mais ações">
                    <MoreHorizontal size={15} />
                  </button>
                  {activityMenuId === a.id && (
                    <div className="crmws-menu crmws-item-menu">
                      <button><span>Editar</span></button>
                      <button onClick={() => { p.onComplete(a.id); setActivityMenuId(null); }}><span>Marcar como concluída</span></button>
                      <button><span>Exportar como ICS</span></button>
                      <hr />
                      <button className="danger" onClick={() => { p.onDeleteActivity(a.id); setActivityMenuId(null); }}><span>Excluir</span></button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {p.notes.map((n) => (
              <div className="crmws-note" key={n.id}>
                <b>Nota fixada</b>
                <div className="crmws-item-menu-wrap">
                  <button className="crmws-rowaction" onClick={() => setNoteMenuId(noteMenuId === n.id ? null : n.id)} aria-label="Mais ações da nota">
                    <MoreHorizontal size={15} />
                  </button>
                  {noteMenuId === n.id && (
                    <div className="crmws-menu crmws-item-menu">
                      <button><span>Editar</span></button>
                      <hr />
                      <button className="danger" onClick={() => { p.onDeleteNote(n.id); setNoteMenuId(null); }}><span>Excluir</span></button>
                    </div>
                  )}
                </div>
                <p>{n.text}</p>
              </div>
            ))}
            {!open.length && !p.notes.length && (
              <div className="crmws-empty">
                <h3>Nenhum item em foco</h3>
                <p>
                  Atividades agendadas, notas fixadas e mensagens programadas
                  aparecerão aqui.
                </p>
                <button onClick={p.onSchedule}>
                  <Plus size={15} /> Agendar uma atividade
                </button>
              </div>
            )}
          </section>
          <section className="crmws-history">
            <header>
              <h2>
                Histórico <ChevronDown size={15} />
              </h2>
              <nav>
                {[
                  ["all", "Tudo"], ["activities", `Atividades (${done.length})`], ["notes", `Anotações (${p.notes.length})`], ["whatsapp", "WhatsApp"], ["emails", "E-mails"], ["files", "Arquivos"], ["documents", "Documentos"], ["invoices", "Faturas"], ["changes", "Registro de alterações"],
                ].map(([key, label]) => <button key={key} className={historyFilter === key ? "active" : ""} onClick={() => setHistoryFilter(key as typeof historyFilter)}>{label}</button>)}
              </nav>
            </header>
            {historyRows.map((row) => <div key={row.key}>{row.icon}<span><b>{row.title}</b><small>{row.detail}</small></span></div>)}
            {!historyRows.length && <div className="crmws-history-empty">Nenhum registro nesta categoria.</div>}
          </section>
        </div>
      </div>
      {newLabelOpen && (
        <div className="crmws-overlay crmws-label-overlay">
          <div className="crmws-label-dialog" role="dialog" aria-modal="true" aria-label="Criar etiqueta">
            <header>
              <h2>Criar nova etiqueta</h2>
              <button onClick={() => setNewLabelOpen(false)}><X size={16} /></button>
            </header>
            <label>
              Nome da etiqueta
              <input autoFocus value={newLabelName} onChange={(event) => setNewLabelName(event.target.value)} placeholder="Ex.: Prioridade alta" />
            </label>
            <fieldset>
              <legend>Cor</legend>
              <div>
                {["#d83c38", "#d1b800", "#2d8647", "#0d68c5", "#6150e1", "#d64f9d"].map((color) => (
                  <button key={color} type="button" className={newLabelColor === color ? "active" : ""} style={{ background: color }} onClick={() => setNewLabelColor(color)} aria-label={`Selecionar cor ${color}`} />
                ))}
              </div>
            </fieldset>
            <footer>
              <button onClick={() => setNewLabelOpen(false)}>Cancelar</button>
              <button disabled={!newLabelName.trim()} onClick={() => {
                p.onCreateLabel({ name: newLabelName.trim(), color: newLabelColor });
                setNewLabelName("");
                setNewLabelOpen(false);
                setLabelsOpen(false);
              }}>Criar etiqueta</button>
            </footer>
          </div>
        </div>
      )}
    </section>
  );
};

const PipelineEditor: React.FC<{
  stages: Stage[];
  initialName: string;
  isNew: boolean;
  dealCount: number;
  stageDealCounts: Record<string, number>;
  onCancel: () => void;
  onSave: (name: string, stages: Stage[]) => void;
  onDeletePipeline: (choice: "move" | "delete") => void;
}> = (p) => {
  const [name, setName] = useState(p.initialName);
  const [items, setItems] = useState(
    (p.stages.length ? p.stages : defaultNewPipelineStages).map((x) => ({ ...x })),
  );
  const [stageToDelete, setStageToDelete] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [deletePipelineOpen, setDeletePipelineOpen] = useState(false);
  const [deleteChoice, setDeleteChoice] = useState<"move" | "delete">("move");
  const update = (id: string, patch: Partial<Stage>) =>
    setItems((v) => v.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  return (
    <section className="crmws-editor">
      <header>
        <label>
          Nome do funil
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="crmws-toggle">
          <input type="checkbox" defaultChecked /> Probabilidade por negócio{" "}
          <CircleHelp size={14} />
        </label>
        <span />
        <button onClick={p.onCancel}>Cancelar</button>
        <button
          className="primary"
          disabled={!name.trim()}
          onClick={() => p.onSave(name, items)}
        >
          Salvar alterações
        </button>
        {!p.isNew && (
          <div className="crmws-relative">
            <button className="crmws-icon" onClick={() => setMoreOpen((open) => !open)} aria-label="Mais opções do funil">
              <MoreHorizontal size={17} />
            </button>
            {moreOpen && (
              <div className="crmws-menu crmws-editor-menu">
                <button onClick={() => { setName(`${name} - Cópia`); setMoreOpen(false); }}><span>Duplicar funil</span></button>
                <button className="danger" onClick={() => { setMoreOpen(false); setDeletePipelineOpen(true); }}><span>Excluir funil</span></button>
              </div>
            )}
          </div>
        )}
      </header>
      <div className="crmws-editor-grid">
        {items.map((stage, index) => (
          <React.Fragment key={stage.id}>
            <article>
              <header>
                <GripVertical size={15} />
                <b>{stage.name}</b>
                <span>
                  {stage.probability}% ·{" "}
                  {stage.rotting ? `${stage.rottingDays} dias` : "sem alerta"}
                </span>
              </header>
              <label>
                Nome
                <input
                  value={stage.name}
                  onChange={(e) => update(stage.id, { name: e.target.value })}
                />
              </label>
              <label>
                Probabilidade <CircleHelp size={13} />
                <span className="crmws-percent">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={stage.probability}
                    onChange={(e) =>
                      update(stage.id, { probability: Number(e.target.value) })
                    }
                  />
                  <i>%</i>
                </span>
              </label>
              <label className="crmws-toggle">
                <input
                  type="checkbox"
                  checked={stage.rotting}
                  onChange={(e) =>
                    update(stage.id, {
                      rotting: e.target.checked,
                      rottingDays: e.target.checked ? 0 : stage.rottingDays,
                    })
                  }
                />{" "}
                Negócio parado por
              </label>
              {stage.rotting && (
                <label>
                  Dias
                  <input
                    type="number"
                    min="0"
                    value={stage.rottingDays}
                    onChange={(e) =>
                      update(stage.id, { rottingDays: Number(e.target.value) })
                    }
                  />
                </label>
              )}
              <button
                className="crmws-delete-stage"
                onClick={() => setStageToDelete(stage.id)}
              >
                <Trash2 size={14} /> Excluir etapa
              </button>
            </article>
            {index < items.length && (
              <button
                className="crmws-insert"
                onClick={() =>
                  setItems((v) => [
                    ...v.slice(0, index + 1),
                    {
                      id: `etapa-${Date.now()}`,
                      name: "Nova etapa",
                      probability: 100,
                      rotting: false,
                      rottingDays: 0,
                    },
                    ...v.slice(index + 1),
                  ])
                }
              >
                <Plus size={16} />
              </button>
            )}
          </React.Fragment>
        ))}
        <aside>
          <p>
            As etapas do funil representam os passos do seu processo comercial.
          </p>
          <button
            onClick={() =>
              setItems((v) => [
                ...v,
                {
                  id: `etapa-${Date.now()}`,
                  name: "Nova etapa",
                  probability: 100,
                  rotting: false,
                  rottingDays: 0,
                },
              ])
            }
          >
            <Plus size={15} /> Nova etapa
          </button>
        </aside>
      </div>
      {stageToDelete && (
        <ConfirmDialog
          title={`Excluir ${items.find((stage) => stage.id === stageToDelete)?.name || "etapa"}?`}
          text={
            (p.stageDealCounts[stageToDelete] || 0) === 0
              ? "Não há negócios nesta etapa agora."
              : `${p.stageDealCounts[stageToDelete]} negócio(s) nesta etapa também serão excluídos.`
          }
          danger="Excluir etapa"
          onClose={() => setStageToDelete(null)}
          onConfirm={() => {
            setItems((value) =>
              value.filter((stage) => stage.id !== stageToDelete),
            );
            setStageToDelete(null);
          }}
        />
      )}
      {deletePipelineOpen && (
        <div className="crmws-overlay">
          <section className="crmws-dialog crmws-delete-pipeline-dialog">
            <header>
              <h2>Excluir funil</h2>
              <button onClick={() => setDeletePipelineOpen(false)}><X size={17} /></button>
            </header>
            <p>O que deve acontecer com os {p.dealCount} negócios deste funil?</p>
            <label className="crmws-radio-option">
              <input type="radio" checked={deleteChoice === "move"} onChange={() => setDeleteChoice("move")} />
              <span><b>Mover negócios para outro funil</b><small>Os negócios serão movidos para o funil comercial padrão.</small></span>
            </label>
            <label className="crmws-radio-option danger">
              <input type="radio" checked={deleteChoice === "delete"} onChange={() => setDeleteChoice("delete")} />
              <span><b>Excluir negócios</b><small>Os negócios poderão ser restaurados durante 30 dias.</small></span>
            </label>
            <footer>
              <button onClick={() => setDeletePipelineOpen(false)}>Cancelar</button>
              <button className="danger" onClick={() => p.onDeletePipeline(deleteChoice)}>Excluir funil</button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
};

const ActivitiesView: React.FC<{
  activities: DealActivity[];
  deals: Deal[];
  onAdd: () => void;
  onComplete: (id: number) => void;
  onOpenDeal: (id: number) => void;
}> = (p) => {
  const [period, setPeriod] = useState("A fazer");
  const [type, setType] = useState("Todos");
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const today = todayKey();
  const todayDate = new Date(`${today}T12:00:00`);
  const tomorrow = new Date(todayDate.getTime() + DAY_MS).toISOString().slice(0, 10);
  const dayOfWeek = todayDate.getDay();
  const thisWeekEnd = new Date(todayDate.getTime() + (7 - dayOfWeek) * DAY_MS)
    .toISOString()
    .slice(0, 10);
  const nextWeekEnd = new Date(todayDate.getTime() + (14 - dayOfWeek) * DAY_MS)
    .toISOString()
    .slice(0, 10);
  const rows = p.activities
    .filter((a) => type === "Todos" || a.type === type)
    .filter((a) =>
      period === "A fazer"
        ? !a.done
        : period === "Atrasadas"
          ? a.due < today && !a.done
          : period === "Hoje"
            ? a.due === today && !a.done
            : period === "Amanhã"
              ? a.due === tomorrow && !a.done
              : period === "Esta semana"
                ? a.due >= today && a.due <= thisWeekEnd && !a.done
                : period === "Próxima semana"
                  ? a.due > thisWeekEnd && a.due <= nextWeekEnd && !a.done
                  : !a.done,
    );
  return (
    <section className="crmws-list">
      <header>
        <div className="crmws-viewicons">
          <button className="active">
            <List size={16} />
          </button>
          <button>
            <CalendarDays size={16} />
          </button>
        </div>
        <div className="crmws-activity-create crmws-relative">
          <button className="crmws-primary" onClick={p.onAdd}>
            <Plus size={15} /> Atividade
          </button>
          <button className="crmws-primary" onClick={() => setCreateMenuOpen((open) => !open)} aria-label="Mais opções de atividade"><ChevronDown size={13} /></button>
          {createMenuOpen && (
            <div className="crmws-menu crmws-activity-create-menu">
              <button onClick={() => { setCreateMenuOpen(false); p.onAdd(); }}><span>Atividade</span></button>
              <button onClick={() => setCreateMenuOpen(false)}><span>Agendador de reuniões</span></button>
            </div>
          )}
        </div>
        <span />
        <button className="crmws-refresh" aria-label="Atualizar atividades"><RefreshCw size={14} /></button>
        <b>{rows.length} atividades <CircleHelp size={13} /></b>
        <button className="crmws-select">
          <UserRound size={14} /> Minha equipe <X size={13} />
        </button>
      </header>
      <div className="crmws-typebar">
        {["Todos", "Ligação", "Tarefa", "Reunião"].map((x, index) => {
          const TypeIcon = index === 1 ? Phone : index === 2 ? Check : index === 3 ? Users : Activity;
          return (
          <button
            className={type === x ? "active" : ""}
            onClick={() => setType(x)}
            key={x}
          >
            <TypeIcon size={13} /> {x}
          </button>
          );
        })}
      </div>
      <nav className="crmws-periods">
        {[
          "A fazer",
          "Atrasadas",
          "Hoje",
          "Amanhã",
          "Esta semana",
          "Próxima semana",
          "Selecionar período",
        ].map((x) => (
          <button
            className={period === x ? "active" : ""}
            onClick={() => setPeriod(x)}
            key={x}
          >
            {x}
          </button>
        ))}
      </nav>
      <div className="crmws-tablewrap">
        <table>
          <thead>
            <tr>
              <th>Concluída</th>
              <th>Assunto</th>
              <th>Negócio</th>
              <th>Prioridade</th>
              <th>Resultado</th>
              <th>Pessoa</th>
              <th>Email</th>
              <th>Telefone</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const d = p.deals.find((x) => x.id === a.dealId);
              return (
                <tr key={a.id}>
                  <td>
                    <button
                      className="crmws-done"
                      onClick={() => p.onComplete(a.id)}
                    >
                      {a.done && <Check size={13} />}
                    </button>
                  </td>
                  <td className={a.due < todayKey() && !a.done ? "overdue" : ""}>
                    {a.subject}
                    <small>
                      {a.due} {a.time}
                    </small>
                  </td>
                  <td>
                    <button onClick={() => p.onOpenDeal(a.dealId)}>
                      {d?.title}
                    </button>
                  </td>
                  <td>{a.priority}</td>
                  <td>—</td>
                  <td>{d?.person}</td>
                  <td>—</td>
                  <td>—</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && (
          <div className="crmws-empty">
            <Activity size={25} />
            <h3>Nenhuma atividade neste período</h3>
          </div>
        )}
      </div>
    </section>
  );
};

const ContactsView: React.FC<{
  deals: Deal[];
  selectedPerson?: string | null;
  onOpenDeal: (id: number) => void;
  onDeleteOrganization: (name: string) => void;
}> = (p) => {
  const contacts = Array.from(
    new Map(
      p.deals.map((d) => [
        d.person,
        { person: d.person, org: d.organization, owner: d.owner, deal: d },
      ]),
    ).values(),
  ).sort((a, b) => Number(b.person === p.selectedPerson) - Number(a.person === p.selectedPerson));
  return (
    <section className="crmws-directory">
      <header>
        <div>
          <h1>Contatos</h1>
          <p>Pessoas e organizações vinculadas aos negócios.</p>
        </div>
        <label className="crmws-search">
          <Search size={16} />
          <input placeholder="Buscar contatos" />
        </label>
      </header>
      <div className="crmws-directory-grid">
        {contacts.map((c) => (
          <article key={c.person} className={p.selectedPerson === c.person ? "selected" : ""}>
            <span className="crmws-contact-avatar">
              <UserRound size={18} />
            </span>
            <div>
              <h2>{c.person}</h2>
              <p>
                <Building2 size={13} />
                {c.org || "Sem organização"}
              </p>
              <small>Responsável: {c.owner}</small>
            </div>
            <div className="crmws-contact-actions">
              {p.selectedPerson === c.person && <span className="crmws-selected-contact"><Check size={12} /> Contato selecionado</span>}
              <button onClick={() => p.onOpenDeal(c.deal.id)}>
                Ver negócio
              </button>
              {c.org && (
                <button
                  onClick={() => p.onDeleteOrganization(c.org)}
                  aria-label="Excluir organização"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
const LeadsView: React.FC<{
  deals: Deal[];
  onOpenDeal: (id: number) => void;
  onAdd: () => void;
}> = (p) => (
  <section className="crmws-list crmws-leads">
    <header>
      <div>
        <h1>Leads</h1>
        <p>Oportunidades ainda na etapa de entrada.</p>
      </div>
      <span />
      <button className="crmws-primary" onClick={p.onAdd}>
        <Plus size={15} /> Novo lead
      </button>
    </header>
    <div className="crmws-tablewrap">
      <table>
        <thead>
          <tr>
            <th>Título</th>
            <th>Pessoa</th>
            <th>Organização</th>
            <th>Valor</th>
            <th>Responsável</th>
            <th>Próximo passo</th>
          </tr>
        </thead>
        <tbody>
          {p.deals
            .filter((d) => d.stageId === "entrada" && d.status === "open")
            .map((d) => (
              <tr key={d.id}>
                <td>
                  <button onClick={() => p.onOpenDeal(d.id)}>{d.title}</button>
                </td>
                <td>{d.person}</td>
                <td>{d.organization}</td>
                <td>{money(d.value)}</td>
                <td>{d.owner}</td>
                <td>Qualificar lead</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  </section>
);

const DealForm: React.FC<{
  stages: Stage[];
  owners: OwnerProfile[];
  owner: string;
  deals: Deal[];
  pipelineName: string;
  onClose: () => void;
  onSave: (d: Omit<Deal, "id" | "status" | "createdAt">) => void;
}> = (p) => {
  const [form, setForm] = useState({
    person: "",
    organization: "",
    title: "",
    value: "",
    stageId: p.stages[0]?.id || "",
    probability: "",
    expectedClose: "",
    label: "",
    owner: p.owner,
    source: "",
    sourceId: "",
    visibility: "Grupo de visibilidade do responsável",
  });
  const [attempt, setAttempt] = useState(false);
  const organizations = Array.from(
    new Set(p.deals.map((deal) => deal.organization).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));
  const organizationExists = organizations.some(
    (organization) =>
      organization.toLocaleLowerCase("pt-BR") ===
      form.organization.trim().toLocaleLowerCase("pt-BR"),
  );
  const invalid = attempt && !form.person.trim() && !form.organization.trim();
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setAttempt(true);
    if (
      !form.title.trim() ||
      (!form.person.trim() && !form.organization.trim())
    )
      return;
    p.onSave({
      title: form.title,
      person: form.person,
      organization: form.organization,
      value: Number(form.value.replace(/[^\d,]/g, "").replace(",", ".")) || 0,
      owner: form.owner,
      stageId: form.stageId,
      probability: Number(form.probability) || undefined,
      expectedClose: form.expectedClose || undefined,
      label: form.label || undefined,
      source: form.source || undefined,
      sourceId: form.sourceId || undefined,
      visibility: form.visibility,
    });
  };
  return (
    <div className="crmws-overlay" onMouseDown={p.onClose}>
      <form
        className="crmws-dealmodal"
        onSubmit={save}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header>
          <h2>Adicionar negócio</h2>
          <button type="button" onClick={p.onClose}>
            <X size={18} />
          </button>
        </header>
        <label className={invalid ? "error" : ""}>
          Pessoa de contato <CircleHelp size={13} />
          <span>
            <UserRound size={15} />
            <input
              autoFocus
              value={form.person}
              onChange={(e) => setForm({ ...form, person: e.target.value })}
              placeholder="Buscar ou criar pessoa"
            />
          </span>
          {invalid && <small>Uma pessoa ou organização é obrigatória</small>}
        </label>
        <label className={invalid ? "error" : ""}>
          Organização <CircleHelp size={13} />
          <span>
            <Building2 size={15} />
            <input
              list="crmws-organizations"
              value={form.organization}
              onChange={(e) =>
                setForm({ ...form, organization: e.target.value })
              }
              placeholder="Buscar ou criar organização"
            />
            {form.organization.trim() && !organizationExists && <em>NOVO</em>}
          </span>
          <datalist id="crmws-organizations">
            {organizations.map((organization) => (
              <option key={organization} value={organization} />
            ))}
          </datalist>
          {invalid && <small>Uma pessoa ou organização é obrigatória</small>}
        </label>
        <label>
          Título
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
        </label>
        <label>
          Valor{" "}
          <span className="crmws-value">
            <i>R$</i>
            <input
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              inputMode="decimal"
              placeholder="0,00"
            />
            <b>BRL</b>
          </span>
        </label>
        <button type="button" className="crmws-products">
          Adicionar produtos
        </button>
        <label>
          Funil
          <select>
            <option>{p.pipelineName}</option>
          </select>
        </label>
        <div className="crmws-formfield">
          Etapa do funil
          <div className="crmws-formstage">
            {p.stages.map((s) => (
              <button
                type="button"
                key={s.id}
                className={form.stageId === s.id ? "active" : ""}
                onClick={() => setForm({ ...form, stageId: s.id })}
                title={s.name}
              />
            ))}
          </div>
        </div>
        <label>
          Rótulo
          <select
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
          >
            <option value="">Adicionar rótulo</option>
            <option>Alta prioridade</option>
            <option>Retorno</option>
            <option>Indicação</option>
          </select>
        </label>
        <label>
          Probabilidade{" "}
          <span className="crmws-value">
            <input
              value={form.probability}
              onChange={(e) =>
                setForm({ ...form, probability: e.target.value })
              }
            />
            <b>%</b>
          </span>
        </label>
        <label>
          Data prevista de fechamento
          <input
            value={form.expectedClose}
            onChange={(e) =>
              setForm({ ...form, expectedClose: e.target.value })
            }
            placeholder="DD/MM/AAAA"
          />
        </label>
        <label>
          Responsável
          <select
            value={form.owner}
            onChange={(e) => setForm({ ...form, owner: e.target.value })}
          >
            {(p.owners.length
              ? p.owners
              : [
                  { id: "camila", email: "", name: "Camila Ribeiro" },
                  { id: "mariana", email: "", name: "Mariana Alves" },
                  { id: "rafael", email: "", name: "Rafael Mendes" },
                ]
            ).map((owner) => (
              <option key={owner.id} value={owner.name}>{owner.name}</option>
            ))}
          </select>
        </label>
        <label>
          Canal de origem
          <select
            value={form.source}
            onChange={(e) => setForm({ ...form, source: e.target.value })}
          >
            <option value="">Selecione o canal</option>
            <option>WhatsApp</option>
            <option>Instagram</option>
            <option>Indicação</option>
            <option>Site</option>
          </select>
        </label>
        <label>
          ID do canal de origem
          <input
            value={form.sourceId}
            onChange={(e) => setForm({ ...form, sourceId: e.target.value })}
          />
        </label>
        <label>
          Visível para
          <select
            value={form.visibility}
            onChange={(e) => setForm({ ...form, visibility: e.target.value })}
          >
            <option>Proprietário do item</option>
            <option>Grupo de visibilidade do responsável</option>
            <option>Grupo de visibilidade do responsável e subgrupos</option>
            <option>Todos os usuários</option>
          </select>
        </label>
        <footer>
          <button type="button" onClick={p.onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            disabled={
              attempt && (!form.title || (!form.person && !form.organization))
            }
          >
            Salvar
          </button>
        </footer>
      </form>
    </div>
  );
};

const DealActivityComposer: React.FC<{
  deal: Deal;
  owner: string;
  onCancel: () => void;
  onSave: (activity: Omit<DealActivity, "id" | "done">) => void;
}> = ({ deal, owner, onCancel, onSave }) => {
  const [subject, setSubject] = useState("Tarefa");
  const [type, setType] = useState("Tarefa");
  const [due, setDue] = useState(todayKey());
  const [startTime, setStartTime] = useState("");
  const [priority, setPriority] = useState<"Normal" | "Alta">("Normal");
  const [done, setDone] = useState(false);
  const types = [
    { label: "Chamada", icon: Phone },
    { label: "Tarefa", icon: CalendarClock },
    { label: "Prazo", icon: FlagIcon },
    { label: "WhatsApp", icon: MessageSquareText },
  ];
  const dateLabel = new Date(`${due}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  return (
    <section className="crmws-deal-activity-editor" aria-label="Adicionar atividade">
      <div className="crmws-deal-activity-fields">
        <input className="crmws-deal-activity-subject" value={subject} onChange={(event) => setSubject(event.target.value)} aria-label="Assunto da atividade" autoFocus />
        <div className="crmws-deal-activity-types" role="tablist" aria-label="Tipo de atividade">
          {types.map(({ label, icon: Icon }) => <button key={label} type="button" className={type === label ? "active" : ""} onClick={() => setType(label)}><Icon size={13} /> {label}</button>)}
        </div>
        <div className="crmws-deal-activity-row crmws-deal-activity-date-row">
          <CalendarDays size={17} />
          <input type="date" value={due} onChange={(event) => setDue(event.target.value)} aria-label="Data da atividade" />
          <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} aria-label="Hora inicial" />
          <span>–</span>
          <input type="time" value={startTime ? timePlusMinutes(startTime, 15) : ""} readOnly aria-label="Hora final" />
          <input type="date" value={due} onChange={(event) => setDue(event.target.value)} aria-label="Data final" />
        </div>
        <div className="crmws-deal-activity-row">
          <FlagIcon size={17} />
          <select className="crmws-deal-activity-priority" value={priority} onChange={(event) => setPriority(event.target.value as "Normal" | "Alta")} aria-label="Prioridade"><option value="Normal">Prioridade</option><option value="Alta">Prioridade alta</option></select>
        </div>
        <div className="crmws-deal-activity-row"><UserRound size={17} /><select aria-label="Responsável"><option>{owner} (Você)</option></select></div>
        <div className="crmws-deal-activity-records">
          <div><GitBranch size={15} /><span>{deal.title}</span><button type="button" aria-label="Remover negócio"><X size={15} /></button></div>
          <div><UserRound size={15} /><span>{deal.person}</span><button type="button" aria-label="Remover pessoa"><X size={15} /></button></div>
          <div><Building2 size={15} /><span>{deal.organization || "Organização"}</span></div>
        </div>
      </div>
      <aside className="crmws-deal-activity-agenda" aria-label="Agenda do dia">
        <header><b>{new Date(`${due}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</b><span><button type="button">‹</button><button type="button">›</button></span></header>
        <div className="crmws-deal-activity-timeline">
          {["12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00"].map((hour) => <span key={hour}>{hour}</span>)}
          <div className="crmws-deal-activity-current">{startTime || "21:30"} · {type}</div>
        </div>
      </aside>
      <footer>
        <button type="button" aria-label="Mais opções"><MoreHorizontal size={16} /></button>
        <label><input type="checkbox" checked={done} onChange={(event) => setDone(event.target.checked)} /> Marcar como feito</label>
        <span />
        <button type="button" onClick={onCancel}>Cancelar</button>
        <button type="button" onClick={() => onSave({ dealId: deal.id, subject: subject.trim() || type, type, due, time: startTime || undefined, owner, priority })}>Salvar</button>
      </footer>
    </section>
  );
};

const FlagIcon: React.FC<{ size?: number }> = ({ size = 16 }) => <FlagShape width={size} height={size} />;
const FlagShape: React.FC<{ width: number; height: number }> = ({ width, height }) => <svg width={width} height={height} viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 2v12M4 3h7l-1.4 2L11 7H4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;

const ActivityForm: React.FC<{
  deal?: Deal;
  deals: Deal[];
  owner: string;
  next?: boolean;
  won?: boolean;
  onClose: () => void;
  onSave: (a: Omit<DealActivity, "id" | "done">) => void;
}> = (p) => {
  const [subject, setSubject] = useState("");
  const [dealId, setDealId] = useState(
    p.deal?.id || p.deals.find((d) => d.status === "open")?.id || 0,
  );
  const [time, setTime] = useState("");
  const busy = Boolean(time);
  const today = todayKey();
  const todayDisplay = new Date(`${today}T12:00:00`).toLocaleDateString("pt-BR");
  const agendaDate = new Date(`${today}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return (
    <div className="crmws-overlay">
      <form
        className="crmws-activitymodal"
        onSubmit={(e) => {
          e.preventDefault();
          p.onSave({
            dealId,
            subject: subject || "Ligação",
            type: "Ligação",
            due: today,
            time: time || undefined,
            owner: p.owner,
            priority: "Normal",
          });
        }}
      >
        <header>
          <h2>
            {p.next ? "Agende sua próxima atividade" : "Agendar uma atividade"}
          </h2>
          <button type="button" onClick={p.onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="crmws-activitybody">
          <div className="crmws-activityform">
            {p.won && (
              <div className="crmws-won-context">
                <Trophy size={18} />
                <div>
                  <b>Acompanhamento após ganhar o negócio</b>
                  <p>
                    Agende um novo contato para manter o relacionamento com este
                    cliente.
                  </p>
                </div>
              </div>
            )}
            <input
              className="crmws-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ligação"
              autoFocus
            />
            <div className="crmws-types">
              {[Phone, Users, CalendarDays, Activity].map((Icon, i) => (
                <button
                  type="button"
                  className={i === 0 ? "active" : ""}
                  key={i}
                >
                  <Icon size={15} />
                </button>
              ))}
            </div>
            <div className="crmws-when">
              <label>
                Data
                <input value={todayDisplay} readOnly />
              </label>
              <label>
                Início
                <input
                  value={time}
                  onFocus={() => !time && setTime(nextQuarterHour())}
                  onChange={(e) => setTime(e.target.value)}
                  placeholder="HH:mm"
                />
              </label>
              <span>–</span>
              <label>
                Fim
                <input value={busy ? timePlusMinutes(time, 15) : ""} placeholder="HH:mm" readOnly />
              </label>
              <label>
                Data final
                <input value={todayDisplay} readOnly />
              </label>
            </div>
            <label>
              Prioridade
              <select>
                <option>Normal</option>
                <option>Alta</option>
              </select>
            </label>
            <button type="button" className="crmws-morefields">
              Adicionar local, videochamada e descrição
            </button>
            <label>
              Disponibilidade
              <select value={busy ? "Ocupado" : "Livre"} onChange={() => undefined}>
                <option>Livre</option>
                <option>Ocupado</option>
              </select>
            </label>
            <textarea placeholder="Observações" />
            <label>
              Responsável
              <select>
                <option>{p.owner}</option>
              </select>
            </label>
            <label>
              Negócio
              <select
                value={dealId}
                onChange={(e) => setDealId(Number(e.target.value))}
              >
                {p.deals
                  .filter((d) => d.status !== "deleted")
                  .map((d) => (
                    <option value={d.id} key={d.id}>
                      {d.title}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Organização
              <input
                value={p.deals.find((d) => d.id === dealId)?.organization || ""}
                readOnly
              />
            </label>
          </div>
          <aside>
            <header>
              <button type="button">‹</button>
              <b>{agendaDate}</b>
              <button type="button">›</button>
            </header>
            <div className="crmws-agenda">
              <span style={{ top: "36%" }} />
              <article style={{ top: "22%" }}>
                10:00 · Reunião de equipe
              </article>
              {time && (
                <article className="selected" style={{ top: "48%" }}>
                  {time} · {subject || "Ligação"}
                </article>
              )}
              <article style={{ top: "67%" }}>
                16:30 · Retorno comercial
              </article>
            </div>
          </aside>
        </div>
        <footer>
          <button type="button">
            <MoreHorizontal size={16} />
          </button>
          <label>
            <input type="checkbox" /> Marcar como concluída
          </label>
          <span />
          <button type="button" onClick={p.onClose}>
            Cancelar
          </button>
          <button type="submit">Salvar</button>
        </footer>
      </form>
    </div>
  );
};

const ActivityPopover: React.FC<{
  deal: Deal;
  activities: DealActivity[];
  position: { left: number; top: number };
  onClose: () => void;
  onComplete: (id: number) => void;
  onSchedule: () => void;
}> = (p) => (
  <div className="crmws-overlay transparent" onMouseDown={p.onClose}>
    <section className="crmws-popover" style={p.position} onMouseDown={(e) => e.stopPropagation()}>
      <header>
        <b>{p.deal.title}</b>
        <button onClick={p.onClose}>
          <X size={15} />
        </button>
      </header>
      {p.activities.map((a) => (
        <div
          className={`crmws-poprow ${activityState(a.dealId, [a])}`}
          key={a.id}
        >
          <button onClick={() => p.onComplete(a.id)}>
            <span />
          </button>
          <Phone size={15} />
          <div>
            <b>{a.subject}</b>
            <small>
              {a.due} {a.time || ""} · {a.owner}
            </small>
          </div>
        </div>
      ))}
      {!p.activities.length && (
        <p className="crmws-popempty">
          Você não tem atividades agendadas para este negócio.
        </p>
      )}
      <button className="crmws-popadd" onClick={p.onSchedule}>
        <Plus size={14} /> Agendar uma atividade
      </button>
    </section>
  </div>
);
const LostDialog: React.FC<{
  onClose: () => void;
  onConfirm: (r: string, c: string) => void;
}> = (p) => {
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [attempt, setAttempt] = useState(false);
  return (
    <div className="crmws-overlay">
      <section className="crmws-dialog">
        <header>
          <h2>Marcar como perdido</h2>
          <button onClick={p.onClose}>
            <X size={17} />
          </button>
        </header>
        <label>
          Motivo da perda
          <select
            className={attempt && !reason ? "error" : ""}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            <option value="">Selecione um motivo</option>
            <option>Preço</option>
            <option>Concorrência</option>
            <option>Sem retorno</option>
            <option>Adiou o tratamento</option>
            <option>Não tem interesse</option>
          </select>
        </label>
        <label>
          Comentários (opcional)
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </label>
        <a>Gerenciar motivos de perda nas configurações da empresa</a>
        <div className="crmws-tip">
          <CircleHelp size={17} /> Registrar o motivo ajuda a entender por que
          os negócios não avançam.
        </div>
        <footer>
          <button onClick={p.onClose}>Cancelar</button>
          <button
            className="danger"
            onClick={() => {
              setAttempt(true);
              if (reason) p.onConfirm(reason, comment);
            }}
          >
            Marcar como perdido
          </button>
        </footer>
      </section>
    </div>
  );
};
const WonDialog: React.FC<{
  deal: Deal;
  activitiesDone: number;
  onClose: () => void;
  onFollowUp: () => void;
}> = (p) => (
  <div className="crmws-overlay">
    <section className="crmws-wondialog">
      <header>
        <button onClick={p.onClose}>
          <X size={17} />
        </button>
        <Trophy size={40} />
        <h2>Negócio ganho</h2>
      </header>
      <div className="crmws-woncard">
        <b>{p.deal.title}</b>
        <span>{p.deal.organization}</span>
        <strong>{money(p.deal.value)}</strong>
      </div>
      <div className="crmws-wonstats">
        <span>
          <b>0 dias</b>Tempo para fechar
        </span>
        <span>
          <b>{p.activitiesDone}</b>Atividades concluídas
        </span>
      </div>
      <h3>Qual é o próximo passo?</h3>
      <button className="crmws-nextchoice" onClick={p.onFollowUp}>
        <CalendarDays size={20} />
        <span>
          <b>Agendar atividade de acompanhamento</b>
          <small>Planeje o próximo contato com o cliente</small>
        </span>
        <ChevronRight size={16} />
      </button>
      <button className="crmws-nextchoice">
        <Building2 size={20} />
        <span>
          <b>Criar um projeto</b>
          <small>Planeje a entrega do negócio</small>
        </span>
        <ChevronRight size={16} />
      </button>
      <footer>
        <label>
          <input type="checkbox" /> Não mostrar novamente
        </label>
        <button onClick={p.onClose}>Fechar</button>
      </footer>
    </section>
  </div>
);
const ConfirmDialog: React.FC<{
  title: string;
  text: string;
  danger: string;
  onClose: () => void;
  onConfirm: () => void;
}> = (p) => (
  <div className="crmws-overlay">
    <section className="crmws-dialog compact">
      <header>
        <h2>{p.title}</h2>
        <button onClick={p.onClose}>
          <X size={17} />
        </button>
      </header>
      <p>{p.text}</p>
      <footer>
        <button onClick={p.onClose}>Cancelar</button>
        <button className="danger" onClick={p.onConfirm}>
          {p.danger}
        </button>
      </footer>
    </section>
  </div>
);
