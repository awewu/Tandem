-- 082 · 渠道与伙伴营销（模块6 · 制造商 GTM 命脉）
-- AI GTM Nexus Phase 3：渠道招募/分层认证 + 返利(毛利闸·基座3) + 渠道绩效。
-- 服务业务目标：经销商网络扩张 → 销售倍增。

SET search_path TO rhautt_nexus, public;

CREATE TABLE IF NOT EXISTS rhautt_nexus.channel_partner (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  code text NOT NULL,
  name text NOT NULL,
  tier text NOT NULL DEFAULT 'prospect'
    CHECK (tier IN ('prospect', 'bronze', 'silver', 'gold', 'platinum')),
  region text,
  categories jsonb NOT NULL DEFAULT '[]'::jsonb,     -- 授权品类
  certified boolean NOT NULL DEFAULT false,          -- 是否通过认证（联动 4.19 培训认证）
  status text NOT NULL DEFAULT 'recruiting'
    CHECK (status IN ('recruiting', 'onboarding', 'active', 'suspended', 'terminated')),
  contact jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);
CREATE INDEX IF NOT EXISTS channel_partner_idx ON rhautt_nexus.channel_partner (tenant_id, status, tier);

CREATE TABLE IF NOT EXISTS rhautt_nexus.channel_rebate (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  partner_id uuid REFERENCES rhautt_nexus.channel_partner(id),
  period text NOT NULL,
  basis text NOT NULL CHECK (basis IN ('sell_through', 'gmv', 'coop')),
  amount numeric NOT NULL DEFAULT 0,
  margin_calc jsonb NOT NULL DEFAULT '{}'::jsonb,     -- 毛利测算（基座3：低于阈值阻断批准）
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'paid')),
  approver text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS channel_rebate_idx ON rhautt_nexus.channel_rebate (tenant_id, partner_id, status);

CREATE TABLE IF NOT EXISTS rhautt_nexus.channel_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  partner_id uuid REFERENCES rhautt_nexus.channel_partner(id),
  period text NOT NULL,
  gmv numeric NOT NULL DEFAULT 0,
  deals integer NOT NULL DEFAULT 0,
  sell_through numeric NOT NULL DEFAULT 0,
  active_profitable boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, partner_id, period)
);

ALTER TABLE rhautt_nexus.channel_partner ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.channel_rebate ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.channel_performance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS channel_partner_tenant_isolation ON rhautt_nexus.channel_partner;
CREATE POLICY channel_partner_tenant_isolation ON rhautt_nexus.channel_partner
  USING (tenant_id = rhautt_nexus.current_tenant_id()) WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());
DROP POLICY IF EXISTS channel_rebate_tenant_isolation ON rhautt_nexus.channel_rebate;
CREATE POLICY channel_rebate_tenant_isolation ON rhautt_nexus.channel_rebate
  USING (tenant_id = rhautt_nexus.current_tenant_id()) WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());
DROP POLICY IF EXISTS channel_performance_tenant_isolation ON rhautt_nexus.channel_performance;
CREATE POLICY channel_performance_tenant_isolation ON rhautt_nexus.channel_performance
  USING (tenant_id = rhautt_nexus.current_tenant_id()) WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

ALTER TABLE rhautt_nexus.channel_partner FORCE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.channel_rebate FORCE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.channel_performance FORCE ROW LEVEL SECURITY;
