/**
 * GET /api/mail/inbox/[uid]
 *
 * 获取单封邮件详情 (含正文和附件)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import { getStore } from '@/lib/storage/repository';
import { decrypt } from '@/lib/infra/crypto';
import { fetchMessageByUid } from '@/lib/integrations/email-tier1';
import type { EmailCredentials } from '@/lib/integrations/email-tier1';

function getKvRepo(collection: string) {
  const store = getStore();
  const proto = Object.getPrototypeOf(store.decisionCards);
  return new (proto.constructor as any)(collection);
}

export const dynamic = 'force-dynamic';

export const GET = withErrorHandler(async (req: NextRequest, { params }: { params: { uid: string } }) => {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const uid = Number(params.uid);
  if (!uid || isNaN(uid)) {
    return NextResponse.json({ error: '无效的邮件 UID' }, { status: 400 });
  }

  const kvRepo = getKvRepo('user_email_creds');
  const creds = await kvRepo.get(auth.userId);
  if (!creds || !creds.smtpPassEncrypted) {
    return NextResponse.json({ error: '未绑定邮箱' }, { status: 400 });
  }

  const emailCreds: EmailCredentials = {
    userId: auth.userId,
    smtp: {
      host: creds.smtpHost,
      port: creds.smtpPort,
      secure: creds.smtpSecure,
      auth: {
        user: creds.smtpUser,
        pass: decrypt(creds.smtpPassEncrypted),
      },
    },
    imap: {
      host: creds.imapHost || inferImapHost(creds.smtpHost),
      port: creds.imapPort || 993,
      secure: creds.imapSecure ?? true,
      auth: {
        user: creds.imapUser || creds.smtpUser,
        pass: creds.imapPassEncrypted
          ? decrypt(creds.imapPassEncrypted)
          : decrypt(creds.smtpPassEncrypted),
      },
    },
  };

  const { searchParams } = new URL(req.url);
  const folder = searchParams.get('folder') || 'INBOX';

  const message = await fetchMessageByUid(emailCreds, uid, folder);
  if (!message) {
    return NextResponse.json({ error: '邮件不存在' }, { status: 404 });
  }
  return NextResponse.json(message);
});

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