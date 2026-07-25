/**
 * PMS · 业绩目标服务 (多维运营)
 *
 * 业务: 维度(region/channel/product_line/dealer_org/sales_person/org) × 周期(月/季/年)
 *       × 目标类型 的目标下达 + 实际自动汇总 + 达成率 + 同比环比.
 * 对齐 drizzle 表 pms_performance_targets.
 * 隔离: 经销商仅见/改 dealerOrgId ∈ visibleOrgIds; 写仅内部.
 */

import { nanoid } from 'nanoid';
import { db } from '../infra/drizzle-client';
import { pmsPerformanceTargets } from '../infra/drizzle-schema';
import { and, eq, desc } from 'drizzle-orm';

/** 运营维度轴 */
export type TargetDimension =
  | 'region'
  | 'channel'
  | 'product_line'
  | 'dealer_org'
  | 'sales_person'
  | 'org';

/** 周期类型 */
export type PeriodType = 'monthly' | 'quarterly' | 'yearly';

export const TARGET_DIMENSIONS: TargetDimension[] = [
  'region',
  'channel',
  'product_line',
  'dealer_org',
  'sales_person',
  'org',
];

// --- 纯函数 (可测) ---

/** 达成率 (%) = actual/target, 保留一位; target<=0 → 0 */
export function computeAchievementRate(actual: number, target: number): number {
  if (!(target > 0)) return 0;
  return Math.round((actual / target) * 1000) / 10;
}

