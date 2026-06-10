/**
 * POST /api/documents/[id]/review
 *
 * DOC-3 (charter §四 文档板块, 2026-06-09): 中央 AI 评审文档.
 *
 * Returns 200:
 *   DocumentReview JSON (lib/persona/document-review.ts)
 *
 * 治理:
 *   - requireAuth (登录用户)
 *   - 文档不存在 → 404
 *   - LLM 评审是 advisory: 不改文档, 不自动 promote, 不自动 spawn 议事 (宪法 A)
 *   - LLM 真跑过才 recordDecision(context='document_review') 进 CA-13 飞轮
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { getStore } from '@/lib/storage/repository';
import { reviewDocument } from '@/lib/persona/document-review';

interface Params {
  params: { id: string };
}

export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  await boot();

  const store = getStore();
  const doc = await store.documents.get(params.id);
  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  const review = await reviewDocument({
    documentId: params.id,
    requesterId: auth.userId,
    tenantId: auth.tenantId,
  });

  if (!review) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  return NextResponse.json(review);
}
