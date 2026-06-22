/**
 * IM Service · 业务逻辑层
 *
 * 借鉴 Rocket.Chat / Mattermost 的 model:
 *   - sendMessage 时同步: 解析 mentions / 更新所有 membership 未读 / 更新 channel.lastMessage*
 *   - SSE 通过 EventEmitter 广播 (V1 进程内, V2 上 Redis pub/sub 多实例)
 *   - @Persona 异步触发 LLM 回复 (sender = 'persona', delegationLevel 受控)
 */

import { EventEmitter } from 'events';
import { getStore } from '../storage/repository';
import {
  membershipKey,
  parseMentions,
  extractPreview,
  type ImChannel,
  type ImChannelType,
  type ImChannelVisibility,
  type ImMessage,
  type ImMembership,
  type ImMemberRole,
  type ImAttachment,
} from '../types/im';

// ---------------------------------------------------------------------------
// SSE bus (单进程内)
// ---------------------------------------------------------------------------

class ImBus extends EventEmitter {}
const _bus = new ImBus();
_bus.setMaxListeners(0); // 允许任意多 SSE 订阅者

export type ImBusEvent =
  | { type: 'message'; channelId: string; message: ImMessage }
  | { type: 'message_updated'; channelId: string; message: ImMessage }
  | { type: 'channel_updated'; channelId: string; channel: ImChannel }
  | { type: 'unread_changed'; channelId: string; userId: string; unread: number };

export function subscribeIm(handler: (e: ImBusEvent) => void): () => void {
  _bus.on('event', handler);
  return () => _bus.off('event', handler);
}

function broadcast(e: ImBusEvent): void {
  _bus.emit('event', e);
}

// ---------------------------------------------------------------------------
// Channel 操作
// ---------------------------------------------------------------------------

export interface CreateChannelInput {
  type: ImChannelType;
  name: string;
  topic?: string;
  visibility?: ImChannelVisibility;
  memberIds: string[];        // 必含 createdBy
  createdBy: string;
  /** 多租户隔离 (默认 'default') */
  tenantId?: string;
  linkedDecisionCardId?: string;
  /** Q2: department / team / cross_dept 群关联的部门 ID */
  departmentId?: string;
  /** Q2: HR 系统按组织架构自动建群标记 (人工建 false) */
  autoCreated?: boolean;
  /** Q2: project 群结束日期 (到期 cron 自动 archive) */
  projectEndsAt?: string;
}

export async function createChannel(input: CreateChannelInput): Promise<ImChannel> {
  const store = getStore();
  const now = new Date().toISOString();

  const memberIds = Array.from(new Set([input.createdBy, ...input.memberIds]));

  const channel = await store.imChannels.create({
    type: input.type,
    name: input.name,
    topic: input.topic,
    visibility: input.visibility ?? (input.type === 'dm' ? 'private' : 'public'),
    memberIds,
    createdBy: input.createdBy,
    tenantId: input.tenantId ?? 'default',
    createdAt: now,
    updatedAt: now,
    linkedDecisionCardId: input.linkedDecisionCardId,
    departmentId: input.departmentId,
    autoCreated: input.autoCreated ?? false,
    projectEndsAt: input.projectEndsAt,
  });

  // 建立 membership (创建者 = owner, 其他 = member)
  for (const userId of memberIds) {
    await store.imMemberships.create({
      id: membershipKey(channel.id, userId),
      channelId: channel.id,
      userId,
      role: userId === input.createdBy ? 'owner' : 'member',
      joinedAt: now,
      unreadCount: 0,
      muted: false,
    });
  }

  broadcast({ type: 'channel_updated', channelId: channel.id, channel });
  return channel;
}

/** 找/建 1:1 dm 频道 (幂等) */
export async function getOrCreateDm(
  meId: string,
  otherId: string
): Promise<ImChannel> {
  const store = getStore();
  const all = await store.imChannels.list();
  const existing = all.find(
    (c) =>
      c.type === 'dm' &&
      c.memberIds.length === 2 &&
      c.memberIds.includes(meId) &&
      c.memberIds.includes(otherId)
  );
  if (existing) return existing;
  return createChannel({
    type: 'dm',
    name: '',
    memberIds: [meId, otherId],
    createdBy: meId,
    visibility: 'private',
  });
}

export async function listMyChannels(userId: string, tenantId?: string): Promise<
  Array<ImChannel & { unread: number; membership: ImMembership }>
> {
  const store = getStore();
  // §23: userId 等值过滤下推到存储层 (热路径: 每次进 IM 都查本人频道)
  const memberships = await store.imMemberships.list({ userId });
  const result: Array<ImChannel & { unread: number; membership: ImMembership }> = [];
  for (const m of memberships) {
    const ch = await store.imChannels.get(m.channelId);
    if (!ch) continue;
    // Tenant isolation: drop channels from other tenants.
    if (tenantId && (ch.tenantId ?? 'default') !== tenantId) continue;
    result.push({ ...ch, unread: m.unreadCount, membership: m });
  }
  // pinnedChat 置顶, 其次按最后消息时间倒序
  result.sort((a, b) => {
    const pa = a.membership.pinnedChat ? 1 : 0;
    const pb = b.membership.pinnedChat ? 1 : 0;
    if (pb !== pa) return pb - pa;
    return (b.lastMessageAt ?? b.createdAt).localeCompare(
      a.lastMessageAt ?? a.createdAt
    );
  });
  return result;
}

export async function getChannelMessages(
  channelId: string,
  options: { limit?: number; before?: string } = {}
): Promise<ImMessage[]> {
  const store = getStore();
  const all = await store.imMessages.list();
  let msgs = all
    .filter((m) => m.channelId === channelId && !m.deletedAt)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (options.before) {
    msgs = msgs.filter((m) => m.createdAt < options.before!);
  }
  const limit = options.limit ?? 100;
  // 取最新的 limit 条
  return msgs.slice(-limit);
}

/**
 * 访问控制: 校验用户对频道是否有读权限 (成员 + 同租户).
 * 返回 channel (有权) 或 null (无权/不存在/跨租户). 路由据此返回 404 (不泄露存在性).
 */
export async function getChannelIfMember(
  channelId: string,
  userId: string,
  tenantId?: string,
): Promise<ImChannel | null> {
  const store = getStore();
  const channel = await store.imChannels.get(channelId);
  if (!channel) return null;
  if (tenantId && (channel.tenantId ?? 'default') !== tenantId) return null;
  if (!channel.memberIds.includes(userId)) return null;
  return channel;
}

// ---------------------------------------------------------------------------
// Send Message
// ---------------------------------------------------------------------------

export interface SendMessageInput {
  channelId: string;
  senderId: string;
  body: string;
  parentMessageId?: string;
  attachments?: ImAttachment[];
  /** 系统/Persona 消息时指定 */
  senderKind?: 'user' | 'system' | 'persona';
  /** §IM-7 · Persona 回复时关联 LlmUsageLog.requestId (透明化) */
  aiTraceId?: string;
}

