/**
 * PMS · 信息管理岗工作台 (Deal Desk Console)
 *
 * 定位: 面向"项目信息管理岗"(销售运营 + 数据管家) 的 exception-driven 工作台.
 *   把该岗位统筹全业务流程的例外工作一屏聚合, 逐条清零:
 *     1. 待仲裁撞单申诉 (pending/under_review)
 *     2. 未解决查重冲突 (warning/duplicate)
 *     3. 商机生命周期预警 (75/90 天无跟进)
 *     4. 数据质量体检 (缺联系方式→查重降级 / 孤儿商机→无项目归属)
 *     5. 合同审批积压
 *
 * 纪律: 纯只读聚合, 不写库; tenantId 隔离; 检测阈值以纯函数暴露 (可测).
 */

import { db } from '../infra/drizzle-client';
import { pmsOpportunities, pmsDuplicateChecks, pmsContracts } from '../infra/drizzle-schema';
import { and, eq, inArray, isNull, desc, sql } from 'drizzle-orm';
import { listAppeals } from './duplicate-appeal-service';
import { REVIEW_REMINDER_DAYS, REVIEW_WARNING_DAYS, REVIEW_RELEASE_DAYS } from './public-pool-service';

// ---------------------------------------------------------------------------
// 阈值 + 纯函数 (可测)
// ---------------------------------------------------------------------------

// 三阶回顾阈值复用公海池单一事实源 (30/60/90)
export const LIFECYCLE_BLUE_DAYS = REVIEW_REMINDER_DAYS;   // 30 天: 回顾提醒
export const LIFECYCLE_YELLOW_DAYS = REVIEW_WARNING_DAYS;  // 60 天: 停滞预警
export const LIFECYCLE_RED_DAYS = REVIEW_RELEASE_DAYS;     // 90 天: 释放公海

/** 距今整天数 (基于最近活动时间: lastFollowUpAt 优先, 否则 createdAt) */
export function daysSinceActivity(lastFollowUpAt: Date | null, createdAt: Date, now: Date): number {
  const base = lastFollowUpAt ?? createdAt;
  return Math.floor((now.getTime() - base.getTime()) / 86400000);
}

/** 生命周期分级 (三阶回顾): red(>=90) / yellow(>=60) / blue(>=30) / ok */
export function classifyLifecycle(days: number): 'ok' | 'blue' | 'yellow' | 'red' {
  if (days >= LIFECYCLE_RED_DAYS) return 'red';
  if (days >= LIFECYCLE_YELLOW_DAYS) return 'yellow';
  if (days >= LIFECYCLE_BLUE_DAYS) return 'blue';
  return 'ok';
}

// ---------------------------------------------------------------------------
// DB 装配
// ---------------------------------------------------------------------------

export interface DealDeskData {
  generatedAt: string;
  appeals: {
    total: number;
    items: Array<{ id: string; duplicateCheckId: string; appealerId: string; reason: string; status: string; createdAt: string }>;
  };
  duplicates: {
    total: number;
    items: Array<{ id: string; status: string; similarityScore: number; dimensions: string[]; duplicateOpportunityId?: string; createdAt: string }>;
  };
  lifecycle: {
    blue: number;
    yellow: number;
    red: number;
    items: Array<{ id: string; customerName: string; projectName: string; stage: string; days: number; level: 'blue' | 'yellow' | 'red' }>;
  };
  dataQuality: {
    missingContact: number;
    orphan: number;
    items: Array<{ id: string; customerName: string; projectName: string; issues: string[] }>;
  };
  contracts: { pending: number; amount: number };
  pendingReviews: {
    total: number;
    items: Array<{ id: string; customerName: string; projectName: string; dealerOrgId: string; estimatedAmount: number; createdAt: string }>;
  };
}

