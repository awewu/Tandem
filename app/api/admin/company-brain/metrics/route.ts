/**
 * GET /api/admin/company-brain/metrics
 *
 * §CA-13 (CENTRAL-AI-ARCHITECTURE.md) · CompanyBrain 智能迭代度量看板数据
 *
 * 返回:
 *   - overall (采纳率/推翻率/平均成本延迟)
 *   - byContext (按 IM/灰区仲裁/议事建议/... 分桶)
 *   - byBrainVersion (跨版本对比)
 *   - dailyTrend (近 N 天采纳率趋势)
 *   - topFailurePatterns (推翻原因关键词聚类)
 *   - recentOverrules (近期被推翻案例)
 *
 * Query:
 *   ?windowDays=30 (默认 30, max 90)
 *   ?limit=500 (默认 500, max 2000)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { computeMetrics } from '@/lib/persona/company-brain-metrics';

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const roleErr = requireRole(auth, ['admin', 'steward', 'champion']);
  if (roleErr) return roleErr;

  const url = new URL(req.url);
  let windowDays = Number(url.searchParams.get('windowDays') ?? 30);
  if (!Number.isFinite(windowDays) || windowDays <= 0) windowDays = 30;
  if (windowDays > 90) windowDays = 90;

  let limit = Number(url.searchParams.get('limit') ?? 500);
  if (!Number.isFinite(limit) || limit <= 0) limit = 500;
  if (limit > 2000) limit = 2000;

  const report = await computeMetrics({
    tenantId: auth.tenantId,
    windowDays,
    limit,
  });

  return NextResponse.json(report);
}
