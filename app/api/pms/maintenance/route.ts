/**
 * PMS API · 维保记录 (FSM 售后)
 *
 * GET  ?equipmentSNId=&status=&assignedTo=   列表 (经销商须带可访问的 equipmentSNId)
 * POST { action:'report' }      报修建单 (经销商/内部, 返回保内/保外判定)
 * POST { action:'assign' }      派工 (仅内部)
 * POST { action:'transition' }  状态流转 (仅内部)
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import { getSN, isWarrantyValid } from '@/lib/pms/equipment-sn-service';
import { getDeliveryOrder } from '@/lib/pms/delivery-order-service';
import {
  createMaintenance,
  listMaintenance,
  assignMaintenance,
  transitionMaintenance,
  maintenanceCoverage,
  type MaintenanceStatus,
} from '@/lib/pms/maintenance-service';

const MAINT_STATUSES: MaintenanceStatus[] = ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'];

/** 校验用户能否访问某 SN (内部全通; 经销商须其 SN 挂在可见交付工单上). 返回 SN 或 null. */
async function accessibleSN(auth: PmsAuthResult, snId: string) {
  const sn = await getSN(snId, auth.tenantId);
  if (!sn) return null;
  if (auth.isInternal) return sn;
  if (!sn.deliveryOrderId) return null;
  const order = await getDeliveryOrder(sn.deliveryOrderId, auth.tenantId, auth.visibleOrgIds);
  return order ? sn : null;
}

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
    const equipmentSNId = searchParams.get('equipmentSNId') || undefined;

    // 隔离: 非内部须指定可访问的 SN
    if (!auth.isInternal) {
      if (!equipmentSNId) {
        return NextResponse.json({ error: 'equipmentSNId is required for external users' }, { status: 400 });
      }
      const sn = await accessibleSN(auth, equipmentSNId);
      if (!sn) {
        return NextResponse.json({ error: 'SN not found' }, { status: 404 });
      }
    }

    const records = await listMaintenance({
      tenantId: auth.tenantId,
      equipmentSNId,
      status: searchParams.get('status') || undefined,
      assignedTo: searchParams.get('assignedTo') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    });
    return NextResponse.json({ records });
  } catch (error: any) {
    console.error('List maintenance error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list maintenance' },
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
    const action = (body.action as string) || 'report';

    // --- 报修建单 (经销商/内部) ---
    if (action === 'report') {
      if (!body.equipmentSNId || !body.type || !body.description) {
        return NextResponse.json(
          { error: 'Missing required fields: equipmentSNId, type, description' },
          { status: 400 }
        );
      }
      const sn = await accessibleSN(auth, body.equipmentSNId);
      if (!sn) {
        return NextResponse.json({ error: 'SN not found' }, { status: 404 });
      }
      const record = await createMaintenance({
        tenantId: auth.tenantId,
        equipmentSNId: body.equipmentSNId,
        type: body.type,
        reportedBy: auth.userId,
        description: body.description,
      });
      // 保内/保外判定 (基于 SN 保修有效性)
      const coverage = maintenanceCoverage(isWarrantyValid(sn.warrantyExpiresAt, new Date()), body.type);
      return NextResponse.json({ record, coverage }, { status: 201 });
    }

    // --- 派工 / 流转 (仅内部) ---
    if (action === 'assign' || action === 'transition') {
      if (!auth.isInternal) {
        return NextResponse.json({ error: 'forbidden: maintenance dispatch requires internal role' }, { status: 403 });
      }
      if (!body.id) {
        return NextResponse.json({ error: 'Missing id' }, { status: 400 });
      }
      if (action === 'assign') {
        if (!body.assignedTo) {
          return NextResponse.json({ error: 'Missing assignedTo' }, { status: 400 });
        }
        const result = await assignMaintenance({
          tenantId: auth.tenantId,
          id: body.id,
          assignedTo: body.assignedTo,
          scheduledAt: body.scheduledAt,
        });
        return NextResponse.json({ result });
      }
      // transition
      if (!body.toStatus || !MAINT_STATUSES.includes(body.toStatus)) {
        return NextResponse.json({ error: 'invalid or missing toStatus' }, { status: 400 });
      }
      const result = await transitionMaintenance({
        tenantId: auth.tenantId,
        id: body.id,
        toStatus: body.toStatus,
        customerFeedback: body.customerFeedback,
      });
      return NextResponse.json({ result });
    }

    return NextResponse.json({ error: 'Unknown action; expected report | assign | transition' }, { status: 400 });
  } catch (error: any) {
    console.error('Maintenance action error:', error);
    if (/not found|not assignable|illegal maintenance transition/.test(error?.message || '')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: error.message || 'Failed to process maintenance' },
      { status: 500 }
    );
  }
}
