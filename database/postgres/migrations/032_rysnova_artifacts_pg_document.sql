-- MongoDB 下线 · rysnova-bim artifacts 迁至 PostgreSQL。
-- 旧实现（server/modules/rysnova-bim）经 Mongoose RysnovaArtifact 持久化，tenantId 为 ObjectId，
-- 与 Postgres 身份基座的 UUID 租户不兼容（登录切换到 NestJS/Postgres 后 500）。
-- 本迁移为 rysnova_bim_artifacts 增加：
--   artifact_doc  jsonb —— 完整归一化后的产物文档（保留 version/objectKey/contentHash/standards/
--                          permissions/metadata/source/moduleContext 等全部字段，整体往返）。
--   project_key   text  —— 供按字符串 projectId 查询（Mongo 模型中 projectId 为 String，
--                          而既有 project_id 列为 uuid，二者并存以兼容非 UUID 项目号）。
-- 既有列（tenant_id/dealer_id/project_id/customer_id/artifact_type/name/file_key/bim_data/status）
-- 继续作为可索引标量投影；RLS（tenant_isolation，见 004）对新列同样生效。

BEGIN;

ALTER TABLE rhautt_nexus.rysnova_bim_artifacts
  ADD COLUMN IF NOT EXISTS artifact_doc jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS project_key text;

CREATE INDEX IF NOT EXISTS idx_rysnova_artifacts_tenant_project_key
  ON rhautt_nexus.rysnova_bim_artifacts (tenant_id, project_key);

COMMENT ON COLUMN rhautt_nexus.rysnova_bim_artifacts.artifact_doc IS
  'MongoDB 下线：完整 Rysnova 产物文档（整体 jsonb 往返，保留全部领域字段）。';
COMMENT ON COLUMN rhautt_nexus.rysnova_bim_artifacts.project_key IS
  'MongoDB 下线：字符串 projectId 查询键（兼容非 UUID 项目号）。';

COMMIT;
