/**
 * POST /api/org/users/[id]/password — 管理员/HR 重置某员工密码
 *
 * Body: { newPassword: string, revokeSessions?: boolean }
 *   - 仅 admin / hr 可调用 (与 PATCH /api/org/users/[id] 同权限门)
 *   - 校验密码强度 (lib/auth/password.evaluatePassword)
 *   - 落库新 hash (savePasswordHash 自动把旧 hash 追加进历史)
 *   - 默认撤销该用户全部会话 (改密后各端强制重新登录), 可用 revokeSessions=false 关闭
 */
import { NextResponse, type NextRequest } from 'next/server';
import { boot, getStore } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { hashPassword, evaluatePassword } from '@/lib/auth/password';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!auth.roles?.includes('admin') && !auth.roles?.includes('hr'))
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
  if (!newPassword)
    return NextResponse.json({ error: 'newPassword required' }, { status: 400 });

  const store = getStore();
  // 租户隔离: 显式校验 tenantId (与 PATCH 路由一致).
  const existing = await store.auth.users.findById(params.id);
  if (!existing || existing.tenantId !== auth.tenantId)
    return NextResponse.json({ error: 'not found' }, { status: 404 });

  const strength = evaluatePassword(newPassword, { email: existing.email, name: existing.name });
  if (!strength.ok)
    return NextResponse.json(
      { error: `密码不符合要求: ${strength.errors.join(', ')}` },
      { status: 400 },
    );

  await store.auth.users.savePasswordHash(params.id, hashPassword(newPassword));

  if (body.revokeSessions !== false) {
    await store.auth.sessions.revokeAllForUser(params.id, 'admin_password_reset');
  }

  await store.auth.events.append({
    userId: params.id,
    eventType: 'password_reset_by_admin',
    metadata: { by: auth.userId },
  });

  return NextResponse.json({ ok: true });
}
