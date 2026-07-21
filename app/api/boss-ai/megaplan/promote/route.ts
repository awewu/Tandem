/**
 * POST /api/boss-ai/megaplan/promote · 个人补充「申请进公司知识库」(方案 C)
 *
 * 四方案的个人补充默认只存 Material 草稿 (见 megaplan/select)。员工若认为这条判断值得
 * 沉淀为公司知识, 主动点「申请进公司知识库」→ 本端点发起 team 级签批 (proposePromotion),
 * 走宪章 §8.1 三级签批流, 签批通过才物化进 Memory。不自动发起 → 不淹审批队列。
 *
 * Body: { materialId?: string, query?: string, supplement: string }
 * Resp: { ok: true, promotionId, level } | { error }
 */
import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { withApiLog } from '@/lib/api-log/with-api-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  materialId?: string;
  query?: string;
  supplement?: string;
}

async function POSTApiHandler(req: NextRequest): Promise<Response> {
  const auth = requireAuth(req);
  if (!('userId' in auth)) return auth;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const supplement = (body.supplement ?? '').trim();
  if (!supplement) {
    return NextResponse.json({ error: '个人补充内容为空, 无法申请入库' }, { status: 400 });
  }

  await boot();

  const title = `[四方案·个人补充] ${(body.query ?? '').slice(0, 40) || '未命名'}`;

  try {
    // 已有 Material (select 时已落) → 直接对其发起签批; 否则新建 Material + 签批 (兜底)
    if (body.materialId) {
      const { proposePromotion } = await import('@/lib/memory/promotion-flow');
      const promotion = await proposePromotion({
        materialId: body.materialId,
        proposedType: 'lesson',
        proposedTitle: title,
        proposedBody: supplement,
        proposerId: auth.userId,
        level: 'team',
      });
      return NextResponse.json({ ok: true, promotionId: promotion.id, level: promotion.level ?? 'team' });
    }

    const { promoteTextToMemory } = await import('@/lib/services/text-promotion');
    const res = await promoteTextToMemory({
      title,
      body: supplement,
      proposerId: auth.userId,
      proposedType: 'lesson',
      level: 'team',
      source: 'boss_ai_megaplan',
    });
    return NextResponse.json({ ok: true, promotionId: res.promotionId, level: 'team' });
  } catch (err) {
    return NextResponse.json({ error: `申请入库失败: ${(err as Error).message}` }, { status: 500 });
  }
}

export const POST = withApiLog(POSTApiHandler, { route: '/api/boss-ai/megaplan/promote' });
