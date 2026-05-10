import { NextResponse, type NextRequest } from 'next/server';
import { getOrchestrator, getStore } from '@/lib/boot';
import { validateKrBinding } from '@/lib/types/decision-card';

/**
 * POST /api/convergence
 * 启动新议事室 + 自动生成 3+1 选项
 *
 * Q2 KR 软绑定守门 (PRODUCT-DEFINITION decision #2):
 *   primaryKrId XOR noKrReason 必须非空; 理由 ≥ 10 字符.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      title,
      description,
      ownerId,
      primaryKrId,
      noKrReason,
      relatedKr,
      relatedTti,
      materialRefs,
    } = body ?? {};

    if (!title || !ownerId) {
      return NextResponse.json(
        { error: 'title 和 ownerId 不能为空', code: 'missing_required' },
        { status: 400 }
      );
    }

    // Q2 KR 软绑定守门
    const krCheck = validateKrBinding({ primaryKrId, noKrReason });
    if (!krCheck.ok) {
      return NextResponse.json(
        { error: krCheck.message, code: krCheck.code, field: 'kr_binding' },
        { status: 400 }
      );
    }

    const orchestrator = getOrchestrator();
    const result = await orchestrator.start({
      title,
      description: description ?? '',
      ownerId,
      primaryKrId,
      noKrReason,
      relatedKr,
      relatedTti,
      materialRefs,
    });

    return NextResponse.json({
      cardId: result.cardId,
      step: result.state.step,
      elapsedSeconds: result.state.elapsedSeconds,
      primaryKrId: primaryKrId ?? null,
      noKrReason: noKrReason ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? 'unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/convergence
 * 列出最近的议事室 (按 createdAt 倒序)
 */
export async function GET() {
  try {
    const store = getStore();
    const cards = await store.decisionCards.list();
    const sorted = cards
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, 50);
    return NextResponse.json({ cards: sorted });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? 'unknown error' },
      { status: 500 }
    );
  }
}
