/**
 * PMS · 设备 SN 码全生命周期服务 (FSM 资产追溯)
 *
 * 业务 (CRM-PM-BLUEPRINT):
 *   - 每台设备唯一 SN, 出厂→发货(关联交付工单)→安装→激活/保修→退役/召回
 *   - 父子 SN 资产层级 (整机含子部件, parentSNId)
 *   - 保修期基于安装日 + 保修月数计算
 *
 * SN 状态机:
 *   in_stock → shipped → installed → active → retired
 *   returned → in_stock; 任一活动态可 recalled; recalled → returned|retired
 *
 * 对齐 drizzle 表 pms_equipment_sns (snCode 唯一; 无 orgId, 经 deliveryOrderId 隔离).
 */

import { nanoid } from 'nanoid';
import { db } from '../infra/drizzle-client';
import { pmsEquipmentSns } from '../infra/drizzle-schema';
import { and, eq, desc } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// 纯函数 (可测)
// ---------------------------------------------------------------------------

export type SNStatus =
  | 'in_stock'
  | 'shipped'
  | 'installed'
  | 'active'
  | 'retired'
  | 'returned'
  | 'recalled';

const SN_TRANSITIONS: Record<string, SNStatus[]> = {
  in_stock: ['shipped', 'recalled'],
  shipped: ['installed', 'returned', 'recalled'],
  installed: ['active', 'recalled'],
  active: ['retired', 'recalled'],
  returned: ['in_stock'],
  recalled: ['returned', 'retired'],
  retired: [],
};

/** SN 状态流转是否合法 */
export function canTransitionSN(from: string, to: string): boolean {
  const allowed = SN_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to as SNStatus);
}

/** 保修到期日 = 安装日 + 保修月数 (返回 YYYY-MM-DD) */
export function computeWarrantyExpiry(installedAt: string, warrantyMonths: number): string {
  const base = new Date(installedAt + (installedAt.length === 10 ? 'T00:00:00Z' : ''));
  if (isNaN(base.getTime())) return installedAt;
  const d = new Date(base.getTime());
  d.setUTCMonth(d.getUTCMonth() + warrantyMonths);
  return d.toISOString().slice(0, 10);
}

/** 保修是否仍有效 (到期日 >= now) */
export function isWarrantyValid(warrantyExpiresAt: string | null | undefined, now: Date): boolean {
  if (!warrantyExpiresAt) return false;
  const exp = new Date(warrantyExpiresAt + (warrantyExpiresAt.length === 10 ? 'T23:59:59Z' : ''));
  if (isNaN(exp.getTime())) return false;
  return exp.getTime() >= now.getTime();
}

// ---------------------------------------------------------------------------
// DB 服务
// ---------------------------------------------------------------------------

function mapSN(row: typeof pmsEquipmentSns.$inferSelect) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    snCode: row.snCode,
    productId: row.productId,
    productModel: row.productModel,
    batchNumber: row.batchNumber || undefined,
    manufacturedAt: row.manufacturedAt || undefined,
    parentSNId: row.parentSNId || undefined,
    deliveryOrderId: row.deliveryOrderId || undefined,
    status: row.status,
    installedAt: row.installedAt || undefined,
    warrantyExpiresAt: row.warrantyExpiresAt || undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** 登记 SN (出厂入库). snCode 唯一, 冲突 race-safe. */
export async function registerSN(input: {
  tenantId: string;
  snCode: string;
  productId: string;
  productModel: string;
  batchNumber?: string;
  manufacturedAt?: string;
  parentSNId?: string;
}): Promise<any> {
  const now = new Date();
  const id = nanoid();
  try {
    await db.insert(pmsEquipmentSns).values({
      id,
      tenantId: input.tenantId,
      snCode: input.snCode,
      productId: input.productId,
      productModel: input.productModel,
      batchNumber: input.batchNumber ?? null,
      manufacturedAt: input.manufacturedAt ?? null,
      parentSNId: input.parentSNId ?? null,
      deliveryOrderId: null,
      status: 'in_stock',
      installedAt: null,
      warrantyExpiresAt: null,
      createdAt: now,
      updatedAt: now,
    });
  } catch (err: any) {
    // Drizzle 包装 postgres 错误: 唯一约束码可能在 err.code 或 err.cause.code
    if (err?.code === '23505' || err?.cause?.code === '23505') {
      throw new Error('SN code already exists');
    }
    throw err;
  }
  return {
    id,
    tenantId: input.tenantId,
    snCode: input.snCode,
    productId: input.productId,
    productModel: input.productModel,
    batchNumber: input.batchNumber,
    manufacturedAt: input.manufacturedAt,
    parentSNId: input.parentSNId,
    status: 'in_stock',
    createdAt: now.toISOString(),
  };
}

