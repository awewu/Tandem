/**
 * POST /api/boss-ai/megaplan · 四方案输出 (SOP / 最佳实践 / AI推荐 / 个人补充)
 *
 * 用户在 BossAI 抽屉主动开启"四方案"模式时调用。并行产出 4 张对照卡, 记一条
 * pending CompanyBrainDecision (context=boss_ai_megaplan); 用户选定后由
 * /api/boss-ai/megaplan/select 写反馈 (CA-13 归因)。
 *
 * Body: { query: string, currentPath?: string }
 * Resp: { schemes: MegaplanScheme[], decisionId?: string } | { hardRefused, message }
 */
import { NextRequest, NextResponse } from 'next/server';
import { boot, getRouter } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { rateLimit, POLICIES } from '@/lib/infra/rate-limit';
import { deferAudit } from '@/lib/audit/defer';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { generateMegaplanSchemes } from '@/lib/persona/megaplan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  query?: string;
  currentPath?: string;
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
  const query = (body.query ?? '').trim();
  if (!query) return NextResponse.json({ error: 'query 不能为空' }, { status: 400 });

  // 限流: 四方案 3x LLM, 与 BossAI 共用预算池
  const minute = await rateLimit({ key: `boss_ai:min:${auth.userId}`, ...POLICIES.bossAi() });
  if (!minute.allowed) {
    return NextResponse.json({ error: '请慢一点, 稍后再试' }, { status: 429 });
  }
  const day = await rateLimit({ key: `boss_ai:day:${auth.userId}`, ...POLICIES.bossAiDaily() });
  if (!day.allowed) {
    return NextResponse.json({ error: '今日额度已用完' }, { status: 429 });
  }

  await boot();

  // §红线硬拒: 命中直接转人工, 不产四方案
  try {
    const { matchHardRefuseLive } = await import('@/lib/governance/hard-refuse-service');
    const rf = await matchHardRefuseLive(query, auth.tenantId);
    if (rf.hit) {
      deferAudit('boss_ai.hard_refused', auth.userId, {
        targetType: 'boss_ai_megaplan',
        metadata: { topicId: rf.topicId, label: rf.label },
        tenantId: auth.tenantId,
      });
      return NextResponse.json({
        hardRefused: true,
        message: `🚫 这个问题涉及 ${rf.label}, 属于我不能替公司拍板的红线范围。\n\n${rf.redirect}`,
      });
    }
  } catch {
    /* fail-open */
  }

  const t0 = Date.now();
  let schemes;
  try {
    schemes = await generateMegaplanSchemes(query, { actorUserId: auth.userId });
  } catch (err) {
    return NextResponse.json({ error: `四方案生成失败: ${(err as Error).message}` }, { status: 500 });
  }

  // §CA-13: 记一条 pending 决策, 选定后由 select 写反馈
  let decisionId: string | undefined;
  try {
    const { recordDecision } = await import('@/lib/persona/company-brain-decision');
    const { estimateCostMicroUsd } = await import('@/lib/analytics/track');
    const router = getRouter();
    const active = router.resolveActiveModel('reasoning_complex');
    const modelUsed = active?.model ?? 'deepseek-reasoner';
    const providerUsed = active?.provider ?? 'deepseek-r1';
    const outputSummary = schemes
      .map((s) => `【${s.title}】${(s.content || '(待填)').slice(0, 200)}`)
      .join('\n');
    const estimateTokens = (text: string): number => {
      const cn = (text.match(/[\u4e00-\u9fa5]/g) ?? []).length;
      return Math.ceil(cn * 1.5 + (text.length - cn) * 0.3);
    };
    const tokensIn = estimateTokens(query);
    const tokensOut = estimateTokens(outputSummary);
    const decision = await recordDecision({
      context: 'boss_ai_megaplan',
      inputSummary: query,
      outputSummary,
      modelUsed,
      providerUsed,
      scenario: 'reasoning_complex',
      tokensIn,
      tokensOut,
      costMicroUsd: estimateCostMicroUsd(modelUsed, tokensIn, tokensOut),
      latencyMs: Date.now() - t0,
      refType: 'boss_ai_megaplan',
      tenantId: auth.tenantId,
    });
    decisionId = decision?.id;
  } catch {
    /* 决策记录失败不阻断四方案返回 */
  }

  return NextResponse.json({ schemes, decisionId });
}

export const POST = withApiLog(POSTApiHandler, { route: '/api/boss-ai/megaplan' });