/** 增长率 (%) = (cur-prev)/prev, 保留一位; prev<=0 → null (无可比基期) */
export function computeGrowth(current: number, previous: number): number | null {
  if (!(previous > 0)) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/**
 * 周期 → [start, end) UTC 区间.
 *   monthly   'YYYY-MM'   → 当月
 *   quarterly 'YYYY-Q{n}' → 当季 (3 个月)
 *   yearly    'YYYY'      → 当年
 * 非法格式抛错.
 */
export function periodBounds(period: string, periodType: PeriodType): { start: Date; end: Date } {
  if (periodType === 'yearly') {
    const y = parseInt(period, 10);
    if (!/^\d{4}$/.test(period) || isNaN(y)) throw new Error(`invalid yearly period: ${period}`);
    return { start: new Date(Date.UTC(y, 0, 1)), end: new Date(Date.UTC(y + 1, 0, 1)) };
  }
  if (periodType === 'quarterly') {
    const m = period.match(/^(\d{4})-Q([1-4])$/);
    if (!m) throw new Error(`invalid quarterly period: ${period}`);
    const y = parseInt(m[1], 10);
    const q = parseInt(m[2], 10);
    const startMonth = (q - 1) * 3;
    return { start: new Date(Date.UTC(y, startMonth, 1)), end: new Date(Date.UTC(y, startMonth + 3, 1)) };
  }
  const m = period.match(/^(\d{4})-(\d{2})$/);
  if (!m) throw new Error(`invalid monthly period: ${period}`);
  const y = parseInt(m[1], 10);
  const mon = parseInt(m[2], 10) - 1;
  if (mon < 0 || mon > 11) throw new Error(`invalid monthly period: ${period}`);
  return { start: new Date(Date.UTC(y, mon, 1)), end: new Date(Date.UTC(y, mon + 1, 1)) };
}

/**
 * 求上一比较周期.
 *   kind='yoy' 同比: 去年同期
 *   kind='mom' 环比: 上一个连续周期 (上月/上季/去年)
 * 返回同 periodType 的 period 字符串.
 */
export function shiftPeriod(period: string, periodType: PeriodType, kind: 'yoy' | 'mom'): string {
  if (periodType === 'yearly') {
    const y = parseInt(period, 10);
    return String(y - 1); // yoy 与 mom 对年度而言都是上一年
  }
  if (periodType === 'quarterly') {
    const m = period.match(/^(\d{4})-Q([1-4])$/);
    if (!m) throw new Error(`invalid quarterly period: ${period}`);
    let y = parseInt(m[1], 10);
    let q = parseInt(m[2], 10);
    if (kind === 'yoy') return `${y - 1}-Q${q}`;
    q -= 1;
    if (q < 1) { q = 4; y -= 1; }
    return `${y}-Q${q}`;
  }
  const m = period.match(/^(\d{4})-(\d{2})$/);
  if (!m) throw new Error(`invalid monthly period: ${period}`);
  let y = parseInt(m[1], 10);
  let mon = parseInt(m[2], 10);
  if (kind === 'yoy') return `${y - 1}-${String(mon).padStart(2, '0')}`;
  mon -= 1;
  if (mon < 1) { mon = 12; y -= 1; }
  return `${y}-${String(mon).padStart(2, '0')}`;
}

// --- DB ---

function mapTarget(row: typeof pmsPerformanceTargets.$inferSelect) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    orgId: row.orgId || undefined,
    dealerOrgId: row.dealerOrgId || undefined,
    dimension: (row.dimension || 'org') as TargetDimension,
    dimensionValue: row.dimensionValue || undefined,
    period: row.period,
    periodType: (row.periodType || 'monthly') as PeriodType,
    targetType: row.targetType,
    targetValue: parseFloat(row.targetValue),
    targetCount: row.targetCount != null ? parseFloat(row.targetCount) : undefined,
    actualValue: row.actualValue != null ? parseFloat(row.actualValue) : 0,
    actualCount: row.actualCount != null ? parseFloat(row.actualCount) : 0,
    achievementRate: row.achievementRate != null ? parseFloat(row.achievementRate) : 0,
    yoyGrowth: row.yoyGrowth != null ? parseFloat(row.yoyGrowth) : undefined,
    momGrowth: row.momGrowth != null ? parseFloat(row.momGrowth) : undefined,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createTarget(input: {
  tenantId: string;
  dimension?: TargetDimension;
  dimensionValue?: string;
  orgId?: string;
  dealerOrgId?: string;
  period: string;
  periodType?: PeriodType;
  targetType: string;
  targetValue: number;
  targetCount?: number;
  actualValue?: number;
  createdBy: string;
}) {
  const now = new Date();
  const id = nanoid();
  const actual = input.actualValue ?? 0;
  const rate = computeAchievementRate(actual, input.targetValue);
  // 维度归一: 未显式给 dimension 时从 orgId/dealerOrgId 推导 (向后兼容)
  const dimension: TargetDimension =
    input.dimension ?? (input.dealerOrgId ? 'dealer_org' : 'org');
  const dimensionValue =
    input.dimensionValue ?? input.dealerOrgId ?? input.orgId ?? null;
  const periodType: PeriodType = input.periodType ?? 'monthly';
  await db.insert(pmsPerformanceTargets).values({
    id,
    tenantId: input.tenantId,
    orgId: input.orgId ?? null,
    dealerOrgId: input.dealerOrgId ?? null,
    dimension,
    dimensionValue,
    period: input.period,
    periodType,
    targetType: input.targetType,
    targetValue: input.targetValue.toString(),
    targetCount: input.targetCount != null ? input.targetCount.toString() : null,
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
    dimension,
    dimensionValue: dimensionValue ?? undefined,
    period: input.period,
    periodType,
    targetType: input.targetType,
    targetValue: input.targetValue,
    targetCount: input.targetCount,
    actualValue: actual,
    achievementRate: rate,
    createdBy: input.createdBy,
    createdAt: now.toISOString(),
  };
}

export async function listTargets(filters: {
  tenantId: string;
  period?: string;
  periodType?: PeriodType;
  dimension?: TargetDimension;
  dimensionValue?: string;
  orgId?: string;
  dealerOrgId?: string;
  targetType?: string;
  limit?: number;
  offset?: number;
}): Promise<ReturnType<typeof mapTarget>[]> {
  const conditions = [eq(pmsPerformanceTargets.tenantId, filters.tenantId)];
  if (filters.period) conditions.push(eq(pmsPerformanceTargets.period, filters.period));
  if (filters.periodType) conditions.push(eq(pmsPerformanceTargets.periodType, filters.periodType));
  if (filters.dimension) conditions.push(eq(pmsPerformanceTargets.dimension, filters.dimension));
  if (filters.dimensionValue) conditions.push(eq(pmsPerformanceTargets.dimensionValue, filters.dimensionValue));
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
}) {
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
