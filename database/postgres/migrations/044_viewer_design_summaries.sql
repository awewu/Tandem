-- Rhautt Nexus - Migration 044
-- Rysnova BIM unified viewer calculation/equipment/pipe/compliance summary persistence.
-- Additive tenant-scoped table for the /api/v2/rysnova-bim/viewer-summaries API.

SET search_path TO rhautt_nexus, public;

CREATE TABLE IF NOT EXISTS rhautt_nexus.viewer_design_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  dealer_id text,
  store_id text,
  created_by text,
  updated_by text,
  draft_id uuid REFERENCES rhautt_nexus.viewer_design_drafts(id),
  draft_version integer,
  model_id text,
  model_version integer,
  project_id text,
  design_project_id text,
  bim_project_id text,
  trust_status text NOT NULL DEFAULT 'estimate' CHECK (trust_status IN ('estimate','verified')),
  calculation_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  equipment_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  pipe_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  compliance_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS viewer_design_summaries_tenant_draft_updated_idx
  ON rhautt_nexus.viewer_design_summaries (tenant_id, draft_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS viewer_design_summaries_tenant_project_idx
  ON rhautt_nexus.viewer_design_summaries (tenant_id, project_id);
CREATE INDEX IF NOT EXISTS viewer_design_summaries_tenant_design_project_idx
  ON rhautt_nexus.viewer_design_summaries (tenant_id, design_project_id);
CREATE INDEX IF NOT EXISTS viewer_design_summaries_tenant_trust_idx
  ON rhautt_nexus.viewer_design_summaries (tenant_id, trust_status);

ALTER TABLE rhautt_nexus.viewer_design_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.viewer_design_summaries FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS viewer_design_summaries_tenant_isolation ON rhautt_nexus.viewer_design_summaries;
CREATE POLICY viewer_design_summaries_tenant_isolation ON rhautt_nexus.viewer_design_summaries
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());
