-- 086 · GEO 进化：借鉴分众智投「选点·千面·回收·引爆·资产」（模块4 矛头强化）
--   geo_target        选点/千问千面：人群段×品类×场景×引擎 的 AI 查询目标，潜客浓度优先级
--   geo_cognition_asset 认知资产漏斗(AI-AIPL)：品牌×品类×引擎 触达→被引用→被推荐→线索，可累积护城河

SET search_path TO rhautt_nexus, public;

CREATE TABLE IF NOT EXISTS rhautt_nexus.geo_target (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  brand_code text,
  category text NOT NULL,
  segment text,                          -- 目标人群段（如 新房刚需/存量改善/工程）
  scenario text,                         -- AI 使用场景（选购/对比/安装/售后）
  engine text,                           -- 目标引擎（doubao/deepseek/qwen/kimi/…）
  query text NOT NULL,                   -- 目标 AI 查询/prompt
  priority_score numeric NOT NULL DEFAULT 0,   -- 潜客浓度×价值 优先级（选点评分）
  variant_strategy jsonb NOT NULL DEFAULT '{}'::jsonb,  -- 千问千面：该目标的差异化内容策略
  status text NOT NULL DEFAULT 'candidate'
    CHECK (status IN ('candidate', 'active', 'won', 'paused')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS geo_target_idx ON rhautt_nexus.geo_target (tenant_id, category, priority_score DESC);

CREATE TABLE IF NOT EXISTS rhautt_nexus.geo_cognition_asset (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  brand_code text NOT NULL,
  category text NOT NULL,
  engine text,
  reach integer NOT NULL DEFAULT 0,        -- A 触达：品牌被 AI 提及
  cited integer NOT NULL DEFAULT 0,        -- I 被引用：答案引用我方事实
  recommended integer NOT NULL DEFAULT 0,  -- P 被推荐：AI 主动推荐我方
  lead integer NOT NULL DEFAULT 0,         -- L 线索：GEO 归因高意向线索
  period text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, brand_code, category, engine, period)
);
CREATE INDEX IF NOT EXISTS geo_cognition_idx ON rhautt_nexus.geo_cognition_asset (tenant_id, category, brand_code);

ALTER TABLE rhautt_nexus.geo_target ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.geo_cognition_asset ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS geo_target_tenant_isolation ON rhautt_nexus.geo_target;
CREATE POLICY geo_target_tenant_isolation ON rhautt_nexus.geo_target
  USING (tenant_id = rhautt_nexus.current_tenant_id()) WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());
DROP POLICY IF EXISTS geo_cognition_tenant_isolation ON rhautt_nexus.geo_cognition_asset;
CREATE POLICY geo_cognition_tenant_isolation ON rhautt_nexus.geo_cognition_asset
  USING (tenant_id = rhautt_nexus.current_tenant_id()) WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

ALTER TABLE rhautt_nexus.geo_target FORCE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.geo_cognition_asset FORCE ROW LEVEL SECURITY;
