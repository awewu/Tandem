/**
 * PMS · 公海池 + 90 天管控服务
 *
 * 业务 (CRM-PM-BLUEPRINT L2C):
 *   - 90 天管控: 商机长期未跟进 → 黄色预警(75天) → 红色/释放公海(90天)
 *   - 公海池: 释放的商机进入公海, 其他经销商可认领 (线索回收再分配)
 *   - 保护期: 释放后 N 天内原属主可优先恢复, 到期后任意经销商可认领
 *
 * 状态编码 (不新增 opportunity 列, 复用 status 文本列):
 *   active → released (进入公海) → active (被认领后重新激活)
 * 释放事件与保护期存于 pms_public_pool 表.
 *
 * 触发: 扫描函数为按需/API 触发, 可后续接入定时任务载体 (cron) 无需改动逻辑.
 */

import { nanoid } from 'nanoid';
import { db } from '../infra/drizzle-client';
import { pmsOpportunities, pmsPublicPool } from '../infra/drizzle-schema';
import { and, eq, isNull, lt, or, desc } from 'drizzle-orm';

const DAY_MS = 86_400_000;

// ---------------------------------------------------------------------------
// 纯函数 (可测)
// ---------------------------------------------------------------------------

/** 两个时间点之间的整天数 (向下取整, 不小于 0) */
export function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS));
}

/**
 * 90 天管控预警级别 (纯函数):
 *   >= releaseDays → red  (应释放公海)
 *   >= warningDays → yellow (预警)
 *   否则           → none
 */
export function computeWarningLevel(
  lastActivityAt: Date,
  now: Date,
  warningDays = 75,
  releaseDays = 90,
): { days: number; level: 'none' | 'yellow' | 'red' } {
  const days = daysBetween(lastActivityAt, now);
  let level: 'none' | 'yellow' | 'red' = 'none';
  if (days >= releaseDays) level = 'red';
  else if (days >= warningDays) level = 'yellow';
  return { days, level };
}

/**
 * 公海条目是否可被认领 (纯函数):
 *   - 已认领 → 不可
 *   - 保护期未到 → 不可 (原属主优先恢复期)
 *   - 否则 → 可认领
 */
