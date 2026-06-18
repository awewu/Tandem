/**
 * email-tier1 单元测试
 * 覆盖: resolveMailbox 文件夹跨服务商解析, moveMessages, fetchAttachment
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── ImapFlow mock ─────────────────────────────────────────────────────────
const mockLock = { release: vi.fn() };
const mockClient = {
  connect: vi.fn(),
  logout: vi.fn(),
  list: vi.fn(),
  getMailboxLock: vi.fn(),
  fetchOne: vi.fn(),
  messageMove: vi.fn(),
};

vi.mock('imapflow', () => ({
  ImapFlow: vi.fn().mockImplementation(function () {
    return mockClient;
  }),
}));

vi.mock('mailparser', () => ({ simpleParser: vi.fn() }));
vi.mock('@/lib/infra/logger', () => ({ logger: { error: vi.fn() } }));

import { moveMessages, fetchAttachment } from '@/lib/integrations/email-tier1';
import type { EmailCredentials } from '@/lib/integrations/email-tier1';
import { simpleParser } from 'mailparser';

const CREDS: EmailCredentials = {
  userId: 'u1',
  imap: { host: 'imap.example.com', port: 993, secure: true, auth: { user: 'u@x.com', pass: 'p' } },
  smtp: { host: 'smtp.example.com', port: 465, secure: true, auth: { user: 'u@x.com', pass: 'p' } },
};

const QQ_MAILBOXES = [
  { path: 'INBOX',  specialUse: '\\Inbox'  },
  { path: '已发送', specialUse: '\\Sent'   },
  { path: '草稿箱', specialUse: '\\Drafts' },
  { path: '已删除', specialUse: '\\Trash'  },
  { path: '垃圾邮件', specialUse: '\\Junk' },
];

const GMAIL_MAILBOXES = [
  { path: 'INBOX',             specialUse: '\\Inbox'  },
  { path: '[Gmail]/Sent Mail', specialUse: '\\Sent'   },
  { path: '[Gmail]/Drafts',    specialUse: '\\Drafts' },
  { path: '[Gmail]/Trash',     specialUse: '\\Trash'  },
  { path: '[Gmail]/Spam',      specialUse: '\\Junk'   },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockClient.connect.mockResolvedValue(undefined);
  mockClient.logout.mockResolvedValue(undefined);
  mockClient.getMailboxLock.mockResolvedValue(mockLock);
  mockLock.release.mockReturnValue(undefined);
  mockClient.messageMove.mockResolvedValue(undefined);
});

// ─── resolveMailbox (通过 moveMessages 间接验证) ──────────────────────────

describe('resolveMailbox — 跨服务商文件夹解析', () => {
  it('QQ邮箱: Trash 通过 specialUse → 已删除', async () => {
    mockClient.list.mockResolvedValue(QQ_MAILBOXES);
    await moveMessages(CREDS, { uids: [1], from: 'INBOX', to: 'Trash' });
    expect(mockClient.messageMove).toHaveBeenCalledWith('1', '已删除', { uid: true });
  });

  it('Gmail: Trash 通过 specialUse → [Gmail]/Trash', async () => {
    mockClient.list.mockResolvedValue(GMAIL_MAILBOXES);
    await moveMessages(CREDS, { uids: [2, 3], from: 'INBOX', to: 'Trash' });
    expect(mockClient.messageMove).toHaveBeenCalledWith('2,3', '[Gmail]/Trash', { uid: true });
  });

  it('无匹配时透传原始文件夹名', async () => {
    mockClient.list.mockResolvedValue([{ path: 'CustomFolder', specialUse: undefined }]);
    await moveMessages(CREDS, { uids: [5], from: 'INBOX', to: 'CustomFolder' });
    expect(mockClient.messageMove).toHaveBeenCalledWith('5', 'CustomFolder', { uid: true });
  });

  it('QQ邮箱: Sent 通过 specialUse → 已发送', async () => {
    mockClient.list.mockResolvedValue(QQ_MAILBOXES);
    await moveMessages(CREDS, { uids: [1], from: 'INBOX', to: 'Sent' });
    expect(mockClient.messageMove).toHaveBeenCalledWith('1', '已发送', { uid: true });
  });
});

// ─── moveMessages ─────────────────────────────────────────────────────────

describe('moveMessages', () => {
  it('多 uid 拼接为逗号字符串', async () => {
    mockClient.list.mockResolvedValue(QQ_MAILBOXES);
    await moveMessages(CREDS, { uids: [10, 20, 30], from: 'INBOX', to: 'Trash' });
    expect(mockClient.messageMove).toHaveBeenCalledWith('10,20,30', expect.any(String), { uid: true });
  });

  it('connect 和 logout 各调用一次 (不泄漏连接)', async () => {
    mockClient.list.mockResolvedValue(QQ_MAILBOXES);
    await moveMessages(CREDS, { uids: [1], from: 'INBOX', to: 'Trash' });
    expect(mockClient.connect).toHaveBeenCalledOnce();
    expect(mockClient.logout).toHaveBeenCalledOnce();
  });

  it('messageMove 失败时 lock.release 仍被调用', async () => {
    mockClient.list.mockResolvedValue(QQ_MAILBOXES);
    mockClient.messageMove.mockRejectedValue(new Error('IMAP error'));
    await expect(moveMessages(CREDS, { uids: [1], from: 'INBOX', to: 'Trash' }))
      .rejects.toThrow('IMAP error');
    expect(mockLock.release).toHaveBeenCalledOnce();
    expect(mockClient.logout).toHaveBeenCalledOnce();
  });
});

// ─── fetchAttachment ──────────────────────────────────────────────────────

describe('fetchAttachment', () => {
  const SRC = Buffer.from('raw');

  it('找到附件 → 返回 base64 + contentType + filename', async () => {
    mockClient.list.mockResolvedValue(QQ_MAILBOXES);
    mockClient.fetchOne.mockResolvedValue({ source: SRC, seq: 1, flags: new Set() });
    vi.mocked(simpleParser).mockResolvedValue({
      attachments: [{ filename: 'report.pdf', contentType: 'application/pdf', size: 100, content: Buffer.from('pdf') }],
    } as any);

    const r = await fetchAttachment(CREDS, 42, 'report.pdf', 'INBOX');
    expect(r).not.toBeNull();
    expect(r!.filename).toBe('report.pdf');
    expect(r!.contentType).toBe('application/pdf');
    expect(Buffer.from(r!.data, 'base64').toString()).toBe('pdf');
  });

  it('附件列表为空 → 返回 null', async () => {
    mockClient.list.mockResolvedValue(QQ_MAILBOXES);
    mockClient.fetchOne.mockResolvedValue({ source: SRC, seq: 1, flags: new Set() });
    vi.mocked(simpleParser).mockResolvedValue({ attachments: [] } as any);
    expect(await fetchAttachment(CREDS, 42, 'x.pdf', 'INBOX')).toBeNull();
  });

  it('fetchOne 无结果 → 返回 null', async () => {
    mockClient.list.mockResolvedValue(QQ_MAILBOXES);
    mockClient.fetchOne.mockResolvedValue(null);
    expect(await fetchAttachment(CREDS, 99, 'x.pdf', 'INBOX')).toBeNull();
  });

  it('中文文件名正常处理', async () => {
    mockClient.list.mockResolvedValue(QQ_MAILBOXES);
    mockClient.fetchOne.mockResolvedValue({ source: SRC, seq: 1, flags: new Set() });
    vi.mocked(simpleParser).mockResolvedValue({
      attachments: [{ filename: '季度报告.xlsx', contentType: 'application/vnd.ms-excel', size: 50, content: Buffer.from('xlsx') }],
    } as any);
    const r = await fetchAttachment(CREDS, 7, '季度报告.xlsx', 'INBOX');
    expect(r!.filename).toBe('季度报告.xlsx');
    expect(Buffer.from(r!.data, 'base64').toString()).toBe('xlsx');
  });

  it('fetchOne 抛错时 logout 仍被调用', async () => {
    mockClient.list.mockResolvedValue(QQ_MAILBOXES);
    mockClient.fetchOne.mockRejectedValue(new Error('fetch failed'));
    await expect(fetchAttachment(CREDS, 1, 'f.pdf', 'INBOX')).rejects.toThrow('fetch failed');
    expect(mockClient.logout).toHaveBeenCalledOnce();
  });
});
