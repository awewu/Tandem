import type { ImChannel } from '@/lib/types/im';

const ORG_GROUP_SUFFIX_RE = /\s*(部门群|体系群)$/;

export function normalizeOrgChannelName(name: string): string {
  const trimmed = name.trim();
  const normalized = trimmed.replace(ORG_GROUP_SUFFIX_RE, '').trim();
  return normalized || trimmed;
}

export function displayImChannelName(channel: ImChannel): string {
  if (channel.type === 'department' || channel.type === 'team') {
    return normalizeOrgChannelName(channel.name);
  }
  return channel.name;
}
