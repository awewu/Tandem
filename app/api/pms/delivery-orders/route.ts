/**
 * PMS API · 交付工单 + 交付任务 (设备交付流程)
 *
 * GET  ?orderId=&tasks=1        列出工单; 或列某工单的任务
 * POST { action:'transition' }  工单状态流转 (排期/交付/完成/取消)
 * POST { action:'create_task' } 新建交付子任务
 * POST { action:'complete_task' } 完成交付任务
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import {
  listDeliveryOrders,
  getDeliveryOrder,
  transitionDeliveryOrder,
  createDeliveryTask,
  listDeliveryTasks,
  completeDeliveryTask,
  getTaskParentOrderId,
  type DeliveryStatus,
} from '@/lib/pms/delivery-order-service';

const DELIVERY_STATUSES: DeliveryStatus[] = ['pending', 'scheduled', 'delivered', 'completed', 'cancelled'];

export async function GET(req: NextRequest) {
  await boot();

  let auth: PmsAuthResult;
  try {
    auth = await requirePmsAuth(req);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const visibleOrgIds = auth.isInternal ? undefined : auth.visibleOrgIds;
    const orderId = searchParams.get('orderId') || undefined;

    // 列某工单的任务
    if (orderId && searchParams.get('tasks') === '1') {
      const order = await getDeliveryOrder(orderId, auth.tenantId, visibleOrgIds);
      if (!order) {
        return NextResponse.json({ error: 'Delivery order not found' }, { status: 404 });
      }
      const tasks = await listDeliveryTasks({
        tenantId: auth.tenantId,
        deliveryOrderId: orderId,
        status: searchParams.get('status') || undefined,
      });
      return NextResponse.json({ tasks });
    }

    const orders = await listDeliveryOrders({
      tenantId: auth.tenantId,
      status: searchParams.get('status') || undefined,
      contractId: searchParams.get('contractId') || undefined,
      visibleOrgIds,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    });
    return NextResponse.json({ orders });
  } catch (error: any) {
    console.error('List delivery orders error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list delivery orders' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  await boot();

  let auth: PmsAuthResult;
  try {
    auth = await requirePmsAuth(req);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const action = body.action as string;
    const visibleOrgIds = auth.isInternal ? undefined : auth.visibleOrgIds;

    // --- 工单状态流转 ---
    if (action === 'transition') {
      if (!body.orderId || !body.toStatus) {
        return NextResponse.json({ error: 'Missing orderId or toStatus' }, { status: 400 });
      }
      if (!DELIVERY_STATUSES.includes(body.toStatus)) {
        return NextResponse.json({ error: 'invalid toStatus' }, { status: 400 });
      }
      const result = await transitionDeliveryOrder({
        tenantId: auth.tenantId,
        orderId: body.orderId,
        toStatus: body.toStatus,
        scheduledDeliveryDate: body.scheduledDeliveryDate,
        actualDeliveryDate: body.actualDeliveryDate,
        visibleOrgIds,
      });
      return NextResponse.json({ result });
    }

    // --- 新建交付任务 ---
    if (action === 'create_task') {
      if (!body.orderId || !body.type || !body.assignedTo || !body.assigneeType || !body.description) {
        return NextResponse.json(
          { error: 'Missing required fields: orderId, type, assignedTo, assigneeType, description' },
          { status: 400 }
        );
      }
      // 归属校验: 工单须在可见范围
      const order = await getDeliveryOrder(body.orderId, auth.tenantId, visibleOrgIds);
      if (!order) {
        return NextResponse.json({ error: 'Delivery order not found' }, { status: 404 });
      }
      const task = await createDeliveryTask({
        tenantId: auth.tenantId,
        deliveryOrderId: body.orderId,
        type: body.type,
        assignedTo: body.assignedTo,
        assigneeType: body.assigneeType,
        description: body.description,
        dueDate: body.dueDate,
      });
      return NextResponse.json({ task }, { status: 201 });
    }

    // --- 完成交付任务 ---
    if (action === 'complete_task') {
      if (!body.taskId) {
        return NextResponse.json({ error: 'Missing taskId' }, { status: 400 });
      }
      // 归属校验: 任务所属工单须在可见范围
      const parentOrderId = await getTaskParentOrderId(body.taskId, auth.tenantId);
      if (!parentOrderId) {
        return NextResponse.json({ error: 'Delivery task not found' }, { status: 404 });
      }
      const order = await getDeliveryOrder(parentOrderId, auth.tenantId, visibleOrgIds);
      if (!order) {
        return NextResponse.json({ error: 'Delivery task not found' }, { status: 404 });
      }
      const result = await completeDeliveryTask({ tenantId: auth.tenantId, taskId: body.taskId });
      return NextResponse.json({ result });
    }

    return NextResponse.json(
      { error: 'Unknown action; expected transition | create_task | complete_task' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Delivery order action error:', error);
    if (/not found|not completable|illegal transition/.test(error?.message || '')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: error.message || 'Failed to process delivery order' },
      { status: 500 }
    );
  }
}
