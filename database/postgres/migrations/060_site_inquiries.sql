CREATE TABLE IF NOT EXISTS rhautt_nexus.site_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  site_id uuid NOT NULL REFERENCES rhautt_nexus.tenant_brand_sites(id) ON DELETE CASCADE,
  site_code varchar NOT NULL,
  kind varchar NOT NULL CHECK (kind IN ('customer', 'dealer')),
  name varchar NULL,
  phone varchar NULL,
  city varchar NULL,
  inquiry_type varchar NULL,
  message text NULL,
  company_name varchar NULL,
  intended_region varchar NULL,
  business_summary text NULL,
  source_path text NULL,
  user_agent text NULL,
  deleted_by uuid NULL,
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS site_inquiries_tenant_site_kind_created_idx
  ON rhautt_nexus.site_inquiries (tenant_id, site_id, kind, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS site_inquiries_site_code_idx
  ON rhautt_nexus.site_inquiries (tenant_id, site_code, kind, created_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE rhautt_nexus.site_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.site_inquiries FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS site_inquiries_tenant_isolation ON rhautt_nexus.site_inquiries;
CREATE POLICY site_inquiries_tenant_isolation ON rhautt_nexus.site_inquiries
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
