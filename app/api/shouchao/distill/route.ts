/**
 * 搭子手抄 · A2 个人蒸馏
 *   GET  /api/shouchao/distill   列出本人 pending 蒸馏建议
 *   POST /api/shouchao/distill   触发扫描 (只扫本人已授权笔记)
 * 纯个人域, ownerId 隔离; 产物绝不进组织记忆。
 */
import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { listCandidates, scanForCandidates } from '@/lib/shouchao/distillation';
import { withApiLog } from '@/lib/api-log/with-api-log';

export const runtime = 'nodejs';

async function GETApiHandler(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();
  const candidates = await listCandidates(auth.userId);
  return NextResponse.json({ candidates });
}

async function POSTApiHandler(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();
  const result = await scanForCandidates(auth.userId);
  return NextResponse.json(result);
}

export const GET = withApiLog(GETApiHandler, { route: '/api/shouchao/distill' });
export const POST = withApiLog(POSTApiHandler, { route: '/api/shouchao/distill' });
