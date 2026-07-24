/**
 * PMS · 合同管理服务 (L2C 下段)
 *
 * 业务 (CRM-PM-BLUEPRINT):
 *   - 价格审批通过 → 经销商签约 → 合同审批 → 生效
 *   - 合同生效自动创建交付工单 (pms_delivery_orders), 承接设备交付流程
 *
 * 状态机: draft → pending → approved(生效) | rejected
 *
 * 对齐 drizzle 表 pms_contracts (无 orgId 列; 隔离经 opportunity 归属).
 * 交付工单 orgId/deliveryAddress 取自关联商机.
 */

import { nanoid } from 'nanoid';
import { db } from '../infra/drizzle-client';
import { pmsContracts, pmsDeliveryOrders } from '../infra/drizzle-schema';
import { and, eq, desc } from 'drizzle-orm';
import { getOpportunity } from './opportunity-service';
import { emitAlert } from './alert-service';
import { contractApprovedAlert } from './alert-events';

// ---------------------------------------------------------------------------
// 纯函数 (可测)
// ---------------------------------------------------------------------------

/** YYYYMMDD (UTC) */
export function yyyymmdd(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/** 合同编号: CT-YYYYMMDD-<suffix> */
export function formatContractNumber(date: Date, suffix: string): string {
  return `CT-${yyyymmdd(date)}-${suffix}`;
}

/** 交付工单编号: DO-YYYYMMDD-<suffix> */
export function formatOrderNumber(date: Date, suffix: string): string {
  return `DO-${yyyymmdd(date)}-${suffix}`;
}

/** 仅 draft / pending 合同可审批 */
export function canApproveContract(status: string): boolean {
  return status === 'draft' || status === 'pending';
}

// ---------------------------------------------------------------------------
// DB 服务
// ---------------------------------------------------------------------------

function mapContract(row: typeof pmsContracts.$inferSelect) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    opportunityId: row.opportunityId,
    contractNumber: row.contractNumber,
    customerName: row.customerName,
    totalAmount: parseFloat(row.totalAmount),
    signedDate: row.signedDate || undefined,
    effectiveDate: row.effectiveDate || undefined,
    expiryDate: row.expiryDate || undefined,
    status: row.status,
    signedBy: row.signedBy || undefined,
    approvedBy: row.approvedBy || undefined,
    approvedAt: row.approvedAt?.toISOString() || undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** 创建合同 (草稿) */
export async function createContract(input: {
  tenantId: string;
  opportunityId: string;
  customerName: string;
  totalAmount: number;
  signedBy?: string;
  signedDate?: string;
  effectiveDate?: string;
  expiryDate?: string;
}): Promise<any> {
  const now = new Date();
  const id = nanoid();
  const contractNumber = formatContractNumber(now, nanoid(8));

  try {
    await db.insert(pmsContracts).values({
      id,
      tenantId: input.tenantId,
      opportunityId: input.opportunityId,
      contractNumber,
      customerName: input.customerName,
      totalAmount: input.totalAmount.toString(),
      signedDate: input.signedDate ?? null,
      effectiveDate: input.effectiveDate ?? null,
      expiryDate: input.expiryDate ?? null,
      status: 'draft',
      signedBy: input.signedBy ?? null,
      approvedBy: null,
      approvedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  } catch (err: any) {
    if (err?.code === '23505') {
      throw new Error('contract number conflict; retry');
    }
    throw err;
  }

  return {
    id,
    tenantId: input.tenantId,
    opportunityId: input.opportunityId,
    contractNumber,
    customerName: input.customerName,
    totalAmount: input.totalAmount,
    status: 'draft',
    signedBy: input.signedBy,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

/** 列表查询合同 */
export async function listContracts(filters: {
  tenantId: string;
  status?: string;
  opportunityId?: string;
  limit?: number;
  offset?: number;
}): Promise<any[]> {
  const conditions = [eq(pmsContracts.tenantId, filters.tenantId)];
  if (filters.status) conditions.push(eq(pmsContracts.status, filters.status));
  if (filters.opportunityId) conditions.push(eq(pmsContracts.opportunityId, filters.opportunityId));

  const rows = await db
    .select()
    .from(pmsContracts)
    .where(and(...conditions))
    .orderBy(desc(pmsContracts.createdAt))
    .limit(filters.limit ?? 50)
    .offset(filters.offset ?? 0);

  return rows.map(mapContract);
}

/** 获取合同详情 */
export async function getContract(id: string, tenantId: string): Promise<any | null> {
  const rows = await db
    .select()
    .from(pmsContracts)
    .where(and(eq(pmsContracts.id, id), eq(pmsContracts.tenantId, tenantId)))
    .limit(1);
  if (rows.length === 0) return null;
  return mapContract(rows[0]);
}

/**
 * 为已生效合同创建交付工单 (幂等: 已存在则返回现有).
 * orgId / deliveryAddress 取自关联商机.
 */
export async function createDeliveryOrderForContract(input: {
  tenantId: string;
  contractId: string;
  opportunityId: string;
  customerName: string;
}): Promise<{ id: string; orderNumber: string; contractId: string; status: string; alreadyExists: boolean }> {
  const now = new Date();

  const existing = await db
    .select()
    .from(pmsDeliveryOrders)
    .where(and(
      eq(pmsDeliveryOrders.tenantId, input.tenantId),
      eq(pmsDeliveryOrders.contractId, input.contractId),
    ))
    .limit(1);
  if (existing.length > 0) {
    return {
      id: existing[0].id,
      orderNumber: existing[0].orderNumber,
      contractId: input.contractId,
      status: existing[0].status,
      alreadyExists: true,
    };
  }

  // 交付工单需要 orgId + deliveryAddress, 取自商机
  const opp = await getOpportunity(input.opportunityId, input.tenantId);
  const orgId = opp?.orgId ?? 'unknown';
  const deliveryAddress = opp?.customerAddress || '待补充';

  const id = nanoid();
  const orderNumber = formatOrderNumber(now, nanoid(8));
  await db.insert(pmsDeliveryOrders).values({
    id,
    tenantId: input.tenantId,
    orgId,
    contractId: input.contractId,
    orderNumber,
    customerName: input.customerName,
    deliveryAddress,
    status: 'pending',
    scheduledDeliveryDate: null,
    actualDeliveryDate: null,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  });

  return { id, orderNumber, contractId: input.contractId, status: 'pending', alreadyExists: false };
}

/**
 * 审批合同 → 生效 → 自动创建交付工单.
 */
export async function approveContract(input: {
  tenantId: string;
  contractId: string;
  approverId: string;
}): Promise<any> {
  const now = new Date();

  const rows = await db
    .select()
    .from(pmsContracts)
    .where(and(eq(pmsContracts.id, input.contractId), eq(pmsContracts.tenantId, input.tenantId)))
    .limit(1);
  if (rows.length === 0) {
    throw new Error('contract not found');
  }
  const contract = rows[0];
  if (!canApproveContract(contract.status)) {
    throw new Error('contract not approvable');
  }

  const effectiveDate = contract.effectiveDate ?? yyyymmdd(now);
  await db
    .update(pmsContracts)
    .set({
      status: 'approved',
      approvedBy: input.approverId,
      approvedAt: now,
      effectiveDate,
      updatedAt: now,
    })
    .where(and(eq(pmsContracts.id, input.contractId), eq(pmsContracts.tenantId, input.tenantId)));

  // 自动创建交付工单
  const deliveryOrder = await createDeliveryOrderForContract({
    tenantId: input.tenantId,
    contractId: input.contractId,
    opportunityId: contract.opportunityId,
    customerName: contract.customerName,
  });

  // 埋点: 通知交付团队排产 (失败降级)
  await emitAlert({
    tenantId: input.tenantId,
    ...contractApprovedAlert({ deliveryOrderId: deliveryOrder.id, customerName: contract.customerName }),
  });

  return {
    contractId: input.contractId,
    status: 'approved',
    approvedBy: input.approverId,
    approvedAt: now.toISOString(),
    effectiveDate,
    deliveryOrder,
  };
}

/** 驳回合同 */
export async function rejectContract(input: {
  tenantId: string;
  contractId: string;
  approverId: string;
}): Promise<any> {
  const now = new Date();

  const rows = await db
    .select()
    .from(pmsContracts)
    .where(and(eq(pmsContracts.id, input.contractId), eq(pmsContracts.tenantId, input.tenantId)))
    .limit(1);
  if (rows.length === 0) {
    throw new Error('contract not found');
  }
  if (!canApproveContract(rows[0].status)) {
    throw new Error('contract not approvable');
  }

  await db
    .update(pmsContracts)
    .set({ status: 'rejected', approvedBy: input.approverId, approvedAt: now, updatedAt: now })
    .where(and(eq(pmsContracts.id, input.contractId), eq(pmsContracts.tenantId, input.tenantId)));

  return { contractId: input.contractId, status: 'rejected', approvedBy: input.approverId, approvedAt: now.toISOString() };
}
