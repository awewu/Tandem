/**
 * PMS API · AI 报价推荐 (预留, 内部)
 *
 * GET  ?opportunityId=&status=   列表
 * POST { action:'create' | 'update_status' }
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import {
  createQuoteRecommendation,
  listQuoteRecommendations,
  updateQuoteRecommendationStatus,
} from '@/lib/pms/quote-recommendation-service';

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
    return NextResponse.json({ error: 'forbidden: quote recommendations are internal' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const recommendations = await listQuoteRecommendations({
      tenantId: auth.tenantId,
      opportunityId: searchParams.get('opportunityId') || undefined,
      status: searchParams.get('status') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    });
    return NextResponse.json({ recommendations });
  } catch (error: any) {
    console.error('Quote recommendations GET error:', error);
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
    return NextResponse.json({ error: 'forbidden: requires internal role' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const action = (body.action as string) || 'create';

    if (action === 'create') {
      if (!body.customerRequirements || !body.recommendations) {
        return NextResponse.json({ error: 'Missing customerRequirements or recommendations' }, { status: 400 });
      }
      const recommendation = await createQuoteRecommendation(auth.tenantId, { ...body, createdBy: auth.userId });
      return NextResponse.json({ recommendation }, { status: 201 });
    }

    if (action === 'update_status') {
      if (!body.id || !body.status) {
        return NextResponse.json({ error: 'Missing id or status' }, { status: 400 });
      }
      const result = await updateQuoteRecommendationStatus({ tenantId: auth.tenantId, id: body.id, status: body.status });
      return NextResponse.json({ result });
    }

    return NextResponse.json({ error: 'Unknown action; expected create | update_status' }, { status: 400 });
  } catch (error: any) {
    console.error('Quote recommendations POST error:', error);
    if (/not found/.test(error?.message || '')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}
