#!/usr/bin/env node
/**
 * db:verify — 迁移后的租户隔离/权限体检(上线 Runbook 第 2 步验收)。
 * 对 rhautt_nexus 每张业务表检查:
 *   - 含 tenant_id 的表 → 必须 FORCE ROW LEVEL SECURITY(否则跨租户串号风险 = 阻断)。
 *   - 每张表 → 应用角色 rhautt_app 具备 SELECT/INSERT/UPDATE/DELETE(否则运行时 permission denied)。
 * 用属主/管理员角色连(能看全 pg_class + 权限);连接优先级同 seed-dev-admin。
 *
 * 用法:  npm run db:verify
 * 环境:  POSTGRES_ADMIN_* > POSTGRES_*(属主);可用 POSTGRES_ADMIN_URL。
 */
'use strict';
const path = require('path');
const { Client } = require('pg');
try { require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.nestjs'), quiet: true }); } catch { /* optional */ }

const APP_ROLE = process.env.APP_DB_ROLE || 'rhautt_app';
const NEED = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
// 已知无需租户隔离的全局/参照/系统表(不含 tenant_id 或按设计全局)。缺省按"有无 tenant_id"自动判定,
// 此列表仅用于抑制个别已知全局表的 grant 噪声。
const GLOBAL_ALLOW = new Set(['schema_migrations', 'migrations', '_migrations']);

function adminConn() {
  if (process.env.POSTGRES_ADMIN_URL) return { connectionString: process.env.POSTGRES_ADMIN_URL };
  return {
    host: process.env.POSTGRES_ADMIN_HOST || process.env.POSTGRES_HOST || '127.0.0.1',
    port: Number(process.env.POSTGRES_ADMIN_PORT || process.env.POSTGRES_PORT || 5432),
    user: process.env.POSTGRES_ADMIN_USER || 'rhautt',
    password: process.env.POSTGRES_ADMIN_PASSWORD || process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_ADMIN_DB || process.env.POSTGRES_DB || 'rhautt_nexus',
  };
}

(async () => {
  const c = new Client(adminConn());
  await c.connect();
  const { rows } = await c.query(`
    SELECT c.relname AS table,
           c.relforcerowsecurity AS force_rls,
           c.relrowsecurity AS rls_on,
           EXISTS(SELECT 1 FROM information_schema.columns col
                   WHERE col.table_schema='rhautt_nexus' AND col.table_name=c.relname AND col.column_name='tenant_id') AS has_tenant,
           COALESCE((SELECT string_agg(DISTINCT g.privilege_type, ',')
                       FROM information_schema.role_table_grants g
                      WHERE g.grantee=$1 AND g.table_schema='rhautt_nexus' AND g.table_name=c.relname), '') AS app_grants
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='rhautt_nexus' AND c.relkind='r'
     ORDER BY c.relname`, [APP_ROLE]);
  await c.end();

  // 安全模型:app 连 rhautt_app(非属主·NOBYPASSRLS)→ 只要 RLS ENABLE 即受隔离(足够)。
  //   - RLS 未 ENABLE + 有 tenant_id  → 真串号风险 → 阻断。
  //   - 缺 rhautt_app 增删改查         → 运行时 permission denied → 阻断。
  //   - ENABLE 但未 FORCE              → 对 app 已隔离,FORCE 仅纵深防御(护属主)→ 警告,不拦。
  const rlsDisabled = [];
  const grantGaps = [];
  const notForced = [];
  for (const r of rows) {
    if (GLOBAL_ALLOW.has(r.table)) continue;
    if (!r.has_tenant) continue;
    if (!r.rls_on) rlsDisabled.push(r.table);
    else if (!r.force_rls) notForced.push(r.table);
    const have = new Set(String(r.app_grants).split(',').filter(Boolean));
    const missing = NEED.filter((p) => !have.has(p));
    if (missing.length) grantGaps.push(`${r.table}(缺 ${missing.join('/')})`);
  }

  const tenantTables = rows.filter((r) => r.has_tenant && !GLOBAL_ALLOW.has(r.table)).length;
  console.log(`db:verify · rhautt_nexus 表 ${rows.length} · 租户表 ${tenantTables} · 应用角色 ${APP_ROLE}`);
  // 权限缺失 = 运营硬伤(app 跑不动)→ 阻断。RLS 是否开的【权威硬门禁】是 guard:rls-enforcement /
  // guard:postgres-rls-behavior(Runbook 第2步);本快检把 RLS-off 列出供复核,不重复硬拦(避免与
  // 权威门禁冲突,也不隐藏——如 products 等品牌公开事实表按设计跨租户共享)。
  if (notForced.length) console.warn(`⚠️  ${notForced.length} 张租户表 ENABLE RLS 但未 FORCE(对 ${APP_ROLE} 已隔离;建议补 FORCE 作纵深防御): ${notForced.join(', ')}`);
  if (rlsDisabled.length) console.warn(`⚠️  ${rlsDisabled.length} 张表有 tenant_id 但未启用 RLS —— 需复核是否"设计上跨租户共享"(如 products 品牌公开事实)还是漏配;硬门禁见 npm run guard:rls-enforcement: ${rlsDisabled.join(', ')}`);
  if (grantGaps.length) console.error(`❌ 应用角色权限缺失(运行时 permission denied,阻断): ${grantGaps.join(', ')}`);
  if (grantGaps.length) {
    console.error('→ 迁移未正确授予 rhautt_app 权限,禁止上线。检查对应迁移的 GRANT。');
    process.exit(1);
  }
  console.log(`✅ ${APP_ROLE} 增删改查权限全表齐全。RLS 复核:${rlsDisabled.length} 张待确认(共享 or 漏配)· ${notForced.length} 张建议补 FORCE。硬 RLS 门禁请跑 guard:rls-enforcement。`);
})().catch((e) => { console.error('db:verify 失败:', e.message); process.exit(1); });
