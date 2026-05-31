/**
 * POST /api/auth/phone/send-code
 * Body: { phone }
 *
 * 下发手机验证码. 未配置短信服务 → 501 not_configured (诚实, 不伪造).
 * dev `SMS_PROVIDER=log` 时, 响应回传 devCode 便于联调.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { sendPhoneCode, PhoneLoginError } from '@/lib/auth/phone-login';
import { rateLimit, POLICIES, getClientIp } from '@/lib/infra/rate-limit';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  await boot();

  const ip = getClientIp(req.headers);
  const rl = await rateLimit({ key: `phone-otp:${ip}`, ...POLICIES.login() });
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, code: 'RATE_LIMITED', error: '请求过于频繁, 稍后再试' },
      { status: 429, headers: { 'Retry-After': String(rl.resetSec) } },
    );
  }

  let body: { phone?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  try {
    const r = await sendPhoneCode(body.phone ?? '');
    return NextResponse.json({ ok: true, devCode: r.devCode });
  } catch (err) {
    if (err instanceof PhoneLoginError) {
      return NextResponse.json({ ok: false, code: err.code, error: err.message }, { status: err.httpStatus });
    }
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
