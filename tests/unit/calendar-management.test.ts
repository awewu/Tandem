import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CalendarService } from '@/lib/services/calendar-service';
import type { CalendarJob } from '@/lib/calendar/job-store';
import { InMemoryCalendarEventRepository } from '@/lib/repositories/memory-calendar-repo';
import { InMemoryNotificationRepository } from '@/lib/repositories/memory-notification-repo';
import { InMemoryCalendarReminderRepository } from '@/lib/repositories/memory-calendar-reminder-repo';
import { InMemoryCalendarSubscriptionRepository } from '@/lib/repositories/memory-calendar-subscription-repo';
import { InMemoryReminderTaskRepository } from '@/lib/repositories/memory-reminder-task-repo';
import { CalendarSubscriptionService } from '@/lib/services/calendar-subscription-service';
import { listCalendarActivities } from '@/lib/calendar/activity-log';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { setStore } from '@/lib/storage/repository';

beforeEach(() => {
  vi.useRealTimers();
  setStore(createInMemoryStore());
});

afterEach(() => {
  vi.useRealTimers();
});

function createService(
  now = new Date('2026-07-16T02:00:00.000Z'),
  users = [
    { id: 'owner-1', email: 'owner@example.com', name: 'Owner' },
    { id: 'user-2', email: 'colleague@example.com', name: 'Colleague' },
  ],
  emailResult: { ok: boolean; error?: string } | ((message: { to: string[]; subject: string; text: string }) => { ok: boolean; error?: string } | Promise<{ ok: boolean; error?: string }>) = { ok: true },
) {
  const sentEmails: Array<{ to: string[]; subject: string; text: string }> = [];
  const ctx = {
    calendarRepo: new InMemoryCalendarEventRepository(),
    notificationRepo: new InMemoryNotificationRepository(),
    calendarReminderRepo: new InMemoryCalendarReminderRepository(),
    calendarSubscriptionRepo: new InMemoryCalendarSubscriptionRepository(),
    reminderTaskRepo: new InMemoryReminderTaskRepository(),
  };

  const service = new CalendarService(ctx, {
    now: () => now,
    listUsers: async () => users,
    sendEmail: async (message) => {
      sentEmails.push(message);
      return typeof emailResult === 'function' ? await emailResult(message) : emailResult;
    },
  });
  return { service, ctx, sentEmails };
}

async function waitForCalendarJob(
  jobId: string,
  predicate: (job: CalendarJob) => boolean,
) {
  const { getCalendarJobStore } = await import('@/lib/calendar/job-store');
  const store = getCalendarJobStore();
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const job = await store.get(jobId);
    if (job && predicate(job)) return job;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(`calendar job ${jobId} did not reach expected state`);
}

