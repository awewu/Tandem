#!/usr/bin/env node
/**
 * setup-app-role.js — 为应用角色 rhautt_app 设置口令（迁移 071 建角色，口令不入库）。
 *
 * 为什么需要：应用此前以 DB 超级用户连接 → PostgreSQL 超级用户完全绕过 RLS，
 * 77 条 tenant_isolation policy 形同虚设。迁移 071 建了 NOBYPASSRLS 的 rhautt_app，
 * 本脚本设置其口令，应用随后改用该角色连接，RLS 才真正成为兜底。
 *
 * 用法（以超级用户连接执行）：
 *   APP_DB_PASSWORD=<强口令> node scripts/db/setup-app-role.js
 *   # 连接沿用 .env.nestjs / DATABASE_URL（超级用户）
 *
 * 之后把应用连接切到 rhautt_app：
 *   POSTGRES_USER=rhautt_app
 *   POSTGRES_PASSWORD=<同一口令>
 * 超级用户仅保留给迁移（apply-migrations.js）与运维。
 */
require('dotenv').config({ path: '.env.nestjs' });
const { Client } = require('pg');

async function main() {
  const password = process.env.APP_DB_PASSWORD;
  if (!password || password.length < 12) {
    console.error('APP_DB_PASSWORD 必填且不少于 12 位（不要使用弱口令）');
    process.exit(1);
  }

  const client = process.env.DATABASE_URL || process.env.POSTGRES_URI
    ? new Client({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URI })
    : new Client({
        host: process.env.POSTGRES_HOST || 'localhost',
        port: Number(process.env.POSTGRES_PORT || 5432),
        user: process.env.POSTGRES_SUPERUSER || process.env.POSTGRES_USER || 'rhautt',
        password: process.env.POSTGRES_SUPERUSER_PASSWORD || process.env.POSTGRES_PASSWORD,
        database: process.env.POSTGRES_DB || 'rhautt_nexus',
      });

  await client.connect();
  const { rows } = await client.query("SELECT rolbypassrls, rolsuper FROM pg_roles WHERE rolname='rhautt_app'");
  if (!rows.length) {
    console.error('rhautt_app 不存在——请先执行迁移 071（node scripts/db/apply-migrations.js）');
    await client.end();
    process.exit(1);
  }
  if (rows[0].rolbypassrls || rows[0].rolsuper) {
    console.error('rhautt_app 具备 SUPERUSER/BYPASSRLS——拒绝配置，请先收回该能力');
    await client.end();
    process.exit(1);
  }

  // 参数化不支持角色口令，改用 format 转义（口令来自受控 env，非用户输入）
  await client.query(`ALTER ROLE rhautt_app WITH PASSWORD ${literal(password)}`);
  console.log('✅ rhautt_app 口令已设置。请把应用连接切至 POSTGRES_USER=rhautt_app 并重启服务。');
  await client.end();
}

function literal(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

main().catch((err) => { console.error('setup-app-role 失败:', err.message); process.exit(1); });
