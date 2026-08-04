import { beforeEach, describe, expect, it } from 'vitest';
import { CalendarImReminderService } from '@/lib/services/calendar-im-reminder-service';
import { handoffCalendarAndImOnUserOffboarding } from '@/lib/services/user-offboarding-service';
import { InMemoryCalendarEventRepository } from '@/lib/repositories/memory-calendar-repo';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { getStore, setStore, type AuthUser } from '@/lib/storage/repository';
import { membershipKey } from '@/lib/types/im';
import type { CalendarEvent } from '@/lib/types/feishu-catchup';

const TENANT_ID = 'tenant-offboarding';

beforeEach(() => {
  setStore(createInMemoryStore());
});

describe('handoffCalendarAndImOnUserOffboarding', () => {
  it('transfers owned meetings to the earliest active attendee and removes owner-only emails', async () => {
    const calendarRepo = new InMemoryCalendarEventRepository();
    const owner = await createUser('owner@example.com');
    const disabledAttendee = await createUser('disabled@example.com', true);
    const firstActive = await createUser('first@example.com');
    const secondActive = await createUser('second@example.com');
    const event = await calendarRepo.create(eventDraft({
      id: 'evt-offboard-1',
      ownerId: owner.id,
      attendees: [disabledAttendee.id, firstActive.id, secondActive.id],
      attendeeEmails: [owner.email, disabledAttendee.email, firstActive.email, secondActive.email],
    }));

    const result = await handoffCalendarAndImOnUserOffboarding({
      ctx: { calendarRepo },
      departingUser: owner,
      tenantId: TENANT_ID,
    });
    const updated = await calendarRepo.findById(event.id);

    expect(result.calendarTransferred).toBe(1);
    expect(result.calendarSkipped).toBe(0);
    expect(updated?.ownerId).toBe(firstActive.id);
    expect(updated?.attendees).toEqual([disabledAttendee.id, secondActive.id]);
    expect(updated?.attendeeEmails).toEqual([disabledAttendee.email, secondActive.email]);
  });

  it('transfers the linked calendar IM group owner to the new meeting owner', async () => {
    const calendarRepo = new InMemoryCalendarEventRepository();
    const owner = await createUser('owner@example.com');
    const firstActive = await createUser('first@example.com');
    const secondActive = await createUser('second@example.com');
    const event = await calendarRepo.create(eventDraft({
      id: 'evt-offboard-im',
      ownerId: owner.id,
      attendees: [firstActive.id, secondActive.id],
      attendeeEmails: [firstActive.email, secondActive.email],
    }));
    const reminder = await new CalendarImReminderService({ calendarRepo }).remind(event.id, owner.id, TENANT_ID);
    await getStore().imChannels.create({
      id: 'unrelated-meeting-channel',
      type: 'group',
      name: 'Other meeting',
      topic: 'calendar:event:evt-unrelated|2026/08/05',
      visibility: 'private',
      memberIds: [owner.id, secondActive.id],
      createdBy: owner.id,
      tenantId: TENANT_ID,
      autoCreated: true,
      createdAt: '2026-08-04T00:00:00.000Z',
      updatedAt: '2026-08-04T00:00:00.000Z',
    });

    const result = await handoffCalendarAndImOnUserOffboarding({
      ctx: { calendarRepo },
      departingUser: owner,
      tenantId: TENANT_ID,
    });
    const store = getStore();
    const channel = await store.imChannels.get(reminder.channel.id);
    const departedMembership = await store.imMemberships.get(membershipKey(reminder.channel.id, owner.id));
    const successorMembership = await store.imMemberships.get(membershipKey(reminder.channel.id, firstActive.id));
    const otherMembership = await store.imMemberships.get(membershipKey(reminder.channel.id, secondActive.id));

    expect(result.calendarTransferred).toBe(1);
    expect(result.imTransferred).toBe(1);
    expect(result.imSkipped).toBe(0);
    expect(channel?.createdBy).toBe(firstActive.id);
    expect(channel?.memberIds).toEqual([firstActive.id, secondActive.id]);
    expect(departedMembership).toBeNull();
    expect(successorMembership?.role).toBe('owner');
    expect(otherMembership?.role).toBe('member');
  });

  it('transfers by attendee email when the meeting has no internal attendee ids', async () => {
    const calendarRepo = new InMemoryCalendarEventRepository();
    const owner = await createUser('owner@example.com');
    const firstActive = await createUser('first-by-email@example.com');
    const secondActive = await createUser('second-by-email@example.com');
    const event = await calendarRepo.create(eventDraft({
      id: 'evt-offboard-email-fallback',
      ownerId: owner.id,
      attendees: [],
      attendeeEmails: [firstActive.email, secondActive.email],
    }));
    const store = getStore();
    const channel = await store.imChannels.create({
      id: 'channel-email-fallback',
      type: 'group',
      name: 'Meeting email fallback',
      topic: 'calendar:event:evt-offboard-email-fallback|2026/08/05',
      visibility: 'private',
      memberIds: [owner.id],
      createdBy: owner.id,
      tenantId: TENANT_ID,
      autoCreated: true,
      createdAt: '2026-08-04T00:00:00.000Z',
      updatedAt: '2026-08-04T00:00:00.000Z',
    });
    await store.imMemberships.create({
      id: membershipKey(channel.id, owner.id),
      channelId: channel.id,
      userId: owner.id,
      role: 'owner',
      joinedAt: '2026-08-04T00:00:00.000Z',
      unreadCount: 0,
      muted: false,
    });

    const result = await handoffCalendarAndImOnUserOffboarding({
      ctx: { calendarRepo },
      departingUser: owner,
      tenantId: TENANT_ID,
    });
    const updated = await calendarRepo.findById(event.id);
    const updatedChannel = await store.imChannels.get(channel.id);
    const successorMembership = await store.imMemberships.get(membershipKey(channel.id, firstActive.id));

    expect(result.calendarTransferred).toBe(1);
    expect(result.imTransferred).toBe(1);
    expect(updated?.ownerId).toBe(firstActive.id);
    expect(updated?.attendees).toEqual([]);
    expect(updated?.attendeeEmails).toEqual([secondActive.email]);
    expect(updatedChannel?.createdBy).toBe(firstActive.id);
    expect(successorMembership?.role).toBe('owner');
  });

  it('transfers a meeting IM group created by a departing attendee to the meeting owner', async () => {
    const calendarRepo = new InMemoryCalendarEventRepository();
    const owner = await createUser('owner@example.com');
    const departingAttendee = await createUser('departing@example.com');
    const otherAttendee = await createUser('other@example.com');
    const event = await calendarRepo.create(eventDraft({
      id: 'evt-attendee-created-im',
      ownerId: owner.id,
      attendees: [departingAttendee.id, otherAttendee.id],
      attendeeEmails: [departingAttendee.email, otherAttendee.email],
    }));
    const reminder = await new CalendarImReminderService({ calendarRepo }).remind(
      event.id,
      departingAttendee.id,
      TENANT_ID,
    );

    const result = await handoffCalendarAndImOnUserOffboarding({
      ctx: { calendarRepo },
      departingUser: departingAttendee,
      tenantId: TENANT_ID,
    });
    const unchangedEvent = await calendarRepo.findById(event.id);
    const channel = await getStore().imChannels.get(reminder.channel.id);
    const ownerMembership = await getStore().imMemberships.get(membershipKey(reminder.channel.id, owner.id));
    const departedMembership = await getStore().imMemberships.get(membershipKey(reminder.channel.id, departingAttendee.id));

    expect(result.calendarTransferred).toBe(0);
    expect(result.imTransferred).toBe(1);
    expect(unchangedEvent?.ownerId).toBe(owner.id);
    expect(channel?.createdBy).toBe(owner.id);
    expect(channel?.memberIds).toEqual([owner.id, otherAttendee.id]);
    expect(ownerMembership?.role).toBe('owner');
    expect(departedMembership).toBeNull();
  });

  it('does not take over a meeting IM group that is already owned by another active user', async () => {
    const calendarRepo = new InMemoryCalendarEventRepository();
    const departingOwner = await createUser('owner@example.com');
    const groupOwner = await createUser('group-owner@example.com');
    const nextMeetingOwner = await createUser('next-owner@example.com');
    const event = await calendarRepo.create(eventDraft({
      id: 'evt-other-im-owner',
      ownerId: departingOwner.id,
      attendees: [nextMeetingOwner.id, groupOwner.id],
      attendeeEmails: [nextMeetingOwner.email, groupOwner.email],
    }));
    const reminder = await new CalendarImReminderService({ calendarRepo }).remind(event.id, groupOwner.id, TENANT_ID);

    const result = await handoffCalendarAndImOnUserOffboarding({
      ctx: { calendarRepo },
      departingUser: departingOwner,
      tenantId: TENANT_ID,
    });
    const updatedEvent = await calendarRepo.findById(event.id);
    const channel = await getStore().imChannels.get(reminder.channel.id);
    const groupOwnerMembership = await getStore().imMemberships.get(membershipKey(reminder.channel.id, groupOwner.id));

    expect(result.calendarTransferred).toBe(1);
    expect(result.imTransferred).toBe(0);
    expect(updatedEvent?.ownerId).toBe(nextMeetingOwner.id);
    expect(channel?.createdBy).toBe(groupOwner.id);
    expect(groupOwnerMembership?.role).toBe('owner');
  });

  it('keeps the meeting owner unchanged when there is no active attendee to receive ownership', async () => {
    const calendarRepo = new InMemoryCalendarEventRepository();
    const owner = await createUser('owner@example.com');
    const disabledAttendee = await createUser('disabled@example.com', true);
    const event = await calendarRepo.create(eventDraft({
      id: 'evt-offboard-skip',
      ownerId: owner.id,
      attendees: [disabledAttendee.id],
      attendeeEmails: [disabledAttendee.email],
    }));

    const result = await handoffCalendarAndImOnUserOffboarding({
      ctx: { calendarRepo },
      departingUser: owner,
      tenantId: TENANT_ID,
    });
    const updated = await calendarRepo.findById(event.id);

    expect(result.calendarTransferred).toBe(0);
    expect(result.calendarSkipped).toBe(1);
    expect(result.skippedEvents).toEqual([{ eventId: event.id, reason: 'no_eligible_attendee' }]);
    expect(updated?.ownerId).toBe(owner.id);
  });
});

