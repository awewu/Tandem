import { NextResponse } from 'next/server';
import { apiUrl, TOKEN_COOKIE } from '../../../../lib/api';

// Proxies login to the backend and stores the returned JWT in an httpOnly
// cookie. The token is never exposed to client JS (XSS-resistant).
export async function POST(req: Request) {
  let body: { phone?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体无效' }, { status: 400 });
  }
  if (!body?.phone || !body?.password) {
    return NextResponse.json({ error: '手机号和密码必填' }, { status: 400 });
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  let upstream: Response;
  try {
    upstream = await fetch(apiUrl('/auth/login'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone: body.phone, password: body.password }),
      signal: ctrl.signal,
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ error: '后端未连接' }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok || !data?.token) {
    return NextResponse.json({ error: data?.message || '登录失败' }, { status: upstream.status || 401 });
  }

  const res = NextResponse.json({ user: data.user ?? null });
  res.cookies.set(TOKEN_COOKIE, data.token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24,
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}
