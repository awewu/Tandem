/**
 * PMS API · 报价单出新版本 (克隆为新草稿 version+1, 供改价后重新签发)
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import { reviseQuote, type QuoteAuthCtx } from '@/lib/pms/quote-service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await boot();
  let auth: PmsAuthResult;
  try {
    auth = await requirePmsAuth(req);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await params;
    const qauth: QuoteAuthCtx = {
      tenantId: auth.tenantId,
      userId: auth.userId,
      visibleOrgIds: auth.visibleOrgIds,
      isInternal: auth.isInternal,
    };
    const quote = await reviseQuote(id, qauth);
    return NextResponse.json({ quote }, { status: 201 });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: (e as Error).message || 'Failed' }, { status: 500 });
  }
}
