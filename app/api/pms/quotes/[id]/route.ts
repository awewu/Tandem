/**
 * PMS API · 报价单 详情 / 编辑草稿 / 作废
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import { getQuote, updateQuoteDraft, revokeQuote, type QuoteAuthCtx } from '@/lib/pms/quote-service';

function toQuoteAuth(auth: PmsAuthResult): QuoteAuthCtx {
  return {
    tenantId: auth.tenantId,
    userId: auth.userId,
    visibleOrgIds: auth.visibleOrgIds,
    isInternal: auth.isInternal,
  };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const quote = await getQuote(id, toQuoteAuth(auth));
    if (!quote) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json({ quote });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: (e as Error).message || 'Failed' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const body = await req.json();
    const quote = await updateQuoteDraft(
      id,
      {
        title: body.title,
        customerName: body.customerName,
        customerContact: body.customerContact,
        scenario: body.scenario,
        systems: body.systems,
        terms: body.terms,
        validUntil: body.validUntil,
      },
      toQuoteAuth(auth),
    );
    return NextResponse.json({ quote });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: (e as Error).message || 'Failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const quote = await revokeQuote(id, toQuoteAuth(auth));
    return NextResponse.json({ quote });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: (e as Error).message || 'Failed' }, { status: 500 });
  }
}
