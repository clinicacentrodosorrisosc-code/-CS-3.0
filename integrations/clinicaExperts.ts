import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { processCrmAutomationQueue, queueCrmStageAutomations } from './crmAutomation.js';

const API_BASE_URL = 'https://api.clinicaexperts.com.br/api/v1';
const PAGE_SIZE = 100;
const REQUEST_GAP_MS = 550;
const MAX_REQUEST_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 10_000;
export const CLINICA_EXPERTS_PAYMENT_SYNC_START_AT = '2026-09-29T23:23:55-03:00';
export const CLINICA_EXPERTS_PAYMENT_SOURCE = 'CLINICA_EXPERTS_PAYMENT_SYNC_V2';

type ApiMeta = { page?: number; last_page?: number };
type ApiList<T> = { data: T[]; meta?: ApiMeta };

type ExternalStage = { uuid: string; name: string; type?: string; order?: number };
type ExternalPipeline = { uuid: string; name: string; stages?: ExternalStage[] };
type ExternalPatient = { uuid?: string; id?: string; name?: string; phone?: string; cellphone?: string; mobile?: string; whatsapp?: string; email?: string };
type ExternalLead = { uuid?: string; id?: string; name?: string; phone?: string; cellphone?: string; mobile?: string; whatsapp?: string; email?: string };
type ExternalOpportunity = {
  uuid: string;
  title?: string;
  priority?: number;
  amount?: number;
  origin?: string | null;
  observations?: string | null;
  status?: string;
  patient?: ExternalPatient | null;
  lead?: ExternalLead | null;
  contact?: ExternalLead | null;
  seller?: { uuid?: string; name?: string } | null;
  pipeline?: { uuid?: string; name?: string } | null;
  stage?: { uuid?: string; name?: string; status?: string } | null;
};

export type ExternalFinancialRecord = Record<string, unknown>;

export type ExternalCalendarEvent = {
  uuid: string;
  title?: string | null;
  type?: string | null;
  annotation?: string | null;
  starts_at: string;
  ends_at?: string | null;
  status?: string | null;
  patient?: { uuid?: string; name?: string | null } | null;
  professional?: { uuid?: string; name?: string | null } | null;
  rooms?: Array<{ id?: number | string; name?: string | null }>;
  procedures?: Array<{ id?: number | string; name?: string | null }>;
};

export type SyncResult = {
  pipelines: number;
  stages: number;
  opportunities: number;
  patients: number;
  payments?: number;
  finishedAt: string;
};

export type PaymentSyncResult = {
  read: number;
  realized: number;
  imported: number;
  deleted: number;
};

export type PhoneEnrichmentResult = {
  startPage: number;
  processedPages: number;
  lastPage: number;
  patientsRead: number;
  patientsWithPhone: number;
  matchedPatients: number;
  updatedOpportunities: number;
  finished: boolean;
};

