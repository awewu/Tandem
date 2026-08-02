/**
 * PMS API · 运行选型 (P3 选型配置器)
 * POST body: { inputs: Record<string, string|number|boolean> } → 推荐系统 (不落库, 供编辑器回填)
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import { runSelector } from '@/lib/pms/selector-service';
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
    const body = await req.json();
    const inputs = (body?.inputs ?? {}) as Record<string, string | number | boolean>;
    const result = await runSelector(params.id, inputs, toQuoteAuth(auth));
    return NextResponse.json({ result });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: (e as Error).message || 'Failed to run selector' }, { status: 500 });
  }
}
