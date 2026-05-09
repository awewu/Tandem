import { NextResponse, type NextRequest } from 'next/server';
import { getOrchestrator } from '@/lib/boot';
import type { ConvergenceEvent } from '@/lib/convergence';

interface Params {
  params: { id: string };
}

/**
 * GET /api/convergence/[id]
 * 查询议事室当前状态 + 关联 DecisionCard
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const orch = getOrchestrator();
    const card = await orch.getDecisionCard(params.id);
    if (!card) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    const room = await orch.getRoomState(params.id);
    return NextResponse.json({ card, room });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? 'unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/convergence/[id]
 * 派发事件 (PICK_OPTION / COMMIT / VETO / ESCALATE / DELIBERATION_INPUT / TICK)
 *
 * Body: { event: ConvergenceEvent }
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const body = await req.json();
    const event = body?.event as ConvergenceEvent | undefined;
    if (!event || !event.type) {
      return NextResponse.json({ error: 'event is required' }, { status: 400 });
    }

    // 服务端补充时间戳 (前端可不传)
    if (!('at' in event) || !event.at) {
      (event as { at: number }).at = Date.now();
    }

    const orch = getOrchestrator();
    const result = await orch.dispatch(params.id, event);

    return NextResponse.json({
      step: result.state.step,
      elapsedSeconds: result.state.elapsedSeconds,
      events: result.events,
      escalated: result.state.escalated,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? 'unknown error' },
      { status: 500 }
    );
  }
}
