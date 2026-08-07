/**
 * PMS API · 商机管理
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import {
  createOpportunity,
  listOpportunitiesPage,
  updateOpportunity,
} from '@/lib/pms/opportunity-service';
import { resolveDealerOrgId } from '@/lib/pms/dealer-resolver';

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
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '20', 10) || 20));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10) || 0);
    
    const page = await listOpportunitiesPage({
      tenantId: auth.tenantId,
      orgId: searchParams.get('orgId') || undefined,
      dealerOrgId: searchParams.get('dealerOrgId') || undefined,
      stage: searchParams.get('stage') || undefined,
      status: searchParams.get('status') || undefined,
      query: searchParams.get('q') || searchParams.get('query') || undefined,
      limit,
      offset,
      visibleOrgIds: auth.isInternal ? undefined : auth.visibleOrgIds,
    });
    
    return NextResponse.json({
      opportunities: page.opportunities,
      page: {
        total: page.total,
        limit: page.limit,
        offset: page.offset,
        hasMore: page.hasMore,
      },
      duplicateStats: page.duplicateStats,
    });
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
    
    // 验证必填字段 (dealerOrgId 仅内部代报时必填; 外部经销商从登录态推导)
    if (!body.customerName || !body.projectName) {
      return NextResponse.json(
        { error: 'Missing required fields: customerName, projectName' },
        { status: 400 }
      );
    }
    const dealerRef = body.dealerOrgId || body.dealerOrgCode || body.dealerOrgName || body.dealerOrg || body['归属经销商'];
    const resolvedDealerOrgId = auth.isInternal
      ? await resolveDealerOrgId(auth, dealerRef, {
        dealerName: body.dealerOrgName,
        dealerCode: body.dealerOrgCode,
        dealerSource: body.dealerOrgSource,
      })
      : null;
    if (auth.isInternal && !dealerRef) {
      return NextResponse.json(
        { error: '内部代报商机需填写归属经销商' },
        { status: 400 }
      );
    }
    if (auth.isInternal && !resolvedDealerOrgId) {
      return NextResponse.json(
        { error: '归属经销商不存在，请填写经销商名称或先维护经销商组织' },
        { status: 400 }
      );
    }
    
    // orgId 归属: 外部经销商强制落自身 org (禁止代报他 org); 内部可指定
    const orgId = auth.isInternal ? (body.orgId || resolvedDealerOrgId!) : (auth.orgId || body.dealerOrgId);
    const dealerOrgId = auth.isInternal ? resolvedDealerOrgId! : (auth.orgId || body.dealerOrgId);
    
    const result = await createOpportunity({
      tenantId: auth.tenantId,
      orgId,
      dealerOrgId,
      reporterId: auth.userId,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      customerAddress: body.customerAddress,
      contactName: body.contactName,
      contactTitle: body.contactTitle,
      leadSource: body.leadSource,
      competitors: Array.isArray(body.competitors) ? body.competitors : undefined,
      customerIndustry: body.customerIndustry,
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
