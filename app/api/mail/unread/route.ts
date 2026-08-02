/**
 * GET /api/mail/unread
 *
 * 快速返回个人邮箱收件箱未读数 (IMAP STATUS, 不拉正文)。用于导航角标轮询。
 * 未绑定邮箱时返回 { unseen: 0, configured: false }, 不视为错误。
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import { getStore } from '@/lib/storage/repository';
import { decrypt } from '@/lib/infra/crypto';
import { getUnreadCount } from '@/lib/integrations/email-tier1';
import type { EmailCredentials } from '@/lib/integrations/email-tier1';
import { withApiLog } from '@/lib/api-log/with-api-log';

export const dynamic = 'force-dynamic';

function getKvRepo(collection: string) {
  const store = getStore();
  const proto = Object.getPrototypeOf(store.decisionCards);
  return new (proto.constructor as any)(collection);
}

function inferImapHost(smtpHost: string): string {
  const map: Record<string, string> = {
    'smtp.qq.com': 'imap.qq.com',
    'smtp.163.com': 'imap.163.com',
    'smtp.126.com': 'imap.126.com',
    'smtp.gmail.com': 'imap.gmail.com',
    'smtp.exmail.qq.com': 'imap.exmail.qq.com',
    'smtphz.qiye.163.com': 'imaphz.qiye.163.com',
  };
  return map[smtpHost] || smtpHost.replace('smtp', 'imap');
}

function buildEmailCreds(userId: string, creds: any): EmailCredentials {
  return {
    userId,
    smtp: {
      host: creds.smtpHost,
      port: creds.smtpPort,
      secure: creds.smtpSecure,
      auth: { user: creds.smtpUser, pass: decrypt(creds.smtpPassEncrypted) },
    },
    imap: {
      host: creds.imapHost || inferImapHost(creds.smtpHost),
      port: creds.imapPort || 993,
      secure: creds.imapSecure ?? true,
      auth: {
        user: creds.imapUser || creds.smtpUser,
        pass: creds.imapPassEncrypted ? decrypt(creds.imapPassEncrypted) : decrypt(creds.smtpPassEncrypted),
      },
    },
  };
}

const GETApiHandler = withErrorHandler(async (req: NextRequest) => {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const creds = await getKvRepo('user_email_creds').get(auth.userId);
  if (!creds || !creds.smtpPassEncrypted) {
    return NextResponse.json({ unseen: 0, configured: false });
  }

  try {
    const unseen = await getUnreadCount(buildEmailCreds(auth.userId, creds));
    return NextResponse.json({ unseen, configured: true });
  } catch {
    // IMAP 临时不可用时不报错, 返回 0, 避免刷屏
    return NextResponse.json({ unseen: 0, configured: true });
  }
});

export const GET = withApiLog(GETApiHandler, { route: '/api/mail/unread' });
