import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { COMP_INCOME_COOKIE, verifyUnlockToken } from '@/lib/comp/income-lock';
import { simulateForEmployee, type WhatIfOpts } from '@/lib/comp/whatif-service';

/**
 * POST /api/comp/me/what-if — 员工双轨收入试算 (受收入二次密码锁保护)
 *   body: { toGear?, toLevel?, certifyAll? }
 */
async function POSTApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  // 收入锁: 试算暴露收入, 需已解锁
  if (!verifyUnlockToken(req.cookies.get(COMP_INCOME_COOKIE)?.value, auth.userId)) {
    return NextResponse.json({ locked: true }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as WhatIfOpts;
  try {
    const result = await simulateForEmployee(auth.tenantId, auth.userId, {
      toGear: body.toGear,
      toLevel: body.toLevel,
      certifyAll: body.certifyAll,
    });
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const POST = withApiLog(POSTApiHandler, { route: '/api/comp/me/what-if' });
