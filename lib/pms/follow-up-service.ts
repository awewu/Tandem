/**
 * PMS · 跟进记录服务
 * 严格对齐 Drizzle Schema 字段名
 */

import { nanoid } from 'nanoid';
import { db } from '../infra/drizzle-client';
import { pmsFollowUps, pmsOpportunities } from '../infra/drizzle-schema';
import { eq, and, desc } from 'drizzle-orm';

/**
 * 创建跟进记录
 */
export async function createFollowUp(input: {
  tenantId: string;
  opportunityId: string;
  userId: string;
  stage: string;
  content: string;
  nextFollowUpAt?: string;
}): Promise<any> {
  const now = new Date();
  const id = nanoid();
  
  // 1. 创建跟进记录
  await db.insert(pmsFollowUps).values({
    id,
    tenantId: input.tenantId,
    opportunityId: input.opportunityId,
    userId: input.userId,
    stage: input.stage,
    content: input.content,
    nextFollowUpAt: input.nextFollowUpAt ? new Date(input.nextFollowUpAt) : null,
    createdAt: now,
  });
  
  // 2. 更新商机的最后跟进时间
  await db
    .update(pmsOpportunities)
    .set({
      lastFollowUpAt: now,
      updatedAt: now,
    })
    .where(and(
      eq(pmsOpportunities.id, input.opportunityId),
      eq(pmsOpportunities.tenantId, input.tenantId)
    ));
  
  return {
    id,
    ...input,
    createdAt: now.toISOString(),
  };
}

/**
 * 列表查询跟进记录
 */
export async function listFollowUps(filters: {
  tenantId: string;
  opportunityId?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}): Promise<any[]> {
  const conditions = [eq(pmsFollowUps.tenantId, filters.tenantId)];
  
  if (filters.opportunityId) conditions.push(eq(pmsFollowUps.opportunityId, filters.opportunityId));
  if (filters.userId) conditions.push(eq(pmsFollowUps.userId, filters.userId));
  
  const rows = await db
    .select()
    .from(pmsFollowUps)
    .where(and(...conditions))
    .orderBy(desc(pmsFollowUps.createdAt))
    .limit(filters.limit || 50)
    .offset(filters.offset || 0);
  
  return rows.map(row => ({
    id: row.id,
    tenantId: row.tenantId,
    opportunityId: row.opportunityId,
    userId: row.userId,
    stage: row.stage,
    content: row.content,
    nextFollowUpAt: row.nextFollowUpAt?.toISOString() || undefined,
    createdAt: row.createdAt.toISOString(),
  }));
}

/**
 * 获取商机的跟进历史
 */
export async function getOpportunityFollowUps(
  opportunityId: string,
  tenantId: string,
  limit = 20
): Promise<any[]> {
  const rows = await db
    .select()
    .from(pmsFollowUps)
    .where(and(
      eq(pmsFollowUps.opportunityId, opportunityId),
      eq(pmsFollowUps.tenantId, tenantId)
    ))
    .orderBy(desc(pmsFollowUps.createdAt))
    .limit(limit);
  
  return rows.map(row => ({
    id: row.id,
    tenantId: row.tenantId,
    opportunityId: row.opportunityId,
    userId: row.userId,
    stage: row.stage,
    content: row.content,
    nextFollowUpAt: row.nextFollowUpAt?.toISOString() || undefined,
    createdAt: row.createdAt.toISOString(),
  }));
}
