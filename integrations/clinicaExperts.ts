import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { processCrmStageAutomations } from './crmAutomation.js';

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

export type SyncResult = {
  pipelines: number;
  stages: number;
  opportunities: number;
  patients: number;
  finishedAt: string;
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class ClinicaExpertsClient {
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

  listOpportunities() {
    return this.listAll<ExternalOpportunity>('/crm/opportunities', {
      sort_column: 'updated_at',
      sort_direction: 'desc',
    });
  }

  listPatients() {
    return this.listAll<ExternalPatient>('/patients', {
      sort_column: 'name',
      sort_direction: 'asc',
    });
  }

  async getPatient(patientId: string) {
    const response = await this.get<{ data?: ExternalPatient } | ExternalPatient>(`/patients/${encodeURIComponent(patientId)}`);
    return 'data' in response && response.data ? response.data : response as ExternalPatient;
  }
}

function throwIfError(error: { message: string } | null, context: string) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

export async function syncClinicaExperts(
  db: SupabaseClient,
  userId: string,
  apiToken: string,
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
    const opportunities = await client.listOpportunities();
    await delay(REQUEST_GAP_MS);
    const patients = await client.listPatients();
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

    const stageRows = pipelines.flatMap(pipeline => {
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
    const patientById = new Map(patients.map(patient => [patient.uuid, patient]));
    const { data: previousOpportunities, error: previousOpportunitiesError } = await db
      .from('clinic_experts_opportunities')
      .select('id,external_id,stage_id')
      .eq('user_id', userId);
    throwIfError(previousOpportunitiesError, 'Erro ao consultar etapas anteriores das oportunidades');
    const previousByExternalId = new Map((previousOpportunities || []).map(row => [row.external_id, row]));

    const opportunityRows = opportunities.flatMap(opportunity => {
      const externalPipelineId = opportunity.pipeline?.uuid;
      const externalStageId = opportunity.stage?.uuid;
      const pipelineId = externalPipelineId ? pipelineIds.get(externalPipelineId) : undefined;
      const stageId = externalStageId ? stageIds.get(externalStageId) : undefined;
      if (!pipelineId || !stageId) return [];
      const patientId = opportunity.patient?.uuid || undefined;
      const patient = patientId ? patientById.get(patientId) : undefined;

      return [{
        user_id: userId,
        external_id: opportunity.uuid,
        patient_external_id: patientId || null,
        pipeline_id: pipelineId,
        stage_id: stageId,
        title: opportunity.title || opportunity.patient?.name || 'Oportunidade',
        patient_name: patient?.name || opportunity.patient?.name || null,
        patient_phone: patient?.phone || null,
        patient_email: patient?.email || null,
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
      await processCrmStageAutomations(db, userId, { ...opportunity, id: previous.id }).catch(error => {
        console.error('[crm-automation] reconciliation trigger failed', error instanceof Error ? error.message : error);
      });
    }

    const { error: staleOpportunitiesError } = await db
      .from('clinic_experts_opportunities')
      .delete()
      .eq('user_id', userId)
      .lt('synced_at', now);
    throwIfError(staleOpportunitiesError, 'Erro ao remover oportunidades antigas');

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

    const result: SyncResult = {
      pipelines: pipelineRows.length,
      stages: stageRows.length,
      opportunities: opportunityRows.length,
      patients: patients.length,
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
  const enteredStage = !existingOpportunity
    || existingOpportunity.stage_id !== savedOpportunity?.stage_id
    || eventName.endsWith('.created');
  if (savedOpportunity && enteredStage) {
    await processCrmStageAutomations(db, userId, savedOpportunity).catch(error => {
      console.error('[crm-automation] webhook trigger failed', error instanceof Error ? error.message : error);
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
