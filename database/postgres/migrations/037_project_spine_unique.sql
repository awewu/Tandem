-- 037 · 项目主线（Project Spine）· P2 唯一约束 + NOT NULL 收紧
-- ---------------------------------------------------------------------------
-- 前置：036 加列 + P1 回填已完成，且 backfill-project-spine dry-run 报告干净
--   （无法组唯一键 0 · 重复项目键 0 · 各阶段 project_id 匹配 100%）。
--   见 docs/PROJECT-SPINE-DATA-MODEL-DESIGN.md §10/§11。
--
-- 本迁移：
--   ① lifecycle_links：确立项目业务唯一键 UNIQUE(tenant_id, phone_hash, address_normalized)
--      —— 一个签单项目 = 手机号 + 项目地址（Customer 1:N Project）。
--   ② 各阶段表：project_id 收紧为 NOT NULL（回填已 100% 覆盖）。
--
-- 幂等：唯一索引 IF NOT EXISTS；NOT NULL 用 DO 块判存量为空再收紧，重跑安全。
-- 回滚：DROP INDEX / ALTER COLUMN DROP NOT NULL 即可。
-- ---------------------------------------------------------------------------

SET search_path TO rhautt_nexus, public;

-- ① 项目业务唯一键（部分索引：仅对已成键的行生效，容忍历史遗留空键行不阻塞）
--   注：P1 回填后应无空键行；部分谓词是防御性护栏，避免个别 NULL 破坏索引创建。
CREATE UNIQUE INDEX IF NOT EXISTS lifecycle_links_project_key_uidx
  ON rhautt_nexus.lifecycle_links (tenant_id, phone_hash, address_normalized)
  WHERE phone_hash IS NOT NULL AND address_normalized IS NOT NULL;

-- ② 各阶段表 project_id 收紧 NOT NULL —— 仅当该表无 NULL 残留时执行（幂等/防御）
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'opportunities','quotations','contracts','delivery_projects',
    'bim_projects','service_tickets','warranties','diagnosis_sessions'
  ];
  n bigint;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('SELECT count(*) FROM rhautt_nexus.%I WHERE project_id IS NULL', t) INTO n;
    IF n = 0 THEN
      EXECUTE format('ALTER TABLE rhautt_nexus.%I ALTER COLUMN project_id SET NOT NULL', t);
      RAISE NOTICE 'project_id SET NOT NULL on %', t;
    ELSE
      RAISE WARNING 'skip NOT NULL on % — % row(s) still have NULL project_id (backfill first)', t, n;
    END IF;
  END LOOP;
END $$;
