/**
 * PMS API · 商机管理
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { createDownstreamOrg } from '@/lib/auth/organizations';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import { getStore } from '@/lib/storage/repository';
import {
  createOpportunity,
  listOpportunities,
  updateOpportunity,
} from '@/lib/pms/opportunity-service';

function normalizeDealerRef(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

async function resolveDealerOrgId(
  auth: PmsAuthResult,
  ref: unknown,
  options: { dealerName?: unknown; dealerSource?: unknown } = {},
): Promise<string | null> {
  const targets = [ref, options.dealerName]
    .map(normalizeDealerRef)
    .filter(Boolean);
  if (targets.length === 0) return null;
  const orgs = await getStore().organizations.list({ tenantId: auth.tenantId });
  const matched = orgs.find((org) => (
    org.status === 'active' &&
    org.type !== 'anchor' &&
    (
      targets.includes(normalizeDealerRef(org.id)) ||
      targets.includes(normalizeDealerRef(org.name))
    )
  ));
  if (matched) return matched.id;

  if (options.dealerSource !== 'ys') return null;
  const name = String(options.dealerName || ref || '').trim();
  if (!name) return null;
  const created = await createDownstreamOrg({
    name,
    type: 'downstream',
    category: 'dealer',
    createdBy: auth.userId,
    tenantId: auth.tenantId,
  });
  return created.id;
}

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
