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

const COLLECTION = 'user_email_creds';

interface EmailCreds {
  id: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassEncrypted: string;
  imapHost?: string;
  imapPort?: number;
  imapSecure?: boolean;
  imapUser?: string;
  imapPassEncrypted?: string;
  createdAt: string;
  updatedAt: string;
}

function getKvRepo(collection: string) {
  const store = getStore();
  const proto = Object.getPrototypeOf(store.decisionCards);
  return new (proto.constructor as any)(collection);
}

export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const kvRepo = getKvRepo(COLLECTION);
  const creds = await kvRepo.get(auth.userId) as EmailCreds | null;

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

export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  // 用户只能填写邮箱地址与密码; 主机/端口/SSL 由系统强制 (不接受客户端值).
  const { smtpUser, smtpPass, imapUser, imapPass } = body;

  if (!smtpUser || !smtpPass) {
    return NextResponse.json(
      { error: '邮箱地址与密码必填' },
      { status: 400 },
    );
  }

  // 全局端口配置 (管理员可改), 主机与 SSL 固定.
  const settings = await getAiSettings(auth.tenantId);
  const smtpPort = Number(settings.smtpPort) || DEFAULT_SMTP_PORT;
  const imapPort = Number(settings.imapPort) || DEFAULT_IMAP_PORT;

  const kvRepo = getKvRepo(COLLECTION);
  const existing = await kvRepo.get(auth.userId) as EmailCreds | null;
  const now = new Date().toISOString();

  // IMAP 用户名默认与 SMTP 邮箱一致.
  const resolvedImapUser = imapUser || smtpUser;
  const resolvedImapPass = imapPass || smtpPass;

  const creds: EmailCreds = {
    id: auth.userId,
    smtpHost: FIXED_SMTP_HOST,
    smtpPort,
    smtpSecure: true,
    smtpUser,
    smtpPassEncrypted: encrypt(smtpPass),
    imapHost: FIXED_IMAP_HOST,
    imapPort,
    imapSecure: true,
    imapUser: resolvedImapUser,
    imapPassEncrypted: encrypt(resolvedImapPass),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await kvRepo.create(creds);

  return NextResponse.json({ ok: true, message: '凭据已保存' });
});

export const DELETE = withErrorHandler(async (req: NextRequest) => {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const kvRepo = getKvRepo(COLLECTION);
  await kvRepo.delete(auth.userId);

  return NextResponse.json({ ok: true, message: '凭据已删除' });
});