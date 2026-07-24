/**
 * PMS · 维保记录服务 (FSM 售后)
 *
 * 业务 (CRM-PM-BLUEPRINT):
 *   - 设备报修/保养 → 派工(服务商/经销商) → 上门 → 完成 + 客户反馈
 *   - 依据关联 SN 保修有效性判定是否保内(免费)/保外(收费)
 *
 * 状态机: pending(报修) → assigned(派工) → in_progress(处理中) → completed; 非终态可 cancelled
 *
 * 对齐 drizzle 表 pms_maintenance_records (无 orgId; 经 equipmentSNID→交付工单 隔离).
 */

import { nanoid } from 'nanoid';
import { db } from '../infra/drizzle-client';
import { pmsMaintenanceRecords } from '../infra/drizzle-schema';
import { and, eq, desc } from 'drizzle-orm';
import { emitAlert } from './alert-service';
import { maintenanceReportedAlert } from './alert-events';

// ---------------------------------------------------------------------------
// 纯函数 (可测)
// ---------------------------------------------------------------------------

export type MaintenanceStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';

const MAINT_TRANSITIONS: Record<string, MaintenanceStatus[]> = {
  pending: ['assigned', 'cancelled'],
  assigned: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

/** 维保状态流转是否合法 */
export function canTransitionMaintenance(from: string, to: string): boolean {
  const allowed = MAINT_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to as MaintenanceStatus);
}

/**
 * 维保费用归属 (纯函数):
 *   保修有效 且 类型为 repair/replacement → warranty(保内免费)
 *   其余 (保外, 或非维修类如付费保养) → paid(收费)
 */
export function maintenanceCoverage(warrantyValid: boolean, type: string): 'warranty' | 'paid' {
  const covered = type === 'repair' || type === 'replacement';
  return warrantyValid && covered ? 'warranty' : 'paid';
}

// ---------------------------------------------------------------------------
// DB 服务
// ---------------------------------------------------------------------------

function mapRecord(row: typeof pmsMaintenanceRecords.$inferSelect) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    equipmentSNId: row.equipmentSNId,
    type: row.type,
    reportedBy: row.reportedBy,
    assignedTo: row.assignedTo || undefined,
    description: row.description,
    status: row.status,
    scheduledAt: row.scheduledAt?.toISOString() || undefined,
    completedAt: row.completedAt?.toISOString() || undefined,
    customerFeedback: row.customerFeedback || undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** 报修/建维保单 */
export async function createMaintenance(input: {
  tenantId: string;
  equipmentSNId: string;
  type: string;
  reportedBy: string;
  description: string;
}) {
  const now = new Date();
  const id = nanoid();
  await db.insert(pmsMaintenanceRecords).values({
    id,
    tenantId: input.tenantId,
    equipmentSNId: input.equipmentSNId,
    type: input.type,
    reportedBy: input.reportedBy,
    assignedTo: null,
    description: input.description,
    status: 'pending',
    scheduledAt: null,
    completedAt: null,
    customerFeedback: null,
    createdAt: now,
    updatedAt: now,
  });
  // 埋点: 通知派单 (急修高优先, 失败降级)
  await emitAlert({
    tenantId: input.tenantId,
    ...maintenanceReportedAlert({ recordId: id, maintenanceType: input.type, equipmentSNId: input.equipmentSNId }),
  });

  return {
    id,
    tenantId: input.tenantId,
    equipmentSNId: input.equipmentSNId,
    type: input.type,
    reportedBy: input.reportedBy,
    description: input.description,
    status: 'pending',
    createdAt: now.toISOString(),
  };
}

/** 列表查询维保记录 */
export async function listMaintenance(filters: {
  tenantId: string;
  equipmentSNId?: string;
  status?: string;
  assignedTo?: string;
  limit?: number;
  offset?: number;
}): Promise<ReturnType<typeof mapRecord>[]> {
  const conditions = [eq(pmsMaintenanceRecords.tenantId, filters.tenantId)];
  if (filters.equipmentSNId) conditions.push(eq(pmsMaintenanceRecords.equipmentSNId, filters.equipmentSNId));
  if (filters.status) conditions.push(eq(pmsMaintenanceRecords.status, filters.status));
  if (filters.assignedTo) conditions.push(eq(pmsMaintenanceRecords.assignedTo, filters.assignedTo));

  const rows = await db
    .select()
    .from(pmsMaintenanceRecords)
    .where(and(...conditions))
    .orderBy(desc(pmsMaintenanceRecords.createdAt))
    .limit(filters.limit ?? 50)
    .offset(filters.offset ?? 0);

  return rows.map(mapRecord);
}

/** 获取维保记录 */
export async function getMaintenance(id: string, tenantId: string): Promise<ReturnType<typeof mapRecord> | null> {
  const rows = await db
    .select()
    .from(pmsMaintenanceRecords)
    .where(and(eq(pmsMaintenanceRecords.id, id), eq(pmsMaintenanceRecords.tenantId, tenantId)))
    .limit(1);
  if (rows.length === 0) return null;
  return mapRecord(rows[0]);
}

/** 派工 (pending → assigned) */
export async function assignMaintenance(input: {
  tenantId: string;
  id: string;
  assignedTo: string;
  scheduledAt?: string;
}) {
  const now = new Date();
  const current = await getMaintenance(input.id, input.tenantId);
  if (!current) throw new Error('maintenance record not found');
  if (!canTransitionMaintenance(current.status, 'assigned')) {
    throw new Error('maintenance not assignable');
  }

  await db
    .update(pmsMaintenanceRecords)
    .set({
      status: 'assigned',
      assignedTo: input.assignedTo,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      updatedAt: now,
    })
    .where(and(eq(pmsMaintenanceRecords.id, input.id), eq(pmsMaintenanceRecords.tenantId, input.tenantId)));

  return { id: input.id, status: 'assigned', assignedTo: input.assignedTo, updatedAt: now.toISOString() };
}

/** 状态流转 (in_progress / completed / cancelled) */
export async function transitionMaintenance(input: {
  tenantId: string;
  id: string;
  toStatus: MaintenanceStatus;
  customerFeedback?: string;
}) {
  const now = new Date();
  const current = await getMaintenance(input.id, input.tenantId);
  if (!current) throw new Error('maintenance record not found');
  if (!canTransitionMaintenance(current.status, input.toStatus)) {
    throw new Error(`illegal maintenance transition: ${current.status} → ${input.toStatus}`);
  }

  const patch: Partial<typeof pmsMaintenanceRecords.$inferInsert> = { status: input.toStatus, updatedAt: now };
  if (input.toStatus === 'completed') {
    patch.completedAt = now;
    if (input.customerFeedback) patch.customerFeedback = input.customerFeedback;
  }

  await db
    .update(pmsMaintenanceRecords)
    .set(patch)
    .where(and(eq(pmsMaintenanceRecords.id, input.id), eq(pmsMaintenanceRecords.tenantId, input.tenantId)));

  return {
    id: input.id,
    from: current.status,
    to: input.toStatus,
    completedAt: patch.completedAt ? patch.completedAt.toISOString() : current.completedAt,
    updatedAt: now.toISOString(),
  };
}
