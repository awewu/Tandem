import type { ImChannel } from '@/lib/types/im';

const CALENDAR_IM_TOPIC_RE = /calendar:event:[^|"]+\|(.+)$/;
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
  const topic = stripWrappingQuotes(channel.topic?.trim() ?? '');
  if (!topic) return undefined;

  const calendarMatch = CALENDAR_IM_TOPIC_RE.exec(topic);
  if (calendarMatch) {
    return stripWrappingQuotes(calendarMatch[1]?.trim() ?? '') || undefined;
  }

  return topic;
}

function stripWrappingQuotes(value: string): string {
  return value.replace(/^["'“”]+|["'“”]+$/g, '');
}