export async function sendMessage(input: SendMessageInput): Promise<ImMessage> {
  const store = getStore();
  const now = new Date().toISOString();

  const channel = await store.imChannels.get(input.channelId);
  if (!channel) throw new Error(`channel ${input.channelId} not found`);

  // V1 简化: 系统/Persona 消息可由任何人触发, 用户消息需检查成员资格
  const senderKind = input.senderKind ?? 'user';
  if (senderKind === 'user' && !channel.memberIds.includes(input.senderId)) {
    throw new Error('not a member of this channel');
  }

  const mentions = parseMentions(input.body);

  const message = await store.imMessages.create({
    channelId: input.channelId,
    senderId: input.senderId,
    senderKind,
    body: input.body,
    mentions,
    parentMessageId: input.parentMessageId,
    attachments: input.attachments,
    aiTraceId: input.aiTraceId,
    createdAt: now,
  });

  // 更新 channel.lastMessageAt + preview
  const preview = extractPreview(input.body);
  await store.imChannels.update(channel.id, {
    lastMessageAt: now,
    lastMessagePreview: preview,
    updatedAt: now,
  });

  // 增量未读: 除发送者外所有 member +1; 被 mention 的用户额外标记 hasUnreadMention
  const mentionedUserIds = new Set(
    mentions
      .filter((mn) => mn.kind !== 'persona')
      .map((mn) => mn.userId)
  );
  for (const uid of channel.memberIds) {
    if (uid === input.senderId && senderKind === 'user') continue;
    const m = await store.imMemberships.get(membershipKey(channel.id, uid));
    if (!m) continue;
    const unread = m.unreadCount + 1;
    const patch: Partial<typeof m> = { unreadCount: unread };
    if (mentionedUserIds.has(uid)) patch.hasUnreadMention = true;
    await store.imMemberships.update(m.id, patch);
    broadcast({
      type: 'unread_changed',
      channelId: channel.id,
      userId: uid,
      unread,
    });
  }

  broadcast({ type: 'message', channelId: channel.id, message });

  // @Persona 提及: 触发异步 AI 回复
  const personaMention = mentions.find((m) => m.kind === 'persona');
  if (personaMention && senderKind === 'user') {
    void invokePersonaReply({
      channelId: channel.id,
      triggeringMessage: message,
      targetUserId: personaMention.userId,
    });
  }

  // §T15 Agent 自动模式: 频道其他成员若开启 agent-auto 且未过期, 由其分身自动代答
  // (限制: 仅 DM 与人数 ≤ 4 的小群; 大群不自动触发以免轰炸)
  if (senderKind === 'user' && channel.memberIds.length <= 4) {
    void triggerAutoAgentReplies({
      channel,
      message,
      excludeUserId: input.senderId,
    });
  }

  return message;
}

async function triggerAutoAgentReplies(opts: {
  channel: ImChannel;
  message: ImMessage;
  excludeUserId: string;
}): Promise<void> {
  try {
    const store = getStore();
    const now = Date.now();
    for (const uid of opts.channel.memberIds) {
      if (uid === opts.excludeUserId) continue;
      const m = await store.imMemberships.get(membershipKey(opts.channel.id, uid));
      if (!m || m.agentMode !== 'agent-auto') continue;
      if (m.agentModeExpiresAt && new Date(m.agentModeExpiresAt).getTime() < now) {
        // 过期, 自动恢复 manual
        await store.imMemberships.update(m.id, {
          agentMode: 'manual',
          agentModeSince: undefined,
          agentModeExpiresAt: undefined,
        });
        continue;
      }
      void invokePersonaReply({
        channelId: opts.channel.id,
        triggeringMessage: opts.message,
        targetUserId: uid,
      });
    }
  } catch {
    /* swallow, agent-auto 失败不影响主消息 */
  }
}

export async function markChannelRead(
  channelId: string,
  userId: string
): Promise<void> {
  const store = getStore();
  const m = await store.imMemberships.get(membershipKey(channelId, userId));
  if (!m) return;
  await store.imMemberships.update(m.id, {
    unreadCount: 0,
    lastReadAt: new Date().toISOString(),
    hasUnreadMention: false,
  });
  broadcast({ type: 'unread_changed', channelId, userId, unread: 0 });
}

// ---------------------------------------------------------------------------
// Day 4-7 (2026-05-10): 撤回 / 成员管理 / 公告 / pinned
// ---------------------------------------------------------------------------

const RECALL_WINDOW_MS = 2 * 60 * 1000; // 2 分钟内可撤回

/** 撤回消息 (仅本人 + 2 分钟内, owner/admin 任何时候可撤) */
export async function recallMessage(
  messageId: string,
  userId: string
): Promise<ImMessage> {
  const store = getStore();
  const msg = await store.imMessages.get(messageId);
  if (!msg) throw new Error('message not found');
  if (msg.deletedAt) throw new Error('already recalled');

  const channel = await store.imChannels.get(msg.channelId);
  if (!channel) throw new Error('channel gone');

  const isOwn = msg.senderId === userId;
  const m = await store.imMemberships.get(membershipKey(channel.id, userId));
  const isAdmin = m?.role === 'owner' || m?.role === 'admin';
  const ageMs = Date.now() - new Date(msg.createdAt).getTime();

  if (!isOwn && !isAdmin) throw new Error('not your message');
  if (isOwn && !isAdmin && ageMs > RECALL_WINDOW_MS) {
    throw new Error('超过 2 分钟, 无法撤回');
  }

  const now = new Date().toISOString();
  const updated = await store.imMessages.update(messageId, {
    deletedAt: now,
    body: '',
  });
  if (!updated) throw new Error('update failed');

  broadcast({ type: 'message_updated', channelId: channel.id, message: updated });
  return updated;
}

/** 添加成员 (owner/admin 操作) */
export async function addChannelMember(
  channelId: string,
  userId: string,
  operatorId: string
): Promise<ImChannel> {
  const store = getStore();
  const channel = await store.imChannels.get(channelId);
  if (!channel) throw new Error('channel not found');

  const op = await store.imMemberships.get(membershipKey(channelId, operatorId));
  if (!op || (op.role !== 'owner' && op.role !== 'admin')) {
    throw new Error('only owner/admin can add members');
  }
  if (channel.memberIds.includes(userId)) return channel; // idempotent

  const now = new Date().toISOString();
  await store.imMemberships.create({
    id: membershipKey(channelId, userId),
    channelId,
    userId,
    role: 'member',
    joinedAt: now,
    unreadCount: 0,
    muted: false,
  });
  const next = await store.imChannels.update(channelId, {
    memberIds: [...channel.memberIds, userId],
    updatedAt: now,
  });
  if (!next) throw new Error('update failed');
  broadcast({ type: 'channel_updated', channelId, channel: next });
  return next;
}

