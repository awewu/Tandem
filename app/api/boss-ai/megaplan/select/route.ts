/**
 * POST /api/boss-ai/megaplan/select · 选定四方案中的某一张
 *
 * 选定即天然的采纳/推翻信号 → 立即写 CA-13 反馈 (megaplanOutcomeFor 归因)。
 * 若选"个人补充"且填了内容 → 存为 Material 草稿候选 (走现有签批才进 Memory, 不直写)。
 *
 * Body: { decisionId?: string, schemeId: 'sop'|'best_practice'|'ai'|'personal',
 *         query?: string, personalSupplement?: string }
 * Resp: { ok: true, outcome, materialId? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { getStore } from '@/lib/storage/repository';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { megaplanOutcomeFor, type MegaplanSchemeId } from '@/lib/persona/megaplan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  decisionId?: string;
  schemeId?: MegaplanSchemeId;
  query?: string;
  personalSupplement?: string;
}

const VALID: MegaplanSchemeId[] = ['sop', 'best_practice', 'ai', 'personal'];

async function POSTApiHandler(req: NextRequest): Promise<Response> {
  const auth = requireAuth(req);
  if (!('userId' in auth)) return auth;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const schemeId = body.schemeId;
  if (!schemeId || !VALID.includes(schemeId)) {
    return NextResponse.json({ error: 'schemeId 非法' }, { status: 400 });
  }

  await boot();

  const { outcome, reason } = megaplanOutcomeFor(schemeId);

  // §CA-13: 写反馈 (选定即显式信号)
  if (body.decisionId) {
    try {
      const { setFeedback } = await import('@/lib/persona/company-brain-decision');
      await setFeedback(body.decisionId, {
        outcome,
        feedbackBy: auth.userId,
        reason,
      });
    } catch {
      /* 反馈写入失败不阻断 */
    }
  }

  // §个人补充 → 存 Material 草稿候选 (不直写 Memory)
  let materialId: string | undefined;
  const supplement = (body.personalSupplement ?? '').trim();
  if (schemeId === 'personal' && supplement) {
    try {
      const store = getStore();
      const now = new Date().toISOString();
      const title = `[四方案·个人补充] ${(body.query ?? '').slice(0, 40) || '未命名'}`;
      const material = await store.materials.create({
        type: 'project_doc' as const,
        title,
        body: { source: 'boss_ai_megaplan', query: body.query ?? '', supplement },
        originRefs: body.decisionId ? [`megaplan:${body.decisionId}`] : [],
        participants: [auth.userId],
        visibility: 'team' as const,
        createdBy: auth.userId,
        createdAt: now,
        updatedAt: now,
      });
      materialId = material.id;
    } catch {
      /* Material 存储失败不阻断反馈 */
    }
  }

  return NextResponse.json({ ok: true, outcome, materialId });
}

export const POST = withApiLog(POSTApiHandler, { route: '/api/boss-ai/megaplan/select' });
