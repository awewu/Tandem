-- 085 · 内容工厂（模块8 · AI-GEO 矛头的弹药生产线）
-- AI GTM Nexus Phase 2：内容 brief→draft→审核→发布 全流水线，绑事实源(基座4) + 合规审核。
-- 喂 GEO/官网/社媒；审核积压计入 CMO 舱 riskAlerts。

SET search_path TO rhautt_nexus, public;

CREATE TABLE IF NOT EXISTS rhautt_nexus.content_asset (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  brand_code text,
  category text,
  kind text NOT NULL DEFAULT 'article'
    CHECK (kind IN ('article', 'faq', 'comparison', 'topic', 'social', 'landing')),
  title text NOT NULL,
  body text,
  fact_refs jsonb NOT NULL DEFAULT '[]'::jsonb,      -- 事实源引用（基座4：无据不得发布）
  channel text,                                       -- geo / website / wechat / xiaohongshu …
  compliance_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_review', 'approved', 'published', 'rejected')),
  author text,
  reviewer text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS content_asset_idx ON rhautt_nexus.content_asset (tenant_id, status, channel, updated_at DESC);

ALTER TABLE rhautt_nexus.content_asset ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS content_asset_tenant_isolation ON rhautt_nexus.content_asset;
CREATE POLICY content_asset_tenant_isolation ON rhautt_nexus.content_asset
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());
ALTER TABLE rhautt_nexus.content_asset FORCE ROW LEVEL SECURITY;
