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
import { getStore, setStore } from '@/lib/storage/repository';
import { membershipKey } from '@/lib/types/im';

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
  emailResult: { ok: boolean; error?: string } | ((message: { to: string[]; subject: string; text: string; senderUserId?: string; senderEmail?: string }) => { ok: boolean; error?: string } | Promise<{ ok: boolean; error?: string }>) = { ok: true },
  senderCheckResult: { ok: boolean; error?: string } | ((message: { to: string[]; subject: string; text: string; senderUserId?: string; senderEmail?: string }) => { ok: boolean; error?: string } | Promise<{ ok: boolean; error?: string }>) = { ok: true },
) {
  const sentEmails: Array<{ to: string[]; subject: string; text: string; senderUserId?: string; senderEmail?: string }> = [];
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
    checkEmailSender: async (message) => (
      typeof senderCheckResult === 'function' ? await senderCheckResult(message) : senderCheckResult
    ),
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
    expect(sentEmails[0]).toMatchObject({
      senderUserId: 'owner-1',
      senderEmail: 'owner@example.com',
    });

    const activities = await listCalendarActivities({
      tenantId: 'tenant-1',
      viewerId: 'owner-1',
      viewerEmail: 'owner@example.com',
    });
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
    expect(await listCalendarActivities({
      tenantId: 'tenant-1',
      viewerId: 'owner-1',
      viewerEmail: 'owner@example.com',
    })).toMatchObject({ total: 0 });
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

  it('transfers selected and future instances to a meeting attendee and keeps the old owner as attendee', async () => {
    const { service, ctx } = createService(
      new Date('2026-07-16T02:00:00.000Z'),
      [
        { id: 'owner-1', email: 'owner@example.com', name: 'Owner' },
        { id: 'user-2', email: 'colleague@example.com', name: 'Colleague' },
        { id: 'user-3', email: 'second@example.com', name: 'Second' },
      ],
    );
    const events = await service.createManaged({
      title: '转交测试',
      startAt: '2026-07-17T09:00:00+08:00',
      endAt: '2026-07-17T09:30:00+08:00',
      ownerId: 'owner-1',
      ownerEmail: 'owner@example.com',
      tenantId: 'tenant-1',
      attendeeEmails: ['colleague@example.com', 'second@example.com'],
      reminderMinutes: 10,
      recurrence: { frequency: 'daily', interval: 1, end: { type: 'count', count: 3 } },
    });

    const updated = await service.transferOwnerManaged(events[1].id, 'owner-1', 'user-2', 'future', 'owner@example.com');

    expect(updated.map((event) => event.ownerId)).toEqual(['user-2', 'user-2']);
    expect((await ctx.calendarRepo.findById(events[0].id))?.ownerId).toBe('owner-1');
    expect((await ctx.calendarRepo.findById(events[1].id))?.attendees).toEqual(['user-3', 'owner-1']);
    expect((await ctx.calendarRepo.findById(events[1].id))?.attendeeEmails).toEqual(['second@example.com', 'owner@example.com']);
    expect(await service.listForUser('owner-1', 'tenant-1')).toHaveLength(3);
    expect(await service.listForUser('user-2', 'tenant-1')).toHaveLength(3);
    expect(await ctx.calendarReminderRepo.list({ userId: 'user-2', status: 'pending' })).toHaveLength(3);
  });

  it('rejects transferring a meeting to a non-attendee', async () => {
    const { service } = createService(
      new Date('2026-07-16T02:00:00.000Z'),
      [
        { id: 'owner-1', email: 'owner@example.com', name: 'Owner' },
        { id: 'user-2', email: 'colleague@example.com', name: 'Colleague' },
        { id: 'user-3', email: 'stranger@example.com', name: 'Stranger' },
      ],
    );
    const [event] = await service.createManaged({
      title: '转交校验',
      startAt: '2026-07-17T09:00:00+08:00',
      endAt: '2026-07-17T09:30:00+08:00',
      ownerId: 'owner-1',
      ownerEmail: 'owner@example.com',
      tenantId: 'tenant-1',
      attendeeEmails: ['colleague@example.com'],
      reminderMinutes: 10,
    });

    await expect(service.transferOwnerManaged(event.id, 'owner-1', 'user-3', 'single', 'owner@example.com'))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('lets an attendee transfer a meeting when the original owner account is unavailable', async () => {
    const { service, ctx } = createService(
      new Date('2026-07-16T02:00:00.000Z'),
      [
        { id: 'user-2', email: 'colleague@example.com', name: 'Colleague' },
        { id: 'user-3', email: 'second@example.com', name: 'Second' },
      ],
    );
    const [event] = await service.createManaged({
      title: '离职后参会人转交',
      startAt: '2026-07-17T09:00:00+08:00',
      endAt: '2026-07-17T09:30:00+08:00',
      ownerId: 'owner-1',
      ownerEmail: 'owner@example.com',
      tenantId: 'tenant-1',
      attendeeEmails: ['colleague@example.com', 'second@example.com'],
      reminderMinutes: 10,
    });
    const store = getStore();
    const channel = await store.imChannels.create({
      id: 'channel-disabled-owner-transfer',
      type: 'group',
      name: '离职后参会人转交',
      topic: `calendar:event:${event.id}|2026/07/17`,
      visibility: 'private',
      memberIds: ['owner-1', 'user-2', 'user-3'],
      createdBy: 'owner-1',
      tenantId: 'tenant-1',
      autoCreated: true,
      createdAt: '2026-07-16T02:00:00.000Z',
      updatedAt: '2026-07-16T02:00:00.000Z',
    });
    for (const userId of channel.memberIds) {
      await store.imMemberships.create({
        id: membershipKey(channel.id, userId),
        channelId: channel.id,
        userId,
        tenantId: 'tenant-1',
        role: userId === 'owner-1' ? 'owner' : 'member',
        joinedAt: '2026-07-16T02:00:00.000Z',
        unreadCount: 0,
        muted: false,
      });
    }

    const [updated] = await service.transferOwnerManaged(event.id, 'user-2', 'user-3', 'single', 'colleague@example.com');

    expect(updated.ownerId).toBe('user-3');
    expect((await ctx.calendarRepo.findById(event.id))?.attendees).toEqual(['user-2']);
    expect((await ctx.calendarRepo.findById(event.id))?.attendeeEmails).toEqual(['colleague@example.com']);
    expect((await store.imChannels.get(channel.id))?.memberIds).toEqual(['user-2', 'user-3']);
    expect((await store.imChannels.get(channel.id))?.createdBy).toBe('user-3');
    expect(await store.imMemberships.get(membershipKey(channel.id, 'owner-1'))).toBeNull();
    expect((await store.imMemberships.get(membershipKey(channel.id, 'user-3')))?.role).toBe('owner');
  });

  it('lets a privileged actor transfer a meeting owned by another user', async () => {
    const { service } = createService(
      new Date('2026-07-16T02:00:00.000Z'),
      [
        { id: 'owner-1', email: 'owner@example.com', name: 'Owner' },
        { id: 'user-2', email: 'colleague@example.com', name: 'Colleague' },
        { id: 'admin-1', email: 'admin@example.com', name: 'Admin' },
      ],
    );
    const [event] = await service.createManaged({
      title: '管理员代转',
      startAt: '2026-07-17T09:00:00+08:00',
      endAt: '2026-07-17T09:30:00+08:00',
      ownerId: 'owner-1',
      ownerEmail: 'owner@example.com',
      tenantId: 'tenant-1',
      attendeeEmails: ['colleague@example.com'],
      reminderMinutes: 10,
    });

    const [updated] = await service.transferOwnerManaged(event.id, 'admin-1', 'user-2', 'single', 'admin@example.com', {
      allowPrivilegedActor: true,
    });

    expect(updated.ownerId).toBe('user-2');
  });

  it('transfers the linked auto-created IM group owner with the calendar owner', async () => {
    const { service } = createService();
    const [event] = await service.createManaged({
      title: 'IM 转交测试',
      startAt: '2026-07-17T09:00:00+08:00',
      endAt: '2026-07-17T09:30:00+08:00',
      ownerId: 'owner-1',
      ownerEmail: 'owner@example.com',
      tenantId: 'tenant-1',
      attendeeEmails: ['colleague@example.com'],
      reminderMinutes: 10,
    });
    const store = getStore();
    const channel = await store.imChannels.create({
      id: 'channel-calendar-transfer',
      type: 'group',
      name: 'IM 转交测试',
      topic: `calendar:event:${event.id}|2026/07/17`,
      visibility: 'private',
      memberIds: ['owner-1', 'user-2'],
      createdBy: 'owner-1',
      tenantId: 'tenant-1',
      autoCreated: true,
      createdAt: '2026-07-16T02:00:00.000Z',
      updatedAt: '2026-07-16T02:00:00.000Z',
    });
    await store.imMemberships.create({
      id: membershipKey(channel.id, 'owner-1'),
      channelId: channel.id,
      userId: 'owner-1',
      role: 'owner',
      joinedAt: '2026-07-16T02:00:00.000Z',
      unreadCount: 0,
      muted: false,
    });
    await store.imMemberships.create({
      id: membershipKey(channel.id, 'user-2'),
      channelId: channel.id,
      userId: 'user-2',
      role: 'member',
      joinedAt: '2026-07-16T02:00:00.000Z',
      unreadCount: 0,
      muted: false,
    });

    await service.transferOwnerManaged(event.id, 'owner-1', 'user-2', 'single', 'owner@example.com');

    expect((await store.imChannels.get(channel.id))?.createdBy).toBe('user-2');
    expect((await store.imMemberships.get(membershipKey(channel.id, 'user-2')))?.role).toBe('owner');
    expect((await store.imMemberships.get(membershipKey(channel.id, 'owner-1')))?.role).toBe('admin');
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
    const activities = await listCalendarActivities({
      tenantId: 'tenant-1',
      viewerId: 'owner-1',
      viewerEmail: 'owner@example.com',
    });
    expect(activities.items.find((item) => item.action === 'event.cancelled')).toMatchObject({
      action: 'event.cancelled',
      eventTitle: '评审会',
      scope: 'future',
    });
  });

  it('lets an attendee leave selected and future instances without cancelling the organizer event', async () => {
    const { service, ctx } = createService();
    const events = await service.createManaged({
      title: '参与人退出测试',
      startAt: '2026-07-17T13:00:00+08:00',
      endAt: '2026-07-17T14:00:00+08:00',
      ownerId: 'owner-1',
      ownerEmail: 'owner@example.com',
      tenantId: 'tenant-1',
      attendeeEmails: ['colleague@example.com'],
      reminderMinutes: 15,
      recurrence: { frequency: 'daily', interval: 1, end: { type: 'count', count: 3 } },
    });

    const left = await service.leaveManaged(events[1].id, 'user-2', 'future', 'colleague@example.com');

    expect(left).toHaveLength(2);
    expect((await ctx.calendarRepo.findById(events[0].id))?.attendees).toEqual(['user-2']);
    expect((await ctx.calendarRepo.findById(events[1].id))?.attendees).toEqual([]);
    expect((await ctx.calendarRepo.findById(events[2].id))?.attendeeEmails).toEqual([]);
    expect((await service.listForUser('owner-1', 'tenant-1')).map((event) => event.status)).toEqual([
      'confirmed',
      'confirmed',
      'confirmed',
    ]);
    expect((await service.listForUser('user-2', 'tenant-1')).map((event) => event.id)).toEqual([events[0].id]);
    expect(await ctx.calendarReminderRepo.list({ userId: 'user-2', status: 'pending' })).toHaveLength(1);
    expect(await ctx.calendarReminderRepo.list({ userId: 'user-2', status: 'cancelled' })).toHaveLength(2);
    expect(await ctx.reminderTaskRepo.list({ userId: 'user-2', status: 'cancelled' })).toHaveLength(2);
    await expect(service.leaveManaged(events[0].id, 'stranger', 'single', 'stranger@example.com'))
      .rejects.toMatchObject({ code: 'FORBIDDEN' });

    const activities = await listCalendarActivities({
      tenantId: 'tenant-1',
      viewerId: 'owner-1',
      viewerEmail: 'owner@example.com',
    });
    expect(activities.items.find((item) => item.action === 'event.left')).toMatchObject({
      action: 'event.left',
      eventTitle: '参与人退出测试',
      actorId: 'user-2',
      scope: 'future',
    });
  });

  it('lets an attendee leave only one recurring instance', async () => {
    const { service, ctx } = createService();
    const events = await service.createManaged({
      title: '仅退出本次测试',
      startAt: '2026-07-17T13:00:00+08:00',
      endAt: '2026-07-17T14:00:00+08:00',
      ownerId: 'owner-1',
      ownerEmail: 'owner@example.com',
      tenantId: 'tenant-1',
      attendeeEmails: ['colleague@example.com'],
      reminderMinutes: 15,
      recurrence: { frequency: 'daily', interval: 1, end: { type: 'count', count: 3 } },
    });

    const left = await service.leaveManaged(events[1].id, 'user-2', 'single', 'colleague@example.com');

    expect(left).toHaveLength(1);
    expect((await ctx.calendarRepo.findById(events[0].id))?.attendees).toEqual(['user-2']);
    expect((await ctx.calendarRepo.findById(events[1].id))?.attendees).toEqual([]);
    expect((await ctx.calendarRepo.findById(events[2].id))?.attendees).toEqual(['user-2']);
    expect((await service.listForUser('owner-1', 'tenant-1')).map((event) => event.id)).toEqual(events.map((event) => event.id));
    expect((await service.listForUser('user-2', 'tenant-1')).map((event) => event.id)).toEqual([events[0].id, events[2].id]);
    expect(await ctx.calendarReminderRepo.list({ userId: 'user-2', status: 'pending' })).toHaveLength(2);
    expect(await ctx.calendarReminderRepo.list({ userId: 'user-2', status: 'cancelled' })).toHaveLength(1);
  });

  it('lets an attendee leave the whole recurring series', async () => {
    const { service, ctx } = createService();
    const events = await service.createManaged({
      title: '退出整个重复日程测试',
      startAt: '2026-07-17T13:00:00+08:00',
      endAt: '2026-07-17T14:00:00+08:00',
      ownerId: 'owner-1',
      ownerEmail: 'owner@example.com',
      tenantId: 'tenant-1',
      attendeeEmails: ['colleague@example.com'],
      reminderMinutes: 15,
      recurrence: { frequency: 'daily', interval: 1, end: { type: 'count', count: 3 } },
    });

    const left = await service.leaveManaged(events[1].id, 'user-2', 'series', 'colleague@example.com');

    expect(left).toHaveLength(3);
    expect((await service.listForUser('owner-1', 'tenant-1')).map((event) => event.status)).toEqual([
      'confirmed',
      'confirmed',
      'confirmed',
    ]);
    expect(await service.listForUser('user-2', 'tenant-1')).toHaveLength(0);
    expect(await ctx.calendarReminderRepo.list({ userId: 'user-2', status: 'pending' })).toHaveLength(0);
    expect(await ctx.calendarReminderRepo.list({ userId: 'user-2', status: 'cancelled' })).toHaveLength(3);
    expect(await ctx.reminderTaskRepo.list({ userId: 'user-2', status: 'cancelled' })).toHaveLength(3);
    expect((await ctx.calendarRepo.findById(events[0].id))?.attendeeEmails).toEqual([]);
    expect((await ctx.calendarRepo.findById(events[2].id))?.attendeeEmails).toEqual([]);
  });

  it('does not block attendee series leave on reminder cleanup', async () => {
    const { service, ctx } = createService();
    const events = await service.createManaged({
      title: '退出不等待提醒清理',
      startAt: '2026-07-17T13:00:00+08:00',
      endAt: '2026-07-17T14:00:00+08:00',
      ownerId: 'owner-1',
      ownerEmail: 'owner@example.com',
      tenantId: 'tenant-1',
      attendeeEmails: ['colleague@example.com'],
      reminderMinutes: 15,
      recurrence: { frequency: 'daily', interval: 1, end: { type: 'count', count: 3 } },
    });
    ctx.calendarReminderRepo.cancelByEventIdsForUser = async () => new Promise(() => undefined);

    const left = await service.leaveManaged(events[0].id, 'user-2', 'series', 'colleague@example.com', { sideEffects: 'background' });

    expect(left).toHaveLength(3);
    expect(left.every((event) => !event.attendees.includes('user-2'))).toBe(true);
    expect(await service.listForUser('user-2', 'tenant-1')).toHaveLength(0);
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
    const activities = await listCalendarActivities({
      tenantId: 'tenant-1',
      viewerId: 'owner-1',
      viewerEmail: 'owner@example.com',
    });
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

  it('limits open-ended weekly recurrence materialization to the next year', async () => {
    const { service } = createService();

    const events = await service.createManaged({
      title: '每周例会',
      startAt: '2026-07-17T09:00:00+08:00',
      endAt: '2026-07-17T10:00:00+08:00',
      ownerId: 'owner-1',
      ownerEmail: 'owner@example.com',
      tenantId: 'tenant-1',
      recurrence: {
        frequency: 'weekly',
        interval: 1,
        weekdays: [5],
        end: { type: 'never' },
      },
    });

    expect(events.length).toBeGreaterThanOrEqual(52);
    expect(events.length).toBeLessThan(60);
    expect(events.length).not.toBe(366);
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
    expect(completedBeforeEmail?.completedSteps).toBe(completedBeforeEmail?.totalSteps);
    expect(completedBeforeEmail?.steps.find((step) => step.key === 'sending_emails')?.status).toBe('done');
    expect(completedBeforeEmail?.steps.find((step) => step.key === 'sending_emails')?.detail).toBe('已移交后台投递，不影响日程创建');
    for (let attempt = 0; attempt < 20 && sentEmails.length === 0; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].to).toEqual(['colleague@example.com', 'outside@example.net']);

    resolveEmail({ ok: true });

    const sentJob = await waitForCalendarJob(job.id, (item) => item.emailSent);
    expect(sentJob.steps.find((step) => step.key === 'sending_emails')?.detail).toBe('已批量发送给 2 个收件人');
  });

  it('surfaces a warning and skips async email delivery when the organizer has no mailbox configured', async () => {
    const missingMailbox = '发起人 owner@example.com 未配置邮箱，日程已保存但邮件通知未发送；请先到「设置 - 邮箱」绑定并验证邮箱。';
    const { service, sentEmails } = createService(
      new Date('2026-07-16T02:00:00.000Z'),
      undefined,
      { ok: true },
      { ok: false, error: missingMailbox },
    );
    const { getCalendarJobStore } = await import('@/lib/calendar/job-store');
    const store = getCalendarJobStore();

    const job = await store.create({
      title: '无邮箱配置提示',
      startAt: '2026-07-17T09:00:00+08:00',
      endAt: '2026-07-17T10:00:00+08:00',
      ownerId: 'owner-1',
      ownerEmail: 'owner@example.com',
      ownerName: 'Owner',
      tenantId: 'tenant-1',
      attendeeEmails: ['colleague@example.com'],
      reminderMinutes: 15,
    });

    await service.createManagedAsync(job);

    const finalJob = await store.get(job.id);
    expect(finalJob?.status).toBe('completed');
    expect(finalJob?.emailSent).toBe(false);
    expect(finalJob?.result?.warnings).toEqual([missingMailbox]);
    expect(finalJob?.steps.find((step) => step.key === 'sending_emails')?.status).toBe('failed');
    expect(finalJob?.steps.find((step) => step.key === 'sending_emails')?.detail).toBe(missingMailbox);
    expect(sentEmails).toHaveLength(0);
  });

  it('repairs legacy completed async jobs whose email step is still spinning', async () => {
    const { getCalendarJobStore } = await import('@/lib/calendar/job-store');
    const store = getCalendarJobStore();
    const job = await store.create({
      title: '旧邮件进度修复',
      startAt: '2026-07-17T09:00:00+08:00',
      endAt: '2026-07-17T10:00:00+08:00',
      ownerId: 'owner-1',
      ownerEmail: 'owner@example.com',
      ownerName: 'Owner',
      tenantId: 'tenant-1',
      attendeeEmails: ['colleague@example.com'],
      reminderMinutes: 15,
    });

    await store.markStep(job.id, 'validating', 'done');
    await store.markStep(job.id, 'creating_events', 'done', '已创建 366 个日程实例');
    await store.markStep(job.id, 'creating_reminders', 'done', '已为 366 个日程生成提醒');
    await store.markStep(job.id, 'sending_emails', 'in_progress', '后台投递中，不影响日程创建');
    await store.markStep(job.id, 'finalizing', 'done');
    await store.update(job.id, { status: 'completed' });

    const repaired = await store.repairCompletedNotificationStep(job.id);

    expect(repaired?.status).toBe('completed');
    expect(repaired?.completedSteps).toBe(repaired?.totalSteps);
    expect(repaired?.steps.find((step) => step.key === 'sending_emails')?.status).toBe('done');
    expect(repaired?.steps.find((step) => step.key === 'sending_emails')?.detail).toBe('已移交后台投递，不影响日程创建');
  });

  it('does not fail async calendar creation when generic reminder storage is unavailable', async () => {
    const { service, ctx } = createService();
    const originalFindByDedupeKey = ctx.reminderTaskRepo.findByDedupeKey.bind(ctx.reminderTaskRepo);
    ctx.reminderTaskRepo.findByDedupeKey = async () => {
      throw new Error('ReminderTask table is unavailable');
    };
    const { getCalendarJobStore } = await import('@/lib/calendar/job-store');
    const store = getCalendarJobStore();

    const job = await store.create({
      title: '提醒表异常也保存',
      startAt: '2026-07-17T09:00:00+08:00',
      endAt: '2026-07-17T10:00:00+08:00',
      ownerId: 'owner-1',
      ownerEmail: 'owner@example.com',
      ownerName: 'Owner',
      tenantId: 'tenant-1',
      attendeeEmails: ['colleague@example.com'],
      reminderMinutes: 15,
    });

    await service.createManagedAsync(job);

    const finalJob = await store.get(job.id);
    expect(finalJob?.status).toBe('completed');
    expect(finalJob?.steps.find((step) => step.key === 'creating_reminders')?.status).toBe('done');
    expect(finalJob?.result?.warnings.some((warning) => warning.includes('提醒任务暂未生成'))).toBe(true);
    expect(await service.listForUser('user-2', 'tenant-1')).toHaveLength(1);

    ctx.reminderTaskRepo.findByDedupeKey = originalFindByDedupeKey;
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
