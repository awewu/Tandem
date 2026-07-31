SET search_path TO rhautt_nexus, public;

CREATE TABLE IF NOT EXISTS rhautt_nexus.growth_geo_question (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  brand_slug varchar NOT NULL,
  category varchar NOT NULL,
  stage varchar NOT NULL CHECK (stage IN ('pre', 'mid', 'post', 'followup')),
  question text NOT NULL,
  priority int NOT NULL DEFAULT 100,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rhautt_nexus.growth_geo_probe_batch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  brand_slug varchar NOT NULL,
  category varchar NOT NULL,
  engine varchar NOT NULL DEFAULT 'hermes-center-ai',
  status varchar NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'blocked')),
  total_probes int NOT NULL DEFAULT 0,
  completed_probes int NOT NULL DEFAULT 0,
  cited_rate int NOT NULL DEFAULT 0,
  avg_aivs int NOT NULL DEFAULT 0,
  high_risk_count int NOT NULL DEFAULT 0,
  competitor_hit_count int NOT NULL DEFAULT 0,
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rhautt_nexus.growth_geo_probe
  ADD COLUMN IF NOT EXISTS brand_slug varchar,
  ADD COLUMN IF NOT EXISTS category varchar,
  ADD COLUMN IF NOT EXISTS stage varchar,
  ADD COLUMN IF NOT EXISTS batch_id uuid,
  ADD COLUMN IF NOT EXISTS question_id uuid,
  ADD COLUMN IF NOT EXISTS aivs int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS risk_level varchar NOT NULL DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS risk_reasons jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE rhautt_nexus.growth_geo_probe_job
  ADD COLUMN IF NOT EXISTS category varchar,
  ADD COLUMN IF NOT EXISTS stage varchar,
  ADD COLUMN IF NOT EXISTS batch_id uuid,
  ADD COLUMN IF NOT EXISTS question_id uuid,
  ADD COLUMN IF NOT EXISTS aivs int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS risk_level varchar NOT NULL DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS risk_reasons jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE rhautt_nexus.growth_copy_asset
  ADD COLUMN IF NOT EXISTS source varchar NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS probe_job_id uuid,
  ADD COLUMN IF NOT EXISTS category varchar,
  ADD COLUMN IF NOT EXISTS question text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'growth_geo_probe_batch_fk'
      AND conrelid = 'rhautt_nexus.growth_geo_probe'::regclass
  ) THEN
    ALTER TABLE rhautt_nexus.growth_geo_probe
      ADD CONSTRAINT growth_geo_probe_batch_fk
      FOREIGN KEY (batch_id) REFERENCES rhautt_nexus.growth_geo_probe_batch(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'growth_geo_probe_question_fk'
      AND conrelid = 'rhautt_nexus.growth_geo_probe'::regclass
  ) THEN
    ALTER TABLE rhautt_nexus.growth_geo_probe
      ADD CONSTRAINT growth_geo_probe_question_fk
      FOREIGN KEY (question_id) REFERENCES rhautt_nexus.growth_geo_question(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'growth_geo_probe_job_batch_fk'
      AND conrelid = 'rhautt_nexus.growth_geo_probe_job'::regclass
  ) THEN
    ALTER TABLE rhautt_nexus.growth_geo_probe_job
      ADD CONSTRAINT growth_geo_probe_job_batch_fk
      FOREIGN KEY (batch_id) REFERENCES rhautt_nexus.growth_geo_probe_batch(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'growth_geo_probe_job_question_fk'
      AND conrelid = 'rhautt_nexus.growth_geo_probe_job'::regclass
  ) THEN
    ALTER TABLE rhautt_nexus.growth_geo_probe_job
      ADD CONSTRAINT growth_geo_probe_job_question_fk
      FOREIGN KEY (question_id) REFERENCES rhautt_nexus.growth_geo_question(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS growth_geo_question_tenant_scope_idx
  ON rhautt_nexus.growth_geo_question (tenant_id, brand_slug, category, stage, enabled, priority);
CREATE INDEX IF NOT EXISTS growth_geo_probe_batch_tenant_scope_idx
  ON rhautt_nexus.growth_geo_probe_batch (tenant_id, brand_slug, category, created_at DESC);
CREATE INDEX IF NOT EXISTS growth_geo_probe_job_tenant_batch_idx
  ON rhautt_nexus.growth_geo_probe_job (tenant_id, batch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS growth_geo_probe_tenant_batch_idx
  ON rhautt_nexus.growth_geo_probe (tenant_id, batch_id, probed_at DESC);
CREATE INDEX IF NOT EXISTS growth_copy_asset_tenant_geo_source_idx
  ON rhautt_nexus.growth_copy_asset (tenant_id, source, probe_job_id, created_at DESC);

ALTER TABLE rhautt_nexus.growth_geo_question ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.growth_geo_probe_batch ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.growth_geo_question FORCE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.growth_geo_probe_batch FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS growth_geo_question_tenant_isolation ON rhautt_nexus.growth_geo_question;
CREATE POLICY growth_geo_question_tenant_isolation ON rhautt_nexus.growth_geo_question
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

DROP POLICY IF EXISTS growth_geo_probe_batch_tenant_isolation ON rhautt_nexus.growth_geo_probe_batch;
CREATE POLICY growth_geo_probe_batch_tenant_isolation ON rhautt_nexus.growth_geo_probe_batch
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());
