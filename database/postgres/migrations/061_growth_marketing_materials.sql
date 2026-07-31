SET search_path TO rhautt_nexus, public;

CREATE TABLE IF NOT EXISTS rhautt_nexus.growth_marketing_material (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  title varchar NOT NULL,
  material_type varchar NOT NULL,
  brand_slug varchar NULL,
  channel varchar NULL,
  target_audience varchar NULL,
  summary text NULL,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  file_artifact_id uuid NULL,
  file_url text NULL,
  thumbnail_url text NULL,
  file_format varchar NULL,
  version_label varchar NOT NULL DEFAULT 'v1',
  status varchar NOT NULL DEFAULT 'active',
  reviewer varchar NULL,
  review_note text NULL,
  compliance_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  valid_from timestamptz NULL,
  valid_until timestamptz NULL,
  download_count int NOT NULL DEFAULT 0,
  archived_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT growth_marketing_material_status_chk CHECK (
    status IN ('active', 'archived')
  )
);

CREATE INDEX IF NOT EXISTS growth_marketing_material_tenant_status_idx
  ON rhautt_nexus.growth_marketing_material (tenant_id, status, updated_at DESC)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS growth_marketing_material_tenant_type_idx
  ON rhautt_nexus.growth_marketing_material (tenant_id, material_type, updated_at DESC)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS growth_marketing_material_tenant_brand_idx
  ON rhautt_nexus.growth_marketing_material (tenant_id, brand_slug, updated_at DESC)
  WHERE archived_at IS NULL;

ALTER TABLE rhautt_nexus.growth_marketing_material ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.growth_marketing_material FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS growth_marketing_material_tenant_isolation ON rhautt_nexus.growth_marketing_material;
CREATE POLICY growth_marketing_material_tenant_isolation ON rhautt_nexus.growth_marketing_material
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());
