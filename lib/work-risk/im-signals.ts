import type { ImChannel, ImMention, ImMessage } from '@/lib/types/im';
import type { WorkRiskPerson, WorkRiskSignal } from './types';

const WORK_KEYWORDS = ['安排', '待办', '跟进', '截止', '交付', '处理', '确认', '推进', '完成'];

export interface WorkRiskImChannelInput {
  subjectUserId: string;
  channel: Pick<ImChannel, 'id' | 'name' | 'type' | 'memberIds' | 'lastMessageAt' | 'lastMessagePreview'>;
  unreadCount: number;
  hasUnreadMention?: boolean;
  viewerIsMember: boolean;
}

export interface WorkRiskImMessageInput {
  channel: Pick<ImChannel, 'id' | 'name' | 'type' | 'memberIds'>;
  message: Pick<ImMessage, 'id' | 'body' | 'mentions' | 'senderId' | 'createdAt' | 'deletedAt'>;
}

function personName(peopleById: Map<string, WorkRiskPerson>, userId: string): string {
  return peopleById.get(userId)?.name ?? userId;
}

function channelLabel(channel: Pick<ImChannel, 'name' | 'type'>): string {
  if (channel.type === 'dm') return '私聊';
  return channel.name || '未命名频道';
}

function mentionLooksActionable(mention: ImMention): boolean {
  return mention.kind === 'assign' || mention.kind === 'consult';
}

function bodyLooksWorkArrangement(body: string): boolean {
  return WORK_KEYWORDS.some((keyword) => body.includes(keyword));
}

function excerpt(body: string): string {
  return body.replace(/\s+/g, ' ').trim().slice(0, 80);
}

export function buildImWorkRiskSignals(input: {
  viewerUserId: string;
  people: WorkRiskPerson[];
  channels: WorkRiskImChannelInput[];
  messages: WorkRiskImMessageInput[];
}): WorkRiskSignal[] {
  const visibleUserIds = new Set(input.people.map((p) => p.id));
  const peopleById = new Map(input.people.map((p) => [p.id, p]));
  const signals: WorkRiskSignal[] = [];
  const seen = new Set<string>();

  for (const item of input.channels) {
    if (!visibleUserIds.has(item.subjectUserId)) continue;
    if (!item.hasUnreadMention && item.unreadCount <= 0) continue;
    const restricted = !item.viewerIsMember;
    const id = `im:unread:${item.channel.id}:${item.subjectUserId}`;
    if (seen.has(id)) continue;
    seen.add(id);
    signals.push({
      id,
      source: 'im',
      subjectUserId: item.subjectUserId,
      subjectName: personName(peopleById, item.subjectUserId),
      severity: item.hasUnreadMention ? 'medium' : 'low',
      title: restricted
        ? item.hasUnreadMention
          ? '一个受限会话有未读 @ / 工作安排'
          : '一个受限会话有未读消息'
        : item.hasUnreadMention
        ? `${channelLabel(item.channel)} 有未读 @ / 工作安排`
        : `${channelLabel(item.channel)} 有 ${item.unreadCount} 条未读`,
      detail: restricted
        ? 'IM 原文受频道成员权限保护, 仅显示统计风险'
        : item.channel.lastMessagePreview || '请进入 IM 查看最新上下文',
      href: restricted ? undefined : `/im?ch=${encodeURIComponent(item.channel.id)}`,
      evidence: {
        visibility: restricted ? 'restricted' : 'full',
        label: restricted ? 'IM 证据受限' : 'IM 会话',
        href: restricted ? undefined : `/im?ch=${encodeURIComponent(item.channel.id)}`,
      },
    });
  }

  for (const item of input.messages) {
    if (item.message.deletedAt) continue;
    if (!item.channel.memberIds.includes(input.viewerUserId)) continue;
    if (!bodyLooksWorkArrangement(item.message.body)) continue;
    for (const mention of item.message.mentions) {
      if (!mentionLooksActionable(mention)) continue;
      if (!visibleUserIds.has(mention.userId)) continue;
      const id = `im:mention:${item.message.id}:${mention.userId}:${mention.kind}`;
      if (seen.has(id)) continue;
      seen.add(id);
      signals.push({
        id,
        source: 'im',
        subjectUserId: mention.userId,
        subjectName: personName(peopleById, mention.userId),
        severity: mention.kind === 'assign' ? 'medium' : 'low',
        title: `${channelLabel(item.channel)} 中有工作${mention.kind === 'assign' ? '指派' : '咨询'}`,
        detail: excerpt(item.message.body),
        href: `/im?ch=${encodeURIComponent(item.channel.id)}`,
        dueAt: item.message.createdAt,
        evidence: {
          visibility: 'full',
          label: 'IM 消息',
          href: `/im?ch=${encodeURIComponent(item.channel.id)}`,
        },
      });
    }
  }

  return signals;
}
