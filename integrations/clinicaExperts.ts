import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { processCrmAutomationQueue, queueCrmStageAutomations } from './crmAutomation.js';

const API_BASE_URL = 'https://api.clinicaexperts.com.br/api/v1';
const PAGE_SIZE = 100;
const REQUEST_GAP_MS = 550;
const MAX_REQUEST_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 10_000;

type ApiMeta = { page?: number; last_page?: number };
type ApiList<T> = { data: T[]; meta?: ApiMeta };

type ExternalStage = { uuid: string; name: string; type?: string; order?: number };
type ExternalPipeline = { uuid: string; name: string; stages?: ExternalStage[] };
type ExternalPatient = { uuid: string; name?: string; phone?: string; email?: string };
type ExternalOpportunity = {
  uuid: string;
  title?: string;
  priority?: number;
  amount?: number;
  origin?: string | null;
  observations?: string | null;
  status?: string;
  patient?: { uuid?: string; name?: string } | null;
  seller?: { uuid?: string; name?: string } | null;
  pipeline?: { uuid?: string; name?: string } | null;
  stage?: { uuid?: string; name?: string; status?: string } | null;
};

export type ExternalCalendarEvent = {
  id: number | string;
  title?: string | null;
  type?: string | null;
  annotation?: string | null;
  starts_at: string;
  ends_at?: string | null;
  status?: string | null;
  patient?: { uuid?: string; name?: string | null } | null;
  professional?: { uuid?: string; name?: string | null } | null;
  room?: { uuid?: string; name?: string | null } | null;
  procedures?: Array<{ id?: number | string; name?: string | null }>;
};

export type SyncResult = {
  pipelines: number;
  stages: number;
  opportunities: number;
  patients: number;
  finishedAt: string;
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

  private async get<T>(path: string, query: Record<string, string | number> = {}): Promise<T> {
    const url = new URL(`${API_BASE_URL}${path}`);
    Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, String(value)));

    for (let attempt = 1; attempt <= MAX_REQUEST_ATTEMPTS; attempt += 1) {
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
        if (!retryable || attempt === MAX_REQUEST_ATTEMPTS) {
          throw new Error(`Clinica Experts ${path} respondeu HTTP ${response.status}: ${safeBody}`);
        }

        const retryAfterSeconds = Number(response.headers.get('retry-after'));
        const exponentialDelay = Math.min(8_000, 1_000 * (2 ** (attempt - 1)));
        const waitMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
          ? Math.min(8_000, retryAfterSeconds * 1_000)
          : exponentialDelay + Math.floor(Math.random() * 250);
        await delay(waitMs);
      } catch (error) {
        if (attempt === MAX_REQUEST_ATTEMPTS || (error instanceof Error && error.message.includes('respondeu HTTP'))) {
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

  listCalendarEvents(startsAt: string, endsAt: string) {
    return this.listAll<ExternalCalendarEvent>('/calendar-events', {
      starts_at: startsAt,
      ends_at: endsAt,
      sort_column: 'starts_at',
      sort_direction: 'asc',
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
}

function normalizedPatientPhone(value?: string | null) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits.length >= 12 && digits.length <= 15 ? digits : null;
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
    const { data: previousOpportunities, error: previousOpportunitiesError } = await db
      .from('clinic_experts_opportunities')
      .select('id,external_id,stage_id,patient_phone,patient_email')
      .eq('user_id', userId)
      .in('pipeline_id', Array.from(new Set(stageRows.map(stage => stage.pipeline_id))));
    throwIfError(previousOpportunitiesError, 'Erro ao consultar etapas anteriores das oportunidades');
    const previousByExternalId = new Map((previousOpportunities || []).map(row => [row.external_id, row]));

    const opportunityRows = opportunities.flatMap(opportunity => {
      const externalPipelineId = opportunity.pipeline?.uuid;
      const externalStageId = opportunity.stage?.uuid;
      const pipelineId = externalPipelineId ? pipelineIds.get(externalPipelineId) : undefined;
      const stageId = externalStageId ? stageIds.get(externalStageId) : undefined;
      if (!pipelineId || !stageId) return [];
      const patientId = opportunity.patient?.uuid || undefined;
      const previous = previousByExternalId.get(opportunity.uuid);

      return [{
        user_id: userId,
        external_id: opportunity.uuid,
        patient_external_id: patientId || null,
        pipeline_id: pipelineId,
        stage_id: stageId,
        title: opportunity.title || opportunity.patient?.name || 'Oportunidade',
        patient_name: opportunity.patient?.name || null,
        patient_phone: previous?.patient_phone || null,
        patient_email: previous?.patient_email || null,
        seller_name: opportunity.seller?.name || null,
        priority: Number(opportunity.priority || 1),
        amount_cents: Number(opportunity.amount || 0),
        origin: opportunity.origin || null,
        observations: opportunity.observations || null,
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

    const result: SyncResult = {
      pipelines: pipelineRows.length,
      stages: stageRows.length,
      opportunities: opportunityRows.length,
      patients: new Set(opportunityRows.map(opportunity => opportunity.patient_external_id).filter(Boolean)).size,
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
    .select('id, stage_id, patient_phone, patient_email')
    .eq('user_id', userId)
    .eq('external_id', opportunityId)
    .maybeSingle();
  throwIfError(existingError, 'Erro ao consultar oportunidade existente');

  const patientExternalId = resource.patient?.uuid || resource.patient?.id || null;
  let patientPhone = existingOpportunity?.patient_phone
    || resource.patient?.phone
    || resource.patient?.cellphone
    || resource.patient?.mobile
    || null;
  let patientEmail = existingOpportunity?.patient_email || resource.patient?.email || null;

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
    title: resource.title || resource.patient?.name || 'Oportunidade',
    patient_name: resource.patient?.name || null,
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
