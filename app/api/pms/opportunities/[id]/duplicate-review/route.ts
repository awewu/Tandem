/**
 * PMS API · 商机疑似重复核验结果上传
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import { submitOpportunityDuplicateReview } from '@/lib/pms/opportunity-service';

type DuplicateReviewDecision = 'duplicate' | 'not_duplicate';

function normalizeDecision(value: unknown): DuplicateReviewDecision | null {
  if (value === 'duplicate' || value === 'not_duplicate') return value;
  return null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
    const decision = normalizeDecision(body.decision);
    if (!decision) {
      return NextResponse.json(
        { error: 'decision must be duplicate | not_duplicate' },
        { status: 400 },
      );
    }

    const result = await submitOpportunityDuplicateReview({
      tenantId: auth.tenantId,
      opportunityId: id,
      reviewerId: auth.userId,
      decision,
      note: typeof body.note === 'string' ? body.note : undefined,
      visibleOrgIds: auth.isInternal ? undefined : auth.visibleOrgIds,
    });

    if (!result) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
    }

    return NextResponse.json({ result });
  } catch (error: any) {
    console.error('Submit duplicate review error:', error);
    const message = String(error?.message || '');
    return NextResponse.json(
      { error: message || 'Failed to submit duplicate review' },
      { status: message.includes('重复') ? 409 : 500 },
    );
  }
}
