-- 089 · 场景库（GTM 战略分析层 · GEO 选题的上游）
-- 背景：GEO 选题此前无可追溯来源（拍脑袋出题）→ 精密引擎打在没瞄准的靶上。
-- 设计：场景 = 品类 × 角色 × 痛点 × 房型 × 气候区；场景骨架品类级可复用，
--       换品类只换填充词 → 新品牌/品类零人工获得初始 prompt 簇（自循环冷启动）。
-- 派生出的问题落入既有 growth_geo_question（不另造问题模型），并回填 source_scenario_id 保证选题可追溯。
SET search_path TO rhautt_nexus, public;

CREATE TABLE IF NOT EXISTS rhautt_nexus.growth_scenario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  category varchar NOT NULL,                       -- 品类（空调/热泵/新风/热水器…）
  audience varchar NOT NULL DEFAULT 'owner'        -- 角色：不同角色问法不同，AI 答案也不同
    CHECK (audience IN ('owner','decorator','designer','installer')),
  pain_point varchar NOT NULL,                     -- 痛点（电费高/噪音/回南天潮/无地暖…）
  house_type varchar,                              -- 房型（老房/新房/小户型/别墅…）
  climate_zone varchar,                            -- 气候区（严寒/寒冷/夏热冬冷/夏热冬暖…）
  intent varchar NOT NULL DEFAULT 'compare'        -- 意向强度：信息型 < 对比型 < 决策型
    CHECK (intent IN ('info','compare','decide')),
  brand_slug varchar,                              -- 可选：绑定品牌（空=品类级通用场景，可被所有品牌复用）
  notes text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS growth_scenario_scope_idx
  ON rhautt_nexus.growth_scenario (tenant_id, category, audience, enabled);

ALTER TABLE rhautt_nexus.growth_scenario ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.growth_scenario FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS growth_scenario_tenant_isolation ON rhautt_nexus.growth_scenario;
CREATE POLICY growth_scenario_tenant_isolation ON rhautt_nexus.growth_scenario
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON rhautt_nexus.growth_scenario TO rhautt_app;

-- 选题可追溯：问题从哪个场景派生而来（NULL = 人工录入的历史问题）
ALTER TABLE rhautt_nexus.growth_geo_question
  ADD COLUMN IF NOT EXISTS source_scenario_id uuid;

CREATE INDEX IF NOT EXISTS growth_geo_question_scenario_idx
  ON rhautt_nexus.growth_geo_question (tenant_id, source_scenario_id);
