-- W-BIM-0 · 批 B：lifecycle_links 增加 assigned_to 字段，承接原 bim_projects.assigned_to 指派语义。
-- 使 BIM 项目指派负责人时可同步写入 lifecycle 域。

BEGIN;

ALTER TABLE rhautt_nexus.lifecycle_links
  ADD COLUMN IF NOT EXISTS assigned_to varchar(64) NULL;

COMMENT ON COLUMN rhautt_nexus.lifecycle_links.assigned_to IS
  'W-BIM-0：BIM 项目指派负责人同步写入；lifecycle 域作为人员归属真相源。';

COMMIT;
