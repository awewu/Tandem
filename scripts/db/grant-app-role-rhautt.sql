-- grant-app-role-rhautt.sql
-- 修复本地环境既有缺口：rhautt_nexus schema 下的表由超管（迁移应用者）拥有，
-- 但应用角色 rhautt（.env POSTGRES_URI 连接用户）从未被授权 → 运行时 42501 permission denied。
--
-- 本脚本以超管执行，把 schema/表/序列的读写权限授予 rhautt，并设默认权限（未来迁移建的表自动授权）。
-- RLS 仍然生效：rhautt 非表 owner、非超管，FORCE RLS 下受 tenant_id = current_tenant_id() 隔离。
-- 幂等：GRANT/ALTER DEFAULT PRIVILEGES 可重复执行。

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rhautt') THEN
    RAISE NOTICE 'role rhautt does not exist; skipping';
    RETURN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA rhautt_nexus TO rhautt;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA rhautt_nexus TO rhautt;

GRANT USAGE, SELECT
  ON ALL SEQUENCES IN SCHEMA rhautt_nexus TO rhautt;

GRANT EXECUTE
  ON ALL FUNCTIONS IN SCHEMA rhautt_nexus TO rhautt;

-- 未来（以当前超管身份）新建的对象，自动授予 rhautt。
ALTER DEFAULT PRIVILEGES IN SCHEMA rhautt_nexus
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO rhautt;
ALTER DEFAULT PRIVILEGES IN SCHEMA rhautt_nexus
  GRANT USAGE, SELECT ON SEQUENCES TO rhautt;
ALTER DEFAULT PRIVILEGES IN SCHEMA rhautt_nexus
  GRANT EXECUTE ON FUNCTIONS TO rhautt;
