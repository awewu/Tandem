#!/usr/bin/env node
/**
 * Backfill · KvStore 存量 KPI 数据 → 强类型表 (migration 0005)
 *
 * 把 7 个 KvStore collection 的 JSONB 行搬到对应强类型表:
 *   kpi_cycles        → KpiCycle
 *   kpi_subjects      → KpiSubject
 *   kpis              → Kpi
 *   kpi_check_ins     → KpiCheckIn
 *   kpi_snapshots     → KpiSnapshot
 *   kpi_manual_entries→ KpiManualEntry
 *   kpi_bonus_payouts → KpiBonusPayout
 *
 * 特性:
 *   - 默认 dry-run (只统计, 不写). 加 --apply 才真正写入.
 *   - 幂等: 用 id 主键 ON CONFLICT DO NOTHING, 重复跑安全.
 *   - 搬完后做行数校验 (源 collection 数 == 目标表新增/已有数).
 *   - 不删除 KvStore 原始数据 (过渡期双轨, 确认无误后再人工清理).
 *
 * 用法:
 *   node scripts/backfill-kpi-tables.mjs            # dry-run
 *   node scripts/backfill-kpi-tables.mjs --apply    # 真正写入
 */
import postgres from 'postgres';
import { readFileSync } from 'node:fs';

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

const APPLY = process.argv.includes('--apply');
const sql = postgres(url.split('?')[0], { max: 1 });

const num = (v, d = 0) => (v === undefined || v === null || v === '' ? String(d) : String(v));
const ts = (v) => (v ? new Date(v) : null);
const tsNow = (v) => (v ? new Date(v) : new Date());

/**
 * 每个 collection → { table, rowMap }.
 * rowMap(d) 把 KvStore data JSON 映射成目标表的列对象.
 * 数值列转 string (numeric), 时间列转 Date.
 */
const PLANS = [
  {
    collection: 'kpi_cycles',
    table: 'KpiCycle',
    map: (d) => ({
      id: d.id,
      fiscalYear: d.fiscalYear,
      name: d.name,
      startDate: d.startDate,
      endDate: d.endDate,
      status: d.status ?? 'draft',
      tenantId: d.tenantId ?? 'default',
      targetsLockedAt: ts(d.targetsLockedAt),
      closedAt: ts(d.closedAt),
      createdBy: d.createdBy,
      createdAt: tsNow(d.createdAt),
      updatedAt: tsNow(d.updatedAt),
    }),
  },
  {
    collection: 'kpi_subjects',
    table: 'KpiSubject',
    map: (d) => ({
      id: d.id,
      parentId: d.parentId ?? null,
      code: d.code,
      name: d.name,
      description: d.description ?? null,
      bscPerspective: d.bscPerspective ?? null,
      level: d.level ?? 1,
      defaultScope: d.defaultScope ?? 'bonus',
      defaultUnit: d.defaultUnit ?? null,
      defaultMeasureType: d.defaultMeasureType ?? 'numeric',
      active: d.active ?? true,
      tenantId: d.tenantId ?? 'default',
      createdBy: d.createdBy,
      createdAt: tsNow(d.createdAt),
      updatedAt: tsNow(d.updatedAt),
    }),
  },
  {
    collection: 'kpis',
    table: 'Kpi',
    map: (d) => ({
      id: d.id,
      cycleId: d.cycleId,
      subjectId: d.subjectId,
      bscPerspective: d.bscPerspective ?? null,
      level: d.level,
      parentKpiId: d.parentKpiId ?? null,
      assigneeId: d.assigneeId,
      departmentId: d.departmentId ?? null,
      title: d.title,
      description: d.description ?? null,
      measureType: d.measureType ?? 'numeric',
      startValue: num(d.startValue),
      targetValue: num(d.targetValue),
      currentValue: num(d.currentValue),
      unit: d.unit ?? null,
      weight: num(d.weight),
      dataSource: d.dataSource ?? 'pending',
      scope: d.scope ?? 'bonus',
      tenantId: d.tenantId ?? 'default',
      createdBy: d.createdBy,
      createdAt: tsNow(d.createdAt),
      updatedAt: tsNow(d.updatedAt),
    }),
  },
  {
    collection: 'kpi_check_ins',
    table: 'KpiCheckIn',
    map: (d) => ({
      id: d.id,
      kpiId: d.kpiId,
      asOf: d.asOf,
      cumulativeValue: num(d.cumulativeValue),
      delta: num(d.delta),
      source: d.source ?? 'manual',
      note: d.note ?? null,
      createdBy: d.createdBy,
      tenantId: d.tenantId ?? 'default',
      createdAt: tsNow(d.createdAt),
    }),
  },
  {
    collection: 'kpi_snapshots',
    table: 'KpiSnapshot',
    map: (d) => ({
      id: d.id,
      kpiId: d.kpiId,
      date: d.date,
      cumulativeValue: num(d.cumulativeValue),
      source: d.source ?? 'erp',
      breakdown: d.breakdown ?? null,
      tenantId: d.tenantId ?? 'default',
      createdAt: tsNow(d.createdAt),
    }),
  },
  {
    collection: 'kpi_manual_entries',
    table: 'KpiManualEntry',
    map: (d) => ({
      id: d.id,
      kpiId: d.kpiId,
      operatorId: d.operatorId,
      operatorRole: d.operatorRole,
      fromValue: num(d.fromValue),
      toValue: num(d.toValue),
      reason: d.reason,
      evidenceUrl: d.evidenceUrl ?? null,
      tenantId: d.tenantId ?? 'default',
      createdAt: tsNow(d.createdAt),
    }),
  },
  {
    collection: 'kpi_bonus_payouts',
    table: 'KpiBonusPayout',
    map: (d) => ({
      id: d.id,
      cycleId: d.cycleId,
      assigneeId: d.assigneeId,
      baseBonus: num(d.baseBonus),
      weightedCompletion: num(d.weightedCompletion),
      finalBonus: num(d.finalBonus),
      contributions: JSON.stringify(d.contributions ?? []),
      calculatedAt: tsNow(d.calculatedAt),
      calculatedBy: d.calculatedBy,
      committed: d.committed ?? false,
      committedAt: ts(d.committedAt),
      note: d.note ?? null,
      tenantId: d.tenantId ?? 'default',
    }),
  },
];

