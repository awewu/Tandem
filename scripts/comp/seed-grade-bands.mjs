/**
 * 幂等 seed · 职级带宽 comp_grade_band (口径一: 按 岗类×层级, familyId 留空)
 *
 * 口径一: 带宽只提供"任务档 A-G / 基本工资"(按岗类×层级); 技能工资读时实时 Σ定价。
 * 去重: 同 (jobClass, level) 取代表行, 并检测任务档/基本工资跨族组是否一致 (验证无损)。
 *
 * 运行: node scripts/comp/seed-grade-bands.mjs
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import pg from 'pg';

function url() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const m = readFileSync('.env.local', 'utf8').match(/^DATABASE_URL=(.+)$/m);
  return m[1].trim().replace(/^["']|["']$/g, '');
}
const sid = (...p) => createHash('sha1').update(p.join('|')).digest('hex').slice(0, 16);
const TENANT = 'default';
const VERSION = 'v2026.1';

const bands = JSON.parse(readFileSync('lib/comp/seed/grade-bands.json', 'utf8'));

// 按 (jobClass, level) 去重 + 冲突检测
const groups = new Map();
for (const b of bands) {
  const key = `${b.jobClass}|${b.level}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(b);
}

const conflicts = [];
const reps = [];
for (const [key, rows] of groups.entries()) {
  const rep = rows[0];
  const gearsStr = JSON.stringify(rep.taskGears);
  for (const r of rows.slice(1)) {
    if (JSON.stringify(r.taskGears) !== gearsStr || r.baseWage !== rep.baseWage) {
      conflicts.push({ key, a: rep.familyGroup, b: r.familyGroup, aBase: rep.baseWage, bBase: r.baseWage });
    }
  }
  reps.push(rep);
}

const c = new pg.Client({ connectionString: url() });
await c.connect();
try {
  await c.query('BEGIN');
  for (const b of reps) {
    const id = 'band_' + sid(TENANT, b.jobClass, b.level);
    await c.query(
      `INSERT INTO comp_grade_band
        (id, tenant_id, job_class, level, family_id, education, experience,
         base_wage, skill_wage_cached, task_ratio, task_wage_std,
         skill_step, task_step, adjust_step, task_gears, title, monthly, annual, ratio, matrix_version)
       VALUES ($1,$2,$3,$4,NULL,$5,$6,$7,0,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       ON CONFLICT (id) DO UPDATE SET
         base_wage=EXCLUDED.base_wage, task_ratio=EXCLUDED.task_ratio, task_wage_std=EXCLUDED.task_wage_std,
         skill_step=EXCLUDED.skill_step, task_step=EXCLUDED.task_step, adjust_step=EXCLUDED.adjust_step,
         task_gears=EXCLUDED.task_gears, title=EXCLUDED.title, monthly=EXCLUDED.monthly, annual=EXCLUDED.annual,
         education=EXCLUDED.education, experience=EXCLUDED.experience`,
      [
        id, TENANT, b.jobClass, b.level, b.education, b.experience,
        b.baseWage, b.taskRatio, b.taskWageStd,
        b.skillStep, b.taskStep, b.adjustStep, JSON.stringify(b.taskGears), b.title,
        b.monthly, b.annual, JSON.stringify({}), VERSION,
      ],
    );
  }
  await c.query('COMMIT');
} catch (e) {
  await c.query('ROLLBACK');
  throw e;
}

const cnt = await c.query(`SELECT job_class, level, base_wage, task_wage_std FROM comp_grade_band ORDER BY job_class, level`);
console.log('=== comp_grade_band seed (口径一) ===');
console.log('去重后带宽行:', cnt.rows.length, '(源', bands.length, '行)');
for (const r of cnt.rows) console.log(`  ${r.job_class}类 ${r.level}: 基本${r.base_wage} 任务标准${r.task_wage_std}`);
console.log('\n跨族组冲突 (任务档/基本工资不一致):', conflicts.length);
for (const x of conflicts.slice(0, 10)) console.log(`  ${x.key}: [${x.a}] base=${x.aBase} vs [${x.b}] base=${x.bBase}`);

await c.end();
