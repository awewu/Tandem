-- ════════════════════════════════════════════════════════════════════════
-- Rhautt Nexus · Migration 010
-- 增长中枢 / Nexus Growth (D5 · 板块三对内底座能力域) 首批表 + 强 RLS
--
-- 事实源：docs/BOARD-3-NEXUS-GROWTH-BLUEPRINT.md §3。
-- 权限域：D5 推广与增长（HQ 租户为主；hq_marketing / brand_ops）。
--
-- 写入方全部经 NestJS growth.service → withRlsTransaction（事务内 SET LOCAL
-- app.tenant_id），故本迁移对全部 growth_* 表「阶段一 · 建表 + 立即强 RLS」，
-- 与 004 的 diagnosis_sessions / design_projects 同构。
--
-- 同规范：schema rhautt_nexus · current_tenant_id() · tenant_id = current_tenant_id()
-- tenant_id 一律 uuid NOT NULL REFERENCES tenants(id)，TypeORM 实体以 string 映射。
-- AI 产出（growth_copy_asset）默认 status='draft'，非 'approved' 不可导出/发布（应用层核准闸门）。
-- ════════════════════════════════════════════════════════════════════════

SET search_path TO rhautt_nexus, public;

-- ── E1 舆情监测 · 条目 ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rhautt_nexus.growth_opinion_mention (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  source text NOT NULL,
  url text,
  author_hash text,                       -- PIPL：作者标识脱敏哈希，不存原始身份
  content text NOT NULL,
  sentiment text NOT NULL DEFAULT 'neutral',
  intent text NOT NULL DEFAULT 'general',
  severity text NOT NULL DEFAULT 'P3',
  entities jsonb NOT NULL DEFAULT '[]'::jsonb,
  captured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS growth_opinion_mention_tenant_time_idx ON rhautt_nexus.growth_opinion_mention (tenant_id, captured_at);
CREATE INDEX IF NOT EXISTS growth_opinion_mention_tenant_severity_idx ON rhautt_nexus.growth_opinion_mention (tenant_id, severity);

-- ── E1 舆情监测 · 危机预警 ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rhautt_nexus.growth_opinion_alert (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  mention_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  severity text NOT NULL DEFAULT 'P1',
  status text NOT NULL DEFAULT 'open',
  playbook_draft text,                    -- 危机应对话术草稿（待人工核准）
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS growth_opinion_alert_tenant_status_idx ON rhautt_nexus.growth_opinion_alert (tenant_id, status);

-- ── E2 文案 Copilot · 文案资产 ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rhautt_nexus.growth_copy_asset (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  channel text NOT NULL,
  brand_slug text,
  prompt text NOT NULL,
  draft text,
  status text NOT NULL DEFAULT 'draft',   -- draft/approved/published/rejected（核准闸门）
  reviewer text,
  model text,
  tokens_cost numeric(12,4) NOT NULL DEFAULT 0,
  compliance_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS growth_copy_asset_tenant_status_idx ON rhautt_nexus.growth_copy_asset (tenant_id, status);

-- ── E3 GEO 分析 · 探测 ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rhautt_nexus.growth_geo_probe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  question text NOT NULL,
  engine text NOT NULL,
  answer_snapshot text,
  we_cited boolean NOT NULL DEFAULT false,
  citation_rank int,
  competitors_cited jsonb NOT NULL DEFAULT '[]'::jsonb,
  probed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS growth_geo_probe_tenant_engine_idx ON rhautt_nexus.growth_geo_probe (tenant_id, engine);

-- ── E4 营销自动化 · 战役 ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rhautt_nexus.growth_campaign (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  name text NOT NULL,
  channel text NOT NULL,
  budget numeric(14,2) NOT NULL DEFAULT 0,
  utm jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS growth_campaign_tenant_status_idx ON rhautt_nexus.growth_campaign (tenant_id, status);

-- ── E4 营销自动化 · 战役指标 ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rhautt_nexus.growth_campaign_metric (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  campaign_id uuid NOT NULL,
  impressions int NOT NULL DEFAULT 0,
  clicks int NOT NULL DEFAULT 0,
  leads int NOT NULL DEFAULT 0,
  signed int NOT NULL DEFAULT 0,
  cac numeric(14,2) NOT NULL DEFAULT 0,
  roi numeric(8,4) NOT NULL DEFAULT 0,
  period text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS growth_campaign_metric_tenant_campaign_idx ON rhautt_nexus.growth_campaign_metric (tenant_id, campaign_id);

-- ── 阶段一 RLS 加固：ENABLE + FORCE + tenant_isolation ─────────────────────
ALTER TABLE rhautt_nexus.growth_opinion_mention ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.growth_opinion_alert   ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.growth_copy_asset      ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.growth_geo_probe       ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.growth_campaign        ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.growth_campaign_metric ENABLE ROW LEVEL SECURITY;

ALTER TABLE rhautt_nexus.growth_opinion_mention FORCE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.growth_opinion_alert   FORCE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.growth_copy_asset      FORCE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.growth_geo_probe       FORCE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.growth_campaign        FORCE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.growth_campaign_metric FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS growth_opinion_mention_tenant_isolation ON rhautt_nexus.growth_opinion_mention;
CREATE POLICY growth_opinion_mention_tenant_isolation ON rhautt_nexus.growth_opinion_mention
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

DROP POLICY IF EXISTS growth_opinion_alert_tenant_isolation ON rhautt_nexus.growth_opinion_alert;
CREATE POLICY growth_opinion_alert_tenant_isolation ON rhautt_nexus.growth_opinion_alert
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

DROP POLICY IF EXISTS growth_copy_asset_tenant_isolation ON rhautt_nexus.growth_copy_asset;
CREATE POLICY growth_copy_asset_tenant_isolation ON rhautt_nexus.growth_copy_asset
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

DROP POLICY IF EXISTS growth_geo_probe_tenant_isolation ON rhautt_nexus.growth_geo_probe;
CREATE POLICY growth_geo_probe_tenant_isolation ON rhautt_nexus.growth_geo_probe
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

DROP POLICY IF EXISTS growth_campaign_tenant_isolation ON rhautt_nexus.growth_campaign;
CREATE POLICY growth_campaign_tenant_isolation ON rhautt_nexus.growth_campaign
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

DROP POLICY IF EXISTS growth_campaign_metric_tenant_isolation ON rhautt_nexus.growth_campaign_metric;
CREATE POLICY growth_campaign_metric_tenant_isolation ON rhautt_nexus.growth_campaign_metric
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

-- ════════════════════════════════════════════════════════════════════════
-- 后续（不在本迁移）：
--   舆情原文快照 / AI 草稿正文 / GEO 答案全文存 Mongo（growth_documents），
--   PG 仅存结构化字段 + 文档引用（与 diagnosis 同构）。
--   跨域只读（品牌运营库/DAM · 分析数仓 · ingress/crm 归因）经服务层 + outbox，
--   不在此建物理外键，保持板块解耦。
-- ════════════════════════════════════════════════════════════════════════
