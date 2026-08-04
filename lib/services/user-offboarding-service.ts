import type { ApplicationContext } from '@/lib/repositories/app-context';
import type { AuthUser } from '@/lib/storage/repository';
import { getStore } from '@/lib/storage/repository';
import type { CalendarEvent } from '@/lib/types/feishu-catchup';
import { membershipKey, type ImChannel } from '@/lib/types/im';
import { transferChannelOwnerForSystem } from '@/lib/im/service';
import { CALENDAR_IM_TOPIC_PREFIX, eventIdFromTopic } from '@/lib/services/calendar-im-reminder-service';

type UserOffboardingContext = Pick<ApplicationContext, 'calendarRepo'>;

export interface UserOffboardingHandoffResult {
  calendarTransferred: number;
  calendarSkipped: number;
  imTransferred: number;
  imSkipped: number;
  skippedEvents: Array<{ eventId: string; reason: 'no_eligible_attendee' | 'update_failed' }>;
  skippedChannels: Array<{ channelId: string; reason: 'transfer_failed' }>;
}

const ACTIVE_EVENT_STATUSES = new Set<CalendarEvent['status']>(['confirmed', 'tentative']);

export async function handoffCalendarAndImOnUserOffboarding(input: {
  ctx: UserOffboardingContext;
  departingUser: Pick<AuthUser, 'id' | 'email' | 'tenantId'>;
  tenantId?: string;
}): Promise<UserOffboardingHandoffResult> {
  const tenantId = input.tenantId ?? input.departingUser.tenantId ?? 'default';
  const store = getStore();
  const users = await store.auth.users.list({ tenantId });
  const activeUsersById = new Map(
    users
      .filter((user) => user.id !== input.departingUser.id)
      .filter((user) => user.disabled !== true)
      .map((user) => [user.id, user]),
  );
  const activeUsersByEmail = new Map(
    Array.from(activeUsersById.values()).map((user) => [normalizeEmail(user.email), user]),
  );
  const result: UserOffboardingHandoffResult = {
    calendarTransferred: 0,
    calendarSkipped: 0,
    imTransferred: 0,
    imSkipped: 0,
    skippedEvents: [],
    skippedChannels: [],
  };
  const transferredOwnerByEventId = new Map<string, string>();
  const events = await input.ctx.calendarRepo.list({
    ownerId: input.departingUser.id,
    tenantId,
  });

  for (const event of events) {
    if (!ACTIVE_EVENT_STATUSES.has(event.status)) continue;

    const successorId = pickEarliestEligibleAttendee(event, activeUsersById, activeUsersByEmail);
    if (!successorId) {
      result.calendarSkipped += 1;
      result.skippedEvents.push({ eventId: event.id, reason: 'no_eligible_attendee' });
      continue;
    }

    try {
      const successorEmail = activeUsersById.get(successorId)?.email;
      await input.ctx.calendarRepo.update(event.id, {
        ownerId: successorId,
        attendees: event.attendees.filter((userId) => userId !== input.departingUser.id && userId !== successorId),
        attendeeEmails: filterHandoffEmails(event.attendeeEmails, input.departingUser.email, successorEmail),
        externalAttendeeEmails: filterHandoffEmails(
          event.externalAttendeeEmails,
          input.departingUser.email,
          successorEmail,
        ),
        updatedAt: new Date().toISOString(),
      });
      transferredOwnerByEventId.set(event.id, successorId);
      result.calendarTransferred += 1;
    } catch {
      result.calendarSkipped += 1;
      result.skippedEvents.push({ eventId: event.id, reason: 'update_failed' });
    }
  }

  const imHandoff = await handoffLinkedMeetingChannels({
    calendarRepo: input.ctx.calendarRepo,
    tenantId,
    departingUserId: input.departingUser.id,
    transferredOwnerByEventId,
    activeUsersById,
    activeUsersByEmail,
  });
  result.imTransferred = imHandoff.imTransferred;
  result.imSkipped = imHandoff.imSkipped;
  result.skippedChannels = imHandoff.skippedChannels;

  return result;
}

