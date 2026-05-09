import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { logout } from '@/lib/auth/native';
import { COOKIE_ACCESS, COOKIE_REFRESH, verifyAccessToken } from '@/lib/auth/session';

export async function POST(req: NextRequest) {
  await boot();
  const accessToken = req.cookies.get(COOKIE_ACCESS)?.value;
  const payload = accessToken ? verifyAccessToken(accessToken) : null;

  if (payload?.sid) {
    try {
      await logout(payload.sid);
    } catch {
      /* ignore */
    }
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE_ACCESS);
  res.cookies.delete(COOKIE_REFRESH);
  return res;
}
