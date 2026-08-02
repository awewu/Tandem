/**
 * PMS API · 报价方案模板 详情 / 更新 / 软删
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import { getTemplate, updateTemplate, deleteTemplate } from '@/lib/pms/quote-template-service';
import type { QuoteAuthCtx } from '@/lib/pms/quote-service';

function toQuoteAuth(auth: PmsAuthResult): QuoteAuthCtx {
  return {
    tenantId: auth.tenantId,
    userId: auth.userId,
    visibleOrgIds: auth.visibleOrgIds,
    isInternal: auth.isInternal,
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
    const template = await getTemplate(params.id, toQuoteAuth(auth));
    if (!template) return NextResponse.json({ error: '模板不存在或无权限' }, { status: 404 });
    return NextResponse.json({ template });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: (e as Error).message || 'Failed to get template' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = await authOrResponse(req);
  if (auth instanceof Response) return auth;
  try {
    const body = await req.json();
    const template = await updateTemplate(params.id, body, toQuoteAuth(auth));
    return NextResponse.json({ template });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: (e as Error).message || 'Failed to update template' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = await authOrResponse(req);
  if (auth instanceof Response) return auth;
  try {
    await deleteTemplate(params.id, toQuoteAuth(auth));
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: (e as Error).message || 'Failed to delete template' }, { status: 500 });
  }
}
