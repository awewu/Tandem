/**
 * 幂等 DDL 迁移 · 薪酬绩效模块 comp_* 表 (PRD §13)
 *
 * 规则 (项目铁律): 禁用 db:push; 仅用 CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS;
 * 连接 .env.local 的 DATABASE_URL (native postgres localhost:5432, 非 docker 5440)。
 *
 * 运行 (需批准): node scripts/migrations/2026-comp-tables.mjs
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = readFileSync('.env.local', 'utf8');
  const m = env.match(/^DATABASE_URL=(.+)$/m);
  if (!m) throw new Error('DATABASE_URL not found in .env.local');
  return m[1].trim().replace(/^["']|["']$/g, '');
}

const DDL = `
CREATE TABLE IF NOT EXISTS comp_job_family (
  id                text PRIMARY KEY,
  tenant_id         text NOT NULL DEFAULT 'default',
  board             text NOT NULL,
  name              text NOT NULL,
  job_class         text NOT NULL,
  sequence          text NOT NULL,
  reachable_levels  jsonb NOT NULL DEFAULT '[]',
  matrix_version    text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comp_job_family_tenant ON comp_job_family (tenant_id);

CREATE TABLE IF NOT EXISTS comp_skill_def (
  id             text PRIMARY KEY,
  tenant_id      text NOT NULL DEFAULT 'default',
  family_id      text NOT NULL,
  name           text NOT NULL,
  skill_wage     integer NOT NULL DEFAULT 0,
  required_at    jsonb NOT NULL DEFAULT '[]',
  source         text NOT NULL DEFAULT '案例佐证',
  matrix_version text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comp_skill_def_tenant ON comp_skill_def (tenant_id);
CREATE INDEX IF NOT EXISTS idx_comp_skill_def_family ON comp_skill_def (family_id);

CREATE TABLE IF NOT EXISTS comp_grade_band (
  id             text PRIMARY KEY,
  tenant_id      text NOT NULL DEFAULT 'default',
  job_class      text NOT NULL,
  level          text NOT NULL,
  family_id      text,
  education      text,
  experience     text,
  base_wage            integer NOT NULL DEFAULT 0,
  skill_wage_cached    integer NOT NULL DEFAULT 0,
  skill_wage_computed_at timestamptz,
  task_ratio           numeric NOT NULL DEFAULT 0,
  task_wage_std        integer NOT NULL DEFAULT 0,
  skill_step           integer NOT NULL DEFAULT 0,
  task_step            integer NOT NULL DEFAULT 0,
  adjust_step          integer NOT NULL DEFAULT 0,
  task_gears           jsonb NOT NULL DEFAULT '{}',
  title                text,
  monthly              integer NOT NULL DEFAULT 0,
  annual               integer NOT NULL DEFAULT 0,
  ratio                jsonb NOT NULL DEFAULT '{}',
  matrix_version       text NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comp_grade_band_tenant ON comp_grade_band (tenant_id);

CREATE TABLE IF NOT EXISTS comp_matrix_version (
  id             text PRIMARY KEY,
  tenant_id      text NOT NULL DEFAULT 'default',
  version        text NOT NULL,
  effective_from timestamptz NOT NULL DEFAULT now(),
  published_by   text,
  changelog      text,
  status         text NOT NULL DEFAULT 'draft'
);
CREATE INDEX IF NOT EXISTS idx_comp_matrix_version_tenant ON comp_matrix_version (tenant_id);

CREATE TABLE IF NOT EXISTS comp_employee_grade (
  id                        text PRIMARY KEY,
  tenant_id                 text NOT NULL DEFAULT 'default',
  employee_id               text NOT NULL,
  family_id                 text NOT NULL,
  job_class                 text NOT NULL,
  current_level             text NOT NULL,
  education                 text,
  experience                text,
  base_wage_snapshot        integer NOT NULL DEFAULT 0,
  task_gear                 text NOT NULL DEFAULT 'D',
  effective_from            timestamptz NOT NULL DEFAULT now(),
  effective_to              timestamptz,
  certified_against_version text NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comp_employee_grade_tenant ON comp_employee_grade (tenant_id);
CREATE INDEX IF NOT EXISTS idx_comp_employee_grade_emp ON comp_employee_grade (employee_id);

CREATE TABLE IF NOT EXISTS comp_grade_certification (
  id                        text PRIMARY KEY,
  tenant_id                 text NOT NULL DEFAULT 'default',
  employee_id               text NOT NULL,
  family_id                 text NOT NULL,
  skill_id                  text NOT NULL,
  status                    text NOT NULL DEFAULT '待认证',
  evidence                  text,
  certified_at              timestamptz,
  certified_against_version text NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comp_cert_tenant ON comp_grade_certification (tenant_id);
CREATE INDEX IF NOT EXISTS idx_comp_cert_emp ON comp_grade_certification (employee_id);

CREATE TABLE IF NOT EXISTS comp_grade_change_log (
  id                text PRIMARY KEY,
  tenant_id         text NOT NULL DEFAULT 'default',
  employee_id       text NOT NULL,
  node_id           text NOT NULL,
  cycle             text NOT NULL,
  change_type       text NOT NULL,
  from_grade        text,
  to_grade          text,
  evidence_snapshot jsonb NOT NULL DEFAULT '{}',
  signature_state   text NOT NULL DEFAULT '待签',
  signed_at         timestamptz,
  appeal_state      text NOT NULL DEFAULT 'none',
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comp_change_tenant ON comp_grade_change_log (tenant_id);
CREATE INDEX IF NOT EXISTS idx_comp_change_emp ON comp_grade_change_log (employee_id);

CREATE TABLE IF NOT EXISTS comp_monthly_settlement (
  id             text PRIMARY KEY,
  tenant_id      text NOT NULL DEFAULT 'default',
  employee_id    text NOT NULL,
  period         text NOT NULL,
  base_wage      integer NOT NULL DEFAULT 0,
  skill_wage     integer NOT NULL DEFAULT 0,
  task_wage      integer NOT NULL DEFAULT 0,
  performance    integer NOT NULL DEFAULT 0,
  attendance     numeric NOT NULL DEFAULT 1,
  coefficient    numeric NOT NULL DEFAULT 1,
  gate_flags     jsonb NOT NULL DEFAULT '{}',
  basis_snapshot jsonb NOT NULL DEFAULT '{}',
  status         text NOT NULL DEFAULT 'draft',
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comp_settle_tenant ON comp_monthly_settlement (tenant_id);
CREATE INDEX IF NOT EXISTS idx_comp_settle_emp_period ON comp_monthly_settlement (employee_id, period);

-- B轨承接记录 (年度/季度/半年/特殊申请加档留痕)
CREATE TABLE IF NOT EXISTS comp_task_commitment (
  id                text PRIMARY KEY,
  tenant_id         text NOT NULL DEFAULT 'default',
  employee_id       text NOT NULL,
  family_id         text NOT NULL,
  cycle             text NOT NULL,
  commitment_type   text NOT NULL,          -- annual|quarterly|half_year|special
  from_gear         text,
  to_gear           text NOT NULL,
  task_wage_delta   integer NOT NULL DEFAULT 0,
  reason            text,
  status            text NOT NULL DEFAULT 'proposed', -- proposed|approved|active|expired|rejected
  proposed_by       text,
  approved_by       text,
  effective_from    timestamptz,
  effective_to      timestamptz,
  evidence_snapshot jsonb NOT NULL DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comp_commit_tenant ON comp_task_commitment (tenant_id);
CREATE INDEX IF NOT EXISTS idx_comp_commit_emp ON comp_task_commitment (employee_id);

-- 述职/九宫格结果 (OKR潜力轴 × KPI绩效轴 → 九宫格落位 + 三源分快照)
CREATE TABLE IF NOT EXISTS comp_grade_review (
  id                   text PRIMARY KEY,
  tenant_id            text NOT NULL DEFAULT 'default',
  employee_id          text NOT NULL,
  cycle                text NOT NULL,
  review_type          text NOT NULL,       -- quarterly_checkin|half_year|annual
  okr_potential_score  numeric,
  kpi_performance_score numeric,
  nine_box_row         integer,             -- 1..3 潜力
  nine_box_col         integer,             -- 1..3 绩效
  self_score           numeric,
  peer_score           numeric,
  manager_score        numeric,
  source_weights       jsonb NOT NULL DEFAULT '{}',  -- {self:0.3, peer:0.4, manager:0.3}
  review360_cycle_id   text,                -- 软引用 review360 (三源他评复用, 不重复造)
  outcome              text,                -- promote|hold|watch|pip|demote
  snapshot             jsonb NOT NULL DEFAULT '{}',
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comp_review_tenant ON comp_grade_review (tenant_id);
CREATE INDEX IF NOT EXISTS idx_comp_review_emp ON comp_grade_review (employee_id);

-- 预算池配置 (LIP池 部门基数×系数×出勤 + 硬悬崖预算截断, 政策 RH-HR-A01)
CREATE TABLE IF NOT EXISTS comp_budget_pool (
  id                  text PRIMARY KEY,
  tenant_id           text NOT NULL DEFAULT 'default',
  department_id       text NOT NULL,        -- 软引用组织架构 department
  period              text NOT NULL,
  pool_type           text NOT NULL DEFAULT 'lip', -- lip|department
  base_amount         integer NOT NULL DEFAULT 0,  -- 部门基数 (FP&A 提前测算)
  hard_cliff          boolean NOT NULL DEFAULT true,
  budget_ceiling      integer,
  quality_coefficient numeric NOT NULL DEFAULT 1,
  attendance_basis    text,
  params              jsonb NOT NULL DEFAULT '{}',
  status              text NOT NULL DEFAULT 'draft',
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comp_pool_tenant ON comp_budget_pool (tenant_id);
CREATE INDEX IF NOT EXISTS idx_comp_pool_dept_period ON comp_budget_pool (department_id, period);

-- 唯一约束 (幂等, 防重复登记)
CREATE UNIQUE INDEX IF NOT EXISTS uq_comp_grade_band ON comp_grade_band (tenant_id, job_class, level, family_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_comp_settle ON comp_monthly_settlement (tenant_id, employee_id, period);
CREATE UNIQUE INDEX IF NOT EXISTS uq_comp_cert ON comp_grade_certification (tenant_id, employee_id, skill_id, certified_against_version);
CREATE UNIQUE INDEX IF NOT EXISTS uq_comp_review ON comp_grade_review (tenant_id, employee_id, cycle, review_type);
CREATE UNIQUE INDEX IF NOT EXISTS uq_comp_pool ON comp_budget_pool (tenant_id, department_id, period, pool_type);
-- 同租户同时仅一个 published 版本
CREATE UNIQUE INDEX IF NOT EXISTS uq_comp_version_published ON comp_matrix_version (tenant_id) WHERE status = 'published';
`;

const { Client } = pg;
const client = new Client({ connectionString: loadDatabaseUrl() });
await client.connect();
try {
  await client.query(DDL);
  const { rows } = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'comp\\_%' ORDER BY table_name",
  );
  console.log('comp_* 表就绪:');
  for (const r of rows) console.log('  ✓', r.table_name);
} finally {
  await client.end();
}
