-- ════════════════════════════════════════════════════════════════════════
-- Rhautt Nexus · Migration 008
-- 实体↔迁移漂移收口（见 docs/RHAUTT-NEXUS-ENTITY-MIGRATION-DRIFT-LEDGER.md）
--
-- 纯 additive：只 ADD COLUMN / CREATE TABLE，绝不改既有列语义、不动已锁定的 001。
-- 方针：迁移为准 + PIPL。实体/服务对齐迁移；当迁移确实缺合理业务列时本迁移补列。
--
-- 三类收口：
--   1. opportunities：补实体已用、001 缺失的关系/状态列
--      （dealer_id / next_action_at / lost_reason / quotation_id）。
--      注：实体属性 estimatedValue 改映射到 001 既有列 estimated_budget（无需建列）。
--   2. quotations：补实体的关系/状态/配置列
--      （lifecycle_link_id / owner_user_id / source / project /
--       system_families / econet_premium / tax_profile / quotation_lock）。
--      注：实体 items→001.bom、costBreakdown→001.cost_snapshot（既有列，仅改映射）。
--   3. file_artifacts 漂移收口：通用上传器与「工程产物治理」表 file_artifacts
--      是两套领域模型（后者列 object_key/artifact_type/content_hash NOT NULL+CHECK，
--      通用上传无法供值）。故为通用上传器单建 uploaded_files 表，
--      保持 file_artifacts 治理语义纯净；FileArtifactEntity 改指向 uploaded_files。
--      写入方（file-artifact.service）已切 withRlsTransaction → 立即 ENABLE+FORCE RLS。
-- ════════════════════════════════════════════════════════════════════════

SET search_path TO rhautt_nexus, public;

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 1. opportunities · 补关系/状态列                                       ║
-- ╚══════════════════════════════════════════════════════════════════════╝
ALTER TABLE rhautt_nexus.opportunities
  ADD COLUMN IF NOT EXISTS dealer_id      uuid REFERENCES rhautt_nexus.dealers(id),
  ADD COLUMN IF NOT EXISTS next_action_at timestamptz,
  ADD COLUMN IF NOT EXISTS lost_reason    text,
  ADD COLUMN IF NOT EXISTS quotation_id   uuid REFERENCES rhautt_nexus.quotations(id);

CREATE INDEX IF NOT EXISTS opportunities_tenant_dealer_idx
  ON rhautt_nexus.opportunities (tenant_id, dealer_id, stage, updated_at DESC);

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 2. quotations · 补关系/状态/配置列                                     ║
-- ╚══════════════════════════════════════════════════════════════════════╝
ALTER TABLE rhautt_nexus.quotations
  ADD COLUMN IF NOT EXISTS lifecycle_link_id uuid,
  ADD COLUMN IF NOT EXISTS owner_user_id     uuid REFERENCES rhautt_nexus.users(id),
  ADD COLUMN IF NOT EXISTS source            text NOT NULL DEFAULT 'designer-bom',
  ADD COLUMN IF NOT EXISTS project           jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS system_families   text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS econet_premium    jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tax_profile       jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS quotation_lock    jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS quotations_tenant_owner_idx
  ON rhautt_nexus.quotations (tenant_id, owner_user_id, status, updated_at DESC);

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 3. uploaded_files · 通用上传器表（与治理表 file_artifacts 解耦）         ║
-- ║    写入方已切 withRlsTransaction → 立即强 RLS                           ║
-- ╚══════════════════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS rhautt_nexus.uploaded_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  uploader_id uuid,
  entity_type text NOT NULL,        -- 'customer'|'opportunity'|'floor_plan'|...
  entity_id text NOT NULL,
  file_key text NOT NULL,           -- 对象存储 key
  original_name text NOT NULL,
  mime_type text,
  size_bytes bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS uploaded_files_tenant_entity_idx
  ON rhautt_nexus.uploaded_files (tenant_id, entity_type, entity_id, created_at DESC);

ALTER TABLE rhautt_nexus.uploaded_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.uploaded_files FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS uploaded_files_tenant_isolation ON rhautt_nexus.uploaded_files;
CREATE POLICY uploaded_files_tenant_isolation ON rhautt_nexus.uploaded_files
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

-- ════════════════════════════════════════════════════════════════════════
-- 收口后实体映射对照（落实于 NestJS 实体）：
--   OpportunityEntity.estimatedValue   → estimated_budget（既有列，改映射）
--   QuotationEntity.items              → bom（既有列，改映射）
--   QuotationEntity.costBreakdown      → cost_snapshot（既有列，改映射）
--   QuotationEntity.systemFamilies     → system_families text[]（本迁移建列）
--   FileArtifactEntity @Entity         → 'uploaded_files'（本迁移建表）
--   CustomerEntity.tags                → tags text[]（001 既有列，实体改 array 映射）
-- ════════════════════════════════════════════════════════════════════════
