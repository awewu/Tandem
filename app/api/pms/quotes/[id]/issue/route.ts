/**
 * PMS API · 报价单签发 (draft → issued, 生成验真码)
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import { issueQuote, type QuoteAuthCtx } from '@/lib/pms/quote-service';

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
    const quote = await issueQuote(id, qauth);
    return NextResponse.json({ quote });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: (e as Error).message || 'Failed' }, { status: 500 });
  }
}
