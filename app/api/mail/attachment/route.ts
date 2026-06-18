import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import { getStore } from '@/lib/storage/repository';
import { decrypt } from '@/lib/infra/crypto';
import { fetchAttachment } from '@/lib/integrations/email-tier1';
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

// GET /api/mail/attachment?uid=123&filename=report.pdf&folder=INBOX
export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(req.url);
  const uid = Number(searchParams.get('uid'));
  const filename = searchParams.get('filename') ?? '';
  const folder = searchParams.get('folder') ?? 'INBOX';
  if (!uid || !filename) return NextResponse.json({ error: '缺少 uid 或 filename' }, { status: 400 });
  const creds = await getKvRepo('user_email_creds').get(auth.userId);
  if (!creds?.smtpPassEncrypted) return NextResponse.json({ error: '未绑定邮箱' }, { status: 400 });
  const result = await fetchAttachment(buildCreds(auth.userId, creds), uid, filename, folder);
  if (!result) return NextResponse.json({ error: '附件不存在' }, { status: 404 });
  const buf = Buffer.from(result.data, 'base64');
  return new NextResponse(buf, {
    headers: {
      'Content-Type': result.contentType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(result.filename)}"`,
      'Content-Length': String(buf.length),
    },
  });
});
