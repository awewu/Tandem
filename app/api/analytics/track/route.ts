/**
 * POST /api/analytics/track · 前端埋点入口
 *
 * §SELF-USE-FIRST priority #2 · 自用阶段用户行为埋点
 *
 * 前端调用:
 *   await fetch('/api/analytics/track', {
 *     method: 'POST',
 *     headers: { 'content-type': 'application/json' },
 *     body: JSON.stringify({ eventName: 'page.view', props: { path: '/okr' } }),
 *   });
 *
 * 设计:
 *   - 匿名访问允许 (登录前 page.view 也要记)
 *   - 不返回数据, 只 ack
 *   - 失败也返回 200 (不阻塞前端)
 */
import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { verifyAccessToken, COOKIE_ACCESS } from '@/lib/auth/session';
import { track } from '@/lib/analytics/track';

interface TrackBody {
  eventName?: string;
  props?: Record<string, unknown>;
  sessionId?: string;
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  let body: TrackBody = {};
  try {
    body = (await req.json()) as TrackBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  if (!body.eventName || typeof body.eventName !== 'string' || body.eventName.length > 200) {
    return NextResponse.json({ ok: false, error: 'eventName required (<=200 chars)' }, { status: 400 });
  }

  // 尝试拿用户 id (匿名也允许)
  let userId: string | null = null;
  let tenantId = 'default';
  try {
    const at = req.cookies.get(COOKIE_ACCESS)?.value;
    const payload = at ? verifyAccessToken(at) : null;
    if (payload) {
      userId = payload.sub;
      tenantId = (payload as { tenantId?: string }).tenantId ?? 'default';
    }
  } catch {
    /* 匿名访问 */
  }

  await track({
    eventName: body.eventName,
    userId,
    tenantId,
    props: body.props,
    sessionId: body.sessionId,
    userAgent: req.headers.get('user-agent') ?? undefined,
  });

  return NextResponse.json({ ok: true });
});
