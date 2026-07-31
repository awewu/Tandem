/**
 * GET /api/memory/capture · 产出捕获层 (#17) · 我的待沉淀候选队列
 *
 * 返回当前用户名下 status=pending 的 MemoryCaptureCandidate (最近在前)。
 * 采纳/忽略走 POST /api/memory/capture/[id]。
 */
import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { getStore } from '@/lib/storage/repository';
import type { MemoryCaptureCandidate } from '@/lib/memory/capture-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const auth = requireAuth(req);
  if (!('userId' in auth)) return auth;

  await boot();
  const store = getStore();

  const status = new URL(req.url).searchParams.get('status') ?? 'pending';
  const all = (await store.memoryCaptureCandidates.list({
    authorUserId: auth.userId,
  } as Partial<MemoryCaptureCandidate>)) as MemoryCaptureCandidate[];

  const items = all
    .filter((c) => c.tenantId === auth.tenantId && (status === 'all' || c.status === status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return NextResponse.json({ items, count: items.length });
}
