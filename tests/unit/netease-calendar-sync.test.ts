import { describe, expect, it } from 'vitest';
import { syncNeteaseCalendar } from '@/lib/calendar/netease-sync';
import { InMemoryCalendarEventRepository } from '@/lib/repositories/memory-calendar-repo';
import type { NeteaseCalendarClientLike, NeteaseCalendarEvent } from '@/lib/integrations/netease-calendar';

function neteaseEvent(patch: Partial<NeteaseCalendarEvent> = {}): NeteaseCalendarEvent {
  return {
    externalId: 'netease:cal-1:evt-1',
    catalogId: 'cal-1',
    title: '网易同步会',
    description: '来自网易企业邮箱',
    startAt: '2026-07-20T01:00:00.000Z',
    endAt: '2026-07-20T02:00:00.000Z',
    timezone: 'Asia/Shanghai',
    allDay: false,
    location: 'A 会议室',
    meetingUrl: null,
    attendeeEmails: ['colleague@example.com', 'outside@example.net'],
    status: 'confirmed',
    raw: {},
    ...patch,
  };
}

function createFakeClient(events: NeteaseCalendarEvent[]): NeteaseCalendarClientLike {
  return { listEvents: async () => events };
}

describe('syncNeteaseCalendar', () => {
  it('imports NetEase calendar events without rejecting past dates', async () => {
    const repo = new InMemoryCalendarEventRepository();

    const result = await syncNeteaseCalendar({
      userId: 'owner-1',
      tenantId: 'tenant-1',
      email: 'owner@example.com',
      from: new Date('2026-07-01T00:00:00.000Z'),
      to: new Date('2026-07-31T00:00:00.000Z'),
    }, {
      calendarRepo: repo,
      getCredentials: async () => ({ account: 'owner@example.com', password: 'secret' }),
      createClient: () => createFakeClient([neteaseEvent({
        startAt: '2026-07-01T01:00:00.000Z',
        endAt: '2026-07-01T02:00:00.000Z',
      })]),
      listUsers: async () => [
        { id: 'owner-1', email: 'owner@example.com', name: 'Owner' },
        { id: 'user-2', email: 'colleague@example.com', name: 'Colleague' },
      ],
      now: () => new Date('2026-07-22T02:00:00.000Z'),
    });

    const events = await repo.list({ ownerId: 'owner-1', tenantId: 'tenant-1' });
    expect(result).toMatchObject({ created: 1, updated: 0, skipped: 0 });
    expect(events[0]).toMatchObject({
      title: '网易同步会',
      calendarSource: 'netease',
      externalId: 'netease:cal-1:evt-1',
      attendees: ['user-2'],
      externalAttendeeEmails: ['outside@example.net'],
    });
  });

  it('updates an existing NetEase event by externalId instead of duplicating it', async () => {
    const repo = new InMemoryCalendarEventRepository();
    const deps = {
      calendarRepo: repo,
      getCredentials: async () => ({ account: 'owner@example.com', password: 'secret' }),
      listUsers: async () => [{ id: 'owner-1', email: 'owner@example.com', name: 'Owner' }],
      now: () => new Date('2026-07-22T02:00:00.000Z'),
    };

    await syncNeteaseCalendar({
      userId: 'owner-1',
      tenantId: 'tenant-1',
      email: 'owner@example.com',
    }, {
      ...deps,
      createClient: () => createFakeClient([neteaseEvent()]),
    });

    const result = await syncNeteaseCalendar({
      userId: 'owner-1',
      tenantId: 'tenant-1',
      email: 'owner@example.com',
    }, {
      ...deps,
      createClient: () => createFakeClient([neteaseEvent({ title: '网易同步会 - 改期', location: 'B 会议室' })]),
    });

    const events = await repo.list({ ownerId: 'owner-1', tenantId: 'tenant-1' });
    expect(result).toMatchObject({ created: 0, updated: 1, skipped: 0 });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ title: '网易同步会 - 改期', location: 'B 会议室' });
  });

  it('returns a clear setup error when the user has not bound mailbox credentials', async () => {
    await expect(syncNeteaseCalendar({
      userId: 'owner-1',
      tenantId: 'tenant-1',
      email: 'owner@example.com',
    }, {
      getCredentials: async () => null,
      createClient: () => createFakeClient([]),
    })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: '未绑定公司邮箱，请先在邮箱设置里输入邮箱地址和密码。',
    });
  });
});
