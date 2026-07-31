/**
 * POST /api/memory/capture/[id] · 产出捕获候选处置
 *
 * body: { action: 'accept' | 'dismiss', title?, body?, proposedType?, level? }
 *   - accept : 走 promoteTextToMemory → 宪章 §8.1 三级签批, 候选置 accepted + 记 promotionId。
 *              可选 title/body/proposedType/level 覆盖 (本人审阅时微调)。
 *   - dismiss: 候选置 dismissed (不入库)。
 *
 * 治理: 只有候选归属本人可处置; redline/value 在 promote 时被强制升 company 级签批。
 */
import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { getStore } from '@/lib/storage/repository';
import { audit } from '@/lib/audit/log';
import type {
  CaptureLevel,
  CaptureProposedType,
  MemoryCaptureCandidate,
} from '@/lib/memory/capture-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  action?: 'accept' | 'dismiss';
  title?: string;
  body?: string;
  proposedType?: CaptureProposedType;
  level?: CaptureLevel;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = requireAuth(req);
  if (!('userId' in auth)) return auth;

  const { id } = await params;
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (body.action !== 'accept' && body.action !== 'dismiss') {
    return NextResponse.json({ error: "action 必须是 'accept' 或 'dismiss'" }, { status: 400 });
  }

  await boot();
  const store = getStore();

  const candidate = (await store.memoryCaptureCandidates.get(id)) as MemoryCaptureCandidate | null;
  if (!candidate) return NextResponse.json({ error: '候选不存在' }, { status: 404 });
  if (candidate.tenantId !== auth.tenantId || candidate.authorUserId !== auth.userId) {
    return NextResponse.json({ error: '无权处置该候选' }, { status: 403 });
  }
  if (candidate.status !== 'pending') {
    return NextResponse.json({ error: `候选已处置 (${candidate.status})` }, { status: 409 });
  }

  const now = new Date().toISOString();

  if (body.action === 'dismiss') {
    const updated = await store.memoryCaptureCandidates.update(id, {
      status: 'dismissed',
      decidedAt: now,
      decidedBy: auth.userId,
      updatedAt: now,
    });
    await audit('memory.capture_dismissed', auth.userId, {
      targetId: id,
      targetType: 'memory_capture_candidate',
      metadata: { source: candidate.source },
    });
    return NextResponse.json({ ok: true, candidate: updated });
  }

  // accept → promoteTextToMemory (三级签批)
  const title = (body.title?.trim() || candidate.title).slice(0, 120);
  const text = body.body?.trim() || candidate.body;
  const proposedType = body.proposedType ?? candidate.proposedType;
  const level = body.level ?? candidate.suggestedLevel;

  const { promoteTextToMemory } = await import('@/lib/services/text-promotion');
  const { promotionId, materialId } = await promoteTextToMemory({
    title,
    body: text,
    proposerId: auth.userId,
    proposedType,
    level,
    source: `capture:${candidate.source}`,
    originRef: candidate.originRef ?? candidate.sessionId,
  });

  const updated = await store.memoryCaptureCandidates.update(id, {
    status: 'accepted',
    promotionId,
    decidedAt: now,
    decidedBy: auth.userId,
    updatedAt: now,
  });

  await audit('memory.capture_accepted', auth.userId, {
    targetId: id,
    targetType: 'memory_capture_candidate',
    metadata: { promotionId, materialId, proposedType, level },
  });

  return NextResponse.json({ ok: true, candidate: updated, promotionId, materialId });
}
