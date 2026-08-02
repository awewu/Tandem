/**
 * PMS API · 选型规则集 详情 / 更新 / 软删 (P3 选型配置器)
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import { getRuleSet, updateRuleSet, deleteRuleSet } from '@/lib/pms/selector-service';
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

async function authOrResponse(req: NextRequest): Promise<PmsAuthResult | Response> {
  try {
    return await requirePmsAuth(req);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = await authOrResponse(req);
  if (auth instanceof Response) return auth;
  try {
    const ruleset = await getRuleSet(params.id, toQuoteAuth(auth));
    if (!ruleset) return NextResponse.json({ error: '规则集不存在或无权限' }, { status: 404 });
    return NextResponse.json({ ruleset });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: (e as Error).message || 'Failed to get ruleset' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = await authOrResponse(req);
  if (auth instanceof Response) return auth;
  try {
    const body = await req.json();
    const ruleset = await updateRuleSet(params.id, body, toQuoteAuth(auth));
    return NextResponse.json({ ruleset });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: (e as Error).message || 'Failed to update ruleset' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = await authOrResponse(req);
  if (auth instanceof Response) return auth;
  try {
    await deleteRuleSet(params.id, toQuoteAuth(auth));
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: (e as Error).message || 'Failed to delete ruleset' }, { status: 500 });
  }
}
