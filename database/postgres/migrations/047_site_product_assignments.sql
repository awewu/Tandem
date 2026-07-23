-- Rhautt Nexus - Migration 047
-- Tenant-owned website shelves referencing products from authorized brand tenants.

SET search_path TO rhautt_nexus, public;

CREATE TABLE IF NOT EXISTS rhautt_nexus.site_product_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  site_id uuid NOT NULL REFERENCES rhautt_nexus.tenant_brand_sites(id) ON DELETE CASCADE,
  product_tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  product_id uuid NOT NULL REFERENCES rhautt_nexus.products(id),
  brand text,
  public_slug text NOT NULL CHECK (public_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  website_category text,
  menu_group text,
  display_order integer NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  is_featured boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'hidden')),
  site_title text,
  site_summary text,
  site_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at timestamptz,
  created_by uuid REFERENCES rhautt_nexus.users(id),
  updated_by uuid REFERENCES rhautt_nexus.users(id),
  deleted_by uuid REFERENCES rhautt_nexus.users(id),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS site_product_assignments_site_product_uidx
  ON rhautt_nexus.site_product_assignments (tenant_id, site_id, product_id)
  WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS site_product_assignments_site_slug_uidx
  ON rhautt_nexus.site_product_assignments (tenant_id, site_id, lower(public_slug))
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS site_product_assignments_public_idx
  ON rhautt_nexus.site_product_assignments (tenant_id, site_id, status, display_order, created_at)
  WHERE deleted_at IS NULL;

ALTER TABLE rhautt_nexus.site_product_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.site_product_assignments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS site_product_assignments_tenant_isolation ON rhautt_nexus.site_product_assignments;
CREATE POLICY site_product_assignments_tenant_isolation ON rhautt_nexus.site_product_assignments
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());
