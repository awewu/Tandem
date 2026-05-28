#!/usr/bin/env node
/**
 * scripts/db-repair.mjs · 一次性 DB 完整性修复
 *
 * 目标:
 *  1. 备份当前 drizzle.__drizzle_migrations 与所有 public 表 row counts (snapshot.json)
 *  2. 创建缺失的 AuditLog 表 + 索引
 *  3. 重整 journal: 把 DB 中已应用的 migrations 与磁盘上的 .sql 文件对齐
 *  4. 报告
 *
 * 使用: node scripts/db-repair.mjs [--dry-run]
 */
import postgres from 'postgres';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

// 读 .env.local
try {
  const env = readFileSync('.env.local', 'utf8');
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
} catch {}

const url = process.env.DATABASE_URL;
if (!url) { console.error('No DATABASE_URL'); process.exit(1); }
const cleanUrl = url.split('?')[0];

const DRY = process.argv.includes('--dry-run');
const log = (...a) => console.log(...a);
const sql = postgres(cleanUrl, { max: 1 });

function sha256(s) { return createHash('sha256').update(s).digest('hex'); }

try {
  // ---------- 1. 快照 ----------
  log('\n=== STEP 1: snapshot current state ===');
  const beforeMigrations = await sql`SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at`;
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`;
  const counts = {};
  for (const { table_name } of tables) {
    try {
      const [{ c }] = await sql.unsafe(`SELECT COUNT(*)::int AS c FROM "${table_name}"`);
      counts[table_name] = c;
    } catch (e) { counts[table_name] = `err:${e.message}`; }
  }

  if (!existsSync('backups')) mkdirSync('backups');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const snapPath = join('backups', `db-snapshot-${stamp}.json`);
  writeFileSync(snapPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    migrations: beforeMigrations,
    tables: tables.map((t) => t.table_name),
    row_counts: counts,
  }, null, 2));
  log(`  ✓ snapshot 写入 ${snapPath} (${tables.length} 表)`);

  // ---------- 2. 检测缺失 ----------
  log('\n=== STEP 2: detect schema gaps ===');
  const tableSet = new Set(tables.map((t) => t.table_name));
  const expectedTables = ['AuditLog', 'LaunchpadApp', 'LaunchpadClick', 'LlmUsageLog', 'UsageEvent'];
  const missing = expectedTables.filter((t) => !tableSet.has(t));
  log(`  缺失: ${missing.length === 0 ? '(无)' : missing.join(', ')}`);

  // ---------- 3. 修复 ----------
  if (DRY) {
    log('\n=== DRY RUN: 不修改任何东西 ===');
    await sql.end();
    process.exit(0);
  }

  log('\n=== STEP 3: apply fixes (in transaction) ===');
  await sql.begin(async (tx) => {
    // 3a. 创建 AuditLog 表 (如果缺)
    if (missing.includes('AuditLog')) {
      log('  [创建] AuditLog 表 + 索引');
      await tx.unsafe(`
        CREATE TABLE "AuditLog" (
          "id" text PRIMARY KEY NOT NULL,
          "action" text NOT NULL,
          "actorId" text NOT NULL,
          "targetId" text,
          "targetType" text,
          "metadata" jsonb,
          "timestamp" timestamp (3) NOT NULL,
          "hash" text NOT NULL,
          "prevHash" text,
          "tenantId" text DEFAULT 'default' NOT NULL,
          "seq" integer NOT NULL
        );
        CREATE INDEX "AuditLog_action_idx" ON "AuditLog" USING btree ("action");
        CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog" USING btree ("actorId");
        CREATE INDEX "AuditLog_targetId_idx" ON "AuditLog" USING btree ("targetId");
        CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog" USING btree ("timestamp");
        CREATE INDEX "AuditLog_tenant_seq_idx" ON "AuditLog" USING btree ("tenantId","seq");
      `);
    }

    // 3b. 重整 drizzle.__drizzle_migrations 与 journal
    //   现状: DB 已有 0000, 0001, 0002_launchpad (hash 与 journal 中 0002_real_kat_farrell 不同)
    //   目标: DB 反映磁盘真实状态 (0000, 0001, 0002_real_kat_farrell, 0003_spooky_nuke)
    //   - 删除磁盘上多余的 0002_launchpad.sql (被 real_kat_farrell 包含的子集)
    //   - 更新 DB 的 idx=2 hash 为 real_kat_farrell 的 hash
    //   - 插入 idx=3 spooky_nuke 行

    const realKatSql = readFileSync('drizzle/migrations/0002_real_kat_farrell.sql', 'utf8');
    const spookySql = readFileSync('drizzle/migrations/0003_spooky_nuke.sql', 'utf8');
    const realKatHash = sha256(realKatSql);
    const spookyHash = sha256(spookySql);

    // 找到 idx=2 (created_at 顺序第 3 条) 的 id
    const [m2] = await tx`SELECT id, hash FROM drizzle.__drizzle_migrations ORDER BY created_at OFFSET 2 LIMIT 1`;
    if (m2) {
      log(`  [更新] drizzle.__drizzle_migrations id=${m2.id} hash → 0002_real_kat_farrell (${realKatHash.slice(0, 12)}...)`);
      await tx`UPDATE drizzle.__drizzle_migrations SET hash = ${realKatHash} WHERE id = ${m2.id}`;
    }

    // 插入 0003_spooky_nuke (如果还没有)
    const existing0003 = await tx`SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = ${spookyHash}`;
    if (existing0003.length === 0) {
      log(`  [插入] drizzle.__drizzle_migrations 0003_spooky_nuke (${spookyHash.slice(0, 12)}...)`);
      await tx`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${spookyHash}, ${Date.now()})`;
    }
  });

  log('  ✓ DB 事务提交成功');

  // 3c. 更新 _journal.json
  log('\n=== STEP 4: update _journal.json ===');
  const journalPath = 'drizzle/migrations/meta/_journal.json';
  const journal = JSON.parse(readFileSync(journalPath, 'utf8'));
  const hasSpooky = journal.entries.some((e) => e.tag === '0003_spooky_nuke');
  if (!hasSpooky) {
    journal.entries.push({
      idx: 3,
      version: '7',
      when: Date.now(),
      tag: '0003_spooky_nuke',
      breakpoints: true,
    });
    writeFileSync(journalPath, JSON.stringify(journal, null, 2));
    log('  ✓ 已追加 0003_spooky_nuke entry');
  } else {
    log('  (journal 已有 0003_spooky_nuke, 跳过)');
  }

  // 3d. 删除冗余的 0002_launchpad.sql (被 0002_real_kat_farrell 包含)
  const orphan = 'drizzle/migrations/0002_launchpad.sql';
  if (existsSync(orphan)) {
    unlinkSync(orphan);
    log(`  ✓ 删除冗余 ${orphan}`);
  }

  // ---------- 4. 验证 ----------
  log('\n=== STEP 5: verify ===');
  const after = await sql`SELECT id, hash FROM drizzle.__drizzle_migrations ORDER BY created_at`;
  log(`  drizzle.__drizzle_migrations 共 ${after.length} 行`);
  const auditExists = await sql`SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='AuditLog'`;
  log(`  AuditLog 表: ${auditExists.length > 0 ? '✓ 存在' : '✗ 仍缺失'}`);

  await sql.end();
  log('\n✅ 修复完成');
} catch (e) {
  console.error('\n❌ 修复失败:', e.message);
  console.error(e.stack);
  await sql.end();
  process.exit(1);
}
