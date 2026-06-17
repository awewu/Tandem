/**
 * GET /api/mail/inbox
 *
 * 拉取用户个人邮箱的收件箱邮件列表 (IMAP)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import { getStore } from '@/lib/storage/repository';
import { decrypt } from '@/lib/infra/crypto';
import { fetchInbox, updateMessageFlags, deleteMessages, saveDraft } from '@/lib/integrations/email-tier1';
import type { EmailCredentials } from '@/lib/integrations/email-tier1';

function getKvRepo(collection: string) {
  const store = getStore();
  const proto = Object.getPrototypeOf(store.decisionCards);
  return new (proto.constructor as any)(collection);
}

export const dynamic = 'force-dynamic';

function buildEmailCreds(userId: string, creds: any): EmailCredentials {
  return {
    userId,
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
}

export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const kvRepo = getKvRepo('user_email_creds');
  const creds = await kvRepo.get(auth.userId);
  if (!creds || !creds.smtpPassEncrypted) {
    return NextResponse.json({ error: '未绑定邮箱，请先配置个人邮箱' }, { status: 400 });
  }

  const emailCreds = buildEmailCreds(auth.userId, creds);

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 20));
  const folder = searchParams.get('folder') || 'INBOX';
  const flaggedOnly = searchParams.get('flagged') === 'true' || folder === 'starred';
  // starred 视图实际查询 INBOX 的 flagged 邮件，不是独立文件夹
  const apiFolder = folder === 'starred' ? 'INBOX' : folder;

  try {
    const result = await fetchInbox(emailCreds, { page, limit, folder: apiFolder, flaggedOnly });
    console.log('[inbox api] fetched', result.messages.length, 'messages, total:', result.total);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[inbox api] fetch failed:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'IMAP 连接失败' },
      { status: 502 }
    );
  }
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const uids = Array.isArray(body.uids) ? body.uids.map(Number).filter(Boolean) : [];
  if (uids.length === 0) {
    return NextResponse.json({ error: '缺少邮件 UID' }, { status: 400 });
  }

  const kvRepo = getKvRepo('user_email_creds');
  const creds = await kvRepo.get(auth.userId);
  if (!creds || !creds.smtpPassEncrypted) {
    return NextResponse.json({ error: '未绑定邮箱' }, { status: 400 });
  }

  const emailCreds = buildEmailCreds(auth.userId, creds);
  const folder = body.folder || 'INBOX';
  const seen = typeof body.seen === 'boolean' ? body.seen : undefined;
  const flagged = typeof body.flagged === 'boolean' ? body.flagged : undefined;

  await updateMessageFlags(emailCreds, { uids, folder, seen, flagged });
  return NextResponse.json({ ok: true });
});

export const PUT = withErrorHandler(async (req: NextRequest) => {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const to = Array.isArray(body.to) ? body.to.filter((s: string) => s.trim()) : [];
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const text = typeof body.text === 'string' ? body.text : '';
  const cc = Array.isArray(body.cc) ? body.cc.filter((s: string) => s.trim()) : undefined;

  if (!subject && !text) {
    return NextResponse.json({ error: '主题或正文至少填一个' }, { status: 400 });
  }

  const kvRepo = getKvRepo('user_email_creds');
  const creds = await kvRepo.get(auth.userId);
  if (!creds || !creds.smtpPassEncrypted) {
    return NextResponse.json({ error: '未绑定邮箱' }, { status: 400 });
  }

  const emailCreds = buildEmailCreds(auth.userId, creds);
  const uid = await saveDraft(emailCreds, { to, subject, text, cc });
  return NextResponse.json({ ok: true, uid });
});

export const DELETE = withErrorHandler(async (req: NextRequest) => {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const uidStr = searchParams.get('uids') || '';
  const uids = uidStr.split(',').map(Number).filter(Boolean);
  if (uids.length === 0) {
    return NextResponse.json({ error: '缺少邮件 UID' }, { status: 400 });
  }

  const kvRepo = getKvRepo('user_email_creds');
  const creds = await kvRepo.get(auth.userId);
  if (!creds || !creds.smtpPassEncrypted) {
    return NextResponse.json({ error: '未绑定邮箱' }, { status: 400 });
  }

  const emailCreds = buildEmailCreds(auth.userId, creds);
  const folder = searchParams.get('folder') || 'INBOX';

  await deleteMessages(emailCreds, { uids, folder });
  return NextResponse.json({ ok: true });
});

/**
 * 根据 SMTP 主机自动推断 IMAP 主机
 */
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