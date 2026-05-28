/**
 * GET /api/admin/governance/okr-drift
 *
 * §B-015 (OKR-DRIVEN §三第2条) · OKR 主航道偏离 audit 列表 + 统计
 *
 * 治理委员会月审看 drift 情况, 据此校准 ALIGNED_THRESHOLD + 调整 OKR 颗粒度.
 *
 * Query:
 *   ?limit=200 (默认 200, max 1000)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { getAuditLog } from '@/lib/audit/log';

export const runtime = 'nodejs';

interface DriftEntry {
  id: string;
  timestamp: string;
  actorId: string;
  targetId?: string;
  targetType?: string;
  source?: string;
  alignmentScore?: number;
  okrCount?: number;
  topHits?: Array<{ objectiveTitle?: string; keyResultTitle?: string; similarity?: number }>;
  intentPreview?: string;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const roleErr = requireRole(auth, ['admin', 'steward', 'champion']);
  if (roleErr) return roleErr;

  const url = new URL(req.url);
  let limit = Number(url.searchParams.get('limit') ?? 200);
  if (!Number.isFinite(limit) || limit <= 0) limit = 200;
  if (limit > 1000) limit = 1000;

  const log = getAuditLog();
  const rows = await log.list({
    action: 'governance.okr_drift_detected',
    tenantId: auth.tenantId,
    limit,
  });

  // 解析 metadata → 扁平字段
  const entries: DriftEntry[] = rows.map((r) => {
    const m = (r.metadata ?? {}) as Record<string, unknown>;
    return {
      id: r.id,
      timestamp: r.timestamp,
      actorId: r.actorId,
      targetId: r.targetId,
      targetType: r.targetType,
      source: typeof m.source === 'string' ? m.source : undefined,
      alignmentScore: typeof m.alignmentScore === 'number' ? m.alignmentScore : undefined,
      okrCount: typeof m.okrCount === 'number' ? m.okrCount : undefined,
      topHits: Array.isArray(m.topHits) ? (m.topHits as DriftEntry['topHits']) : undefined,
      intentPreview: typeof m.intentPreview === 'string' ? m.intentPreview : undefined,
    };
  });

  // 统计 by source + by 日期
  const bySource: Record<string, number> = {};
  const byDay = new Map<string, number>();
  let sumScore = 0;
  let countWithScore = 0;
  for (const e of entries) {
    const src = e.source ?? 'unknown';
    bySource[src] = (bySource[src] ?? 0) + 1;
    const day = e.timestamp.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
    if (typeof e.alignmentScore === 'number') {
      sumScore += e.alignmentScore;
      countWithScore++;
    }
  }
  const dailyTrend = Array.from(byDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }));

  return NextResponse.json({
    total: entries.length,
    avgAlignmentScore: countWithScore > 0 ? Math.round((sumScore / countWithScore) * 1000) / 1000 : 0,
    bySource,
    dailyTrend,
    entries,
  });
}
