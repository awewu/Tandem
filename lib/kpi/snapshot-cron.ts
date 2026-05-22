/**
 * KPI 每日快照 cron (慢速扫描子任务)
 *
 * 每次调用都尝试为今天 (YYYY-MM-DD) 的所有 active cycle KPI 写一条 KpiSnapshot.
 * 已存在的 (kpiId, date) 会被跳过, 因此一日内可被多次调用而不重复.
 *
 * 调用入口:
 *   - 慢速扫描 cron (boot.ts runSlowScans, 10min 一次)
 *   - 手动 POST /api/kpi/snapshots
 */

import { getStore } from '@/lib/storage/repository';
import type { KpiSnapshot } from '@/lib/types/kpi';

function ymd(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export async function scanKpiSnapshots(): Promise<{
  date: string;
  scanned: number;
  created: number;
  skipped: number;
}> {
  const today = ymd();
  const store = getStore();

  const activeCycles = (await store.kpiCycles.list()).filter((c) => c.status === 'active');
  if (activeCycles.length === 0) {
    return { date: today, scanned: 0, created: 0, skipped: 0 };
  }
  const activeCycleIds = new Set(activeCycles.map((c) => c.id));

  const kpis = (await store.kpis.list()).filter((k) => activeCycleIds.has(k.cycleId));
  const existing = await store.kpiSnapshots.list();
  const existingSet = new Set(existing.map((s) => `${s.kpiId}::${s.date}`));

  const now = new Date().toISOString();
  let created = 0;
  let skipped = 0;
  for (const k of kpis) {
    if (existingSet.has(`${k.id}::${today}`)) {
      skipped++;
      continue;
    }
    await store.kpiSnapshots.create({
      kpiId: k.id,
      date: today,
      cumulativeValue: k.currentValue,
      source: k.dataSource,
      createdAt: now,
    } as Omit<KpiSnapshot, 'id'>);
    created++;
  }
  return { date: today, scanned: kpis.length, created, skipped };
}
