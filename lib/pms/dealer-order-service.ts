/**
 * PMS · 经销商在线订货服务
 *
 * 业务: 经销商提交订货单 → 内部确认 → 发货 → 完成; 可取消.
 * 状态机: pending → confirmed → shipped → completed; 非终态可 cancelled
 * 对齐 drizzle 表 pms_dealer_orders (dealerOrgId 隔离, orderNumber 唯一).
 */

import { nanoid } from 'nanoid';
import { db } from '../infra/drizzle-client';
import { pmsDealerOrders } from '../infra/drizzle-schema';
import { and, eq, desc } from 'drizzle-orm';
import { emitAlert } from './alert-service';
import { dealerOrderSubmittedAlert } from './alert-events';

// --- 纯函数 (可测) ---

export type DealerOrderStatus = 'pending' | 'confirmed' | 'shipped' | 'completed' | 'cancelled';

const ORDER_TRANSITIONS: Record<string, DealerOrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['completed'],
  completed: [],
  cancelled: [],
};

/** 订货单状态流转是否合法 */
export function canTransitionOrder(from: string, to: string): boolean {
  const allowed = ORDER_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to as DealerOrderStatus);
}

export interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

/** 订货单总额 = Σ(qty×unitPrice), 保留两位; 忽略非法行 */
export function computeOrderTotal(items: OrderItem[]): number {
  if (!Array.isArray(items)) return 0;
  let total = 0;
  for (const it of items) {
    const qty = Number(it?.quantity);
    const price = Number(it?.unitPrice);
    if (qty > 0 && price >= 0) total += qty * price;
  }
  return Math.round(total * 100) / 100;
}

/** 生成订货单号 DO-YYYYMMDD-XXXX */
export function formatDealerOrderNumber(date: Date, seq: number): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `DO-${y}${m}${d}-${String(seq).padStart(4, '0')}`;
}

// --- DB ---

function mapOrder(row: typeof pmsDealerOrders.$inferSelect) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    dealerOrgId: row.dealerOrgId,
    orderNumber: row.orderNumber,
    items: row.items,
    totalAmount: parseFloat(row.totalAmount),
    status: row.status,
    confirmedBy: row.confirmedBy || undefined,
    confirmedAt: row.confirmedAt?.toISOString() || undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createDealerOrder(input: {
  tenantId: string;
  dealerOrgId: string;
  items: OrderItem[];
}) {
  const now = new Date();
  const id = nanoid();
  const totalAmount = computeOrderTotal(input.items);
  const orderNumber = formatDealerOrderNumber(now, Math.floor(Math.random() * 10000));
  await db.insert(pmsDealerOrders).values({
    id,
    tenantId: input.tenantId,
    dealerOrgId: input.dealerOrgId,
    orderNumber,
    items: input.items,
    totalAmount: totalAmount.toString(),
    status: 'pending',
    confirmedBy: null,
    confirmedAt: null,
    createdAt: now,
    updatedAt: now,
  });
  // 埋点: 通知内部确认订货单 (失败降级)
  await emitAlert({
    tenantId: input.tenantId,
    ...dealerOrderSubmittedAlert({ orderId: id, orderNumber, totalAmount }),
  });

  return { id, tenantId: input.tenantId, dealerOrgId: input.dealerOrgId, orderNumber, items: input.items, totalAmount, status: 'pending', createdAt: now.toISOString() };
}

export async function listDealerOrders(filters: {
  tenantId: string;
  dealerOrgId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<ReturnType<typeof mapOrder>[]> {
  const conditions = [eq(pmsDealerOrders.tenantId, filters.tenantId)];
  if (filters.dealerOrgId) conditions.push(eq(pmsDealerOrders.dealerOrgId, filters.dealerOrgId));
  if (filters.status) conditions.push(eq(pmsDealerOrders.status, filters.status));
  const rows = await db
    .select()
    .from(pmsDealerOrders)
    .where(and(...conditions))
    .orderBy(desc(pmsDealerOrders.createdAt))
    .limit(filters.limit ?? 100)
    .offset(filters.offset ?? 0);
  return rows.map(mapOrder);
}

export async function getDealerOrder(id: string, tenantId: string): Promise<ReturnType<typeof mapOrder> | null> {
  const rows = await db
    .select()
    .from(pmsDealerOrders)
    .where(and(eq(pmsDealerOrders.id, id), eq(pmsDealerOrders.tenantId, tenantId)))
    .limit(1);
  return rows.length ? mapOrder(rows[0]) : null;
}

/** 状态流转 (confirm/ship/complete/cancel) */
export async function transitionDealerOrder(input: {
  tenantId: string;
  id: string;
  toStatus: DealerOrderStatus;
  actorId?: string;
}) {
  const now = new Date();
  const rows = await db
    .select()
    .from(pmsDealerOrders)
    .where(and(eq(pmsDealerOrders.id, input.id), eq(pmsDealerOrders.tenantId, input.tenantId)))
    .limit(1);
  if (rows.length === 0) throw new Error('dealer order not found');
  if (!canTransitionOrder(rows[0].status, input.toStatus)) {
    throw new Error(`illegal order transition: ${rows[0].status} → ${input.toStatus}`);
  }
  const patch: Partial<typeof pmsDealerOrders.$inferInsert> = { status: input.toStatus, updatedAt: now };
  if (input.toStatus === 'confirmed') {
    patch.confirmedBy = input.actorId ?? null;
    patch.confirmedAt = now;
  }
  await db
    .update(pmsDealerOrders)
    .set(patch)
    .where(eq(pmsDealerOrders.id, input.id));
  return { id: input.id, from: rows[0].status, to: input.toStatus, updatedAt: now.toISOString() };
}
