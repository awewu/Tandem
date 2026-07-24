/**
 * PMS API · 分级推送 (告警 + 通知规则)
 *
 * GET  ?type=alerts&severity=&acted=   我的告警 (按 targetUserId)
 * GET  ?type=rules                     通知规则 (内部)
 * POST { action:'ack' }                处理告警
 * POST { action:'create_rule' }        配置规则 (仅内部)
 * POST { action:'create_alert' }       手动建告警 (仅内部)
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import {
  createAlert,
  listAlerts,
  ackAlert,
  createNotificationRule,
  listNotificationRules,
} from '@/lib/pms/alert-service';

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
    const type = searchParams.get('type') || 'alerts';

    if (type === 'rules') {
      if (!auth.isInternal) {
        return NextResponse.json({ error: 'forbidden: rules are internal' }, { status: 403 });
      }
      const rules = await listNotificationRules({
        tenantId: auth.tenantId,
        alertType: searchParams.get('alertType') || undefined,
        severity: searchParams.get('severity') || undefined,
      });
      return NextResponse.json({ rules });
    }

    // alerts: 内部可查全部/按目标; 非内部仅见发给自己的
    const actedParam = searchParams.get('acted');
    const alerts = await listAlerts({
      tenantId: auth.tenantId,
      severity: searchParams.get('severity') || undefined,
      entityType: searchParams.get('entityType') || undefined,
      entityId: searchParams.get('entityId') || undefined,
      targetUserId: auth.isInternal ? (searchParams.get('targetUserId') || undefined) : auth.userId,
      acted: actedParam == null ? undefined : actedParam === 'true',
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    });
    return NextResponse.json({ alerts });
  } catch (error: any) {
    console.error('Alerts GET error:', error);
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
    const action = body.action as string;

    if (action === 'ack') {
      if (!body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
      const result = await ackAlert({ tenantId: auth.tenantId, id: body.id, actedBy: auth.userId });
      return NextResponse.json({ result });
    }

    // 建规则/建告警仅内部
    if (action === 'create_rule' || action === 'create_alert') {
      if (!auth.isInternal) {
        return NextResponse.json({ error: 'forbidden: requires internal role' }, { status: 403 });
      }
      if (action === 'create_rule') {
        if (!body.name || !body.alertType || !body.severity || !body.targetRole) {
          return NextResponse.json({ error: 'Missing required fields: name, alertType, severity, targetRole' }, { status: 400 });
        }
        const rule = await createNotificationRule(auth.tenantId, { ...body, createdBy: auth.userId });
        return NextResponse.json({ rule }, { status: 201 });
      }
      // create_alert
      if (!body.type || !body.severity || !body.entityType || !body.entityId || !body.message) {
        return NextResponse.json({ error: 'Missing required fields: type, severity, entityType, entityId, message' }, { status: 400 });
      }
      const alert = await createAlert({
        tenantId: auth.tenantId,
        type: body.type,
        severity: body.severity,
        entityType: body.entityType,
        entityId: body.entityId,
        message: body.message,
        targetRole: body.targetRole,
        targetUserId: body.targetUserId,
      });
      return NextResponse.json({ alert }, { status: 201 });
    }

    return NextResponse.json({ error: 'Unknown action; expected ack | create_rule | create_alert' }, { status: 400 });
  } catch (error: any) {
    console.error('Alerts POST error:', error);
    if (/not found/.test(error?.message || '')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}
