import { beforeEach, describe, expect, it } from 'vitest';
import { listCalendarActivities, recordCalendarActivity } from '@/lib/calendar/activity-log';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { setStore } from '@/lib/storage/repository';

beforeEach(() => {
  setStore(createInMemoryStore());
});

describe('Calendar activity visibility', () => {
  it('keeps event activity visible only to the actor and attendees', async () => {
    await recordCalendarActivity({
      tenantId: 'tenant-1',
      actorId: 'owner-1',
      actorEmail: 'owner@example.com',
      action: 'event.created',
      targetType: 'event',
      targetId: 'event-1',
      eventId: 'event-1',
      eventTitle: '私密日程',
      attendeeEmails: ['attendee@example.com'],
      occurredAt: '2026-07-22T08:00:00.000Z',
    });

    const owner = await listCalendarActivities({
      tenantId: 'tenant-1',
      viewerId: 'owner-1',
      viewerEmail: 'owner@example.com',
    });
    const attendee = await listCalendarActivities({
      tenantId: 'tenant-1',
      viewerId: 'attendee-1',
      viewerEmail: 'attendee@example.com',
    });
    const outsider = await listCalendarActivities({
      tenantId: 'tenant-1',
      viewerId: 'outsider-1',
      viewerEmail: 'outsider@example.com',
    });

    expect(owner.total).toBe(1);
    expect(attendee.total).toBe(1);
    expect(outsider.total).toBe(0);
  });

  it('keeps subscription activity visible only to both subscription sides', async () => {
    await recordCalendarActivity({
      tenantId: 'tenant-1',
      actorId: 'subscriber-1',
      action: 'subscription.created',
      targetType: 'subscription',
      targetId: 'subscription-1',
      subscriberId: 'subscriber-1',
      targetUserId: 'owner-1',
      occurredAt: '2026-07-22T08:00:00.000Z',
    });

    const subscriber = await listCalendarActivities({ tenantId: 'tenant-1', viewerId: 'subscriber-1' });
    const owner = await listCalendarActivities({ tenantId: 'tenant-1', viewerId: 'owner-1' });
    const outsider = await listCalendarActivities({ tenantId: 'tenant-1', viewerId: 'outsider-1' });

    expect(subscriber.total).toBe(1);
    expect(owner.total).toBe(1);
    expect(outsider.total).toBe(0);
  });
});
