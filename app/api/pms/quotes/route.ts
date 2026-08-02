/**
 * PMS API · 报价单 列表 + 创建
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import { createQuote, listQuotes, type QuoteAuthCtx } from '@/lib/pms/quote-service';
import type { QuoteStatus } from '@/lib/types/pms';

function toQuoteAuth(auth: PmsAuthResult): QuoteAuthCtx {
  return {
    tenantId: auth.tenantId,
    userId: auth.userId,
    visibleOrgIds: auth.visibleOrgIds,
    isInternal: auth.isInternal,
  };
}

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
    const quotes = await listQuotes(
      {
        opportunityId: searchParams.get('opportunityId') || undefined,
        dealerOrgId: searchParams.get('dealerOrgId') || undefined,
        status: (searchParams.get('status') as QuoteStatus | null) || undefined,
        limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
      },
      toQuoteAuth(auth),
    );
    return NextResponse.json({ quotes });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: (e as Error).message || 'Failed to list quotes' }, { status: 500 });
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
    if (!body.opportunityId || !body.title) {
      return NextResponse.json({ error: '缺少必填字段: opportunityId, title' }, { status: 400 });
    }
    const quote = await createQuote(
      {
        opportunityId: body.opportunityId,
        title: body.title,
        customerName: body.customerName ?? '',
        customerContact: body.customerContact,
        scenario: body.scenario,
        systems: body.systems,
        terms: body.terms,
        validUntil: body.validUntil,
      },
      toQuoteAuth(auth),
    );
    return NextResponse.json({ quote }, { status: 201 });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: (e as Error).message || 'Failed to create quote' }, { status: 500 });
  }
}
