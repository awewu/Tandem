/**
 * /api/drive/distillation/[id]
 *
 * PATCH { action: 'promote' | 'dismiss', title?, type?, body?, level? }
 *   - promote: 真人成为 proposer → proposePromotion (走三级签批), 候选置 promoted。
 *   - dismiss: 候选置 dismissed。
 *
 * 宪章 Rule A: proposer 恒为真人 (auth.userId), 中央 AI 只产候选草稿。
 */
import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import { boot } from '@/lib/boot';
import { getStore } from '@/lib/storage/repository';
import { proposePromotion } from '@/lib/memory/promotion-flow';
import type { PromotionLevel } from '@/lib/types/memory';
import { withApiLog } from '@/lib/api-log/with-api-log';

const PATCHApiHandler = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    await boot();
    const auth = requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const body = (await req.json().catch(() => ({}))) as {
      action?: 'promote' | 'dismiss';
      title?: string;
      type?: 'sop' | 'case' | 'redline' | 'value' | 'lesson';
      body?: string;
      level?: PromotionLevel;
    };
    const store = getStore();
    const candidate = await store.driveDistillationCandidates.get(params.id);
    if (!candidate || candidate.tenantId !== auth.tenantId) {
      return NextResponse.json({ error: '候选不存在' }, { status: 404 });
    }
    if (candidate.status === 'promoted') {
      return NextResponse.json({ error: '该候选已提议入库' }, { status: 409 });
    }

    if (body.action === 'dismiss') {
      const updated = await store.driveDistillationCandidates.update(params.id, {
        status: 'dismissed',
        reviewedBy: auth.userId,
        updatedAt: new Date().toISOString(),
      });
      return NextResponse.json({ candidate: updated });
    }

    if (body.action === 'promote') {
      const promotion = await proposePromotion({
        materialId: candidate.sourceFileId,
        proposedType: body.type ?? candidate.suggestedType,
        proposedTitle: (body.title ?? candidate.suggestedTitle).trim(),
        proposedBody: (body.body ?? candidate.suggestedBody).trim(),
        proposerId: auth.userId, // 真人 proposer (Rule A)
        level: body.level,
      });
      const updated = await store.driveDistillationCandidates.update(params.id, {
        status: 'promoted',
        promotionId: promotion.id,
        reviewedBy: auth.userId,
        updatedAt: new Date().toISOString(),
      });
      return NextResponse.json({ candidate: updated, promotion });
    }

    return NextResponse.json({ error: 'action must be promote | dismiss' }, { status: 400 });
  },
);

export const PATCH = withApiLog(PATCHApiHandler, { route: '/api/drive/distillation/[id]' });
