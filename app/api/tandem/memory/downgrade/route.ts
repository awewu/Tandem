/**
 * /api/tandem/memory/downgrade
 *
 * Memory 降级评估 (宪章 §8.2: Memory → Material/归档).
 *
 * GET    : 列出 downgrade requests
 * POST   : 提议降级 (proposeDowngrade)
 *   body: { memoryId, proposedBy, reason, metrics? }
 * PATCH  : Steward 决议
 *   body: { downgradeId, stewardId, decision: 'kept'|'revising'|'archived'|'historical_only', note? }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { getStore } from '@/lib/storage/repository';
import {
  proposeDowngrade,
  decideDowngrade,
  type DowngradeDecision,
} from '@/lib/memory/downgrade-flow';

export async function GET(req: NextRequest) {
  await boot();
  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const memoryId = url.searchParams.get('memoryId');

  const store = getStore();
  let downgrades = await store.downgrades.list();
  if (status) downgrades = downgrades.filter((d) => d.status === status);
  if (memoryId) downgrades = downgrades.filter((d) => d.memoryId === memoryId);

  return NextResponse.json({ downgrades });
}

export async function POST(req: NextRequest) {
  await boot();
  try {
    const body = await req.json();
    if (!body.memoryId || !body.proposedBy || !body.reason) {
      return NextResponse.json(
        { error: '缺必要字段: memoryId, proposedBy, reason' },
        { status: 400 }
      );
    }
    const downgrade = await proposeDowngrade({
      memoryId: body.memoryId,
      proposedBy: body.proposedBy,
      reason: body.reason,
      metrics: body.metrics,
    });
    return NextResponse.json({ downgrade }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  await boot();
  try {
    const body = await req.json();
    const { downgradeId, stewardId, decision, note } = body;
    if (!downgradeId || !stewardId || !decision) {
      return NextResponse.json(
        { error: '缺必要字段: downgradeId, stewardId, decision' },
        { status: 400 }
      );
    }
    const allowed: DowngradeDecision[] = ['kept', 'revising', 'archived', 'historical_only'];
    if (!allowed.includes(decision)) {
      return NextResponse.json(
        { error: `decision 必须为  ${allowed.join('|')}` },
        { status: 400 }
      );
    }
    const updated = await decideDowngrade(downgradeId, stewardId, decision, note);
    return NextResponse.json({ downgrade: updated });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
