-- Rhautt Nexus - Migration 045
-- Rysnova BIM model CRUD metadata and soft-delete/audit states.

SET search_path TO rhautt_nexus, public;

ALTER TABLE rhautt_nexus.viewer_model_sources
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS record_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'viewer_model_sources_record_status_check'
      AND conrelid = 'rhautt_nexus.viewer_model_sources'::regclass
  ) THEN
    ALTER TABLE rhautt_nexus.viewer_model_sources
      ADD CONSTRAINT viewer_model_sources_record_status_check
      CHECK (record_status IN ('active','archived','deleted'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS viewer_model_sources_tenant_record_status_idx
  ON rhautt_nexus.viewer_model_sources (tenant_id, record_status);
CREATE INDEX IF NOT EXISTS viewer_model_sources_tenant_name_idx
  ON rhautt_nexus.viewer_model_sources (tenant_id, name);
