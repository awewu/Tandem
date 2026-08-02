/**
 * PMS API · 跟进记录 AI 提取 (对标 拜访记录自动提取回填)
 *
 * POST /api/pms/follow-ups/extract
 *   body: { rawText: string, opportunityId?: string }
 *   → { draft: FollowUpDraft }  (只提取, 不落库; 人确认后走 POST /api/pms/follow-ups 保存)
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import { extractFollowUpDraft } from '@/lib/pms/follow-up-ai';
import { getOpportunity } from '@/lib/pms/opportunity-service';

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
    const rawText = typeof body.rawText === 'string' ? body.rawText : '';
    if (!rawText.trim()) {
      return NextResponse.json({ error: 'rawText is required' }, { status: 400 });
    }

    // 可选 opportunityId: 校验归属 (防越权) + 取客户名增强接地
    let opportunityName: string | undefined;
    if (body.opportunityId) {
      const visibleOrgIds = auth.isInternal ? undefined : auth.visibleOrgIds;
      const parent = await getOpportunity(String(body.opportunityId), auth.tenantId, visibleOrgIds);
      if (!parent) {
        return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
      }
      opportunityName = parent.customerName || parent.projectName || undefined;
    }

    const draft = await extractFollowUpDraft(rawText, {
      tenantId: auth.tenantId,
      opportunityName,
    });
    return NextResponse.json({ draft });
  } catch (error: unknown) {
    console.error('Extract follow-up error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to extract follow-up' },
      { status: 500 },
    );
  }
}
