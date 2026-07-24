/**
 * PMS · 返利政策服务
 */

import { nanoid } from 'nanoid';
import { db } from '../infra/drizzle-client';
import { pmsRebatePolicies, pmsRebateAccruals } from '../infra/drizzle-schema';
import { eq, and, desc } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// 纯函数 (可测) · 阶梯返利计算
// ---------------------------------------------------------------------------

export interface RebateTier {
  minAmount: number;
  maxAmount?: number;
  rebateRate: number; // 返利率 %
}

/** 选中适用阶梯: 命中 [minAmount, maxAmount] 区间中 minAmount 最高的一档 */
export function selectRebateTier(salesAmount: number, tiers: RebateTier[]): RebateTier | null {
  let best: RebateTier | null = null;
  for (const t of tiers) {
    const withinMin = salesAmount >= t.minAmount;
    const withinMax = t.maxAmount == null || salesAmount <= t.maxAmount;
    if (withinMin && withinMax) {
      if (!best || t.minAmount > best.minAmount) best = t;
    }
  }
  return best;
}

/** 按阶梯政策计算返利 (整额按达成档费率, 保留两位) */
export function computeRebate(
  salesAmount: number,
  tiers: RebateTier[],
): { rebateRate: number; rebateAmount: number } {
  if (!(salesAmount > 0) || !Array.isArray(tiers) || tiers.length === 0) {
    return { rebateRate: 0, rebateAmount: 0 };
  }
  const tier = selectRebateTier(salesAmount, tiers);
  if (!tier) return { rebateRate: 0, rebateAmount: 0 };
  // salesAmount * rate/100, 四舍五入到分
  const rebateAmount = Math.round(salesAmount * tier.rebateRate) / 100;
  return { rebateRate: tier.rebateRate, rebateAmount };
}

export interface CreateRebatePolicyInput {
  name: string;
  productLine?: string;
  tiers: RebateTier[];
  effectiveDate: string;
  expiryDate?: string;
  status?: string;
  createdBy: string;
}

export async function createRebatePolicy(
  tenantId: string,
  input: CreateRebatePolicyInput,
): Promise<CreateRebatePolicyInput & { id: string; createdAt: string; updatedAt: string }> {
  const now = new Date();
  const id = nanoid();
  
  await db.insert(pmsRebatePolicies).values({
    id,
    tenantId,
    name: input.name,
    productLine: input.productLine,
    tiers: input.tiers,
    effectiveDate: input.effectiveDate,
    expiryDate: input.expiryDate,
    status: input.status || 'active',
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  });
  
  return { ...input, id, createdAt: now.toISOString(), updatedAt: now.toISOString() };
}

export async function listRebatePolicies(tenantId: string, status?: string): Promise<any[]> {
  const conditions = [eq(pmsRebatePolicies.tenantId, tenantId)];
  if (status) conditions.push(eq(pmsRebatePolicies.status, status));
  
  const rows = await db
    .select()
    .from(pmsRebatePolicies)
    .where(and(...conditions))
    .orderBy(desc(pmsRebatePolicies.createdAt));
  
  return rows.map(row => ({
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    productLine: row.productLine || undefined,
    tiers: row.tiers,
    effectiveDate: row.effectiveDate,
    expiryDate: row.expiryDate || undefined,
    status: row.status,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export interface CreateRebateAccrualInput {
  dealerOrgId: string;
  policyId: string;
  period: string;
  salesAmount: number;
  rebateAmount: number;
  status?: string;
  settledBy?: string;
  settledAt?: Date | null;
}

export async function createRebateAccrual(
  tenantId: string,
  input: CreateRebateAccrualInput,
): Promise<CreateRebateAccrualInput & { id: string; createdAt: string }> {
  const now = new Date();
  const id = nanoid();
  
  await db.insert(pmsRebateAccruals).values({
    id,
    tenantId,
    dealerOrgId: input.dealerOrgId,
    policyId: input.policyId,
    period: input.period,
    salesAmount: input.salesAmount.toString(),
    rebateAmount: input.rebateAmount.toString(),
    status: input.status || 'pending',
    settledBy: input.settledBy,
    settledAt: input.settledAt,
    createdAt: now,
  });
  
  return { ...input, id, createdAt: now.toISOString() };
}

export async function listRebateAccruals(tenantId: string, filters: { dealerOrgId?: string; period?: string; status?: string } = {}): Promise<any[]> {
  const conditions = [eq(pmsRebateAccruals.tenantId, tenantId)];
  
  if (filters.dealerOrgId) conditions.push(eq(pmsRebateAccruals.dealerOrgId, filters.dealerOrgId));
  if (filters.period) conditions.push(eq(pmsRebateAccruals.period, filters.period));
  if (filters.status) conditions.push(eq(pmsRebateAccruals.status, filters.status));
  
  const rows = await db
    .select()
    .from(pmsRebateAccruals)
    .where(and(...conditions))
    .orderBy(desc(pmsRebateAccruals.createdAt));
  
  return rows.map(row => ({
    id: row.id,
    tenantId: row.tenantId,
    dealerOrgId: row.dealerOrgId,
    policyId: row.policyId,
    period: row.period,
    salesAmount: parseFloat(row.salesAmount),
    rebateAmount: parseFloat(row.rebateAmount),
    status: row.status,
    settledBy: row.settledBy || undefined,
    settledAt: row.settledAt?.toISOString() || undefined,
    createdAt: row.createdAt.toISOString(),
  }));
}

/** 获取返利政策详情 */
export async function getRebatePolicy(id: string, tenantId: string): Promise<any | null> {
  const rows = await db
    .select()
    .from(pmsRebatePolicies)
    .where(and(eq(pmsRebatePolicies.id, id), eq(pmsRebatePolicies.tenantId, tenantId)))
    .limit(1);
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    productLine: row.productLine || undefined,
    tiers: row.tiers,
    effectiveDate: row.effectiveDate,
    expiryDate: row.expiryDate || undefined,
    status: row.status,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** 结算返利计提 (pending → settled) */
export async function settleRebateAccrual(input: {
  tenantId: string;
  accrualId: string;
  settledBy: string;
}): Promise<any> {
  const now = new Date();
  const rows = await db
    .select()
    .from(pmsRebateAccruals)
    .where(and(eq(pmsRebateAccruals.id, input.accrualId), eq(pmsRebateAccruals.tenantId, input.tenantId)))
    .limit(1);
  if (rows.length === 0) {
    throw new Error('rebate accrual not found');
  }
  if (rows[0].status === 'settled') {
    throw new Error('rebate accrual already settled');
  }

  await db
    .update(pmsRebateAccruals)
    .set({ status: 'settled', settledBy: input.settledBy, settledAt: now })
    .where(and(eq(pmsRebateAccruals.id, input.accrualId), eq(pmsRebateAccruals.tenantId, input.tenantId)));

  return { accrualId: input.accrualId, status: 'settled', settledBy: input.settledBy, settledAt: now.toISOString() };
}
