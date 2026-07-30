/**
 * PMS API · 商机详情
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import {
  getOpportunity,
  updateOpportunity,
  archiveOpportunity,
} from '@/lib/pms/opportunity-service';

const PATCH_FIELDS = [
  'projectId',
  'customerName',
  'projectName',
  'stage',
  'status',
  'contactName',
  'contactTitle',
  'leadSource',
  'competitors',
  'customerIndustry',
  'customerPhone',
  'customerAddress',
  'estimatedAmount',
  'estimatedClosingDate',
  'productLine',
  'productSeries',
  'productSeriesCode',
  'productModel',
  'productModelCode',
  'productCatalogId',
  'productCategory',
  'productAttributes',
  'region',
  'channel',
] as const;

function sanitizePatchBody(body: Record<string, unknown>) {
  return Object.fromEntries(
    PATCH_FIELDS
      .filter((field) => Object.prototype.hasOwnProperty.call(body, field))
      .map((field) => [field, body[field]])
  );
}

/**
 * GET /api/pms/opportunities/[id] - 获取详情
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await boot();
  
  let auth: PmsAuthResult;
  try {
    auth = await requirePmsAuth(req);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const visibleOrgIds = auth.isInternal ? undefined : auth.visibleOrgIds;
    
    const opportunity = await getOpportunity(id, auth.tenantId, visibleOrgIds);
    
    if (!opportunity) {
      return NextResponse.json(
        { error: 'Opportunity not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ opportunity });
  } catch (error: any) {
    console.error('Get opportunity error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get opportunity' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/pms/opportunities/[id] - 更新商机
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await boot();
  
  let auth: PmsAuthResult;
  try {
    auth = await requirePmsAuth(req);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = sanitizePatchBody(await req.json());
    const visibleOrgIds = auth.isInternal ? undefined : auth.visibleOrgIds;
    
    // 归属校验: 跨 org 禁止写
    const existing = await getOpportunity(id, auth.tenantId, visibleOrgIds);
    if (!existing) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
    }
    
    const updated = await updateOpportunity(id, body, auth.tenantId);
    if (!updated) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
    }
    
    return NextResponse.json({ opportunity: updated });
  } catch (error: any) {
    console.error('Update opportunity error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update opportunity' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/pms/opportunities/[id] - 归档商机
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await boot();
  
  let auth: PmsAuthResult;
  try {
    auth = await requirePmsAuth(req);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const visibleOrgIds = auth.isInternal ? undefined : auth.visibleOrgIds;
    
    // 归属校验: 跨 org 禁止归档
    const existing = await getOpportunity(id, auth.tenantId, visibleOrgIds);
    if (!existing) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
    }
    
    await archiveOpportunity(id, auth.tenantId);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Archive opportunity error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to archive opportunity' },
      { status: 500 }
    );
  }
}
