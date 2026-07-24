/**
 * PMS · 分析看板服务 (只读聚合)
 *
 * 业务 (CRM-PM-BLUEPRINT):
 *   - 商机漏斗 (阶段分布) / 状态分布 / 区域分布 / 赢单率 / 管道金额
 *   - 纯只读, 不写库; orgId 隔离 (内部全量, 经销商仅本 org)
 *
 * 聚合在 JS 层完成 (纯函数可测); 大规模可后续下推 SQL group by.
 */

import { db } from '../infra/drizzle-client';
import { pmsOpportunities } from '../infra/drizzle-schema';
import { and, eq, isNull, inArray, gte, lte } from 'drizzle-orm';

const ANALYTICS_ROW_CAP = 10000;

/** 标准商机阶段顺序 (漏斗展示) */
export const STANDARD_STAGE_ORDER = [
  'initial_contact',
  'following',
  'quoted',
  'contracted',
  'delivered',
  'closed',
];

// ---------------------------------------------------------------------------
// 纯函数 (可测)
// ---------------------------------------------------------------------------

export interface AnalyticsOpp {
  stage: string;
  status: string;
  estimatedAmount?: number;
  region?: string;
}

/** 赢单率 (%) = won / (won + lost), 保留一位小数; 分母为 0 → 0 */
export function winRate(won: number, lost: number): number {
  const denom = won + lost;
  if (denom <= 0) return 0;
  return Math.round((won / denom) * 1000) / 10;
}

function tally(items: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of items) {
    const key = k || 'unknown';
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

/** 汇总商机分析指标 */
export function summarizeOpportunities(opps: AnalyticsOpp[]): {
  total: number;
  byStatus: Record<string, number>;
  byStage: Record<string, number>;
  byRegion: Record<string, number>;
  totalPipeline: number;
  wonAmount: number;
  won: number;
  lost: number;
  winRate: number;
} {
  const byStatus = tally(opps.map((o) => o.status));
  const byStage = tally(opps.map((o) => o.stage));
  const byRegion = tally(opps.map((o) => o.region || 'unknown'));

  let totalPipeline = 0;
  let wonAmount = 0;
  for (const o of opps) {
    const amt = o.estimatedAmount ?? 0;
    if (o.status === 'active') totalPipeline += amt;
    if (o.status === 'won') wonAmount += amt;
  }

  const won = byStatus['won'] ?? 0;
  const lost = byStatus['lost'] ?? 0;

  return {
    total: opps.length,
    byStatus,
    byStage,
    byRegion,
    totalPipeline: Math.round(totalPipeline * 100) / 100,
    wonAmount: Math.round(wonAmount * 100) / 100,
    won,
    lost,
    winRate: winRate(won, lost),
  };
}

/** 按标准阶段顺序构建漏斗 [{stage,count}] */
export function buildFunnel(
  byStage: Record<string, number>,
  order: string[] = STANDARD_STAGE_ORDER,
): Array<{ stage: string; count: number }> {
  return order.map((stage) => ({ stage, count: byStage[stage] ?? 0 }));
}

// ---------------------------------------------------------------------------
// DB 聚合查询
// ---------------------------------------------------------------------------

/** 商机分析 (orgId 隔离). 内部传 visibleOrgIds=undefined 全量. */
export async function getOpportunityAnalytics(input: {
  tenantId: string;
  visibleOrgIds?: string[];
  region?: string;
  productLine?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<any> {
  const conditions = [
    eq(pmsOpportunities.tenantId, input.tenantId),
    isNull(pmsOpportunities.archivedAt),
  ];
  if (input.visibleOrgIds && input.visibleOrgIds.length > 0) {
    conditions.push(inArray(pmsOpportunities.orgId, input.visibleOrgIds));
  }
  if (input.region) conditions.push(eq(pmsOpportunities.region, input.region));
  if (input.productLine) conditions.push(eq(pmsOpportunities.productLine, input.productLine));
  if (input.dateFrom) conditions.push(gte(pmsOpportunities.createdAt, new Date(input.dateFrom)));
  if (input.dateTo) conditions.push(lte(pmsOpportunities.createdAt, new Date(input.dateTo)));

  const rows = await db
    .select({
      stage: pmsOpportunities.stage,
      status: pmsOpportunities.status,
      estimatedAmount: pmsOpportunities.estimatedAmount,
      region: pmsOpportunities.region,
    })
    .from(pmsOpportunities)
    .where(and(...conditions))
    .limit(ANALYTICS_ROW_CAP);

  const opps: AnalyticsOpp[] = rows.map((r) => ({
    stage: r.stage,
    status: r.status,
    estimatedAmount: r.estimatedAmount != null ? parseFloat(r.estimatedAmount) : undefined,
    region: r.region || undefined,
  }));

  const summary = summarizeOpportunities(opps);
  return {
    ...summary,
    funnel: buildFunnel(summary.byStage),
  };
}
