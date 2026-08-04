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
import { appendSentMessage } from '@/lib/integrations/email-tier1';

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

export interface EmailSmtpTransport {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

export interface EmailImapTransport {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

interface SendEmailInput {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  cc?: string | string[];
  bcc?: string | string[];
  from?: string;
  replyTo?: string;
  attachments?: AttachmentInput[];
  /** 已解析的个人或全局 SMTP 凭据 (优先级高于 env). */
  smtp?: EmailSmtpTransport;
  /** 已解析的 IMAP 凭据; SMTP 成功后用于尽力写入已发送文件夹. */
  imap?: EmailImapTransport;
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

export async function sendEmail(input: SendEmailInput): Promise<{ ok: boolean; messageId?: string; error?: string; warning?: string }> {
  const t = getTransporter();
  try {
    let transporter: nodemailer.Transporter;

    if (input.smtp) {
      transporter = nodemailer.createTransport({
        host: input.smtp.host,
        port: input.smtp.port,
        secure: input.smtp.secure,
        auth: {
          user: input.smtp.user,
          pass: input.smtp.pass,
        },
      });
    } else if (t) {
      transporter = t;
    } else {
      logger.debug({ to: input.to }, '[email] not configured, skipping');
      return { ok: false, error: 'SMTP not configured' };
    }

    const fromAddress = input.from
      ? input.from
      : input.smtp
      ? input.smtp.user
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
    logger.info({ messageId: info.messageId, to: input.to, configuredSmtp: !!input.smtp }, '[email] sent');
    if (input.imap) {
      const toList = Array.isArray(input.to) ? input.to : [input.to];
      const ccList = Array.isArray(input.cc) ? input.cc : input.cc ? [input.cc] : undefined;
      const bccList = Array.isArray(input.bcc) ? input.bcc : input.bcc ? [input.bcc] : undefined;
      void appendSentMessage(
        {
          imap: {
            host: input.imap.host,
            port: input.imap.port,
            secure: input.imap.secure,
            auth: { user: input.imap.user, pass: input.imap.pass },
          },
        },
        {
          from: fromAddress,
          to: toList,
          cc: ccList,
          bcc: bccList,
          subject: input.subject,
          text: input.text,
          html: input.html,
        },
      )
        .then((uid) => logger.info({ uid, to: input.to }, '[email] sent-folder appended'))
        .catch((err) => {
          logger.warn({ err: (err as Error).message, to: input.to }, '[email] sent-folder append failed');
        });
    }
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
