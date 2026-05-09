/**
 * Email Tier 1 · Universal IMAP/SMTP
 *
 * 支持任何 IMAP/SMTP 邮箱 (Gmail / Outlook / 自建邮箱).
 * 通过用户填 IMAP 账号密码接入.
 *
 * 启用步骤:
 *   1. npm i imapflow nodemailer
 *   2. 用户在 /settings/email 填入凭据 (加密存储)
 *   3. 后台定时拉取 + 推送
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface EmailCredentials {
  userId: string;
  imap: {
    host: string;
    port: number;
    secure: boolean;
    auth: { user: string; pass: string };
  };
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    auth: { user: string; pass: string };
  };
}

export interface EmailMessage {
  uid: string;
  from: string;
  to: string[];
  subject: string;
  date: string;
  textBody?: string;
  htmlBody?: string;
  attachments: { name: string; size: number; mimeType: string }[];
}

export interface EmailListResult {
  messages: EmailMessage[];
  total: number;
  hasMore: boolean;
}

/**
 * 拉取收件箱
 */
export async function fetchInbox(
  cred: EmailCredentials,
  options: { since?: Date; limit?: number } = {}
): Promise<EmailListResult> {
  // 占位实现, 真实实现使用 imapflow:
  // const client = new ImapFlow({ host, port, secure, auth });
  // await client.connect();
  // const lock = await client.getMailboxLock('INBOX');
  // try { for await (const msg of client.fetch({...})) {...} } finally { lock.release(); }
  return { messages: [], total: 0, hasMore: false };
}

/**
 * 发送邮件
 */
export async function sendEmail(
  cred: EmailCredentials,
  msg: { to: string[]; subject: string; textBody?: string; htmlBody?: string }
): Promise<{ messageId: string }> {
  // 占位: 真实使用 nodemailer
  // const transport = nodemailer.createTransport({ host, port, secure, auth });
  // const info = await transport.sendMail(msg);
  // return { messageId: info.messageId };
  return { messageId: `stub_${Date.now()}` };
}

/**
 * 标记 origin (邮件作为 ORIGIN 层入档)
 */
export async function archiveAsOrigin(
  msg: EmailMessage,
  ownerId: string
): Promise<{ originId: string }> {
  // 调用 lib/storage origins.create
  // 加密存储 emailHeader + textBody + attachments
  return { originId: `origin_email_${msg.uid}` };
}
