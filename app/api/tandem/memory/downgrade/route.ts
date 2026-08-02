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
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { MEMORY_GOVERNANCE_ROLES } from '@/lib/auth/roles';
import {
  proposeDowngrade,
  decideDowngrade,
  type DowngradeDecision,
} from '@/lib/memory/downgrade-flow';
import { withApiLog } from '@/lib/api-log/with-api-log';

async function GETApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const denied = requireRole(auth, MEMORY_GOVERNANCE_ROLES);
  if (denied) return denied;

  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const memoryId = url.searchParams.get('memoryId');

  const store = getStore();
  let downgrades = await store.downgrades.list();
  if (status) downgrades = downgrades.filter((d) => d.status === status);
  if (memoryId) downgrades = downgrades.filter((d) => d.memoryId === memoryId);

  return NextResponse.json({ downgrades });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/tandem/memory/downgrade' });

async function POSTApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const denied = requireRole(auth, MEMORY_GOVERNANCE_ROLES);
  if (denied) return denied;
  try {
    const body = await req.json();
    if (!body.memoryId || !body.reason) {
      return NextResponse.json(
        { error: '缺必要字段: memoryId, reason' },
        { status: 400 }
      );
    }
    const downgrade = await proposeDowngrade({
      memoryId: body.memoryId,
      // 身份绑定: 人工提议恒记为登录用户 (AI 触发走 downgrade-flow 内部, 不经此端口).
      proposedBy: auth.userId,
      reason: body.reason,
      metrics: body.metrics,
    });
    return NextResponse.json({ downgrade }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const POST = withApiLog(POSTApiHandler, { route: '/api/tandem/memory/downgrade' });

async function PATCHApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const denied = requireRole(auth, MEMORY_GOVERNANCE_ROLES);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { downgradeId, decision, note } = body;
    if (!downgradeId || !decision) {
      return NextResponse.json(
        { error: '缺必要字段: downgradeId, decision' },
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
    // 身份绑定: 决议人恒为登录用户; decideDowngrade 内再校验其为在册 Steward.
    const updated = await decideDowngrade(downgradeId, auth.userId, decision, note);
    return NextResponse.json({ downgrade: updated });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export const PATCH = withApiLog(PATCHApiHandler, { route: '/api/tandem/memory/downgrade' });
