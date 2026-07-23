-- ════════════════════════════════════════════════════════════════════════
-- Rhautt Nexus · Migration 023
-- D2 产品事实基座 · 产品关系（P1）：配件/兼容/替代/交叉·向上销售/对比。
--
-- 事实源：docs/D2-PRODUCT-FACT-BASE-BLUEPRINT.md §10.5（P1 产品关系）。
-- 用途：支撑品牌站对比表、关联推荐（配件/交叉销售），报价/BIM 取兼容件。
--   关系归 D2 产品事实（两端产品均在同一品牌运营租户内），FORCE RLS。
--   relation_type 受控集；(tenant,product,related,type) 唯一；sort_order 供展示排序。
--   公开投影：只回关系另一端的脱敏轻量卡（sku/name/headline），不含成本。
--
-- 幂等：CREATE TABLE/INDEX/POLICY IF NOT EXISTS（+ DROP POLICY IF EXISTS）。
-- ════════════════════════════════════════════════════════════════════════

SET search_path TO rhautt_nexus, public;

DO $$
BEGIN
  IF to_regclass('rhautt_nexus.products') IS NULL THEN
    RAISE NOTICE 'rhautt_nexus.products absent — skip 022';
    RETURN;
  END IF;

  CREATE TABLE IF NOT EXISTS rhautt_nexus.product_relations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
    product_id uuid NOT NULL REFERENCES rhautt_nexus.products(id) ON DELETE CASCADE,
    related_product_id uuid NOT NULL REFERENCES rhautt_nexus.products(id) ON DELETE CASCADE,
    relation_type text NOT NULL
      CHECK (relation_type IN ('accessory', 'compatible', 'replaces', 'replaced_by', 'cross_sell', 'up_sell', 'compare')),
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, product_id, related_product_id, relation_type),
    CHECK (product_id <> related_product_id)
  );

  CREATE INDEX IF NOT EXISTS product_relations_product_idx
    ON rhautt_nexus.product_relations (product_id, relation_type, sort_order);

  ALTER TABLE rhautt_nexus.product_relations ENABLE ROW LEVEL SECURITY;
  ALTER TABLE rhautt_nexus.product_relations FORCE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS product_relations_tenant_isolation ON rhautt_nexus.product_relations;
  CREATE POLICY product_relations_tenant_isolation ON rhautt_nexus.product_relations
    USING (tenant_id = rhautt_nexus.current_tenant_id())
    WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

  RAISE NOTICE 'Migration 023: product_relations ensured with FORCE RLS';
END $$;
