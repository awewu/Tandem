/**
 * PMS API · 设备 SN 全生命周期 (FSM 资产追溯)
 *
 * GET  ?snCode= | ?deliveryOrderId= | ?parentSNId= | ?batchNumber=&status=
 *      查询 SN (经销商须带 deliveryOrderId 且归属校验)
 * POST { action:'register' }    登记 SN (仅内部)
 * POST { action:'transition' }  状态流转 (发货/安装/激活/退役/召回, 仅内部)
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import { getDeliveryOrder } from '@/lib/pms/delivery-order-service';
import {
  registerSN,
  listSNs,
  getSNByCode,
  transitionSN,
  listChildSNs,
  type SNStatus,
} from '@/lib/pms/equipment-sn-service';

const SN_STATUSES: SNStatus[] = ['in_stock', 'shipped', 'installed', 'active', 'retired', 'returned', 'recalled'];

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
    const snCode = searchParams.get('snCode') || undefined;
    const deliveryOrderId = searchParams.get('deliveryOrderId') || undefined;
    const parentSNId = searchParams.get('parentSNId') || undefined;

    // 单个 SN 溯源
    if (snCode) {
      const sn = await getSNByCode(snCode, auth.tenantId);
      if (!sn) return NextResponse.json({ error: 'SN not found' }, { status: 404 });
      // 隔离: 非内部须能访问其交付工单
      if (!auth.isInternal) {
        if (!sn.deliveryOrderId) return NextResponse.json({ error: 'SN not found' }, { status: 404 });
        const order = await getDeliveryOrder(sn.deliveryOrderId, auth.tenantId, visibleOrgIds);
        if (!order) return NextResponse.json({ error: 'SN not found' }, { status: 404 });
      }
      return NextResponse.json({ sn });
    }

    // 子 SN 层级
    if (parentSNId) {
      const children = await listChildSNs(parentSNId, auth.tenantId);
      return NextResponse.json({ sns: children });
    }

    // 隔离: 非内部须指定 deliveryOrderId 且校验归属
    if (!auth.isInternal) {
      if (!deliveryOrderId) {
        return NextResponse.json({ error: 'deliveryOrderId is required for external users' }, { status: 400 });
      }
      const order = await getDeliveryOrder(deliveryOrderId, auth.tenantId, visibleOrgIds);
      if (!order) {
        return NextResponse.json({ error: 'Delivery order not found' }, { status: 404 });
      }
    }

    const sns = await listSNs({
      tenantId: auth.tenantId,
      status: searchParams.get('status') || undefined,
      batchNumber: searchParams.get('batchNumber') || undefined,
      deliveryOrderId,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    });
    return NextResponse.json({ sns });
  } catch (error: any) {
    console.error('List SN error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list SN' },
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

    // SN 写操作仅内部 (出厂/库存/流转由厂商侧管理)
    if (!auth.isInternal) {
      return NextResponse.json({ error: 'forbidden: SN write requires internal role' }, { status: 403 });
    }

    if (action === 'register') {
      if (!body.snCode || !body.productId || !body.productModel) {
        return NextResponse.json(
          { error: 'Missing required fields: snCode, productId, productModel' },
          { status: 400 }
        );
      }
      const sn = await registerSN({
        tenantId: auth.tenantId,
        snCode: body.snCode,
        productId: body.productId,
        productModel: body.productModel,
        batchNumber: body.batchNumber,
        manufacturedAt: body.manufacturedAt,
        parentSNId: body.parentSNId,
      });
      return NextResponse.json({ sn }, { status: 201 });
    }

    if (action === 'transition') {
      if (!body.snId || !body.toStatus) {
        return NextResponse.json({ error: 'Missing snId or toStatus' }, { status: 400 });
      }
      if (!SN_STATUSES.includes(body.toStatus)) {
        return NextResponse.json({ error: 'invalid toStatus' }, { status: 400 });
      }
      const result = await transitionSN({
        tenantId: auth.tenantId,
        snId: body.snId,
        toStatus: body.toStatus,
        deliveryOrderId: body.deliveryOrderId,
        installedAt: body.installedAt,
        warrantyMonths: typeof body.warrantyMonths === 'number' ? body.warrantyMonths : undefined,
      });
      return NextResponse.json({ result });
    }

    return NextResponse.json({ error: 'Unknown action; expected register | transition' }, { status: 400 });
  } catch (error: any) {
    console.error('SN action error:', error);
    if (/not found|already exists|illegal SN transition/.test(error?.message || '')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: error.message || 'Failed to process SN' },
      { status: 500 }
    );
  }
}
