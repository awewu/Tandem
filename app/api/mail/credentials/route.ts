/**
 * POST /api/mail/credentials — 保存用户个人 SMTP/IMAP 凭据
 * GET  /api/mail/credentials — 获取用户凭据（密码脱敏）
 * DELETE /api/mail/credentials — 删除用户凭据
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import { getStore } from '@/lib/storage/repository';
import { encrypt } from '@/lib/infra/crypto';
import { getAiSettings } from '@/lib/settings/ai-settings';
import {
  FIXED_SMTP_HOST,
  FIXED_IMAP_HOST,
  DEFAULT_SMTP_PORT,
  DEFAULT_IMAP_PORT,
} from '@/lib/infra/email';
import { withApiLog } from '@/lib/api-log/with-api-log';
import type { PersonalEmailCredentials } from '@/lib/email/global-email-config';

const GETApiHandler = withErrorHandler(async (req: NextRequest) => {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const creds = await getStore().userEmailCredentials.get(auth.userId);

  if (!creds) {
    return NextResponse.json({ configured: false });
  }

  return NextResponse.json({
    configured: true,
    smtp: {
      host: creds.smtpHost,
      port: creds.smtpPort,
      secure: creds.smtpSecure,
      user: creds.smtpUser,
    },
    imap: creds.imapHost ? {
      host: creds.imapHost,
      port: creds.imapPort,
      secure: creds.imapSecure,
      user: creds.imapUser,
    } : null,
    updatedAt: creds.updatedAt,
  });
});

export const GET = withApiLog(GETApiHandler, { route: '/api/mail/credentials' });

const POSTApiHandler = withErrorHandler(async (req: NextRequest) => {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  // 用户只能填写邮箱地址与密码; 主机/端口/SSL 由系统强制 (不接受客户端值).
  const { smtpUser, smtpPass, imapUser, imapPass } = body;
  const kvRepo = getStore().userEmailCredentials;
  const existing = await kvRepo.get(auth.userId);

  if (!smtpUser || (!smtpPass && !existing?.smtpPassEncrypted)) {
    return NextResponse.json(
      { error: '邮箱地址与密码必填' },
      { status: 400 },
    );
  }

  // 全局端口配置 (管理员可改), 主机与 SSL 固定.
  const settings = await getAiSettings(auth.tenantId);
  const smtpPort = Number(settings.smtpPort) || DEFAULT_SMTP_PORT;
  const imapPort = Number(settings.imapPort) || DEFAULT_IMAP_PORT;

  const now = new Date().toISOString();

  // IMAP 用户名默认与 SMTP 邮箱一致.
  const resolvedImapUser = imapUser || smtpUser;
  const resolvedImapPass = imapPass || smtpPass;

  const creds: PersonalEmailCredentials = {
    id: auth.userId,
    smtpHost: FIXED_SMTP_HOST,
    smtpPort,
    smtpSecure: true,
    smtpUser,
    smtpPassEncrypted: smtpPass ? encrypt(smtpPass) : existing!.smtpPassEncrypted,
    imapHost: FIXED_IMAP_HOST,
    imapPort,
    imapSecure: true,
    imapUser: resolvedImapUser,
    imapPassEncrypted: imapPass || smtpPass
      ? encrypt(resolvedImapPass)
      : (existing?.imapPassEncrypted ?? existing!.smtpPassEncrypted),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await kvRepo.create(creds);

  return NextResponse.json({ ok: true, message: '凭据已保存' });
});

export const POST = withApiLog(POSTApiHandler, { route: '/api/mail/credentials' });

const DELETEApiHandler = withErrorHandler(async (req: NextRequest) => {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  await getStore().userEmailCredentials.delete(auth.userId);

  return NextResponse.json({ ok: true, message: '凭据已删除' });
});

export const DELETE = withApiLog(DELETEApiHandler, { route: '/api/mail/credentials' });
