/**
 * PMS · 撞单申诉仲裁服务 (S2 查重闭环)
 *
 * 业务 (CRM-PM-BLUEPRINT):
 *   - 经销商对查重判定 (warning/duplicate) 有异议 → 提交申诉 (附凭证)
 *   - 销售管理部仲裁 → approved(申诉成立) / rejected(维持撞单)
 *   - 仲裁后关闭关联的查重记录 (resolvedBy/resolvedAt), 形成透明留痕
 *
 * 状态机: pending → under_review → approved | rejected
 * 约束: 同一 duplicateCheckId 同时只允许一条进行中申诉 (pending/under_review)
 *
 * 对齐 drizzle 表 pms_duplicate_appeals (非 KvStore 类型):
 *   字段 appealerId / arbitrationReason, 无 orgId/opportunityId/updatedAt.
 */

import { nanoid } from 'nanoid';
import { db } from '../infra/drizzle-client';
import { pmsDuplicateAppeals, pmsDuplicateChecks } from '../infra/drizzle-schema';
import { and, eq, or, desc } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// 纯函数 (可测)
// ---------------------------------------------------------------------------

export type ArbitrationDecision = 'approved' | 'rejected';

/** 仅进行中的申诉 (pending / under_review) 可被仲裁 */
export function canArbitrate(status: string): boolean {
  return status === 'pending' || status === 'under_review';
}

/** 归一化仲裁裁决输入, 非法值抛错 */
export function normalizeDecision(input: string): ArbitrationDecision {
  if (input === 'approved' || input === 'approve') return 'approved';
  if (input === 'rejected' || input === 'reject') return 'rejected';
  throw new Error('invalid arbitration decision; expected approved | rejected');
}

// ---------------------------------------------------------------------------
// DB 服务
// ---------------------------------------------------------------------------

function mapAppeal(row: typeof pmsDuplicateAppeals.$inferSelect) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    duplicateCheckId: row.duplicateCheckId,
    appealerId: row.appealerId,
    reason: row.reason,
    evidence: (row.evidence as string[] | null) ?? [],
    status: row.status,
    arbitratedBy: row.arbitratedBy || undefined,
    arbitrationResult: row.arbitrationResult || undefined,
    arbitrationReason: row.arbitrationReason || undefined,
    arbitratedAt: row.arbitratedAt?.toISOString() || undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * 提交撞单申诉.
 *   - 校验查重记录存在 (同租户)
 *   - 同一查重记录仅允许一条进行中申诉
 */
export async function createAppeal(input: {
  tenantId: string;
  duplicateCheckId: string;
  appealerId: string;
  reason: string;
  evidence?: string[];
}): Promise<any> {
  const now = new Date();

  const checkRows = await db
    .select()
    .from(pmsDuplicateChecks)
    .where(and(
      eq(pmsDuplicateChecks.id, input.duplicateCheckId),
      eq(pmsDuplicateChecks.tenantId, input.tenantId),
    ))
    .limit(1);
  if (checkRows.length === 0) {
    throw new Error('duplicate check not found');
  }

  const active = await db
    .select()
    .from(pmsDuplicateAppeals)
    .where(and(
      eq(pmsDuplicateAppeals.tenantId, input.tenantId),
      eq(pmsDuplicateAppeals.duplicateCheckId, input.duplicateCheckId),
      or(
        eq(pmsDuplicateAppeals.status, 'pending'),
        eq(pmsDuplicateAppeals.status, 'under_review'),
      ),
    ))
    .limit(1);
  if (active.length > 0) {
    throw new Error('an active appeal already exists for this check');
  }

  const id = nanoid();
  await db.insert(pmsDuplicateAppeals).values({
    id,
    tenantId: input.tenantId,
    duplicateCheckId: input.duplicateCheckId,
    appealerId: input.appealerId,
    reason: input.reason,
    evidence: input.evidence ?? null,
    status: 'pending',
    arbitratedBy: null,
    arbitrationResult: null,
    arbitrationReason: null,
    arbitratedAt: null,
    createdAt: now,
  });

  return {
    id,
    tenantId: input.tenantId,
    duplicateCheckId: input.duplicateCheckId,
    appealerId: input.appealerId,
    reason: input.reason,
    evidence: input.evidence ?? [],
    status: 'pending',
    createdAt: now.toISOString(),
  };
}

