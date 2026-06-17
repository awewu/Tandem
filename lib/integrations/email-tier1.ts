/**
 * Email Tier 1 · Universal IMAP/SMTP
 *
 * 支持任何 IMAP/SMTP 邮箱.
 */

import { ImapFlow } from 'imapflow';
import { simpleParser, Source as MailSource } from 'mailparser';
import { logger } from '@/lib/infra/logger';

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
  uid: number;
  seq: number;
  from: { name?: string; address: string }[];
  to: { name?: string; address: string }[];
  subject: string;
  date: string;
  textBody?: string;
  htmlBody?: string;
  attachments: { filename: string; size: number; contentType: string }[];
  flags: string[];
  seen: boolean;
}

export interface EmailListResult {
  messages: EmailMessage[];
  total: number;
  hasMore: boolean;
}

function normalizeFolder(folder?: string): string {
  if (!folder) return 'INBOX';
  const map: Record<string, string> = {
    inbox: 'INBOX',
    drafts: 'Drafts',
    sent: 'Sent',
    trash: 'Trash',
    junk: 'Junk',
    starred: 'Starred',
  };
  return map[folder.toLowerCase()] || folder;
}

async function resolveMailbox(client: ImapFlow, folder?: string): Promise<string> {
  const normalized = normalizeFolder(folder);

  // 标准 special-use 标志映射
  const specialUseMap: Record<string, string> = {
    INBOX: '\\Inbox',
    Drafts: '\\Drafts',
    Sent: '\\Sent',
    Trash: '\\Trash',
    Junk: '\\Junk',
    Starred: '\\Flagged',
  };
  const targetSpecialUse = specialUseMap[normalized];

  const mailboxes = await client.list();

  // 优先按 specialUse 精确匹配（最可靠，不受命名差异影响）
  if (targetSpecialUse) {
    const match = mailboxes.find((m: any) => m.specialUse === targetSpecialUse);
    if (match) return match.path;
  }

  // 其次按路径精确匹配（大小写不敏感）
  const exactMatch = mailboxes.find(
    (m: any) => m.path.toLowerCase() === normalized.toLowerCase()
  );
  if (exactMatch) return exactMatch.path;

  // 最后按关键词模糊匹配
  const keywords: Record<string, string[]> = {
    INBOX: ['inbox'],
    Drafts: ['draft', '草稿'],
    Sent: ['sent', '已发送', '发送'],
    Trash: ['trash', 'deleted', '删除', '垃圾'],
    Junk: ['junk', 'spam'],
    Starred: ['star', '收藏'],
  };
  const searchTerms = keywords[normalized] || [normalized.toLowerCase()];
  for (const m of mailboxes) {
    const lower = m.path.toLowerCase();
    if (searchTerms.some((term) => lower.includes(term.toLowerCase()))) {
      return m.path;
    }
  }

  return normalized; // fallback，让 getMailboxLock 抛出原生错误
}

export async function fetchInbox(
  cred: EmailCredentials,
  options: { since?: Date; limit?: number; page?: number; folder?: string; flaggedOnly?: boolean } = {}
): Promise<EmailListResult> {
  const client = new ImapFlow({
    host: cred.imap.host,
    port: cred.imap.port,
    secure: cred.imap.secure,
    auth: cred.imap.auth,
    logger: false,
  });

  try {
    await client.connect();
    const folder = await resolveMailbox(client, options.folder);
    const lock = await client.getMailboxLock(folder);
    
    try {
      const mailbox = client.mailbox;
      const total = mailbox.exists;
      
      // 计算分页
      const limit = options.limit ?? 20;
      const page = options.page ?? 1;
      const startSeq = Math.max(1, total - (page * limit) + 1);
      const endSeq = total - ((page - 1) * limit);
      
      if (startSeq > endSeq) {
        return { messages: [], total, hasMore: false };
      }

      const messages: EmailMessage[] = [];
      
      for await (const msg of client.fetch(`${startSeq}:${endSeq}`, {
        uid: true,
        flags: true,
        envelope: true,
        bodyStructure: true,
        source: false,
      })) {
        const flags = msg.flags ? Array.from(msg.flags as any) : [];
        if (options.flaggedOnly && !flags.includes('\\Flagged')) continue;
        messages.push({
          uid: msg.uid,
          seq: msg.seq,
          from: msg.envelope.from.map((f: any) => ({
            name: f.name || '',
            address: f.address || '',
          })),
          to: msg.envelope.to?.map((t: any) => ({
            name: t.name || '',
            address: t.address || '',
          })) || [],
          subject: msg.envelope.subject || '(无主题)',
          date: msg.envelope.date?.toISOString() || new Date().toISOString(),
          flags,
          seen: flags.includes('\\Seen'),
          attachments: [],
        });
      }

      return {
        messages: messages.reverse(), // 最新的在前面
        total,
        hasMore: startSeq > 1,
      };
    } finally {
      lock.release();
    }
  } catch (err) {
    logger.error({ err }, '[imap] fetch inbox failed');
    throw err;
  } finally {
    await client.logout();
  }
}

