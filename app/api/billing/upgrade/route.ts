/**
 * POST /api/billing/upgrade
 *
 * 切换 workspace 的订阅计划 (V1 模拟支付, V2 接入 Stripe).
 */

import { NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { getStore } from '@/lib/storage/repository';
import { resolveTenant } from '@/lib/tenant/tenant-context';
import { error, json } from '@/app/api/_common/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    await boot();
    const tenantCtx = resolveTenant(req);
    const body = (await req.json()) as { planId?: string; workspaceId?: string };

    const workspaceId = tenantCtx.workspaceId ?? body.workspaceId ?? 'default';
    const planId = body.planId;
    if (!planId) {
      return error('planId required', 400);
    }

    const store = getStore();
    const workspace = await store.workspaces.get(workspaceId);
    if (!workspace) {
      return error('Workspace not found', 404);
    }

    const plan = await store.plans.get(planId);
    if (!plan) {
      return error('Plan not found', 404);
    }

    // Update workspace plan
    await store.workspaces.update(workspaceId, {
      planId: plan.id,
      maxUsers: plan.maxUsers,
      maxStorageMb: plan.maxStorageMb,
      maxChannels: plan.maxChannels,
      subscriptionStatus: 'active',
    });

    // Create subscription record (V1 mock)
    const now = new Date();
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
    try {
      await (store as any).subscriptions?.create?.({
        workspaceId,
        planId: plan.id,
        provider: 'manual',
        status: 'active',
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd: periodEnd.toISOString(),
        cancelAtPeriodEnd: false,
      });
    } catch {
      // subscriptions repo may not exist on all store implementations; ignore
    }

    return json({
      ok: true,
      workspace: {
        id: workspaceId,
        planId: plan.id,
        planName: plan.name,
        subscriptionStatus: 'active',
      },
    });
  } catch (err: any) {
    console.error('[billing/upgrade]', err);
    return error(err?.message || 'Failed', 500);
  }
}
