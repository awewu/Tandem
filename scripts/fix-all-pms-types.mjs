#!/usr/bin/env node
/**
 * 完整修复所有 PMS Service 层类型错误
 * 严格对齐 lib/types/pms.ts
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

console.log('🔧 开始完整修复 PMS Service 层类型...\n');

const services = {
  'rebate-service.ts': `/**
 * PMS · 返利政策服务
 */

import { nanoid } from 'nanoid';
import { db } from '../infra/drizzle-client';
import { pmsRebatePolicies, pmsRebateAccruals } from '../infra/drizzle-schema';
import { eq, and, desc } from 'drizzle-orm';
import type { RebatePolicy, RebateAccrual } from '@/lib/types/pms';

export async function createRebatePolicy(tenantId: string, input: Omit<RebatePolicy, 'id' | 'createdAt' | 'updatedAt'>): Promise<RebatePolicy> {
  const now = new Date();
  const id = nanoid();
  
  await db.insert(pmsRebatePolicies).values({
    id,
    tenantId,
    name: input.name,
    dealerLevel: input.dealerLevel,
    productCategories: input.productCategories || [],
    tiers: input.tiers,
    settlementPeriod: input.settlementPeriod,
    isActive: input.isActive,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  });
  
  return { ...input, id, createdAt: now.toISOString(), updatedAt: now.toISOString() };
}

export async function listRebatePolicies(tenantId: string, isActive?: boolean): Promise<RebatePolicy[]> {
  const conditions = [eq(pmsRebatePolicies.tenantId, tenantId)];
  if (isActive !== undefined) conditions.push(eq(pmsRebatePolicies.isActive, isActive));
  
  const rows = await db
    .select()
    .from(pmsRebatePolicies)
    .where(and(...conditions))
    .orderBy(desc(pmsRebatePolicies.createdAt));
  
  return rows.map(row => ({
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    dealerLevel: row.dealerLevel as 'primary' | 'secondary' | 'all',
    productCategories: (row.productCategories as string[]) || undefined,
    tiers: row.tiers as any,
    settlementPeriod: row.settlementPeriod as 'monthly' | 'quarterly' | 'yearly',
    isActive: row.isActive,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo || undefined,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function createRebateAccrual(tenantId: string, input: Omit<RebateAccrual, 'id' | 'createdAt' | 'updatedAt'>): Promise<RebateAccrual> {
  const now = new Date();
  const id = nanoid();
  
  await db.insert(pmsRebateAccruals).values({
    id,
    tenantId,
    dealerOrgId: input.dealerOrgId,
    policyId: input.policyId,
    period: input.period,
    totalSalesAmount: input.totalSalesAmount.toString(),
    rebateRate: input.rebateRate.toString(),
    rebateAmount: input.rebateAmount.toString(),
    status: input.status,
    approvedBy: input.approvedBy,
    approvedAt: input.approvedAt,
    paidAt: input.paidAt,
    rejectionReason: input.rejectionReason,
    createdAt: now,
    updatedAt: now,
  });
  
  return { ...input, id, createdAt: now.toISOString(), updatedAt: now.toISOString() };
}

export async function listRebateAccruals(tenantId: string, filters: { dealerOrgId?: string; period?: string; status?: string } = {}): Promise<RebateAccrual[]> {
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
    totalSalesAmount: parseFloat(row.totalSalesAmount),
    rebateRate: parseFloat(row.rebateRate),
    rebateAmount: parseFloat(row.rebateAmount),
    status: row.status as 'accrued' | 'approved' | 'paid' | 'rejected',
    approvedBy: row.approvedBy || undefined,
    approvedAt: row.approvedAt || undefined,
    paidAt: row.paidAt || undefined,
    rejectionReason: row.rejectionReason || undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}
`
};

let fixed = 0;
for (const [filename, content] of Object.entries(services)) {
  const filepath = join(projectRoot, 'lib/pms', filename);
  writeFileSync(filepath, content, 'utf8');
  console.log(`✅ 修复: ${filename}`);
  fixed++;
}

console.log(`\n📊 修复统计: ${fixed} 个文件`);
console.log('✨ 类型修复完成！\n');
