-- Tenant-owned brand master data and its single official website.

CREATE TABLE IF NOT EXISTS rhautt_nexus.tenant_brand_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  code text NOT NULL,
  name_cn text NOT NULL,
  name_en text NOT NULL,
  app_key text,
  delivery_type text NOT NULL DEFAULT 'self_hosted'
    CHECK (delivery_type IN ('self_hosted', 'external')),
  development_url text,
  production_url text,
  logo_artifact_id uuid REFERENCES rhautt_nexus.uploaded_files(id),
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  site_note text,
  created_by uuid REFERENCES rhautt_nexus.users(id),
  updated_by uuid REFERENCES rhautt_nexus.users(id),
  deleted_by uuid REFERENCES rhautt_nexus.users(id),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS tenant_brand_sites_tenant_active_idx
  ON rhautt_nexus.tenant_brand_sites (tenant_id, status, sort_order, created_at)
  WHERE deleted_at IS NULL;

ALTER TABLE rhautt_nexus.tenant_brand_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.tenant_brand_sites FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_brand_sites_tenant_isolation ON rhautt_nexus.tenant_brand_sites;
CREATE POLICY tenant_brand_sites_tenant_isolation ON rhautt_nexus.tenant_brand_sites
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());
