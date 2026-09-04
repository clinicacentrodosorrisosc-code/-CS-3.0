-- Espelho somente-leitura do CRM do Clinica Experts.
-- Execute esta migration no Supabase antes de ativar a integracao.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS clinic_experts_pipelines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, external_id)
);

CREATE TABLE IF NOT EXISTS clinic_experts_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pipeline_id UUID NOT NULL REFERENCES clinic_experts_pipelines(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  stage_type TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, external_id)
);

CREATE TABLE IF NOT EXISTS clinic_experts_opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  patient_external_id TEXT,
  pipeline_id UUID NOT NULL REFERENCES clinic_experts_pipelines(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES clinic_experts_stages(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  patient_name TEXT,
  patient_phone TEXT,
  patient_email TEXT,
  seller_name TEXT,
  priority INTEGER NOT NULL DEFAULT 1,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  origin TEXT,
  observations TEXT,
  status TEXT,
  source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, external_id)
);

CREATE TABLE IF NOT EXISTS clinic_experts_sync_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  pipelines_count INTEGER NOT NULL DEFAULT 0,
  stages_count INTEGER NOT NULL DEFAULT 0,
  opportunities_count INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_ce_stages_pipeline ON clinic_experts_stages(pipeline_id, position);
CREATE INDEX IF NOT EXISTS idx_ce_opportunities_stage ON clinic_experts_opportunities(stage_id);
CREATE INDEX IF NOT EXISTS idx_ce_opportunities_patient ON clinic_experts_opportunities(user_id, patient_external_id);
CREATE INDEX IF NOT EXISTS idx_ce_sync_runs_user_started ON clinic_experts_sync_runs(user_id, started_at DESC);

ALTER TABLE clinic_experts_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_experts_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_experts_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_experts_sync_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ce_pipelines_own ON clinic_experts_pipelines;
CREATE POLICY ce_pipelines_own ON clinic_experts_pipelines FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS ce_stages_own ON clinic_experts_stages;
CREATE POLICY ce_stages_own ON clinic_experts_stages FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS ce_opportunities_own ON clinic_experts_opportunities;
CREATE POLICY ce_opportunities_own ON clinic_experts_opportunities FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS ce_sync_runs_own ON clinic_experts_sync_runs;
CREATE POLICY ce_sync_runs_own ON clinic_experts_sync_runs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS ce_sync_runs_insert_own ON clinic_experts_sync_runs;
CREATE POLICY ce_sync_runs_insert_own ON clinic_experts_sync_runs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS ce_sync_runs_update_own ON clinic_experts_sync_runs;
CREATE POLICY ce_sync_runs_update_own ON clinic_experts_sync_runs FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

