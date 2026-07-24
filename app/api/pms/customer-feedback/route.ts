/**
 * PMS API · 甲方触点 / 满意度反馈
 *
 * POST  免登录提交反馈 (甲方无账号; 经设备铭牌二维码进入)
 *       body: { tenantId?, snCode?, maintenanceRecordId?, type, rating?, comment?, contactInfo? }
 * GET   ?snCode=&type=  列表 (仅内部)
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import {
  submitFeedback,
  listFeedback,
  isValidFeedbackType,
  isValidRating,
} from '@/lib/pms/customer-feedback-service';

// 免登录提交
export async function POST(req: NextRequest) {
  await boot();
  try {
    const body = await req.json();
    const tenantId = typeof body.tenantId === 'string' && body.tenantId ? body.tenantId : 'default';

    if (!body.type || !isValidFeedbackType(body.type)) {
      return NextResponse.json({ error: 'invalid or missing type' }, { status: 400 });
    }
    if (!isValidRating(body.rating, body.type)) {
      return NextResponse.json({ error: 'invalid rating (1-5; required for satisfaction)' }, { status: 400 });
    }
    if (!body.snCode && !body.maintenanceRecordId) {
      return NextResponse.json({ error: 'snCode or maintenanceRecordId is required' }, { status: 400 });
    }

    const feedback = await submitFeedback({
      tenantId,
      snCode: body.snCode,
      maintenanceRecordId: body.maintenanceRecordId,
      type: body.type,
      rating: typeof body.rating === 'number' ? body.rating : undefined,
      comment: body.comment,
      contactInfo: body.contactInfo,
    });
    return NextResponse.json({ feedback }, { status: 201 });
  } catch (error: any) {
    console.error('Feedback POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}

// 列表 (仅内部)
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
    return NextResponse.json({ error: 'forbidden: feedback review is internal' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const feedback = await listFeedback({
      tenantId: auth.tenantId,
      snCode: searchParams.get('snCode') || undefined,
      maintenanceRecordId: searchParams.get('maintenanceRecordId') || undefined,
      type: searchParams.get('type') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    });
    return NextResponse.json({ feedback });
  } catch (error: any) {
    console.error('Feedback GET error:', error);
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}
