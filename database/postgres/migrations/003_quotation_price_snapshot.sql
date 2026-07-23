-- ════════════════════════════════════════════════════════════════════════
-- Rhautt Nexus · Migration 003
-- M11 · 报价价格快照锁定（PRD 4.9）落位：quotations 增列 price_snapshot / quotation_lock
-- quotations 表已在 001 建表并启用 FORCE RLS + tenant_isolation，无需重复加固。
-- ════════════════════════════════════════════════════════════════════════

SET search_path TO rhautt_nexus, public;

ALTER TABLE rhautt_nexus.quotations
  ADD COLUMN IF NOT EXISTS price_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE rhautt_nexus.quotations
  ADD COLUMN IF NOT EXISTS quotation_lock jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 便于查询已锁报价（如品牌库改价时排除已锁报价）
CREATE INDEX IF NOT EXISTS quotations_lock_idx
  ON rhautt_nexus.quotations ((quotation_lock->>'locked'));
