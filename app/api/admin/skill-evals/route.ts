/**
 * GET /api/admin/skill-evals
 *
 * Palantir 启发 #3: per-scenario AI 准确率统计 (Tandem 版 AIP Evals MVP)
 *
 * 从 CompanyBrainDecision 表聚合:
 *   - 按 context (im_reply / boss_ai_reply / meeting_advice / ...) 分桶
 *   - 计算每个 scenario 的 adopted_rate / overruled_rate / pending_rate
 *   - 返回近 90 天滑动窗口 (可通过 ?days= 调整)
 *
 * 用途: Owner / 治理委员会在 admin 面板查看哪些 AI 场景质量最高/最低,
 *       指导 CompanyBrainVersion 迭代方向 (对应 Palantir AIP Evals 的 per-function eval)
 */
import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { getStore } from '@/lib/storage/repository';
import type { CompanyBrainDecisionContext, CompanyBrainFeedbackOutcome } from '@/lib/types/company-brain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ScenarioStats {
  scenario: CompanyBrainDecisionContext;
  total: number;
  adopted: number;
  modified: number;
  overruled: number;
  ignored: number;
  pending: number;
  adoptedRate: number;
  overruledRate: number;
  avgLatencyMs: number;
  avgTokensIn: number;
  avgTokensOut: number;
  models: Record<string, number>;
}

export async function GET(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const roleCheck = requireRole(auth, ['admin', 'owner', 'steward']);
  if (roleCheck instanceof NextResponse) return roleCheck;

  const url = new URL(req.url);
  const days = Math.min(Math.max(parseInt(url.searchParams.get('days') ?? '90', 10), 7), 365);
  const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000;

  const store = getStore();
  const all = await store.companyBrainDecisions.list();

  // 租户隔离: 故意的双租户读 (本租户 + 'default') — CompanyBrain 决策记录归属 '__company__'/'default',
  // 非 §23 P2-A 待收敛项 (withTenantScope 无法表达 OR 两个租户)。保留显式过滤。
  const inWindow = all.filter(
    (d) =>
      new Date(d.createdAt).getTime() >= sinceMs &&
      (d.tenantId === auth.tenantId || d.tenantId === 'default')
  );

  const byScenario = new Map<CompanyBrainDecisionContext, typeof inWindow>();
  for (const d of inWindow) {
    const ctx = d.context;
    const arr = byScenario.get(ctx) ?? [];
    arr.push(d);
    byScenario.set(ctx, arr);
  }

  const stats: ScenarioStats[] = [];

  for (const [scenario, decisions] of Array.from(byScenario.entries())) {
    const counts: Record<CompanyBrainFeedbackOutcome, number> = {
      pending: 0, adopted: 0, modified: 0, overruled: 0, ignored: 0,
    };
    let totalLatency = 0;
    let totalTokensIn = 0;
    let totalTokensOut = 0;
    const models: Record<string, number> = {};

    for (const d of decisions) {
      const outcome = d.feedback.outcome;
      counts[outcome as CompanyBrainFeedbackOutcome] = (counts[outcome as CompanyBrainFeedbackOutcome] ?? 0) + 1;
      totalLatency += d.latencyMs ?? 0;
      totalTokensIn += d.tokensIn ?? 0;
      totalTokensOut += d.tokensOut ?? 0;
      if (d.modelUsed) {
        models[d.modelUsed] = (models[d.modelUsed] ?? 0) + 1;
      }
    }

    const total = decisions.length;
    const resolved = total - counts.pending;

    stats.push({
      scenario,
      total,
      adopted: counts.adopted,
      modified: counts.modified,
      overruled: counts.overruled,
      ignored: counts.ignored,
      pending: counts.pending,
      adoptedRate: resolved > 0 ? Math.round(((counts.adopted + counts.modified) / resolved) * 1000) / 1000 : 0,
      overruledRate: resolved > 0 ? Math.round((counts.overruled / resolved) * 1000) / 1000 : 0,
      avgLatencyMs: total > 0 ? Math.round(totalLatency / total) : 0,
      avgTokensIn: total > 0 ? Math.round(totalTokensIn / total) : 0,
      avgTokensOut: total > 0 ? Math.round(totalTokensOut / total) : 0,
      models,
    });
  }

  stats.sort((a, b) => b.total - a.total);

  const summary = {
    windowDays: days,
    totalDecisions: inWindow.length,
    scenarioCount: stats.length,
    overallAdoptedRate:
      inWindow.length > 0
        ? Math.round(
            (inWindow.filter((d) => d.feedback.outcome === 'adopted' || d.feedback.outcome === 'modified').length /
              inWindow.filter((d) => d.feedback.outcome !== 'pending').length || 0) * 1000
          ) / 1000
        : 0,
  };

  return NextResponse.json({ summary, scenarios: stats });
}
