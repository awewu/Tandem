import { NextResponse } from 'next/server';
import {
  verifyDevLogin, issueSession, getSession, SESSION_COOKIE,
  AUTH_MODE, ssoEnabled,
} from '../../../lib/brand';

const secureCookie = process.env.BRAND_CONSOLE_COOKIE_SECURE
  ? process.env.BRAND_CONSOLE_COOKIE_SECURE === 'true'
  : process.env.NODE_ENV === 'production';

// GET 当前会话 + 鉴权模式（供登录页决定展示 SSO 按钮或账号密码表单）
export async function GET() {
  const s = await getSession();
  return NextResponse.json({
    user: s ? { name: s.name, role: s.role } : null,
    authMode: AUTH_MODE,
    sso: ssoEnabled(),
  });
}

// POST 登录（仅 dev 模式；生产走 /api/session/sso → IdP）
export async function POST(req: Request) {
  if (AUTH_MODE !== 'dev') {
    return NextResponse.json({ error: '本环境启用 SSO，请使用统一身份登录' }, { status: 400 });
  }
  let body: { user?: string; password?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: '请求体无效' }, { status: 400 }); }
  if (!body?.user || !body?.password) return NextResponse.json({ error: '账号和密码必填' }, { status: 400 });
  const session = verifyDevLogin(body.user, body.password);
  if (!session) return NextResponse.json({ error: '账号或密码错误' }, { status: 401 });

  const res = NextResponse.json({ user: { name: session.name, role: session.role } });
  res.cookies.set(SESSION_COOKIE, issueSession(session), {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 8,
    secure: secureCookie,
  });
  return res;
}

// DELETE 登出
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
