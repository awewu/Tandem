CREATE TABLE IF NOT EXISTS "RoleDefinition" (
  "key" text NOT NULL,
  "name" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "kind" text DEFAULT 'internal' NOT NULL,
  "permissions" text[] DEFAULT '{}'::text[] NOT NULL,
  "system" boolean DEFAULT false NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "sortOrder" integer DEFAULT 0 NOT NULL,
  "tenantId" text DEFAULT 'default' NOT NULL,
  "createdAt" timestamp(3) DEFAULT now() NOT NULL,
  "updatedAt" timestamp(3) DEFAULT now() NOT NULL,
  CONSTRAINT "RoleDefinition_tenantId_key_pk" PRIMARY KEY("tenantId", "key"),
  CONSTRAINT "RoleDefinition_kind_check" CHECK ("kind" IN ('internal', 'external'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "RoleDefinition_tenant_enabled_idx" ON "RoleDefinition" USING btree ("tenantId", "enabled");
--> statement-breakpoint
INSERT INTO "RoleDefinition" ("key", "name", "description", "kind", "permissions", "system", "enabled", "sortOrder", "tenantId")
SELECT seed."key", seed."name", seed."description", seed."kind", seed."permissions", seed."system", true, seed."sortOrder", tenants."tenantId"
FROM (
  SELECT DISTINCT "tenantId" FROM "User"
  UNION SELECT 'default'
) tenants
CROSS JOIN (VALUES
  ('owner', '公司主', '公司最高权限，不能停用或移除', 'internal', ARRAY['roles.manage','organization.manage','users.manage','intranet.manage','launchpad.manage','kpi.manage','governance.manage','learning.manage']::text[], true, 0),
  ('admin', '系统管理员', '系统、人员和业务后台管理', 'internal', ARRAY['roles.manage','organization.manage','users.manage','intranet.manage','launchpad.manage','kpi.manage','governance.manage','learning.manage']::text[], true, 10),
  ('champion', '推广大使', '推广与跨部门业务运营', 'internal', ARRAY['organization.manage','users.manage','intranet.manage','launchpad.manage','kpi.manage','governance.manage','learning.manage']::text[], true, 20),
  ('intranet_editor', '内网内容编辑', '仅维护企业内网内容', 'internal', ARRAY['intranet.manage']::text[], false, 30),
  ('steward', 'HR / 管家', '组织数据与治理审核', 'internal', ARRAY['organization.manage','users.manage','intranet.manage','kpi.manage','governance.manage','learning.manage']::text[], true, 40),
  ('manager', '主管', '团队管理与业务审批', 'internal', ARRAY[]::text[], true, 50),
  ('employee', '员工', '普通内部员工', 'internal', ARRAY[]::text[], true, 60),
  ('finance', '财务', '财务口径数据维护', 'internal', ARRAY['kpi.manage']::text[], false, 70),
  ('internal_staff', '内勤', '内部运营数据维护', 'internal', ARRAY[]::text[], false, 80),
  ('guest', '访客', '短期外部访客', 'external', ARRAY[]::text[], true, 90),
  ('partner', '合作伙伴', '长期合作伙伴', 'external', ARRAY[]::text[], true, 100),
  ('contractor', '承包商', '项目承包方', 'external', ARRAY[]::text[], true, 110)
) AS seed("key", "name", "description", "kind", "permissions", "system", "sortOrder")
ON CONFLICT ("tenantId", "key") DO NOTHING;
