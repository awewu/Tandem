/**
 * PMS API · 渠道返利 (政策 + 计提结算)
 *
 * GET  ?type=policies                列出返利政策
 * GET  ?type=accruals&dealerOrgId=   列出计提 (经销商仅见本 org)
 * POST { action:'create_policy' }    创建阶梯返利政策 (仅内部)
 * POST { action:'compute_accrual' }  按政策计算并计提返利 (仅内部)
 * POST { action:'settle' }           结算计提 (仅内部)
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import {
  createRebatePolicy,
  listRebatePolicies,
  getRebatePolicy,
  createRebateAccrual,
  listRebateAccruals,
  settleRebateAccrual,
  computeRebate,
} from '@/lib/pms/rebate-service';

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
    const type = searchParams.get('type') || 'policies';

    if (type === 'accruals') {
      const dealerOrgId = searchParams.get('dealerOrgId') || undefined;
      // 隔离: 非内部仅见本 org 计提
      if (!auth.isInternal) {
        if (!dealerOrgId || !auth.visibleOrgIds.includes(dealerOrgId)) {
          return NextResponse.json({ error: 'forbidden: dealerOrgId out of scope' }, { status: 403 });
        }
      }
      const accruals = await listRebateAccruals(auth.tenantId, {
        dealerOrgId,
        period: searchParams.get('period') || undefined,
        status: searchParams.get('status') || undefined,
      });
      return NextResponse.json({ accruals });
    }

    // policies (费率卡, 所有认证用户可查)
    const policies = await listRebatePolicies(auth.tenantId, searchParams.get('status') || undefined);
    return NextResponse.json({ policies });
  } catch (error: any) {
    console.error('List rebates error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list rebates' },
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
    const action = body.action as string;

    // 返利写操作全部仅内部 (渠道财务)
    if (!auth.isInternal) {
      return NextResponse.json({ error: 'forbidden: rebate write requires internal role' }, { status: 403 });
    }

    if (action === 'create_policy') {
      if (!body.name || !Array.isArray(body.tiers) || !body.effectiveDate) {
        return NextResponse.json({ error: 'Missing required fields: name, tiers[], effectiveDate' }, { status: 400 });
      }
      const policy = await createRebatePolicy(auth.tenantId, { ...body, createdBy: auth.userId });
      return NextResponse.json({ policy }, { status: 201 });
    }

    if (action === 'compute_accrual') {
      if (!body.dealerOrgId || !body.policyId || !body.period || body.salesAmount == null) {
        return NextResponse.json(
          { error: 'Missing required fields: dealerOrgId, policyId, period, salesAmount' },
          { status: 400 }
        );
      }
      const policy = await getRebatePolicy(body.policyId, auth.tenantId);
      if (!policy) {
        return NextResponse.json({ error: 'rebate policy not found' }, { status: 404 });
      }
      const { rebateRate, rebateAmount } = computeRebate(Number(body.salesAmount), policy.tiers as any[]);
      const accrual = await createRebateAccrual(auth.tenantId, {
        dealerOrgId: body.dealerOrgId,
        policyId: body.policyId,
        period: body.period,
        salesAmount: Number(body.salesAmount),
        rebateAmount,
        status: 'pending',
      });
      return NextResponse.json({ accrual, rebateRate, rebateAmount }, { status: 201 });
    }

    if (action === 'settle') {
      if (!body.accrualId) {
        return NextResponse.json({ error: 'Missing accrualId' }, { status: 400 });
      }
      const result = await settleRebateAccrual({
        tenantId: auth.tenantId,
        accrualId: body.accrualId,
        settledBy: auth.userId,
      });
      return NextResponse.json({ result });
    }

    return NextResponse.json({ error: 'Unknown action; expected create_policy | compute_accrual | settle' }, { status: 400 });
  } catch (error: any) {
    console.error('Rebate action error:', error);
    if (/not found|already settled/.test(error?.message || '')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: error.message || 'Failed to process rebate' },
      { status: 500 }
    );
  }
}
