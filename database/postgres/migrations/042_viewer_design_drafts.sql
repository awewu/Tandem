-- Rhautt Nexus - Migration 042
-- Rysnova BIM unified viewer draft persistence.
-- Additive tenant-scoped table for the /api/v2/rysnova-bim/viewer-drafts API.

SET search_path TO rhautt_nexus, public;

CREATE TABLE IF NOT EXISTS rhautt_nexus.viewer_design_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  dealer_id text,
  store_id text,
  created_by text,
  updated_by text,
  project_id text,
  design_project_id text,
  bim_project_id text,
  customer_id text,
  opportunity_id text,
  contract_id text,
  artifact_id text,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','archived')),
  project_inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  building_inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  system_inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_model jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS viewer_design_drafts_tenant_project_idx
  ON rhautt_nexus.viewer_design_drafts (tenant_id, project_id);
CREATE INDEX IF NOT EXISTS viewer_design_drafts_tenant_design_project_idx
  ON rhautt_nexus.viewer_design_drafts (tenant_id, design_project_id);
CREATE INDEX IF NOT EXISTS viewer_design_drafts_tenant_updated_idx
  ON rhautt_nexus.viewer_design_drafts (tenant_id, updated_at DESC);

ALTER TABLE rhautt_nexus.viewer_design_drafts
  ADD COLUMN IF NOT EXISTS generated_model jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE rhautt_nexus.viewer_design_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.viewer_design_drafts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS viewer_design_drafts_tenant_isolation ON rhautt_nexus.viewer_design_drafts;
CREATE POLICY viewer_design_drafts_tenant_isolation ON rhautt_nexus.viewer_design_drafts
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());
