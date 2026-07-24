/**
 * PMS · 价格申请 + 分级审批服务 (L2C 中段)
 *
 * 业务 (CRM-PM-BLUEPRINT):
 *   - 经销商对特定产品申请折扣价 → 按折扣力度触发不同审批级别
 *   - 分级审批: 折扣越大, 需要越高级别审批 (区域→总监→总经理)
 *   - 审批留痕写入 pms_approvals (entityType='price_application')
 *
 * 分级规则 (可测纯函数):
 *   折扣率 <= 5%  → level 1 (区域经理)
 *   折扣率 <= 15% → level 2 (销售总监)
 *   折扣率 >  15% → level 3 (总经理)
 * 审批人级别 (按角色): owner/admin=3, manager=2, 其它内部=1.
 * 审批人级别 >= 所需级别方可批准, 否则拒绝越权审批.
 *
 * 对齐 drizzle 表 pms_price_applications (无 orgId 列; 隔离经 opportunity 归属).
 */

import { nanoid } from 'nanoid';
import { db } from '../infra/drizzle-client';
import { pmsPriceApplications, pmsApprovals } from '../infra/drizzle-schema';
import { and, eq, desc } from 'drizzle-orm';
import { emitAlert } from './alert-service';
import { priceApplicationSubmittedAlert, priceApplicationDecidedAlert } from './alert-events';

// ---------------------------------------------------------------------------
// 纯函数 (可测)
// ---------------------------------------------------------------------------

/** 计算折扣率 (%). listPrice<=0 或 requested>=list → 0. 保留两位小数. */
export function computeDiscountRate(listPrice: number, requestedPrice: number): number {
  if (!(listPrice > 0)) return 0;
  const rate = (1 - requestedPrice / listPrice) * 100;
  if (rate <= 0) return 0;
  return Math.round(rate * 100) / 100;
}

/** 所需审批级别 (纯函数, 阈值可覆盖) */
export function requiredApprovalLevel(
  discountRate: number,
  tiers: { l1Max?: number; l2Max?: number } = {},
): 1 | 2 | 3 {
  const l1Max = tiers.l1Max ?? 5;
  const l2Max = tiers.l2Max ?? 15;
  if (discountRate <= l1Max) return 1;
  if (discountRate <= l2Max) return 2;
  return 3;
}

/** 审批人级别 (按角色, 取最高) */
export function approverLevelForRoles(roles: readonly string[]): 0 | 1 | 2 | 3 {
  if (roles.some((r) => r === 'owner' || r === 'admin')) return 3;
  if (roles.some((r) => r === 'manager')) return 2;
  // 其它内部角色 (employee/finance/steward/...) 默认 level 1
  const internalL1 = ['employee', 'finance', 'internal_staff', 'steward', 'champion'];
  if (roles.some((r) => internalL1.includes(r))) return 1;
  return 0; // 无审批权
}

// ---------------------------------------------------------------------------
// DB 服务
// ---------------------------------------------------------------------------

