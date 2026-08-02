/**
 * PMS API · 经销商价值门户聚合 (§3.21)
 *
 * GET /api/pms/dealer-value[?orgId=]
 *   - 经销商: 自动锁定本人 (appealerId=userId) + 本 org (orgId=auth.orgId), 忽略传参
 *   - 内部角色: 可选 ?orgId= 预览某经销商价值 (appealerId 不限)
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import { assembleDealerValue } from '@/lib/pms/dealer-value-service';

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
    const requestedOrgId = searchParams.get('orgId') || undefined;

    let orgId: string | null;
    let appealerId: string;

    if (auth.isInternal) {
      // 内部预览: 可指定 orgId; appealerId 不锁定 (传空聚合会仅按 org)
      orgId = requestedOrgId ?? null;
      appealerId = searchParams.get('appealerId') || '';
    } else {
      // 经销商: 强制锁定本人 + 本 org (越权无效)
      if (requestedOrgId && !auth.visibleOrgIds.includes(requestedOrgId)) {
        return NextResponse.json({ error: 'forbidden: orgId out of scope' }, { status: 403 });
      }
      orgId = requestedOrgId ?? auth.orgId ?? null;
      appealerId = auth.userId;
    }

    const data = await assembleDealerValue({
      tenantId: auth.tenantId,
      orgId,
      appealerId,
    });
    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Dealer-value GET error:', error);
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}
