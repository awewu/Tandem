#!/usr/bin/env node
// 临时 DB 完整性检查脚本
import postgres from 'postgres';
import { readFileSync, readdirSync } from 'node:fs';

// 手动读取 .env.local
try {
  const env = readFileSync('.env.local', 'utf8');
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
} catch {}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('No DATABASE_URL');
  process.exit(1);
}

// 去掉 Prisma 风格 query params (?schema=...)
const cleanUrl = url.split('?')[0];
const sql = postgres(cleanUrl, { max: 1 });

try {
  // 1. drizzle migrations 应用情况
  const migrations = await sql`
    SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at
  `.catch(() => null);

  // 2. 所有 public schema 表
  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' ORDER BY table_name
  `;

  const journalReal = JSON.parse(
    readFileSync('drizzle/migrations/meta/_journal.json', 'utf8')
  ).entries;

  const diskSql = readdirSync('drizzle/migrations').filter((f) => f.endsWith('.sql')).sort();

  console.log('=== 1. Journal (Drizzle 认可的 migrations) ===');
  for (const e of journalReal) console.log(`  [${e.idx}] ${e.tag}`);

  console.log('\n=== 2. 磁盘上的 .sql 文件 ===');
  for (const f of diskSql) {
    const inJournal = journalReal.some((e) => f.startsWith(e.tag));
    console.log(`  ${f}  ${inJournal ? '✓ in journal' : '✗ ORPHAN'}`);
  }

  console.log('\n=== 3. DB 中已应用的 migrations ===');
  if (migrations) {
    for (const m of migrations) console.log(`  ${m.hash}  ${new Date(Number(m.created_at)).toISOString()}`);
  } else {
    console.log('  (drizzle.__drizzle_migrations 表不存在)');
  }

  console.log(`\n=== 4. public schema 表 (${tables.length} 张) ===`);
  for (const t of tables) console.log(`  ${t.table_name}`);

  // 5. 关键表行数采样
  const checkTables = ['User', 'Channel', 'Message', 'Okr', 'KpiSubject', 'KvStore', 'AuditLog'];
  console.log('\n=== 5. 关键表行数 ===');
  for (const t of checkTables) {
    try {
      const [{ count }] = await sql.unsafe(`SELECT COUNT(*)::int as count FROM "${t}"`);
      console.log(`  ${t.padEnd(20)} ${count}`);
    } catch (e) {
      console.log(`  ${t.padEnd(20)} ✗ ${e.message.split('\n')[0]}`);
    }
  }

  await sql.end();
} catch (e) {
  console.error('Error:', e.message);
  await sql.end();
  process.exit(1);
}
