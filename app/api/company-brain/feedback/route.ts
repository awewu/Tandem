/**
 * POST /api/company-brain/feedback
 *
 * §CA-13 (CENTRAL-AI-ARCHITECTURE.md) · CompanyBrain Decision 闭环 · 反馈接口
 *
 * 任何登录用户都可调 (因为是看到 @CompanyBrain 答复的人才点 👍/👎/⏭).
 * 写入 audit company_brain.feedback_submitted.
 *
 * Body:
 *   {
 *     decisionId: string;
 *     outcome: 'adopted' | 'modified' | 'overruled' | 'ignored';
 *     reason?: string;
 *     correctedOutput?: string;
 *   }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { setFeedback } from '@/lib/persona/company-brain-decision';
import { deferAudit } from '@/lib/audit/defer';

export const runtime = 'nodejs';

const ALLOWED_OUTCOMES = ['adopted', 'modified', 'overruled', 'ignored'] as const;
type Outcome = (typeof ALLOWED_OUTCOMES)[number];

export async function POST(req: NextRequest): Promise<NextResponse> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  let body: {
    decisionId?: string;
    outcome?: string;
    reason?: string;
    correctedOutput?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!body.decisionId || typeof body.decisionId !== 'string') {
    return NextResponse.json({ error: 'decisionId_required' }, { status: 400 });
  }
  if (!body.outcome || !ALLOWED_OUTCOMES.includes(body.outcome as Outcome)) {
    return NextResponse.json(
      { error: 'invalid_outcome', allowed: ALLOWED_OUTCOMES },
      { status: 400 }
    );
  }

  const updated = await setFeedback(body.decisionId, {
    outcome: body.outcome as Exclude<Outcome, never>,
    feedbackBy: auth.userId,
    reason: body.reason,
    correctedOutput: body.correctedOutput,
  });

  if (!updated) {
    return NextResponse.json({ error: 'decision_not_found' }, { status: 404 });
  }

  deferAudit('company_brain.feedback_submitted', auth.userId, {
    targetId: body.decisionId,
    targetType: 'company_brain_decision',
    tenantId: auth.tenantId,
    metadata: {
      outcome: body.outcome,
      context: updated.context,
      brainVersion: updated.brainVersion,
      hasReason: !!body.reason,
      hasCorrection: !!body.correctedOutput,
    },
  });

  return NextResponse.json({ ok: true, decision: updated });
}
