/**
 * PMS API · 主推产品推广活动 (内部)
 *
 * GET  ?productId=&status=       列表
 * POST { action:'create' | 'update_progress' }
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import {
  createCampaign,
  listCampaigns,
  updateCampaignProgress,
} from '@/lib/pms/campaign-service';

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
    const campaigns = await listCampaigns({
      tenantId: auth.tenantId,
      productId: searchParams.get('productId') || undefined,
      status: searchParams.get('status') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    });
    return NextResponse.json({ campaigns });
  } catch (error: any) {
    console.error('Campaigns GET error:', error);
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
    return NextResponse.json({ error: 'forbidden: campaign write requires internal role' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const action = (body.action as string) || 'create';

    if (action === 'create') {
      if (!body.productId || !body.name || body.targetSales == null || !body.startDate || !body.endDate) {
        return NextResponse.json(
          { error: 'Missing required fields: productId, name, targetSales, startDate, endDate' },
          { status: 400 }
        );
      }
      const campaign = await createCampaign({
        tenantId: auth.tenantId,
        productId: body.productId,
        name: body.name,
        targetSales: Number(body.targetSales),
        startDate: body.startDate,
        endDate: body.endDate,
        createdBy: auth.userId,
      });
      return NextResponse.json({ campaign }, { status: 201 });
    }

    if (action === 'update_progress') {
      if (!body.id || body.actualSales == null) {
        return NextResponse.json({ error: 'Missing id or actualSales' }, { status: 400 });
      }
      const result = await updateCampaignProgress({
        tenantId: auth.tenantId,
        id: body.id,
        actualSales: Number(body.actualSales),
        status: body.status,
      });
      return NextResponse.json({ result });
    }

    return NextResponse.json({ error: 'Unknown action; expected create | update_progress' }, { status: 400 });
  } catch (error: any) {
    console.error('Campaigns POST error:', error);
    if (/not found/.test(error?.message || '')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}
