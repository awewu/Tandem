/**
 * 搭子手抄 · 多设备/手机云端增量同步
 *
 *   GET  /api/shouchao/sync?since=<ISO>   拉取 since 以来的变更 (含删除墓碑)
 *   POST /api/shouchao/sync               推送本地变更, 服务端 LWW 合并后返回权威态
 *
 * 个人资产: 全部按 ownerId 隔离, 只同步本人笔记.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { pullChanges, pushChanges } from '@/lib/shouchao/service';
import type { ShouchaoNote } from '@/lib/types/shouchao';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();

  const url = new URL(req.url);
  const since = url.searchParams.get('since') ?? undefined;
  const result = await pullChanges(auth.userId, since);
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();

  let body: { changes?: ShouchaoNote[] };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const changes = Array.isArray(body.changes) ? body.changes : [];
  const notes = await pushChanges(auth.userId, auth.tenantId, changes);
  return NextResponse.json({ notes, serverTime: new Date().toISOString() });
}
