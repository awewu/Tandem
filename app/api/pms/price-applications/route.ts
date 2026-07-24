/**
 * PMS API · 价格申请 + 分级审批 (L2C 中段)
 *
 * GET  ?status=&opportunityId=   列表 (经销商仅见本人申请)
 * POST { action:'create' }       提交价格申请 (校验商机归属)
 * POST { action:'decide' }       审批 (仅内部, 按角色级别门槛)
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import { getOpportunity } from '@/lib/pms/opportunity-service';
import {
  createPriceApplication,
  listPriceApplications,
  decidePriceApplication,
  approverLevelForRoles,
} from '@/lib/pms/price-application-service';

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
    const applications = await listPriceApplications({
      tenantId: auth.tenantId,
      status: searchParams.get('status') || undefined,
      opportunityId: searchParams.get('opportunityId') || undefined,
      // 隔离: 非内部仅见本人提交的申请
      applicantId: auth.isInternal ? (searchParams.get('applicantId') || undefined) : auth.userId,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    });
    return NextResponse.json({ applications });
  } catch (error: any) {
    console.error('List price applications error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list price applications' },
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
    const action = (body.action as string) || 'create';

    // --- 审批 (仅内部) ---
    if (action === 'decide') {
      if (!auth.isInternal) {
        return NextResponse.json({ error: 'forbidden: approval requires internal role' }, { status: 403 });
      }
      if (!body.applicationId || !body.decision) {
        return NextResponse.json({ error: 'Missing applicationId or decision' }, { status: 400 });
      }
      if (body.decision !== 'approved' && body.decision !== 'rejected') {
        return NextResponse.json({ error: 'invalid decision; expected approved | rejected' }, { status: 400 });
      }
      const approverLevel = approverLevelForRoles(auth.roles);
      if (approverLevel === 0) {
        return NextResponse.json({ error: 'forbidden: no approval authority' }, { status: 403 });
      }
      const result = await decidePriceApplication({
        tenantId: auth.tenantId,
        applicationId: body.applicationId,
        approverId: auth.userId,
        approverLevel,
        decision: body.decision,
        approvedPrice: typeof body.approvedPrice === 'number' ? body.approvedPrice : undefined,
        comment: body.comment,
      });
      return NextResponse.json({ result });
    }

    // --- 提交申请 ---
    if (action === 'create') {
      if (!body.opportunityId || !body.productId || body.listPrice == null || body.requestedPrice == null || !body.reason) {
        return NextResponse.json(
          { error: 'Missing required fields: opportunityId, productId, listPrice, requestedPrice, reason' },
          { status: 400 }
        );
      }
      // 归属校验: 经销商只能给自己可见的商机申请价格
      const visibleOrgIds = auth.isInternal ? undefined : auth.visibleOrgIds;
      const opp = await getOpportunity(body.opportunityId, auth.tenantId, visibleOrgIds);
      if (!opp) {
        return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
      }
      const application = await createPriceApplication({
        tenantId: auth.tenantId,
        opportunityId: body.opportunityId,
        applicantId: auth.userId,
        productId: body.productId,
        listPrice: Number(body.listPrice),
        requestedPrice: Number(body.requestedPrice),
        reason: body.reason,
      });
      return NextResponse.json({ application }, { status: 201 });
    }

    return NextResponse.json({ error: 'Unknown action; expected create | decide' }, { status: 400 });
  } catch (error: any) {
    console.error('Price application action error:', error);
    if (/not found|already decided|insufficient approval/.test(error?.message || '')) {
      const status = /insufficient approval/.test(error.message) ? 403 : 409;
      return NextResponse.json({ error: error.message }, { status });
    }
    return NextResponse.json(
      { error: error.message || 'Failed to process price application' },
      { status: 500 }
    );
  }
}
