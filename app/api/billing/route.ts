/**
 * GET /api/billing
 *
 * 返回当前 workspace 的订阅状态 + 用量统计 + 可升级计划列表
 */

import { NextRequest } from 'next/server';
import { getStore } from '@/lib/storage/repository';
import { resolveTenant } from '@/lib/tenant/tenant-context';
import { boot } from '@/lib/boot';
import { error, json } from '@/app/api/_common/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await boot();
    const tenantCtx = resolveTenant(req);
    const { searchParams } = new URL(req.url);
    const workspaceId = tenantCtx.workspaceId ?? searchParams.get('workspace') ?? 'default';

    const store = getStore();
    const workspace = await store.workspaces.get(workspaceId);
    if (!workspace) {
      return error('Workspace not found', 404);
    }

    const plan = workspace.planId ? await store.plans.get(workspace.planId) : null;

    // 用量统计 (V1 简化: 从 store 实时计算)
    const allUsers = await store.auth.users.list();
    const userCount = allUsers.filter((u) => u.workspaceId === workspaceId).length;

    const allChannels = await store.imChannels.list();
    const channelCount = allChannels.filter((c) => c.memberIds.some((mid) =>
      allUsers.find((u) => u.id === mid && u.workspaceId === workspaceId)
    )).length;

    // 计划列表
    const allPlans = await store.plans.list();
    const plans = allPlans.map((p) => ({
      id: p.id,
      name: p.name,
      displayName: p.displayName,
      description: p.description,
      priceMonthCents: p.priceMonthCents,
      priceYearCents: p.priceYearCents,
      maxUsers: p.maxUsers,
      maxStorageMb: p.maxStorageMb,
      maxChannels: p.maxChannels,
      apiRateLimitRpm: p.apiRateLimitRpm,
      features: p.features as Record<string, boolean>,
      current: p.id === workspace.planId,
    }));

    return json({
      workspace: {
        id: workspace.id,
        name: workspace.name,
        subscriptionStatus: workspace.subscriptionStatus,
        maxUsers: workspace.maxUsers,
        maxStorageMb: workspace.maxStorageMb,
      },
      currentPlan: plan ? {
        id: plan.id,
        name: plan.name,
        displayName: plan.displayName,
      } : null,
      usage: {
        users: { used: userCount, limit: workspace.maxUsers },
        channels: { used: channelCount, limit: workspace.maxChannels ?? plan?.maxChannels ?? 10 },
        storageMb: { used: 0, limit: workspace.maxStorageMb },
      },
      plans,
    });
  } catch (err: any) {
    console.error('[billing]', err);
    return error(err?.message || 'Failed', 500);
  }
}
