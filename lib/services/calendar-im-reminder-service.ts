import type { ApplicationContext } from '@/lib/repositories/app-context';
import { DomainError, ForbiddenError, NotFoundError, ValidationError } from '@/lib/domain/errors';
import { getStore } from '@/lib/storage/repository';
import { createChannel, sendMessage } from '@/lib/im/service';
import { membershipKey, type ImChannel, type ImMessage } from '@/lib/types/im';
import type { CalendarEvent } from '@/lib/types/feishu-catchup';

type CalendarImReminderContext = Pick<ApplicationContext, 'calendarRepo'>;

export interface CalendarImReminderResult {
  event: CalendarEvent;
  channel: ImChannel;
  message: ImMessage;
  reused: boolean;
}

const CALENDAR_IM_TOPIC_PREFIX = 'calendar:event:';
const ACTIVE_EVENT_STATUSES = new Set<CalendarEvent['status']>(['confirmed', 'tentative']);

class CalendarImReminderError extends DomainError {
  constructor(code: string, message: string, metadata?: Record<string, unknown>) {
    super(code, message, 502, metadata);
  }
}

export class CalendarImReminderService {
  constructor(private readonly ctx: CalendarImReminderContext) {}

  async listCandidates(actorId: string, tenantId: string): Promise<CalendarEvent[]> {
    const events = await this.ctx.calendarRepo.list({ tenantId });
    const cancellationMarkers = await listCancellationMarkers(tenantId, events);
    return events
      .filter((event) => (event.ownerId === actorId || event.attendees.includes(actorId)))
      .filter((event) => ACTIVE_EVENT_STATUSES.has(event.status))
      .filter((event) => !cancellationMarkers.eventIds.has(event.id))
      .filter((event) => !event.seriesId || !cancellationMarkers.seriesIds.has(event.seriesId))
      .sort((a, b) => a.startAt.localeCompare(b.startAt));
  }

  async remind(eventId: string, actorId: string, tenantId: string): Promise<CalendarImReminderResult> {
    const event = await this.ctx.calendarRepo.findById(eventId);
    if (!event) throw new NotFoundError('CalendarEvent', eventId);
    if ((event.tenantId ?? 'default') !== tenantId) throw new NotFoundError('CalendarEvent', eventId);
    if (!ACTIVE_EVENT_STATUSES.has(event.status)) throw new ValidationError('已取消会议不可提醒');
    if (event.ownerId !== actorId && !event.attendees.includes(actorId)) {
      throw new ForbiddenError('只能提醒自己发起或参与的会议');
    }
    if (event.attendees.length === 0) {
      throw new ValidationError('该会议暂无可提醒的系统内参会人');
    }

    const memberIds = Array.from(new Set([actorId, event.ownerId, ...event.attendees].filter(Boolean)));
    const topic = topicForEvent(event.id);
    let existing: ImChannel | null = null;
    let channel: ImChannel;
    try {
      existing = await this.findExistingChannel(topic, tenantId);
      channel = existing
        ? await this.ensureMembers(existing, memberIds)
        : await createChannel({
            type: 'group',
            name: `会议：${event.title}`,
            topic,
            visibility: 'private',
            memberIds,
            createdBy: actorId,
            tenantId,
            autoCreated: true,
          });
    } catch (error) {
      throw new CalendarImReminderError('IM_CHANNEL_CREATE_FAILED', 'IM 群创建失败，请稍后重试', {
        cause: error instanceof Error ? error.message : String(error),
      });
    }

    let message: ImMessage;
    try {
      message = await sendMessage({
        channelId: channel.id,
        senderId: actorId,
        senderKind: 'system',
        body: buildReminderMessage(event),
      });
    } catch (error) {
      throw new CalendarImReminderError('IM_MESSAGE_SEND_FAILED', '群已创建，提醒消息发送失败', {
        channelId: channel.id,
        cause: error instanceof Error ? error.message : String(error),
      });
    }

    return { event, channel, message, reused: Boolean(existing) };
  }

  private async findExistingChannel(topic: string, tenantId: string): Promise<ImChannel | null> {
    const channels = await getStore().imChannels.list({ tenantId, topic });
    return channels.find((channel) => !channel.archivedAt) ?? null;
  }

  private async ensureMembers(channel: ImChannel, requiredMemberIds: string[]): Promise<ImChannel> {
    const store = getStore();
    const missing = requiredMemberIds.filter((userId) => !channel.memberIds.includes(userId));
    if (missing.length === 0) return channel;

    const now = new Date().toISOString();
    for (const userId of missing) {
      const id = membershipKey(channel.id, userId);
      const existing = await store.imMemberships.get(id);
      if (!existing) {
        await store.imMemberships.create({
          id,
          channelId: channel.id,
          userId,
          role: 'member',
          joinedAt: now,
          unreadCount: 0,
          muted: false,
        });
      }
    }

    return store.imChannels.update(channel.id, {
      memberIds: Array.from(new Set([...channel.memberIds, ...missing])),
      updatedAt: now,
    });
  }
}

function topicForEvent(eventId: string): string {
  return `${CALENDAR_IM_TOPIC_PREFIX}${eventId}`;
}

async function listCancellationMarkers(
  tenantId: string,
  events: CalendarEvent[],
): Promise<{ eventIds: Set<string>; seriesIds: Set<string> }> {
  const eventIds = new Set<string>();
  const seriesIds = new Set<string>();
  const eventsById = new Map(events.map((event) => [event.id, event]));
  for (const event of events) {
    if (event.status === 'cancelled') {
      eventIds.add(event.id);
      if (event.seriesId) seriesIds.add(event.seriesId);
    }
  }
  try {
    const repo = getStore().calendarActivityLogs;
    if (!repo) return { eventIds, seriesIds };
    const logs = await repo.list({ tenantId, action: 'event.cancelled' });
    for (const log of logs) {
      collectCancelledEventId(log.eventId, eventIds, seriesIds, eventsById);
      if (log.targetType === 'event') collectCancelledEventId(log.targetId, eventIds, seriesIds, eventsById);
      const metadataEventIds = log.metadata?.eventIds;
      if (Array.isArray(metadataEventIds)) {
        for (const eventId of metadataEventIds) {
          collectCancelledEventId(eventId, eventIds, seriesIds, eventsById);
        }
      }
    }
  } catch {
    // 日程记录是兜底信号，读取失败不影响正常的 status 过滤。
  }
  return { eventIds, seriesIds };
}

function collectCancelledEventId(
  eventId: unknown,
  eventIds: Set<string>,
  seriesIds: Set<string>,
  eventsById: Map<string, CalendarEvent>,
): void {
  if (typeof eventId !== 'string') return;
  eventIds.add(eventId);
  const event = eventsById.get(eventId);
  if (event?.seriesId) seriesIds.add(event.seriesId);
}

function buildReminderMessage(event: CalendarEvent): string {
  const place = event.location?.trim() || event.meetingUrl?.trim() || '未填写';
  return [
    `【会议提醒】${event.title}`,
    '',
    `开始时间：${formatDateTime(event.startAt)}`,
    `结束时间：${formatDateTime(event.endAt)}`,
    `地点/会议方式：${place}`,
    '',
    '请相关参会人准时参加。',
  ].join('\n');
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
