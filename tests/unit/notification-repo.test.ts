import { describe, expect, it } from 'vitest';
import { InMemoryNotificationRepository } from '@/lib/repositories/memory-notification-repo';
import { NotificationService } from '@/lib/services/notification-service';

function createService() {
  const notificationRepo = new InMemoryNotificationRepository();
  const service = new NotificationService({ notificationRepo });
  return { notificationRepo, service };
}

describe('NotificationService', () => {
  it('does not count dismissed unread notifications in the badge count', async () => {
    const { service } = createService();
    const first = await service.create({
      userId: 'user-1',
      type: 'reminder',
      title: '日程提醒 1',
      priority: 'high',
      tenantId: 'tenant-1',
    });
    await service.create({
      userId: 'user-1',
      type: 'reminder',
      title: '日程提醒 2',
      priority: 'high',
      tenantId: 'tenant-1',
    });

    expect(await service.countUnread('user-1', { tenantId: 'tenant-1' })).toBe(2);

    await service.markDismissed(first.id);

    expect(await service.countUnread('user-1', { tenantId: 'tenant-1' })).toBe(1);
    expect(await service.list('user-1', { tenantId: 'tenant-1' })).toHaveLength(1);
  });

  it('paginates visible notifications and keeps dismissed items out of totals', async () => {
    const { service } = createService();
    const dismissed = await service.create({
      userId: 'user-1',
      type: 'system',
      title: '已删除',
      priority: 'normal',
      tenantId: 'tenant-1',
    });
    for (let i = 0; i < 12; i += 1) {
      await service.create({
        userId: 'user-1',
        type: 'system',
        title: `通知 ${i + 1}`,
        priority: 'normal',
        tenantId: 'tenant-1',
      });
    }
    await service.markDismissed(dismissed.id);

    expect(await service.count('user-1', { tenantId: 'tenant-1' })).toBe(12);
    expect(await service.list('user-1', { tenantId: 'tenant-1', limit: 10, offset: 0 })).toHaveLength(10);
    expect(await service.list('user-1', { tenantId: 'tenant-1', limit: 10, offset: 10 })).toHaveLength(2);
  });
});
