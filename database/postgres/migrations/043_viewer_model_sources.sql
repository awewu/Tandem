-- Rhautt Nexus - Migration 043
-- Rysnova BIM unified viewer model source records.
-- Tracks generated, local-upload and artifact-backed IFC/GLB model loads.

SET search_path TO rhautt_nexus, public;

CREATE TABLE IF NOT EXISTS rhautt_nexus.viewer_model_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  dealer_id text,
  store_id text,
  created_by text,
  updated_by text,
  draft_id text,
  project_id text,
  design_project_id text,
  bim_project_id text,
  customer_id text,
  opportunity_id text,
  contract_id text,
  source_type text NOT NULL CHECK (source_type IN ('generated','local-upload','artifact')),
  model_type text NOT NULL DEFAULT 'unknown' CHECK (model_type IN ('ifc','glb','generated','unknown')),
  artifact_id text,
  upload_reference jsonb NOT NULL DEFAULT '{}'::jsonb,
  load_status text NOT NULL DEFAULT 'loading' CHECK (load_status IN ('loading','ready','error','archived')),
  load_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  component_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (source_type = 'artifact' AND artifact_id IS NOT NULL)
    OR (source_type = 'local-upload' AND upload_reference <> '{}'::jsonb)
    OR source_type = 'generated'
  )
);

CREATE INDEX IF NOT EXISTS viewer_model_sources_tenant_project_idx
  ON rhautt_nexus.viewer_model_sources (tenant_id, project_id);
CREATE INDEX IF NOT EXISTS viewer_model_sources_tenant_design_project_idx
  ON rhautt_nexus.viewer_model_sources (tenant_id, design_project_id);
CREATE INDEX IF NOT EXISTS viewer_model_sources_tenant_bim_project_idx
  ON rhautt_nexus.viewer_model_sources (tenant_id, bim_project_id);
CREATE INDEX IF NOT EXISTS viewer_model_sources_tenant_artifact_idx
  ON rhautt_nexus.viewer_model_sources (tenant_id, artifact_id);
CREATE INDEX IF NOT EXISTS viewer_model_sources_tenant_draft_idx
  ON rhautt_nexus.viewer_model_sources (tenant_id, draft_id);
CREATE INDEX IF NOT EXISTS viewer_model_sources_tenant_updated_idx
  ON rhautt_nexus.viewer_model_sources (tenant_id, updated_at DESC);

ALTER TABLE rhautt_nexus.viewer_model_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.viewer_model_sources FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS viewer_model_sources_tenant_isolation ON rhautt_nexus.viewer_model_sources;
CREATE POLICY viewer_model_sources_tenant_isolation ON rhautt_nexus.viewer_model_sources
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());