/** 列表查询 SN */
export async function listSNs(filters: {
  tenantId: string;
  status?: string;
  batchNumber?: string;
  deliveryOrderId?: string;
  parentSNId?: string;
  limit?: number;
  offset?: number;
}): Promise<ReturnType<typeof mapSN>[]> {
  const conditions = [eq(pmsEquipmentSns.tenantId, filters.tenantId)];
  if (filters.status) conditions.push(eq(pmsEquipmentSns.status, filters.status));
  if (filters.batchNumber) conditions.push(eq(pmsEquipmentSns.batchNumber, filters.batchNumber));
  if (filters.deliveryOrderId) conditions.push(eq(pmsEquipmentSns.deliveryOrderId, filters.deliveryOrderId));
  if (filters.parentSNId) conditions.push(eq(pmsEquipmentSns.parentSNId, filters.parentSNId));

  const rows = await db
    .select()
    .from(pmsEquipmentSns)
    .where(and(...conditions))
    .orderBy(desc(pmsEquipmentSns.createdAt))
    .limit(filters.limit ?? 50)
    .offset(filters.offset ?? 0);

  return rows.map(mapSN);
}

/** 获取 SN 详情 */
export async function getSN(id: string, tenantId: string): Promise<ReturnType<typeof mapSN> | null> {
  const rows = await db
    .select()
    .from(pmsEquipmentSns)
    .where(and(eq(pmsEquipmentSns.id, id), eq(pmsEquipmentSns.tenantId, tenantId)))
    .limit(1);
  if (rows.length === 0) return null;
  return mapSN(rows[0]);
}

/** 按 SN 码查询 */
export async function getSNByCode(snCode: string, tenantId: string): Promise<ReturnType<typeof mapSN> | null> {
  const rows = await db
    .select()
    .from(pmsEquipmentSns)
    .where(and(eq(pmsEquipmentSns.snCode, snCode), eq(pmsEquipmentSns.tenantId, tenantId)))
    .limit(1);
  if (rows.length === 0) return null;
  return mapSN(rows[0]);
}

/**
 * SN 状态流转.
 *   → shipped: 记录 deliveryOrderId (出货关联交付工单)
 *   → installed: 记录 installedAt (未给则当日) + 按 warrantyMonths 计算保修到期
 */
export async function transitionSN(input: {
  tenantId: string;
  snId: string;
  toStatus: SNStatus;
  deliveryOrderId?: string;
  installedAt?: string;
  warrantyMonths?: number;
}): Promise<any> {
  const now = new Date();

  const current = await getSN(input.snId, input.tenantId);
  if (!current) {
    throw new Error('SN not found');
  }
  if (!canTransitionSN(current.status, input.toStatus)) {
    throw new Error(`illegal SN transition: ${current.status} → ${input.toStatus}`);
  }

  const patch: Record<string, any> = { status: input.toStatus, updatedAt: now };

  if (input.toStatus === 'shipped' && input.deliveryOrderId) {
    patch.deliveryOrderId = input.deliveryOrderId;
  }
  if (input.toStatus === 'installed') {
    const installedAt = input.installedAt ?? now.toISOString().slice(0, 10);
    patch.installedAt = installedAt;
    if (typeof input.warrantyMonths === 'number' && input.warrantyMonths > 0) {
      patch.warrantyExpiresAt = computeWarrantyExpiry(installedAt, input.warrantyMonths);
    }
  }

  await db
    .update(pmsEquipmentSns)
    .set(patch)
    .where(and(eq(pmsEquipmentSns.id, input.snId), eq(pmsEquipmentSns.tenantId, input.tenantId)));

  return {
    snId: input.snId,
    from: current.status,
    to: input.toStatus,
    deliveryOrderId: patch.deliveryOrderId ?? current.deliveryOrderId,
    installedAt: patch.installedAt ?? current.installedAt,
    warrantyExpiresAt: patch.warrantyExpiresAt ?? current.warrantyExpiresAt,
    updatedAt: now.toISOString(),
  };
}

/** 列出子 SN (资产层级) */
export async function listChildSNs(parentSNId: string, tenantId: string): Promise<ReturnType<typeof mapSN>[]> {
  const rows = await db
    .select()
    .from(pmsEquipmentSns)
    .where(and(eq(pmsEquipmentSns.parentSNId, parentSNId), eq(pmsEquipmentSns.tenantId, tenantId)))
    .orderBy(desc(pmsEquipmentSns.createdAt));
  return rows.map(mapSN);
}
