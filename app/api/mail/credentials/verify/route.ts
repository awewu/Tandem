import { NextResponse, type NextRequest } from 'next/server';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import { neteaseCalendarSyncStateId } from '@/lib/calendar/sync-state';
import { getAiSettings } from '@/lib/settings/ai-settings';
import { decrypt } from '@/lib/infra/crypto';
import {
  DEFAULT_IMAP_PORT,
  DEFAULT_SMTP_PORT,
  FIXED_IMAP_HOST,
  FIXED_SMTP_HOST,
} from '@/lib/infra/email';
import { verifyPersonalEmailCredentials } from '@/lib/mail/personal-email-verification';
import { getStore } from '@/lib/storage/repository';

export const dynamic = 'force-dynamic';

const POSTApiHandler = withErrorHandler(async (req: NextRequest) => {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const smtpUser = typeof body.smtpUser === 'string' ? body.smtpUser.trim() : '';
  const smtpPass = typeof body.smtpPass === 'string' ? body.smtpPass : '';
  const imapUser = typeof body.imapUser === 'string' ? body.imapUser.trim() : '';
  const imapPass = typeof body.imapPass === 'string' ? body.imapPass : '';
  const existing = await getStore().userEmailCredentials.get(auth.userId);

  const resolvedSmtpUser = smtpUser || existing?.smtpUser || '';
  if (!resolvedSmtpUser) {
    return NextResponse.json({ error: '请先输入邮箱地址。' }, { status: 400 });
  }
  if (!smtpPass && !existing?.smtpPassEncrypted) {
    return NextResponse.json({ error: '请先输入邮箱密码或授权码。' }, { status: 400 });
  }

  const settings = await getAiSettings(auth.tenantId);
  const smtpPort = Number(settings.smtpPort) || DEFAULT_SMTP_PORT;
  const imapPort = Number(settings.imapPort) || DEFAULT_IMAP_PORT;
  const resolvedSmtpPass = smtpPass || decrypt(existing!.smtpPassEncrypted);
  const resolvedImapUser = imapUser || existing?.imapUser || resolvedSmtpUser;
  const resolvedImapPass = imapPass
    || smtpPass
    || (existing?.imapPassEncrypted ? decrypt(existing.imapPassEncrypted) : resolvedSmtpPass);

  const verificationError = await verifyPersonalEmailCredentials({
    smtp: {
      host: FIXED_SMTP_HOST,
      port: smtpPort,
      secure: true,
      user: resolvedSmtpUser,
      pass: resolvedSmtpPass,
    },
    imap: {
      host: FIXED_IMAP_HOST,
      port: imapPort,
      secure: true,
      user: resolvedImapUser,
      pass: resolvedImapPass,
    },
  });

  if (verificationError) {
    return NextResponse.json({ error: verificationError }, { status: 400 });
  }

  const syncState = await getStore().calendarSyncStates.get(neteaseCalendarSyncStateId(auth.userId));
  return NextResponse.json({
    ok: true,
    smtp: { host: FIXED_SMTP_HOST, port: smtpPort, user: resolvedSmtpUser },
    imap: { host: FIXED_IMAP_HOST, port: imapPort, user: resolvedImapUser },
    verifiedAt: new Date().toISOString(),
    calendarAutoSyncEnabled: syncState?.autoEnabled === true,
  });
});

export const POST = withApiLog(POSTApiHandler, { route: '/api/mail/credentials/verify' });