export function isClaimable(
  entry: { claimed: boolean; protectionExpiresAt?: Date | null },
  now: Date,
): boolean {
  if (entry.claimed) return false;
  if (entry.protectionExpiresAt && entry.protectionExpiresAt.getTime() > now.getTime()) {
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// DB 服务
// ---------------------------------------------------------------------------

export type ReleaseReason = 'ninety_day_timeout' | 'manual_release' | 'dealer_inactive';

/**
 * 释放商机到公海.
 *   - 幂等: 若已存在未认领的公海条目, 直接返回该条目
 *   - 设置 opportunity.status = 'released'
 */
export async function releaseToPool(input: {
  tenantId: string;
  opportunityId: string;
  releasedBy: string;
  releasedReason: ReleaseReason;
  /** 保护期天数 (原属主优先恢复), 0 = 无保护期立即可认领 */
  protectionDays?: number;
}): Promise<{ poolEntryId: string; alreadyInPool: boolean }> {
  const now = new Date();

  const oppRows = await db
    .select()
    .from(pmsOpportunities)
    .where(and(
      eq(pmsOpportunities.id, input.opportunityId),
      eq(pmsOpportunities.tenantId, input.tenantId),
    ))
    .limit(1);
  if (oppRows.length === 0) {
    throw new Error('opportunity not found');
  }

  // 幂等: 已在公海且未被认领
  const existing = await db
    .select()
    .from(pmsPublicPool)
    .where(and(
      eq(pmsPublicPool.tenantId, input.tenantId),
      eq(pmsPublicPool.opportunityId, input.opportunityId),
      eq(pmsPublicPool.claimed, false),
    ))
    .limit(1);
  if (existing.length > 0) {
    return { poolEntryId: existing[0].id, alreadyInPool: true };
  }

  const id = nanoid();
  const protectionDays = input.protectionDays ?? 0;
  const protectionExpiresAt =
    protectionDays > 0 ? new Date(now.getTime() + protectionDays * DAY_MS) : null;

  await db.insert(pmsPublicPool).values({
    id,
    tenantId: input.tenantId,
    opportunityId: input.opportunityId,
    releasedBy: input.releasedBy,
    releasedReason: input.releasedReason,
    releasedAt: now,
    claimed: false,
    claimedBy: null,
    claimedAt: null,
    protectionExpiresAt,
  });

  await db
    .update(pmsOpportunities)
    .set({ status: 'released', updatedAt: now })
    .where(and(
      eq(pmsOpportunities.id, input.opportunityId),
      eq(pmsOpportunities.tenantId, input.tenantId),
    ));

  return { poolEntryId: id, alreadyInPool: false };
}

/**
 * 90 天管控扫描: 找出长期未跟进的活跃商机, 计算预警级别.
 * autoRelease=true 时自动释放红色 (>=releaseDays) 商机到公海.
 *
 * 未跟进基准 = lastFollowUpAt ?? createdAt.
 */
export async function scanExpiringOpportunities(input: {
  tenantId: string;
  warningDays?: number;
  releaseDays?: number;
  autoRelease?: boolean;
  actorId?: string;
  protectionDays?: number;
}): Promise<{
  scanned: number;
  yellow: number;
  red: number;
  released: number;
  items: Array<{ opportunityId: string; orgId: string; days: number; level: 'none' | 'yellow' | 'red' }>;
}> {
  const now = new Date();
  const warningDays = input.warningDays ?? 75;
  const releaseDays = input.releaseDays ?? 90;
  const warnCutoff = new Date(now.getTime() - warningDays * DAY_MS);

  const rows = await db
    .select()
    .from(pmsOpportunities)
    .where(and(
      eq(pmsOpportunities.tenantId, input.tenantId),
      eq(pmsOpportunities.status, 'active'),
      isNull(pmsOpportunities.archivedAt),
      or(
        lt(pmsOpportunities.lastFollowUpAt, warnCutoff),
        and(isNull(pmsOpportunities.lastFollowUpAt), lt(pmsOpportunities.createdAt, warnCutoff)),
      ),
    ));

  const items = rows.map((r) => {
    const lastActivity = r.lastFollowUpAt ?? r.createdAt;
    const { days, level } = computeWarningLevel(lastActivity, now, warningDays, releaseDays);
    return { opportunityId: r.id, orgId: r.orgId, days, level };
  });

  let released = 0;
  if (input.autoRelease) {
    for (const item of items) {
      if (item.level === 'red') {
        await releaseToPool({
          tenantId: input.tenantId,
          opportunityId: item.opportunityId,
          releasedBy: input.actorId ?? '__system__',
          releasedReason: 'ninety_day_timeout',
          protectionDays: input.protectionDays ?? 0,
        });
        released++;
      }
    }
  }

  return {
    scanned: items.length,
    yellow: items.filter((i) => i.level === 'yellow').length,
    red: items.filter((i) => i.level === 'red').length,
    released,
    items,
  };
}

/**
 * 认领公海商机: 校验可认领 → 标记已认领 → 将商机改归属到认领方并重新激活.
 */
export async function claimFromPool(input: {
  tenantId: string;
  poolEntryId: string;
  claimerUserId: string;
  claimerOrgId: string;
}): Promise<{ poolEntryId: string; opportunityId: string; claimedBy: string }> {
  const now = new Date();

  const entryRows = await db
    .select()
    .from(pmsPublicPool)
    .where(and(
      eq(pmsPublicPool.id, input.poolEntryId),
      eq(pmsPublicPool.tenantId, input.tenantId),
    ))
    .limit(1);
  if (entryRows.length === 0) {
    throw new Error('pool entry not found');
  }
  const entry = entryRows[0];

  if (!isClaimable(entry, now)) {
    throw new Error('pool entry not claimable');
  }

  await db
    .update(pmsPublicPool)
    .set({ claimed: true, claimedBy: input.claimerUserId, claimedAt: now })
    .where(and(
      eq(pmsPublicPool.id, input.poolEntryId),
      eq(pmsPublicPool.tenantId, input.tenantId),
    ));

  await db
    .update(pmsOpportunities)
    .set({
      orgId: input.claimerOrgId,
      dealerOrgId: input.claimerOrgId,
      reporterId: input.claimerUserId,
      status: 'active',
      lastFollowUpAt: now,
      updatedAt: now,
    })
    .where(and(
      eq(pmsOpportunities.id, entry.opportunityId),
      eq(pmsOpportunities.tenantId, input.tenantId),
    ));

  return { poolEntryId: input.poolEntryId, opportunityId: entry.opportunityId, claimedBy: input.claimerUserId };
}

/**
 * 公海列表 (含商机摘要). 公海是公共资源, 内部与经销商均可浏览可认领条目.
 */
export async function listPublicPool(input: {
  tenantId: string;
  includeClaimed?: boolean;
  limit?: number;
  offset?: number;
}) {
  const conditions = [eq(pmsPublicPool.tenantId, input.tenantId)];
  if (!input.includeClaimed) conditions.push(eq(pmsPublicPool.claimed, false));

  const rows = await db
    .select()
    .from(pmsPublicPool)
    .where(and(...conditions))
    .orderBy(desc(pmsPublicPool.releasedAt))
    .limit(input.limit ?? 50)
    .offset(input.offset ?? 0);

  return Promise.all(
    rows.map(async (r) => {
      const oppRows = await db
        .select()
        .from(pmsOpportunities)
        .where(eq(pmsOpportunities.id, r.opportunityId))
        .limit(1);
      const opp = oppRows[0];
      return {
        id: r.id,
        opportunityId: r.opportunityId,
        releasedBy: r.releasedBy,
        releasedReason: r.releasedReason,
        releasedAt: r.releasedAt.toISOString(),
        claimed: r.claimed,
        claimedBy: r.claimedBy || undefined,
        claimedAt: r.claimedAt?.toISOString() || undefined,
        protectionExpiresAt: r.protectionExpiresAt?.toISOString() || undefined,
        opportunity: opp
          ? {
              customerName: opp.customerName,
              projectName: opp.projectName,
              region: opp.region || undefined,
              productLine: opp.productLine || undefined,
              estimatedAmount: opp.estimatedAmount ? parseFloat(opp.estimatedAmount) : undefined,
            }
          : undefined,
      };
    }),
  );
}