describe('CalendarService', () => {
  it('rejects creating an event on a past calendar date', async () => {
    const { service } = createService();

    await expect(service.create({
      title: '过期日程',
      startAt: '2026-07-15T09:00:00+08:00',
      endAt: '2026-07-15T10:00:00+08:00',
      ownerId: 'owner-1',
      tenantId: 'tenant-1',
    })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it.each([
    { field: 'reminderMinutes', value: -1 },
    { field: 'attendeeEmails', value: 'not-an-array' },
    { field: 'recurrence', value: { frequency: 'monthly', interval: 1 } },
  ])('rejects malformed managed event field $field', async ({ field, value }) => {
    const { service } = createService();
    const command = {
      title: '输入校验',
      startAt: '2026-07-17T09:00:00+08:00',
      endAt: '2026-07-17T10:00:00+08:00',
      ownerId: 'owner-1',
      ownerEmail: 'owner@example.com',
      tenantId: 'tenant-1',
      [field]: value,
    };

    await expect(service.createManaged(command as Parameters<typeof service.createManaged>[0]))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('materializes a recurring schedule, auto-joins internal attendees, and creates in-app reminders', async () => {
    const { service, ctx, sentEmails } = createService();

    const events = await service.createManaged({
      title: '项目同步会',
      startAt: '2026-07-17T09:00:00+08:00',
      endAt: '2026-07-17T10:00:00+08:00',
      ownerId: 'owner-1',
      ownerEmail: 'owner@example.com',
      ownerName: 'Owner',
      tenantId: 'tenant-1',
      attendeeEmails: ['colleague@example.com', 'outside@example.net'],
      reminderMinutes: 15,
      recurrence: {
        frequency: 'daily',
        interval: 1,
        end: { type: 'count', count: 2 },
      },
    });

    expect(events).toHaveLength(2);
    expect(events.map((event) => event.attendees)).toEqual([
      ['user-2'],
      ['user-2'],
    ]);
    expect(events[0].externalAttendeeEmails).toEqual(['outside@example.net']);
    expect(events[0].seriesId).toBeTruthy();

    const reminders = await ctx.calendarReminderRepo.list({ tenantId: 'tenant-1' });
    expect(reminders).toHaveLength(4);
    expect(new Set(reminders.map((reminder) => reminder.userId))).toEqual(new Set(['owner-1', 'user-2']));

    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].to).toEqual([
      'colleague@example.com',
      'outside@example.net',
    ]);
    expect(sentEmails[0].subject).toBe('【日程通知】项目同步会');

    const activities = await listCalendarActivities({ tenantId: 'tenant-1' });
    expect(activities.items[0]).toMatchObject({
      action: 'event.created',
      eventTitle: '项目同步会',
      actorId: 'owner-1',
    });
  });

  it('reports email delivery failure without rolling back the created event', async () => {
    const { service, ctx } = createService(
      new Date('2026-07-16T02:00:00.000Z'),
      undefined,
      { ok: false, error: 'SMTP authentication failed' },
    );

    const events = await service.createManaged({
      title: '邮件失败仍保留日程',
      startAt: '2026-07-17T09:00:00+08:00',
      endAt: '2026-07-17T10:00:00+08:00',
      ownerId: 'owner-1',
      ownerEmail: 'owner@example.com',
      tenantId: 'tenant-1',
      attendeeEmails: ['colleague@example.com'],
    });

    expect(events).toHaveLength(1);
    expect(await ctx.calendarRepo.findById(events[0].id)).not.toBeNull();
    expect(service.getDeliveryWarnings()).toEqual(['SMTP authentication failed']);
  });

  it('does not fail calendar creation when the activity-log repository is unavailable during dev hot reload', async () => {
    const hotReloadStore = createInMemoryStore() as ReturnType<typeof createInMemoryStore> & {
      calendarActivityLogs?: unknown;
    };
    Reflect.deleteProperty(hotReloadStore, 'calendarActivityLogs');
    setStore(hotReloadStore as ReturnType<typeof createInMemoryStore>);
    const { service, ctx } = createService();

    const events = await service.createManaged({
      title: '记录仓库缺失也能创建',
      startAt: '2026-07-17T09:00:00+08:00',
      endAt: '2026-07-17T10:00:00+08:00',
      ownerId: 'owner-1',
      ownerEmail: 'owner@example.com',
      tenantId: 'tenant-1',
      attendeeEmails: ['colleague@example.com'],
    });

    expect(events).toHaveLength(1);
    expect(await ctx.calendarRepo.findById(events[0].id)).not.toBeNull();
    expect(await listCalendarActivities({ tenantId: 'tenant-1' })).toMatchObject({ total: 0 });
  });

  it('updates the selected and future instances and reschedules pending reminders', async () => {
    const { service, ctx, sentEmails } = createService();
    const events = await service.createManaged({
      title: '每日站会',
      startAt: '2026-07-17T09:00:00+08:00',
      endAt: '2026-07-17T09:30:00+08:00',
      ownerId: 'owner-1',
      ownerEmail: 'owner@example.com',
      tenantId: 'tenant-1',
      attendeeEmails: ['colleague@example.com'],
      reminderMinutes: 10,
      recurrence: { frequency: 'daily', interval: 1, end: { type: 'count', count: 3 } },
    });

    const updated = await service.updateManaged(events[1].id, 'owner-1', 'future', {
      title: '每日进度同步',
      startAt: '2026-07-18T10:00:00+08:00',
      endAt: '2026-07-18T10:30:00+08:00',
      reminderMinutes: 20,
    });

    expect(updated).toHaveLength(2);
    expect((await ctx.calendarRepo.findById(events[0].id))?.title).toBe('每日站会');
    expect((await ctx.calendarRepo.findById(events[1].id))?.startAt).toBe('2026-07-18T02:00:00.000Z');
    expect((await ctx.calendarRepo.findById(events[2].id))?.startAt).toBe('2026-07-19T02:00:00.000Z');
    const activeReminders = await ctx.calendarReminderRepo.list({ tenantId: 'tenant-1', status: 'pending' });
    expect(activeReminders).toHaveLength(6);
    expect(sentEmails.at(-1)?.subject).toBe('【日程变更】每日进度同步');
    expect(sentEmails.at(-1)?.to).toEqual(['colleague@example.com']);
  });

  it('soft-cancels the selected and future instances and cancels only pending reminders', async () => {
    const { service, ctx, sentEmails } = createService();
    const events = await service.createManaged({
      title: '评审会',
      startAt: '2026-07-17T13:00:00+08:00',
      endAt: '2026-07-17T14:00:00+08:00',
      ownerId: 'owner-1',
      ownerEmail: 'owner@example.com',
      tenantId: 'tenant-1',
      attendeeEmails: ['colleague@example.com'],
      reminderMinutes: 15,
      recurrence: { frequency: 'daily', interval: 1, end: { type: 'count', count: 3 } },
    });

    const cancelled = await service.cancelManaged(events[1].id, 'owner-1', 'future');

    expect(cancelled.map((event) => event.status)).toEqual(['cancelled', 'cancelled']);
    expect((await ctx.calendarRepo.findById(events[0].id))?.status).toBe('confirmed');
    expect(await ctx.calendarReminderRepo.list({ status: 'pending' })).toHaveLength(2);
    expect(await ctx.calendarReminderRepo.list({ status: 'cancelled' })).toHaveLength(4);
    expect(sentEmails.at(-1)?.subject).toBe('【日程取消】评审会');
    expect(sentEmails.at(-1)?.to).toEqual(['colleague@example.com']);
    const activities = await listCalendarActivities({ tenantId: 'tenant-1' });
    expect(activities.items.find((item) => item.action === 'event.cancelled')).toMatchObject({
      action: 'event.cancelled',
      eventTitle: '评审会',
      scope: 'future',
    });
  });

  it('marks overlapping visible events as conflicts without treating adjacent events as conflicts', async () => {
    const { service } = createService();
    const base = {
      ownerId: 'owner-1',
      ownerEmail: 'owner@example.com',
      tenantId: 'tenant-1',
    };
    await service.createManaged({ ...base, title: 'A', startAt: '2026-07-17T09:00:00+08:00', endAt: '2026-07-17T10:00:00+08:00' });
    await service.createManaged({ ...base, title: 'B', startAt: '2026-07-17T09:30:00+08:00', endAt: '2026-07-17T10:30:00+08:00' });
    await service.createManaged({ ...base, title: 'C', startAt: '2026-07-17T10:30:00+08:00', endAt: '2026-07-17T11:00:00+08:00' });

    const visible = await service.listForUser('owner-1', 'tenant-1');

    expect(visible.map((event) => [event.title, event.hasConflict])).toEqual([
      ['A', true],
      ['B', true],
      ['C', false],
    ]);
  });

  it('enforces subscription detail approval, revocation, and cancellation', async () => {
    const { service, ctx } = createService();
    await service.createManaged({
      title: '管理层会议',
      description: '机密议题',
      startAt: '2026-07-17T09:00:00+08:00',
      endAt: '2026-07-17T10:00:00+08:00',
      ownerId: 'user-2',
      ownerEmail: 'colleague@example.com',
      tenantId: 'tenant-1',
    });
    const subscriptions = new CalendarSubscriptionService(ctx, { now: () => new Date('2026-07-16T02:00:00.000Z') });

    const subscription = await subscriptions.subscribe('owner-1', 'user-2', 'tenant-1', true);
    expect(subscription.detailPermission).toBe('pending');
    expect((await ctx.notificationRepo.findByUser('user-2'))[0].type).toBe('approval');

    const busyOnly = await service.listSubscribedCalendar('owner-1', 'user-2', 'tenant-1');
    expect(busyOnly[0]).toMatchObject({ title: '忙碌', description: null, attendees: [], visibility: 'busy' });

    await subscriptions.respond(subscription.id, 'user-2', 'approve');
    const full = await service.listSubscribedCalendar('owner-1', 'user-2', 'tenant-1');
    expect(full[0]).toMatchObject({
      title: '管理层会议',
      description: '机密议题',
      visibility: 'full',
      organizer: { id: 'user-2', name: 'Colleague', email: 'colleague@example.com' },
    });
    expect(busyOnly[0].organizer).toBeUndefined();

    await subscriptions.respond(subscription.id, 'user-2', 'revoke');
    expect((await service.listSubscribedCalendar('owner-1', 'user-2', 'tenant-1'))[0].title).toBe('忙碌');

    await subscriptions.cancel(subscription.id, 'owner-1');
    await expect(service.listSubscribedCalendar('owner-1', 'user-2', 'tenant-1'))
      .rejects.toMatchObject({ code: 'FORBIDDEN' });
    const activities = await listCalendarActivities({ tenantId: 'tenant-1' });
    expect(activities.items.map((item) => item.action)).toEqual(expect.arrayContaining([
      'subscription.created',
      'subscription.approved',
      'subscription.revoked',
      'subscription.cancelled',
    ]));
  });

  it('turns due reminder tasks into in-app notifications without sending reminder email', async () => {
    const { service, ctx, sentEmails } = createService();
    await service.createManaged({
      title: '即将开始的会议',
      startAt: '2026-07-16T10:10:00+08:00',
      endAt: '2026-07-16T11:00:00+08:00',
      ownerId: 'owner-1',
      ownerEmail: 'owner@example.com',
      tenantId: 'tenant-1',
      reminderMinutes: 15,
    });

    const fired = await service.processDueReminders('owner-1', 'tenant-1');

    expect(fired).toHaveLength(1);
    expect((await ctx.notificationRepo.findByUser('owner-1'))[0]).toMatchObject({
      type: 'reminder',
      title: '日程提醒: 即将开始的会议',
    });
    expect(await ctx.reminderTaskRepo.list({ status: 'sent' })).toHaveLength(1);
    expect(sentEmails).toHaveLength(0);
  });

  it('honors the week interval and selected weekdays for custom recurrence', async () => {
    const { service } = createService();
    const events = await service.createManaged({
      title: '隔周同步',
      startAt: '2026-07-20T09:00:00+08:00',
      endAt: '2026-07-20T10:00:00+08:00',
      ownerId: 'owner-1',
      ownerEmail: 'owner@example.com',
      tenantId: 'tenant-1',
      recurrence: {
        frequency: 'custom',
        interval: 2,
        weekdays: [1, 3],
        end: { type: 'count', count: 3 },
      },
    });

    expect(events.map((event) => event.startAt)).toEqual([
      '2026-07-20T01:00:00.000Z',
      '2026-07-22T01:00:00.000Z',
      '2026-08-03T01:00:00.000Z',
    ]);
  });

  it('keeps the original day anchor for monthly recurrence across shorter months', async () => {
    const { service } = createService(new Date('2026-01-01T02:00:00.000Z'));
    const events = await service.createManaged({
      title: '月末结算',
      startAt: '2026-01-31T09:00:00+08:00',
      endAt: '2026-01-31T10:00:00+08:00',
      ownerId: 'owner-1',
      ownerEmail: 'owner@example.com',
      tenantId: 'tenant-1',
      recurrence: {
        frequency: 'monthly',
        interval: 1,
        end: { type: 'count', count: 3 },
      },
    });

    expect(events.map((event) => event.startAt)).toEqual([
      '2026-01-31T01:00:00.000Z',
      '2026-02-28T01:00:00.000Z',
      '2026-03-31T01:00:00.000Z',
    ]);
  });

  it('rematerializes a series when its recurrence rule changes', async () => {
    const { service, ctx } = createService();
    const events = await service.createManaged({
      title: '规则调整',
      startAt: '2026-07-20T09:00:00+08:00',
      endAt: '2026-07-20T10:00:00+08:00',
      ownerId: 'owner-1',
      ownerEmail: 'owner@example.com',
      tenantId: 'tenant-1',
      reminderMinutes: 10,
      recurrence: { frequency: 'daily', interval: 1, end: { type: 'count', count: 3 } },
    });

    const updated = await service.updateManaged(events[1].id, 'owner-1', 'series', {
      recurrence: { frequency: 'weekly', interval: 1, weekdays: [1], end: { type: 'count', count: 2 } },
    });

    expect(updated.filter((event) => event.status === 'confirmed').map((event) => event.startAt)).toEqual([
      '2026-07-20T01:00:00.000Z',
      '2026-07-27T01:00:00.000Z',
    ]);
    expect((await ctx.calendarRepo.findById(events[2].id))?.status).toBe('cancelled');
    expect(await ctx.calendarReminderRepo.list({ status: 'pending' })).toHaveLength(2);
  });

  it('does not recreate a reminder that already fired when only event content changes', async () => {
    const { service, ctx } = createService();
    const [event] = await service.createManaged({
      title: '原标题',
      startAt: '2026-07-16T10:10:00+08:00',
      endAt: '2026-07-16T11:00:00+08:00',
      ownerId: 'owner-1',
      ownerEmail: 'owner@example.com',
      tenantId: 'tenant-1',
      reminderMinutes: 15,
    });
    await service.processDueReminders('owner-1', 'tenant-1');

    await service.updateManaged(event.id, 'owner-1', 'single', { title: '新标题' });

    expect(await ctx.reminderTaskRepo.list({ status: 'sent' })).toHaveLength(1);
    expect(await ctx.calendarReminderRepo.list({ status: 'pending' })).toHaveLength(0);
  });

  it('converts a single event into a recurring series', async () => {
    const { service } = createService();
    const [event] = await service.createManaged({
      title: '单次同步',
      startAt: '2026-07-20T09:00:00+08:00',
      endAt: '2026-07-20T10:00:00+08:00',
      ownerId: 'owner-1',
      ownerEmail: 'owner@example.com',
      tenantId: 'tenant-1',
    });

    const updated = await service.updateManaged(event.id, 'owner-1', 'single', {
      recurrence: { frequency: 'daily', interval: 1, end: { type: 'count', count: 2 } },
    });

    expect(updated).toHaveLength(2);
    expect(updated[0].seriesId).toBeTruthy();
    expect(updated[1].seriesId).toBe(updated[0].seriesId);
  });

  it('does not retroactively join an external attendee who registers later', async () => {
    const users = [{ id: 'owner-1', email: 'owner@example.com', name: 'Owner' }];
    const { service } = createService(new Date('2026-07-16T02:00:00.000Z'), users);
    const [event] = await service.createManaged({
      title: '外部访谈',
      startAt: '2026-07-20T09:00:00+08:00',
      endAt: '2026-07-20T10:00:00+08:00',
      ownerId: 'owner-1',
      ownerEmail: 'owner@example.com',
      tenantId: 'tenant-1',
      attendeeEmails: ['later@example.com'],
    });
    users.push({ id: 'new-user', email: 'later@example.com', name: 'Later User' });

    const [updated] = await service.updateManaged(event.id, 'owner-1', 'single', { title: '外部访谈更新' });

    expect(updated.attendees).toEqual([]);
    expect(updated.externalAttendeeEmails).toEqual(['later@example.com']);
  });

  it('creates events via async job with progress steps and resumable checkpoints', async () => {
    const { service, ctx, sentEmails } = createService();
    const { getCalendarJobStore } = await import('@/lib/calendar/job-store');
    const store = getCalendarJobStore();

    const job = await store.create({
      title: '异步创建测试',
      startAt: '2026-07-17T09:00:00+08:00',
      endAt: '2026-07-17T10:00:00+08:00',
      ownerId: 'owner-1',
      ownerEmail: 'owner@example.com',
      ownerName: 'Owner',
      tenantId: 'tenant-1',
      attendeeEmails: ['colleague@example.com', 'outside@example.net'],
      reminderMinutes: 15,
    });

    await service.createManagedAsync(job);

    const finalJob = await store.get(job.id);
    expect(finalJob?.status).toBe('completed');
    expect(finalJob?.steps.find((step) => step.key === 'finalizing')?.status).toBe('done');
    expect(finalJob?.persistedEventIds).toHaveLength(1);

    // Attendee should be able to see the event
    const visible = await service.listForUser('user-2', 'tenant-1');
    expect(visible).toHaveLength(1);
    expect(visible[0].title).toBe('异步创建测试');

    // Email is delivered in the background as one batched message.
    const emailedJob = await waitForCalendarJob(job.id, (item) => item.emailSent);
    expect(emailedJob.steps.find((step) => step.key === 'sending_emails')?.detail).toBe('已批量发送给 2 个收件人');
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].to).toContain('colleague@example.com');
    expect(sentEmails[0].to).toContain('outside@example.net');
    expect(sentEmails[0].to).not.toContain('owner@example.com');

    // Reminders created
    const reminders = await ctx.calendarReminderRepo.list({ tenantId: 'tenant-1' });
    expect(reminders).toHaveLength(2);
  });

  it('completes calendar creation before slow background email delivery finishes', async () => {
    let resolveEmail!: (value: { ok: boolean }) => void;
    const slowEmail = new Promise<{ ok: boolean }>((resolve) => {
      resolveEmail = resolve;
    });
    const { service, sentEmails } = createService(
      new Date('2026-07-16T02:00:00.000Z'),
      undefined,
      async () => slowEmail,
    );
    const { getCalendarJobStore } = await import('@/lib/calendar/job-store');
    const store = getCalendarJobStore();

    const job = await store.create({
      title: '慢邮件不阻塞',
      startAt: '2026-07-17T09:00:00+08:00',
      endAt: '2026-07-17T10:00:00+08:00',
      ownerId: 'owner-1',
      ownerEmail: 'owner@example.com',
      ownerName: 'Owner',
      tenantId: 'tenant-1',
      attendeeEmails: ['colleague@example.com', 'outside@example.net'],
      reminderMinutes: 15,
    });

    await service.createManagedAsync(job);

    const completedBeforeEmail = await store.get(job.id);
    expect(completedBeforeEmail?.status).toBe('completed');
    expect(completedBeforeEmail?.emailSent).toBe(false);
    expect(completedBeforeEmail?.steps.find((step) => step.key === 'sending_emails')?.status).toBe('in_progress');
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].to).toEqual(['colleague@example.com', 'outside@example.net']);

    resolveEmail({ ok: true });

    const sentJob = await waitForCalendarJob(job.id, (item) =>
      item.steps.find((step) => step.key === 'sending_emails')?.status === 'done'
    );
    expect(sentJob.steps.find((step) => step.key === 'sending_emails')?.status).toBe('done');
  });

  it('resumes an async job from the last checkpoint after a simulated failure', async () => {
    const { service, ctx, sentEmails } = createService();
    const { getCalendarJobStore } = await import('@/lib/calendar/job-store');
    const store = getCalendarJobStore();

    const job = await store.create({
      title: '断点续传测试',
      startAt: '2026-07-17T09:00:00+08:00',
      endAt: '2026-07-17T10:00:00+08:00',
      ownerId: 'owner-1',
      ownerEmail: 'owner@example.com',
      tenantId: 'tenant-1',
      attendeeEmails: ['colleague@example.com'],
      reminderMinutes: 10,
    });

    // Simulate partial progress: events created, but email not sent
    await store.markStep(job.id, 'validating', 'done');
    await store.markStep(job.id, 'creating_events', 'in_progress');
    // Manually create the event (simulating checkpoint)
    const event = await ctx.calendarRepo.create({
      title: '断点续传测试',
      description: null,
      startAt: '2026-07-17T01:00:00.000Z',
      endAt: '2026-07-17T02:00:00.000Z',
      timezone: 'Asia/Shanghai',
      allDay: false,
      recurringRule: null,
      ownerId: 'owner-1',
      attendees: ['user-2'],
      attendeeEmails: ['colleague@example.com'],
      externalAttendeeEmails: [],
      reminderMinutes: 10,
      seriesId: null,
      recurrenceIndex: null,
      location: null,
      meetingUrl: null,
      calendarSource: 'manual',
      externalId: null,
      status: 'confirmed',
      tenantId: 'tenant-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await store.addPersistedEventId(job.id, event.id);
    await store.markStep(job.id, 'creating_events', 'done');
    await store.update(job.id, { status: 'partial', error: 'simulated crash' });

    // Resume — should skip already-done steps and only do reminders + email
    await service.resumeCreateJob(job.id);

    const finalJob = await store.get(job.id);
    expect(finalJob?.status).toBe('completed');
    await waitForCalendarJob(job.id, (item) => item.emailSent);

    // Only 1 event (not duplicated)
    const allEvents = await ctx.calendarRepo.list({ tenantId: 'tenant-1' });
    expect(allEvents).toHaveLength(1);

    // Email sent after resume
    expect(sentEmails).toHaveLength(1);
  });

  it('keeps an async create job resumable when email delivery fails after events are visible', async () => {
    let emailAvailable = false;
    const { service, ctx, sentEmails } = createService(
      new Date('2026-07-16T02:00:00.000Z'),
      undefined,
      () => emailAvailable ? { ok: true } : { ok: false, error: 'SMTP temporarily unavailable' },
    );
    const { getCalendarJobStore } = await import('@/lib/calendar/job-store');
    const store = getCalendarJobStore();

    const job = await store.create({
      title: '邮件失败后续传',
      startAt: '2026-07-17T09:00:00+08:00',
      endAt: '2026-07-17T10:00:00+08:00',
      ownerId: 'owner-1',
      ownerEmail: 'owner@example.com',
      tenantId: 'tenant-1',
      attendeeEmails: ['colleague@example.com'],
      reminderMinutes: 10,
    });

    await service.createManagedAsync(job);

    const failedEmail = await waitForCalendarJob(job.id, (item) =>
      item.steps.find((step) => step.key === 'sending_emails')?.status === 'failed'
    );
    expect(failedEmail.status).toBe('completed');
    expect(failedEmail.emailSent).toBe(false);
    expect(failedEmail.persistedEventIds).toHaveLength(1);
    expect(await service.listForUser('user-2', 'tenant-1')).toHaveLength(1);

    emailAvailable = true;
    await service.resumeCreateJob(job.id);

    const completed = await waitForCalendarJob(job.id, (item) => item.emailSent);
    expect(completed?.status).toBe('completed');
    expect(completed?.emailSent).toBe(true);
    expect(await ctx.calendarRepo.list({ tenantId: 'tenant-1' })).toHaveLength(1);
    expect(sentEmails).toHaveLength(2);
  });

  it('does not resume a running async job and duplicate the email step', async () => {
    vi.useFakeTimers({ now: new Date('2026-07-16T02:00:00.000Z') });
    const { service, ctx, sentEmails } = createService(new Date('2026-07-16T02:00:00.000Z'));
    const { getCalendarJobStore } = await import('@/lib/calendar/job-store');
    const store = getCalendarJobStore();

    const job = await store.create({
      title: '防重复邮件',
      startAt: '2026-07-17T09:00:00+08:00',
      endAt: '2026-07-17T10:00:00+08:00',
      ownerId: 'owner-1',
      ownerEmail: 'owner@example.com',
      tenantId: 'tenant-1',
      attendeeEmails: ['colleague@example.com'],
      reminderMinutes: 10,
    });
    const event = await ctx.calendarRepo.create({
      title: '防重复邮件',
      description: null,
      startAt: '2026-07-17T01:00:00.000Z',
      endAt: '2026-07-17T02:00:00.000Z',
      timezone: 'Asia/Shanghai',
      allDay: false,
      recurringRule: null,
      ownerId: 'owner-1',
      attendees: ['user-2'],
      attendeeEmails: ['colleague@example.com'],
      externalAttendeeEmails: [],
      reminderMinutes: 10,
      seriesId: null,
      recurrenceIndex: null,
      location: null,
      meetingUrl: null,
      calendarSource: 'manual',
      externalId: null,
      status: 'confirmed',
      tenantId: 'tenant-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await store.addPersistedEventId(job.id, event.id);
    await store.markStep(job.id, 'validating', 'done');
    await store.markStep(job.id, 'creating_events', 'done');
    await store.markStep(job.id, 'creating_reminders', 'done');
    await store.markStep(job.id, 'sending_emails', 'in_progress');
    await store.update(job.id, { status: 'running' });

    vi.setSystemTime(new Date('2026-07-16T02:01:30.000Z'));
    await service.resumeCreateJob(job.id);

    expect(sentEmails).toHaveLength(0);
    expect((await store.get(job.id))?.steps.find((step) => step.key === 'sending_emails')?.status).toBe('in_progress');
  });
});
