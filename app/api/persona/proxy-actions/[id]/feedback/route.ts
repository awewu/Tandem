/**
 * POST /api/persona/proxy-actions/[id]/feedback
 * 对代行行为进行 👍/👎 评价 (闭环④)
 *
 * Body: { kind: 'thumbs_up' | 'thumbs_down', reason?: string }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { boot, getStore } from '@/lib/boot';
import { createFeedback, recalcBossCaptureScore } from '@/lib/persona/feedback';
import { audit } from '@/lib/audit/log';

interface Params {
  params: { id: string };
}

export async function POST(req: NextRequest, { params }: Params) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { kind, reason } = body;

    if (!kind || (kind !== 'thumbs_up' && kind !== 'thumbs_down')) {
      return NextResponse.json(
        { error: 'kind must be thumbs_up or thumbs_down' },
        { status: 400 }
      );
    }

    const store = getStore();

    // 获取 proxyAction
    const proxyAction = await store.proxyActions.get(params.id);
    if (!proxyAction) {
      return NextResponse.json({ error: 'proxy action not found' }, { status: 404 });
    }

    // 只能反馈自己的代行
    if (proxyAction.userId !== auth.userId) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    // 创建反馈记录
    const feedback = await createFeedback({
      proxyActionId: params.id,
      userId: auth.userId,
      personaId: proxyAction.personaId,
      tenantId: auth.tenantId ?? 'default',
      kind,
      reason,
    });

    // 重新计算 bossCaptureScore
    const personas = await store.personas.list({ userId: auth.userId } as never);
    const persona = personas[0];
    let newScore: number | undefined;
    if (persona) {
      newScore = await recalcBossCaptureScore(persona);
    }

    // 审计日志
    await audit('persona_feedback_submitted', auth.userId, {
      targetId: params.id,
      tenantId: auth.tenantId ?? 'default',
      metadata: {
        feedbackId: feedback.id,
        kind,
        newBossCaptureScore: newScore,
      },
    });

    return NextResponse.json({
      feedback,
      bossCaptureScore: newScore,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? 'unknown error' },
      { status: 500 }
    );
  }
}
