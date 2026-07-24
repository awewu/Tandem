/**
 * PMS · 交付工单 + 交付任务服务 (设备交付流程)
 *
 * 业务 (CRM-PM-BLUEPRINT):
 *   - 合同生效自动生成交付工单 (见 contract-service)
 *   - 工单排期 → 交付 → 完成; 可拆子任务 (安装/调试/培训) 派给经销商/服务商
 *
 * 工单状态机: pending → scheduled → delivered → completed; 任一非终态可 cancelled
 * 任务状态机: pending → completed
 *
 * 对齐 drizzle 表 pms_delivery_orders (有 orgId, 直接隔离) / pms_delivery_tasks.
 */

import { nanoid } from 'nanoid';
import { db } from '../infra/drizzle-client';
import { pmsDeliveryOrders, pmsDeliveryTasks } from '../infra/drizzle-schema';
import { and, eq, inArray, isNull, desc } from 'drizzle-orm';
import { emitAlert } from './alert-service';
import { deliveryTaskAssignedAlert } from './alert-events';

// ---------------------------------------------------------------------------
// 纯函数 (可测)
// ---------------------------------------------------------------------------

export type DeliveryStatus = 'pending' | 'scheduled' | 'delivered' | 'completed' | 'cancelled';

const DELIVERY_TRANSITIONS: Record<string, DeliveryStatus[]> = {
  pending: ['scheduled', 'cancelled'],
  scheduled: ['delivered', 'cancelled'],
  delivered: ['completed'],
  completed: [],
  cancelled: [],
};

/** 交付工单状态流转是否合法 */
export function canTransitionDelivery(from: string, to: string): boolean {
  const allowed = DELIVERY_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to as DeliveryStatus);
}

/** 交付任务是否可完成 (仅 pending / in_progress) */
export function canCompleteTask(status: string): boolean {
  return status === 'pending' || status === 'in_progress';
}

// ---------------------------------------------------------------------------
// DB 服务
// ---------------------------------------------------------------------------

function mapOrder(row: typeof pmsDeliveryOrders.$inferSelect) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    orgId: row.orgId,
    contractId: row.contractId,
    orderNumber: row.orderNumber,
    customerName: row.customerName,
    deliveryAddress: row.deliveryAddress,
    status: row.status,
    scheduledDeliveryDate: row.scheduledDeliveryDate || undefined,
    actualDeliveryDate: row.actualDeliveryDate || undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapTask(row: typeof pmsDeliveryTasks.$inferSelect) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    deliveryOrderId: row.deliveryOrderId,
    type: row.type,
    assignedTo: row.assignedTo,
    assigneeType: row.assigneeType,
    description: row.description,
    dueDate: row.dueDate || undefined,
    status: row.status,
    completedAt: row.completedAt?.toISOString() || undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** 列表查询交付工单 (orgId 隔离) */
export async function listDeliveryOrders(filters: {
  tenantId: string;
  status?: string;
  contractId?: string;
  visibleOrgIds?: string[];
  limit?: number;
  offset?: number;
}): Promise<ReturnType<typeof mapOrder>[]> {
  const conditions = [eq(pmsDeliveryOrders.tenantId, filters.tenantId)];
  if (filters.status) conditions.push(eq(pmsDeliveryOrders.status, filters.status));
  if (filters.contractId) conditions.push(eq(pmsDeliveryOrders.contractId, filters.contractId));
  if (filters.visibleOrgIds && filters.visibleOrgIds.length > 0) {
    conditions.push(inArray(pmsDeliveryOrders.orgId, filters.visibleOrgIds));
  }
  conditions.push(isNull(pmsDeliveryOrders.archivedAt));

  const rows = await db
    .select()
    .from(pmsDeliveryOrders)
    .where(and(...conditions))
    .orderBy(desc(pmsDeliveryOrders.createdAt))
    .limit(filters.limit ?? 50)
    .offset(filters.offset ?? 0);

  return rows.map(mapOrder);
}

/** 获取交付工单 (orgId 隔离) */
export async function getDeliveryOrder(
  id: string,
  tenantId: string,
  visibleOrgIds?: string[],
): Promise<ReturnType<typeof mapOrder> | null> {
  const rows = await db
    .select()
    .from(pmsDeliveryOrders)
    .where(and(eq(pmsDeliveryOrders.id, id), eq(pmsDeliveryOrders.tenantId, tenantId)))
    .limit(1);
  if (rows.length === 0) return null;
  const row = rows[0];
  if (visibleOrgIds && visibleOrgIds.length > 0 && !visibleOrgIds.includes(row.orgId)) {
    return null;
  }
  return mapOrder(row);
}

/**
 * 交付工单状态流转. 校验状态机合法性.
 *   → scheduled: 记录 scheduledDeliveryDate
 *   → delivered: 自动记录 actualDeliveryDate (未显式给则用当日)
 */
