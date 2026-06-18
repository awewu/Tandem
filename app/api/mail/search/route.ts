import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import { getStore } from '@/lib/storage/repository';
import { decrypt } from '@/lib/infra/crypto';
import { searchMessages } from '@/lib/integrations/email-tier1';
import type { EmailCredentials } from '@/lib/integrations/email-tier1';

export const dynamic = 'force-dynamic';

function getKvRepo(c: string) { const s = getStore(); return new (Object.getPrototypeOf(s.decisionCards).constructor as any)(c); }
function inferImapHost(h: string) { return h.replace('smtp', 'imap'); }
function buildCreds(userId: string, c: any): EmailCredentials {
  return { userId, smtp: { host: c.smtpHost, port: c.smtpPort, secure: c.smtpSecure, auth: { user: c.smtpUser, pass: decrypt(c.smtpPassEncrypted) } }, imap: { host: c.imapHost || inferImapHost(c.smtpHost), port: c.imapPort || 993, secure: c.imapSecure ?? true, auth: { user: c.imapUser || c.smtpUser, pass: c.imapPassEncrypted ? decrypt(c.imapPassEncrypted) : decrypt(c.smtpPassEncrypted) } } };
}

export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') ?? '';
  const folder = searchParams.get('folder') ?? 'INBOX';
  if (!q.trim()) return NextResponse.json({ messages: [] });
  const creds = await getKvRepo('user_email_creds').get(auth.userId);
  if (!creds?.smtpPassEncrypted) return NextResponse.json({ error: '未绑定邮箱' }, { status: 400 });
  const messages = await searchMessages(buildCreds(auth.userId, creds), { query: q, folder, limit: 30 });
  return NextResponse.json({ messages });
});
