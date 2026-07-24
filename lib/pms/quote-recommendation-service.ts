/**
 * PMS · AI 报价推荐服务 (预留接口, 待恒热算法融入)
 *
 * 业务: 依客户需求 → AI 生成候选配置+报价 → 销售采纳/驳回.
 * 对齐 drizzle 表 pms_quote_recommendations.
 */

import { nanoid } from 'nanoid';
import { db } from '../infra/drizzle-client';
import { pmsQuoteRecommendations } from '../infra/drizzle-schema';
import { and, eq, desc } from 'drizzle-orm';
import type { QuoteRecommendation } from '@/lib/types/pms';

export interface CreateQuoteRecommendationInput {
  opportunityId?: string;
  customerRequirements: QuoteRecommendation['customerRequirements'];
  recommendations: QuoteRecommendation['recommendations'];
  aiModel?: string;
  status?: string;
  createdBy: string;
}

// --- 纯函数 (可测) ---

export interface Recommendation {
  model?: string;
  price?: number;
  score?: number;
  [k: string]: unknown;
}

/** 取评分最高的推荐 (score 缺失视为 0); 空 → null */
export function pickTopRecommendation(recommendations: Recommendation[]): Recommendation | null {
  if (!Array.isArray(recommendations) || recommendations.length === 0) return null;
  let best = recommendations[0];
  for (const r of recommendations) {
    if ((r.score ?? 0) > (best.score ?? 0)) best = r;
  }
  return best;
}

// --- DB ---

function mapRec(row: typeof pmsQuoteRecommendations.$inferSelect) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    opportunityId: row.opportunityId || undefined,
    customerRequirements: row.customerRequirements,
    recommendations: row.recommendations,
    aiModel: row.aiModel || undefined,
    status: row.status,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createQuoteRecommendation(
  tenantId: string,
  input: CreateQuoteRecommendationInput,
): Promise<CreateQuoteRecommendationInput & { id: string; tenantId: string; status: string; createdAt: string }> {
  const now = new Date();
  const id = nanoid();
  await db.insert(pmsQuoteRecommendations).values({
    id,
    tenantId,
    opportunityId: input.opportunityId ?? null,
    customerRequirements: input.customerRequirements,
    recommendations: input.recommendations,
    aiModel: input.aiModel ?? null,
    status: input.status ?? 'draft',
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  });
  return { id, tenantId, ...input, status: input.status ?? 'draft', createdAt: now.toISOString() };
}

export async function listQuoteRecommendations(filters: {
  tenantId: string;
  opportunityId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<ReturnType<typeof mapRec>[]> {
  const conditions = [eq(pmsQuoteRecommendations.tenantId, filters.tenantId)];
  if (filters.opportunityId) conditions.push(eq(pmsQuoteRecommendations.opportunityId, filters.opportunityId));
  if (filters.status) conditions.push(eq(pmsQuoteRecommendations.status, filters.status));
  const rows = await db
    .select()
    .from(pmsQuoteRecommendations)
    .where(and(...conditions))
    .orderBy(desc(pmsQuoteRecommendations.createdAt))
    .limit(filters.limit ?? 100)
    .offset(filters.offset ?? 0);
  return rows.map(mapRec);
}

export async function updateQuoteRecommendationStatus(input: {
  tenantId: string;
  id: string;
  status: string;
}) {
  const now = new Date();
  const rows = await db
    .select()
    .from(pmsQuoteRecommendations)
    .where(and(eq(pmsQuoteRecommendations.id, input.id), eq(pmsQuoteRecommendations.tenantId, input.tenantId)))
    .limit(1);
  if (rows.length === 0) throw new Error('quote recommendation not found');
  await db
    .update(pmsQuoteRecommendations)
    .set({ status: input.status, updatedAt: now })
    .where(eq(pmsQuoteRecommendations.id, input.id));
  return { id: input.id, status: input.status, updatedAt: now.toISOString() };
}
