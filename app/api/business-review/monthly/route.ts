/**
 * GET /api/business-review/monthly?windowDays=30&format=json|markdown
 *
 * 月度经营回顾 (对标 WorkBoard Business Review).
 *
 * 权限: 仅 owner / admin / manager / steward (经营层) 可读.
 * 数据: 全部 S0 rollup 真值 + analyzeOkrHealth + 决议活动统计.
 * fail-soft: 任何段失败退化空段, 报告仍返.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { generateMonthlyBusinessReview } from '@/lib/persona/business-review';

export const runtime = 'nodejs';

const ALLOWED_ROLES = ['owner', 'admin', 'manager', 'steward'];

export async function GET(req: NextRequest): Promise<NextResponse> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  // 权限闸: 经营层才能看月度回顾 (普通员工看个人 dashboard, 不看公司层)
  const ok = auth.demo || auth.roles.some((r) => ALLOWED_ROLES.includes(r));
  if (!ok) {
    return NextResponse.json({ error: 'forbidden · 仅经营层 (owner/admin/manager/steward) 可读' }, { status: 403 });
  }

  const url = new URL(req.url);
  const windowDays = Math.min(365, Math.max(1, parseInt(url.searchParams.get('windowDays') ?? '30', 10) || 30));
  const format = (url.searchParams.get('format') ?? 'json').toLowerCase();

  try {
    const review = await generateMonthlyBusinessReview({ windowDays });
    if (format === 'markdown' || format === 'md') {
      return new NextResponse(review.markdown, {
        status: 200,
        headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
      });
    }
    return NextResponse.json(review);
  } catch (err) {
    return NextResponse.json(
      { error: `business review failed: ${(err as Error).message}` },
      { status: 500 },
    );
  }
}
