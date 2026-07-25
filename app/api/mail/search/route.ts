import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import { getStore } from '@/lib/storage/repository';
import { decrypt } from '@/lib/infra/crypto';
import { searchMessagePage } from '@/lib/integrations/email-tier1';
import type { EmailCredentials } from '@/lib/integrations/email-tier1';
import { withApiLog } from '@/lib/api-log/with-api-log';

export const dynamic = 'force-dynamic';

function getKvRepo(c: string) { const s = getStore(); return new (Object.getPrototypeOf(s.decisionCards).constructor as any)(c); }
function inferImapHost(h: string) { return h.replace('smtp', 'imap'); }
function buildCreds(userId: string, c: any): EmailCredentials {
  return { userId, smtp: { host: c.smtpHost, port: c.smtpPort, secure: c.smtpSecure, auth: { user: c.smtpUser, pass: decrypt(c.smtpPassEncrypted) } }, imap: { host: c.imapHost || inferImapHost(c.smtpHost), port: c.imapPort || 993, secure: c.imapSecure ?? true, auth: { user: c.imapUser || c.smtpUser, pass: c.imapPassEncrypted ? decrypt(c.imapPassEncrypted) : decrypt(c.smtpPassEncrypted) } } };
}

const GETApiHandler = withErrorHandler(async (req: NextRequest) => {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') ?? '';
  const folder = searchParams.get('folder') ?? 'INBOX';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 30));
  if (!q.trim()) return NextResponse.json({ messages: [] });
  const creds = await getKvRepo('user_email_creds').get(auth.userId);
  if (!creds?.smtpPassEncrypted) return NextResponse.json({ error: '未绑定邮箱' }, { status: 400 });
  const isStarred = folder === 'starred';
  const result = await searchMessagePage(buildCreds(auth.userId, creds), {
    query: q,
    folder: isStarred ? 'INBOX' : folder,
    page,
    limit,
  });
  const visibleMessages = isStarred
    ? result.messages.filter((message) => message.flags.includes('\\Flagged'))
    : result.messages;
  return NextResponse.json({
    messages: visibleMessages,
    total: result.total,
    hasMore: isStarred ? false : result.hasMore,
    page: result.page,
    pageSize: result.pageSize,
  });
});

export const GET = withApiLog(GETApiHandler, { route: '/api/mail/search' });
