/**
 * PMS · 商机管理服务
 * 严格对齐 Drizzle Schema 字段名
 */

import { nanoid } from 'nanoid';
import { db } from '../infra/drizzle-client';
import { pmsOpportunities, pmsDuplicateChecks } from '../infra/drizzle-schema';
import { eq, and, desc, isNull, inArray } from 'drizzle-orm';
import { checkDuplicate } from './duplicate-check';

/**
 * 生成查重键
 */
export function generateDedupeKey(customerName: string, customerAddress: string, projectName: string): string {
  const combined = `${customerName}|${customerAddress}|${projectName}`.toLowerCase();
  return Buffer.from(combined).toString('base64').substring(0, 32);
}

/**
 * 创建商机（含自动查重）
 */
export async function createOpportunity(input: {
  tenantId: string;
  orgId: string;
  dealerOrgId: string;
  reporterId: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  projectName: string;
  stage?: string;
  status?: string;
  estimatedAmount?: number;
  estimatedClosingDate?: string;
  productLine?: string;
  region?: string;
  channel?: string;
}): Promise<{ opportunity?: any; duplicateCheck?: any }> {
  const now = new Date();
  
  // 1. 生成查重键
  const dedupeKey = generateDedupeKey(
    input.customerName,
    input.customerAddress || '',
    input.projectName
  );
  
  // 2. 智能查重
  const duplicateResult = await checkDuplicate({
    tenantId: input.tenantId,
    customerName: input.customerName,
    customerAddress: input.customerAddress,
    customerPhone: input.customerPhone,
    projectName: input.projectName,
  });
  
  // 3. 如果查重失败（撞单），返回查重结果
  if (duplicateResult.status === 'duplicate') {
    return {
      opportunity: undefined,
      duplicateCheck: duplicateResult,
    };
  }
  
  // 4. 创建商机 (dedupeKey 唯一索引 pms_opp_dedupkey_idx 兜底并发精确撞单)
  const id = nanoid();
  
  try {
    await db.insert(pmsOpportunities).values({
      id,
      tenantId: input.tenantId,
      orgId: input.orgId,
      dealerOrgId: input.dealerOrgId,
      reporterId: input.reporterId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerAddress: input.customerAddress,
      projectName: input.projectName,
      stage: input.stage || 'initial_contact',
      status: input.status || 'active',
      estimatedAmount: input.estimatedAmount?.toString(),
      estimatedClosingDate: input.estimatedClosingDate,
      productLine: input.productLine,
      region: input.region,
      channel: input.channel,
      dedupeKey,
      duplicateStatus: duplicateResult.status === 'warning' ? 'questioned' : null,
      lastFollowUpAt: null,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    });
  } catch (err: any) {
    // Postgres 唯一约束冲突 (23505) → 并发精确撞单, 五维查重未及拦截
    if (err?.code === '23505') {
      return {
        opportunity: undefined,
        duplicateCheck: {
          status: 'duplicate' as const,
          matchedOpportunities: [],
          matchDetails: [],
          reason: 'concurrent_exact_duplicate',
        },
      };
    }
    throw err;
  }
  
  const opportunity = {
    id,
    ...input,
    dedupeKey,
    duplicateStatus: duplicateResult.status === 'warning' ? 'questioned' : null,
    lastFollowUpAt: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  
  return {
    opportunity,
    duplicateCheck: duplicateResult.status === 'warning' ? duplicateResult : undefined,
  };
}

/**
 * 更新商机
 */
export async function updateOpportunity(
  opportunityId: string,
  input: {
    stage?: string;
    status?: string;
    estimatedAmount?: number;
    estimatedClosingDate?: string;
    productLine?: string;
    region?: string;
    channel?: string;
  },
  tenantId: string
): Promise<any> {
  const now = new Date();
  
  await db
    .update(pmsOpportunities)
    .set({
      ...input,
      estimatedAmount: input.estimatedAmount?.toString(),
      updatedAt: now,
    })
    .where(and(
      eq(pmsOpportunities.id, opportunityId),
      eq(pmsOpportunities.tenantId, tenantId)
    ));
  
  return { id: opportunityId, ...input, updatedAt: now.toISOString() };
}

/**
 * 获取商机详情
 */
export async function getOpportunity(
  opportunityId: string,
  tenantId: string,
  visibleOrgIds?: string[]
): Promise<any | null> {
  const rows = await db
    .select()
    .from(pmsOpportunities)
    .where(and(
      eq(pmsOpportunities.id, opportunityId),
      eq(pmsOpportunities.tenantId, tenantId)
    ))
    .limit(1);
  
  if (rows.length === 0) return null;
  
  const row = rows[0];
  // orgId 隔离: 外部经销商仅可见自身 org 集合 (内部传 undefined = 全通)
  if (visibleOrgIds && visibleOrgIds.length > 0 && !visibleOrgIds.includes(row.orgId)) {
    return null;
  }
  return {
    id: row.id,
    tenantId: row.tenantId,
    orgId: row.orgId,
    dealerOrgId: row.dealerOrgId,
    reporterId: row.reporterId,
    customerName: row.customerName,
    customerPhone: row.customerPhone || undefined,
    customerAddress: row.customerAddress || undefined,
    projectName: row.projectName,
    stage: row.stage,
    status: row.status,
    estimatedAmount: row.estimatedAmount ? parseFloat(row.estimatedAmount) : undefined,
    estimatedClosingDate: row.estimatedClosingDate || undefined,
    productLine: row.productLine || undefined,
    region: row.region || undefined,
    channel: row.channel || undefined,
    dedupeKey: row.dedupeKey,
    duplicateStatus: row.duplicateStatus || undefined,
    lastFollowUpAt: row.lastFollowUpAt?.toISOString() || undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    archivedAt: row.archivedAt?.toISOString() || undefined,
  };
}

/**
 * 列表查询商机
 */
export async function listOpportunities(filters: {
  tenantId: string;
  orgId?: string;
  dealerOrgId?: string;
  stage?: string;
  status?: string;
  limit?: number;
  offset?: number;
  /** 外部经销商可见 org 集合. 传入且非空 → 强制 orgId ∈ 集合. 内部角色传 undefined = 全通. */
  visibleOrgIds?: string[];
}): Promise<any[]> {
  const conditions = [eq(pmsOpportunities.tenantId, filters.tenantId)];
  
  if (filters.orgId) conditions.push(eq(pmsOpportunities.orgId, filters.orgId));
  if (filters.dealerOrgId) conditions.push(eq(pmsOpportunities.dealerOrgId, filters.dealerOrgId));
  if (filters.stage) conditions.push(eq(pmsOpportunities.stage, filters.stage));
  if (filters.status) conditions.push(eq(pmsOpportunities.status, filters.status));
  
  // orgId 隔离 (P0/RK2): 外部经销商仅可见自身 org 集合
  if (filters.visibleOrgIds && filters.visibleOrgIds.length > 0) {
    conditions.push(inArray(pmsOpportunities.orgId, filters.visibleOrgIds));
  }
  
  // 只查询未归档的
  conditions.push(isNull(pmsOpportunities.archivedAt));
  
  const rows = await db
    .select()
    .from(pmsOpportunities)
    .where(and(...conditions))
    .orderBy(desc(pmsOpportunities.createdAt))
    .limit(filters.limit || 50)
    .offset(filters.offset || 0);
  
  return rows.map(row => ({
    id: row.id,
    tenantId: row.tenantId,
    orgId: row.orgId,
    dealerOrgId: row.dealerOrgId,
    reporterId: row.reporterId,
    customerName: row.customerName,
    customerPhone: row.customerPhone || undefined,
    customerAddress: row.customerAddress || undefined,
    projectName: row.projectName,
    stage: row.stage,
    status: row.status,
    estimatedAmount: row.estimatedAmount ? parseFloat(row.estimatedAmount) : undefined,
    estimatedClosingDate: row.estimatedClosingDate || undefined,
    productLine: row.productLine || undefined,
    region: row.region || undefined,
    channel: row.channel || undefined,
    dedupeKey: row.dedupeKey,
    duplicateStatus: row.duplicateStatus || undefined,
    lastFollowUpAt: row.lastFollowUpAt?.toISOString() || undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

/**
 * 归档商机（软删除）
 */
export async function archiveOpportunity(opportunityId: string, tenantId: string): Promise<void> {
  const now = new Date();
  
  await db
    .update(pmsOpportunities)
    .set({ archivedAt: now, updatedAt: now })
    .where(and(
      eq(pmsOpportunities.id, opportunityId),
      eq(pmsOpportunities.tenantId, tenantId)
    ));
}
