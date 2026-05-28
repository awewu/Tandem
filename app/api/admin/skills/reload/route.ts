/**
 * §V2 · Skill Registry Reload (admin only)
 *
 * POST /api/admin/skills/reload
 *
 * 用途:
 *   - 改了内置 skill 代码后, 不重启进程让 registry 立即生效
 *   - approve/suspend skill governance 后立即清/重载
 *   - dev 调试时手动刷新
 *
 * 权限: admin / superuser only.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { reloadSkillRegistry } from '@/lib/taf/skills/reload';

export async function POST(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!auth.roles.includes('admin') && !auth.demo) {
    return NextResponse.json({ error: 'admin only' }, { status: 403 });
  }
  try {
    const result = await reloadSkillRegistry({
      actorUserId: auth.userId,
      tenantId: auth.tenantId,
    });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!auth.roles.includes('admin') && !auth.demo) {
    return NextResponse.json({ error: 'admin only' }, { status: 403 });
  }
  // 探针: 当前 registry 状态
  const { skillRegistry } = await import('@/lib/taf/skills/registry');
  const all = skillRegistry.list().map((s) => ({
    id: s.id,
    zone: s.zone,
    description: s.description,
    proxyAllowed: s.proxyAllowed,
    estimatedTokens: s.estimatedTokens,
    tags: s.tags,
  }));
  return NextResponse.json({ count: all.length, skills: all });
}
