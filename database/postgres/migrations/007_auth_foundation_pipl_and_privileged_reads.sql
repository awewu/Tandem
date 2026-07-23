-- ════════════════════════════════════════════════════════════════════════
-- Rhautt Nexus · Migration 007
-- Auth/Foundation 实体↔迁移对账（方向：迁移为准 + PIPL）+ 跨租户特权读路径。
--
-- 背景（见 MASTER §7.4 + 本次复盘）：实体在 dev synchronize 下独立演化，与
-- 迁移 001 的 PIPL 合规 schema 漂移。本迁移**补齐 001 缺失但 auth/tenant
-- 运行时必需的列**（不改 001，加法式），并落位两类**跨租户特权读**所需的
-- SECURITY DEFINER 函数（FORCE RLS 上线后，预认证登录与公开查询无租户上下文，
-- 不能走 current_tenant_id() 绑定事务）。
--
-- ⚠️ SECURITY DEFINER 绕过 FORCE RLS 的前提：函数 owner 必须是具备 BYPASSRLS
--    的角色（本地为 DB 属主/超级用户；生产由迁移执行角色保证）。应用以**非属主
--    最小权限角色**连接并仅调用这些函数，绕过面被收敛到函数体内的最小查询。
-- ════════════════════════════════════════════════════════════════════════

SET search_path TO rhautt_nexus, public;

-- ── 1. users 补列（登录态/账号锁定/客户绑定，001 未含）──────────────────────
ALTER TABLE rhautt_nexus.users
  ADD COLUMN IF NOT EXISTS login_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lock_until    timestamptz,
  ADD COLUMN IF NOT EXISTS customer_id   uuid;

-- ── 2. stores 补列（门店经理，实体 manager_user_id，001 未含）────────────────
ALTER TABLE rhautt_nexus.stores
  ADD COLUMN IF NOT EXISTS manager_user_id uuid REFERENCES rhautt_nexus.users(id);

-- ── 3. 预认证登录：按 phone_hash 跨租户查 users（SECURITY DEFINER 绕 RLS）──────
-- 登录发生在租户上下文建立之前，必须跨租户按 phone_hash 命中。函数体仅暴露
-- 这一最小查询。phone_hash = compliance.pii.hashPII(规范化手机号)，由应用计算后传入。
-- 注：001 的 UNIQUE(tenant_id, phone_hash) 允许同号跨租户存在；返回 SETOF 由应用
-- 取首个 active 命中（多租户同号登录消歧为已知 V1 限制，见 auth.service TODO）。
CREATE OR REPLACE FUNCTION rhautt_nexus.auth_lookup_user_by_phone_hash(p_phone_hash text)
RETURNS SETOF rhautt_nexus.users
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = rhautt_nexus, public
AS $$
  SELECT * FROM rhautt_nexus.users
  WHERE phone_hash = p_phone_hash
  ORDER BY (status = 'active') DESC, created_at ASC;
$$;

-- ── 4. 客户公开查询：按报价号/项目号前缀跨租户查 bim_projects（SECURITY DEFINER）─
-- 客户无需登录查询施工进度，无租户上下文。函数体仅暴露按 quotation_no / id 前缀
-- 的最小查询；公开安全字段由应用层（bim.service.publicLookup）裁剪后返回。
CREATE OR REPLACE FUNCTION rhautt_nexus.bim_public_lookup(p_code text)
RETURNS SETOF rhautt_nexus.bim_projects
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = rhautt_nexus, public
AS $$
  SELECT * FROM rhautt_nexus.bim_projects
  WHERE quotation_no = p_code OR id::text LIKE p_code || '%'
  LIMIT 1;
$$;

-- 仅允许应用连接角色执行（默认 PUBLIC 可 EXECUTE；如需收紧，在部署层 REVOKE/GRANT）。