/** 移除成员 (owner/admin 操作; owner 不可被移除) */
export async function removeChannelMember(
  channelId: string,
  userId: string,
  operatorId: string
): Promise<ImChannel> {
  const store = getStore();
  const channel = await store.imChannels.get(channelId);
  if (!channel) throw new Error('channel not found');

  const op = await store.imMemberships.get(membershipKey(channelId, operatorId));
  const target = await store.imMemberships.get(membershipKey(channelId, userId));
  if (!op) throw new Error('operator not in channel');
  if (op.role !== 'owner' && op.role !== 'admin' && operatorId !== userId) {
    throw new Error('only owner/admin can remove others');
  }
  if (target?.role === 'owner') throw new Error('cannot remove owner');

  const now = new Date().toISOString();
  await store.imMemberships.delete?.(membershipKey(channelId, userId));
  const next = await store.imChannels.update(channelId, {
    memberIds: channel.memberIds.filter((id) => id !== userId),
    updatedAt: now,
  });
  if (!next) throw new Error('update failed');
  broadcast({ type: 'channel_updated', channelId, channel: next });
  return next;
}

/** 转让群主 (仅当前 owner 可操作) */
export async function transferOwner(
  channelId: string,
  newOwnerId: string,
  operatorId: string,
): Promise<void> {
  const store = getStore();
  const op = await store.imMemberships.get(membershipKey(channelId, operatorId));
  if (!op || op.role !== 'owner') throw new Error('only owner can transfer ownership');
  const target = await store.imMemberships.get(membershipKey(channelId, newOwnerId));
  if (!target) throw new Error('new owner is not in channel');
  const now = new Date().toISOString();
  await store.imMemberships.update(op.id, { role: 'admin' });
  await store.imMemberships.update(target.id, { role: 'owner' });
  const channel = await store.imChannels.get(channelId);
  if (channel) broadcast({ type: 'channel_updated', channelId, channel: { ...channel, updatedAt: now } });
}

/** 解散群 (仅 owner, 非 dm/announcement 频道) */
export async function dissolveChannel(
  channelId: string,
  operatorId: string,
): Promise<void> {
  const store = getStore();
  const channel = await store.imChannels.get(channelId);
  if (!channel) throw new Error('channel not found');
  if (channel.type === 'dm') throw new Error('cannot dissolve a DM channel');
  const op = await store.imMemberships.get(membershipKey(channelId, operatorId));
  if (!op || op.role !== 'owner') throw new Error('only owner can dissolve channel');
  const now = new Date().toISOString();
  await store.imChannels.update(channelId, { archivedAt: now, updatedAt: now });
  broadcast({ type: 'channel_updated', channelId, channel: { ...channel, archivedAt: now, updatedAt: now } });
}

/** 设置成员角色 (仅 owner) */
export async function setMemberRole(
  channelId: string,
  userId: string,
  role: ImMemberRole,
  operatorId: string
): Promise<ImMembership> {
  const store = getStore();
  const op = await store.imMemberships.get(membershipKey(channelId, operatorId));
  if (!op || op.role !== 'owner') throw new Error('only owner can set roles');
  const target = await store.imMemberships.get(membershipKey(channelId, userId));
  if (!target) throw new Error('member not found');
  const updated = await store.imMemberships.update(target.id, { role });
  if (!updated) throw new Error('update failed');
  return updated;
}

/** 更新成员个人设置 (muted / pinnedChat / markedChat, 自己才能改自己) */
export async function updateMemberSettings(
  channelId: string,
  userId: string,
  patch: { muted?: boolean; pinnedChat?: boolean; markedChat?: boolean },
): Promise<ImMembership> {
  const store = getStore();
  const target = await store.imMemberships.get(membershipKey(channelId, userId));
  if (!target) throw new Error('membership not found');
  const updated = await store.imMemberships.update(target.id, patch);
  if (!updated) throw new Error('update failed');
  return updated;
}

/** 更新频道元数据 (name/topic/announcement, owner/admin) */
export async function updateChannelMeta(
  channelId: string,
  operatorId: string,
  patch: { name?: string; topic?: string; announcement?: string },
): Promise<ImChannel> {
  const store = getStore();
  const op = await store.imMemberships.get(membershipKey(channelId, operatorId));
  if (!op || (op.role !== 'owner' && op.role !== 'admin')) {
    throw new Error('only owner/admin can edit channel');
  }
  const now = new Date().toISOString();
  const partial: Partial<ImChannel> = { updatedAt: now };
  if (patch.name !== undefined) partial.name = patch.name;
  if (patch.topic !== undefined) partial.topic = patch.topic;
  if (patch.announcement !== undefined) {
    partial.announcement = patch.announcement;
    partial.announcementUpdatedAt = now;
    partial.announcementUpdatedBy = operatorId;
  }
  const next = await store.imChannels.update(channelId, partial);
  if (!next) throw new Error('update failed');
  broadcast({ type: 'channel_updated', channelId, channel: next });
  return next;
}

/** Pin/Unpin 消息 (owner/admin, 最多 5 条) */
export async function togglePinMessage(
  channelId: string,
  messageId: string,
  operatorId: string,
): Promise<ImChannel> {
  const store = getStore();
  const channel = await store.imChannels.get(channelId);
  if (!channel) throw new Error('channel not found');
  const op = await store.imMemberships.get(membershipKey(channelId, operatorId));
  if (!op || (op.role !== 'owner' && op.role !== 'admin')) {
    throw new Error('only owner/admin can pin');
  }
  const current = channel.pinnedMessageIds ?? [];
  let nextPins: string[];
  if (current.includes(messageId)) {
    nextPins = current.filter((id) => id !== messageId);
  } else {
    if (current.length >= 5) throw new Error('已置顶 5 条, 请先取消其他');
    nextPins = [messageId, ...current];
  }
  const updated = await store.imChannels.update(channelId, {
    pinnedMessageIds: nextPins,
    updatedAt: new Date().toISOString(),
  });
  if (!updated) throw new Error('update failed');
  broadcast({ type: 'channel_updated', channelId, channel: updated });
  return updated;
}

// ---------------------------------------------------------------------------
// P1 Day ?? (2026-05-10): 按组织架构一键建群 (HR seed)
// ---------------------------------------------------------------------------

export interface DepartmentSpec {
  /** 对应 useOrgStore Department.id / Ministry.id (客户端传入) */
  departmentId: string;
  /** 群名, 通常 '{部门名} 工作群' */
  name: string;
  /** 成员 userId 数组 (已含 operator) */
  memberIds: string[];
  /** team (ministry) 还是 department (一级). 决定 ImChannelType */
  level: 'department' | 'team';
}

export interface SeedResult {
  created: { departmentId: string; channelId: string; name: string }[];
  skipped: { departmentId: string; reason: string; existingChannelId?: string }[];
}

/**
 * 按组织架构一键建部门/团队群 (幂等: 已存在同 departmentId+autoCreated 的跳过).
 * 管理员专属 (调用方自行鉴权).
 */
