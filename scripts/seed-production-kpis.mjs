#!/usr/bin/env node
/**
 * Seed real-world corporate KPI skeleton for production deployment Day 1.
 *
 * Idempotent: creates subjects and company-level goals for the Owner if missing.
 * Unlike seed-demo-users, this contains NO mock mock-employees, keeping the DB clean
 * for the company's real production team.
 *
 * Usage:
 *   node scripts/seed-production-kpis.mjs
 */

import pg from 'pg';
import { randomBytes } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------- 简易 .env loader (.env then .env.local override) ----------
function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

const root = dirname(dirname(fileURLToPath(import.meta.url)));
loadEnvFile(join(root, '.env'));
loadEnvFile(join(root, '.env.local')); // override

if (!process.env.DATABASE_URL) {
  console.error('[seed-kpi] FATAL: DATABASE_URL not set');
  process.exit(1);
}

function genId(prefix) {
  return `${prefix}_${randomBytes(10).toString('hex')}`;
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

const SUBJECTS = [
  { code: 'FIN-001', name: '季度营业收入目标', bsc: 'financial', unit: '万元', measure: 'currency' },
  { code: 'CST-001', name: '核心交付件客户满意度', bsc: 'customer', unit: '%', measure: 'percentage' },
  { code: 'PRC-001', name: '系统可用性 (SLA)', bsc: 'process', unit: '%', measure: 'percentage' },
  { code: 'GRW-001', name: '团队分享与 IDP 达成率', bsc: 'growth', unit: '%', measure: 'percentage' },
];

try {
  await client.connect();
  console.log(`[seed-kpi] connected to database`);

  // 1. 获取/确定系统 Owner 账号作为创建人
  const ownerEmail = (process.env.TANDEM_BOOTSTRAP_OWNER_EMAIL || 'admin@tandem.local').toLowerCase();
  const ownerRes = await client.query('SELECT id FROM "User" WHERE email = $1', [ownerEmail]);
  if (ownerRes.rowCount === 0) {
    console.error(`[seed-kpi] FATAL: Owner account (${ownerEmail}) does not exist yet. Please start Tandem first to bootstrap the owner.`);
    process.exit(1);
  }
  const ownerId = ownerRes.rows[0].id;
  const now = new Date();

  // 2. 检查/创建 active 的考核周期 (2026财年)
  let cycleId;
  const activeCycleRes = await client.query('SELECT id FROM "KpiCycle" WHERE status = \'active\' AND "tenantId" = \'default\'');
  if (activeCycleRes.rowCount > 0) {
    cycleId = activeCycleRes.rows[0].id;
    console.log(`[seed-kpi] found existing active KPI cycle: ${cycleId}`);
  } else {
    cycleId = genId('cycle');
    const startStr = '2026-01-01T00:00:00Z';
    const endStr = '2026-12-31T23:59:59Z';
    await client.query(
      `INSERT INTO "KpiCycle" (id, "fiscalYear", name, "startDate", "endDate", status, "tenantId", "createdBy", "createdAt", "updatedAt")
       VALUES ($1, 2026, '2026年度考核周期', $2, $3, 'active', 'default', $4, $5, $5)`,
      [cycleId, startStr, endStr, ownerId, now]
    );
    console.log(`[seed-kpi] CREATED active KPI cycle 2026: ${cycleId}`);
  }

  // 3. 检查/创建 BSC 四大主科目 (Subject)
  const subjectIdsByCode = new Map();
  for (const s of SUBJECTS) {
    const exists = await client.query('SELECT id FROM "KpiSubject" WHERE code = $1 AND "tenantId" = \'default\'', [s.code]);
    if (exists.rowCount > 0) {
      const id = exists.rows[0].id;
      subjectIdsByCode.set(s.code, id);
      console.log(`[seed-kpi] Subject ${s.code} already exists (id=${id})`);
    } else {
      const id = genId('subject');
      await client.query(
        `INSERT INTO "KpiSubject" (id, code, name, "bscPerspective", level, "defaultScope", "defaultUnit", "defaultMeasureType", active, "tenantId", "createdBy", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, 1, 'bonus', $5, $6, true, 'default', $7, $8, $8)`,
        [id, s.code, s.name, s.bsc, s.unit, s.measure, ownerId, now]
      );
      subjectIdsByCode.set(s.code, id);
      console.log(`[seed-kpi] CREATED Subject ${s.code} -> ${s.name} (id=${id})`);
    }
  }

  // 4. 为 Owner (或公司级) 初始化这 4 条标杆生产 KPI (0% 起始, 待对账拉取)
  console.log(`\n[seed-kpi] seeding company-level KPIs for Owner (${ownerEmail}):`);
  
  const KPI_SPECS = [
    { code: 'FIN-001', title: 'Q2 事业部经营收入 (ERP对账)', target: 1000, start: 0, current: 0, weight: 40, ds: 'erp' },
    { code: 'CST-001', title: '外部 SLA 交付客户满意度', target: 95, start: 80, current: 80, weight: 20, ds: 'manual' },
    { code: 'PRC-001', title: '核心生产服务 SLA 稳定性', target: 99.9, start: 99, current: 99, weight: 20, ds: 'system' },
    { code: 'GRW-001', title: '技术分享会与 IDP 自学学分达标率', target: 100, start: 0, current: 0, weight: 20, ds: 'manual' },
  ];

  for (const spec of KPI_SPECS) {
    const subjId = subjectIdsByCode.get(spec.code);
    const bsc = SUBJECTS.find(s => s.code === spec.code).bsc;
    
    // 幂等：按 (cycleId, subjectId, assigneeId) 查重
    const exists = await client.query(
      'SELECT id FROM "Kpi" WHERE "cycleId" = $1 AND "subjectId" = $2 AND "assigneeId" = $3',
      [cycleId, subjId, ownerId]
    );

    if (exists.rowCount > 0) {
      console.log(`  [skip] KPI for ${spec.code} already exists (id=${exists.rows[0].id})`);
      continue;
    }

    const kpiId = genId('kpi');
    await client.query(
      `INSERT INTO "Kpi" (id, "cycleId", "subjectId", "bscPerspective", level, "assigneeId", title, "measureType", "startValue", "targetValue", "currentValue", unit, weight, "dataSource", scope, "tenantId", "createdBy", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'company', $5, $6, $7, $8, $9, $10, $11, $12, $13, 'bonus', 'default', $14, $15, $15)`,
      [
        kpiId,
        cycleId,
        subjId,
        bsc,
        ownerId,
        spec.title,
        SUBJECTS.find(s => s.code === spec.code).measure,
        String(spec.start),
        String(spec.target),
        String(spec.current),
        SUBJECTS.find(s => s.code === spec.code).unit,
        String(spec.weight),
        spec.ds,
        ownerId,
        now
      ]
    );
    console.log(`  [created] Company KPI ${spec.code} -> "${spec.title}" (id=${kpiId}, weight=${spec.weight}%)`);
    
    // 写入当前首日的历史快照，使 trendline / sparkline 不报错
    const snapId = genId('snap');
    const dayStr = now.toISOString().slice(0, 10);
    await client.query(
      `INSERT INTO "KpiSnapshot" (id, "kpiId", date, "cumulativeValue", source, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [snapId, kpiId, dayStr, spec.current, spec.ds, now]
    );
  }

  console.log('\n[seed-kpi] SUCCESS: Real corporate KPI skeleton seeded beautifully.');
  console.log('Now log in with owner account to view your company-level BSC scorecard.');
} catch (err) {
  console.error('[seed-kpi] ERROR:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