export type DirectPhoneEnrichmentResult = {
  processedPatients: number;
  patientsWithPhone: number;
  updatedOpportunities: number;
  nextCursor: string | null;
  finished: boolean;
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class ClinicaExpertsClient {
  constructor(private readonly token: string) {}

  private async get<T>(path: string, query: Record<string, string | number> = {}, maxAttempts = MAX_REQUEST_ATTEMPTS): Promise<T> {
    const url = new URL(`${API_BASE_URL}${path}`);
    Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, String(value)));

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${this.token}`,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });

        if (response.ok) return response.json() as Promise<T>;

        const body = await response.text();
        const safeBody = body.slice(0, 300).replace(/[\r\n]+/g, ' ');
        const retryable = response.status === 429 || response.status >= 500;
        if (!retryable || attempt === maxAttempts) {
          throw new Error(`Clinica Experts ${path} respondeu HTTP ${response.status}: ${safeBody}`);
        }

        const retryAfterSeconds = Number(response.headers.get('retry-after'));
        const exponentialDelay = Math.min(8_000, 1_000 * (2 ** (attempt - 1)));
        const waitMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
          ? Math.min(8_000, retryAfterSeconds * 1_000)
          : exponentialDelay + Math.floor(Math.random() * 250);
        await delay(waitMs);
      } catch (error) {
        if (attempt === maxAttempts || (error instanceof Error && error.message.includes('respondeu HTTP'))) {
          throw error;
        }
        await delay(Math.min(8_000, 1_000 * (2 ** (attempt - 1))) + Math.floor(Math.random() * 250));
      }
    }

    throw new Error(`Clinica Experts ${path} nao respondeu apos varias tentativas.`);
  }

  private async listAll<T>(path: string, query: Record<string, string | number> = {}): Promise<T[]> {
    const rows: T[] = [];
    let page = 1;
    let lastPage = 1;

    do {
      const response = await this.get<ApiList<T>>(path, { ...query, per_page: PAGE_SIZE, page });
      rows.push(...(Array.isArray(response.data) ? response.data : []));
      lastPage = Math.max(1, Number(response.meta?.last_page || 1));
      page += 1;
      if (page <= lastPage) await delay(REQUEST_GAP_MS);
    } while (page <= lastPage);

    return rows;
  }

  listPipelines() {
    return this.listAll<ExternalPipeline>('/crm/pipelines', {
      sort_column: 'name',
      sort_direction: 'asc',
    });
  }

  listOpportunities(pipelineExternalId?: string) {
    return this.listAll<ExternalOpportunity>('/crm/opportunities', {
      sort_column: 'updated_at',
      sort_direction: 'desc',
      ...(pipelineExternalId ? { pipeline_uuid: pipelineExternalId } : {}),
    });
  }

  listPatients() {
    return this.listAll<ExternalPatient>('/patients', {
      sort_column: 'name',
      sort_direction: 'asc',
    });
  }

  searchPatients(query: string) {
    return this.get<ApiList<ExternalPatient>>('/patients', {
      search: query,
      per_page: 12,
      page: 1,
      sort_column: 'name',
      sort_direction: 'asc',
    }, 1);
  }

  listCalendarEvents(startsAt: string, endsAt: string) {
    return this.listAll<ExternalCalendarEvent>('/bookings', {
      starts_at: startsAt,
      ends_at: endsAt,
      sort_column: 'starts_at',
      sort_direction: 'asc',
    });
  }

  listFinancialAccounts() {
    return this.listAll<ExternalFinancialRecord>('/financial-accounts', {
      sort_column: 'name',
      sort_direction: 'asc',
    });
  }

  listFinancialCategories() {
    return this.listAll<ExternalFinancialRecord>('/financial-categories', {
      sort_column: 'name',
      sort_direction: 'asc',
    });
  }

  listBills(startsAt: string, endsAt: string) {
    return this.listAll<ExternalFinancialRecord>('/bills', {
      starts_at: startsAt,
      ends_at: endsAt,
      sort_column: 'created_at',
      sort_direction: 'desc',
    });
  }

  listParcels(startsAt: string, endsAt: string) {
    return this.listAll<ExternalFinancialRecord>('/parcels', {
      starts_at: startsAt,
      ends_at: endsAt,
      sort_column: 'due_date',
      sort_direction: 'asc',
    });
  }

  listSales(startsAt: string, endsAt: string) {
    return this.listAll<ExternalFinancialRecord>('/sales', {
      starts_at: startsAt,
      ends_at: endsAt,
      sort_column: 'sale_date',
      sort_direction: 'desc',
    });
  }

  listPatientsPage(page: number) {
    return this.get<ApiList<ExternalPatient>>('/patients', {
      sort_column: 'name',
      sort_direction: 'asc',
      per_page: PAGE_SIZE,
      page,
    });
  }

  async getPatient(patientId: string) {
    const response = await this.get<{ data?: ExternalPatient } | ExternalPatient>(`/patients/${encodeURIComponent(patientId)}`);
    return 'data' in response && response.data ? response.data : response as ExternalPatient;
  }

  async updateOpportunity(opportunity: ExternalOpportunity, observations: string) {
    if (!opportunity.patient?.uuid || !opportunity.seller?.uuid || !opportunity.pipeline?.uuid || !opportunity.stage?.uuid) throw new Error('O card nao possui todos os identificadores obrigatorios para atualizacao.');
    const response = await fetch(`${API_BASE_URL}/crm/opportunity/${encodeURIComponent(opportunity.uuid)}`, {
      method: 'PUT', headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_uuid: opportunity.patient.uuid, seller_uuid: opportunity.seller.uuid, pipeline_uuid: opportunity.pipeline.uuid, stage_uuid: opportunity.stage.uuid, title: opportunity.title || opportunity.patient.name || 'Oportunidade', priority: String(opportunity.priority || 1), amount: Number(opportunity.amount || 0), origin: opportunity.origin || null, observations }), signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Clinica Experts nao atualizou observacoes: HTTP ${response.status} ${ (await response.text()).slice(0, 300) }`);
  }
}

function normalizedPatientPhone(value?: string | null) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits.length >= 12 && digits.length <= 15 ? digits : null;
}

function opportunityContact(opportunity: ExternalOpportunity) {
  const sources = [opportunity.patient, opportunity.lead, opportunity.contact].filter(Boolean) as Array<ExternalPatient | ExternalLead>;
  const contact = sources.find(item => Boolean(item.phone || item.cellphone || item.mobile || item.whatsapp)) || sources.find(item => Boolean(item.name)) || null;
  const phone = normalizedPatientPhone(contact?.phone || contact?.cellphone || contact?.mobile || contact?.whatsapp || null);
  return {
    externalId: opportunity.patient?.uuid || opportunity.patient?.id || null,
    name: opportunity.patient?.name || contact?.name || null,
    phone,
    email: contact?.email || null,
  };
}

export async function enrichClinicaExpertsOpportunityPhones(
  db: SupabaseClient,
  userId: string,
  apiToken: string,
  startPage = 1,
  requestedPageCount = 70,
): Promise<PhoneEnrichmentResult> {
  const safeStartPage = Math.max(1, Math.floor(startPage) || 1);
  // 70 pages at the documented request gap remains below Vercel's 60-second limit.
  const pageCount = Math.min(70, Math.max(1, Math.floor(requestedPageCount) || 70));
  const client = new ClinicaExpertsClient(apiToken);
  const { data: opportunities, error: opportunitiesError } = await db
    .from('clinic_experts_opportunities')
    .select('id, patient_external_id')
    .eq('user_id', userId)
    .not('patient_external_id', 'is', null);
  throwIfError(opportunitiesError, 'Nao foi possivel consultar os cards para atualizar telefones');

  const patientIds = new Set((opportunities || [])
    .map(row => String(row.patient_external_id || '').trim())
    .filter(Boolean));
  const opportunityIdsByPatient = new Map<string, string[]>();
  for (const opportunity of opportunities || []) {
    const patientId = String(opportunity.patient_external_id || '').trim();
    if (!patientId) continue;
    const ids = opportunityIdsByPatient.get(patientId) || [];
    ids.push(String(opportunity.id));
    opportunityIdsByPatient.set(patientId, ids);
  }
  let patientsRead = 0;
  let patientsWithPhone = 0;
  let matchedPatients = 0;
  let updatedOpportunities = 0;
  let lastPage = safeStartPage;
  const phoneUpdates = new Map<string, string>();

  for (let offset = 0; offset < pageCount; offset += 1) {
    const page = safeStartPage + offset;
    const response = await client.listPatientsPage(page);
    const patients = Array.isArray(response.data) ? response.data : [];
    patientsRead += patients.length;
    lastPage = Math.max(page, Number(response.meta?.last_page || page));

    for (const patient of patients) {
      if (!patient.uuid) continue;
      if (!patientIds.has(patient.uuid)) continue;
      const phone = normalizedPatientPhone(patient.phone);
      if (!phone) continue;
      patientsWithPhone += 1;
      matchedPatients += 1;
      phoneUpdates.set(patient.uuid, phone);
    }

    const apiLastPage = Math.max(1, Number(response.meta?.last_page || page));
    if (page >= apiLastPage || patients.length === 0) {
      updatedOpportunities = await updatePatientPhones(db, userId, phoneUpdates, opportunityIdsByPatient);
      return {
        startPage: safeStartPage,
        processedPages: offset + 1,
        lastPage: apiLastPage,
        patientsRead,
        patientsWithPhone,
        matchedPatients,
        updatedOpportunities,
        finished: true,
      };
    }
    if (offset + 1 < pageCount) await delay(REQUEST_GAP_MS);
  }

  updatedOpportunities = await updatePatientPhones(db, userId, phoneUpdates, opportunityIdsByPatient);

  return {
    startPage: safeStartPage,
    processedPages: pageCount,
    lastPage,
    patientsRead,
    patientsWithPhone,
    matchedPatients,
    updatedOpportunities,
    finished: safeStartPage + pageCount - 1 >= lastPage,
  };
}

