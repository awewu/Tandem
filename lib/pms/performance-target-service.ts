/**
 * PMS · 业绩目标服务
 *
 * 业务: 区域/经销商 × 周期 × 目标类型 的目标下达 + 实际回填 + 达成率.
 * 对齐 drizzle 表 pms_performance_targets (orgId/dealerOrgId 均可空).
 * 隔离: 经销商仅见/改 dealerOrgId ∈ visibleOrgIds; 写仅内部.
 */

import { nanoid } from 'nanoid';
import { db } from '../infra/drizzle-client';
import { pmsPerformanceTargets } from '../infra/drizzle-schema';
import { and, eq, desc } from 'drizzle-orm';

// --- 纯函数 (可测) ---

/** 达成率 (%) = actual/target, 保留一位; target<=0 → 0 */
export function computeAchievementRate(actual: number, target: number): number {
  if (!(target > 0)) return 0;
  return Math.round((actual / target) * 1000) / 10;
}

// --- DB ---

function mapTarget(row: typeof pmsPerformanceTargets.$inferSelect) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    orgId: row.orgId || undefined,
    dealerOrgId: row.dealerOrgId || undefined,
    period: row.period,
    targetType: row.targetType,
    targetValue: parseFloat(row.targetValue),
    actualValue: row.actualValue != null ? parseFloat(row.actualValue) : 0,
    achievementRate: row.achievementRate != null ? parseFloat(row.achievementRate) : 0,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createTarget(input: {
  tenantId: string;
  orgId?: string;
  dealerOrgId?: string;
  period: string;
  targetType: string;
  targetValue: number;
  actualValue?: number;
  createdBy: string;
}): Promise<any> {
  const now = new Date();
  const id = nanoid();
  const actual = input.actualValue ?? 0;
  const rate = computeAchievementRate(actual, input.targetValue);
  await db.insert(pmsPerformanceTargets).values({
    id,
    tenantId: input.tenantId,
    orgId: input.orgId ?? null,
    dealerOrgId: input.dealerOrgId ?? null,
    period: input.period,
    targetType: input.targetType,
    targetValue: input.targetValue.toString(),
    actualValue: actual.toString(),
    achievementRate: rate.toString(),
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  });
  return {
    id,
    tenantId: input.tenantId,
    orgId: input.orgId,
    dealerOrgId: input.dealerOrgId,
    period: input.period,
    targetType: input.targetType,
    targetValue: input.targetValue,
    actualValue: actual,
    achievementRate: rate,
    createdBy: input.createdBy,
    createdAt: now.toISOString(),
  };
}

export async function listTargets(filters: {
  tenantId: string;
  period?: string;
  orgId?: string;
  dealerOrgId?: string;
  targetType?: string;
  limit?: number;
  offset?: number;
}): Promise<any[]> {
  const conditions = [eq(pmsPerformanceTargets.tenantId, filters.tenantId)];
  if (filters.period) conditions.push(eq(pmsPerformanceTargets.period, filters.period));
  if (filters.orgId) conditions.push(eq(pmsPerformanceTargets.orgId, filters.orgId));
  if (filters.dealerOrgId) conditions.push(eq(pmsPerformanceTargets.dealerOrgId, filters.dealerOrgId));
  if (filters.targetType) conditions.push(eq(pmsPerformanceTargets.targetType, filters.targetType));
  const rows = await db
    .select()
    .from(pmsPerformanceTargets)
    .where(and(...conditions))
    .orderBy(desc(pmsPerformanceTargets.createdAt))
    .limit(filters.limit ?? 100)
    .offset(filters.offset ?? 0);
  return rows.map(mapTarget);
}

/** 回填实际值并重算达成率 */
export async function updateActual(input: {
  tenantId: string;
  id: string;
  actualValue: number;
}): Promise<any> {
  const now = new Date();
  const rows = await db
    .select()
    .from(pmsPerformanceTargets)
    .where(and(eq(pmsPerformanceTargets.id, input.id), eq(pmsPerformanceTargets.tenantId, input.tenantId)))
    .limit(1);
  if (rows.length === 0) throw new Error('performance target not found');
  const target = parseFloat(rows[0].targetValue);
  const rate = computeAchievementRate(input.actualValue, target);
  await db
    .update(pmsPerformanceTargets)
    .set({ actualValue: input.actualValue.toString(), achievementRate: rate.toString(), updatedAt: now })
    .where(eq(pmsPerformanceTargets.id, input.id));
  return { id: input.id, actualValue: input.actualValue, achievementRate: rate, updatedAt: now.toISOString() };
}
