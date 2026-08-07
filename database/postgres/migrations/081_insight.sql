-- 081 · 市场洞察与竞品情报（模块1 · 基座2：品类为竞品分析核心）
-- AI GTM Nexus Phase 2：按【品类】跟踪竞品(产品/价格/渠道/营销/AI声量) + 宏观/行业信号。
-- 服务业务目标：中央热水行业冠军、壁挂炉/水机空调进第一阵营——先看清品类竞争格局。

SET search_path TO rhautt_nexus, public;

CREATE TABLE IF NOT EXISTS rhautt_nexus.insight_competitor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  category text NOT NULL,                 -- 品类：central-hot-water / wall-hung-boiler / water-cooled-ac …
  competitor text NOT NULL,               -- 竞品品牌
  dimension text NOT NULL
    CHECK (dimension IN ('product', 'price', 'channel', 'marketing', 'ai_sov')),
  metric text NOT NULL,                   -- 指标名（如 价格带 / AI被引率 / 声量份额）
  value numeric,
  value_text text,
  source text,                            -- 数据来源（可溯源·合规采集）
  captured_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS insight_competitor_cat_idx ON rhautt_nexus.insight_competitor (tenant_id, category, dimension, captured_at DESC);

CREATE TABLE IF NOT EXISTS rhautt_nexus.insight_signal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  category text,
  signal_type text NOT NULL CHECK (signal_type IN ('macro', 'industry', 'trend', 'ai_cognition')),
  title text NOT NULL,
  summary text,
  source text,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'watch', 'alert')),
  captured_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS insight_signal_idx ON rhautt_nexus.insight_signal (tenant_id, signal_type, category, captured_at DESC);

ALTER TABLE rhautt_nexus.insight_competitor ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.insight_signal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS insight_competitor_tenant_isolation ON rhautt_nexus.insight_competitor;
CREATE POLICY insight_competitor_tenant_isolation ON rhautt_nexus.insight_competitor
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

DROP POLICY IF EXISTS insight_signal_tenant_isolation ON rhautt_nexus.insight_signal;
CREATE POLICY insight_signal_tenant_isolation ON rhautt_nexus.insight_signal
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

ALTER TABLE rhautt_nexus.insight_competitor FORCE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.insight_signal FORCE ROW LEVEL SECURITY;
