-- ════════════════════════════════════════════════════════════════════════
-- Rhautt Nexus · Migration 002
-- 落位新模块表：M14 合规(pipl_consents) · M12 真相源(design_rysnova_bim_sync)
--               M15 主数据(mdm_global_products) + 跨板块事件(mdm_outbox_events)
-- 与 001 同规范：schema rhautt_nexus · current_tenant_id() · ENABLE+FORCE RLS · tenant_isolation policy
-- 数据平面落位：
--   pipl_consents / design_rysnova_bim_sync → ② 赋能体系库（租户隔离，强 RLS）
--   mdm_global_products / mdm_outbox_events → ① 底座主库（跨板块；foundation 行 tenant_id 为 NULL）
-- 注意：mdm_outbox_events 与既有 rhautt_nexus.outbox_events 存在 outbox 概念重叠，
--       待架构裁定是否合并（见 FEATURE-AND-GAP-LEDGER 开口项）。
-- ════════════════════════════════════════════════════════════════════════

SET search_path TO rhautt_nexus, public;

-- ── M14 · PIPL 同意记录（租户隔离） ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS rhautt_nexus.pipl_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  subject_id text NOT NULL,
  subject_type text NOT NULL DEFAULT 'consumer',
  purpose text NOT NULL,
  policy_version text NOT NULL,
  granted boolean NOT NULL DEFAULT true,
  channel text NOT NULL DEFAULT 'web',
  ip_hash text,
  user_agent text,
  granted_at timestamptz,
  withdrawn_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pipl_consents_subject_idx ON rhautt_nexus.pipl_consents (tenant_id, subject_id, purpose);
CREATE INDEX IF NOT EXISTS pipl_consents_purpose_idx ON rhautt_nexus.pipl_consents (tenant_id, purpose, granted);

-- ── M12 · design↔Rysnova 单一真相源同步账本（租户隔离） ─────────────────
CREATE TABLE IF NOT EXISTS rhautt_nexus.design_rysnova_bim_sync (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  design_id uuid NOT NULL,
  design_version text NOT NULL,
  artifact_id uuid,
  artifact_version text,
  sync_state text NOT NULL DEFAULT 'in_sync' CHECK (sync_state IN ('in_sync','stale','proposed_change')),
  change_proposal jsonb,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS design_sync_design_idx ON rhautt_nexus.design_rysnova_bim_sync (tenant_id, design_id);
CREATE INDEX IF NOT EXISTS design_sync_artifact_idx ON rhautt_nexus.design_rysnova_bim_sync (tenant_id, artifact_id);
CREATE INDEX IF NOT EXISTS design_sync_state_idx ON rhautt_nexus.design_rysnova_bim_sync (tenant_id, sync_state);

-- ── M15 · 全局产品主数据（底座；foundation 行 tenant_id 为 NULL，tenant-private 行受 RLS） ──
CREATE TABLE IF NOT EXISTS rhautt_nexus.mdm_global_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  global_product_id text NOT NULL UNIQUE,
  tenant_id uuid REFERENCES rhautt_nexus.tenants(id),
  source_tier text NOT NULL CHECK (source_tier IN ('owned','shared','tenant-private')),
  brand_slug text,
  sku text NOT NULL,
  name text NOT NULL,
  data_trust_level text NOT NULL DEFAULT 'unverified' CHECK (data_trust_level IN ('verified','calibrated','unverified')),
  canonical_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_version integer NOT NULL DEFAULT 1,
  synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_tier, brand_slug, sku)
);

-- ── M15 · 跨板块事件总线 outbox（底座；tenant_id 可空） ───────────────────
CREATE TABLE IF NOT EXISTS rhautt_nexus.mdm_outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES rhautt_nexus.tenants(id),
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered','dead')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz
);
CREATE INDEX IF NOT EXISTS mdm_outbox_status_idx ON rhautt_nexus.mdm_outbox_events (status, created_at);
CREATE INDEX IF NOT EXISTS mdm_outbox_aggregate_idx ON rhautt_nexus.mdm_outbox_events (aggregate_type, aggregate_id);

-- ── RLS 加固 ─────────────────────────────────────────────────────────────
-- 租户隔离表：强 RLS + tenant_isolation
ALTER TABLE rhautt_nexus.pipl_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.design_rysnova_bim_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.pipl_consents FORCE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.design_rysnova_bim_sync FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pipl_consents_tenant_isolation ON rhautt_nexus.pipl_consents;
CREATE POLICY pipl_consents_tenant_isolation ON rhautt_nexus.pipl_consents
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

DROP POLICY IF EXISTS design_sync_tenant_isolation ON rhautt_nexus.design_rysnova_bim_sync;
CREATE POLICY design_sync_tenant_isolation ON rhautt_nexus.design_rysnova_bim_sync
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

-- 底座/跨板块表：foundation 行（tenant_id IS NULL）全租户可读；tenant-private 行按租户隔离
ALTER TABLE rhautt_nexus.mdm_global_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.mdm_outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.mdm_global_products FORCE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.mdm_outbox_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mdm_global_products_scope ON rhautt_nexus.mdm_global_products;
CREATE POLICY mdm_global_products_scope ON rhautt_nexus.mdm_global_products
  USING (tenant_id IS NULL OR tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id IS NULL OR tenant_id = rhautt_nexus.current_tenant_id());

DROP POLICY IF EXISTS mdm_outbox_events_scope ON rhautt_nexus.mdm_outbox_events;
CREATE POLICY mdm_outbox_events_scope ON rhautt_nexus.mdm_outbox_events
  USING (tenant_id IS NULL OR tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id IS NULL OR tenant_id = rhautt_nexus.current_tenant_id());
