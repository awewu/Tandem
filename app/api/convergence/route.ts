import { NextResponse, type NextRequest } from 'next/server';
import { getOrchestrator, getStore } from '@/lib/boot';
import { validateKrBinding } from '@/lib/types/decision-card';
import { requireAuth } from '@/lib/auth/require-auth';
import { applyTemplate, type TemplateId } from '@/lib/skills/decision-card-templates';

/**
 * POST /api/convergence
 * 启动新议事室 + 自动生成 3+1 选项
 *
 * Q2 KR 软绑定守门 (PRODUCT-DEFINITION decision #2):
 *   primaryKrId XOR noKrReason 必须非空; 理由 ≥ 10 字符.
 */
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json();

    // S2 · Skill template 预填 (?template=role-transfer 等)
    let template: ReturnType<typeof applyTemplate> = null;
    if (body?.template) {
      template = applyTemplate(body.template as TemplateId, body.templateContext ?? {});
    }

    const {
      title = template?.title,
      description = template?.description,
      primaryKrId,
      noKrReason = template?.noKrReason,
      relatedKr,
      relatedTti,
      materialRefs,
    } = body ?? {};

    if (!title) {
      return NextResponse.json(
        { error: 'title 不能为空', code: 'missing_required' },
        { status: 400 }
      );
    }

    // Q2 KR 软绑定守门
    const krCheck = validateKrBinding({ primaryKrId, noKrReason });
    if (!krCheck.ok) {
      return NextResponse.json(
        { error: krCheck.message, code: krCheck.code, field: 'kr_binding' },
        { status: 400 }
      );
    }

    const orchestrator = getOrchestrator();
    const result = await orchestrator.start({
      title,
      description: description ?? '',
      ownerId: auth.userId,
      tenantId: auth.tenantId,
      primaryKrId,
      noKrReason,
      relatedKr,
      relatedTti,
      materialRefs,
    });

    return NextResponse.json({
      cardId: result.cardId,
      step: result.state.step,
      elapsedSeconds: result.state.elapsedSeconds,
      primaryKrId: primaryKrId ?? null,
      noKrReason: noKrReason ?? null,
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
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const store = getStore();
    const cards = await store.decisionCards.list();
    // Tenant isolation: only return cards belonging to caller's tenant.
    const scoped = cards.filter((c) => (c.tenantId ?? 'default') === auth.tenantId);
    const sorted = scoped
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
