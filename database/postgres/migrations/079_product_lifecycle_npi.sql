-- 079 · 产品管理 4.4 生命周期 + 4.5 NPI 上市编排
-- AI GTM Nexus Phase 1：产品生命周期阶段(引入→成长→成熟→退市) + 新品上市计划。

SET search_path TO rhautt_nexus, public;

ALTER TABLE rhautt_nexus.products
  ADD COLUMN IF NOT EXISTS lifecycle_stage text NOT NULL DEFAULT 'intro';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_lifecycle_stage_chk') THEN
    ALTER TABLE rhautt_nexus.products
      ADD CONSTRAINT products_lifecycle_stage_chk
      CHECK (lifecycle_stage IN ('intro', 'growth', 'mature', 'eol'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS rhautt_nexus.product_launch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  product_id uuid,
  sku text,
  name text NOT NULL,
  plan jsonb NOT NULL DEFAULT '{}'::jsonb,        -- 上市计划：卖点/物料/渠道/节奏
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,   -- 上市清单（分项完成度）
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'launching', 'launched', 'cancelled')),
  target_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_launch_tenant_idx ON rhautt_nexus.product_launch (tenant_id, status, target_date);

ALTER TABLE rhautt_nexus.product_launch ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS product_launch_tenant_isolation ON rhautt_nexus.product_launch;
CREATE POLICY product_launch_tenant_isolation ON rhautt_nexus.product_launch
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());
ALTER TABLE rhautt_nexus.product_launch FORCE ROW LEVEL SECURITY;
