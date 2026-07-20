/**
 * POST /api/admin/eval/regression
 *
 * P0 Eval · 回归跑分: 对已采集 trace 重新汇总规则分 (可选补 LLM 分), 输出逐 grader 通过率。
 *
 * Body (JSON, 可选):
 *   { kind?: EvalTraceKind, limit?: number, includeLlm?: boolean }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { runRegression } from '@/lib/eval/service';
import type { EvalTraceKind } from '@/lib/types/eval';
import { withApiLog } from '@/lib/api-log/with-api-log';

export const runtime = 'nodejs';

const ALLOWED_KINDS: EvalTraceKind[] = ['perception', 'act', 'reasoning', 'decision', 'okr_review'];

async function POSTApiHandler(req: NextRequest): Promise<NextResponse> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const roleErr = requireRole(auth, ['admin', 'steward', 'champion']);
  if (roleErr) return roleErr;

  let body: { kind?: unknown; limit?: unknown; includeLlm?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    /* 空 body 允许 */
  }

  const kind =
    typeof body.kind === 'string' && ALLOWED_KINDS.includes(body.kind as EvalTraceKind)
      ? (body.kind as EvalTraceKind)
      : undefined;
  let limit = typeof body.limit === 'number' ? body.limit : 50;
  if (!Number.isFinite(limit) || limit <= 0) limit = 50;
  if (limit > 200) limit = 200;
  const includeLlm = body.includeLlm === true;

  const result = await runRegression({ tenantId: auth.tenantId, kind, limit, includeLlm });
  return NextResponse.json({ filter: { kind, limit, includeLlm }, result });
}

export const POST = withApiLog(POSTApiHandler, { route: '/api/admin/eval/regression' });
