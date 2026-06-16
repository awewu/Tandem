/**
 * GET /api/mail/status
 *
 * Returns whether SMTP outbound is configured (env-driven via lib/infra/email)
 * and the effective From address. Used by /mail and /settings/email pages.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import { isEmailConfigured } from '@/lib/infra/email';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const configured = await isEmailConfigured();
  const fromAddress = configured
    ? (process.env.SMTP_FROM ?? `Tandem <${process.env.SMTP_USER}>`)
    : null;
  const host = configured ? process.env.SMTP_HOST ?? null : null;
  const port = configured ? Number(process.env.SMTP_PORT ?? 587) : null;
  return NextResponse.json({
    configured,
    outbound: { host, port, fromAddress },
    inbound: { configured: false, note: 'IMAP 收件功能 V2 计划中' },
  });
});
