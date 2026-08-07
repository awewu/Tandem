-- 076 · RBAC 授权范围 scope（能力 × 范围 权限模型地基）
-- AI GTM Nexus Phase 0：角色/能力已存在（052），本迁移补"范围"维度——
-- 用户-角色授权可 scope 到 集团(group) 或 事业部(business_unit：按 品牌/品类)。
-- 驱动：事业部驾驶舱切片、CMO/BU 分层、数据按 brand/category 维度可见。
-- 幂等；不新建表（rbac_user_roles 已 FORCE RLS，沿用其租户隔离策略）。

ALTER TABLE rhautt_nexus.rbac_user_roles
  ADD COLUMN IF NOT EXISTS scope_type text NOT NULL DEFAULT 'group',
  ADD COLUMN IF NOT EXISTS scope_dimension text,
  ADD COLUMN IF NOT EXISTS scope_ref text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rbac_user_roles_scope_type_chk'
  ) THEN
    ALTER TABLE rhautt_nexus.rbac_user_roles
      ADD CONSTRAINT rbac_user_roles_scope_type_chk
      CHECK (scope_type IN ('group', 'business_unit'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rbac_user_roles_scope_dimension_chk'
  ) THEN
    ALTER TABLE rhautt_nexus.rbac_user_roles
      ADD CONSTRAINT rbac_user_roles_scope_dimension_chk
      CHECK (scope_dimension IS NULL OR scope_dimension IN ('brand', 'category'));
  END IF;
  -- business_unit 必须带 维度 + 引用；group 不得带。
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rbac_user_roles_scope_shape_chk'
  ) THEN
    ALTER TABLE rhautt_nexus.rbac_user_roles
      ADD CONSTRAINT rbac_user_roles_scope_shape_chk
      CHECK (
        (scope_type = 'group' AND scope_dimension IS NULL AND scope_ref IS NULL)
        OR (scope_type = 'business_unit' AND scope_dimension IS NOT NULL AND scope_ref IS NOT NULL)
      );
  END IF;
END $$;

COMMENT ON COLUMN rhautt_nexus.rbac_user_roles.scope_type IS 'group=集团 | business_unit=事业部';
COMMENT ON COLUMN rhautt_nexus.rbac_user_roles.scope_dimension IS '事业部维度：brand=品牌事业部 | category=品类事业部';
COMMENT ON COLUMN rhautt_nexus.rbac_user_roles.scope_ref IS '事业部引用：品牌 code / 品类 id';
