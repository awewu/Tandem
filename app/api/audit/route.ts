/**
 * GET /api/audit
 *
 * 审计日志查询 + 链式 hash 完整性校验.
 * PRD section 8 安全验收: "链式 hash 审计日志不可篡改".
 *
 * Query:
 *   actorId / action / targetId  - filter
 *   limit                         - 默认 100
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { getAuditLog, type AuditAction } from '@/lib/audit/log';
import { requireAuth } from '@/lib/auth/require-auth';

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();
  const url = new URL(req.url);
  const log = getAuditLog();

  // Tenant isolation (P0-B): 审计条目的租户存在 entry.tenantId **顶层** (见
  // lib/audit/log.ts append), 不在 metadata。必须把 tenantId 下推给 log.list()
  // 让 DB / 内存层做真正的租户过滤 — 否则 list() 会返回全租户后再被错误归桶,
  // 既让非 default 租户看不到自己的审计, 又留下跨租户泄漏面。
  const filter: { actorId?: string; action?: AuditAction; targetId?: string; tenantId: string } = {
    tenantId: auth.tenantId,
  };
  const actorId = url.searchParams.get('actorId');
  const action = url.searchParams.get('action');
  const targetId = url.searchParams.get('targetId');
  if (actorId) filter.actorId = actorId;
  if (action) filter.action = action as AuditAction;
  if (targetId) filter.targetId = targetId;

  const limit = Number(url.searchParams.get('limit') ?? '100');
  const entries = (await log.list(filter)).slice(-limit);

  const integrity = await log.verify(auth.tenantId);

  return NextResponse.json({
    count: entries.length,
    integrity,
    entries,
  });
}
