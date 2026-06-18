import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import { getStore } from '@/lib/storage/repository';
import { decrypt } from '@/lib/infra/crypto';
import { moveMessages } from '@/lib/integrations/email-tier1';
import type { EmailCredentials } from '@/lib/integrations/email-tier1';

export const dynamic = 'force-dynamic';

function getKvRepo(c: string) {
  const s = getStore();
  return new (Object.getPrototypeOf(s.decisionCards).constructor as any)(c);
}
function buildCreds(userId: string, c: any): EmailCredentials {
  return {
    userId,
    smtp: { host: c.smtpHost, port: c.smtpPort, secure: c.smtpSecure, auth: { user: c.smtpUser, pass: decrypt(c.smtpPassEncrypted) } },
    imap: { host: c.imapHost || c.smtpHost.replace('smtp', 'imap'), port: c.imapPort || 993, secure: c.imapSecure ?? true, auth: { user: c.imapUser || c.smtpUser, pass: c.imapPassEncrypted ? decrypt(c.imapPassEncrypted) : decrypt(c.smtpPassEncrypted) } },
  };
}

// POST /api/mail/move  { uids: number[], from: string, to: string }
export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json();
  const uids: number[] = (Array.isArray(body.uids) ? body.uids : []).map(Number).filter(Boolean);
  const from: string = body.from || 'INBOX';
  const to: string = body.to;
  if (!uids.length || !to) return NextResponse.json({ error: '缺少 uids 或目标文件夹' }, { status: 400 });
  const creds = await getKvRepo('user_email_creds').get(auth.userId);
  if (!creds?.smtpPassEncrypted) return NextResponse.json({ error: '未绑定邮箱' }, { status: 400 });
  await moveMessages(buildCreds(auth.userId, creds), { uids, from, to });
  return NextResponse.json({ ok: true });
});
