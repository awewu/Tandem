import { describe, expect, it } from 'vitest';
import { ReminderEngine } from '@/lib/services/reminder-engine';
import { InMemoryReminderTaskRepository } from '@/lib/repositories/memory-reminder-task-repo';
import { InMemoryNotificationRepository } from '@/lib/repositories/memory-notification-repo';

function createEngine(now = new Date('2026-07-20T03:00:00.000Z')) {
  const ctx = {
    reminderTaskRepo: new InMemoryReminderTaskRepository(),
    notificationRepo: new InMemoryNotificationRepository(),
  } as any;
  const engine = new ReminderEngine(ctx, { now: () => now });
  return { engine, ctx };
}

describe('ReminderEngine', () => {
  it('schedules a deduped task and processes due reminders into notifications', async () => {
    const { engine, ctx } = createEngine();
    await engine.schedule({
      tenantId: 'tenant-1',
      userId: 'user-1',
      sourceType: 'calendar_event',
      sourceId: 'event-1',
      title: '日程提醒: 项目例会',
      body: '11:00 开始',
      url: '/calendar',
      remindAt: '2026-07-20T02:59:00.000Z',
    });

    const result = await engine.processDue({ tenantId: 'tenant-1', userId: 'user-1' });

    expect(result).toMatchObject({ processed: 1, sent: 1, failed: 0 });
    expect(result.delivered[0].task.status).toBe('sent');
    expect(await ctx.notificationRepo.findByUser('user-1', { tenantId: 'tenant-1' })).toHaveLength(1);
  });

  it('reschedules an existing pending reminder with the same dedupe key', async () => {
    const { engine, ctx } = createEngine();
    const first = await engine.schedule({
      tenantId: 'tenant-1',
      userId: 'user-1',
      sourceType: 'okr_due',
      sourceId: 'kr-1',
      title: 'OKR 即将到期',
      remindAt: '2026-07-20T04:00:00.000Z',
    });
    const second = await engine.schedule({
      tenantId: 'tenant-1',
      userId: 'user-1',
      sourceType: 'okr_due',
      sourceId: 'kr-1',
      title: 'OKR 即将到期',
      remindAt: '2026-07-20T05:00:00.000Z',
    });

    expect(second.id).toBe(first.id);
    expect(second.remindAt).toBe('2026-07-20T05:00:00.000Z');
    expect(await ctx.reminderTaskRepo.list({ tenantId: 'tenant-1' })).toHaveLength(1);
  });

  it('cancels pending reminders by source', async () => {
    const { engine, ctx } = createEngine();
    await engine.schedule({
      tenantId: 'tenant-1',
      userId: 'user-1',
      sourceType: 'calendar_event',
      sourceId: 'event-1',
      title: '日程提醒',
      remindAt: '2026-07-20T02:59:00.000Z',
    });

    expect(await engine.cancelBySource('tenant-1', 'calendar_event', 'event-1')).toBe(1);
    expect(await ctx.reminderTaskRepo.list({ status: 'cancelled' })).toHaveLength(1);
    expect((await engine.processDue({ tenantId: 'tenant-1' })).processed).toBe(0);
  });

  it('claims due reminders before delivery so they are not picked twice', async () => {
    const { engine, ctx } = createEngine();
    await engine.schedule({
      tenantId: 'tenant-1',
      userId: 'user-1',
      sourceType: 'calendar_event',
      sourceId: 'event-1',
      title: '日程提醒',
      remindAt: '2026-07-20T02:59:00.000Z',
    });

    const claimed = await ctx.reminderTaskRepo.claimDue('2026-07-20T03:00:00.000Z', { tenantId: 'tenant-1' });

    expect(claimed).toHaveLength(1);
    expect((await engine.processDue({ tenantId: 'tenant-1' })).processed).toBe(0);
    expect(await ctx.notificationRepo.findByUser('user-1', { tenantId: 'tenant-1' })).toHaveLength(0);
  });

  it('does not duplicate notifications when two processors run at the same time', async () => {
    const { engine, ctx } = createEngine();
    await engine.schedule({
      tenantId: 'tenant-1',
      userId: 'user-1',
      sourceType: 'calendar_event',
      sourceId: 'event-1',
      title: '日程提醒',
      remindAt: '2026-07-20T02:59:00.000Z',
    });

    const [first, second] = await Promise.all([
      engine.processDue({ tenantId: 'tenant-1' }),
      engine.processDue({ tenantId: 'tenant-1' }),
    ]);

    expect(first.sent + second.sent).toBe(1);
    expect(await ctx.notificationRepo.findByUser('user-1', { tenantId: 'tenant-1' })).toHaveLength(1);
    expect(await ctx.reminderTaskRepo.list({ status: 'sent' })).toHaveLength(1);
  });

  it('records failures and retries failed reminders below the retry cap', async () => {
    const ctx = {
      reminderTaskRepo: new InMemoryReminderTaskRepository(),
      notificationRepo: {
        create: async () => {
          throw new Error('notification backend down');
        },
      },
    } as any;
    const engine = new ReminderEngine(ctx, { now: () => new Date('2026-07-20T03:00:00.000Z') });
    await engine.schedule({
      tenantId: 'tenant-1',
      userId: 'user-1',
      sourceType: 'okr_due',
      sourceId: 'kr-1',
      title: 'OKR 即将到期',
      remindAt: '2026-07-20T02:59:00.000Z',
    });

    expect(await engine.processDue({ tenantId: 'tenant-1' })).toMatchObject({ processed: 1, sent: 0, failed: 1 });
    expect(await engine.processDue({ tenantId: 'tenant-1' })).toMatchObject({ processed: 1, sent: 0, failed: 1 });

    const failed = await ctx.reminderTaskRepo.list({ status: 'failed' });
    expect(failed[0]).toMatchObject({ retryCount: 2, lastError: 'notification backend down' });
  });
});
