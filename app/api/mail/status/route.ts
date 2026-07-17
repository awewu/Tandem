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
import { withApiLog } from '@/lib/api-log/with-api-log';
import { listGlobalEmailConfigs, selectGlobalEmailConfig } from '@/lib/email/global-email-config';

export const dynamic = 'force-dynamic';

const GETApiHandler = withErrorHandler(async (req: NextRequest) => {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const globalConfigured = isEmailConfigured();
  const globalFrom = globalConfigured
    ? (process.env.SMTP_FROM ?? `Tandem <${process.env.SMTP_USER}>`)
    : null;

  // 查询个人绑定
  let personal: { host: string; port: number; user: string } | null = null;
  try {
    const creds = await getStore().userEmailCredentials.get(auth.userId);
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

  const selectedGlobal = selectGlobalEmailConfig(
    await listGlobalEmailConfigs(auth.tenantId),
    auth.email,
  );
  const global = selectedGlobal
    ? {
        id: selectedGlobal.id,
        name: selectedGlobal.name,
        domains: selectedGlobal.domains,
        host: selectedGlobal.smtpHost,
        port: selectedGlobal.smtpPort,
        fromAddress: selectedGlobal.smtpUser,
      }
    : globalConfigured
      ? {
          id: 'env',
          name: '环境变量 SMTP',
          domains: [],
          host: process.env.SMTP_HOST!,
          port: Number(process.env.SMTP_PORT ?? 587),
          fromAddress: globalFrom!,
        }
      : null;

  // 当前生效的 SMTP: 优先个人, 再按域名匹配/默认全局配置.
  const effective = personal
    ? { mode: 'personal' as const, host: personal.host, port: personal.port, fromAddress: personal.user }
    : global
      ? { mode: 'global' as const, host: global.host, port: global.port, fromAddress: global.fromAddress }
      : null;

  return NextResponse.json({
    configured: !!effective,
    effective,
    personal: personal ? { host: personal.host, port: personal.port, user: personal.user } : null,
    global,
    inbound: { configured: false, note: 'IMAP 收件功能 V2 计划中' },
  });
});

export const GET = withApiLog(GETApiHandler, { route: '/api/mail/status' });
