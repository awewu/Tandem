/**
 * GET /api/audit/verify · 验证审计日志哈希链完整性
 *
 * 仅 admin 可调. 返回 { ok, total, brokenAt? }.
 * brokenAt 是首条断链的 seq (0-based index 自起始).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { getAuditLog } from '@/lib/audit/log';

export async function GET(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, ['admin']);
  if (forbidden) return forbidden;

  const log = getAuditLog();
  const result = await log.verify(auth.tenantId);
  return NextResponse.json(result);
}
