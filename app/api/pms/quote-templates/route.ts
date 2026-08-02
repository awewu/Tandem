/**
 * PMS API · 报价方案模板 列表 + 创建
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import { listTemplates, createTemplate } from '@/lib/pms/quote-template-service';
import type { QuoteAuthCtx } from '@/lib/pms/quote-service';

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
    const templates = await listTemplates(
      {
        category: searchParams.get('category') || undefined,
        limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
      },
      toQuoteAuth(auth),
    );
    return NextResponse.json({ templates });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: (e as Error).message || 'Failed to list templates' }, { status: 500 });
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
    const template = await createTemplate(
      {
        orgId: body.orgId,
        name: body.name,
        category: body.category,
        scenario: body.scenario,
        description: body.description,
        systems: body.systems,
        terms: body.terms,
        isShared: body.isShared,
      },
      toQuoteAuth(auth),
    );
    return NextResponse.json({ template }, { status: 201 });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: (e as Error).message || 'Failed to create template' }, { status: 500 });
  }
}