export async function transitionDeliveryOrder(input: {
  tenantId: string;
  orderId: string;
  toStatus: DeliveryStatus;
  scheduledDeliveryDate?: string;
  actualDeliveryDate?: string;
  visibleOrgIds?: string[];
}): Promise<any> {
  const now = new Date();

  const current = await getDeliveryOrder(input.orderId, input.tenantId, input.visibleOrgIds);
  if (!current) {
    throw new Error('delivery order not found');
  }
  if (!canTransitionDelivery(current.status, input.toStatus)) {
    throw new Error(`illegal transition: ${current.status} → ${input.toStatus}`);
  }

  const patch: Record<string, any> = { status: input.toStatus, updatedAt: now };
  if (input.toStatus === 'scheduled' && input.scheduledDeliveryDate) {
    patch.scheduledDeliveryDate = input.scheduledDeliveryDate;
  }
  if (input.toStatus === 'delivered') {
    patch.actualDeliveryDate = input.actualDeliveryDate ?? now.toISOString().slice(0, 10);
  }

  await db
    .update(pmsDeliveryOrders)
    .set(patch)
    .where(and(eq(pmsDeliveryOrders.id, input.orderId), eq(pmsDeliveryOrders.tenantId, input.tenantId)));

  return {
    orderId: input.orderId,
    from: current.status,
    to: input.toStatus,
    scheduledDeliveryDate: patch.scheduledDeliveryDate ?? current.scheduledDeliveryDate,
    actualDeliveryDate: patch.actualDeliveryDate ?? current.actualDeliveryDate,
    updatedAt: now.toISOString(),
  };
}

/** 创建交付子任务 */
export async function createDeliveryTask(input: {
  tenantId: string;
  deliveryOrderId: string;
  type: string;
  assignedTo: string;
  assigneeType: string;
  description: string;
  dueDate?: string;
}): Promise<any> {
  const now = new Date();
  const id = nanoid();
  await db.insert(pmsDeliveryTasks).values({
    id,
    tenantId: input.tenantId,
    deliveryOrderId: input.deliveryOrderId,
    type: input.type,
    assignedTo: input.assignedTo,
    assigneeType: input.assigneeType,
    description: input.description,
    dueDate: input.dueDate ?? null,
    status: 'pending',
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  });
  // 埋点: 通知被指派人 (失败降级)
  await emitAlert({
    tenantId: input.tenantId,
    ...deliveryTaskAssignedAlert({ taskId: id, taskType: input.type, assignedTo: input.assignedTo, dueDate: input.dueDate }),
  });

  return {
    id,
    tenantId: input.tenantId,
    deliveryOrderId: input.deliveryOrderId,
    type: input.type,
    assignedTo: input.assignedTo,
    assigneeType: input.assigneeType,
    description: input.description,
    dueDate: input.dueDate,
    status: 'pending',
    createdAt: now.toISOString(),
  };
}

/** 列表查询某工单的交付任务 */
export async function listDeliveryTasks(filters: {
  tenantId: string;
  deliveryOrderId: string;
  status?: string;
}): Promise<ReturnType<typeof mapTask>[]> {
  const conditions = [
    eq(pmsDeliveryTasks.tenantId, filters.tenantId),
    eq(pmsDeliveryTasks.deliveryOrderId, filters.deliveryOrderId),
  ];
  if (filters.status) conditions.push(eq(pmsDeliveryTasks.status, filters.status));

  const rows = await db
    .select()
    .from(pmsDeliveryTasks)
    .where(and(...conditions))
    .orderBy(desc(pmsDeliveryTasks.createdAt));

  return rows.map(mapTask);
}

/** 完成交付任务 */
export async function completeDeliveryTask(input: {
  tenantId: string;
  taskId: string;
}): Promise<any> {
  const now = new Date();

  const rows = await db
    .select()
    .from(pmsDeliveryTasks)
    .where(and(eq(pmsDeliveryTasks.id, input.taskId), eq(pmsDeliveryTasks.tenantId, input.tenantId)))
    .limit(1);
  if (rows.length === 0) {
    throw new Error('delivery task not found');
  }
  if (!canCompleteTask(rows[0].status)) {
    throw new Error('delivery task not completable');
  }

  await db
    .update(pmsDeliveryTasks)
    .set({ status: 'completed', completedAt: now, updatedAt: now })
    .where(and(eq(pmsDeliveryTasks.id, input.taskId), eq(pmsDeliveryTasks.tenantId, input.tenantId)));

  return { taskId: input.taskId, deliveryOrderId: rows[0].deliveryOrderId, status: 'completed', completedAt: now.toISOString() };
}

/** 校验任务归属的工单是否在可见范围 (供路由做隔离) */
export async function getTaskParentOrderId(taskId: string, tenantId: string): Promise<string | null> {
  const rows = await db
    .select({ deliveryOrderId: pmsDeliveryTasks.deliveryOrderId })
    .from(pmsDeliveryTasks)
    .where(and(eq(pmsDeliveryTasks.id, taskId), eq(pmsDeliveryTasks.tenantId, tenantId)))
    .limit(1);
  return rows.length > 0 ? rows[0].deliveryOrderId : null;
}
