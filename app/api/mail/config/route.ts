/**
 * GET /api/mail/config  — 邮箱全局配置 (固定主机 + 管理员可配端口), 所有登录用户可读
 * PUT /api/mail/config  — 更新全局 SMTP/IMAP 端口 (owner/admin only)
 *
 * 主机与 SSL 固定不可改:
 *   SMTP = smtphz.qiye.163.com (SSL)
 *   IMAP = imaphz.qiye.163.com (SSL)
 * 端口由管理员配置, 存于 aiSettings.smtpPort / aiSettings.imapPort.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { getAiSettings, upsertAiSettings } from '@/lib/settings/ai-settings';
import {
  FIXED_SMTP_HOST,
  FIXED_IMAP_HOST,
  DEFAULT_SMTP_PORT,
  DEFAULT_IMAP_PORT,
} from '@/lib/infra/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAdmin(roles: string[]): boolean {
  return roles.some((r) => ['owner', 'admin'].includes(r));
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const settings = await getAiSettings(auth.tenantId);
  const smtpPort = Number(settings.smtpPort) || DEFAULT_SMTP_PORT;
  const imapPort = Number(settings.imapPort) || DEFAULT_IMAP_PORT;

  return NextResponse.json({
    smtpHost: FIXED_SMTP_HOST,
    imapHost: FIXED_IMAP_HOST,
    smtpPort,
    imapPort,
    smtpSecure: true,
    imapSecure: true,
    isAdmin: isAdmin(auth.roles),
  });
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!isAdmin(auth.roles)) {
    return NextResponse.json({ error: '仅管理员可修改' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const patch: { smtpPort?: string; imapPort?: string } = {};

  if (body.smtpPort !== undefined && body.smtpPort !== '') {
    const p = Number(body.smtpPort);
    if (!Number.isInteger(p) || p < 1 || p > 65535) {
      return NextResponse.json({ error: 'SMTP 端口无效' }, { status: 400 });
    }
    patch.smtpPort = String(p);
  }
  if (body.imapPort !== undefined && body.imapPort !== '') {
    const p = Number(body.imapPort);
    if (!Number.isInteger(p) || p < 1 || p > 65535) {
      return NextResponse.json({ error: 'IMAP 端口无效' }, { status: 400 });
    }
    patch.imapPort = String(p);
  }

  await upsertAiSettings(patch, auth.userId, auth.tenantId);

  const settings = await getAiSettings(auth.tenantId);
  return NextResponse.json({
    smtpHost: FIXED_SMTP_HOST,
    imapHost: FIXED_IMAP_HOST,
    smtpPort: Number(settings.smtpPort) || DEFAULT_SMTP_PORT,
    imapPort: Number(settings.imapPort) || DEFAULT_IMAP_PORT,
    smtpSecure: true,
    imapSecure: true,
    isAdmin: true,
  });
}
