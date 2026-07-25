/**
 * PMS API · 商机管理
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import {
  createOpportunity,
  listOpportunities,
  updateOpportunity,
} from '@/lib/pms/opportunity-service';

/**
 * GET /api/pms/opportunities - 列表查询
 */
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
    
    const opportunities = await listOpportunities({
      tenantId: auth.tenantId,
      orgId: searchParams.get('orgId') || undefined,
      dealerOrgId: searchParams.get('dealerOrgId') || undefined,
      stage: searchParams.get('stage') || undefined,
      status: searchParams.get('status') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
      visibleOrgIds: auth.isInternal ? undefined : auth.visibleOrgIds,
    });
    
    return NextResponse.json({ opportunities });
  } catch (error: any) {
    console.error('List opportunities error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list opportunities' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pms/opportunities - 创建商机
 */
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
    
    // 验证必填字段
    if (!body.dealerOrgId || !body.customerName || !body.projectName) {
      return NextResponse.json(
        { error: 'Missing required fields: dealerOrgId, customerName, projectName' },
        { status: 400 }
      );
    }
    
    // orgId 归属: 外部经销商强制落自身 org (禁止代报他 org); 内部可指定
    const orgId = auth.isInternal ? (body.orgId || body.dealerOrgId) : (auth.orgId || body.dealerOrgId);
    const dealerOrgId = auth.isInternal ? body.dealerOrgId : (auth.orgId || body.dealerOrgId);
    
    const result = await createOpportunity({
      tenantId: auth.tenantId,
      orgId,
      dealerOrgId,
      reporterId: auth.userId,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      customerAddress: body.customerAddress,
      projectName: body.projectName,
      stage: body.stage,
      status: body.status,
      estimatedAmount: body.estimatedAmount,
      estimatedClosingDate: body.estimatedClosingDate,
      productLine: body.productLine,
      productSeries: body.productSeries,
      productSeriesCode: body.productSeriesCode,
      productModel: body.productModel,
      productModelCode: body.productModelCode,
      productCatalogId: body.productCatalogId,
      productCategory: body.productCategory,
      productAttributes: body.productAttributes,
      region: body.region,
      channel: body.channel,
    });
    
    // 如果查重失败（撞单），返回 409
    if (!result.opportunity && result.duplicateCheck) {
      return NextResponse.json(
        {
          error: 'Duplicate opportunity detected',
          duplicateCheck: result.duplicateCheck,
        },
        { status: 409 }
      );
    }
    
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('Create opportunity error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create opportunity' },
      { status: 500 }
    );
  }
}
