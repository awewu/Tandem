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

interface SendEmailInput {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
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
  if (!t) {
    logger.debug({ to: input.to }, '[email] not configured, skipping');
    return { ok: false, error: 'SMTP not configured' };
  }
  try {
    const info = await t.sendMail({
      from: process.env.SMTP_FROM ?? `Tandem <${process.env.SMTP_USER}>`,
      to: input.to,
      cc: input.cc,
      bcc: input.bcc,
      replyTo: input.replyTo,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    logger.info({ messageId: info.messageId, to: input.to }, '[email] sent');
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
