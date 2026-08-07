-- 068 · 北极星地基：经销商成功度快照 + 北极星快照（Phase 1 · cockpit）
-- 北极星="活跃盈利经销商数"；盈利=混合口径(profit_proxy=归因GMV×毛利估算, profit_actual=可选真实对账)。
SET search_path TO rhautt_nexus, public;

CREATE TABLE IF NOT EXISTS rhautt_nexus.dealer_success_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  dealer_id varchar NOT NULL,
  period varchar NOT NULL,                              -- YYYY-MM
  active boolean NOT NULL DEFAULT true,
  gmv numeric(16,2) NOT NULL DEFAULT 0,                 -- 网络归集成交额
  profit_proxy numeric(16,2) NOT NULL DEFAULT 0,        -- 代理口径：gmv × 毛利率
  profit_actual numeric(16,2),                          -- 可选：经销商真实对账（混合口径）
  close_rate numeric(6,4) NOT NULL DEFAULT 0,           -- 成交率
  nps numeric(6,2),                                     -- 体验
  retention numeric(6,4),                               -- 留存
  deals int NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dealer_success_snapshot_uq UNIQUE (tenant_id, dealer_id, period)
);

CREATE TABLE IF NOT EXISTS rhautt_nexus.growth_north_star_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  metric varchar NOT NULL,                              -- active_profitable_dealers / network_gmv / brand_health_ai_visibility ...
  value numeric(18,4) NOT NULL DEFAULT 0,
  period varchar NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT growth_north_star_snapshot_uq UNIQUE (tenant_id, metric, period)
);

-- 成交事件 inbox（幂等）：cockpit 侧记录 crm.deal.signed，dealer_success 由此求和重算，
-- 至少一次投递重投时靠 (tenant_id, source_event_id) 唯一约束去重，杜绝 GMV 重复计数。
CREATE TABLE IF NOT EXISTS rhautt_nexus.growth_dealer_deal_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  source_event_id varchar NOT NULL,                    -- outbox 事件 id 或 manual:<uuid>
  dealer_id varchar NOT NULL,
  amount numeric(16,2) NOT NULL DEFAULT 0,
  period varchar NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT growth_dealer_deal_inbox_uq UNIQUE (tenant_id, source_event_id)
);

CREATE INDEX IF NOT EXISTS growth_dealer_deal_inbox_scope_idx
  ON rhautt_nexus.growth_dealer_deal_inbox (tenant_id, dealer_id, period);

ALTER TABLE rhautt_nexus.growth_dealer_deal_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.growth_dealer_deal_inbox FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS growth_dealer_deal_inbox_tenant_isolation ON rhautt_nexus.growth_dealer_deal_inbox;
CREATE POLICY growth_dealer_deal_inbox_tenant_isolation ON rhautt_nexus.growth_dealer_deal_inbox
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

CREATE INDEX IF NOT EXISTS dealer_success_snapshot_tenant_period_idx
  ON rhautt_nexus.dealer_success_snapshot (tenant_id, period, active);
CREATE INDEX IF NOT EXISTS growth_north_star_snapshot_tenant_metric_idx
  ON rhautt_nexus.growth_north_star_snapshot (tenant_id, metric, period);

ALTER TABLE rhautt_nexus.dealer_success_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.dealer_success_snapshot FORCE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.growth_north_star_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.growth_north_star_snapshot FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dealer_success_snapshot_tenant_isolation ON rhautt_nexus.dealer_success_snapshot;
CREATE POLICY dealer_success_snapshot_tenant_isolation ON rhautt_nexus.dealer_success_snapshot
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

DROP POLICY IF EXISTS growth_north_star_snapshot_tenant_isolation ON rhautt_nexus.growth_north_star_snapshot;
CREATE POLICY growth_north_star_snapshot_tenant_isolation ON rhautt_nexus.growth_north_star_snapshot
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());
