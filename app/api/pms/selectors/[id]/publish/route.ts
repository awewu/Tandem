/**
 * PMS API · 发布选型规则集 (P3 选型配置器) — 仅内部
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import { publishRuleSet } from '@/lib/pms/selector-service';
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

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  let auth: PmsAuthResult;
  try {
    auth = await requirePmsAuth(req);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const ruleset = await publishRuleSet(params.id, toQuoteAuth(auth), body?.expectedUpdatedAt);
    return NextResponse.json({ ruleset });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: (e as Error).message || 'Failed to publish ruleset' }, { status: 500 });
  }
}
