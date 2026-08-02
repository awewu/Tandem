import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { withApiLog } from '@/lib/api-log/with-api-log';
import {
  COMP_INCOME_COOKIE,
  UNLOCK_COOKIE_OPTIONS,
  hasIncomePin,
  setIncomePin,
  verifyIncomePin,
  validatePin,
  mintUnlockToken,
  verifyUnlockToken,
} from '@/lib/comp/income-lock';

/** GET /api/comp/income — 收入二次密码状态 { hasPin, unlocked } */
async function GETApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const hasPin = await hasIncomePin(auth.userId);
  const unlocked = verifyUnlockToken(req.cookies.get(COMP_INCOME_COOKIE)?.value, auth.userId);
  return NextResponse.json({ hasPin, unlocked });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/comp/income' });

/**
 * POST /api/comp/income — 收入二次密码操作
 *   { action:'set', pin, currentPin? }  设置/修改 (已存在则需 currentPin)
 *   { action:'unlock', pin }            解锁 → 下发 15min 解锁 cookie
 *   { action:'lock' }                   立即上锁 (清 cookie)
 */
async function POSTApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? '');

  if (action === 'set') {
    const pin = String(body.pin ?? '');
    const err = validatePin(pin);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    const exists = await hasIncomePin(auth.userId);
    if (exists) {
      const ok = await verifyIncomePin(auth.userId, String(body.currentPin ?? ''));
      if (!ok) return NextResponse.json({ error: '原二次密码错误' }, { status: 403 });
    }
    await setIncomePin(auth.userId, auth.tenantId, pin);
    // 设置后直接解锁
    const res = NextResponse.json({ ok: true, hasPin: true });
    res.cookies.set(COMP_INCOME_COOKIE, mintUnlockToken(auth.userId), UNLOCK_COOKIE_OPTIONS);
    return res;
  }

  if (action === 'unlock') {
    const ok = await verifyIncomePin(auth.userId, String(body.pin ?? ''));
    if (!ok) return NextResponse.json({ error: '二次密码错误' }, { status: 403 });
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COMP_INCOME_COOKIE, mintUnlockToken(auth.userId), UNLOCK_COOKIE_OPTIONS);
    return res;
  }

  if (action === 'lock') {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COMP_INCOME_COOKIE, '', { ...UNLOCK_COOKIE_OPTIONS, maxAge: 0 });
    return res;
  }

  return NextResponse.json({ error: 'action must be set | unlock | lock' }, { status: 400 });
}

export const POST = withApiLog(POSTApiHandler, { route: '/api/comp/income' });
