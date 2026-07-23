-- W-BIM-0 · 批 C：标记 bim_projects 旧交付语义字段为已废弃，为后续删除做准备。
-- 本迁移不删除任何字段，只加注释，确保应用后旧端点仍可运行（兼容期）。
-- 删除字段须满足：
--   1. 双写观察期 ≥ 2 周；
--   2. 一致性校验脚本 100% 通过；
--   3. 全部旧端点调用方已迁移到 /api/v2/rysnova-bim/projects/*。

BEGIN;

COMMENT ON COLUMN rhautt_nexus.bim_projects.status IS
  '[DEPRECATED W-BIM-0] 阶段状态已迁移到 lifecycle_links.stage；保留至旧端点兼容期结束。';

COMMENT ON COLUMN rhautt_nexus.bim_projects.acceptance_checklist IS
  '[DEPRECATED W-BIM-0] 验收清单已迁移到 delivery_records.checklist.acceptanceChecklist；保留至旧端点兼容期结束。';

COMMENT ON COLUMN rhautt_nexus.bim_projects.accepted_at IS
  '[DEPRECATED W-BIM-0] 客户签收时间已迁移到 lifecycle_links.accepted_at；保留至旧端点兼容期结束。';

COMMENT ON COLUMN rhautt_nexus.bim_projects.accepted_by IS
  '[DEPRECATED W-BIM-0] 客户签收人已迁移到 delivery_records.checklist.customerAcceptance；保留至旧端点兼容期结束。';

COMMENT ON COLUMN rhautt_nexus.bim_projects.paid_value IS
  '[DEPRECATED W-BIM-0] 回款金额归属财务/合同域；BIM 项目只读展示，禁止写入。';

COMMENT ON COLUMN rhautt_nexus.bim_projects.assigned_to IS
  '[DEPRECATED W-BIM-0] 项目指派已迁移到 lifecycle_links；保留至旧端点兼容期结束。';

COMMENT ON COLUMN rhautt_nexus.bim_projects.drawing_url IS
  '[DEPRECATED W-BIM-0] 出图产物已迁移为 file-artifact 关联；保留至旧端点兼容期结束。';

COMMIT;
