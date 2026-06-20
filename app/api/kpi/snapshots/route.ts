/**
 * /api/kpi/snapshots
 *
 * GET   ?cycleId=...&kpiId=...    列出快照 (可按 KPI / cycle 过滤)
 * POST                           立即写一组当日快照
 *
 * 每日凌晨由 cron 调用 POST 一次, 把所有 active cycle 的 KPI currentValue 落到
 * KpiSnapshot 表 (date=YYYY-MM-DD, 每 KPI 每日一条幂等).
 *
 * 也可手动触发一次 (admin only) 用于补数 / 测试.
 *
 * CHARTER §3 趋势分析的数据源.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot, getStore } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { withTenantScope } from '@/lib/multi-tenant/with-tenant-scope';
import type { KpiSnapshot } from '@/lib/types/kpi';

function ymd(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const cycleId = url.searchParams.get('cycleId');
  const kpiId = url.searchParams.get('kpiId');

  const store = getStore();
  // KpiSnapshot 无 tenantId 列, 经其归属 KPI 做租户隔离 (§23): 先取本租户 KPI id 集合,
  // 不管是否传 cycleId 都只返回本租户快照 (以前无 cycleId 路径会跨租户泄露).
  const tenantKpiIds = new Set(
    (await withTenantScope(store.kpis, auth.tenantId).list())
      .filter((k) => !cycleId || k.cycleId === cycleId)
      .map((k) => k.id),
  );
  const filtered = (await store.kpiSnapshots.list()).filter(
    (s) => tenantKpiIds.has(s.kpiId) && (!kpiId || s.kpiId === kpiId),
  );

  filtered.sort((a, b) => (a.date < b.date ? 1 : -1));
  return NextResponse.json({ snapshots: filtered, total: filtered.length });
}

export async function POST(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, ['admin', 'champion']);
  if (forbidden) return forbidden;

  const url = new URL(req.url);
  const cycleId = url.searchParams.get('cycleId');
  const dateOverride = url.searchParams.get('date'); // 测试用 backfill

  const today = dateOverride ?? ymd();
  const store = getStore();

  const cycles = (await withTenantScope(store.kpiCycles, auth.tenantId).list()).filter(
    (c) => c.status === 'active' && (!cycleId || c.id === cycleId),
  );
  if (cycles.length === 0) {
    return NextResponse.json(
      { ok: false, reason: 'no_active_cycle', message: '无 active 周期可快照' },
      { status: 200 },
    );
  }

  const allKpis = (await withTenantScope(store.kpis, auth.tenantId).list()).filter(
    (k) => cycles.some((c) => c.id === k.cycleId),
  );

  // 已存在的 (kpiId, date) 集合, 避免重复
  const existing = await store.kpiSnapshots.list();
  const existingSet = new Set(existing.map((s) => `${s.kpiId}::${s.date}`));

  const created: KpiSnapshot[] = [];
  const now = new Date().toISOString();
  let skipped = 0;

  for (const k of allKpis) {
    const key = `${k.id}::${today}`;
    if (existingSet.has(key)) {
      skipped++;
      continue;
    }
    const snap = await store.kpiSnapshots.create({
      kpiId: k.id,
      date: today,
      cumulativeValue: k.currentValue,
      source: k.dataSource,
      createdAt: now,
    } as Omit<KpiSnapshot, 'id'>);
    created.push(snap);
  }

  return NextResponse.json({
    ok: true,
    date: today,
    cyclesScanned: cycles.length,
    kpisScanned: allKpis.length,
    snapshotsCreated: created.length,
    snapshotsSkippedExisting: skipped,
  });
}
