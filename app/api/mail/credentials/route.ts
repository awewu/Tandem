/**
 * POST /api/mail/credentials — 保存用户个人 SMTP/IMAP 凭据
 * GET  /api/mail/credentials — 获取用户凭据（密码脱敏）
 * DELETE /api/mail/credentials — 删除用户凭据
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import { getStore } from '@/lib/storage/repository';
import { decrypt, encrypt } from '@/lib/infra/crypto';
import { getAiSettings } from '@/lib/settings/ai-settings';
import { neteaseCalendarSyncStateId } from '@/lib/calendar/sync-state';
import {
  FIXED_SMTP_HOST,
  FIXED_IMAP_HOST,
  DEFAULT_SMTP_PORT,
  DEFAULT_IMAP_PORT,
} from '@/lib/infra/email';
import { withApiLog } from '@/lib/api-log/with-api-log';
import type { PersonalEmailCredentials } from '@/lib/email/global-email-config';
import { verifyPersonalEmailCredentials } from '@/lib/mail/personal-email-verification';

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
    verifiedAt: creds.verifiedAt,
  });
});

export const GET = withApiLog(GETApiHandler, { route: '/api/mail/credentials' });

const POSTApiHandler = withErrorHandler(async (req: NextRequest) => {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  // 用户只能填写邮箱地址与密码; 主机/端口/SSL 由系统强制 (不接受客户端值).
  const smtpUser = typeof body.smtpUser === 'string' ? body.smtpUser.trim() : '';
  const smtpPass = typeof body.smtpPass === 'string' ? body.smtpPass : '';
  const imapUser = typeof body.imapUser === 'string' ? body.imapUser.trim() : '';
  const imapPass = typeof body.imapPass === 'string' ? body.imapPass : '';
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
  const resolvedSmtpPass = smtpPass || (existing?.smtpPassEncrypted ? decrypt(existing.smtpPassEncrypted) : '');
  const resolvedImapPass = imapPass
    || smtpPass
    || (existing?.imapPassEncrypted ? decrypt(existing.imapPassEncrypted) : resolvedSmtpPass);

  const verificationError = await verifyPersonalEmailCredentials({
    smtp: {
      host: FIXED_SMTP_HOST,
      port: smtpPort,
      secure: true,
      user: smtpUser,
      pass: resolvedSmtpPass,
    },
    imap: {
      host: FIXED_IMAP_HOST,
      port: imapPort,
      secure: true,
      user: resolvedImapUser,
      pass: resolvedImapPass,
    },
  });
  if (verificationError) {
    return NextResponse.json({ error: verificationError }, { status: 400 });
  }

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
    verifiedAt: now,
  };

  await kvRepo.create(creds);

  return NextResponse.json({ ok: true, message: '邮箱账号已验证并保存' });
});

export const POST = withApiLog(POSTApiHandler, { route: '/api/mail/credentials' });

const DELETEApiHandler = withErrorHandler(async (req: NextRequest) => {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  await getStore().userEmailCredentials.delete(auth.userId);
  const syncStateRepo = getStore().calendarSyncStates;
  const syncState = await syncStateRepo.get(neteaseCalendarSyncStateId(auth.userId));
  if (syncState?.autoEnabled) {
    await syncStateRepo.update(syncState.id, {
      autoEnabled: false,
      status: 'idle',
      lastError: '邮箱凭据已删除，网易日程自动同步已停止。',
      updatedAt: new Date().toISOString(),
    });
  }

  return NextResponse.json({ ok: true, message: '凭据已删除' });
});

export const DELETE = withApiLog(DELETEApiHandler, { route: '/api/mail/credentials' });
