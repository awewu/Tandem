import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import { sendEmail } from '@/lib/infra/email';
import { resolveUserEmailSmtp } from '@/lib/email/global-email-config';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { getStore } from '@/lib/storage/repository';

interface Body {
  to?: unknown;
  recipientUserIds?: unknown;
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

function asStringList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return Array.from(new Set(v.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).map((s) => s.trim())));
}

const POSTApiHandler = withErrorHandler(async (req: NextRequest) => {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => ({}))) as Body;
  const recipientUserIds = asStringList(body.recipientUserIds);
  const directTo = asAddrList(body.to);
  let resolvedUserEmails: string[] = [];
  if (recipientUserIds.length > 0) {
    const users = await getStore().auth.users.list({ tenantId: auth.tenantId });
    const userById = new Map(users.map((user) => [user.id, user]));
    const missing = recipientUserIds.filter((id) => !userById.has(id));
    if (missing.length > 0) {
      return NextResponse.json({ ok: false, error: '存在无效收件人' }, { status: 400 });
    }
    resolvedUserEmails = recipientUserIds
      .map((id) => userById.get(id))
      .filter((user): user is NonNullable<typeof user> => Boolean(user && !user.disabled && user.email))
      .map((user) => user.email);
    if (resolvedUserEmails.length !== recipientUserIds.length) {
      return NextResponse.json({ ok: false, error: '存在未启用或无邮箱的收件人' }, { status: 400 });
    }
  }
  const to = resolvedUserEmails.length > 0 ? resolvedUserEmails : directTo;
  if (!to) {
    return NextResponse.json({ ok: false, error: 'to 或 recipientUserIds 必填' }, { status: 400 });
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

  const resolved = await resolveUserEmailSmtp(auth.userId, auth.email, auth.tenantId);

  const result = await sendEmail({
    to,
    subject,
    text,
    html,
    cc: asAddrList(body.cc),
    bcc: asAddrList(body.bcc),
    replyTo: typeof body.replyTo === 'string' ? body.replyTo : undefined,
    attachments,
    smtp: resolved?.smtp,
    imap: resolved?.imap,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error ?? '发送失败' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, messageId: result.messageId });
});

export const POST = withApiLog(POSTApiHandler, { route: '/api/mail/send' });
