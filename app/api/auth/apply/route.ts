/**
 * POST /api/auth/apply
 *
 * 外部人员注册申请 (公开端点, 不需登录).
 * Body: { email, name, reason, organization?, requestedScopes? }
 *
 * 限流: per-IP 3 次 / 小时 — 防垃圾申请轰炸
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { submitApplication, ApplicationError } from '@/lib/auth/applications';
import { rateLimit, getClientIp } from '@/lib/infra/rate-limit';
import { logger } from '@/lib/infra/logger';

export async function POST(req: NextRequest) {
  await boot();
  const ip = getClientIp(req.headers);
  const rl = await rateLimit({ key: `auth-apply:${ip}`, limit: 3, windowSec: 3600 });
  if (!rl.allowed) {
    logger.warn({ ip, totalHits: rl.totalHits }, '[auth.apply] rate-limited');
    return NextResponse.json(
      { ok: false, error: '提交过于频繁, 请稍后再试', code: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(rl.resetSec) } },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  try {
    const app = await submitApplication({
      email: String(body.email ?? ''),
      name: String(body.name ?? ''),
      reason: String(body.reason ?? ''),
      organization: body.organization ? String(body.organization) : undefined,
      requestedScopes: Array.isArray(body.requestedScopes)
        ? (body.requestedScopes as ('naba' | 'dazi')[])
        : undefined,
      deviceInfo: {
        userAgent: req.headers.get('user-agent') ?? undefined,
        ip,
      },
    });
    return NextResponse.json({
      ok: true,
      applicationId: app.id,
      message: '申请已提交, Owner 审批后我们会通过邮件告知你下一步.',
    });
  } catch (err) {
    if (err instanceof ApplicationError) {
      return NextResponse.json(
        { ok: false, code: err.code, error: err.message },
        { status: err.httpStatus },
      );
    }
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
