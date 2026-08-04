import { afterEach, describe, expect, it, vi } from 'vitest';
import { InMemoryCalendarEventRepository } from '@/lib/repositories/memory-calendar-repo';
import { InMemoryCalendarReminderRepository } from '@/lib/repositories/memory-calendar-reminder-repo';
import { InMemoryCalendarSubscriptionRepository } from '@/lib/repositories/memory-calendar-subscription-repo';
import { InMemoryNotificationRepository } from '@/lib/repositories/memory-notification-repo';
import { InMemoryReminderTaskRepository } from '@/lib/repositories/memory-reminder-task-repo';

describe('createCalendarService email sender resolution', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('uses the calendar organizer credentials instead of the current service actor when sending schedule mail', async () => {
    const sendEmail = vi.fn(async () => ({ ok: true }));
    const users = [
      { id: 'pingyan', email: 'pingyan@rhenext.com', name: '平艳', tenantId: 'tenant-1', roles: [] },
      { id: 'liyutao', email: 'li.yutao@rhenext.com', name: '李煜涛', tenantId: 'tenant-1', roles: [] },
      { id: 'attendee-1', email: 'attendee@example.com', name: '参会人', tenantId: 'tenant-1', roles: [] },
    ];
    const resolvePersonalUserEmailSmtp = vi.fn(async (userId: string) => {
      const user = users.find((item) => item.id === userId);
      return {
        mode: 'personal',
        smtp: { host: 'smtp.example.com', port: 465, secure: true, user: user?.email ?? '', pass: 'secret' },
        imap: { host: 'imap.example.com', port: 993, secure: true, user: user?.email ?? '', pass: 'secret' },
      };
    });
    const calendarActivityLogs = {
      create: vi.fn(async (log) => log),
    };

    vi.doMock('@/lib/repositories/app-context-factory', () => ({
      createAppContext: () => ({
        calendarRepo: new InMemoryCalendarEventRepository(),
        notificationRepo: new InMemoryNotificationRepository(),
        calendarReminderRepo: new InMemoryCalendarReminderRepository(),
        calendarSubscriptionRepo: new InMemoryCalendarSubscriptionRepository(),
        reminderTaskRepo: new InMemoryReminderTaskRepository(),
      }),
    }));
    vi.doMock('@/lib/storage/repository', () => ({
      getStore: () => ({
        auth: {
          users: {
            list: async () => users,
            findById: async (id: string) => users.find((user) => user.id === id) ?? null,
          },
        },
        calendarActivityLogs,
      }),
    }));
    vi.doMock('@/lib/email/global-email-config', () => ({ resolvePersonalUserEmailSmtp }));
    vi.doMock('@/lib/infra/email', () => ({ sendEmail }));

    const { createCalendarService } = await import('@/lib/calendar/service-factory');
    const service = createCalendarService('pingyan');

    await service.createManaged({
      title: '发件人检查',
      startAt: '2026-08-12T09:00:00+08:00',
      endAt: '2026-08-12T09:30:00+08:00',
      ownerId: 'liyutao',
      ownerEmail: 'li.yutao@rhenext.com',
      ownerName: '李煜涛',
      attendeeEmails: ['attendee@example.com'],
      tenantId: 'tenant-1',
    });

    expect(resolvePersonalUserEmailSmtp).toHaveBeenCalledWith('liyutao');
    expect(resolvePersonalUserEmailSmtp).not.toHaveBeenCalledWith('pingyan');
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      from: 'li.yutao@rhenext.com',
      smtp: expect.objectContaining({ user: 'li.yutao@rhenext.com' }),
    }));
  });

  it('does not fall back to the current actor, global SMTP, or env SMTP when the organizer has no mailbox configured', async () => {
    const resolvePersonalUserEmailSmtp = vi.fn(async () => null);
    const sendEmail = vi.fn(async () => ({ ok: true }));
    const users = [
      { id: 'pingyan', email: 'pingyan@rhenext.com', name: '平艳', tenantId: 'tenant-1', roles: [] },
      { id: 'liyutao', email: 'li.yutao@rhenext.com', name: '李煜涛', tenantId: 'tenant-1', roles: [] },
      { id: 'attendee-1', email: 'attendee@example.com', name: '参会人', tenantId: 'tenant-1', roles: [] },
    ];
    const calendarActivityLogs = {
      create: vi.fn(async (log) => log),
    };

    vi.doMock('@/lib/repositories/app-context-factory', () => ({
      createAppContext: () => ({
        calendarRepo: new InMemoryCalendarEventRepository(),
        notificationRepo: new InMemoryNotificationRepository(),
        calendarReminderRepo: new InMemoryCalendarReminderRepository(),
        calendarSubscriptionRepo: new InMemoryCalendarSubscriptionRepository(),
        reminderTaskRepo: new InMemoryReminderTaskRepository(),
      }),
    }));
    vi.doMock('@/lib/storage/repository', () => ({
      getStore: () => ({
        auth: {
          users: {
            list: async () => users,
            findById: async (id: string) => users.find((user) => user.id === id) ?? null,
          },
        },
        calendarActivityLogs,
      }),
    }));
    vi.doMock('@/lib/email/global-email-config', () => ({ resolvePersonalUserEmailSmtp }));
    vi.doMock('@/lib/infra/email', () => ({ sendEmail }));

    const { createCalendarService } = await import('@/lib/calendar/service-factory');
    const service = createCalendarService('pingyan');

    await service.createManaged({
      title: '未配置邮箱检查',
      startAt: '2026-08-12T09:00:00+08:00',
      endAt: '2026-08-12T09:30:00+08:00',
      ownerId: 'liyutao',
      ownerEmail: 'li.yutao@rhenext.com',
      ownerName: '李煜涛',
      attendeeEmails: ['attendee@example.com'],
      tenantId: 'tenant-1',
    });

    expect(resolvePersonalUserEmailSmtp).toHaveBeenCalledWith('liyutao');
    expect(resolvePersonalUserEmailSmtp).not.toHaveBeenCalledWith('pingyan');
    expect(sendEmail).not.toHaveBeenCalled();
    expect(service.getDeliveryWarnings()).toEqual([
      '发起人 li.yutao@rhenext.com 未配置邮箱，日程已保存但邮件通知未发送；请先到「设置 - 邮箱」绑定并验证邮箱。',
    ]);
  });
});
