/**
 * PMS API · 合同管理 (L2C 下段)
 *
 * GET  ?opportunityId=&status=   列表 (经销商须带 opportunityId 且归属校验)
 * POST { action:'create' }       创建合同草稿 (校验商机归属)
 * POST { action:'approve' }      审批生效 → 自动创建交付工单 (仅内部)
 * POST { action:'reject' }       驳回 (仅内部)
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import { getOpportunity } from '@/lib/pms/opportunity-service';
import {
  createContract,
  listContracts,
  approveContract,
  rejectContract,
} from '@/lib/pms/contract-service';

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
    const opportunityId = searchParams.get('opportunityId') || undefined;
    const visibleOrgIds = auth.isInternal ? undefined : auth.visibleOrgIds;

    // 隔离: 非内部须指定 opportunityId 且校验归属 (合同表无 orgId, 经商机隔离)
    if (!auth.isInternal) {
      if (!opportunityId) {
        return NextResponse.json({ error: 'opportunityId is required for external users' }, { status: 400 });
      }
      const opp = await getOpportunity(opportunityId, auth.tenantId, visibleOrgIds);
      if (!opp) {
        return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
      }
    }

    const contracts = await listContracts({
      tenantId: auth.tenantId,
      status: searchParams.get('status') || undefined,
      opportunityId,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    });
    return NextResponse.json({ contracts });
  } catch (error: any) {
    console.error('List contracts error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list contracts' },
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

    // --- 审批 / 驳回 (仅内部) ---
    if (action === 'approve' || action === 'reject') {
      if (!auth.isInternal) {
        return NextResponse.json({ error: 'forbidden: contract approval requires internal role' }, { status: 403 });
      }
      if (!body.contractId) {
        return NextResponse.json({ error: 'Missing contractId' }, { status: 400 });
      }
      const result =
        action === 'approve'
          ? await approveContract({ tenantId: auth.tenantId, contractId: body.contractId, approverId: auth.userId })
          : await rejectContract({ tenantId: auth.tenantId, contractId: body.contractId, approverId: auth.userId });
      return NextResponse.json({ result });
    }

    // --- 创建合同草稿 ---
    if (action === 'create') {
      if (!body.opportunityId || !body.customerName || body.totalAmount == null) {
        return NextResponse.json(
          { error: 'Missing required fields: opportunityId, customerName, totalAmount' },
          { status: 400 }
        );
      }
      // 归属校验: 经销商只能给自己可见的商机建合同
      const visibleOrgIds = auth.isInternal ? undefined : auth.visibleOrgIds;
      const opp = await getOpportunity(body.opportunityId, auth.tenantId, visibleOrgIds);
      if (!opp) {
        return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
      }
      const contract = await createContract({
        tenantId: auth.tenantId,
        opportunityId: body.opportunityId,
        customerName: body.customerName,
        totalAmount: Number(body.totalAmount),
        signedBy: body.signedBy ?? auth.userId,
        signedDate: body.signedDate,
        effectiveDate: body.effectiveDate,
        expiryDate: body.expiryDate,
      });
      return NextResponse.json({ contract }, { status: 201 });
    }

    return NextResponse.json({ error: 'Unknown action; expected create | approve | reject' }, { status: 400 });
  } catch (error: any) {
    console.error('Contract action error:', error);
    if (/not found|not approvable|conflict/.test(error?.message || '')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: error.message || 'Failed to process contract' },
      { status: 500 }
    );
  }
}