/**
 * Uses the patient UUID from each opportunity. The API's paginated patient list
 * can omit records that are nevertheless available through /patients/{uuid}.
 */
export async function enrichClinicaExpertsOpportunityPhonesDirect(
  db: SupabaseClient,
  userId: string,
  apiToken: string,
  afterId?: string,
  requestedLimit = 50,
): Promise<DirectPhoneEnrichmentResult> {
  const limit = Math.min(50, Math.max(1, Math.floor(requestedLimit) || 50));
  let query = db
    .from('clinic_experts_opportunities')
    .select('id,patient_external_id')
    .eq('user_id', userId)
    .is('patient_phone', null)
    .not('patient_external_id', 'is', null)
    .order('id', { ascending: true })
    .limit(limit);
  if (afterId) query = query.gt('id', afterId);
  const { data: opportunities, error } = await query;
  throwIfError(error, 'Nao foi possivel selecionar os cards sem telefone');
  const rows = opportunities || [];
  if (!rows.length) return { processedPatients: 0, patientsWithPhone: 0, updatedOpportunities: 0, nextCursor: null, finished: true };

  const client = new ClinicaExpertsClient(apiToken);
  let patientsWithPhone = 0;
  let updatedOpportunities = 0;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    try {
      const patient = await client.getPatient(String(row.patient_external_id));
      const phone = normalizedPatientPhone(patient.phone);
      if (phone) {
        const { data: updatedRows, error: updateError } = await db
          .from('clinic_experts_opportunities')
          .update({ patient_phone: phone, synced_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('patient_external_id', row.patient_external_id)
          .select('id');
        throwIfError(updateError, 'Nao foi possivel salvar o telefone do paciente');
        patientsWithPhone += 1;
        updatedOpportunities += updatedRows?.length || 0;
      }
    } catch (requestError) {
      // A missing or inaccessible patient must remain pending; never infer a phone.
      console.warn('[CLINICA EXPERTS] phone lookup skipped', row.patient_external_id, requestError instanceof Error ? requestError.message : requestError);
    }
    if (index + 1 < rows.length) await delay(REQUEST_GAP_MS);
  }
  const nextCursor = rows[rows.length - 1]?.id || null;
  return { processedPatients: rows.length, patientsWithPhone, updatedOpportunities, nextCursor, finished: rows.length < limit };
}

async function updatePatientPhones(
  db: SupabaseClient,
  userId: string,
  phoneUpdates: Map<string, string>,
  opportunityIdsByPatient: Map<string, string[]>,
) {
  const updates = Array.from(phoneUpdates.entries());
  let updatedOpportunities = 0;
  for (let index = 0; index < updates.length; index += 20) {
    const results = await Promise.all(updates.slice(index, index + 20).map(async ([patientId, phone]) => {
      const { data, error } = await db
        .from('clinic_experts_opportunities')
        .update({ patient_phone: phone, synced_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('patient_external_id', patientId)
        .select('id');
      throwIfError(error, 'Nao foi possivel atualizar os telefones dos cards');
      return data?.length || opportunityIdsByPatient.get(patientId)?.length || 0;
    }));
    updatedOpportunities += results.reduce((sum, count) => sum + count, 0);
  }
  return updatedOpportunities;
}

function throwIfError(error: { message: string } | null, context: string) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

function financialSyncDate(date: Date, endOfDay = false) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const part = (type: string) => parts.find(item => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}T${endOfDay ? '23:59:59' : '00:00:00'}-03:00`;
}

const financialText = (record: ExternalFinancialRecord | undefined, keys: string[]) => {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return '';
};

const financialName = (value: unknown) => {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object') return '';
  return financialText(value as ExternalFinancialRecord, ['name', 'description', 'title']);
};

const normalizedFinancialLabel = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/^\s*\*+\s*/, '')
  .replace(/[^a-zA-Z0-9]+/g, ' ')
  .trim()
  .toLocaleLowerCase('pt-BR');

const procedureCategory = (
  procedureNames: string[],
  categories: Array<{ name: string; subcategories: string[] }>,
) => {
  const matchedCategories = procedureNames.flatMap(procedureName => {
    const normalizedProcedure = normalizedFinancialLabel(procedureName);
    if (!normalizedProcedure) return [];
    const exact = categories.find(category => category.subcategories.some(
      subcategory => normalizedFinancialLabel(subcategory) === normalizedProcedure,
    ));
    if (exact) return [exact.name];

    const byPrefix = categories.filter(category => {
      const normalizedCategory = normalizedFinancialLabel(category.name);
      const categoryRoot = normalizedCategory.endsWith('s')
        ? normalizedCategory.slice(0, -1)
        : normalizedCategory;
      return categoryRoot.length >= 4 && normalizedProcedure.includes(categoryRoot);
    });
    return byPrefix.length === 1 ? [byPrefix[0].name] : [];
  });
  const uniqueCategories = [...new Set(matchedCategories)];
  return uniqueCategories.length === 1 ? uniqueCategories[0] : '';
};

const financialAmount = (record: ExternalFinancialRecord | undefined) => {
  for (const key of ['final_amount', 'amount', 'nominal_amount', 'net_amount']) {
    const value = Number(record?.[key]);
    if (Number.isFinite(value) && value > 0) return value / 100;
  }
  return 0;
};

export async function syncClinicaExpertsPayments(
  db: SupabaseClient,
  apiToken: string,
  startsAt?: string,
  endsAt?: string,
): Promise<PaymentSyncResult> {
  const now = new Date();
  const defaultStart = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);
  const defaultEnd = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000);
  const start = startsAt || financialSyncDate(defaultStart);
  const end = endsAt || financialSyncDate(defaultEnd, true);
  const client = new ClinicaExpertsClient(apiToken);
  const [bills, parcels, sales] = await Promise.all([
    client.listBills(start, end),
    client.listParcels(start, end),
    client.listSales(start, end),
  ]);

  const salesByBuyerAndCreation = new Map<string, ExternalFinancialRecord[]>();
  for (const sale of sales) {
    const buyer = sale.buyer && typeof sale.buyer === 'object'
      ? sale.buyer as ExternalFinancialRecord
      : undefined;
    const buyerId = financialText(buyer, ['uuid', 'id']);
    const createdAt = financialText(sale, ['created_at']);
    if (!buyerId || !createdAt) continue;
    const key = `${buyerId}|${createdAt}`;
    salesByBuyerAndCreation.set(key, [...(salesByBuyerAndCreation.get(key) || []), sale]);
  }

  const billByParcelId = new Map<string, { bill: ExternalFinancialRecord; parcel: ExternalFinancialRecord }>();
  for (const bill of bills) {
    const paymentMethods = Array.isArray(bill.payment_methods) ? bill.payment_methods : [];
    for (const method of paymentMethods) {
      if (!method || typeof method !== 'object') continue;
      const nestedParcels = Array.isArray((method as ExternalFinancialRecord).parcels)
        ? (method as ExternalFinancialRecord).parcels as unknown[] : [];
      for (const nested of nestedParcels) {
        if (!nested || typeof nested !== 'object') continue;
        const parcel = nested as ExternalFinancialRecord;
        const parcelId = financialText(parcel, ['uuid', 'id']);
        if (parcelId) billByParcelId.set(parcelId, { bill, parcel });
      }
    }
  }

  const realizedParcels = parcels.filter(parcel => {
    const status = financialText(parcel, ['status']).toLowerCase();
    const updatedAt = financialText(parcel, ['updated_at', 'execution_date']);
    return ['paid', 'received'].includes(status) && updatedAt >= CLINICA_EXPERTS_PAYMENT_SYNC_START_AT;
  });
  const [accountsResult, categoriesResult] = await Promise.all([
    db.from('accounts').select('id,name,bank'),
    db.from('income_categories').select('name,subcategories'),
  ]);
  const { data: accounts, error: accountsError } = accountsResult;
  throwIfError(accountsError, 'Erro ao consultar contas para importar pagamentos');
  const { data: incomeCategoryRows, error: categoriesError } = categoriesResult;
  throwIfError(categoriesError, 'Erro ao consultar categorias de receitas');
  const incomeCategoryMappings = (incomeCategoryRows || []).flatMap(category => {
    const name = String(category.name || '').trim();
    if (!name) return [];
    const subcategories = Array.isArray(category.subcategories)
      ? category.subcategories.flatMap(item => {
        if (typeof item === 'string') return item.trim() ? [item.trim()] : [];
        if (!item || typeof item !== 'object') return [];
        const subcategoryName = financialName(item);
        return subcategoryName ? [subcategoryName] : [];
      })
      : [];
    return [{ name, subcategories }];
  });
  const accountByName = new Map<string, string>();
  for (const account of accounts || []) {
    for (const value of [account.name, account.bank]) {
      const normalized = String(value || '').trim().toLocaleLowerCase('pt-BR');
      if (normalized && !accountByName.has(normalized)) accountByName.set(normalized, account.id);
    }
  }

  const rows = realizedParcels.flatMap(parcel => {
    const parcelId = financialText(parcel, ['uuid', 'id']);
    const linked = parcelId ? billByParcelId.get(parcelId) : undefined;
    if (!parcelId || !linked) return [];
    const paymentDate = financialText(parcel, ['execution_date', 'compensation_date', 'due_date']).slice(0, 10);
    const amount = financialAmount(linked.parcel);
    if (!paymentDate || amount <= 0) return [];
    const patient = financialName(linked.bill.person) || financialText(linked.bill, ['description']) || 'Paciente nao informado';
    const patientId = linked.bill.person && typeof linked.bill.person === 'object'
      ? financialText(linked.bill.person as ExternalFinancialRecord, ['uuid', 'id']) : '';
    const billCreatedAt = financialText(linked.bill, ['created_at']);
    const saleCandidates = patientId && billCreatedAt
      ? salesByBuyerAndCreation.get(`${patientId}|${billCreatedAt}`) || []
      : [];
    const billAmount = Number(linked.bill.final_amount ?? linked.bill.amount ?? 0);
    const sale = saleCandidates.find(candidate => {
      const saleAmount = Number(candidate.final_amount ?? candidate.nominal_amount ?? 0);
      return Number.isFinite(saleAmount) && saleAmount === billAmount;
    }) || saleCandidates[0];
    const saleItems = [
      ...(Array.isArray(sale?.procedures) ? sale.procedures : []),
      ...(Array.isArray(sale?.combos) ? sale.combos : []),
    ].flatMap(item => item && typeof item === 'object' ? [item as ExternalFinancialRecord] : []);
    const fallbackProcedure = financialText(linked.bill, ['description']);
    const procedureItems = saleItems.length ? saleItems : [{
      name: fallbackProcedure,
      final_amount: Number(linked.parcel.final_amount ?? linked.parcel.amount ?? 0),
    }];
    const paymentMethod = financialName(parcel.payment_method) || 'Nao informado';
    const externalAccountName = financialName(parcel.financial_account);
    const accountId = accountByName.get(externalAccountName.toLocaleLowerCase('pt-BR')) || null;
    const itemAmounts = procedureItems.map(item => Math.max(0, Number(
      item.final_amount ?? item.nominal_amount ?? item.amount ?? 0,
    ) || 0));
    const itemAmountTotal = itemAmounts.reduce((sum, itemAmount) => sum + itemAmount, 0);
    const paymentAmountInCents = Math.round(amount * 100);
    let allocatedInCents = 0;
    return procedureItems.flatMap((item, itemIndex) => {
      const procedure = financialName(item) || fallbackProcedure;
      if (!procedure) return [];
      const isLastItem = itemIndex === procedureItems.length - 1;
      const proportionalAmount = itemAmountTotal > 0
        ? Math.round(paymentAmountInCents * (itemAmounts[itemIndex] / itemAmountTotal))
        : Math.round(paymentAmountInCents / procedureItems.length);
      const itemPaymentInCents = isLastItem
        ? paymentAmountInCents - allocatedInCents
        : proportionalAmount;
      allocatedInCents += itemPaymentInCents;
      if (itemPaymentInCents <= 0) return [];
      const professional = financialName(item.professional)
        || financialName(item.executor)
        || financialName(item.responsible)
        || financialText(item, ['professional_name', 'executor_name']);
      const itemExternalId = `clinica_experts_parcel:${parcelId}:procedure:${itemIndex}`;
      return [{
        id: `ce_payment_${parcelId}_procedure_${itemIndex}`,
        external_id: itemExternalId,
        date: paymentDate,
        settlement_date: paymentDate,
        description: patient,
        category: procedureCategory([procedure], incomeCategoryMappings),
        procedure,
        type: 'income',
        amount: itemPaymentInCents / 100,
        status: 'Paid',
        payment_method: paymentMethod,
        professional: professional || null,
        account_id: accountId,
        installments: Number(parcel.payment_method_installments || linked.parcel.parcel_number || 1),
        observation: `Pagamento importado da Clinica Experts | Item ${itemIndex + 1}/${procedureItems.length}${patientId ? ` | Paciente: ${patientId}` : ''}`,
        source: CLINICA_EXPERTS_PAYMENT_SOURCE,
      }];
    });
  });

  for (let index = 0; index < rows.length; index += 500) {
    const { error } = await db.from('transactions').upsert(rows.slice(index, index + 500), { onConflict: 'external_id' });
    throwIfError(error, 'Erro ao importar pagamentos da Clinica Experts');
  }

  const authoritativeExternalIds = new Set(rows.map(row => row.external_id));
  const reconciliationStart = start.slice(0, 10);
  const reconciliationEnd = end.slice(0, 10);
  const { data: synchronizedTransactions, error: synchronizedTransactionsError } = await db
    .from('transactions')
    .select('id,external_id,date')
    .eq('source', CLINICA_EXPERTS_PAYMENT_SOURCE)
    .gte('date', reconciliationStart)
    .lte('date', reconciliationEnd);
  throwIfError(synchronizedTransactionsError, 'Erro ao consultar pagamentos para conciliacao');
  const transactionIdsToDelete = (synchronizedTransactions || [])
    .filter(transaction => !authoritativeExternalIds.has(String(transaction.external_id || '')))
    .map(transaction => transaction.id);
  let deleted = 0;
  for (let index = 0; index < transactionIdsToDelete.length; index += 500) {
    const { data: deletedRows, error: deleteError } = await db
      .from('transactions')
      .delete()
      .in('id', transactionIdsToDelete.slice(index, index + 500))
      .select('id');
    throwIfError(deleteError, 'Erro ao remover pagamentos excluidos da Clinica Experts');
    deleted += deletedRows?.length || 0;
  }
  return { read: parcels.length, realized: realizedParcels.length, imported: rows.length, deleted };
}

export async function syncClinicaExperts(
  db: SupabaseClient,
  userId: string,
  apiToken: string,
  pipelineExternalId?: string,
): Promise<SyncResult> {
  const client = new ClinicaExpertsClient(apiToken);
  const startedAt = new Date().toISOString();
  const { data: run, error: runError } = await db
    .from('clinic_experts_sync_runs')
    .insert({ user_id: userId, status: 'running', started_at: startedAt })
    .select('id')
    .single();
  throwIfError(runError, 'Nao foi possivel iniciar o registro da sincronizacao');
  if (!run) throw new Error('A sincronizacao nao recebeu um identificador de execucao.');

  try {
    const pipelines = await client.listPipelines();
    await delay(REQUEST_GAP_MS);
    const opportunities = await client.listOpportunities(pipelineExternalId);
    const now = new Date().toISOString();

    const pipelineRows = pipelines.map(pipeline => ({
      user_id: userId,
      external_id: pipeline.uuid,
      name: pipeline.name,
      synced_at: now,
    }));
    if (pipelineRows.length) {
      const { error } = await db.from('clinic_experts_pipelines').upsert(pipelineRows, {
        onConflict: 'user_id,external_id',
      });
      throwIfError(error, 'Erro ao salvar funis');
    }

    const { data: localPipelines, error: pipelineReadError } = await db
      .from('clinic_experts_pipelines')
      .select('id, external_id')
      .eq('user_id', userId);
    throwIfError(pipelineReadError, 'Erro ao reler funis');
    const pipelineIds = new Map((localPipelines || []).map(row => [row.external_id, row.id]));

    const synchronizedPipelines = pipelineExternalId
      ? pipelines.filter(pipeline => pipeline.uuid === pipelineExternalId)
      : pipelines;
    if (pipelineExternalId && synchronizedPipelines.length === 0) {
      throw new Error('O funil selecionado nao foi encontrado na Clinica Experts. Atualize a tela e tente novamente.');
    }

    const stageRows = synchronizedPipelines.flatMap(pipeline => {
      const pipelineId = pipelineIds.get(pipeline.uuid);
      if (!pipelineId) return [];
      return (pipeline.stages || []).map(stage => ({
        user_id: userId,
        pipeline_id: pipelineId,
        external_id: stage.uuid,
        name: stage.name,
        stage_type: stage.type || null,
        position: Number(stage.order || 0),
        synced_at: now,
      }));
    });
    if (stageRows.length) {
      const { error } = await db.from('clinic_experts_stages').upsert(stageRows, {
        onConflict: 'user_id,external_id',
      });
      throwIfError(error, 'Erro ao salvar etapas');
    }

    const { data: localStages, error: stageReadError } = await db
      .from('clinic_experts_stages')
      .select('id, external_id')
      .eq('user_id', userId);
    throwIfError(stageReadError, 'Erro ao reler etapas');
    const stageIds = new Map((localStages || []).map(row => [row.external_id, row.id]));
    const [{ data: previousOpportunities, error: previousOpportunitiesError }, { data: importedRows, error: importedRowsError }] = await Promise.all([
      db.from('clinic_experts_opportunities').select('id,external_id,patient_external_id,stage_id,patient_phone,patient_email,observations,local_overrides').eq('user_id', userId),
      db.from('clinic_experts_imported_data').select('opportunity_external_id,patient_external_id,data').eq('user_id', userId),
    ]);
    throwIfError(previousOpportunitiesError, 'Erro ao consultar etapas anteriores das oportunidades');
    throwIfError(importedRowsError, 'Erro ao consultar dados importados localmente');
    const previousByExternalId = new Map((previousOpportunities || []).map(row => [row.external_id, row]));
    const importedByExternalId = new Map((importedRows || []).map(row => [row.opportunity_external_id, row.data]));
    const importedByPatientExternalId = new Map((importedRows || []).filter(row => row.patient_external_id).map(row => [String(row.patient_external_id), row.data]));
    const contactByPatientExternalId = new Map<string, { patient_phone: string | null; patient_email: string | null }>();
    const localPhone = (row?: { patient_phone?: string | null; local_overrides?: unknown }) => {
      const overrides = row?.local_overrides && typeof row.local_overrides === 'object' ? row.local_overrides as Record<string, unknown> : {};
      return typeof overrides.patient_phone === 'string' && overrides.patient_phone.trim() ? overrides.patient_phone : row?.patient_phone || null;
    };
    const localObservations = (row?: { observations?: string | null; local_overrides?: unknown }) => {
      const overrides = row?.local_overrides && typeof row.local_overrides === 'object' ? row.local_overrides as Record<string, unknown> : {};
      return typeof overrides.observations === 'string' && overrides.observations.trim() ? overrides.observations : row?.observations || null;
    };
    const importedPhone = (data?: unknown) => data && typeof data === 'object' && typeof (data as Record<string, unknown>).patient_phone === 'string'
      ? String((data as Record<string, unknown>).patient_phone).trim() || null : null;
    for (const row of previousOpportunities || []) {
      const patientId = String(row.patient_external_id || '').trim();
      const phone = localPhone(row);
      if (!patientId || (!phone && !row.patient_email)) continue;
      const known = contactByPatientExternalId.get(patientId);
      contactByPatientExternalId.set(patientId, {
        patient_phone: known?.patient_phone || phone,
        patient_email: known?.patient_email || row.patient_email || null,
      });
    }

    const opportunityRows = opportunities.flatMap(opportunity => {
      const externalPipelineId = opportunity.pipeline?.uuid;
      const externalStageId = opportunity.stage?.uuid;
      const pipelineId = externalPipelineId ? pipelineIds.get(externalPipelineId) : undefined;
      const stageId = externalStageId ? stageIds.get(externalStageId) : undefined;
      if (!pipelineId || !stageId) return [];
      const contact = opportunityContact(opportunity);
      const patientId = contact.externalId || undefined;
      const previous = previousByExternalId.get(opportunity.uuid);
      const knownContact = patientId ? contactByPatientExternalId.get(patientId) : undefined;
      const protectedPhone = importedPhone(importedByExternalId.get(opportunity.uuid)) || (patientId ? importedPhone(importedByPatientExternalId.get(patientId)) : null);

      return [{
        user_id: userId,
        external_id: opportunity.uuid,
        patient_external_id: patientId || null,
        pipeline_id: pipelineId,
        stage_id: stageId,
        title: opportunity.title || contact.name || 'Oportunidade',
        patient_name: contact.name || null,
        patient_phone: protectedPhone || localPhone(previous) || knownContact?.patient_phone || contact.phone || null,
        patient_email: previous?.patient_email || knownContact?.patient_email || contact.email || null,
        seller_name: opportunity.seller?.name || null,
        priority: Number(opportunity.priority || 1),
        amount_cents: Number(opportunity.amount || 0),
        origin: opportunity.origin || null,
        observations: localObservations(previous) || opportunity.observations || null,
        status: opportunity.status || opportunity.stage?.status || null,
        source_payload: opportunity,
        synced_at: now,
      }];
    });

    for (let index = 0; index < opportunityRows.length; index += 500) {
      const { error } = await db
        .from('clinic_experts_opportunities')
        .upsert(opportunityRows.slice(index, index + 500), { onConflict: 'user_id,external_id' });
      throwIfError(error, 'Erro ao salvar oportunidades');
    }

    const { data: pendingObservationSync, error: pendingObservationSyncError } = await db.from('clinic_experts_observation_sync_queue').select('id,opportunity_id').eq('user_id', userId).eq('status', 'pending').limit(0);
    throwIfError(pendingObservationSyncError, 'Erro ao consultar fila de observacoes');
    const previousById = new Map((previousOpportunities || []).map(row => [row.id, row]));
    const externalById = new Map(opportunities.map(opportunity => [opportunity.uuid, opportunity]));
    for (const queued of pendingObservationSync || []) {
      const local = previousById.get(queued.opportunity_id); const external = local ? externalById.get(local.external_id) : undefined;
      try {
        if (!local || !external) throw new Error('Card nao retornou na sincronizacao atual.');
        await client.updateOpportunity(external, localObservations(local) || external.observations || '');
        await db.from('clinic_experts_observation_sync_queue').update({ status: 'synced', attempts: 1, error_message: null, synced_at: now, updated_at: now }).eq('id', queued.id);
      } catch (error) {
        await db.from('clinic_experts_observation_sync_queue').update({ status: 'failed', attempts: 1, error_message: String(error instanceof Error ? error.message : error).slice(0, 1000), updated_at: now }).eq('id', queued.id);
      }
    }

    for (const opportunity of opportunityRows) {
      const previous = previousByExternalId.get(opportunity.external_id);
      if (!previous || previous.stage_id === opportunity.stage_id) continue;
      await queueCrmStageAutomations(db, userId, { ...opportunity, id: previous.id }, { allowReentry: true }).catch(error => {
        console.error('[crm-automation] reconciliation trigger failed', error instanceof Error ? error.message : error);
      });
    }

    let staleOpportunitiesQuery = db
      .from('clinic_experts_opportunities')
      .delete()
      .eq('user_id', userId)
      .lt('synced_at', now);
    if (pipelineExternalId) {
      const selectedPipelineId = pipelineIds.get(pipelineExternalId);
      if (selectedPipelineId) staleOpportunitiesQuery = staleOpportunitiesQuery.eq('pipeline_id', selectedPipelineId);
    }
    const { error: staleOpportunitiesError } = await staleOpportunitiesQuery;
    throwIfError(staleOpportunitiesError, 'Erro ao remover oportunidades antigas');

    if (!pipelineExternalId) {
      const { error: staleStagesError } = await db
        .from('clinic_experts_stages')
        .delete()
        .eq('user_id', userId)
        .lt('synced_at', now);
      throwIfError(staleStagesError, 'Erro ao remover etapas antigas');

      const { error: stalePipelinesError } = await db
        .from('clinic_experts_pipelines')
        .delete()
        .eq('user_id', userId)
        .lt('synced_at', now);
      throwIfError(stalePipelinesError, 'Erro ao remover funis antigos');
    }

    let payments = 0;
    try {
      payments = (await syncClinicaExpertsPayments(db, apiToken)).imported;
    } catch (paymentError) {
      console.error('[CLINICA EXPERTS] Payment sync failed:', paymentError instanceof Error ? paymentError.message : paymentError);
    }

    const result: SyncResult = {
      pipelines: pipelineRows.length,
      stages: stageRows.length,
      opportunities: opportunityRows.length,
      patients: new Set(opportunityRows.map(opportunity => opportunity.patient_external_id).filter(Boolean)).size,
      payments,
      finishedAt: now,
    };

    const { error: finishError } = await db
      .from('clinic_experts_sync_runs')
      .update({
        status: 'success',
        pipelines_count: result.pipelines,
        stages_count: result.stages,
        opportunities_count: result.opportunities,
        finished_at: now,
      })
      .eq('id', run.id);
    throwIfError(finishError, 'Erro ao finalizar registro da sincronizacao');
    return result;
  } catch (error) {
    await db
      .from('clinic_experts_sync_runs')
      .update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message.slice(0, 1000) : 'Erro desconhecido',
      })
      .eq('id', run.id);
    throw error;
  }
}

export async function processClinicaExpertsOpportunityWebhook(
  db: SupabaseClient,
  userId: string,
  payload: Record<string, any>,
  apiToken?: string,
) {
  const resource = payload.resource || payload.data || payload;
  const pipeline = resource.pipeline;
  const stage = resource.stage;
  const opportunityId = resource.uuid || resource.id;
  if (!opportunityId || !pipeline?.uuid || !stage?.uuid) {
    throw new Error('Webhook de oportunidade sem pipeline, etapa ou identificador externo.');
  }

  const now = new Date().toISOString();
  const { data: pipelineRow, error: pipelineError } = await db
    .from('clinic_experts_pipelines')
    .upsert({ user_id: userId, external_id: pipeline.uuid, name: pipeline.name || 'Funil', synced_at: now }, { onConflict: 'user_id,external_id' })
    .select('id')
    .single();
  throwIfError(pipelineError, 'Erro ao salvar funil recebido pelo webhook');
  if (!pipelineRow) throw new Error('Webhook nao retornou o funil local.');

  const { data: stageRow, error: stageError } = await db
    .from('clinic_experts_stages')
    .upsert({ user_id: userId, pipeline_id: pipelineRow.id, external_id: stage.uuid, name: stage.name || 'Etapa', stage_type: stage.status || null, position: 0, synced_at: now }, { onConflict: 'user_id,external_id' })
    .select('id')
    .single();
  throwIfError(stageError, 'Erro ao salvar etapa recebida pelo webhook');
  if (!stageRow) throw new Error('Webhook nao retornou a etapa local.');

  const isDeleted = String(payload.type || payload.event || '').endsWith('.deleted');
  if (isDeleted) {
    const { error } = await db.from('clinic_experts_opportunities').delete().eq('user_id', userId).eq('external_id', opportunityId);
    throwIfError(error, 'Erro ao remover oportunidade recebida pelo webhook');
    return;
  }

  const { data: existingOpportunity, error: existingError } = await db
    .from('clinic_experts_opportunities')
    .select('id, stage_id, patient_phone, patient_email, local_overrides')
    .eq('user_id', userId)
    .eq('external_id', opportunityId)
    .maybeSingle();
  throwIfError(existingError, 'Erro ao consultar oportunidade existente');

  const contact = opportunityContact(resource as ExternalOpportunity);
  const patientExternalId = contact.externalId || null;
  const { data: importedForCard, error: importedForCardError } = await db
    .from('clinic_experts_imported_data')
    .select('data')
    .eq('user_id', userId)
    .eq('opportunity_external_id', opportunityId)
    .maybeSingle();
  throwIfError(importedForCardError, 'Erro ao consultar dado importado do card');
  let importedData = importedForCard?.data;
  if (!importedData && patientExternalId) {
    const { data: importedForPatient, error: importedForPatientError } = await db
      .from('clinic_experts_imported_data')
      .select('data')
      .eq('user_id', userId)
      .eq('patient_external_id', patientExternalId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    throwIfError(importedForPatientError, 'Erro ao consultar dado importado do paciente');
    importedData = importedForPatient?.data;
  }
  const importedPhone = importedData && typeof importedData === 'object' && typeof (importedData as Record<string, unknown>).patient_phone === 'string'
    ? String((importedData as Record<string, unknown>).patient_phone).trim() : '';
  const overridePhone = existingOpportunity?.local_overrides && typeof existingOpportunity.local_overrides === 'object'
    && typeof (existingOpportunity.local_overrides as Record<string, unknown>).patient_phone === 'string'
    ? String((existingOpportunity.local_overrides as Record<string, unknown>).patient_phone).trim()
    : '';
  let patientPhone = importedPhone
    || overridePhone
    || existingOpportunity?.patient_phone
    || contact.phone
    || null;
  let patientEmail = existingOpportunity?.patient_email || contact.email || null;

  if (!patientPhone && patientExternalId) {
    const { data: knownPatientOpportunity, error: knownPatientError } = await db
      .from('clinic_experts_opportunities')
      .select('patient_phone,patient_email')
      .eq('user_id', userId)
      .eq('patient_external_id', patientExternalId)
      .not('patient_phone', 'is', null)
      .limit(1)
      .maybeSingle();
    throwIfError(knownPatientError, 'Erro ao consultar telefone conhecido do paciente');
    patientPhone = knownPatientOpportunity?.patient_phone || null;
    patientEmail = patientEmail || knownPatientOpportunity?.patient_email || null;
  }

  if (!patientPhone && patientExternalId && apiToken) {
    const patient = await new ClinicaExpertsClient(apiToken).getPatient(patientExternalId);
    patientPhone = patient.phone || null;
    patientEmail = patientEmail || patient.email || null;
  }

  const { data: savedOpportunity, error: opportunityError } = await db.from('clinic_experts_opportunities').upsert({
    user_id: userId,
    external_id: opportunityId,
    patient_external_id: patientExternalId,
    pipeline_id: pipelineRow.id,
    stage_id: stageRow.id,
    title: resource.title || contact.name || 'Oportunidade',
    patient_name: contact.name || null,
    patient_phone: patientPhone,
    patient_email: patientEmail,
    seller_name: resource.seller?.name || null,
    priority: Number(resource.priority || 1),
    amount_cents: Number(resource.amount || 0),
    origin: resource.origin || null,
    observations: resource.observations || null,
    status: stage.status || resource.status || null,
    source_payload: payload,
    synced_at: now,
  }, { onConflict: 'user_id,external_id' }).select('id,pipeline_id,stage_id,patient_name,patient_phone,seller_name,title,amount_cents').single();
  throwIfError(opportunityError, 'Erro ao salvar oportunidade recebida pelo webhook');
  const eventName = String(payload.type || payload.event || payload.name || '');
  const stageChanged = Boolean(existingOpportunity && existingOpportunity.stage_id !== savedOpportunity?.stage_id);
  const enteredStage = !existingOpportunity
    || stageChanged
    || eventName.endsWith('.created');
  if (savedOpportunity && enteredStage) {
    await queueCrmStageAutomations(db, userId, savedOpportunity, { allowReentry: stageChanged }).catch(error => {
      console.error('[crm-automation] webhook trigger failed', error instanceof Error ? error.message : error);
    });
    await processCrmAutomationQueue(db, userId, 1).catch(error => {
      console.error('[crm-automation] webhook queue processing failed', error instanceof Error ? error.message : error);
    });
  }
}

export function createUserScopedSupabase(
  supabaseUrl: string,
  anonKey: string,
  accessToken: string,
) {
  return createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