async function createUser(email: string, disabled = false): Promise<AuthUser> {
  const store = getStore();
  const user = await store.auth.users.create({
    email,
    name: email.split('@')[0],
    roles: ['employee'],
    tenantId: TENANT_ID,
  });
  if (!disabled) return user;
  await store.auth.users.update(user.id, { disabled: true });
  return { ...user, disabled: true };
}

function eventDraft(patch: Partial<CalendarEvent> & Pick<CalendarEvent, 'id' | 'ownerId'>): Omit<CalendarEvent, 'id'> & { id: string } {
  return {
    id: patch.id,
    title: patch.title ?? 'Meeting',
    description: null,
    startAt: patch.startAt ?? '2026-08-05T02:00:00.000Z',
    endAt: patch.endAt ?? '2026-08-05T03:00:00.000Z',
    timezone: 'Asia/Shanghai',
    allDay: false,
    recurringRule: null,
    ownerId: patch.ownerId,
    attendees: patch.attendees ?? [],
    attendeeEmails: patch.attendeeEmails ?? [],
    externalAttendeeEmails: patch.externalAttendeeEmails ?? [],
    reminderMinutes: null,
    seriesId: patch.seriesId ?? null,
    recurrenceIndex: patch.recurrenceIndex ?? null,
    location: null,
    meetingUrl: null,
    calendarSource: 'manual',
    externalId: null,
    status: patch.status ?? 'confirmed',
    tenantId: TENANT_ID,
    createdAt: '2026-08-04T00:00:00.000Z',
    updatedAt: '2026-08-04T00:00:00.000Z',
  };
}
