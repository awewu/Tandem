/**
 * Email · SMTP 发件 (V1 仅出站, 收件 V2 用 IMAP)
 *
 * 配置:
 *   SMTP_HOST   ·  smtp.example.com
 *   SMTP_PORT   ·  587 (STARTTLS) | 465 (SSL)
 *   SMTP_USER   ·  邮箱地址
 *   SMTP_PASS   ·  邮箱密码或应用专用密码
 *   SMTP_FROM   ·  发件人 "Tandem <noreply@example.com>"
 *
 * 用法:
 *   import { sendEmail } from '@/lib/infra/email';
 *   await sendEmail({ to: 'a@b.com', subject: '...', html: '...' });
 */

import nodemailer from 'nodemailer';
import { logger } from './logger';

/**
 * 企业邮箱固定主机 (网易企业邮箱 · 杭州节点).
 * 用户不可修改; 端口由管理员全局配置 (aiSettings.smtpPort / imapPort).
 */
export const FIXED_SMTP_HOST = 'smtphz.qiye.163.com';
export const FIXED_IMAP_HOST = 'imaphz.qiye.163.com';
export const DEFAULT_SMTP_PORT = 465;
export const DEFAULT_IMAP_PORT = 993;

interface AttachmentInput {
  filename: string;
  content: string | Buffer;
  contentType?: string;
}

interface SendEmailInput {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  attachments?: AttachmentInput[];
  /** V2 个人 SMTP 凭据 (优先级高于全局 env) */
  personalSmtp?: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
  };
}

let transporter: nodemailer.Transporter | null = null;

export function isEmailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;
  if (!isEmailConfigured()) return null;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST!,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === '1' || Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!,
    },
  });
  return transporter;
}

export async function sendEmail(input: SendEmailInput): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const t = getTransporter();
  try {
    let transporter: nodemailer.Transporter;

    if (input.personalSmtp) {
      transporter = nodemailer.createTransport({
        host: input.personalSmtp.host,
        port: input.personalSmtp.port,
        secure: input.personalSmtp.secure,
        auth: {
          user: input.personalSmtp.user,
          pass: input.personalSmtp.pass,
        },
      });
    } else if (t) {
      transporter = t;
    } else {
      logger.debug({ to: input.to }, '[email] not configured, skipping');
      return { ok: false, error: 'SMTP not configured' };
    }

    const fromAddress = input.personalSmtp
      ? input.personalSmtp.user
      : (process.env.SMTP_FROM ?? `Tandem <${process.env.SMTP_USER}>`);

    const info = await transporter.sendMail({
      from: fromAddress,
      to: input.to,
      cc: input.cc,
      bcc: input.bcc,
      replyTo: input.replyTo,
      subject: input.subject,
      text: input.text,
      html: input.html,
      attachments: input.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });
    logger.info({ messageId: info.messageId, to: input.to, personal: !!input.personalSmtp }, '[email] sent');
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    logger.warn({ err: (err as Error).message, to: input.to }, '[email] send failed');
    return { ok: false, error: (err as Error).message };
  }
}

/** 测试发件配置 */
export async function verifyEmailConfig(): Promise<boolean> {
  const t = getTransporter();
  if (!t) return false;
  try {
    await t.verify();
    return true;
  } catch {
    return false;
  }
}