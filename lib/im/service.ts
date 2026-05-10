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

export async function listMyChannels(userId: string): Promise<
  Array<ImChannel & { unread: number; membership: ImMembership }>
> {
  const store = getStore();
  const memberships = (await store.imMemberships.list()).filter(
    (m) => m.userId === userId
  );
  const result: Array<ImChannel & { unread: number; membership: ImMembership }> = [];
  for (const m of memberships) {
    const ch = await store.imChannels.get(m.channelId);
    if (ch) result.push({ ...ch, unread: m.unreadCount, membership: m });
  }
  // 按最后消息时间倒序
  result.sort(
    (a, b) =>
      (b.lastMessageAt ?? b.createdAt).localeCompare(
        a.lastMessageAt ?? a.createdAt
      )
  );
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
    createdAt: now,
  });

  // 更新 channel.lastMessageAt + preview
  const preview = extractPreview(input.body);
  await store.imChannels.update(channel.id, {
    lastMessageAt: now,
    lastMessagePreview: preview,
    updatedAt: now,
  });

  // 增量未读: 除发送者外所有 member +1
  for (const uid of channel.memberIds) {
    if (uid === input.senderId && senderKind === 'user') continue;
    const m = await store.imMemberships.get(membershipKey(channel.id, uid));
    if (!m) continue;
    const unread = m.unreadCount + 1;
    await store.imMemberships.update(m.id, { unreadCount: unread });
    broadcast({
      type: 'unread_changed',
      channelId: channel.id,
      userId: uid,
      unread,
    });
  }

  broadcast({ type: 'message', channelId: channel.id, message });

  // @Persona 提及: 触发异步 AI 回复 (V1 占位, 真实接入下面单独函数)
  const personaMention = mentions.find((m) => m.kind === 'persona');
  if (personaMention && senderKind === 'user') {
    // 异步, 不阻塞当前请求
    void invokePersonaReply({
      channelId: channel.id,
      triggeringMessage: message,
      targetUserId: personaMention.userId,
    });
  }

  return message;
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
  });
  broadcast({ type: 'unread_changed', channelId, userId, unread: 0 });
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
  try {
    const store = getStore();
    const personas = await store.personas.list();
    const persona = personas.find((p) => p.userId === input.targetUserId);
    if (!persona) {
      await sendMessage({
        channelId: input.channelId,
        senderId: 'persona',
        senderKind: 'system',
        body: `⚠️ 未找到 @${input.targetUserId} 的 Persona, 无法代行.`,
        parentMessageId: input.triggeringMessage.id,
      });
      return;
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

    const { getRouter } = await import('../boot');
    const router = getRouter();

    const reply = await router.chat({
      messages: [
        {
          role: 'system',
          content:
            `你正在以 ${input.targetUserId} 的 AI 分身身份回复 IM 消息. ` +
            `当前阶段: ${persona.stage}; 委托级别: ${persona.delegationLevel}. ` +
            `风格: 决策速度=${persona.styleProfile.decisionSpeed}, ` +
            `风险偏好=${persona.styleProfile.riskAppetite}, ` +
            `沟通风格=${persona.styleProfile.communicationStyle}. ` +
            `严格遵守委托级别: 不做超出权限的承诺. 只回 1-3 句话, 简洁.`,
        },
        { role: 'user', content: input.triggeringMessage.body },
      ],
      scenario: 'persona_dialogue',
      maxTokens: 200,
    });

    await sendMessage({
      channelId: input.channelId,
      senderId: input.targetUserId,
      senderKind: 'persona',
      body: `${reply.message.content}\n\n_— ${input.targetUserId} 的 AI 分身 (${persona.stage}) · 仅供参考, 待本人确认_`,
      parentMessageId: input.triggeringMessage.id,
    });
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
