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
import { getStore } from '@/lib/storage/repository';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  console.log('[status debug] SMTP_HOST:', JSON.stringify(process.env.SMTP_HOST));
  console.log('[status debug] SMTP_USER:', JSON.stringify(process.env.SMTP_USER));
  console.log('[status debug] SMTP_PASS:', JSON.stringify(process.env.SMTP_PASS));

  const globalConfigured = isEmailConfigured();
  console.log('[status debug] isEmailConfigured:', globalConfigured);

  const globalFrom = globalConfigured
    ? (process.env.SMTP_FROM ?? `Tandem <${process.env.SMTP_USER}>`)
    : null;

  // 查询个人绑定
  let personal: { host: string; port: number; user: string } | null = null;
  try {
    const store = getStore();
    const proto = Object.getPrototypeOf(store.decisionCards);
    const kvRepo = new (proto.constructor as any)('user_email_creds');
    const creds = await kvRepo.get(auth.userId);
    if (creds && creds.smtpHost && creds.smtpUser) {
      personal = {
        host: creds.smtpHost,
        port: creds.smtpPort || 465,
        user: creds.smtpUser,
      };
    }
  } catch {
    // 无个人凭据
  }

  // 当前生效的 SMTP: 优先个人, 再全局
  const effective = personal
    ? { mode: 'personal' as const, host: personal.host, port: personal.port, fromAddress: personal.user }
    : globalConfigured
      ? { mode: 'global' as const, host: process.env.SMTP_HOST!, port: Number(process.env.SMTP_PORT ?? 587), fromAddress: globalFrom! }
      : null;

  return NextResponse.json({
    configured: !!effective,
    effective,
    personal: personal ? { host: personal.host, port: personal.port, user: personal.user } : null,
    global: globalConfigured ? { host: process.env.SMTP_HOST ?? null, port: Number(process.env.SMTP_PORT ?? 587), fromAddress: globalFrom } : null,
    inbound: { configured: false, note: 'IMAP 收件功能 V2 计划中' },
  });
});
