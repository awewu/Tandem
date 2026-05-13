import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { COOKIE_ACCESS, verifyAccessToken } from '@/lib/auth/session';
import { getStore } from '@/lib/storage/repository';

/**
 * GET /api/auth/me
 * 当前会话用户.
 */
export async function GET(req: NextRequest) {
  await boot();
  const at = req.cookies.get(COOKIE_ACCESS)?.value;
  const payload = at ? verifyAccessToken(at) : null;
  if (!payload) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });

  const user = await getStore().auth.users.findById(payload.sub);
  if (!user) return NextResponse.json({ ok: false, error: 'user not found' }, { status: 404 });

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles ?? [],
      tenantId: user.tenantId ?? 'default',
      workspaceId: user.workspaceId ?? null,
      mfaVerified: payload.mfa,
    },
  });
}
