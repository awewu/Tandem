/**
 * PMS API · 设备 IoT 遥测 (内部/设备网关)
 *
 * GET  ?snCode=&from=&to=   查询时序 (内部)
 * POST { action:'ingest' }  采集遥测 (仅内部/网关)
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import {
  ingestTelemetry,
  listTelemetry,
} from '@/lib/pms/telemetry-service';

export async function GET(req: NextRequest) {
  await boot();
  let auth: PmsAuthResult;
  try {
    auth = await requirePmsAuth(req);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (!auth.isInternal) {
    return NextResponse.json({ error: 'forbidden: telemetry is internal' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const snCode = searchParams.get('snCode');
    if (!snCode) {
      return NextResponse.json({ error: 'snCode is required' }, { status: 400 });
    }
    const telemetry = await listTelemetry({
      tenantId: auth.tenantId,
      snCode,
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 200,
    });
    return NextResponse.json({ telemetry });
  } catch (error: any) {
    console.error('Telemetry GET error:', error);
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

  if (!auth.isInternal) {
    return NextResponse.json({ error: 'forbidden: telemetry ingest is internal' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const action = (body.action as string) || 'ingest';

    if (action === 'ingest') {
      if (!body.snCode || !body.metrics || typeof body.metrics !== 'object') {
        return NextResponse.json({ error: 'Missing snCode or metrics{}' }, { status: 400 });
      }
      const result = await ingestTelemetry({
        tenantId: auth.tenantId,
        snCode: body.snCode,
        timestamp: body.timestamp,
        metrics: body.metrics,
        thresholds: body.thresholds,
      });
      return NextResponse.json({ result }, { status: 201 });
    }

    return NextResponse.json({ error: 'Unknown action; expected ingest' }, { status: 400 });
  } catch (error: any) {
    console.error('Telemetry POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}
