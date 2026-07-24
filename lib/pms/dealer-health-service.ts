/**
 * PMS · 经销商健康分服务 (考核=自查同源)
 *
 * 业务: 多维加权评分 (合规/业绩/服务/协作) → 综合分 + 等级. 考核与自查用同一算法.
 * 对齐 drizzle 表 pms_dealer_health_scores (dealerOrgId+period 唯一).
 */

import { nanoid } from 'nanoid';
import { db } from '../infra/drizzle-client';
import { pmsDealerHealthScores } from '../infra/drizzle-schema';
import { and, eq, desc } from 'drizzle-orm';

// --- 纯函数 (可测) ---

export interface HealthDimensions {
  compliance: number; // 资质合规 0-100
  performance: number; // 业绩达成 0-100
  service: number; // 服务质量 0-100
  cooperation: number; // 协作配合 0-100
}

/** 默认维度权重 (合计 1) */
export const DEFAULT_HEALTH_WEIGHTS = {
  compliance: 0.3,
  performance: 0.3,
  service: 0.25,
  cooperation: 0.15,
};

/** 综合健康分 = 各维度加权和, 保留一位 (0-100) */
export function computeHealthScore(
  dims: HealthDimensions,
  weights = DEFAULT_HEALTH_WEIGHTS,
): number {
  const raw =
    dims.compliance * weights.compliance +
    dims.performance * weights.performance +
    dims.service * weights.service +
    dims.cooperation * weights.cooperation;
  return Math.round(raw * 10) / 10;
}

/** 健康等级: >=90 A, >=75 B, >=60 C, 否则 D */
export function healthRank(score: number): 'A' | 'B' | 'C' | 'D' {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  return 'D';
}

// --- DB ---

function mapScore(row: typeof pmsDealerHealthScores.$inferSelect) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    dealerOrgId: row.dealerOrgId,
    period: row.period,
    totalScore: parseFloat(row.totalScore),
    dimensions: row.dimensions,
    rank: row.rank || undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

/** 计算并 upsert 健康分 (按 dealerOrgId+period 唯一) */
export async function upsertHealthScore(input: {
  tenantId: string;
  dealerOrgId: string;
  period: string;
  dimensions: HealthDimensions;
}): Promise<any> {
  const now = new Date();
  const totalScore = computeHealthScore(input.dimensions);
  const rank = healthRank(totalScore);

  const existing = await db
    .select()
    .from(pmsDealerHealthScores)
    .where(and(
      eq(pmsDealerHealthScores.tenantId, input.tenantId),
      eq(pmsDealerHealthScores.dealerOrgId, input.dealerOrgId),
      eq(pmsDealerHealthScores.period, input.period),
    ))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(pmsDealerHealthScores)
      .set({ totalScore: totalScore.toString(), dimensions: input.dimensions as any, rank })
      .where(eq(pmsDealerHealthScores.id, existing[0].id));
    return { id: existing[0].id, ...input, totalScore, rank, updatedAt: now.toISOString() };
  }

  const id = nanoid();
  await db.insert(pmsDealerHealthScores).values({
    id,
    tenantId: input.tenantId,
    dealerOrgId: input.dealerOrgId,
    period: input.period,
    totalScore: totalScore.toString(),
    dimensions: input.dimensions as any,
    rank,
    createdAt: now,
  });
  return { id, ...input, totalScore, rank, createdAt: now.toISOString() };
}

export async function listHealthScores(filters: {
  tenantId: string;
  dealerOrgId?: string;
  period?: string;
  limit?: number;
  offset?: number;
}): Promise<ReturnType<typeof mapScore>[]> {
  const conditions = [eq(pmsDealerHealthScores.tenantId, filters.tenantId)];
  if (filters.dealerOrgId) conditions.push(eq(pmsDealerHealthScores.dealerOrgId, filters.dealerOrgId));
  if (filters.period) conditions.push(eq(pmsDealerHealthScores.period, filters.period));
  const rows = await db
    .select()
    .from(pmsDealerHealthScores)
    .where(and(...conditions))
    .orderBy(desc(pmsDealerHealthScores.createdAt))
    .limit(filters.limit ?? 100)
    .offset(filters.offset ?? 0);
  return rows.map(mapScore);
}
