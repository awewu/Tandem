-- 071 · 应用专用角色（让 RLS 真正生效）· P0 安全
-- ---------------------------------------------------------------------------
-- 问题：应用此前以 DB 超级用户（rhautt）连接。PostgreSQL 超级用户 **完全绕过 RLS**
--       （BYPASSRLS），故 77 条 tenant_isolation policy + FORCE ROW LEVEL SECURITY
--       在该连接下零强制力——租户隔离仅剩应用层显式过滤，一处漏写 tenantId 即跨租户泄露。
--
-- 修法：建专用应用角色 rhautt_app（NOSUPERUSER + NOBYPASSRLS），授予业务读写所需权限；
--       应用改用该角色连接，超级用户仅保留给迁移/运维。RLS 从此成为真正的兜底。
--
-- 口令：**不写进迁移**（避免密钥入库/入 VCS）。由运维执行
--       `node scripts/db/setup-app-role.js`（读 APP_DB_PASSWORD）设置。
-- 幂等：角色/授权均 IF NOT EXISTS 或可重复执行。
-- ---------------------------------------------------------------------------
SET search_path TO rhautt_nexus, public;

-- ① 应用角色（无超级用户、不绕过 RLS、不建库建角色）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rhautt_app') THEN
    CREATE ROLE rhautt_app LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
    RAISE NOTICE '已创建应用角色 rhautt_app（需运维设置口令：scripts/db/setup-app-role.js）';
  ELSE
    -- 防御：确保既有角色不具备绕过 RLS 的能力
    ALTER ROLE rhautt_app NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END $$;

-- ② schema 使用权
GRANT USAGE ON SCHEMA rhautt_nexus TO rhautt_app;
GRANT USAGE ON SCHEMA public TO rhautt_app;

-- ③ 业务读写（RLS 在此之上按 policy 逐行过滤）
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA rhautt_nexus TO rhautt_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO rhautt_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA rhautt_nexus TO rhautt_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO rhautt_app;
-- 函数：含 current_tenant_id() 与 SECURITY DEFINER 的预认证查询函数
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA rhautt_nexus TO rhautt_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO rhautt_app;

-- ④ 未来迁移新建的对象自动授权（迁移以 rhautt 执行，故按该角色设默认权限）
ALTER DEFAULT PRIVILEGES FOR ROLE rhautt IN SCHEMA rhautt_nexus
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO rhautt_app;
ALTER DEFAULT PRIVILEGES FOR ROLE rhautt IN SCHEMA rhautt_nexus
  GRANT USAGE, SELECT ON SEQUENCES TO rhautt_app;
ALTER DEFAULT PRIVILEGES FOR ROLE rhautt IN SCHEMA rhautt_nexus
  GRANT EXECUTE ON FUNCTIONS TO rhautt_app;

DO $$
DECLARE bypass boolean;
BEGIN
  SELECT rolbypassrls INTO bypass FROM pg_roles WHERE rolname='rhautt_app';
  IF bypass THEN
    RAISE EXCEPTION 'rhautt_app 仍可绕过 RLS —— 迁移失败保护';
  END IF;
  RAISE NOTICE 'rhautt_app 已就位：NOBYPASSRLS，RLS 将对应用连接强制生效';
END $$;
