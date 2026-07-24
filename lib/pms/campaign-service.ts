/**
 * PMS · 主推产品推广活动服务
 *
 * 业务: 主推产品目标销量 + 实际进展追踪 + 活动周期状态.
 * 对齐 drizzle 表 pms_key_product_campaigns.
 */

import { nanoid } from 'nanoid';
import { db } from '../infra/drizzle-client';
import { pmsKeyProductCampaigns } from '../infra/drizzle-schema';
import { and, eq, desc } from 'drizzle-orm';

// --- 纯函数 (可测) ---

/** 推广进度 (%) = actualSales/targetSales, 保留一位; target<=0 → 0 */
export function campaignProgress(actualSales: number, targetSales: number): number {
  if (!(targetSales > 0)) return 0;
  return Math.round((actualSales / targetSales) * 1000) / 10;
}

/** 活动是否在有效期内 (start <= now <= end, 日期串 YYYY-MM-DD) */
export function isCampaignActive(startDate: string, endDate: string, now: Date): boolean {
  const s = new Date(startDate + 'T00:00:00Z');
  const e = new Date(endDate + 'T23:59:59Z');
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return false;
  const t = now.getTime();
  return t >= s.getTime() && t <= e.getTime();
}

// --- DB ---

function mapCampaign(row: typeof pmsKeyProductCampaigns.$inferSelect) {
  const target = parseFloat(row.targetSales);
  const actual = row.actualSales != null ? parseFloat(row.actualSales) : 0;
  return {
    id: row.id,
    tenantId: row.tenantId,
    productId: row.productId,
    name: row.name,
    targetSales: target,
    actualSales: actual,
    progress: campaignProgress(actual, target),
    startDate: row.startDate,
    endDate: row.endDate,
    status: row.status,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createCampaign(input: {
  tenantId: string;
  productId: string;
  name: string;
  targetSales: number;
  startDate: string;
  endDate: string;
  createdBy: string;
}) {
  const now = new Date();
  const id = nanoid();
  await db.insert(pmsKeyProductCampaigns).values({
    id,
    tenantId: input.tenantId,
    productId: input.productId,
    name: input.name,
    targetSales: input.targetSales.toString(),
    actualSales: '0',
    startDate: input.startDate,
    endDate: input.endDate,
    status: 'active',
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  });
  return { id, ...input, actualSales: 0, status: 'active', createdAt: now.toISOString() };
}

export async function listCampaigns(filters: {
  tenantId: string;
  productId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<ReturnType<typeof mapCampaign>[]> {
  const conditions = [eq(pmsKeyProductCampaigns.tenantId, filters.tenantId)];
  if (filters.productId) conditions.push(eq(pmsKeyProductCampaigns.productId, filters.productId));
  if (filters.status) conditions.push(eq(pmsKeyProductCampaigns.status, filters.status));
  const rows = await db
    .select()
    .from(pmsKeyProductCampaigns)
    .where(and(...conditions))
    .orderBy(desc(pmsKeyProductCampaigns.createdAt))
    .limit(filters.limit ?? 100)
    .offset(filters.offset ?? 0);
  return rows.map(mapCampaign);
}

/** 回填实际销量 */
export async function updateCampaignProgress(input: {
  tenantId: string;
  id: string;
  actualSales: number;
  status?: string;
}) {
  const now = new Date();
  const rows = await db
    .select()
    .from(pmsKeyProductCampaigns)
    .where(and(eq(pmsKeyProductCampaigns.id, input.id), eq(pmsKeyProductCampaigns.tenantId, input.tenantId)))
    .limit(1);
  if (rows.length === 0) throw new Error('campaign not found');
  const patch: Partial<typeof pmsKeyProductCampaigns.$inferInsert> = { actualSales: input.actualSales.toString(), updatedAt: now };
  if (input.status) patch.status = input.status;
  await db
    .update(pmsKeyProductCampaigns)
    .set(patch)
    .where(eq(pmsKeyProductCampaigns.id, input.id));
  const target = parseFloat(rows[0].targetSales);
  return { id: input.id, actualSales: input.actualSales, progress: campaignProgress(input.actualSales, target), updatedAt: now.toISOString() };
}
