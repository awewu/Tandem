ALTER TABLE rhautt_nexus.tenant_brand_sites
  ADD COLUMN IF NOT EXISTS child_brand_codes jsonb NOT NULL DEFAULT '[]'::jsonb;
