import { NextResponse } from 'next/server';

const TOKEN_COOKIE = 'nx_token';

export async function POST(req: Request) {
  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid request body' }, { status: 400 });
  }

  const token = String(body?.token ?? '');
  if (token.split('.').length !== 3) {
    return NextResponse.json({ error: 'invalid token' }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24,
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}
