/**
 * 预算池管理服务 (PRD §8.2) — 直连 typed 表
 *
 * 部门 × 周期 × 池类型(LIP/MIP/SIP) 的预算池 CRUD。
 * hardCliff=true 时 budgetCeiling 为硬上限, 超出即冻结。
 */

import { and, eq } from 'drizzle-orm';
import { db } from '../infra/drizzle-client';
import { compBudgetPool } from '../infra/drizzle-schema';

export type PoolType = 'lip' | 'mip' | 'sip';
export type PoolStatus = 'draft' | 'active' | 'frozen' | 'closed';

export interface BudgetPoolInput {
  departmentId: string;
  period: string;
  poolType?: PoolType;
  baseAmount: number;
  hardCliff?: boolean;
  budgetCeiling?: number | null;
  qualityCoefficient?: number;
  attendanceBasis?: string;
  params?: Record<string, unknown>;
  status?: PoolStatus;
}

export interface BudgetPoolRow {
  id: string;
  departmentId: string;
  period: string;
  poolType: string;
  baseAmount: number;
  hardCliff: boolean;
  budgetCeiling: number | null;
  qualityCoefficient: number;
  attendanceBasis: string | null;
  params: unknown;
  status: string;
  createdAt: Date;
}

export async function listBudgetPools(
  tenantId: string,
  period?: string,
): Promise<BudgetPoolRow[]> {
  const rows = await db
    .select()
    .from(compBudgetPool)
    .where(eq(compBudgetPool.tenantId, tenantId));

  return rows
    .filter((r) => !period || r.period === period)
    .map((r) => ({
      id: r.id,
      departmentId: r.departmentId,
      period: r.period,
      poolType: r.poolType,
      baseAmount: r.baseAmount,
      hardCliff: r.hardCliff,
      budgetCeiling: r.budgetCeiling,
      qualityCoefficient: Number(r.qualityCoefficient),
      attendanceBasis: r.attendanceBasis,
      params: r.params,
      status: r.status,
      createdAt: r.createdAt,
    }));
}

export async function createBudgetPool(
  tenantId: string,
  input: BudgetPoolInput,
): Promise<{ id: string }> {
  const id = `pool_${tenantId}_${input.departmentId}_${input.period}_${input.poolType ?? 'lip'}`;

  await db
    .insert(compBudgetPool)
    .values({
      id,
      tenantId,
      departmentId: input.departmentId,
      period: input.period,
      poolType: input.poolType ?? 'lip',
      baseAmount: input.baseAmount,
      hardCliff: input.hardCliff ?? true,
      budgetCeiling: input.budgetCeiling ?? null,
      qualityCoefficient: String(input.qualityCoefficient ?? 1),
      attendanceBasis: input.attendanceBasis ?? null,
      params: input.params ?? {},
      status: input.status ?? 'draft',
    })
    .onConflictDoUpdate({
      target: compBudgetPool.id,
      set: {
        baseAmount: input.baseAmount,
        hardCliff: input.hardCliff ?? true,
        budgetCeiling: input.budgetCeiling ?? null,
        qualityCoefficient: String(input.qualityCoefficient ?? 1),
        attendanceBasis: input.attendanceBasis ?? null,
        params: input.params ?? {},
        status: input.status ?? 'draft',
      },
    });

  return { id };
}

export async function updatePoolStatus(
  tenantId: string,
  poolId: string,
  status: PoolStatus,
): Promise<void> {
  await db
    .update(compBudgetPool)
    .set({ status })
    .where(
      and(
        eq(compBudgetPool.tenantId, tenantId),
        eq(compBudgetPool.id, poolId),
      ),
    );
}

export async function deleteBudgetPool(
  tenantId: string,
  poolId: string,
): Promise<void> {
  await db
    .delete(compBudgetPool)
    .where(
      and(
        eq(compBudgetPool.tenantId, tenantId),
        eq(compBudgetPool.id, poolId),
      ),
    );
}