/**
 * 获取单封邮件详情（含正文和附件）
 */
export async function fetchMessageByUid(
  cred: EmailCredentials,
  uid: number,
  folder?: string
): Promise<EmailMessage | null> {
  const client = new ImapFlow({
    host: cred.imap.host,
    port: cred.imap.port,
    secure: cred.imap.secure,
    auth: cred.imap.auth,
    logger: false,
  });

  try {
    await client.connect();
    const resolved = await resolveMailbox(client, folder);
    const lock = await client.getMailboxLock(resolved);

    try {
      const msgData = await client.fetchOne(uid.toString(), { source: true }, { uid: true });
      if (!msgData.source) return null;

      const parsed = await simpleParser(msgData.source as MailSource);

      return {
        uid,
        seq: msgData.seq,
        from: parsed.from?.value.map((f) => ({
          name: f.name || '',
          address: f.address || '',
        })) || [],
        to: parsed.to?.value.map((t) => ({
          name: t.name || '',
          address: t.address || '',
        })) || [],
        subject: parsed.subject || '(无主题)',
        date: parsed.date?.toISOString() || new Date().toISOString(),
        textBody: parsed.text || undefined,
        htmlBody: parsed.html || undefined,
        attachments: parsed.attachments.map((att) => ({
          filename: att.filename || 'unnamed',
          size: att.size || 0,
          contentType: att.contentType || 'application/octet-stream',
        })),
        flags: msgData.flags || [],
        seen: msgData.flags?.includes('\\Seen') || false,
      };
    } finally {
      lock.release();
    }
  } catch (err) {
    logger.error({ err, uid }, '[imap] fetch message failed');
    throw err;
  } finally {
    await client.logout();
  }
}

/**
 * 批量更新邮件 flags（已读/星标等）
 */
export async function updateMessageFlags(
  cred: EmailCredentials,
  options: { uids: number[]; folder?: string; seen?: boolean; flagged?: boolean }
): Promise<void> {
  const client = new ImapFlow({
    host: cred.imap.host,
    port: cred.imap.port,
    secure: cred.imap.secure,
    auth: cred.imap.auth,
    logger: false,
  });

  try {
    await client.connect();
    const resolved = await resolveMailbox(client, options.folder);
    const lock = await client.getMailboxLock(resolved);

    try {
      const uidSet = options.uids.join(',');
      if (options.seen === true) {
        await client.messageFlagsAdd(uidSet, ['\\Seen'], { uid: true });
      } else if (options.seen === false) {
        await client.messageFlagsRemove(uidSet, ['\\Seen'], { uid: true });
      }
      if (options.flagged === true) {
        await client.messageFlagsAdd(uidSet, ['\\Flagged'], { uid: true });
      } else if (options.flagged === false) {
        await client.messageFlagsRemove(uidSet, ['\\Flagged'], { uid: true });
      }
    } finally {
      lock.release();
    }
  } catch (err) {
    logger.error({ err, uids: options.uids }, '[imap] update flags failed');
    throw err;
  } finally {
    await client.logout();
  }
}

export async function saveDraft(
  cred: EmailCredentials,
  options: { to: string[]; subject: string; text: string; cc?: string[] }
): Promise<string> {
  const client = new ImapFlow({
    host: cred.imap.host,
    port: cred.imap.port,
    secure: cred.imap.secure,
    auth: cred.imap.auth,
    logger: false,
  });

  try {
    await client.connect();
    const resolved = await resolveMailbox(client, 'drafts');

    const lines: string[] = [];
    lines.push('From: ' + (cred.imap.auth.user || ''));
    lines.push('To: ' + (options.to.join(', ') || ''));
    if (options.cc && options.cc.length > 0) {
      lines.push('Cc: ' + options.cc.join(', '));
    }
    lines.push('Subject: ' + options.subject);
    lines.push('Date: ' + new Date().toUTCString());
    lines.push('MIME-Version: 1.0');
    lines.push('Content-Type: text/plain; charset=utf-8');
    lines.push('');
    lines.push(options.text);
    const rawMessage = lines.join('\r\n');

    const response = await client.append(resolved, rawMessage, ['\\Draft', '\\Seen']);
    return response.uid?.toString() || '';
  } catch (err) {
    logger.error({ err }, '[imap] save draft failed');
    throw err;
  } finally {
    await client.logout();
  }
}

export async function deleteMessages(
  cred: EmailCredentials,
  options: { uids: number[]; folder?: string }
): Promise<void> {
  const client = new ImapFlow({
    host: cred.imap.host,
    port: cred.imap.port,
    secure: cred.imap.secure,
    auth: cred.imap.auth,
    logger: false,
  });

  try {
    await client.connect();
    const resolved = await resolveMailbox(client, options.folder);
    const lock = await client.getMailboxLock(resolved);

    try {
      const uidSet = options.uids.join(',');
      await client.messageDelete(uidSet, { uid: true });
    } finally {
      lock.release();
    }
  } catch (err) {
    logger.error({ err, uids: options.uids }, '[imap] delete messages failed');
    throw err;
  } finally {
    await client.logout();
  }
}