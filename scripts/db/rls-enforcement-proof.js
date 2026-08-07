#!/usr/bin/env node
/**
 * rls-enforcement-proof.js — 证明 RLS 对应用连接**真正生效**。
 *
 * 背景：超级用户完全绕过 RLS。迁移 071 引入 NOBYPASSRLS 的 rhautt_app 后，
 * 本脚本以应用角色连接，验证三种上下文下的可见性：
 *   A) 未设 app.tenant_id      → 应为 0 行（RLS 拦截）
 *   B) 设为其他/不存在的租户   → 应为 0 行（跨租户隔离）
 *   C) 设为本租户              → 应 > 0 行（正常业务可读）
 * 任一断言不成立即退出码 1。
 *
 * 用法：
 *   APP_DB_USER=rhautt_app APP_DB_PASSWORD=... node scripts/db/rls-enforcement-proof.js
 *   （连接主机/端口/库沿用 .env.nestjs）
 */
require('dotenv').config({ path: '.env.nestjs' });
const { Client } = require('pg');

const TABLE = 'rhautt_nexus.dealer_success_snapshot';
const OTHER_TENANT = '00000000-0000-4000-8000-000000000999';

async function countWith(client, tenantId) {
  await client.query('BEGIN');
  try {
    if (tenantId) await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    const { rows } = await client.query(`SELECT count(*)::int AS n FROM ${TABLE}`);
    return rows[0].n;
  } finally {
    await client.query('ROLLBACK');
  }
}

async function main() {
  const user = process.env.APP_DB_USER || 'rhautt_app';
  const password = process.env.APP_DB_PASSWORD;
  if (!password) { console.error('APP_DB_PASSWORD 必填'); process.exit(1); }

  const client = new Client({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT || 5432),
    user, password,
    database: process.env.POSTGRES_DB || 'rhautt_nexus',
  });
  await client.connect();

  const role = (await client.query('SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user')).rows[0];
  console.log(`连接角色 ${user}: superuser=${role.rolsuper} bypassrls=${role.rolbypassrls}`);
  if (role.rolsuper || role.rolbypassrls) {
    console.error('❌ 应用角色仍可绕过 RLS —— 隔离无效');
    await client.end(); process.exit(1);
  }

  const own = (await client.query("SELECT id FROM rhautt_nexus.tenants LIMIT 1")).rows;
  // tenants 表本身可能非租户隔离；取一个已有业务数据的租户
  const seed = (await client.query(
    `SELECT tenant_id FROM ${TABLE} LIMIT 1`,
  )).rows;

  const noCtx = await countWith(client, null);
  const wrongCtx = await countWith(client, OTHER_TENANT);
  // 无上下文时读不到任何行 → 需用超级用户旁路取一个真实 tenant_id 做 C 组
  const realTenant = process.env.PROOF_TENANT_ID || (seed[0] && seed[0].tenant_id) || (own[0] && own[0].id);
  const rightCtx = realTenant ? await countWith(client, realTenant) : 0;

  console.log(`A) 未设 tenant 上下文        → ${noCtx} 行（期望 0）`);
  console.log(`B) 设为其他租户             → ${wrongCtx} 行（期望 0）`);
  console.log(`C) 设为本租户 ${String(realTenant).slice(0, 8)}… → ${rightCtx} 行（期望 > 0）`);

  const ok = noCtx === 0 && wrongCtx === 0 && rightCtx > 0;
  console.log(ok ? '✅ RLS 强制生效：跨租户不可见、本租户可读' : '❌ RLS 断言失败');

  // 记入发布证据台账——与 postgresRlsBehavior（模拟）并列的**真实**执行证明
  try {
    require('./../release/evidence-utils').updateReleaseEvidence('rlsEnforcement', {
      command: 'npm run guard:rls-enforcement',
      status: ok ? 'real-enforcement-proven' : 'real-enforcement-failed',
      finalLaunchDatabaseProof: ok,
      role: user,
      roleSuperuser: role.rolsuper,
      roleBypassRls: role.rolbypassrls,
      noContextRows: noCtx,
      wrongTenantRows: wrongCtx,
      ownTenantRows: rightCtx,
      table: TABLE,
    });
  } catch { /* 台账不可写不应影响证明结论 */ }

  await client.end();
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error('proof 失败:', e.message); process.exit(1); });
