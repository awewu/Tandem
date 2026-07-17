import { beforeEach, describe, expect, it } from 'vitest';
import { CalendarImReminderService } from '@/lib/services/calendar-im-reminder-service';
import { InMemoryCalendarEventRepository } from '@/lib/repositories/memory-calendar-repo';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { getStore, setStore } from '@/lib/storage/repository';

beforeEach(() => {
  setStore(createInMemoryStore());
});

function createService() {
  const calendarRepo = new InMemoryCalendarEventRepository();
  return {
    calendarRepo,
    service: new CalendarImReminderService({ calendarRepo }),
  };
}

describe('CalendarImReminderService', () => {
  it('creates a private IM group for internal attendees only and sends reminder message', async () => {
    const { calendarRepo, service } = createService();
    const event = await calendarRepo.create({
      id: 'evt-meeting-1',
      title: '项目例会',
      description: null,
      startAt: '2026-07-20T02:00:00.000Z',
      endAt: '2026-07-20T03:00:00.000Z',
      timezone: 'Asia/Shanghai',
      allDay: false,
      ownerId: 'owner-1',
      attendees: ['attendee-1'],
      attendeeEmails: ['attendee@example.com', 'external@example.com'],
      externalAttendeeEmails: ['external@example.com'],
      reminderMinutes: 15,
      location: 'A-301',
      meetingUrl: null,
      calendarSource: 'manual',
      status: 'confirmed',
      tenantId: 'tenant-1',
      createdAt: '2026-07-17T00:00:00.000Z',
      updatedAt: '2026-07-17T00:00:00.000Z',
    });

    const result = await service.remind(event.id, 'owner-1', 'tenant-1');

    expect(result.reused).toBe(false);
    expect(result.channel.visibility).toBe('private');
    expect(result.channel.topic).toBe('calendar:event:evt-meeting-1');
    expect(result.channel.memberIds).toEqual(['owner-1', 'attendee-1']);
    expect(result.channel.memberIds).not.toContain('external@example.com');
    expect(result.message.senderKind).toBe('system');
    expect(result.message.body).toContain('【会议提醒】项目例会');
    expect(result.message.body).toContain('地点/会议方式：A-301');
  });

  it('reuses the existing meeting group and adds newly required members', async () => {
    const { calendarRepo, service } = createService();
    const event = await calendarRepo.create({
      id: 'evt-meeting-2',
      title: '评审会',
      description: null,
      startAt: '2026-07-21T02:00:00.000Z',
      endAt: '2026-07-21T03:00:00.000Z',
      timezone: 'Asia/Shanghai',
      allDay: false,
      ownerId: 'owner-1',
      attendees: ['attendee-1'],
      attendeeEmails: ['attendee1@example.com'],
      externalAttendeeEmails: [],
      reminderMinutes: null,
      location: null,
      meetingUrl: 'https://meeting.example.com/room',
      calendarSource: 'manual',
      status: 'confirmed',
      tenantId: 'tenant-1',
      createdAt: '2026-07-17T00:00:00.000Z',
      updatedAt: '2026-07-17T00:00:00.000Z',
    });

    const first = await service.remind(event.id, 'owner-1', 'tenant-1');
    await calendarRepo.update(event.id, { attendees: ['attendee-1', 'attendee-2'] });
    const second = await service.remind(event.id, 'attendee-1', 'tenant-1');
    const store = getStore();
    const channels = await store.imChannels.list({ tenantId: 'tenant-1', topic: 'calendar:event:evt-meeting-2' });
    const messages = await store.imMessages.list({ channelId: first.channel.id });

    expect(second.reused).toBe(true);
    expect(second.channel.id).toBe(first.channel.id);
    expect(second.channel.memberIds).toEqual(['owner-1', 'attendee-1', 'attendee-2']);
    expect(channels).toHaveLength(1);
    expect(messages).toHaveLength(2);
    expect(second.message.body).toContain('地点/会议方式：https://meeting.example.com/room');
  });

  it('rejects meetings without internal attendees', async () => {
    const { calendarRepo, service } = createService();
    const event = await calendarRepo.create({
      id: 'evt-meeting-3',
      title: '无内部参会人',
      description: null,
      startAt: '2026-07-22T02:00:00.000Z',
      endAt: '2026-07-22T03:00:00.000Z',
      timezone: 'Asia/Shanghai',
      allDay: false,
      ownerId: 'owner-1',
      attendees: [],
      attendeeEmails: ['external@example.com'],
      externalAttendeeEmails: ['external@example.com'],
      reminderMinutes: null,
      location: null,
      meetingUrl: null,
      calendarSource: 'manual',
      status: 'confirmed',
      tenantId: 'tenant-1',
      createdAt: '2026-07-17T00:00:00.000Z',
      updatedAt: '2026-07-17T00:00:00.000Z',
    });

    await expect(service.remind(event.id, 'owner-1', 'tenant-1')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: '该会议暂无可提醒的系统内参会人',
    });
  });

  it('excludes cancelled meetings from IM reminder candidates', async () => {
    const { calendarRepo, service } = createService();
    await calendarRepo.create({
      id: 'evt-active',
      title: '有效会议',
      description: null,
      startAt: '2026-07-23T02:00:00.000Z',
      endAt: '2026-07-23T03:00:00.000Z',
      timezone: 'Asia/Shanghai',
      allDay: false,
      ownerId: 'owner-1',
      attendees: ['attendee-1'],
      attendeeEmails: ['attendee@example.com'],
      externalAttendeeEmails: [],
      reminderMinutes: null,
      location: null,
      meetingUrl: null,
      calendarSource: 'manual',
      status: 'confirmed',
      tenantId: 'tenant-1',
      createdAt: '2026-07-17T00:00:00.000Z',
      updatedAt: '2026-07-17T00:00:00.000Z',
    });
    await calendarRepo.create({
      id: 'evt-cancelled',
      title: '已取消会议',
      description: null,
      startAt: '2026-07-24T02:00:00.000Z',
      endAt: '2026-07-24T03:00:00.000Z',
      timezone: 'Asia/Shanghai',
      allDay: false,
      ownerId: 'owner-1',
      attendees: ['attendee-1'],
      attendeeEmails: ['attendee@example.com'],
      externalAttendeeEmails: [],
      reminderMinutes: null,
      location: null,
      meetingUrl: null,
      calendarSource: 'manual',
      status: 'cancelled',
      tenantId: 'tenant-1',
      createdAt: '2026-07-17T00:00:00.000Z',
      updatedAt: '2026-07-17T00:00:00.000Z',
    });

    const candidates = await service.listCandidates('owner-1', 'tenant-1');

    expect(candidates.map((event) => event.id)).toEqual(['evt-active']);
  });

  it('excludes events that have cancellation activity even if legacy status stayed active', async () => {
    const { calendarRepo, service } = createService();
    await calendarRepo.create({
      id: 'evt-legacy-active',
      title: '旧数据里状态残留有效的已删会议',
      description: null,
      startAt: '2026-07-25T02:00:00.000Z',
      endAt: '2026-07-25T03:00:00.000Z',
      timezone: 'Asia/Shanghai',
      allDay: false,
      ownerId: 'owner-1',
      attendees: ['attendee-1'],
      attendeeEmails: ['attendee@example.com'],
      externalAttendeeEmails: [],
      reminderMinutes: null,
      location: null,
      meetingUrl: null,
      calendarSource: 'manual',
      status: 'confirmed',
      tenantId: 'tenant-1',
      createdAt: '2026-07-17T00:00:00.000Z',
      updatedAt: '2026-07-17T00:00:00.000Z',
    });
    await getStore().calendarActivityLogs.create({
      id: 'calact-cancelled-legacy',
      tenantId: 'tenant-1',
      actorId: 'owner-1',
      action: 'event.cancelled',
      targetType: 'event',
      targetId: 'evt-legacy-active',
      eventId: 'evt-legacy-active',
      eventTitle: '旧数据里状态残留有效的已删会议',
      metadata: { eventIds: ['evt-legacy-active'] },
      occurredAt: '2026-07-17T00:00:00.000Z',
    });

    const candidates = await service.listCandidates('owner-1', 'tenant-1');

    expect(candidates.map((event) => event.id)).not.toContain('evt-legacy-active');
  });

  it('excludes remaining active instances from a recurring series after the series has cancellation traces', async () => {
    const { calendarRepo, service } = createService();
    await calendarRepo.create({
      id: 'evt-series-cancelled',
      title: '重复会议',
      description: null,
      startAt: '2026-07-24T02:00:00.000Z',
      endAt: '2026-07-24T03:00:00.000Z',
      timezone: 'Asia/Shanghai',
      allDay: false,
      ownerId: 'owner-1',
      attendees: ['attendee-1'],
      attendeeEmails: ['attendee@example.com'],
      externalAttendeeEmails: [],
      reminderMinutes: null,
      seriesId: 'series-a',
      recurrenceIndex: 0,
      location: null,
      meetingUrl: null,
      calendarSource: 'manual',
      status: 'cancelled',
      tenantId: 'tenant-1',
      createdAt: '2026-07-17T00:00:00.000Z',
      updatedAt: '2026-07-17T00:00:00.000Z',
    });
    await calendarRepo.create({
      id: 'evt-series-future-active',
      title: '重复会议',
      description: null,
      startAt: '2026-08-07T02:00:00.000Z',
      endAt: '2026-08-07T03:00:00.000Z',
      timezone: 'Asia/Shanghai',
      allDay: false,
      ownerId: 'owner-1',
      attendees: ['attendee-1'],
      attendeeEmails: ['attendee@example.com'],
      externalAttendeeEmails: [],
      reminderMinutes: null,
      seriesId: 'series-a',
      recurrenceIndex: 1,
      location: null,
      meetingUrl: null,
      calendarSource: 'manual',
      status: 'confirmed',
      tenantId: 'tenant-1',
      createdAt: '2026-07-17T00:00:00.000Z',
      updatedAt: '2026-07-17T00:00:00.000Z',
    });

    const candidates = await service.listCandidates('owner-1', 'tenant-1');

    expect(candidates.map((event) => event.id)).not.toContain('evt-series-future-active');
  });
});
