import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import { rebuildOpportunityDuplicateStateBatch } from '@/lib/pms/opportunity-service';

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
    const body = await req.json().catch(() => ({}));
    const limit = Number.isFinite(Number(body?.limit)) ? Number(body.limit) : 50;
    const offset = Number.isFinite(Number(body?.offset)) ? Number(body.offset) : 0;

    const result = await rebuildOpportunityDuplicateStateBatch({
      tenantId: auth.tenantId,
      limit,
      offset,
      visibleOrgIds: auth.isInternal ? undefined : auth.visibleOrgIds,
    });

    return NextResponse.json({ result });
  } catch (error: any) {
    console.error('Backfill duplicate opportunities error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to rebuild duplicate state' },
      { status: 500 },
    );
  }
}
