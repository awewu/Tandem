/**
 * GET /api/company-brain/by-message/[messageId]
 *
 * §CA-13 · 通过 IM messageId 反查 CompanyBrainDecision (仅返回轻量字段, UI 渲染反馈按钮用)
 *
 * 任何登录用户可调 — 因为 IM 群里所有人都能看到 @CompanyBrain 答复, 都能反馈.
 * 不返回 inputSummary/outputSummary 全文, 防数据泄漏给非 admin.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { getDecisionByRefId } from '@/lib/persona/company-brain-decision';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: { messageId: string } }
): Promise<NextResponse> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const decision = await getDecisionByRefId(params.messageId, 'im_message');
  if (!decision) {
    return NextResponse.json({ found: false }, { status: 404 });
  }

  // 轻量返回: 反馈按钮渲染需要 id + outcome, 不需要全文
  return NextResponse.json({
    found: true,
    decision: {
      id: decision.id,
      context: decision.context,
      outcome: decision.feedback.outcome,
      feedbackBy: decision.feedback.feedbackBy,
      feedbackAt: decision.feedback.feedbackAt,
      brainVersion: decision.brainVersion,
      createdAt: decision.createdAt,
    },
  });
}
