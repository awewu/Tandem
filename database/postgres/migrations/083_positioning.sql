-- 083 · 品牌定位 Messaging House（模块2 · 品牌资产核心）
-- AI GTM Nexus Phase 2：每个 品牌×品类 的定位话术屋——核心承诺/支柱/信任状(事实依据)/目标客群/竞品差异。
-- 喂 AgenticGEO 生成 + insight 竞品差异 + 产品卖点对齐。基座4：信任状须有据(proof_points 带 evidence)。

SET search_path TO rhautt_nexus, public;

CREATE TABLE IF NOT EXISTS rhautt_nexus.positioning_house (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  brand_code text NOT NULL,
  category text NOT NULL,
  promise text,                                    -- 核心承诺（一句话定位）
  pillars jsonb NOT NULL DEFAULT '[]'::jsonb,       -- 价值支柱 [{title, desc}]
  proof_points jsonb NOT NULL DEFAULT '[]'::jsonb,  -- 信任状 [{claim, evidence}]（基座4）
  target_segments jsonb NOT NULL DEFAULT '[]'::jsonb,
  differentiation jsonb NOT NULL DEFAULT '[]'::jsonb, -- vs 竞品 [{competitor, edge}]
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'archived')),
  approver text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, brand_code, category)
);
CREATE INDEX IF NOT EXISTS positioning_house_idx ON rhautt_nexus.positioning_house (tenant_id, brand_code, category);

ALTER TABLE rhautt_nexus.positioning_house ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS positioning_house_tenant_isolation ON rhautt_nexus.positioning_house;
CREATE POLICY positioning_house_tenant_isolation ON rhautt_nexus.positioning_house
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());
ALTER TABLE rhautt_nexus.positioning_house FORCE ROW LEVEL SECURITY;
