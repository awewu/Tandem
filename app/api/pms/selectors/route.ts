/**
 * PMS API · 选型规则集 列表 + 创建 (P3 选型配置器)
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import { listRuleSets, createRuleSet, canManageSelectors } from '@/lib/pms/selector-service';
import type { QuoteAuthCtx } from '@/lib/pms/quote-service';
import type { SelectorRuleSetStatus } from '@/lib/types/pms';

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

export async function GET(req: NextRequest) {
  await boot();
  const auth = await authOrResponse(req);
  if (auth instanceof Response) return auth;
  try {
    const { searchParams } = new URL(req.url);
    const rulesets = await listRuleSets(
      {
        category: searchParams.get('category') || undefined,
        status: (searchParams.get('status') as SelectorRuleSetStatus | null) || undefined,
        limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
      },
      toQuoteAuth(auth),
    );
    return NextResponse.json({ rulesets, canManage: canManageSelectors(toQuoteAuth(auth)) });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: (e as Error).message || 'Failed to list rulesets' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  await boot();
  const auth = await authOrResponse(req);
  if (auth instanceof Response) return auth;
  try {
    const body = await req.json();
    const ruleset = await createRuleSet(
      {
        name: body.name,
        category: body.category,
        scenario: body.scenario,
        description: body.description,
        systemName: body.systemName,
        inputFields: body.inputFields,
        rules: body.rules,
      },
      toQuoteAuth(auth),
    );
    return NextResponse.json({ ruleset }, { status: 201 });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: (e as Error).message || 'Failed to create ruleset' }, { status: 500 });
  }
}
