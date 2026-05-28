/**
 * LLM Preference API · 中央AI / 个人AI 模型切换
 *
 * GET    /api/settings/llm-preference?scope=tenant|user
 *   - scope='user'   : 当前登录用户的个人AI
 *   - scope='tenant' : 当前租户的中央AI (任何登录用户都可读, 用于了解默认)
 *
 * PUT    /api/settings/llm-preference
 *   body: { scope, byScenario, defaultProvider }
 *   - scope='user'   : 任何登录用户可修改自己的
 *   - scope='tenant' : 仅 admin/owner 角色可改
 *
 * GET    /api/settings/llm-preference/providers
 *   - 返回当前已注册的 provider 列表 (来自 router.listProviders())
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { boot, getRouter } from '@/lib/boot';
import {
  getTenantPreference,
  getUserPreference,
  upsertPreference,
} from '@/lib/settings/llm-preference';
import { audit } from '@/lib/audit/log';

export async function GET(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get('scope') ?? 'user';

  try {
    const tenantId = auth.tenantId ?? 'default';
    const router = getRouter();
    const availableProviders = router.listProviders();

    if (scope === 'tenant') {
      const pref = await getTenantPreference(tenantId);
      return NextResponse.json({ ok: true, preference: pref, availableProviders });
    }

    const userPref = await getUserPreference(auth.userId, tenantId);
    const tenantPref = await getTenantPreference(tenantId);
    return NextResponse.json({
      ok: true,
      preference: userPref,
      tenantDefault: tenantPref,
      availableProviders,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message ?? 'unknown error' },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const scope = body.scope as 'tenant' | 'user';
    if (scope !== 'tenant' && scope !== 'user') {
      return NextResponse.json({ ok: false, error: 'scope must be tenant|user' }, { status: 400 });
    }

    // 中央AI 仅 admin/owner 可改
    if (scope === 'tenant') {
      const roles = auth.roles ?? [];
      if (!roles.includes('admin') && !roles.includes('owner')) {
        return NextResponse.json(
          { ok: false, error: '需要 admin 或 owner 角色才能修改中央AI' },
          { status: 403 },
        );
      }
    }

    // provider 必须是已注册的
    const router = getRouter();
    const available = new Set(router.listProviders());
    const byScenario = body.byScenario ?? {};
    const defaultProvider = body.defaultProvider;

    for (const p of Object.values(byScenario)) {
      if (typeof p === 'string' && p && !available.has(p)) {
        return NextResponse.json(
          { ok: false, error: `provider "${p}" 未注册, 可选: ${Array.from(available).join(', ')}` },
          { status: 400 },
        );
      }
    }
    if (defaultProvider && !available.has(defaultProvider)) {
      return NextResponse.json(
        { ok: false, error: `defaultProvider "${defaultProvider}" 未注册` },
        { status: 400 },
      );
    }

    const pref = await upsertPreference({
      scope,
      userId: scope === 'user' ? auth.userId : null,
      tenantId: auth.tenantId ?? 'default',
      byScenario: byScenario as Partial<Record<import('@/lib/taf/provider/types').ScenarioTag, string>>,
      defaultProvider,
      updatedBy: auth.userId,
    });

    await audit(scope === 'tenant' ? 'system.provider_switch' : 'system.provider_switch', auth.userId, {
      tenantId: auth.tenantId ?? 'default',
      metadata: { scope, byScenario, defaultProvider, prefId: pref.id },
    });

    return NextResponse.json({ ok: true, preference: pref });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message ?? 'unknown error' },
      { status: 500 },
    );
  }
}
