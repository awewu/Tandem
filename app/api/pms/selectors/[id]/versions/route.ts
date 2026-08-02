/**
 * PMS API · 选型规则集 已发布版本快照列表 (P3 治理 · 溯源)
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import { listRuleSetVersions } from '@/lib/pms/selector-service';
import type { QuoteAuthCtx } from '@/lib/pms/quote-service';

function toQuoteAuth(auth: PmsAuthResult): QuoteAuthCtx {
  return {
    tenantId: auth.tenantId,
    userId: auth.userId,
    visibleOrgIds: auth.visibleOrgIds,
    isInternal: auth.isInternal,
    roles: auth.roles,
  };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  let auth: PmsAuthResult;
  try {
    auth = await requirePmsAuth(req);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const versions = await listRuleSetVersions(params.id, toQuoteAuth(auth));
    return NextResponse.json({ versions });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: (e as Error).message || 'Failed to list versions' }, { status: 500 });
  }
}
