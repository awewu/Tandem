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
}

let transporter: nodemailer.Transporter | null = null;
let transporterKey = '';

async function resolveSmtpConfig() {
  try {
    const { getAiSettings } = await import('@/lib/settings/ai-settings');
    const s = await getAiSettings();
    return {
      host: s.smtpHost ?? process.env.SMTP_HOST ?? '',
      port: Number(s.smtpPort ?? process.env.SMTP_PORT ?? 587),
      secure: (s.smtpSecure ?? process.env.SMTP_SECURE) === '1',
      user: s.smtpUser ?? process.env.SMTP_USER ?? '',
      pass: s.smtpPass ?? process.env.SMTP_PASS ?? '',
      from: s.smtpFrom ?? process.env.SMTP_FROM ?? '',
    };
  } catch {
    return {
      host: process.env.SMTP_HOST ?? '',
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === '1',
      user: process.env.SMTP_USER ?? '',
      pass: process.env.SMTP_PASS ?? '',
      from: process.env.SMTP_FROM ?? '',
    };
  }
}

export async function isEmailConfigured(): Promise<boolean> {
  const cfg = await resolveSmtpConfig();
  return !!(cfg.host && cfg.user && cfg.pass);
}

async function getTransporter(): Promise<nodemailer.Transporter | null> {
  const cfg = await resolveSmtpConfig();
  if (!cfg.host || !cfg.user || !cfg.pass) return null;
  const key = `${cfg.host}:${cfg.port}:${cfg.user}`;
  if (transporter && key === transporterKey) return transporter;
  transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure || cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  transporterKey = key;
  return transporter;
}

export async function sendEmail(input: SendEmailInput): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const t = await getTransporter();
  if (!t) {
    logger.debug({ to: input.to }, '[email] not configured, skipping');
    return { ok: false, error: 'SMTP not configured' };
  }
  const cfg = await resolveSmtpConfig();
  try {
    const info = await t.sendMail({
      from: cfg.from || `Tandem <${cfg.user}>`,
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
    logger.info({ messageId: info.messageId, to: input.to }, '[email] sent');
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    logger.warn({ err: (err as Error).message, to: input.to }, '[email] send failed');
    return { ok: false, error: (err as Error).message };
  }
}

/** 测试发件配置 */
export async function verifyEmailConfig(): Promise<boolean> {
  const t = await getTransporter();
  if (!t) return false;
  try {
    await t.verify();
    return true;
  } catch {
    return false;
  }
}
