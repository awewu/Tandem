/**
 * Tenant AI Policy API · 企业 AI 治理策略
 *
 * GET  /api/settings/tenant-ai-policy
 *   任何登录用户可读 (员工需了解是否开放个人AI)
 *
 * PUT  /api/settings/tenant-ai-policy
 *   仅 admin / owner 可写
 *   body: { allowPersonalAiTokens?, monthlyTokenBudgetPerUser?, personalAiProviderWhitelist?, centralAiFlagshipProvider? }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { boot, getRouter } from '@/lib/boot';
import { getTenantAiPolicy, upsertTenantAiPolicy } from '@/lib/settings/tenant-ai-policy';
import { audit } from '@/lib/audit/log';

export async function GET(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const tenantId = auth.tenantId ?? 'default';
    const policy = await getTenantAiPolicy(tenantId);
    const router = getRouter();
    const availableProviders = router.listProviders();

    return NextResponse.json({ ok: true, policy, availableProviders });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const roles = auth.roles ?? [];
  if (!roles.includes('admin') && !roles.includes('owner')) {
    return NextResponse.json({ ok: false, error: '需要 admin 或 owner 角色' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const tenantId = auth.tenantId ?? 'default';
    const router = getRouter();
    const available = new Set(router.listProviders());

    // 校验白名单里的 provider 都已注册
    if (Array.isArray(body.personalAiProviderWhitelist)) {
      for (const p of body.personalAiProviderWhitelist) {
        if (typeof p === 'string' && p && !available.has(p)) {
          return NextResponse.json(
            { ok: false, error: `provider "${p}" 未注册, 可选: ${Array.from(available).join(', ')}` },
            { status: 400 },
          );
        }
      }
    }

    const patch: Record<string, unknown> = {};
    if (typeof body.allowPersonalAiTokens === 'boolean') patch.allowPersonalAiTokens = body.allowPersonalAiTokens;
    if (typeof body.monthlyTokenBudgetPerUser === 'number') patch.monthlyTokenBudgetPerUser = body.monthlyTokenBudgetPerUser;
    if (Array.isArray(body.personalAiProviderWhitelist)) patch.personalAiProviderWhitelist = body.personalAiProviderWhitelist;
    if (typeof body.centralAiFlagshipProvider === 'string') patch.centralAiFlagshipProvider = body.centralAiFlagshipProvider;

    const policy = await upsertTenantAiPolicy(tenantId, patch, auth.userId);

    await audit('system.provider_switch', auth.userId, {
      tenantId,
      metadata: { action: 'tenant_ai_policy_update', patch },
    });

    return NextResponse.json({ ok: true, policy });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