/** 列表查询申诉 */
export async function listAppeals(filters: {
  tenantId: string;
  status?: string;
  duplicateCheckId?: string;
  appealerId?: string;
  limit?: number;
  offset?: number;
}): Promise<any[]> {
  const conditions = [eq(pmsDuplicateAppeals.tenantId, filters.tenantId)];
  if (filters.status) conditions.push(eq(pmsDuplicateAppeals.status, filters.status));
  if (filters.duplicateCheckId) conditions.push(eq(pmsDuplicateAppeals.duplicateCheckId, filters.duplicateCheckId));
  if (filters.appealerId) conditions.push(eq(pmsDuplicateAppeals.appealerId, filters.appealerId));

  const rows = await db
    .select()
    .from(pmsDuplicateAppeals)
    .where(and(...conditions))
    .orderBy(desc(pmsDuplicateAppeals.createdAt))
    .limit(filters.limit ?? 50)
    .offset(filters.offset ?? 0);

  return rows.map(mapAppeal);
}

/** 获取申诉详情 */
export async function getAppeal(appealId: string, tenantId: string): Promise<any | null> {
  const rows = await db
    .select()
    .from(pmsDuplicateAppeals)
    .where(and(
      eq(pmsDuplicateAppeals.id, appealId),
      eq(pmsDuplicateAppeals.tenantId, tenantId),
    ))
    .limit(1);
  if (rows.length === 0) return null;
  return mapAppeal(rows[0]);
}

/**
 * 仲裁申诉 (销售管理部 / 内部角色).
 *   - 校验申诉存在且可仲裁 (pending/under_review)
 *   - 写裁决 + 关闭关联查重记录 (resolved)
 */
export async function arbitrateAppeal(input: {
  tenantId: string;
  appealId: string;
  arbitratedBy: string;
  decision: ArbitrationDecision;
  arbitrationReason?: string;
}): Promise<any> {
  const now = new Date();

  const rows = await db
    .select()
    .from(pmsDuplicateAppeals)
    .where(and(
      eq(pmsDuplicateAppeals.id, input.appealId),
      eq(pmsDuplicateAppeals.tenantId, input.tenantId),
    ))
    .limit(1);
  if (rows.length === 0) {
    throw new Error('appeal not found');
  }
  const appeal = rows[0];
  if (!canArbitrate(appeal.status)) {
    throw new Error('appeal not arbitratable');
  }

  await db
    .update(pmsDuplicateAppeals)
    .set({
      status: input.decision,
      arbitratedBy: input.arbitratedBy,
      arbitratedAt: now,
      arbitrationResult: input.decision,
      arbitrationReason: input.arbitrationReason ?? null,
    })
    .where(and(
      eq(pmsDuplicateAppeals.id, input.appealId),
      eq(pmsDuplicateAppeals.tenantId, input.tenantId),
    ));

  // 关闭关联查重记录 (透明留痕)
  await db
    .update(pmsDuplicateChecks)
    .set({ status: 'resolved', resolvedBy: input.arbitratedBy, resolvedAt: now })
    .where(and(
      eq(pmsDuplicateChecks.id, appeal.duplicateCheckId),
      eq(pmsDuplicateChecks.tenantId, input.tenantId),
    ));

  return {
    appealId: input.appealId,
    duplicateCheckId: appeal.duplicateCheckId,
    status: input.decision,
    arbitratedBy: input.arbitratedBy,
    arbitratedAt: now.toISOString(),
  };
}
