-- 069 · AARRR 漏斗事件（Phase 1 · cockpit 漏斗诊断）
-- 每个合格事件落一行，(tenant, source_event_id) 唯一去重 → COUNT 分组即漏斗，天然幂等。
-- Rhautt 版 AARRR 阶段：reach 触达 · lead 线索 · visit 到访 · proposal 方案 · revenue 签约 · referral 转介绍。
SET search_path TO rhautt_nexus, public;

CREATE TABLE IF NOT EXISTS rhautt_nexus.growth_funnel_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  source_event_id varchar NOT NULL,
  stage varchar NOT NULL CHECK (stage IN ('reach','lead','visit','proposal','revenue','referral')),
  subject_id varchar,
  period varchar NOT NULL,                        -- YYYY-MM
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT growth_funnel_event_uq UNIQUE (tenant_id, source_event_id)
);

CREATE INDEX IF NOT EXISTS growth_funnel_event_scope_idx
  ON rhautt_nexus.growth_funnel_event (tenant_id, period, stage);

ALTER TABLE rhautt_nexus.growth_funnel_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.growth_funnel_event FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS growth_funnel_event_tenant_isolation ON rhautt_nexus.growth_funnel_event;
CREATE POLICY growth_funnel_event_tenant_isolation ON rhautt_nexus.growth_funnel_event
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());
