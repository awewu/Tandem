/**
 * Email Tier 1 · Universal IMAP/SMTP
 *
 * 支持任何 IMAP/SMTP 邮箱.
 */

import { ImapFlow } from 'imapflow';
import { simpleParser, Source as MailSource } from 'mailparser';
import { logger } from '@/lib/infra/logger';
import { parseMailQuery, type ParsedMailQuery } from '@/lib/mail/search-query';

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
  cc?: { name?: string; address: string }[];
  subject: string;
  date: string;
  textBody?: string;
  htmlBody?: string;
  attachments: { filename: string; size: number; contentType: string }[];
  flags: string[];
  seen: boolean;
  /** 该邮件所在文件夹 (跨文件夹搜索结果用于回溯打开详情/附件) */
  folder?: string;
  /** 是否含附件 (搜索列表由 bodyStructure 推断, 无需拉全文) */
  hasAttachment?: boolean;
}

export interface EmailListResult {
  messages: EmailMessage[];
  total: number;
  hasMore: boolean;
}

export interface EmailSearchOptions {
  query: string;
  folder?: string;
  limit?: number;
  page?: number;
}

export interface EmailSearchResult {
  messages: EmailMessage[];
  total: number;
  hasMore: boolean;
  page: number;
  pageSize: number;
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
      if (!mailbox) throw new Error('mailbox unavailable');
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
        const flags: string[] = msg.flags ? Array.from(msg.flags as Set<string>) : [];
        if (options.flaggedOnly && !flags.includes('\\Flagged')) continue;
        messages.push({
          uid: msg.uid,
          seq: msg.seq,
          from: msg.envelope?.from?.map((f) => ({
            name: f.name || '',
            address: f.address || '',
          })) || [],
          to: msg.envelope?.to?.map((t) => ({
            name: t.name || '',
            address: t.address || '',
          })) || [],
          subject: msg.envelope?.subject || '(无主题)',
          date: msg.envelope?.date?.toISOString() || new Date().toISOString(),
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
      if (!msgData || !msgData.source) return null;

      const parsed = await simpleParser(msgData.source as MailSource);
      const msgFlags: string[] = msgData.flags ? Array.from(msgData.flags) : [];
      const toList = Array.isArray(parsed.to) ? parsed.to : parsed.to ? [parsed.to] : [];
      const ccList = Array.isArray(parsed.cc) ? parsed.cc : parsed.cc ? [parsed.cc] : [];

      return {
        uid,
        seq: msgData.seq,
        from: parsed.from?.value.map((f) => ({
          name: f.name || '',
          address: f.address || '',
        })) || [],
        to: toList
          .flatMap((a) => a.value)
          .map((t) => ({
            name: t.name || '',
            address: t.address || '',
          })),
        cc: ccList
          .flatMap((a) => a.value)
          .map((t) => ({ name: t.name || '', address: t.address || '' })),
        subject: parsed.subject || '(无主题)',
        date: parsed.date?.toISOString() || new Date().toISOString(),
        textBody: parsed.text || undefined,
        htmlBody: parsed.html || undefined,
        attachments: parsed.attachments.map((att) => ({
          filename: att.filename || 'unnamed',
          size: att.size || 0,
          contentType: att.contentType || 'application/octet-stream',
        })),
        flags: msgFlags,
        seen: msgFlags.includes('\\Seen'),
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
  options: { to: string[]; subject: string; text: string; html?: string; cc?: string[]; bcc?: string[]; replaceUid?: number }
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
    const lock = await client.getMailboxLock(resolved);
    try {
      // 去重: 删除上一版草稿, 避免每次保存产生新副本
      if (options.replaceUid) {
        try {
          await client.messageDelete(String(options.replaceUid), { uid: true });
        } catch (delErr) {
          logger.warn({ delErr, uid: options.replaceUid }, '[imap] delete previous draft failed (ignored)');
        }
      }

      const lines: string[] = [];
      lines.push('From: ' + sanitizeHeader(cred.imap.auth.user || ''));
      lines.push('To: ' + (options.to.map(sanitizeHeader).join(', ') || ''));
      if (options.cc && options.cc.length > 0) lines.push('Cc: ' + options.cc.map(sanitizeHeader).join(', '));
      if (options.bcc && options.bcc.length > 0) lines.push('Bcc: ' + options.bcc.map(sanitizeHeader).join(', '));
      lines.push('Subject: ' + sanitizeHeader(options.subject));
      lines.push('Date: ' + new Date().toUTCString());
      lines.push('MIME-Version: 1.0');
      lines.push(options.html ? 'Content-Type: text/html; charset=utf-8' : 'Content-Type: text/plain; charset=utf-8');
      lines.push('');
      lines.push(options.html ?? options.text);
      const rawMessage = lines.join('\r\n');

      const response = await client.append(resolved, rawMessage, ['\\Draft', '\\Seen']);
      return response && response.uid ? response.uid.toString() : '';
    } finally {
      lock.release();
    }
  } catch (err) {
    logger.error({ err }, '[imap] save draft failed');
    throw err;
  } finally {
    await client.logout();
  }
}

export async function appendSentMessage(
  cred: Pick<EmailCredentials, 'imap'>,
  options: { from: string; to: string[]; subject: string; text?: string; html?: string; cc?: string[]; bcc?: string[] }
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
    const resolved = await resolveMailbox(client, 'sent');
    const headers = [
      `From: ${sanitizeHeader(options.from)}`,
      `To: ${options.to.map(sanitizeHeader).join(', ')}`,
      options.cc?.length ? `Cc: ${options.cc.map(sanitizeHeader).join(', ')}` : '',
      options.bcc?.length ? `Bcc: ${options.bcc.map(sanitizeHeader).join(', ')}` : '',
      `Subject: ${sanitizeHeader(options.subject)}`,
      `Date: ${new Date().toUTCString()}`,
      'MIME-Version: 1.0',
      options.html ? 'Content-Type: text/html; charset=utf-8' : 'Content-Type: text/plain; charset=utf-8',
    ].filter(Boolean);
    const rawMessage = [...headers, '', options.html ?? options.text ?? ''].join('\r\n');
    const response = await client.append(resolved, rawMessage, ['\\Seen']);
    return response && response.uid ? response.uid.toString() : '';
  } catch (err) {
    logger.warn({ err }, '[imap] append sent message failed');
    throw err;
  } finally {
    await client.logout();
  }
}

function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
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
/** 快速获取收件箱未读数 (IMAP STATUS, 不拉取正文, 用于轮询/角标) */
export async function getUnreadCount(
  cred: EmailCredentials,
  folder: string = 'INBOX'
): Promise<number> {
  const client = new ImapFlow({
    host: cred.imap.host, port: cred.imap.port,
    secure: cred.imap.secure, auth: cred.imap.auth, logger: false,
  });
  try {
    await client.connect();
    const resolved = await resolveMailbox(client, folder);
    const status = await client.status(resolved, { unseen: true });
    return typeof status?.unseen === 'number' ? status.unseen : 0;
  } catch (err) {
    logger.warn({ err, folder }, '[imap] get unread count failed');
    return 0;
  } finally {
    await client.logout();
  }
}

/** 由 bodyStructure 判断是否含附件 (attachment disposition 或 multipart/mixed 下的非 text/html 叶子) */
function bodyStructureHasAttachment(node: any): boolean {
  if (!node) return false;
  const disposition = (node.disposition ?? '').toString().toLowerCase();
  if (disposition === 'attachment') return true;
  if (node.dispositionParameters?.filename || node.parameters?.name) {
    const type = `${node.type ?? ''}/${node.subtype ?? ''}`.toLowerCase();
    if (!type.startsWith('text/') && type !== 'multipart/alternative') return true;
  }
  if (Array.isArray(node.childNodes)) {
    return node.childNodes.some((child: any) => bodyStructureHasAttachment(child));
  }
  return false;
}

/** 将解析后的搜索条件编译为 imapflow SearchObject */
function buildImapSearch(q: ParsedMailQuery): Record<string, unknown> {
  const s: Record<string, unknown> = {};
  if (q.from) s.from = q.from;
  if (q.to) s.to = q.to;
  if (q.cc) s.cc = q.cc;
  if (q.subject) s.subject = q.subject;
  if (q.seen === true) s.seen = true;
  if (q.seen === false) s.unseen = true;
  if (q.flagged) s.flagged = true;
  if (q.before) s.before = new Date(q.before);
  if (q.since) s.since = new Date(q.since);
  if (q.text) {
    s.or = [{ subject: q.text }, { from: q.text }, { to: q.text }, { cc: q.text }, { body: q.text }];
  }
  // 无任何条件时兜底: 匹配全部 (交由分页限制数量)
  if (Object.keys(s).length === 0) s.all = true;
  return s;
}

/** 跨文件夹搜索时默认覆盖的文件夹 (排除 Trash/Junk, 避免噪音) */
const ALL_FOLDER_KEYS = ['inbox', 'sent', 'drafts', 'archive'];

async function searchOneFolder(
  client: ImapFlow,
  folderKey: string,
  criteria: ParsedMailQuery,
  perFolderCap: number,
): Promise<EmailMessage[]> {
  let resolved: string;
  try {
    resolved = await resolveMailbox(client, folderKey);
  } catch {
    return [];
  }
  const lock = await client.getMailboxLock(resolved).catch(() => null);
  if (!lock) return [];
  try {
    const found = await client.search(buildImapSearch(criteria) as any, { uid: true });
    const uids = Array.isArray(found) ? found : [];
    const newestFirst = [...uids].sort((a, b) => b - a).slice(0, perFolderCap);
    if (!newestFirst.length) return [];
    const msgs: EmailMessage[] = [];
    const needBodyStructure = criteria.hasAttachment === true;
    for await (const msg of client.fetch(
      newestFirst.join(','),
      { envelope: true, flags: true, bodyStructure: needBodyStructure },
      { uid: true },
    )) {
      const hasAttachment = needBodyStructure ? bodyStructureHasAttachment((msg as any).bodyStructure) : undefined;
      msgs.push({
        uid: msg.uid,
        seq: msg.seq,
        from: (msg.envelope?.from ?? []).map((f) => ({ name: f.name ?? '', address: f.address ?? '' })),
        to: (msg.envelope?.to ?? []).map((t) => ({ name: t.name ?? '', address: t.address ?? '' })),
        subject: msg.envelope?.subject ?? '(无主题)',
        date: (msg.envelope?.date ?? new Date()).toISOString(),
        seen: (msg.flags ?? new Set()).has('\\Seen'),
        flags: Array.from(msg.flags ?? []),
        attachments: [],
        folder: folderKey,
        hasAttachment,
      });
    }
    return msgs;
  } catch (err) {
    logger.warn({ err, folder: folderKey }, '[imap] search one folder failed');
    return [];
  } finally {
    lock.release();
  }
}

/**
 * IMAP 搜索。支持 Gmail 风格操作符 (from:/to:/subject:/has:attachment/is:unread/before:/in: 等),
 * 以及跨文件夹搜索 (in:all 或多个 in: )。结果按日期倒序合并分页。
 */
export async function searchMessagePage(
  cred: EmailCredentials,
  options: EmailSearchOptions
): Promise<EmailSearchResult> {
  const client = new ImapFlow({
    host: cred.imap.host, port: cred.imap.port,
    secure: cred.imap.secure, auth: cred.imap.auth, logger: false,
  });
  const pageSize = Math.min(Math.max(options.limit ?? 30, 1), 100);
  const page = Math.max(options.page ?? 1, 1);

  const criteria = parseMailQuery(options.query);

  // 目标文件夹: query 内 in:/folder: 优先, 否则用调用方传入的 folder, 否则 INBOX
  let folderKeys: string[];
  if (criteria.allFolders) {
    folderKeys = ALL_FOLDER_KEYS;
  } else if (criteria.folders && criteria.folders.length) {
    folderKeys = criteria.folders;
  } else {
    folderKeys = [options.folder ?? 'INBOX'];
  }

  try {
    await client.connect();
    // 每个文件夹最多取回的候选数 (跨文件夹时限制单库开销)
    const perFolderCap = folderKeys.length > 1 ? Math.max(pageSize * 3, 60) : Math.max(pageSize * page + pageSize, 100);
    const all: EmailMessage[] = [];
    for (const key of folderKeys) {
      const msgs = await searchOneFolder(client, key, criteria, perFolderCap);
      all.push(...msgs);
    }
    // 若要求含附件, 二次过滤 (bodyStructure 已回填 hasAttachment)
    const filtered = criteria.hasAttachment ? all.filter((m) => m.hasAttachment) : all;
    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const paged = filtered.slice(start, start + pageSize);
    return {
      messages: paged,
      total,
      hasMore: start + pageSize < total,
      page,
      pageSize,
    };
  } finally {
    await client.logout();
  }
}

export async function searchMessages(
  cred: EmailCredentials,
  options: EmailSearchOptions
): Promise<EmailMessage[]> {
  return (await searchMessagePage(cred, options)).messages;
}

/** 移动邮件到指定文件夹 */
export async function moveMessages(
  cred: EmailCredentials,
  options: { uids: number[]; from: string; to: string }
): Promise<void> {
  const client = new ImapFlow({
    host: cred.imap.host, port: cred.imap.port,
    secure: cred.imap.secure, auth: cred.imap.auth, logger: false,
  });
  try {
    await client.connect();
    const fromResolved = await resolveMailbox(client, options.from);
    const lock = await client.getMailboxLock(fromResolved);
    try {
      const toResolved = await resolveMailbox(client, options.to);
      await client.messageMove(options.uids.join(','), toResolved, { uid: true });
    } finally { lock.release(); }
  } finally { await client.logout(); }
}

/** 下载附件内容（返回 base64 data URI） */
export async function fetchAttachment(
  cred: EmailCredentials,
  uid: number,
  filename: string,
  folder?: string
): Promise<{ data: string; contentType: string; filename: string } | null> {
  const client = new ImapFlow({
    host: cred.imap.host, port: cred.imap.port,
    secure: cred.imap.secure, auth: cred.imap.auth, logger: false,
  });
  try {
    await client.connect();
    const resolved = await resolveMailbox(client, folder ?? 'INBOX');
    const lock = await client.getMailboxLock(resolved);
    try {
      const msgData = await client.fetchOne(uid.toString(), { source: true }, { uid: true });
      if (!msgData || !msgData.source) return null;
      const { simpleParser } = await import('mailparser');
      const parsed = await simpleParser(msgData.source as Buffer);
      const att = parsed.attachments.find((a) => (a.filename ?? '') === filename);
      if (!att) return null;
      return {
        data: att.content.toString('base64'),
        contentType: att.contentType,
        filename: att.filename ?? filename,
      };
    } finally { lock.release(); }
  } finally { await client.logout(); }
}
