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
  const {
    smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass,
    imapHost, imapPort, imapSecure, imapUser, imapPass,
  } = body;

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
    return NextResponse.json(
      { error: 'SMTP 主机、端口、用户名、密码均必填' },
      { status: 400 },
    );
  }

  const kvRepo = getKvRepo(COLLECTION);
  const existing = await kvRepo.get(auth.userId) as EmailCreds | null;
  const now = new Date().toISOString();

  const creds: EmailCreds = {
    id: auth.userId,
    smtpHost,
    smtpPort: Number(smtpPort),
    smtpSecure: !!smtpSecure,
    smtpUser,
    smtpPassEncrypted: encrypt(smtpPass),
    imapHost: imapHost || undefined,
    imapPort: imapPort ? Number(imapPort) : undefined,
    imapSecure: !!imapSecure,
    imapUser: imapUser || undefined,
    imapPassEncrypted: imapPass ? encrypt(imapPass) : undefined,
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