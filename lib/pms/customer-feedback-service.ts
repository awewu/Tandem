/**
 * PMS · 甲方触点 / 满意度反馈服务
 *
 * 业务: 设备铭牌二维码/短链 → 免登录反馈 (报修/评分/建议). 甲方无账号.
 * 对齐 drizzle 表 pms_customer_feedback.
 */

import { nanoid } from 'nanoid';
import { db } from '../infra/drizzle-client';
import { pmsCustomerFeedback } from '../infra/drizzle-schema';
import { and, eq, desc } from 'drizzle-orm';

// --- 纯函数 (可测) ---

export const FEEDBACK_TYPES = ['satisfaction', 'complaint', 'suggestion', 'repair_request'];

/** 反馈类型是否合法 */
export function isValidFeedbackType(type: string): boolean {
  return FEEDBACK_TYPES.includes(type);
}

/** 评分是否合法 (1-5 整数; 非满意度类可不填 → null 合法) */
export function isValidRating(rating: number | null | undefined, type: string): boolean {
  if (rating == null) return type !== 'satisfaction';
  return Number.isInteger(rating) && rating >= 1 && rating <= 5;
}

// --- DB ---

function mapFeedback(row: typeof pmsCustomerFeedback.$inferSelect) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    snCode: row.snCode || undefined,
    maintenanceRecordId: row.maintenanceRecordId || undefined,
    type: row.type,
    rating: row.rating ?? undefined,
    comment: row.comment || undefined,
    contactInfo: row.contactInfo || undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

/** 提交反馈 (公开, 无需登录) */
export async function submitFeedback(input: {
  tenantId: string;
  snCode?: string;
  maintenanceRecordId?: string;
  type: string;
  rating?: number;
  comment?: string;
  contactInfo?: string;
}): Promise<any> {
  const now = new Date();
  const id = nanoid();
  await db.insert(pmsCustomerFeedback).values({
    id,
    tenantId: input.tenantId,
    snCode: input.snCode ?? null,
    maintenanceRecordId: input.maintenanceRecordId ?? null,
    type: input.type,
    rating: input.rating ?? null,
    comment: input.comment ?? null,
    contactInfo: input.contactInfo ?? null,
    createdAt: now,
  });
  return { id, type: input.type, createdAt: now.toISOString() };
}

/** 列出反馈 (内部) */
export async function listFeedback(filters: {
  tenantId: string;
  snCode?: string;
  maintenanceRecordId?: string;
  type?: string;
  limit?: number;
  offset?: number;
}): Promise<any[]> {
  const conditions = [eq(pmsCustomerFeedback.tenantId, filters.tenantId)];
  if (filters.snCode) conditions.push(eq(pmsCustomerFeedback.snCode, filters.snCode));
  if (filters.maintenanceRecordId) conditions.push(eq(pmsCustomerFeedback.maintenanceRecordId, filters.maintenanceRecordId));
  if (filters.type) conditions.push(eq(pmsCustomerFeedback.type, filters.type));
  const rows = await db
    .select()
    .from(pmsCustomerFeedback)
    .where(and(...conditions))
    .orderBy(desc(pmsCustomerFeedback.createdAt))
    .limit(filters.limit ?? 100)
    .offset(filters.offset ?? 0);
  return rows.map(mapFeedback);
}