export async function seedDepartmentChannels(
  specs: DepartmentSpec[],
  operatorId: string,
): Promise<SeedResult> {
  const store = getStore();
  const existing = await store.imChannels.list();
  const existsByDept = new Map<string, ImChannel>();
  for (const ch of existing) {
    if (ch.departmentId && ch.autoCreated) {
      existsByDept.set(ch.departmentId, ch);
    }
  }

  const result: SeedResult = { created: [], skipped: [] };

  for (const spec of specs) {
    if (existsByDept.has(spec.departmentId)) {
      const ex = existsByDept.get(spec.departmentId)!;
      result.skipped.push({
        departmentId: spec.departmentId,
        reason: '已存在自动创建的部门群',
        existingChannelId: ex.id,
      });
      continue;
    }
    if (spec.memberIds.length === 0) {
      result.skipped.push({
        departmentId: spec.departmentId,
        reason: '部门无成员',
      });
      continue;
    }
    try {
      const ch = await createChannel({
        type: spec.level === 'team' ? 'team' : 'department',
        name: spec.name,
        visibility: 'public',
        memberIds: Array.from(new Set([operatorId, ...spec.memberIds])),
        createdBy: operatorId,
        departmentId: spec.departmentId,
        autoCreated: true,
        topic: `${spec.name} · 按组织架构自动建群`,
      });
      result.created.push({
        departmentId: spec.departmentId,
        channelId: ch.id,
        name: ch.name,
      });
    } catch (err) {
      result.skipped.push({
        departmentId: spec.departmentId,
        reason: `创建失败: ${(err as Error).message}`,
      });
    }
  }

  return result;
}

/** 列出频道全部成员 + 角色 (含 lastReadAt 用于已读UI) */
export async function listChannelMembers(channelId: string): Promise<ImMembership[]> {
  const store = getStore();
  const channel = await store.imChannels.get(channelId);
  if (!channel) return [];
  const result: ImMembership[] = [];
  for (const uid of channel.memberIds) {
    const m = await store.imMemberships.get(membershipKey(channelId, uid));
    if (m) result.push(m);
  }
  return result;
}

// ---------------------------------------------------------------------------
// 差异化 #1: 消息 → 议事室
// ---------------------------------------------------------------------------

export interface SpawnDecisionRoomInput {
  messageId: string;
  triggeredBy: string;
  /** 议题标题 (默认从消息 body 截前 50 字) */
  title?: string;
}

export async function spawnDecisionRoomFromMessage(
  input: SpawnDecisionRoomInput
): Promise<{ cardId: string; messageId: string }> {
  const store = getStore();
  const msg = await store.imMessages.get(input.messageId);
  if (!msg) throw new Error('message not found');

  const channel = await store.imChannels.get(msg.channelId);
  if (!channel) throw new Error('channel gone');

  const fallback = `${channel.name || '私聊'} 中讨论的事项`;
  const title =
    input.title ?? (extractPreview(msg.body, 50) || fallback);

  // 调用 ConvergenceOrchestrator (动态 import 避免循环依赖)
  const { getOrchestrator } = await import('../boot');
  const orch = getOrchestrator();
  const result = await orch.start({
    title,
    description: `从 IM 消息触发:\n\n> ${msg.body}\n\n— @${msg.senderId} 于 ${msg.createdAt}`,
    ownerId: input.triggeredBy,
  });

  // 反向链接: message 标记 spawnedDecisionCardId
  await store.imMessages.update(msg.id, {
    spawnedDecisionCardId: result.cardId,
  });

  // 在原频道发系统消息: "议事室已开"
  await sendMessage({
    channelId: channel.id,
    senderId: 'system',
    senderKind: 'system',
    body: `🏛️ 议事室已开: **${title}** (引用 @${msg.senderId} 的消息)\n\n[/convergence/${result.cardId}](议事室链接)`,
    parentMessageId: msg.id,
  });

  return { cardId: result.cardId, messageId: msg.id };
}

// ---------------------------------------------------------------------------
// 差异化 #1.5: 消息 → Memory 升级提议 (PRD §2.2 第 3 条 "议事文化沉淀")
//
// 流程:
//   1. 把 IM 消息正文落成 Material (origin 反链)
//   2. 走 proposePromotion 三级签批 (默认 team 级, 1 天 SLA)
//   3. message.spawnedPromotionId 反向链接
//   4. 频道发系统消息: "✍️ 已发起 Memory 升级提议 → @Steward 待签字"
// ---------------------------------------------------------------------------

export interface PromoteToMemoryInput {
  messageId: string;
  triggeredBy: string;
  /** 升级类型 (默认 'lesson') */
  proposedType?: 'sop' | 'case' | 'redline' | 'value' | 'lesson';
  /** 标题 (默认从消息正文截前 50 字) */
  proposedTitle?: string;
  /** 升级级别 (默认 team — 最低门槛, 鼓励员工沉淀) */
  level?: 'team' | 'dept' | 'company';
}

export async function promoteImMessageToMemory(
  input: PromoteToMemoryInput
): Promise<{ promotionId: string; materialId: string; messageId: string }> {
  const store = getStore();
  const msg = await store.imMessages.get(input.messageId);
  if (!msg) throw new Error('message not found');
  if (msg.spawnedPromotionId) {
    throw new Error(`message ${input.messageId} 已发起过 Memory 升级 (promotion ${msg.spawnedPromotionId})`);
  }

  const channel = await store.imChannels.get(msg.channelId);
  if (!channel) throw new Error('channel gone');

  const title = input.proposedTitle ?? extractPreview(msg.body, 50) ?? 'IM 消息升级';
  const proposedType = input.proposedType ?? 'lesson';
  const now = new Date().toISOString();

  // 1. 落 Material (origin 反链 IM 消息)
  const material = await store.materials.create({
    type: 'project_doc' as const,
    title,
    body: { source: 'im_message', body: msg.body, originalSenderId: msg.senderId, originalCreatedAt: msg.createdAt },
    originRefs: [`im:${msg.id}`],
    participants: Array.from(new Set([msg.senderId, input.triggeredBy, ...channel.memberIds])),
    visibility: 'team' as const,
    createdBy: input.triggeredBy,
    createdAt: now,
    updatedAt: now,
  });

  // 2. 调 proposePromotion (动态 import 避免循环依赖)
  const { proposePromotion } = await import('../memory/promotion-flow');
  const promotion = await proposePromotion({
    materialId: material.id,
    proposedType,
    proposedTitle: title,
    proposedBody: msg.body,
    proposerId: input.triggeredBy,
    level: input.level ?? 'team',
  });

  // 3. 反向链接
  await store.imMessages.update(msg.id, {
    spawnedPromotionId: promotion.id,
  });

  // 4. 系统消息
  await sendMessage({
    channelId: channel.id,
    senderId: 'system',
    senderKind: 'system',
    body:
      `✍️ 已发起 **Memory 升级提议**: **${title}**\n\n` +
      `级别: ${promotion.level} · 类型: ${proposedType} · 由 @${input.triggeredBy} 提议\n` +
      `[/memories?promotionId=${promotion.id}](查看签批进度)`,
    parentMessageId: msg.id,
  });

  return { promotionId: promotion.id, materialId: material.id, messageId: msg.id };
}

