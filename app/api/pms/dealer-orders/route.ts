/**
 * PMS API · 经销商在线订货
 *
 * GET  ?dealerOrgId=&status=   列表 (经销商仅本 org)
 * POST { action:'create' }     提交订货单 (经销商本 org / 内部)
 * POST { action:'transition' } 状态流转: confirm/ship 仅内部; cancel 双方; complete 仅内部
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import {
  createDealerOrder,
  listDealerOrders,
  getDealerOrder,
  transitionDealerOrder,
  type DealerOrderStatus,
} from '@/lib/pms/dealer-order-service';

const ORDER_STATUSES: DealerOrderStatus[] = ['pending', 'confirmed', 'shipped', 'completed', 'cancelled'];
const INTERNAL_ONLY_TRANSITIONS = new Set<DealerOrderStatus>(['confirmed', 'shipped', 'completed']);

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
    let dealerOrgId = searchParams.get('dealerOrgId') || undefined;

    if (!auth.isInternal) {
      if (!dealerOrgId || !auth.visibleOrgIds.includes(dealerOrgId)) {
        return NextResponse.json({ error: 'forbidden: dealerOrgId out of scope' }, { status: 403 });
      }
    }

    const orders = await listDealerOrders({
      tenantId: auth.tenantId,
      dealerOrgId,
      status: searchParams.get('status') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    });
    return NextResponse.json({ orders });
  } catch (error: any) {
    console.error('Dealer orders GET error:', error);
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
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
    const action = (body.action as string) || 'create';

    if (action === 'create') {
      const dealerOrgId = auth.isInternal ? body.dealerOrgId : auth.orgId;
      if (!dealerOrgId || !Array.isArray(body.items) || body.items.length === 0) {
        return NextResponse.json({ error: 'Missing dealerOrgId or items[]' }, { status: 400 });
      }
      if (!auth.isInternal && !auth.visibleOrgIds.includes(dealerOrgId)) {
        return NextResponse.json({ error: 'forbidden: dealerOrgId out of scope' }, { status: 403 });
      }
      const order = await createDealerOrder({ tenantId: auth.tenantId, dealerOrgId, items: body.items });
      return NextResponse.json({ order }, { status: 201 });
    }

    if (action === 'transition') {
      if (!body.id || !body.toStatus || !ORDER_STATUSES.includes(body.toStatus)) {
        return NextResponse.json({ error: 'Missing/invalid id or toStatus' }, { status: 400 });
      }
      const order = await getDealerOrder(body.id, auth.tenantId);
      if (!order) {
        return NextResponse.json({ error: 'dealer order not found' }, { status: 404 });
      }
      // 隔离: 经销商仅能操作本 org, 且只能 cancel
      if (!auth.isInternal) {
        if (!auth.visibleOrgIds.includes(order.dealerOrgId)) {
          return NextResponse.json({ error: 'forbidden: order out of scope' }, { status: 403 });
        }
        if (INTERNAL_ONLY_TRANSITIONS.has(body.toStatus)) {
          return NextResponse.json({ error: 'forbidden: only internal can confirm/ship/complete' }, { status: 403 });
        }
      }
      const result = await transitionDealerOrder({
        tenantId: auth.tenantId,
        id: body.id,
        toStatus: body.toStatus,
        actorId: auth.userId,
      });
      return NextResponse.json({ result });
    }

    return NextResponse.json({ error: 'Unknown action; expected create | transition' }, { status: 400 });
  } catch (error: any) {
    console.error('Dealer orders POST error:', error);
    if (/not found|illegal order transition/.test(error?.message || '')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}
