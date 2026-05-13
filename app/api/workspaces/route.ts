/**
 * GET /api/workspaces
 *
 * 返回 workspace 列表 (V1 简化: 返回所有 workspace).
 */

import { NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { getStore } from '@/lib/storage/repository';
import { error, json } from '@/app/api/_common/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  try {
    await boot();
    const store = getStore();
    const workspaces = await store.workspaces.list();
    return json({ workspaces: workspaces.map((w) => ({
      id: w.id,
      name: w.name,
      slug: w.slug,
      planId: w.planId,
      subscriptionStatus: w.subscriptionStatus,
    })) });
  } catch (err: any) {
    console.error('[workspaces]', err);
    return error(err?.message || 'Failed', 500);
  }
}
