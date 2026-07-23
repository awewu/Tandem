import { describe, expect, it } from 'vitest';
import { parseEmailReminderEvent, syncCalendarFromEmailReminders } from '@/lib/calendar/email-reminder-sync';
import type { EmailCredentials, EmailMessage } from '@/lib/integrations/email-tier1';
import { InMemoryCalendarEventRepository } from '@/lib/repositories/memory-calendar-repo';

function message(patch: Partial<EmailMessage> = {}): EmailMessage {
  return {
    uid: 101,
    seq: 1,
    from: [{ name: '日历服务', address: 'calendar@example.com' }],
    to: [{ name: 'pingyan', address: 'owner@example.com' }],
    subject: '【日程提醒】 日程5分钟后开始 周六开会 2026年07月22日 20:00-21:00 (GMT+08:00)',
    date: '2026-07-22T11:55:00.000Z',
    textBody: '周六开会 2026年07月22日 20:00-21:00 (GMT+08:00)',
    htmlBody: '',
    attachments: [],
    flags: [],
    seen: false,
    ...patch,
  };
}

const credentials: EmailCredentials = {
  userId: 'owner-1',
  imap: {
    host: 'imap.example.com',
    port: 993,
    secure: true,
    auth: { user: 'owner@example.com', pass: 'secret' },
  },
  smtp: {
    host: 'smtp.example.com',
    port: 465,
    secure: true,
    auth: { user: 'owner@example.com', pass: 'secret' },
  },
};

describe('email reminder calendar sync', () => {
  it('parses NetEase/WeCom reminder mail in the screenshot format', () => {
    const parsed = parseEmailReminderEvent(message({
      subject: [
        '【日程提醒】 日程5分钟后开始 周六开会 2026年07月22日 20:00-21:00 (GMT+08:00)',
        '(Notification: The schedule will start in 5 minutes 周六开会 22 Jul 2026 20:00-21:00 (GMT+08:00))',
      ].join(' '),
    }));

    expect(parsed).toMatchObject({
      title: '周六开会',
      startAt: '2026-07-22T12:00:00.000Z',
      endAt: '2026-07-22T13:00:00.000Z',
      timezone: 'Asia/Shanghai',
    });
  });

  it('does not import OKR check-in reminder noise as a calendar event', () => {
    const parsed = parseEmailReminderEvent(message({
      subject: 'Notification: The schedule will start in 5 minutes KR Check-in 23 Jul 2026 09:30-10:00 (GMT+08:00)',
      textBody: 'Notification: The schedule will start in 5 minutes KR Check-in 23 Jul 2026 09:30-10:00 (GMT+08:00)',
    }));

    expect(parsed).toBeNull();
  });

  it('imports reminder mail idempotently by event title and time', async () => {
    const repo = new InMemoryCalendarEventRepository();
    const fullMessage = message();
    const deps = {
      calendarRepo: repo,
      getCredentials: async () => credentials,
      fetchInbox: async () => ({ messages: [], total: 0, hasMore: false }),
      searchMessages: async () => [message({ textBody: undefined, htmlBody: undefined })],
      fetchMessageByUid: async () => fullMessage,
      now: () => new Date('2026-07-22T10:00:00.000Z'),
    };

    const first = await syncCalendarFromEmailReminders({
      userId: 'owner-1',
      tenantId: 'tenant-1',
      email: 'owner@example.com',
      from: new Date('2026-07-01T00:00:00.000Z'),
      to: new Date('2026-08-01T00:00:00.000Z'),
    }, deps);

    const second = await syncCalendarFromEmailReminders({
      userId: 'owner-1',
      tenantId: 'tenant-1',
      email: 'owner@example.com',
      from: new Date('2026-07-01T00:00:00.000Z'),
      to: new Date('2026-08-01T00:00:00.000Z'),
    }, deps);

    const events = await repo.list({ ownerId: 'owner-1', tenantId: 'tenant-1' });
    expect(first).toMatchObject({ source: 'email_reminder', created: 1, updated: 0, skipped: 0, parsed: 1 });
    expect(second).toMatchObject({ created: 0, updated: 0, skipped: 1, parsed: 1 });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      title: '周六开会',
      calendarSource: 'netease',
      externalId: expect.stringMatching(/^netease:mail-reminder:/),
      startAt: '2026-07-22T12:00:00.000Z',
      endAt: '2026-07-22T13:00:00.000Z',
    });
  });

  it('falls back to scanning recent inbox subjects when IMAP search misses Chinese reminders', async () => {
    const repo = new InMemoryCalendarEventRepository();
    const summary = message({ textBody: undefined, htmlBody: undefined });

    const result = await syncCalendarFromEmailReminders({
      userId: 'owner-1',
      tenantId: 'tenant-1',
      email: 'owner@example.com',
      from: new Date('2026-07-01T00:00:00.000Z'),
      to: new Date('2026-08-01T00:00:00.000Z'),
    }, {
      calendarRepo: repo,
      getCredentials: async () => credentials,
      fetchInbox: async (_cred, options) => ({
        messages: options.page === 1 ? [summary] : [],
        total: 1,
        hasMore: false,
      }),
      searchMessages: async () => [],
      fetchMessageByUid: async () => summary,
      now: () => new Date('2026-07-22T10:00:00.000Z'),
    });

    const events = await repo.list({ ownerId: 'owner-1', tenantId: 'tenant-1' });
    expect(result).toMatchObject({ total: 1, parsed: 1, created: 1 });
    expect(events[0]).toMatchObject({
      title: '周六开会',
      startAt: '2026-07-22T12:00:00.000Z',
    });
  });
});