function pickEarliestEligibleAttendee(
  event: CalendarEvent,
  activeUsersById: Map<string, AuthUser>,
  activeUsersByEmail: Map<string, AuthUser>,
): string | null {
  for (const attendeeId of event.attendees) {
    if (activeUsersById.has(attendeeId)) return attendeeId;
  }
  for (const attendeeEmail of event.attendeeEmails ?? []) {
    const user = activeUsersByEmail.get(normalizeEmail(attendeeEmail));
    if (user) return user.id;
  }
  return null;
}

function filterHandoffEmails(
  emails: string[] | undefined,
  departingEmail: string | undefined,
  successorEmail: string | undefined,
): string[] {
  const blocked = new Set(
    [departingEmail, successorEmail]
      .map((email) => normalizeEmail(email ?? ''))
      .filter(Boolean),
  );
  return (emails ?? []).filter((email) => !blocked.has(normalizeEmail(email)));
}

async function handoffLinkedMeetingChannels(input: {
  calendarRepo: UserOffboardingContext['calendarRepo'];
  tenantId: string;
  departingUserId: string;
  transferredOwnerByEventId: Map<string, string>;
  activeUsersById: Map<string, AuthUser>;
  activeUsersByEmail: Map<string, AuthUser>;
}): Promise<Pick<UserOffboardingHandoffResult, 'imTransferred' | 'imSkipped' | 'skippedChannels'>> {
  const result: Pick<UserOffboardingHandoffResult, 'imTransferred' | 'imSkipped' | 'skippedChannels'> = {
    imTransferred: 0,
    imSkipped: 0,
    skippedChannels: [],
  };

  const store = getStore();
  const channels = await store.imChannels.list({ tenantId: input.tenantId } as Partial<ImChannel>);
  for (const channel of channels) {
    if (channel.archivedAt || channel.autoCreated !== true || !channel.topic?.startsWith(CALENDAR_IM_TOPIC_PREFIX)) {
      continue;
    }

    const departingMembership = await store.imMemberships.get(membershipKey(channel.id, input.departingUserId));
    const departingUserOwnsGroup = channel.createdBy === input.departingUserId || departingMembership?.role === 'owner';
    if (!departingUserOwnsGroup) continue;

    const eventId = eventIdFromTopic(channel.topic);
    const event = await input.calendarRepo.findById(eventId);
    if (!event || (event.tenantId ?? 'default') !== input.tenantId) continue;
    const newOwnerId =
      input.transferredOwnerByEventId.get(eventId) ??
      pickLinkedChannelSuccessor(event, channel, input.departingUserId, input.activeUsersById, input.activeUsersByEmail);
    if (!newOwnerId) {
      continue;
    }

    try {
      await transferChannelOwnerForSystem(channel.id, newOwnerId, {
        removeUserId: input.departingUserId,
      });
      result.imTransferred += 1;
    } catch {
      result.imSkipped += 1;
      result.skippedChannels.push({ channelId: channel.id, reason: 'transfer_failed' });
    }
  }

  return result;
}

function pickLinkedChannelSuccessor(
  event: CalendarEvent | null,
  channel: ImChannel,
  departingUserId: string,
  activeUsersById: Map<string, AuthUser>,
  activeUsersByEmail: Map<string, AuthUser>,
): string | null {
  if (event?.ownerId && event.ownerId !== departingUserId && activeUsersById.has(event.ownerId)) {
    return event.ownerId;
  }
  if (event) {
    const attendee = pickEarliestEligibleAttendee(event, activeUsersById, activeUsersByEmail);
    if (attendee) return attendee;
  }
  return channel.memberIds.find((userId) => userId !== departingUserId && activeUsersById.has(userId)) ?? null;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
