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

export async function GET(req: NextRequest) {
  await boot();
  const url = new URL(req.url);
  const log = getAuditLog();

  const filter: { actorId?: string; action?: AuditAction; targetId?: string } = {};
  const actorId = url.searchParams.get('actorId');
  const action = url.searchParams.get('action');
  const targetId = url.searchParams.get('targetId');
  if (actorId) filter.actorId = actorId;
  if (action) filter.action = action as AuditAction;
  if (targetId) filter.targetId = targetId;

  const limit = Number(url.searchParams.get('limit') ?? '100');
  const entries = (await log.list(filter)).slice(-limit);
  const integrity = await log.verify();

  return NextResponse.json({
    count: entries.length,
    integrity,
    entries,
  });
}
