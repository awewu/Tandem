-- ════════════════════════════════════════════════════════════════════════
-- Rhautt Nexus · Migration 016
-- uploaded_files · dealer/store 归属列（IDOR 收口）
--
-- 背景：uploaded_files（008 建）仅 tenant 级 RLS，无 dealer/store 列。其父实体
--   是多态的（entity_type/entity_id 指向 customer/opportunity/floor_plan/…），
--   无法在读写路径做统一 join 归属校验。故按既有做法「写时 denormalize 归属」：
--   上传时由 file-artifact.service 从 JWT stamp dealer_id/store_id，
--   读/删按 dealer 级收敛，防同租户跨经销商 IDOR。
--
-- 过渡兼容：既有行（008 起）与 HQ/ops 上传的 dealer_id 为 NULL。应用层过滤采用
--   「dealer_id = 调用方经销商 OR dealer_id IS NULL」的宽松式，不隐藏旧/共享记录；
--   新上传一律 stamp，隔离随时间增强。故此列可空，无回填。
--
-- 纯 additive · 幂等（ADD COLUMN IF NOT EXISTS），不改既有列语义、不动 RLS 策略。
-- ════════════════════════════════════════════════════════════════════════

SET search_path TO rhautt_nexus, public;

DO $$
BEGIN
  IF to_regclass('rhautt_nexus.uploaded_files') IS NOT NULL THEN
    ALTER TABLE rhautt_nexus.uploaded_files
      ADD COLUMN IF NOT EXISTS dealer_id varchar,
      ADD COLUMN IF NOT EXISTS store_id  varchar;

    CREATE INDEX IF NOT EXISTS uploaded_files_tenant_dealer_idx
      ON rhautt_nexus.uploaded_files (tenant_id, dealer_id, entity_type, entity_id);

    RAISE NOTICE 'Migration 016: uploaded_files.dealer_id/store_id ensured';
  ELSE
    RAISE NOTICE 'rhautt_nexus.uploaded_files absent — skip 016';
  END IF;
END $$;