function mapApplication(row: typeof pmsPriceApplications.$inferSelect) {
  const discountRate = parseFloat(row.discountRate);
  return {
    id: row.id,
    tenantId: row.tenantId,
    opportunityId: row.opportunityId,
    applicantId: row.applicantId,
    productId: row.productId,
    listPrice: parseFloat(row.listPrice),
    requestedPrice: parseFloat(row.requestedPrice),
    discountRate,
    requiredLevel: requiredApprovalLevel(discountRate),
    reason: row.reason,
    status: row.status,
    approvedPrice: row.approvedPrice != null ? parseFloat(row.approvedPrice) : undefined,
    approvedBy: row.approvedBy || undefined,
    approvedAt: row.approvedAt?.toISOString() || undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

/** 提交价格申请 */
export async function createPriceApplication(input: {
  tenantId: string;
  opportunityId: string;
  applicantId: string;
  productId: string;
  listPrice: number;
  requestedPrice: number;
  reason: string;
}) {
  const now = new Date();
  const discountRate = computeDiscountRate(input.listPrice, input.requestedPrice);
  const id = nanoid();

  await db.insert(pmsPriceApplications).values({
    id,
    tenantId: input.tenantId,
    opportunityId: input.opportunityId,
    applicantId: input.applicantId,
    productId: input.productId,
    listPrice: input.listPrice.toString(),
    requestedPrice: input.requestedPrice.toString(),
    discountRate: discountRate.toString(),
    reason: input.reason,
    status: 'pending',
    approvedPrice: null,
    approvedBy: null,
    approvedAt: null,
    createdAt: now,
  });

  const requiredLevel = requiredApprovalLevel(discountRate);

  // 埋点: 通知对应级别审批人 (失败降级)
  await emitAlert({
    tenantId: input.tenantId,
    ...priceApplicationSubmittedAlert({ applicationId: id, discountRate, requiredLevel }),
  });

  return {
    id,
    tenantId: input.tenantId,
    opportunityId: input.opportunityId,
    applicantId: input.applicantId,
    productId: input.productId,
    listPrice: input.listPrice,
    requestedPrice: input.requestedPrice,
    discountRate,
    requiredLevel,
    reason: input.reason,
    status: 'pending',
    createdAt: now.toISOString(),
  };
}

/** 列表查询价格申请 */
export async function listPriceApplications(filters: {
  tenantId: string;
  status?: string;
  opportunityId?: string;
  applicantId?: string;
  limit?: number;
  offset?: number;
}): Promise<ReturnType<typeof mapApplication>[]> {
  const conditions = [eq(pmsPriceApplications.tenantId, filters.tenantId)];
  if (filters.status) conditions.push(eq(pmsPriceApplications.status, filters.status));
  if (filters.opportunityId) conditions.push(eq(pmsPriceApplications.opportunityId, filters.opportunityId));
  if (filters.applicantId) conditions.push(eq(pmsPriceApplications.applicantId, filters.applicantId));

  const rows = await db
    .select()
    .from(pmsPriceApplications)
    .where(and(...conditions))
    .orderBy(desc(pmsPriceApplications.createdAt))
    .limit(filters.limit ?? 50)
    .offset(filters.offset ?? 0);

  return rows.map(mapApplication);
}

/** 获取价格申请详情 */
export async function getPriceApplication(id: string, tenantId: string): Promise<ReturnType<typeof mapApplication> | null> {
  const rows = await db
    .select()
    .from(pmsPriceApplications)
    .where(and(
      eq(pmsPriceApplications.id, id),
      eq(pmsPriceApplications.tenantId, tenantId),
    ))
    .limit(1);
  if (rows.length === 0) return null;
  return mapApplication(rows[0]);
}

/**
 * 审批价格申请 (内部).
 *   - 校验申请存在且 status=pending
 *   - 审批人级别 >= 所需级别 (分级审批门槛)
 *   - 写申请结果 + pms_approvals 审批留痕
 */
export async function decidePriceApplication(input: {
  tenantId: string;
  applicationId: string;
  approverId: string;
  approverLevel: number;
  decision: 'approved' | 'rejected';
  approvedPrice?: number;
  comment?: string;
}) {
  const now = new Date();

  const rows = await db
    .select()
    .from(pmsPriceApplications)
    .where(and(
      eq(pmsPriceApplications.id, input.applicationId),
      eq(pmsPriceApplications.tenantId, input.tenantId),
    ))
    .limit(1);
  if (rows.length === 0) {
    throw new Error('price application not found');
  }
  const app = rows[0];
  if (app.status !== 'pending') {
    throw new Error('price application already decided');
  }

  const discountRate = parseFloat(app.discountRate);
  const needed = requiredApprovalLevel(discountRate);
  if (input.decision === 'approved' && input.approverLevel < needed) {
    throw new Error(`insufficient approval authority: requires level ${needed}`);
  }

  const approvedPrice =
    input.decision === 'approved'
      ? (input.approvedPrice ?? parseFloat(app.requestedPrice)).toString()
      : null;

  await db
    .update(pmsPriceApplications)
    .set({
      status: input.decision,
      approvedPrice,
      approvedBy: input.approverId,
      approvedAt: now,
    })
    .where(and(
      eq(pmsPriceApplications.id, input.applicationId),
      eq(pmsPriceApplications.tenantId, input.tenantId),
    ));

  // 审批留痕
  await db.insert(pmsApprovals).values({
    id: nanoid(),
    tenantId: input.tenantId,
    entityType: 'price_application',
    entityId: input.applicationId,
    level: input.approverLevel,
    approverId: input.approverId,
    status: input.decision,
    decision: input.decision,
    comment: input.comment ?? null,
    decidedAt: now,
    createdAt: now,
  });

  // 埋点: 通知申请人审批结果 (失败降级)
  await emitAlert({
    tenantId: input.tenantId,
    ...priceApplicationDecidedAlert({
      applicationId: input.applicationId,
      applicantId: app.applicantId,
      decision: input.decision,
    }),
  });

  return {
    applicationId: input.applicationId,
    status: input.decision,
    requiredLevel: needed,
    approverLevel: input.approverLevel,
    approvedPrice: approvedPrice != null ? parseFloat(approvedPrice) : undefined,
    approvedBy: input.approverId,
    approvedAt: now.toISOString(),
  };
}