let totalSrc = 0;
let totalInserted = 0;
const errors = [];

console.log(`[backfill] mode = ${APPLY ? 'APPLY (写入)' : 'DRY-RUN (只统计)'}\n`);

try {
  for (const plan of PLANS) {
    const rows = await sql`
      SELECT data FROM "KvStore" WHERE collection = ${plan.collection}
    `;
    totalSrc += rows.length;

    const before = await sql.unsafe(`SELECT COUNT(*)::int AS c FROM "${plan.table}"`);
    const beforeCount = before[0].c;

    if (rows.length === 0) {
      console.log(`  ${plan.collection.padEnd(20)} → ${plan.table.padEnd(16)} src=0  (跳过)`);
      continue;
    }

    let inserted = 0;
    if (APPLY) {
      for (const r of rows) {
        try {
          const obj = plan.map(r.data);
          await sql`INSERT INTO ${sql(plan.table)} ${sql(obj)} ON CONFLICT (id) DO NOTHING`;
          inserted += 1;
        } catch (e) {
          errors.push(`${plan.table}#${r.data?.id}: ${e.message.split('\n')[0]}`);
        }
      }
    }

    const after = await sql.unsafe(`SELECT COUNT(*)::int AS c FROM "${plan.table}"`);
    const afterCount = after[0].c;
    totalInserted += APPLY ? afterCount - beforeCount : 0;

    console.log(
      `  ${plan.collection.padEnd(20)} → ${plan.table.padEnd(16)} ` +
        `src=${String(rows.length).padStart(4)}  ` +
        `before=${String(beforeCount).padStart(4)}  ` +
        (APPLY ? `after=${String(afterCount).padStart(4)}  (+${afterCount - beforeCount})` : '(dry-run)'),
    );
  }

  console.log(`\n[backfill] 源行总数: ${totalSrc}`);
  if (APPLY) console.log(`[backfill] 新增行总数: ${totalInserted}`);
  if (errors.length) {
    console.error(`\n[backfill] ${errors.length} 条错误:`);
    for (const e of errors.slice(0, 20)) console.error(`  ✗ ${e}`);
    await sql.end();
    process.exit(1);
  }
  console.log(
    APPLY
      ? '\n[backfill] OK — 搬迁完成. KvStore 原始数据保留, 确认无误后可人工清理.'
      : '\n[backfill] DRY-RUN 完成. 加 --apply 真正写入.',
  );
  await sql.end();
} catch (e) {
  console.error('[backfill] FAIL', e.message);
  await sql.end();
  process.exit(1);
}
