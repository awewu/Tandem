-- 078 · 事实基座发布投影（D4 单一事实基座：品牌写 / 经销商按品牌只读消费）
-- AI GTM Nexus Phase 0：brand_publish_grant 授权哪个消费租户可读哪个品牌的【已发布】产品事实。
-- products.published 标记对外/消费可见（存量默认 true，保持现状）。

SET search_path TO rhautt_nexus, public;

ALTER TABLE rhautt_nexus.products
  ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS rhautt_nexus.brand_publish_grant (
  consumer_tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  brand_code text NOT NULL,
  status text NOT NULL DEFAULT 'granted' CHECK (status IN ('granted', 'revoked')),
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (consumer_tenant_id, brand_code)
);

ALTER TABLE rhautt_nexus.brand_publish_grant ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS brand_publish_grant_tenant_isolation ON rhautt_nexus.brand_publish_grant;
CREATE POLICY brand_publish_grant_tenant_isolation ON rhautt_nexus.brand_publish_grant
  USING (consumer_tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (consumer_tenant_id = rhautt_nexus.current_tenant_id());
ALTER TABLE rhautt_nexus.brand_publish_grant FORCE ROW LEVEL SECURITY;

COMMENT ON TABLE rhautt_nexus.brand_publish_grant IS '发布投影授权：消费租户(经销商) × 品牌 → 可只读该品牌已发布产品事实';
