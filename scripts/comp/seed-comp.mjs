/**
 * 幂等 seed · 薪酬真源数据 (版本 + 岗族 + 技能定价)
 *
 * 真源 = comp_skill_def (HR 动态维护)。本脚本从 lib/comp/seed/skills.json 载入,
 * 用确定性 id (hash) upsert, 可重复运行。
 *
 * 注: comp_grade_band (基本/任务档) 因源表按"岗类×层级"跨岗族分组, familyId 映射
 *     存在歧义, 暂不在此 seed —— 待 HR 明确映射口径后单独处理。
 *
 * 运行: node scripts/comp/seed-comp.mjs
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import pg from 'pg';

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = readFileSync('.env.local', 'utf8');
  const m = env.match(/^DATABASE_URL=(.+)$/m);
  if (!m) throw new Error('DATABASE_URL not found in .env.local');
  return m[1].trim().replace(/^["']|["']$/g, '');
}
const sid = (...parts) => createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 16);

const TENANT = 'default';
const VERSION = 'v2026.1';
const VER_ID = 'ver_' + sid(TENANT, VERSION);
const BOARD_SEQ = { HR: 'MIP', FIN: 'AIP', MFG: 'AIP', RND: 'AIP', MKT: 'SIP' };
const LEVELS = ['L1', 'L1A', 'L2', 'L3', 'L4', 'L5'];

const skills = JSON.parse(readFileSync('lib/comp/seed/skills.json', 'utf8'));

// 派生岗族 (board|family → reachableLevels 并集)
const famMap = new Map();
for (const s of skills) {
  const key = `${s.board}|${s.family}`;
  if (!famMap.has(key)) famMap.set(key, { board: s.board, family: s.family, levels: new Set() });
  for (const l of s.requiredAt) famMap.get(key).levels.add(l);
}

const { Client } = pg;
const client = new Client({ connectionString: loadDatabaseUrl() });
await client.connect();
try {
  await client.query('BEGIN');

  // 1) 版本 (若无 published 则建, 幂等)
  await client.query(
    `INSERT INTO comp_matrix_version (id, tenant_id, version, published_by, changelog, status)
     VALUES ($1,$2,$3,'system','初始导入 2026 薪酬体系','published')
     ON CONFLICT (id) DO UPDATE SET version=EXCLUDED.version`,
    [VER_ID, TENANT, VERSION],
  );

  // 2) 岗族
  const famId = new Map();
  for (const f of famMap.values()) {
    const id = 'fam_' + sid(TENANT, f.board, f.family);
    famId.set(`${f.board}|${f.family}`, id);
    const reachable = LEVELS.filter((l) => f.levels.has(l));
    await client.query(
      `INSERT INTO comp_job_family (id, tenant_id, board, name, job_class, sequence, reachable_levels, matrix_version)
       VALUES ($1,$2,$3,$4,'I',$5,$6,$7)
       ON CONFLICT (id) DO UPDATE SET reachable_levels=EXCLUDED.reachable_levels, matrix_version=EXCLUDED.matrix_version`,
      [id, TENANT, f.board, f.family, BOARD_SEQ[f.board] || 'AIP', JSON.stringify(reachable), VERSION],
    );
  }

  // 3) 技能定价 (真源)
  for (const s of skills) {
    const fid = famId.get(`${s.board}|${s.family}`);
    const id = 'sk_' + sid(TENANT, s.board, s.family, s.name);
    await client.query(
      `INSERT INTO comp_skill_def (id, tenant_id, family_id, name, skill_wage, required_at, source, matrix_version)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO UPDATE SET skill_wage=EXCLUDED.skill_wage, required_at=EXCLUDED.required_at, source=EXCLUDED.source, matrix_version=EXCLUDED.matrix_version`,
      [id, TENANT, fid, s.name, s.skillWage, JSON.stringify(s.requiredAt), s.source || '案例佐证', VERSION],
    );
  }

  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
}

const counts = await client.query(
  `SELECT 'version' t, count(*) n FROM comp_matrix_version
   UNION ALL SELECT 'family', count(*) FROM comp_job_family
   UNION ALL SELECT 'skill', count(*) FROM comp_skill_def`,
);
console.log('=== seed 结果 ===');
for (const r of counts.rows) console.log('  ', r.t, '=', r.n);

// 抽样对账: HRBP 各级 Σ定价
const chk = await client.query(
  `SELECT jf.name, sd.required_at, sd.skill_wage
   FROM comp_skill_def sd JOIN comp_job_family jf ON jf.id = sd.family_id
   WHERE jf.name = 'HRBP'`,
);
const byLevel = {};
for (const row of chk.rows) for (const l of row.required_at) byLevel[l] = (byLevel[l] || 0) + row.skill_wage;
console.log('  HRBP Σ定价/级:', JSON.stringify(byLevel), '(应 L1=1200 L3=4100 L5=8700)');

await client.end();
