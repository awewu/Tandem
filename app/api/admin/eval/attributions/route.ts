/**
 * GET /api/admin/eval/attributions
 *
 * P0 Eval · #11 学习归因记录 (被 acknowledged 的 OKR 预警之后 KR 是否改善)
 *
 * Query:
 *   ?verdict=positive|neutral|negative|insufficient_data
 *   ?limit=100 (默认 100, max 500)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { listAttributions } from '@/lib/persona/attribution';
import type { AttributionVerdict } from '@/lib/types/eval';
import { withApiLog } from '@/lib/api-log/with-api-log';

export const runtime = 'nodejs';

const ALLOWED_VERDICTS: AttributionVerdict[] = ['positive', 'neutral', 'negative', 'insufficient_data'];

async function GETApiHandler(req: NextRequest): Promise<NextResponse> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const roleErr = requireRole(auth, ['admin', 'steward', 'champion']);
  if (roleErr) return roleErr;

  const url = new URL(req.url);
  const verdictParam = url.searchParams.get('verdict') ?? undefined;
  const verdict =
    verdictParam && ALLOWED_VERDICTS.includes(verdictParam as AttributionVerdict)
      ? (verdictParam as AttributionVerdict)
      : undefined;

  let limit = Number(url.searchParams.get('limit') ?? 100);
  if (!Number.isFinite(limit) || limit <= 0) limit = 100;
  if (limit > 500) limit = 500;

  const attributions = await listAttributions({ tenantId: auth.tenantId, verdict, limit });
  return NextResponse.json({ total: attributions.length, filter: { verdict, limit }, attributions });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/admin/eval/attributions' });
