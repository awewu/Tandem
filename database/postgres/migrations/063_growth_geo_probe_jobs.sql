SET search_path TO rhautt_nexus, public;

CREATE TABLE IF NOT EXISTS rhautt_nexus.growth_geo_probe_job (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  question text NOT NULL,
  engine varchar NOT NULL,
  brand_slug varchar,
  competitors jsonb NOT NULL DEFAULT '[]'::jsonb,
  status varchar NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'blocked')),
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  probe_id uuid REFERENCES rhautt_nexus.growth_geo_probe(id),
  snapshot_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rhautt_nexus.growth_geo_answer_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  job_id uuid NOT NULL REFERENCES rhautt_nexus.growth_geo_probe_job(id) ON DELETE CASCADE,
  engine varchar NOT NULL,
  question text NOT NULL,
  answer_text text NOT NULL,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw_html text,
  raw_response jsonb NOT NULL DEFAULT '{}'::jsonb,
  screenshot_artifact_id uuid REFERENCES rhautt_nexus.uploaded_files(id),
  captured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'growth_geo_probe_job_snapshot_fk'
      AND conrelid = 'rhautt_nexus.growth_geo_probe_job'::regclass
  ) THEN
    ALTER TABLE rhautt_nexus.growth_geo_probe_job
      ADD CONSTRAINT growth_geo_probe_job_snapshot_fk
      FOREIGN KEY (snapshot_id) REFERENCES rhautt_nexus.growth_geo_answer_snapshot(id)
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS growth_geo_probe_job_tenant_status_idx
  ON rhautt_nexus.growth_geo_probe_job (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS growth_geo_probe_job_tenant_engine_idx
  ON rhautt_nexus.growth_geo_probe_job (tenant_id, engine, created_at DESC);
CREATE INDEX IF NOT EXISTS growth_geo_answer_snapshot_tenant_job_idx
  ON rhautt_nexus.growth_geo_answer_snapshot (tenant_id, job_id, captured_at DESC);

ALTER TABLE rhautt_nexus.growth_geo_probe_job ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.growth_geo_answer_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.growth_geo_probe_job FORCE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.growth_geo_answer_snapshot FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS growth_geo_probe_job_tenant_isolation ON rhautt_nexus.growth_geo_probe_job;
CREATE POLICY growth_geo_probe_job_tenant_isolation ON rhautt_nexus.growth_geo_probe_job
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

DROP POLICY IF EXISTS growth_geo_answer_snapshot_tenant_isolation ON rhautt_nexus.growth_geo_answer_snapshot;
CREATE POLICY growth_geo_answer_snapshot_tenant_isolation ON rhautt_nexus.growth_geo_answer_snapshot
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());
