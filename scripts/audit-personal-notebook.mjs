/**
 * 只读审计: 合并前清点"私人记事本"三处存量.
 *
 * 目的 (docs/ORG-DRIVE-DISTILLATION-DESIGN §0.1):
 *   - memories(ownershipLevel=personal)  ← 组织记忆菜单实际显示的个人记事本
 *   - knowledge_nodes                     ← 我的资料库
 *   - shouchao_notes / shouchao_notebooks ← 搭子手抄 (合并目标)
 * 判断真实数据量 vs seed, 决定迁移策略. 纯 SELECT, 不写任何数据.
 *
 * 用法: node scripts/audit-personal-notebook.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import pg from 'pg';

for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, '');
  }
}

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }
console.log('DB =', url.replace(/:\/\/([^:]+):[^@]*@/, '://$1:****@'), '\n');

const client = new pg.Client({ connectionString: url.split('?')[0] });

try {
  await client.connect();

  // 1. memories 按 ownershipLevel 分布
  const byLevel = await client.query(
    `SELECT COALESCE(data->>'ownershipLevel','(null)') AS lvl, count(*)::int AS n
       FROM "KvStore" WHERE collection='memories' GROUP BY 1 ORDER BY 2 DESC`,
  );
  console.log('=== memories · by ownershipLevel ===');
  byLevel.rows.forEach((r) => console.log(`  ${r.lvl.padEnd(12)} ${r.n}`));

  // 2. personal memories 按 owner 分布 (前 20)
  const byOwner = await client.query(
    `SELECT COALESCE(data->>'ownerUserId','(null)') AS owner, count(*)::int AS n
       FROM "KvStore"
      WHERE collection='memories' AND data->>'ownershipLevel'='personal'
      GROUP BY 1 ORDER BY 2 DESC LIMIT 20`,
  );
  console.log('\n=== personal memories · by ownerUserId (top 20) ===');
  if (byOwner.rows.length === 0) console.log('  (none)');
  byOwner.rows.forEach((r) => console.log(`  ${r.owner.padEnd(28)} ${r.n}`));

  // 3. personal memories 样本 (看是否 seed)
  const sample = await client.query(
    `SELECT id, data->>'title' AS title, data->>'ownerUserId' AS owner, data->>'createdAt' AS created
       FROM "KvStore"
      WHERE collection='memories' AND data->>'ownershipLevel'='personal'
      ORDER BY "updatedAt" DESC LIMIT 10`,
  );
  console.log('\n=== personal memories · sample (10) ===');
  sample.rows.forEach((r) => console.log(`  [${r.owner}] ${r.title} (${r.created})`));

  // 4. knowledge_nodes / shouchao 存量
  for (const coll of ['knowledge_nodes', 'shouchao_notes', 'shouchao_notebooks']) {
    const c = await client.query(`SELECT count(*)::int AS n FROM "KvStore" WHERE collection=$1`, [coll]);
    const owners = await client.query(
      `SELECT count(DISTINCT data->>'ownerId')::int AS n FROM "KvStore" WHERE collection=$1`, [coll],
    );
    console.log(`\n=== ${coll} === total=${c.rows[0].n}  distinctOwners=${owners.rows[0].n}`);
  }
} catch (e) {
  console.error('AUDIT FAILED:', e.message);
  process.exit(1);
} finally {
  await client.end();
}
