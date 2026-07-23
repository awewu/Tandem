-- 036 · 项目主线（Project Spine）· P0 加列（additive、nullable、幂等）
-- ---------------------------------------------------------------------------
-- 背景与决策见 docs/PROJECT-SPINE-DATA-MODEL-DESIGN.md（评审冻结：方案 A）。
--
-- 原则：一个签单项目 = 一套数据流转；项目业务唯一键 = 手机号 + 项目地址。
--   · 客户身份(Customer) = 手机号（customers 已 UNIQUE(tenant, phone_hash)）
--   · 项目身份(Project)  = 手机号 + 项目地址（Customer 1:N Project）
--
-- 方案 A：扶正 lifecycle_links 为规范化 Project 主线。本迁移为 P0——
--   ① lifecycle_links 补 phone_hash / address_normalized（可空，回填后 P2 加唯一约束）
--   ② 各阶段表补 project_id（可空外键锚点，回填后 P2 收紧 NOT NULL）
-- 全部 additive/nullable，旧代码零影响；不含唯一约束与 NOT NULL（留 P2）。
-- ---------------------------------------------------------------------------

-- ① 项目主线载体：lifecycle_links 补业务唯一键组成（可空）
ALTER TABLE rhautt_nexus.lifecycle_links
  ADD COLUMN IF NOT EXISTS phone_hash          text,
  ADD COLUMN IF NOT EXISTS address_normalized  text;

-- 便于 P1 回填按 (tenant, phone_hash, address_normalized) 探测重复/塌缩行。
-- 非唯一索引（唯一约束留 P2，回填干净后再加）。
CREATE INDEX IF NOT EXISTS lifecycle_links_tenant_phone_addr_idx
  ON rhautt_nexus.lifecycle_links (tenant_id, phone_hash, address_normalized);

-- ② 各阶段表补 project_id 锚点（可空外键；不加 FK 约束以免回填期阻塞，P2 视情况补）
ALTER TABLE rhautt_nexus.opportunities      ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE rhautt_nexus.quotations         ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE rhautt_nexus.contracts          ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE rhautt_nexus.delivery_projects  ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE rhautt_nexus.bim_projects       ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE rhautt_nexus.service_tickets    ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE rhautt_nexus.warranties         ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE rhautt_nexus.diagnosis_sessions ADD COLUMN IF NOT EXISTS project_id uuid;

-- project_id 查询索引（各阶段按主线聚合）
CREATE INDEX IF NOT EXISTS opportunities_tenant_project_idx      ON rhautt_nexus.opportunities      (tenant_id, project_id);
CREATE INDEX IF NOT EXISTS quotations_tenant_project_idx         ON rhautt_nexus.quotations         (tenant_id, project_id);
CREATE INDEX IF NOT EXISTS contracts_tenant_project_idx          ON rhautt_nexus.contracts          (tenant_id, project_id);
CREATE INDEX IF NOT EXISTS delivery_projects_tenant_project_idx  ON rhautt_nexus.delivery_projects  (tenant_id, project_id);
CREATE INDEX IF NOT EXISTS bim_projects_tenant_project_idx       ON rhautt_nexus.bim_projects       (tenant_id, project_id);
CREATE INDEX IF NOT EXISTS service_tickets_tenant_project_idx    ON rhautt_nexus.service_tickets    (tenant_id, project_id);
CREATE INDEX IF NOT EXISTS warranties_tenant_project_idx         ON rhautt_nexus.warranties         (tenant_id, project_id);
CREATE INDEX IF NOT EXISTS diagnosis_sessions_tenant_project_idx ON rhautt_nexus.diagnosis_sessions (tenant_id, project_id);
