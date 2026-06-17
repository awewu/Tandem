import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import { isEmailConfigured, sendEmail } from '@/lib/infra/email';
import { getStore } from '@/lib/storage/repository';
import { decrypt } from '@/lib/infra/crypto';

interface Body {
  to?: unknown;
  subject?: unknown;
  text?: unknown;
  html?: unknown;
  cc?: unknown;
  bcc?: unknown;
  replyTo?: unknown;
  attachments?: unknown;
}

function asAddrList(v: unknown): string[] | string | undefined {
  if (typeof v === 'string') return v.trim() || undefined;
  if (Array.isArray(v)) {
    const list = v.filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
    return list.length > 0 ? list : undefined;
  }
  return undefined;
}

function getKvRepo(collection: string) {
  const store = getStore();
  const proto = Object.getPrototypeOf(store.decisionCards);
  return new (proto.constructor as any)(collection);
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  console.log('========== [邮件发送调试] ==========');
  console.log('[邮件发送调试] 用户 ID:', auth.userId);

  const body = (await req.json().catch(() => ({}))) as Body;
  const to = asAddrList(body.to);
  if (!to) {
    return NextResponse.json({ ok: false, error: 'to 必填 (字符串或字符串数组)' }, { status: 400 });
  }
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  if (!subject) {
    return NextResponse.json({ ok: false, error: 'subject 必填' }, { status: 400 });
  }
  const text = typeof body.text === 'string' ? body.text : undefined;
  const html = typeof body.html === 'string' ? body.html : undefined;
  if (!text && !html) {
    return NextResponse.json({ ok: false, error: 'text 与 html 至少填一个' }, { status: 400 });
  }

  const attachments = Array.isArray(body.attachments)
    ? body.attachments
        .filter((a: unknown): a is Record<string, unknown> => typeof a === 'object' && a !== null)
        .map((a) => ({
          filename: typeof a.filename === 'string' ? a.filename : 'attachment',
          content: typeof a.content === 'string' ? a.content : JSON.stringify(a.content),
          contentType: typeof a.contentType === 'string' ? a.contentType : undefined,
        }))
    : undefined;

  // V2: 优先使用用户个人 SMTP 凭据
  let personalSmtp: { host: string; port: number; secure: boolean; user: string; pass: string } | undefined;
  try {
    const kvRepo = getKvRepo('user_email_creds');
    const creds = await kvRepo.get(auth.userId);
    console.log('[邮件发送调试] 数据库凭据查询结果:', creds ? '找到凭据' : '未找到凭据');
    if (creds) {
      console.log('[邮件发送调试] 凭据详情:');
      console.log('  - smtpHost:', creds.smtpHost);
      console.log('  - smtpPort:', creds.smtpPort);
      console.log('  - smtpSecure:', creds.smtpSecure);
      console.log('  - smtpUser:', creds.smtpUser);
      console.log('  - smtpPassEncrypted:', creds.smtpPassEncrypted ? '已加密' : '空');
    }
    if (creds && creds.smtpPassEncrypted) {
      const decryptedPass = decrypt(creds.smtpPassEncrypted);
      personalSmtp = {
        host: creds.smtpHost,
        port: creds.smtpPort,
        secure: creds.smtpSecure,
        user: creds.smtpUser,
        pass: decryptedPass,
      };
      console.log('[邮件发送调试] 解密后的密码:', decryptedPass);
      console.log('[邮件发送调试] 使用个人 SMTP 凭据');
    }
  } catch (err) {
    console.log('[邮件发送调试] 读取个人凭据失败，降级到全局 SMTP:', (err as Error).message);
  }

  if (!personalSmtp) {
    console.log('[邮件发送调试] 未使用个人凭据，检查全局 SMTP 配置');
    console.log('[邮件发送调试] SMTP_HOST:', process.env.SMTP_HOST);
    console.log('[邮件发送调试] SMTP_PORT:', process.env.SMTP_PORT);
    console.log('[邮件发送调试] SMTP_USER:', process.env.SMTP_USER);
    console.log('[邮件发送调试] SMTP_PASS:', process.env.SMTP_PASS ? '***已配置***' : '未配置');
  }

  if (!personalSmtp && !isEmailConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'SMTP 未配置 — 请绑定个人邮箱或联系管理员设置全局 SMTP' },
      { status: 503 },
    );
  }

  console.log('[邮件发送调试] 最终使用的 SMTP 配置:');
  if (personalSmtp) {
    console.log('  - 模式: 个人 SMTP');
    console.log('  - host:', personalSmtp.host);
    console.log('  - port:', personalSmtp.port);
    console.log('  - secure:', personalSmtp.secure);
    console.log('  - user:', personalSmtp.user);
    console.log('  - pass:', personalSmtp.pass);
  } else {
    console.log('  - 模式: 全局 SMTP');
    console.log('  - host:', process.env.SMTP_HOST);
    console.log('  - port:', process.env.SMTP_PORT);
    console.log('  - user:', process.env.SMTP_USER);
  }
  console.log('====================================');

  const result = await sendEmail({
    to,
    subject,
    text,
    html,
    cc: asAddrList(body.cc),
    bcc: asAddrList(body.bcc),
    replyTo: typeof body.replyTo === 'string' ? body.replyTo : undefined,
    attachments,
    personalSmtp,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error ?? '发送失败' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, messageId: result.messageId });
});