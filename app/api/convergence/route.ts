import { NextResponse, type NextRequest } from 'next/server';
import { getOrchestrator, getStore } from '@/lib/boot';

/**
 * POST /api/convergence
 * 启动新议事室 + 自动生成 3+1 选项
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, description, ownerId, relatedKr, relatedTti, materialRefs } = body ?? {};

    if (!title || !ownerId) {
      return NextResponse.json(
        { error: 'title and ownerId are required' },
        { status: 400 }
      );
    }

    const orchestrator = getOrchestrator();
    const result = await orchestrator.start({
      title,
      description: description ?? '',
      ownerId,
      relatedKr,
      relatedTti,
      materialRefs,
    });

    return NextResponse.json({
      cardId: result.cardId,
      step: result.state.step,
      elapsedSeconds: result.state.elapsedSeconds,
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
