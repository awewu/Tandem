import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';

export async function verifyPersonalEmailCredentials(input: {
  smtp: { host: string; port: number; secure: boolean; user: string; pass: string };
  imap: { host: string; port: number; secure: boolean; user: string; pass: string };
}): Promise<string | null> {
  try {
    await verifySmtp(input.smtp);
  } catch (err) {
    return classifyMailVerifyError(err, 'SMTP 发件验证失败');
  }

  try {
    await verifyImap(input.imap);
  } catch (err) {
    return classifyMailVerifyError(err, 'IMAP 收件验证失败');
  }

  return null;
}

async function verifySmtp(input: { host: string; port: number; secure: boolean; user: string; pass: string }): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: input.host,
    port: input.port,
    secure: input.secure,
    auth: { user: input.user, pass: input.pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });
  try {
    await transporter.verify();
  } finally {
    transporter.close();
  }
}

async function verifyImap(input: { host: string; port: number; secure: boolean; user: string; pass: string }): Promise<void> {
  const client = new ImapFlow({
    host: input.host,
    port: input.port,
    secure: input.secure,
    auth: { user: input.user, pass: input.pass },
    connectionTimeout: 10000,
    socketTimeout: 10000,
    logger: false,
  });
  let connected = false;
  try {
    await client.connect();
    connected = true;
    await client.list();
  } finally {
    if (connected) await client.logout().catch(() => undefined);
  }
}

function classifyMailVerifyError(err: unknown, prefix: string): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/auth|login|password|credential|认证|密码|授权|535|Invalid login/i.test(message)) {
    return `${prefix}：邮箱账号或密码/授权码不正确，请重新输入。`;
  }
  if (/timeout|timed out|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN/i.test(message)) {
    return `${prefix}：连接邮箱服务器超时或不可达，请稍后重试。`;
  }
  return `${prefix}：请确认账号、密码/授权码以及邮箱客户端服务已启用。`;
}
