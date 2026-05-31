// 抽查 KPI 强类型表 (migration 0005) 是否落地 + 索引是否齐全.
// 用法: node scripts/verify-kpi-tables.mjs
import fs from 'node:fs';
import pg from 'pg';

function loadEnv(envFile) {
  if (!fs.existsSync(envFile)) return;
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"]*?)"?\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv('.env.local');
loadEnv('.env');

const dbUrl = process.env.DATABASE_URL || 'postgresql://tandem:tandem@localhost:5432/tandem';
const pool = new pg.Pool({ connectionString: dbUrl });

const EXPECTED = [
  'KpiCycle', 'KpiSubject', 'Kpi', 'KpiCheckIn',
  'KpiSnapshot', 'KpiManualEntry', 'KpiBonusPayout', 'KpiCausalLink',
];

try {
  const tables = await pool.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND table_name = ANY($1) ORDER BY table_name`,
    [EXPECTED],
  );
  const present = tables.rows.map((r) => r.table_name);
  const missing = EXPECTED.filter((t) => !present.includes(t));
  console.log(`[verify] tables present (${present.length}/${EXPECTED.length}):`, present.join(', '));
  if (missing.length) {
    console.error('[verify] MISSING:', missing.join(', '));
    process.exit(1);
  }

  const idx = await pool.query(
    `SELECT tablename, indexname FROM pg_indexes
     WHERE schemaname='public' AND tablename = ANY($1) ORDER BY tablename, indexname`,
    [EXPECTED],
  );
  console.log(`[verify] indexes: ${idx.rows.length} total`);
  for (const row of idx.rows) console.log(`  ${row.tablename}.${row.indexname}`);
  console.log('[verify] OK — all 8 KPI tables present');
} catch (e) {
  console.error('[verify] FAIL', e.message);
  process.exit(1);
} finally {
  await pool.end();
}
