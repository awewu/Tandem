/**
 * POST /api/mail/send
 *
 * Send an outbound email via configured SMTP (lib/infra/email).
 * Body: { to: string | string[]; subject: string; text?: string; html?: string;
 *         cc?: string|string[]; bcc?: string|string[]; replyTo?: string }
 *
 * Auth: any logged-in user.  In production a tenant- or role-level rate limit
 * should sit in front of this; for now we rely on the global rate-limit
 * middleware applied to all /api/* routes.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import { isEmailConfigured, sendEmail } from '@/lib/infra/email';

interface Body {
  to?: unknown;
  subject?: unknown;
  text?: unknown;
  html?: unknown;
  cc?: unknown;
  bcc?: unknown;
  replyTo?: unknown;
  attachments?: unknown;
}

function asAddrList(v: unknown): string[] | string | undefined {
  if (typeof v === 'string') return v.trim() || undefined;
  if (Array.isArray(v)) {
    const list = v.filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
    return list.length > 0 ? list : undefined;
  }
  return undefined;
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  if (!isEmailConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'SMTP 未配置 — 请管理员设置 SMTP_HOST / SMTP_USER / SMTP_PASS 环境变量' },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const to = asAddrList(body.to);
  if (!to) {
    return NextResponse.json({ ok: false, error: 'to 必填 (字符串或字符串数组)' }, { status: 400 });
  }
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  if (!subject) {
    return NextResponse.json({ ok: false, error: 'subject 必填' }, { status: 400 });
  }
  const text = typeof body.text === 'string' ? body.text : undefined;
  const html = typeof body.html === 'string' ? body.html : undefined;
  if (!text && !html) {
    return NextResponse.json({ ok: false, error: 'text 与 html 至少填一个' }, { status: 400 });
  }

  const attachments = Array.isArray(body.attachments)
    ? body.attachments
        .filter((a: unknown): a is Record<string, unknown> => typeof a === 'object' && a !== null)
        .map((a) => ({
          filename: typeof a.filename === 'string' ? a.filename : 'attachment',
          content: typeof a.content === 'string' ? a.content : JSON.stringify(a.content),
          contentType: typeof a.contentType === 'string' ? a.contentType : undefined,
        }))
    : undefined;

  const result = await sendEmail({
    to,
    subject,
    text,
    html,
    cc: asAddrList(body.cc),
    bcc: asAddrList(body.bcc),
    replyTo: typeof body.replyTo === 'string' ? body.replyTo : undefined,
    attachments,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error ?? '发送失败' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, messageId: result.messageId });
});
