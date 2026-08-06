/**
 * IM 搜索 · 消息正文搜索
 *
 * 设计:
 *   - 只做词面检索, 不走语义向量搜索。
 *   - 聊天记录只返回正文包含搜索词的消息。
 *   - 权限边界: 只在【当前用户是成员】的频道内检索。
 */

import { getStore } from '../storage/repository';
import { extractPreview, type ImChannel, type ImMessage } from '../types/im';

const CACHE_TTL_MS = 30_000;

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const userNameCache = new Map<string, CacheEntry<string>>();

export interface ImSearchHit {
  messageId: string;
  channelId: string;
  channelName: string;
  senderId: string;
  senderKind: ImMessage['senderKind'];
  /** 去 markdown/mention 的预览片段 */
  preview: string;
  createdAt: string;
  /** 兼容前端展示的简单分值: 越新越靠前时无实际语义含义。 */
  score: number;
  /** 词面命中来源: 正文命中。 */
  matchKind?: 'body';
}

export interface SearchMessagesInput {
  userId: string;
  tenantId?: string;
  query: string;
  /** 限定单个频道内搜索 (需为当前用户可见, 否则空结果)。不传 = 跨所有可见频道。 */
  channelId?: string;
  limit?: number;
}

async function listMemberChannelIds(userId: string): Promise<string[]> {
  const store = getStore();
  const memberships = await store.imMemberships.list({ userId });
  return Array.from(new Set(memberships.map((membership) => membership.channelId).filter(Boolean)));
}

async function loadVisibleChannelsById(
  channelIds: string[],
  userId: string,
  tenantId?: string,
): Promise<Map<string, ImChannel>> {
  const store = getStore();
  const uniqueIds = Array.from(new Set(channelIds));
  const channels = await Promise.all(uniqueIds.map((channelId) => store.imChannels.get(channelId)));
  const visible = new Map<string, ImChannel>();
  for (const channel of channels) {
    if (!channel || channel.archivedAt) continue;
    if (tenantId && (channel.tenantId ?? 'default') !== tenantId) continue;
    if (!channel.memberIds.includes(userId)) continue;
    visible.set(channel.id, channel);
  }
  return visible;
}

async function resolveUserName(userId: string, tenantId?: string): Promise<string> {
  const cacheKey = `${tenantId ?? '*'}:${userId}`;
  const cached = userNameCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const store = getStore();
  const user = await store.auth.users.findById(userId).catch(() => null);
  const name = user?.name || user?.email || userId;
  userNameCache.set(cacheKey, {
    value: name,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  return name;
}

async function displayChannelName(
  channel: ImChannel,
  userId: string,
  tenantId?: string,
): Promise<string> {
  if (channel.type !== 'dm') return channel.name || '群聊';
  const otherId = channel.memberIds.find((memberId) => memberId !== userId);
  return otherId ? resolveUserName(otherId, tenantId) : '私聊';
}

async function toHit(
  message: ImMessage,
  channel: ImChannel,
  userId: string,
  tenantId: string | undefined,
  index: number,
  matchKind: ImSearchHit['matchKind'],
): Promise<ImSearchHit> {
  return {
    messageId: message.id,
    channelId: message.channelId,
    channelName: await displayChannelName(channel, userId, tenantId),
    senderId: message.senderId,
    senderKind: message.senderKind,
    preview: extractPreview(message.body ?? ''),
    createdAt: message.createdAt,
    score: 1 / (index + 1),
    matchKind,
  };
}

/**
 * 搜索当前用户可见频道内的历史消息正文。
 * 结果按消息时间倒序。
 */
export async function searchMessages(input: SearchMessagesInput): Promise<ImSearchHit[]> {
  const q = (input.query ?? '').trim();
  if (!q) return [];
  const limit = input.limit ?? 30;
  const store = getStore();

  // 1) 权限边界: 先只拿 membership.channelId。不要在正文搜索前逐个 hydrate 所有频道。
  const memberChannelIds = await listMemberChannelIds(input.userId);
  let allowedIds = memberChannelIds;
  if (input.channelId) {
    allowedIds = memberChannelIds.filter((channelId) => channelId === input.channelId);
    if (allowedIds.length === 0) return []; // 无权访问指定频道 → 空 (不泄露存在性)
  }
  if (allowedIds.length === 0) return [];

  const searchLimit = Math.max(limit * 2, 50);
  const bodyMatches = await store.imMessages
    .searchByBody({ query: q, channelIds: allowedIds, limit: searchLimit })
    .catch(() => [] as ImMessage[]);
  const channelById = await loadVisibleChannelsById(
    bodyMatches.map((message) => message.channelId),
    input.userId,
    input.tenantId,
  );

  const hits = await Promise.all(
    bodyMatches
      .filter((m) => !m.deletedAt)
      .map(async (m, index) => {
        const channel = channelById.get(m.channelId);
        if (!channel) return null;
        return toHit(m, channel, input.userId, input.tenantId, index, 'body');
      }),
  );
  return hits.filter((hit): hit is ImSearchHit => hit !== null).slice(0, limit);
}
