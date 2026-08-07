-- 088 · 度量中台读模型 + 多触点归因（替代 cockpit/CMO 直查 OLTP）
-- RLS 优先:用带 FORCE RLS 的读模型汇总表(而非裸物化视图——MV 不走 RLS、破坏租户隔离)。
-- 触点来源复用 growth_funnel_event(subject_id 旅程 + channel + created_at)。
-- metric_daily_rollup      : 按 (租户,日,渠道) 的漏斗阶段计数读模型
-- metric_channel_attribution: 多触点归因结果(线性/位置/时间衰减 × 渠道 × 期)
SET search_path TO rhautt_nexus, public;

-- ── 读模型:日×渠道 漏斗滚动 ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rhautt_nexus.metric_daily_rollup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  day date NOT NULL,
  channel varchar NOT NULL DEFAULT 'unknown',
  reach int NOT NULL DEFAULT 0,
  lead int NOT NULL DEFAULT 0,
  visit int NOT NULL DEFAULT 0,
  proposal int NOT NULL DEFAULT 0,
  revenue int NOT NULL DEFAULT 0,
  referral int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT metric_daily_rollup_uq UNIQUE (tenant_id, day, channel)
);
CREATE INDEX IF NOT EXISTS metric_daily_rollup_scope_idx
  ON rhautt_nexus.metric_daily_rollup (tenant_id, day);

ALTER TABLE rhautt_nexus.metric_daily_rollup ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.metric_daily_rollup FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS metric_daily_rollup_tenant_isolation ON rhautt_nexus.metric_daily_rollup;
CREATE POLICY metric_daily_rollup_tenant_isolation ON rhautt_nexus.metric_daily_rollup
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

-- ── 多触点归因结果 ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rhautt_nexus.metric_channel_attribution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  period varchar NOT NULL,                       -- YYYY-MM
  model varchar NOT NULL CHECK (model IN ('linear','position','time_decay')),
  channel varchar NOT NULL,
  credited_conversions numeric NOT NULL DEFAULT 0,
  touches int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT metric_channel_attribution_uq UNIQUE (tenant_id, period, model, channel)
);
CREATE INDEX IF NOT EXISTS metric_channel_attribution_scope_idx
  ON rhautt_nexus.metric_channel_attribution (tenant_id, period, model);

ALTER TABLE rhautt_nexus.metric_channel_attribution ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.metric_channel_attribution FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS metric_channel_attribution_tenant_isolation ON rhautt_nexus.metric_channel_attribution;
CREATE POLICY metric_channel_attribution_tenant_isolation ON rhautt_nexus.metric_channel_attribution
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

-- 应用角色最小权限(与既有模块一致;显式授权,belt-and-suspenders)。
GRANT SELECT, INSERT, UPDATE, DELETE ON rhautt_nexus.metric_daily_rollup TO rhautt_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON rhautt_nexus.metric_channel_attribution TO rhautt_app;
