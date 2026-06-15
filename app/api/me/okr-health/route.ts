/**
 * GET /api/me/okr-health
 *
 * D · 信号源扩面到经营级: 工作台「经营回顾 pre-read」。
 * 复用 analyzeOkrHealth (月度反思 / okr.business_review skill 同款参谋分析),
 * 扫 active 周期公司/团队层 OKR, 产出承压信号 (承压 KR / 停滞目标 / 长期承压趋势)。
 *
 * 纯只读: 不创建 ProxyAction, 不改任何 OKR (宪法 A 边界), 仅供 Owner/员工审视。
 * 启发式 (enrichWithLlm=false) → 快, 不烧 token。
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { analyzeOkrHealth } from '@/lib/persona/company-brain-reflection';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const windowDays = Math.min(90, Math.max(7, Number(url.searchParams.get('windowDays') ?? '30') || 30));

  try {
    const proposals = await analyzeOkrHealth(5, 3, windowDays, 3);
    const items = proposals.map((p) => ({
      id: p.id,
      kind: p.kind,
      title: p.title,
      recommendation: p.recommendation,
      progressPct: p.metrics.progressPct,
      confidence: p.metrics.confidence,
    }));
    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      windowDays,
      summary: {
        atRiskKr: proposals.filter((p) => p.kind === 'kr_at_risk').length,
        stalledObjectives: proposals.filter((p) => p.kind === 'objective_stalled').length,
        stalledTrendKr: proposals.filter((p) => p.kind === 'kr_stalled_trend').length,
      },
      items,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
