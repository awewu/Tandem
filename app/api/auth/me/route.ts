import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { getStore } from '@/lib/storage/repository';

/**
 * GET /api/auth/me
 * 当前会话用户.
 *
 * 走 requireAuth 统一鉴权: 真实登录返回会话用户; demo 回退 (ALLOW_DEMO_AUTH=1)
 * 返回 demo 用户, 与服务端各 API 路由的鉴权上下文保持一致 —— 否则客户端
 * useCurrentUser 在 demo 模式下永远拿不到用户, 导致"我创建的文档却看不到删除/管理"。
 */
export async function GET(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth; // 401

  if (auth.demo) {
    return NextResponse.json({
      ok: true,
      user: {
        id: auth.userId,
        email: auth.email,
        name: 'Demo Admin',
        roles: auth.roles,
        tenantId: auth.tenantId,
        mfaVerified: auth.mfaVerified,
      },
    });
  }

  const user = await getStore().auth.users.findById(auth.userId);
  if (!user) return NextResponse.json({ ok: false, error: 'user not found' }, { status: 404 });

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles ?? [],
      tenantId: user.tenantId ?? 'default',
      mfaVerified: auth.mfaVerified,
    },
  });
}