export async function assembleDealDesk(input: { tenantId: string; now?: Date }): Promise<DealDeskData> {
  const { tenantId } = input;
  const now = input.now ?? new Date();

  // 1) 待仲裁申诉 (pending + under_review)
  const [pendingA, reviewA] = await Promise.all([
    listAppeals({ tenantId, status: 'pending', limit: 50 }),
    listAppeals({ tenantId, status: 'under_review', limit: 50 }),
  ]);
  const appealItems = [...pendingA, ...reviewA]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((a) => ({
      id: a.id,
      duplicateCheckId: a.duplicateCheckId,
      appealerId: a.appealerId,
      reason: a.reason,
      status: a.status,
      createdAt: a.createdAt,
    }));

  // 2) 未解决查重冲突 (warning/duplicate)
  const dupRows = await db
    .select()
    .from(pmsDuplicateChecks)
    .where(and(
      eq(pmsDuplicateChecks.tenantId, tenantId),
      inArray(pmsDuplicateChecks.status, ['suspect', 'warning', 'duplicate']),
    ))
    .orderBy(desc(pmsDuplicateChecks.createdAt))
    .limit(50);
  const dupItems = dupRows.map((d) => ({
    id: d.id,
    status: d.status,
    similarityScore: parseFloat(d.similarityScore),
    dimensions: (d.dimensions as string[] | null) ?? [],
    duplicateOpportunityId: d.duplicateOpportunityId || undefined,
    createdAt: d.createdAt.toISOString(),
  }));

  // 3+4) 活跃商机: 生命周期预警 + 数据质量体检 (单次扫描)
  const oppRows = await db
    .select({
      id: pmsOpportunities.id,
      customerName: pmsOpportunities.customerName,
      customerPhone: pmsOpportunities.customerPhone,
      customerAddress: pmsOpportunities.customerAddress,
      projectName: pmsOpportunities.projectName,
      projectId: pmsOpportunities.projectId,
      stage: pmsOpportunities.stage,
      lastFollowUpAt: pmsOpportunities.lastFollowUpAt,
      createdAt: pmsOpportunities.createdAt,
    })
    .from(pmsOpportunities)
    .where(and(
      eq(pmsOpportunities.tenantId, tenantId),
      eq(pmsOpportunities.status, 'active'),
      isNull(pmsOpportunities.archivedAt),
    ));

  const lifecycleItems: DealDeskData['lifecycle']['items'] = [];
  const dqItems: DealDeskData['dataQuality']['items'] = [];
  let blue = 0, yellow = 0, red = 0, missingContact = 0, orphan = 0;

  for (const o of oppRows) {
    const days = daysSinceActivity(o.lastFollowUpAt, o.createdAt, now);
    const level = classifyLifecycle(days);
    if (level !== 'ok') {
      if (level === 'red') red++; else if (level === 'yellow') yellow++; else blue++;
      lifecycleItems.push({ id: o.id, customerName: o.customerName, projectName: o.projectName, stage: o.stage, days, level });
    }
    const issues: string[] = [];
    if (!o.customerPhone && !o.customerAddress) { issues.push('缺联系方式(查重降级)'); missingContact++; }
    else if (!o.customerPhone) issues.push('缺电话');
    else if (!o.customerAddress) issues.push('缺地址');
    if (!o.projectId) { issues.push('孤儿商机(无项目归属)'); orphan++; }
    if (issues.length > 0) {
      dqItems.push({ id: o.id, customerName: o.customerName, projectName: o.projectName, issues });
    }
  }
  lifecycleItems.sort((a, b) => b.days - a.days);

  // 4.5) 待审报备 (pending_review) — 前置审核关卡
  const reviewRows = await db
    .select({
      id: pmsOpportunities.id,
      customerName: pmsOpportunities.customerName,
      projectName: pmsOpportunities.projectName,
      dealerOrgId: pmsOpportunities.dealerOrgId,
      estimatedAmount: pmsOpportunities.estimatedAmount,
      createdAt: pmsOpportunities.createdAt,
    })
    .from(pmsOpportunities)
    .where(and(
      eq(pmsOpportunities.tenantId, tenantId),
      eq(pmsOpportunities.reviewStatus, 'pending_review'),
      isNull(pmsOpportunities.archivedAt),
    ))
    .orderBy(desc(pmsOpportunities.createdAt))
    .limit(50);
  const reviewItems = reviewRows.map((r) => ({
    id: r.id,
    customerName: r.customerName,
    projectName: r.projectName,
    dealerOrgId: r.dealerOrgId,
    estimatedAmount: r.estimatedAmount ? parseFloat(r.estimatedAmount) : 0,
    createdAt: r.createdAt.toISOString(),
  }));

  // 5) 合同审批积压
  const contractAgg = await db
    .select({
      n: sql<number>`count(*)::int`,
      amt: sql<number>`coalesce(sum(cast(${pmsContracts.totalAmount} as double precision)), 0)::float8`,
    })
    .from(pmsContracts)
    .where(and(
      eq(pmsContracts.tenantId, tenantId),
      inArray(pmsContracts.status, ['draft', 'pending']),
    ));

  return {
    generatedAt: now.toISOString(),
    appeals: { total: appealItems.length, items: appealItems.slice(0, 20) },
    duplicates: { total: dupItems.length, items: dupItems.slice(0, 20) },
    lifecycle: { blue, yellow, red, items: lifecycleItems.slice(0, 20) },
    dataQuality: { missingContact, orphan, items: dqItems.slice(0, 20) },
    contracts: { pending: Number(contractAgg[0]?.n ?? 0), amount: Math.round(Number(contractAgg[0]?.amt ?? 0)) },
    pendingReviews: { total: reviewItems.length, items: reviewItems.slice(0, 20) },
  };
}
