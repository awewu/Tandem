/**
 * compare-cloud-schema.mjs (READ-ONLY)
 *
 * 连接 .env.local 的 DATABASE_URL (当前指向云端库 113.249.110.37),
 * 拉 information_schema 的表 + 列, 与本地 drizzle-schema.ts 期望结构做对比.
 *
 * 纯读: 只查 information_schema, 不做任何写/DDL.
 *   node scripts/compare-cloud-schema.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// --- 读 .env.local 的 DATABASE_URL (不依赖 dotenv) ---
function readEnvLocal() {
  const raw = readFileSync(resolve(root, '.env.local'), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (t.startsWith('#') || !t.includes('=')) continue;
    const idx = t.indexOf('=');
    const key = t.slice(0, idx).trim();
    if (key === 'DATABASE_URL') return t.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
  }
  return null;
}

// --- 从 drizzle-schema.ts 解析期望的 表名 -> 列名[] ---
function parseDrizzleSchema() {
  const src = readFileSync(resolve(root, 'lib/infra/drizzle-schema.ts'), 'utf8');
  const tables = {};
  // 匹配 pgTable('Name', { ... }) 直到匹配的右括号块
  const re = /pgTable\(\s*'([^']+)'\s*,\s*\{/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const tableName = m[1];
    // 从 { 后开始, 找到平衡的 }
    let i = re.lastIndex;
    let depth = 1;
    const start = i;
    while (i < src.length && depth > 0) {
      const ch = src[i];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      i++;
    }
    const body = src.slice(start, i - 1);
    // 列定义形如:  fieldName: text('colName') / timestamp('colName', ...)
    const cols = new Set();
    const colRe = /(\w+)\s*:\s*\w+\(\s*'([^']+)'/g;
    let cm;
    while ((cm = colRe.exec(body)) !== null) {
      cols.add(cm[2]); // 实际数据库列名 (第二个捕获)
    }
    tables[tableName] = [...cols].sort();
  }
  return tables;
}

async function fetchCloudSchema(connStr) {
  const client = new pg.Client({ connectionString: connStr, ssl: false });
  await client.connect();
  const { rows } = await client.query(`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `);
  await client.end();
  const tables = {};
  for (const r of rows) {
    (tables[r.table_name] ??= []).push(r.column_name);
  }
  for (const k of Object.keys(tables)) tables[k] = tables[k].sort();
  return tables;
}

function diff(expected, actual) {
  const expTables = new Set(Object.keys(expected));
  const actTables = new Set(Object.keys(actual));

  const missingTables = [...expTables].filter((t) => !actTables.has(t)).sort();
  const extraTables = [...actTables].filter((t) => !expTables.has(t)).sort();
  const common = [...expTables].filter((t) => actTables.has(t)).sort();

  console.log('================ 表级对比 ================');
  console.log(`drizzle-schema 期望表数: ${expTables.size}`);
  console.log(`云端库实际表数:          ${actTables.size}`);
  console.log('');
  console.log(`❌ 云端缺少的表 (schema 有, 云端无): ${missingTables.length ? missingTables.join(', ') : '无'}`);
  console.log(`➕ 云端多出的表 (云端有, schema 无): ${extraTables.length ? extraTables.join(', ') : '无'}`);
  console.log('');
  console.log('================ 字段级对比 (共有表) ================');
  let anyColDiff = false;
  for (const t of common) {
    const exp = new Set(expected[t]);
    const act = new Set(actual[t]);
    const missingCols = [...exp].filter((c) => !act.has(c)).sort();
    const extraCols = [...act].filter((c) => !exp.has(c)).sort();
    if (missingCols.length || extraCols.length) {
      anyColDiff = true;
      console.log(`\n表 ${t}:`);
      if (missingCols.length) console.log(`   ❌ 云端缺少字段: ${missingCols.join(', ')}`);
      if (extraCols.length) console.log(`   ➕ 云端多出字段: ${extraCols.join(', ')}`);
    }
  }
  if (!anyColDiff) console.log('共有表的字段完全一致 ✅');
  console.log('\n================ 结论 ================');
  const same = !missingTables.length && !extraTables.length && !anyColDiff;
  console.log(same ? '✅ 云端库与 drizzle-schema 完全一致' : '⚠️ 存在差异 (见上)');
}

(async () => {
  const conn = readEnvLocal();
  if (!conn) { console.error('未在 .env.local 找到 DATABASE_URL'); process.exit(1); }
  const host = conn.replace(/(:\/\/[^:]+:)[^@]+(@)/, '$1****$2');
  console.log('连接 (脱敏):', host, '\n');
  const expected = parseDrizzleSchema();
  const actual = await fetchCloudSchema(conn);
  diff(expected, actual);
})().catch((e) => { console.error('错误:', e.message); process.exit(1); });
