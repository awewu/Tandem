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
  const all = (await store.kpiSnapshots.list()).filter((s) => {
    if (kpiId && s.kpiId !== kpiId) return false;
    return true;
  });

  // 若指定了 cycleId, 用 KPI 引用过滤
  let filtered = all;
  if (cycleId) {
    const kpiIds = new Set(
      (await store.kpis.list())
        .filter((k) => k.tenantId === auth.tenantId && k.cycleId === cycleId)
        .map((k) => k.id),
    );
    filtered = all.filter((s) => kpiIds.has(s.kpiId));
  }

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

  const cycles = (await store.kpiCycles.list()).filter(
    (c) => c.tenantId === auth.tenantId && c.status === 'active' && (!cycleId || c.id === cycleId),
  );
  if (cycles.length === 0) {
    return NextResponse.json(
      { ok: false, reason: 'no_active_cycle', message: '无 active 周期可快照' },
      { status: 200 },
    );
  }

  const allKpis = (await store.kpis.list()).filter(
    (k) =>
      k.tenantId === auth.tenantId && cycles.some((c) => c.id === k.cycleId),
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
