-- 070 · 驾驶舱指标日快照（脱敏聚合固化 → 趋势曲线）
-- 把北极星/品牌健康度/漏斗/分配等实时聚合按日固化，供趋势查看（当下值 → 时间序列）。
-- (tenant_id, metric_key, snapshot_date) 唯一 → 同日重跑幂等 upsert。
SET search_path TO rhautt_nexus, public;

CREATE TABLE IF NOT EXISTS rhautt_nexus.growth_metric_daily_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  metric_key varchar NOT NULL,          -- active_profitable_dealers/network_gmv/ai_cited_rate/sov/positive_sentiment/routing_rate/funnel_*
  value numeric NOT NULL DEFAULT 0,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT growth_metric_daily_snapshot_uq UNIQUE (tenant_id, metric_key, snapshot_date)
);

CREATE INDEX IF NOT EXISTS growth_metric_daily_snapshot_scope_idx
  ON rhautt_nexus.growth_metric_daily_snapshot (tenant_id, metric_key, snapshot_date DESC);

ALTER TABLE rhautt_nexus.growth_metric_daily_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.growth_metric_daily_snapshot FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS growth_metric_daily_snapshot_tenant_isolation ON rhautt_nexus.growth_metric_daily_snapshot;
CREATE POLICY growth_metric_daily_snapshot_tenant_isolation ON rhautt_nexus.growth_metric_daily_snapshot
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());
