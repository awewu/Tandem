-- 072 · GEO 闭环实验（PRD §5.4 GEO 第 7 层：探测 → 缺口 → 内容 → 复投 → 再探测验证）
-- 一次实验 = 针对某问题，"内容发布前" 与 "发布后" 各探测一次，对比我方出现率是否提升。
-- 这是「品牌建设有没有用」在 GEO 层的最小可证伪单元：before/after 出现率之差 = lift。
SET search_path TO rhautt_nexus, public;

CREATE TABLE IF NOT EXISTS rhautt_nexus.growth_geo_experiment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  brand_slug varchar NOT NULL,
  question_id uuid,                               -- 关联 growth_geo_question（可空：自由问题）
  question text NOT NULL,                         -- 冗余问题文本，便于回看
  hypothesis text,                                -- 假设：补什么内容 → 期望出现率提升
  status varchar NOT NULL DEFAULT 'baseline'
    CHECK (status IN ('baseline','content-linked','verifying','improved','no-change','regressed','killed')),
  -- 基线（发布前）
  baseline_batch_id uuid,                          -- 关联 growth_geo_probe_batch
  baseline_cited_rate int,                         -- 0-100
  baseline_at timestamptz,
  -- 干预（内容资产）
  copy_asset_id uuid,                              -- 关联 growth_copy_asset（补的内容）
  content_published_at timestamptz,
  -- 复投（发布后）
  verify_batch_id uuid,
  verify_cited_rate int,
  verify_at timestamptz,
  -- 结论
  lift int,                                        -- verify - baseline（百分点）
  kill_criteria text,                              -- 预注册杀死准则（宪章 §12：实验须带 kill 准则）
  conclusion text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS growth_geo_experiment_scope_idx
  ON rhautt_nexus.growth_geo_experiment (tenant_id, brand_slug, status, created_at);

ALTER TABLE rhautt_nexus.growth_geo_experiment ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.growth_geo_experiment FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS growth_geo_experiment_tenant_isolation ON rhautt_nexus.growth_geo_experiment;
CREATE POLICY growth_geo_experiment_tenant_isolation ON rhautt_nexus.growth_geo_experiment
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

-- 应用角色权限（rhautt_app 为 NOBYPASSRLS，须显式授予）
GRANT SELECT, INSERT, UPDATE, DELETE ON rhautt_nexus.growth_geo_experiment TO rhautt_app;
