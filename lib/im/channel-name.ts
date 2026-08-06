import type { ImChannel } from '@/lib/types/im';

const CALENDAR_IM_TOPIC_RE = /calendar:event:[^|"]+\|(.+)$/;
const CALENDAR_IM_TOPIC_WITH_TITLE_RE = /calendar:event:[^|"]+\|([^|]+)\|(.+)$/;
const ORG_GROUP_SUFFIX_RE = /\s*(部门群|体系群)$/;

export function normalizeOrgChannelName(name: string): string {
  const trimmed = stripWrappingQuotes(name.trim());
  const normalized = trimmed.replace(ORG_GROUP_SUFFIX_RE, '').trim();
  return normalized || trimmed;
}

export function displayImChannelName(channel: ImChannel): string {
  const name = stripWrappingQuotes(channel.name.trim());
  if (channel.type === 'department' || channel.type === 'team') {
    return normalizeOrgChannelName(name);
  }
  return name;
}

export function displayImChannelTopic(channel: ImChannel): string | undefined {
  return displayCalendarImTopicText(channel.topic);
}

export function displayImChannelSubtitle(channel: ImChannel): string | undefined {
  const topic = stripWrappingQuotes(channel.topic?.trim() ?? '');
  if (!topic) return undefined;

  const topicWithTitle = CALENDAR_IM_TOPIC_WITH_TITLE_RE.exec(topic);
  if (topicWithTitle) {
    const title = stripWrappingQuotes(topicWithTitle[1]?.trim() ?? '');
    const time = stripWrappingQuotes(topicWithTitle[2]?.trim() ?? '');
    return [title, time].filter(Boolean).join(' · ') || undefined;
  }

  const calendarMatch = CALENDAR_IM_TOPIC_RE.exec(topic);
  if (calendarMatch) {
    const title = calendarMeetingTitle(channel);
    const time = stripWrappingQuotes(calendarMatch[1]?.trim() ?? '');
    return [title, time].filter(Boolean).join(' · ') || undefined;
  }

  return displayCalendarImTopicText(channel.topic);
}

export function displayImChannelPreview(preview: string | undefined): string {
  return displayCalendarImTopicText(preview) ?? '';
}

function displayCalendarImTopicText(value: string | undefined): string | undefined {
  const topic = stripWrappingQuotes(value?.trim() ?? '');
  if (!topic) return undefined;

  const topicWithTitle = CALENDAR_IM_TOPIC_WITH_TITLE_RE.exec(topic);
  if (topicWithTitle) {
    return stripWrappingQuotes(topicWithTitle[2]?.trim() ?? '') || undefined;
  }

  const calendarMatch = CALENDAR_IM_TOPIC_RE.exec(topic);
  if (calendarMatch) {
    return stripWrappingQuotes(calendarMatch[1]?.trim() ?? '') || undefined;
  }

  return topic;
}

function calendarMeetingTitle(channel: ImChannel): string | undefined {
  const name = displayImChannelName(channel);
  const normalized = name.replace(/^会议[:：]\s*/, '').trim();
  return normalized || name || undefined;
}

function stripWrappingQuotes(value: string): string {
  return value.replace(/^["'“”]+|["'“”]+$/g, '');
}

export function getDmPeerId(channel: Pick<ImChannel, 'memberIds'>, currentUserId: string | null | undefined): string | null {
  if (!currentUserId) return null;
  return channel.memberIds.find((memberId) => memberId !== currentUserId) ?? null;
}
