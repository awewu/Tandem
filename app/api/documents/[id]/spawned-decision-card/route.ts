/**
 * PATCH /api/documents/[id]/spawned-decision-card
 *
 * DOC-4 闭环 (charter §四 飞书做不到 #2): convergence 创建成功后回写
 * document.spawnedDecisionCardId, 防止同一文档重复发起议事.
 *
 * 与 DOC-2 promote-to-memory 的对称设计: 议事 (decision card) 也是文档的"派生"
 * 之一, 反向链接让文档详情页显示 chip + 重复点击直接跳到现有议事.
 *
 * Body:
 *   { decisionCardId: string }
 *
 * Returns 200:
 *   { documentId, decisionCardId }
 *
 * 错误码:
 *   400  decisionCardId 缺失 / 文档已派生过
 *   404  文档不存在
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { audit } from '@/lib/audit/log';
import { getStore } from '@/lib/storage/repository';

interface Params {
  params: { id: string };
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  await boot();

  let body: { decisionCardId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!body.decisionCardId || typeof body.decisionCardId !== 'string' || body.decisionCardId.trim().length === 0) {
    return NextResponse.json({ error: 'decisionCardId required' }, { status: 400 });
  }

  const store = getStore();
  const doc = await store.documents.get(params.id);
  if (!doc) {
    return NextResponse.json({ error: 'document not found' }, { status: 404 });
  }

  if (doc.spawnedDecisionCardId && doc.spawnedDecisionCardId !== body.decisionCardId) {
    return NextResponse.json(
      {
        error: `document already spawned a different decision card (${doc.spawnedDecisionCardId})`,
      },
      { status: 409 },
    );
  }

  // 幂等: 同一 cardId 重复 PATCH 直接 200
  if (doc.spawnedDecisionCardId === body.decisionCardId) {
    return NextResponse.json(
      { documentId: doc.id, decisionCardId: body.decisionCardId, alreadyLinked: true },
      { status: 200 },
    );
  }

  await store.documents.update(doc.id, {
    spawnedDecisionCardId: body.decisionCardId,
  } as Partial<typeof doc>);

  await audit('decision_card.create', auth.userId, {
    targetId: body.decisionCardId,
    targetType: 'decision_card',
    metadata: {
      source: 'document',
      documentId: doc.id,
      documentTitle: doc.title,
    },
  });

  return NextResponse.json(
    { documentId: doc.id, decisionCardId: body.decisionCardId, alreadyLinked: false },
    { status: 200 },
  );
}
