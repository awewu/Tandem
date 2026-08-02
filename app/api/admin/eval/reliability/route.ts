/**
 * POST /api/admin/eval/reliability
 *
 * P0-2 Pass^k 一致性 + P2 #18 可靠性衰退曲线 (RDC) 看板数据源。
 * 纯只读聚合已采集的 EvalTrace, 永不写业务真值。
 *
 * Body (JSON, 可选):
 *   { kind?: EvalTraceKind, k?: number, limit?: number }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { runPassK, runReliabilityCurve } from '@/lib/eval/service';
import type { EvalTraceKind } from '@/lib/types/eval';
import { withApiLog } from '@/lib/api-log/with-api-log';

export const runtime = 'nodejs';

const ALLOWED_KINDS: EvalTraceKind[] = ['perception', 'act', 'reasoning', 'decision', 'okr_review'];

async function POSTApiHandler(req: NextRequest): Promise<NextResponse> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const roleErr = requireRole(auth, ['admin', 'steward', 'champion', 'owner']);
  if (roleErr) return roleErr;

  let body: { kind?: unknown; k?: unknown; limit?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    /* 空 body 允许 */
  }

  const kind =
    typeof body.kind === 'string' && ALLOWED_KINDS.includes(body.kind as EvalTraceKind)
      ? (body.kind as EvalTraceKind)
      : undefined;
  let k = typeof body.k === 'number' ? Math.floor(body.k) : 3;
  if (!Number.isFinite(k) || k < 2) k = 3;
  if (k > 10) k = 10;
  let limit = typeof body.limit === 'number' ? body.limit : 500;
  if (!Number.isFinite(limit) || limit <= 0) limit = 500;
  if (limit > 1000) limit = 1000;

  const [passK, reliability] = await Promise.all([
    runPassK({ tenantId: auth.tenantId, kind, k, limit }),
    runReliabilityCurve({ tenantId: auth.tenantId, kind, limit }),
  ]);

  return NextResponse.json({ filter: { kind, k, limit }, passK, reliability });
}

export const POST = withApiLog(POSTApiHandler, { route: '/api/admin/eval/reliability' });
