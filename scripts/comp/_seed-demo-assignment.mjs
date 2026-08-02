/**
 * 演示数据 (可删) · 给 admin@tandem.local 建一个 HRBP L3 职级定位 + 部分技能认证,
 * 用于端到端验证员工看板 /organization/performance。
 *
 * 幂等; 清理: DELETE FROM comp_employee_grade/comp_grade_certification WHERE employee_id=<admin>。
 * 运行: node scripts/comp/_seed-demo-assignment.mjs
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
const FAM = 'fam_' + sid(TENANT, 'HR', 'HRBP');

const c = new pg.Client({ connectionString: url() });
await c.connect();

const u = await c.query(`SELECT id FROM "User" WHERE email='admin@tandem.local' LIMIT 1`);
if (!u.rows[0]) { console.error('admin@tandem.local 未找到'); await c.end(); process.exit(1); }
const emp = u.rows[0].id;

// 职级定位: HRBP L3, 任务 D 档, 基本工资取带宽 I类L3 (5600)
const bandL3 = await c.query(`SELECT base_wage FROM comp_grade_band WHERE tenant_id=$1 AND job_class='I' AND level='L3' LIMIT 1`, [TENANT]);
const base = bandL3.rows[0]?.base_wage ?? 5600;

await c.query(
  `INSERT INTO comp_employee_grade
     (id, tenant_id, employee_id, family_id, job_class, current_level, education, experience, base_wage_snapshot, task_gear, certified_against_version)
   VALUES ($1,$2,$3,$4,'I','L3','一般本科','5年（含）-10年',$5,'D',$6)
   ON CONFLICT (id) DO UPDATE SET current_level='L3', base_wage_snapshot=EXCLUDED.base_wage_snapshot, task_gear='D'`,
  ['eg_' + sid(TENANT, emp), TENANT, emp, FAM, base, VERSION],
);

// 认证 HRBP 中 L3 必备、定价最低的 3 项 (演示部分进度)
const skills = await c.query(
  `SELECT id, name, skill_wage FROM comp_skill_def
   WHERE tenant_id=$1 AND family_id=$2 AND required_at @> '["L3"]'::jsonb
   ORDER BY skill_wage ASC LIMIT 3`, [TENANT, FAM]);
for (const s of skills.rows) {
  await c.query(
    `INSERT INTO comp_grade_certification
       (id, tenant_id, employee_id, family_id, skill_id, status, certified_at, certified_against_version)
     VALUES ($1,$2,$3,$4,$5,'已认证',now(),$6)
     ON CONFLICT (id) DO UPDATE SET status='已认证'`,
    ['cert_' + sid(TENANT, emp, s.id), TENANT, emp, FAM, s.id, VERSION],
  );
}

console.log('演示定位已建: admin@tandem.local → HRBP L3 (base', base + '), 认证技能:', skills.rows.map((s) => `${s.name}(${s.skill_wage})`).join(', '));
const sum = skills.rows.reduce((a, s) => a + s.skill_wage, 0);
console.log('预期看板: 基本', base, '+ 技能(已认证Σ)', sum, '+ 任务(D档) → 月薪', base + sum + '+任务');

await c.end();