// ---------------------------------------------------------------------------
// 差异化 #2: @Persona 召唤
// ---------------------------------------------------------------------------

interface InvokePersonaInput {
  channelId: string;
  triggeringMessage: ImMessage;
  targetUserId: string;
}

async function invokePersonaReply(input: InvokePersonaInput): Promise<void> {
  // §CA-1 中央 AI 实体: 召唤 CompanyBrain 走独立分支 (不走 baseline-guard, 不写 ProxyAction)
  const { COMPANY_BRAIN_USER_ID, isCompanyBrain } = await import('../persona/company-brain');
  void COMPANY_BRAIN_USER_ID; // 引用以避免 tree-shaking
  if (isCompanyBrain(input.targetUserId)) {
    await invokeCompanyBrainReply(input);
    return;
  }

  try {
    const store = getStore();
    const personas = await store.personas.list();
    let persona = personas.find((p) => p.userId === input.targetUserId);
    if (!persona) {
      // 真实注册用户从未被创建 Persona (createPersona 未接入注册/登录流程),
      // 首次代行时按 newborn 阶段自动建档. 后续 observe_only/report_only 门控
      // 会自然接管: 新生分身仍不允许代行, 提示"等本人", 直到成长到 assistant 阶段。
      const { createPersona } = await import('../persona/evolution');
      persona = await createPersona(input.targetUserId);
    }

    // V1: observe_only / report_only 阶段不能代行
    if (
      persona.delegationLevel === 'observe_only' ||
      persona.delegationLevel === 'report_only'
    ) {
      await sendMessage({
        channelId: input.channelId,
        senderId: 'persona',
        senderKind: 'system',
        body: `🔒 @${input.targetUserId} 的 Persona (阶段: ${persona.stage}, 级别: ${persona.delegationLevel}) 暂不允许代行回复. 等本人.`,
        parentMessageId: input.triggeringMessage.id,
      });
      return;
    }

    // §19.5 搭子受控统一卡点: baseline-guard(红线 HARD_BLOCK) + OKR锚 + 价值观锚 强制注入
    const baseSystem =
      `你正在以 ${input.targetUserId} 的 AI 分身身份回复 IM 消息. ` +
      `当前阶段: ${persona.stage}; 委托级别: ${persona.delegationLevel}. ` +
      `风格: 决策速度=${persona.styleProfile.decisionSpeed}, ` +
      `风险偏好=${persona.styleProfile.riskAppetite}, ` +
      `沟通风格=${persona.styleProfile.communicationStyle}. ` +
      `严格遵守委托级别: 不做超出权限的承诺. 只回 1-3 句话, 简洁.`;

    // 解析用户 LLM 偏好 (个人AI > 中央AI > 路由器内置规则)
    let forceProvider: string | null = null;
    try {
      const { resolveProviderForUser } = await import('../settings/llm-preference');
      const { checkPersonalAiAllowed, recordTokenUsage } = await import('../settings/tenant-ai-policy');
      const tenantId = 'default';

      const resolved = await resolveProviderForUser(input.targetUserId, tenantId, 'persona_dialogue');

      // 若解析到个人AI 偏好，检查是否在策略允许范围内
      if (resolved) {
        const check = await checkPersonalAiAllowed(tenantId, input.targetUserId, resolved);
        if (check.allowed) {
          forceProvider = resolved;
        } else {
          // 策略不允许: 记录日志，fallback 到中央AI 路由规则 (不 forceProvider)
          console.info(`[im] personalAI blocked for ${input.targetUserId}: ${check.reason}`);
        }
      }

      // 记录 token 用量 (粗估: 200 tokens/reply, 实际从 ChatResponse.usage 取)
      void recordTokenUsage(tenantId, input.targetUserId, 200).catch(() => {/* ignore */});
    } catch {
      /* 偏好/策略读取失败不影响主流程, 走默认路由 */
    }

    // §IM-7 trace id: 关联 → LlmUsageLog.requestId + IM message.aiTraceId, 让 trace popover 可逆查
    const aiTraceId = `imtrace_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

    // 序2 搭子感知前置: 由 systemPromptTransform 闭包写入, 供 ProxyAction 留痕
    let personaPerceived = false;
    let personaPerceptionTools: string[] = [];

    // §19.5 + P1-M4: 走唯一治理出口 governedChat (输入闸 baseline+OKR+价值观 / 动作闸④ 内容判定 / 输出闸矫正镜片)
    const { governedChat } = await import('../governance/governed-chat');
    const gc = await governedChat({
      actorUserId: input.targetUserId,
      intent: input.triggeringMessage.body,
      basePersonaPrompt: baseSystem,
      messages: [{ role: 'user', content: input.triggeringMessage.body }],
      agentKind: 'persona',
      toolName: 'im.persona_reply',
      // IM 代行 = 草稿性回复 (yellow ProxyAction + 24h 否决); 闸④ 内容判定会拦红区/越权
      action: {
        dataScope: 'personal',
        declaredActionScope: 'create_draft',
        delegationLevel: persona.delegationLevel,
      },
      scenario: 'persona_dialogue',
      forceProvider: forceProvider ?? undefined,
      cacheControlSystem: true,
      maxTokens: 200,
      metadata: { userId: input.targetUserId, requestId: aiTraceId },
      refId: input.triggeringMessage.id,
      outputGuardSource: 'im.persona_reply',
      // 治理后追加上下文钩子 (三闸之后、LLM 之前; 不绕过闸):
      //   ① 序2 搭子感知前置: 答前用只读工具查本人 OKR/决议/记忆真值 (会查)
      //   ② Pre-Search Layer: 个人搭子联网查实时外部信息
      systemPromptTransform: async (sys) => {
        let out = sys;
        // ① 内部感知 pass (序2 · 搭子装执行肢体 · 只读, fail-soft)
        try {
          const { personaPerceptionPass } = await import('../persona/persona-perception');
          const pp = await personaPerceptionPass(input.triggeringMessage.body, out, input.targetUserId);
          if (pp.perceived) {
            out = pp.revisedSystemPrompt;
            personaPerceived = true;
            personaPerceptionTools = pp.toolInvocations.filter((t) => t.ok).map((t) => t.name);
          }
        } catch {
          /* fail-soft: 感知失败不阻塞回复 */
        }
        // ② 联网 pre-search (实时外部信息)
        try {
          const { preSearchLayer } = await import('../persona/company-brain');
          const ps = await preSearchLayer(input.triggeringMessage.body, out, input.targetUserId);
          if (ps.searched) out = ps.revisedSystemPrompt;
        } catch {
          /* fail-soft */
        }
        // ③ §B-024 self-hint 召回: 注入分身过去的语言化自省教训 (真学习闭环·读侧)
        try {
          const { injectSelfHints } = await import('../persona/reflexion');
          const sh = await injectSelfHints(out, input.targetUserId, input.triggeringMessage.body);
          out = sh.revisedSystemPrompt;
        } catch {
          /* fail-soft: 自省召回失败不阻塞回复 */
        }
        return out;
      },
    });

    if (!gc.ok) {
      const blockedAtAction = gc.blocked?.stage === 'action';
      await sendMessage({
        channelId: input.channelId,
        senderId: 'persona',
        senderKind: 'system',
        body: blockedAtAction
          ? `🚫 ${input.targetUserId} 的 AI 分身想做的动作超出绿区/委托权限 (${gc.gates.action?.zone ?? 'red'} 区), 已转人工。\n${(gc.blocked?.reasons ?? []).join('; ')}`
          : `🚫 ${input.targetUserId} 的 AI 分身被企业红线/组织记忆基线阻断, 已转人工。\n${(gc.blocked?.reasons ?? []).join('; ')}`,
        parentMessageId: input.triggeringMessage.id,
      });
      // 触发 workflow T14: 通知治理委员会 + audit
      try {
        const { emit } = await import('../workflows/engine');
        await emit({
          type: 'im.persona.blocked',
          payload: {
            channelId: input.channelId,
            userId: input.targetUserId,
            reason:
              gc.blocked?.reasons?.join('; ') ??
              (blockedAtAction ? 'action_gate_block' : 'baseline_hard_block'),
          },
        });
      } catch {
        /* workflow 失败不影响主流程 */
      }
      return;
    }

    const replyText = gc.answer ?? '';

    const sent = await sendMessage({
      channelId: input.channelId,
      senderId: input.targetUserId,
      senderKind: 'persona',
      body: `${replyText}\n\n_— ${input.targetUserId} 的 AI 分身 (${persona.stage}) · 仅供参考, 待本人确认_`,
      parentMessageId: input.triggeringMessage.id,
      aiTraceId,
    });

    // 写入统一 ProxyAction (拿捏闭环 ③, 24h 否决窗口)
    try {
      const { createProxyAction } = await import('../persona/proxy-actions');
      await createProxyAction({
        userId: input.targetUserId,
        personaId: persona.id,
        tenantId: 'default',
        kind: 'im_reply',
        zone: 'yellow',
        title: `[AI 自动回复] ${input.channelId}`,
        body: replyText,
        refType: 'im_message',
        refId: sent?.id,
        metadata: {
          channelId: input.channelId,
          triggeringMessageId: input.triggeringMessage.id,
          stage: persona.stage,
          delegationLevel: persona.delegationLevel,
          // 序2: 是否答前查了本人真值 + 调了哪些只读工具 (留痕)
          perceived: personaPerceived,
          perceptionTools: personaPerceptionTools,
        },
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[im] failed to record ProxyAction', err);
    }

    // §S1 搭子「装手」: 若员工消息表达"更新自己 OKR 进度"意图, 经治理提议写动作 (proposeAction → 24h 否决窗)。
    //   fail-soft + 严格意图门控 (shouldAct), 不改既有回复行为; 仅在真落成提议时追加一条系统提示。
    //   写动作全经 proposeAction: 宪法 A (中央 AI 不可 proposer) + zone (红拒/黄24h窗) + 委托级别越权升红。
    try {
      const { personaActPass } = await import('../persona/persona-act');
      const act = await personaActPass(input.triggeringMessage.body, input.targetUserId, {
        tenantId: 'default',
      });
      if (act.proposals.length > 0) {
        const pending = act.proposals.filter((p) => p.status === 'pending_veto').length;
        const executed = act.proposals.filter((p) => p.status === 'executed').length;
        const parts: string[] = [];
        if (pending > 0) parts.push(`${pending} 项待你确认 (24h 否决窗)`);
        if (executed > 0) parts.push(`${executed} 项已执行 (绿区, 已留痕)`);
        await sendMessage({
          channelId: input.channelId,
          senderId: 'persona',
          senderKind: 'system',
          body: `🤚 分身已为你起草 OKR 数据更新代行: ${parts.join(' · ')}。去「分身代行台账」确认或否决。`,
          parentMessageId: input.triggeringMessage.id,
        });
      } else if (act.rejected.length > 0) {
        await sendMessage({
          channelId: input.channelId,
          senderId: 'persona',
          senderKind: 'system',
          body: `🚫 分身尝试代行更新 OKR 数据被治理拦截 (越权/红区), 请本人操作。`,
          parentMessageId: input.triggeringMessage.id,
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[im] persona act pass failed (non-blocking)', err);
    }
  } catch (err) {
    // 失败静默 (V1 简化), 在频道里提示但不抛
    try {
      await sendMessage({
        channelId: input.channelId,
        senderId: 'persona',
        senderKind: 'system',
        body: `⚠️ Persona 代行失败: ${(err as Error).message}`,
        parentMessageId: input.triggeringMessage.id,
      });
    } catch {
      /* noop */
    }
  }
}

// ---------------------------------------------------------------------------
// §CA-1 (CENTRAL-AI-ARCHITECTURE.md) · CompanyBrain · 中央 AI 实体 IM 回复
//
// 跟员工 Persona 的差异:
//   - 不走 baseline-guard (它就是基线本身, 不能被自己阻断)
//   - 不写 ProxyAction (它的输出本身就是公司视角参考, 不需要 24h 否决)
//   - 用 reasoning_complex scenario → claude-opus-4-5 旗舰模型
//   - system prompt 注入全公司 Memory (buildCompanyBrainSystemPrompt)
// ---------------------------------------------------------------------------
async function invokeCompanyBrainReply(input: InvokePersonaInput): Promise<void> {
  try {
    const { buildCompanyBrainSystemPrompt, COMPANY_BRAIN_USER_ID } = await import(
      '../persona/company-brain'
    );
    const { getRouter } = await import('../boot');
    const { rateLimit, POLICIES } = await import('../infra/rate-limit');
    const router = getRouter();
    const store = getStore();

    // §限流: IM @中央 AI 跟 BossAI 共用预算池 (key 同) · 防绕过 BossAI 走 IM 烧 token
    const senderId = input.triggeringMessage.senderId;
    const minute = await rateLimit({ key: `boss_ai:min:${senderId}`, ...POLICIES.bossAi() });
    const day = await rateLimit({ key: `boss_ai:day:${senderId}`, ...POLICIES.bossAiDaily() });
    if (!minute.allowed || !day.allowed) {
      const tip = !minute.allowed
        ? `请慢一点 · 每分钟最多 ${POLICIES.bossAi().limit} 次 @中央 AI, 稍后再试`
        : `今日额度已用完 (${POLICIES.bossAiDaily().limit} 次/天). 明天再来, 或联系 admin 调整`;
      await sendMessage({
        channelId: input.channelId,
        senderId: COMPANY_BRAIN_USER_ID,
        senderKind: 'system',
        body: `⏳ ${tip}`,
        parentMessageId: input.triggeringMessage.id,
      }).catch(() => { /* noop */ });
      const { deferAudit } = await import('../audit/defer');
      deferAudit('boss_ai.rate_limited', senderId, {
        targetType: 'im_company_brain',
        metadata: { window: minute.allowed ? 'day' : 'minute' },
      });
      return;
    }

    // §IM-7 trace id
    const aiTraceId = `imtrace_cb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

    const channelRow = await store.imChannels.get(input.channelId);
    if (!channelRow) return;
    const channelId = channelRow.id;

    // §P1 流式打字: 先发空 placeholder, 让前端立刻显示"打字中"气泡
    const placeholder = await sendMessage({
      channelId,
      senderId: COMPANY_BRAIN_USER_ID,
      senderKind: 'persona',
      body: '', // 空 = 触发前端 typing indicator
      parentMessageId: input.triggeringMessage.id,
      aiTraceId,
    });

    // §SSE-UX · 分阶段状态提示: 首 token 前的重活 (Memory 构建 / preSearch / S1 感知) 同步 await
    // 会阻塞首字 ~4s, 前端只见 "思考中" 干等。每阶段把进度文案写进 placeholder.statusText 并广播,
    // 让用户立刻看到 "正在核对 OKR…" 之类反馈 (与 BossAI SSE status 事件对齐)。首 content delta 时清空。
    const pushStatus = async (statusText: string): Promise<void> => {
      const updated = await store.imMessages.update(placeholder.id, { statusText });
      if (updated) broadcast({ type: 'message_updated', channelId, message: updated });
    };

    // §P1 Reranker · 用 @中央 AI 的 IM 消息作为 query, 让注入 Memory 按相关度重排
    await pushStatus('正在调取公司知识库…');
    const baseSystemPrompt = await buildCompanyBrainSystemPrompt({
      query: input.triggeringMessage.body,
    });

    // §Pre-Search Layer · 时间敏感 / 公司 Memory 覆盖度低时主动联网 (不阻塞流式)
    let systemPrompt = baseSystemPrompt;
    try {
      await pushStatus('正在联网查证最新信息…');
      const { preSearchLayer } = await import('../persona/company-brain');
      const ps = await preSearchLayer(
        input.triggeringMessage.body,
        baseSystemPrompt,
        input.triggeringMessage.senderId,
      );
      if (ps.searched) {
        systemPrompt = ps.revisedSystemPrompt;
        const { audit: psAudit } = await import('../audit/log');
        await psAudit('output_guard.checked', input.triggeringMessage.senderId, {
          targetId: placeholder.id,
          targetType: 'company_brain_im',
          metadata: {
            preSearch: true,
            provider: ps.provider,
            resultCount: ps.log.resultCount,
            triggerReason: ps.log.triggerReason,
            latencyMs: ps.log.latencyMs,
          },
        }).catch(() => { /* noop */ });
      }
    } catch {
      // preSearch 失败不阻塞主流程
    }

    // §S2 深推理层 (主回复路径 · 2026-06-09) · 复杂决策类提问跑 multi-step ReAct
    //   "比较 / 为什么 / 应该 / 分析 / 策略 ..." 这种多面向决策提问需要"召回→评估→风险→相关人"
    //   结构化推理。命中即跳过 S1 (S2 是 S1 的超集, 已用同一只读工具集 + 多步框架)。
    let s2Reasoned = false;
    try {
      await pushStatus('正在做多步推理 …');
      const { companyBrainReasoningPass } = await import('../persona/company-brain-reasoning');
      const reasoning = await companyBrainReasoningPass(input.triggeringMessage.body, systemPrompt);
      if (reasoning.reasoned) {
        systemPrompt = reasoning.revisedSystemPrompt;
        s2Reasoned = true;
        const { audit: r2Audit } = await import('../audit/log');
        await r2Audit('output_guard.checked', input.triggeringMessage.senderId, {
          targetId: placeholder.id,
          targetType: 'company_brain_im',
          metadata: {
            stage: 'S2',
            reasoned: true,
            tools: reasoning.toolsUsed,
            stepsExecuted: reasoning.log.stepsExecuted,
            toolCallCount: reasoning.log.toolCallCount,
            latencyMs: reasoning.log.latencyMs,
            triggerReason: reasoning.log.triggerReason,
            traceId: reasoning.log.traceId,
          },
        }).catch(() => { /* noop */ });
      }
    } catch {
      // S2 失败不阻塞主流程 (fail-soft) — 继续走 S1 兜底
    }

    // §S1 内部感知层 (CA-6/7) · S2 未命中时兜底, 流式前用只读工具查 OKR/决议真值
    // "瞎子 → 能看": 让中央 AI 回答执行/进度类问题时基于 S0 rollup 真值, 而非静态注入文本。
    if (!s2Reasoned) try {
      await pushStatus('正在核对 OKR / 决议实时进度…');
      const { companyBrainPerceptionPass } = await import('../persona/company-brain-perception');
      const perception = await companyBrainPerceptionPass(input.triggeringMessage.body, systemPrompt);
      if (perception.perceived) {
        systemPrompt = perception.revisedSystemPrompt;
        const { audit: pcAudit } = await import('../audit/log');
        await pcAudit('output_guard.checked', input.triggeringMessage.senderId, {
          targetId: placeholder.id,
          targetType: 'company_brain_im',
          metadata: {
            perception: true,
            tools: perception.toolInvocations.map((t) => t.name),
            toolCallCount: perception.log.toolCallCount,
            roundsExecuted: perception.log.roundsExecuted,
            latencyMs: perception.log.latencyMs,
            triggerReason: perception.log.triggerReason,
          },
        }).catch(() => { /* noop */ });
      }
    } catch {
      // 感知层失败不阻塞主流程 (fail-soft)
    }

    await pushStatus('正在组织回答…');

    const startedAt = Date.now();
    let buffer = '';
    let lastFlushAt = 0;
    let statusCleared = false;
    const FLUSH_INTERVAL_MS = 80; // 80ms 节流: 看起来流畅, 不轰炸 SSE

    const flush = async (force: boolean): Promise<void> => {
      const now = Date.now();
      if (!force && now - lastFlushAt < FLUSH_INTERVAL_MS) return;
      lastFlushAt = now;
      // 首个 content 落地时清空 statusText (前端从 "正在组织回答…" 切到真实正文)
      const patch: Partial<ImMessage> = { body: buffer };
      if (!statusCleared) {
        patch.statusText = '';
        statusCleared = true;
      }
      const updated = await store.imMessages.update(placeholder.id, patch);
      if (updated) {
        broadcast({ type: 'message_updated', channelId, message: updated });
      }
    };

    // §P1 真·流式: token-by-token, 边读边 update IM 消息体 + SSE 广播
    try {
      const stream = router.chatStream({
        messages: [
          // §B-003 · ephemeral 缓存
          { role: 'system', content: systemPrompt, cacheControl: 'ephemeral' },
          { role: 'user', content: input.triggeringMessage.body },
        ],
        scenario: 'reasoning_complex',
        maxTokens: 400,
        metadata: {
          userId: COMPANY_BRAIN_USER_ID,
          requestId: aiTraceId,
        },
      });
      for await (const chunk of stream) {
        const delta = chunk.delta?.content;
        if (typeof delta === 'string' && delta.length > 0) {
          buffer += delta;
          await flush(false);
        }
      }
    } catch (streamErr) {
      // Stream 失败: 把 error 拼到 buffer 尾部 (避免用户看不见错误)
      buffer += `\n\n⚠️ 流式中断: ${(streamErr as Error).message}`;
    }

    // §Output Guard · 输出矫正镜片 (Open-Read / Governed-Output / Locked-Write 三段闸的"出口"段)
    // 让 LLM 答案在交付员工前过一次"是否与公司 Memory/红线冲突"裁判. HARD_CONFLICT → 重写一次.
    let footnote = '';
    if (buffer.trim().length >= 20) {
      try {
        const { checkOutput } = await import('../memory/output-guard');
        const verdict = await checkOutput({
          query: input.triggeringMessage.body,
          response: buffer,
          actorUserId: input.triggeringMessage.senderId,
          source: 'company_brain_im',
          refId: placeholder.id,
        });
        if (verdict.verdict === 'HARD_CONFLICT' && verdict.revisionPrompt) {
          // 一次性重写 (非流式, 用同一 scenario)
          try {
            const retry = await router.chat({
              messages: [
                { role: 'system', content: systemPrompt, cacheControl: 'ephemeral' },
                { role: 'user', content: input.triggeringMessage.body },
                { role: 'assistant', content: buffer },
                { role: 'user', content: verdict.revisionPrompt },
              ],
              scenario: 'reasoning_complex',
              maxTokens: 500,
              metadata: { userId: COMPANY_BRAIN_USER_ID, requestId: `${aiTraceId}_revised` },
            });
            const revised = typeof retry.message.content === 'string' ? retry.message.content.trim() : '';
            if (revised) {
              buffer = revised;
              footnote = `\n\n_⚠️ 已根据公司 Memory 矫正 (output_guard checkId=${verdict.checkId})_`;
              const { audit: auditFn } = await import('../audit/log');
              await auditFn('output_guard.revised', input.triggeringMessage.senderId, {
                targetId: placeholder.id,
                targetType: 'company_brain_im',
                metadata: { checkId: verdict.checkId, hits: verdict.hits.length },
              }).catch(() => { /* noop */ });
            }
          } catch {
            // 重写失败 → 保留原 buffer, 加警告脚注 (而不是拒交)
            footnote = `\n\n_⚠️ 中央 AI 输出与公司 Memory 存在偏离 (output_guard checkId=${verdict.checkId}), 请谨慎采纳_`;
          }
        } else if (verdict.verdict === 'SOFT_DRIFT' && verdict.footnote) {
          footnote = verdict.footnote;
        }
      } catch {
        /* output-guard 自身失败不阻断 (fail-soft) */
      }
    }

    const latencyMs = Date.now() - startedAt;
    const finalBody = buffer.length > 0
      ? `${buffer}${footnote}\n\n_— 🏛️ CompanyBrain · 中央 AI · 基于公司层 Memory · 仅供参考_`
      : '_(CompanyBrain 未返回内容)_';

    // 最终 update: 写入完整 body + footer, 同步 channel preview (并确保清空 statusText, 覆盖空回复场景)
    const finalUpdated = await store.imMessages.update(placeholder.id, { body: finalBody, statusText: '' });
    const finalMsg = finalUpdated ?? placeholder;
    if (finalUpdated) {
      broadcast({ type: 'message_updated', channelId, message: finalUpdated });
      const previewText = extractPreview(finalBody);
      const nowIso = new Date().toISOString();
      await store.imChannels.update(channelId, {
        lastMessageAt: nowIso,
        lastMessagePreview: previewText,
        updatedAt: nowIso,
      });
    }

    // §CA-13 闭环: 落地 CompanyBrainDecision (best-effort, 不阻断主流程)
    try {
      const { recordDecision } = await import('../persona/company-brain-decision');
      const { estimateCostMicroUsd } = await import('../analytics/track');
      // 流式接口没有 usage, 用 inline estimate (中文 1 char ≈ 1.5 token, 其他 ≈ 0.3 token)
      const estimateTokens = (text: string): number => {
        const cn = (text.match(/[\u4e00-\u9fa5]/g) ?? []).length;
        const other = text.length - cn;
        return Math.ceil(cn * 1.5 + other * 0.3);
      };
      const tokensIn = estimateTokens(`${systemPrompt}\n${input.triggeringMessage.body}`);
      const tokensOut = estimateTokens(buffer);
      // 真实归因: 取 router 对 reasoning_complex 实际命中的 provider + 模型名
      let modelUsed = 'claude-opus-4-5';
      let providerUsed = 'anthropic';
      try {
        const { getRouter } = await import('../boot');
        const active = getRouter().resolveActiveModel('reasoning_complex');
        if (active) {
          modelUsed = active.model;
          providerUsed = active.provider;
        }
      } catch {
        /* 路由解析失败时沿用默认归因 */
      }
      const costMicroUsd = estimateCostMicroUsd(modelUsed, tokensIn, tokensOut);
      const decision = await recordDecision({
        context: 'im_reply',
        inputSummary: input.triggeringMessage.body,
        outputSummary: buffer,
        modelUsed,
        providerUsed,
        scenario: 'reasoning_complex',
        tokensIn,
        tokensOut,
        costMicroUsd,
        latencyMs,
        aiTraceId,
        refId: finalMsg.id,
        refType: 'im_message',
      });
      if (decision) {
        const { audit } = await import('../audit/log');
        await audit('company_brain.decision_recorded', COMPANY_BRAIN_USER_ID, {
          targetId: decision.id,
          targetType: 'company_brain_decision',
          metadata: {
            context: 'im_reply',
            channelId: input.channelId,
            refMessageId: finalMsg.id,
            brainVersion: decision.brainVersion,
            model: modelUsed,
            tokensIn,
            tokensOut,
            costMicroUsd,
            latencyMs,
          },
        });
      }
    } catch {
      /* 决策记录失败不影响 IM 主流程 */
    }

    // §B-015 OKR Drift Detection: 检测 intent 是否偏离公司主航道 (best-effort, 不阻断)
    try {
      const { checkOkrDrift, auditOkrDriftIfNeeded } = await import('../governance/okr-drift');
      const drift = await checkOkrDrift({
        intent: input.triggeringMessage.body,
        actorUserId: input.triggeringMessage.senderId,
        source: 'company_brain_reply',
        refId: finalMsg.id,
      });
      await auditOkrDriftIfNeeded(drift, {
        intent: input.triggeringMessage.body,
        actorUserId: input.triggeringMessage.senderId,
        source: 'company_brain_reply',
        refId: finalMsg.id,
      });
    } catch {
      /* drift 检测失败不影响 IM 主流程 */
    }
  } catch (err) {
    try {
      await sendMessage({
        channelId: input.channelId,
        senderId: 'persona',
        senderKind: 'system',
        body: `⚠️ CompanyBrain 调用失败: ${(err as Error).message}`,
        parentMessageId: input.triggeringMessage.id,
      });
    } catch {
      /* noop */
    }
  }
}
