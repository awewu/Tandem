-- 080 · 产品管理 4.10 卖点体系 + 4.17 定价审批(毛利闸·基座3)
-- AI GTM Nexus Phase 1：per-产品卖点(喂 GEO/内容) + 定价政策提报→毛利测算闸→审批→发布。

SET search_path TO rhautt_nexus, public;

CREATE TABLE IF NOT EXISTS rhautt_nexus.product_selling_point (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  product_id uuid,
  sku text,
  segment text,                        -- 面向客群/场景
  claim text NOT NULL,                 -- 卖点主张
  evidence_ref text,                   -- 事实依据（国标/参数/认证）——基座4：卖点须有据
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_selling_point_tenant_idx ON rhautt_nexus.product_selling_point (tenant_id, product_id, sort_order);

CREATE TABLE IF NOT EXISTS rhautt_nexus.pricing_policy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  product_id uuid,
  sku text,
  policy_type text NOT NULL CHECK (policy_type IN ('list', 'promo', 'rebate')),
  proposed_price numeric NOT NULL DEFAULT 0,
  cost_price numeric NOT NULL DEFAULT 0,
  margin_calc jsonb NOT NULL DEFAULT '{}'::jsonb,   -- 毛利测算结果（率/额/是否过闸）
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  submitted_by text,
  approver text,
  decision_note text,
  submitted_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pricing_policy_tenant_idx ON rhautt_nexus.pricing_policy (tenant_id, status, updated_at DESC);

ALTER TABLE rhautt_nexus.product_selling_point ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.pricing_policy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_selling_point_tenant_isolation ON rhautt_nexus.product_selling_point;
CREATE POLICY product_selling_point_tenant_isolation ON rhautt_nexus.product_selling_point
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

DROP POLICY IF EXISTS pricing_policy_tenant_isolation ON rhautt_nexus.pricing_policy;
CREATE POLICY pricing_policy_tenant_isolation ON rhautt_nexus.pricing_policy
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

ALTER TABLE rhautt_nexus.product_selling_point FORCE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.pricing_policy FORCE ROW LEVEL SECURITY;
