/**
 * GET /api/admin/eval/traces
 *
 * P0 Eval / Trace-Grading 台 · 查近期 agent pass trace + grader 评分
 *
 * Query:
 *   ?kind=perception|act|reasoning|decision|okr_review
 *   ?limit=100 (默认 100, max 500)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { listTraces } from '@/lib/eval/service';
import type { EvalTraceKind } from '@/lib/types/eval';
import { withApiLog } from '@/lib/api-log/with-api-log';

export const runtime = 'nodejs';

const ALLOWED_KINDS: EvalTraceKind[] = ['perception', 'act', 'reasoning', 'decision', 'okr_review'];

async function GETApiHandler(req: NextRequest): Promise<NextResponse> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const roleErr = requireRole(auth, ['admin', 'steward', 'champion']);
  if (roleErr) return roleErr;

  const url = new URL(req.url);
  const kindParam = url.searchParams.get('kind') ?? undefined;
  const kind =
    kindParam && ALLOWED_KINDS.includes(kindParam as EvalTraceKind)
      ? (kindParam as EvalTraceKind)
      : undefined;

  let limit = Number(url.searchParams.get('limit') ?? 100);
  if (!Number.isFinite(limit) || limit <= 0) limit = 100;
  if (limit > 500) limit = 500;

  const traces = await listTraces({ tenantId: auth.tenantId, kind, limit });
  return NextResponse.json({ total: traces.length, filter: { kind, limit }, traces });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/admin/eval/traces' });
