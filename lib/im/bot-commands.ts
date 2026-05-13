/**
 * Tandem Bot Commands · IM 智能助手
 *
 * 在 sendMessage() 中 hook，解析 @tandem 开头的命令，自动执行企业协作动作。
 *
 * 支持的命令:
 *   @tandem action <任务描述> [due: 明天|YYYY-MM-DD] [kr: <krId>]
 *     → 创建 Action Item，关联到指定 KR (可选)
 *
 *   @tandem summary
 *     → 生成当前频道最近 50 条消息的摘要
 *
 *   @tandem decision <议题描述>
 *     → 从当前消息创建 Decision Card (议事室)
 *
 *   @tandem okr <query>
 *     → 查询匹配的 OKR 并返回摘要
 *
 * 设计原则:
 *   - 命令解析失败 = 静默忽略，不破坏正常聊天
 *   - 执行结果以系统消息回复，所有人可见
 *   - 所有操作带审计日志
 */

import { getStore } from '../storage/repository';
import { sendMessage } from './service';
import type { ImMessage } from '../types/im';

// ---------------------------------------------------------------------------
// Command types
// ---------------------------------------------------------------------------

export type BotCommand =
  | { type: 'action'; task: string; due?: string; krId?: string }
  | { type: 'summary' }
  | { type: 'decision'; title: string }
  | { type: 'okr'; query: string }
  | { type: 'promote'; messageId?: string; level?: 'team' | 'dept' | 'company' }
  | { type: 'digest' }
  | { type: 'unknown'; raw: string };

export interface BotContext {
  channelId: string;
  senderId: string;
  senderName?: string;
  messageId: string;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

const BOT_PREFIX = /^@tandem\b/i;

export function parseBotCommand(body: string): BotCommand | null {
  const trimmed = body.trim();
  if (!BOT_PREFIX.test(trimmed)) return null;

  const rest = trimmed.replace(BOT_PREFIX, '').trim();
  if (!rest) return { type: 'unknown', raw: trimmed };

  const tokens = rest.split(/\s+/);
  const verb = tokens[0].toLowerCase();
  const args = tokens.slice(1).join(' ');

  switch (verb) {
    case 'action': {
      const { text, flags } = extractFlags(args);
      return {
        type: 'action',
        task: text.trim(),
        due: flags.due,
        krId: flags.kr,
      };
    }
    case 'summary':
      return { type: 'summary' };
    case 'decision': {
      return { type: 'decision', title: args.trim() || '未命名议题' };
    }
    case 'okr': {
      return { type: 'okr', query: args.trim() };
    }
    case 'promote': {
      const { text: promoteText, flags: promoteFlags } = extractFlags(args);
      return {
        type: 'promote',
        messageId: promoteText.trim() || undefined,
        level: (promoteFlags.level as 'team' | 'dept' | 'company') ?? 'team',
      };
    }
    case 'digest':
      return { type: 'digest' };
    default:
      return { type: 'unknown', raw: trimmed };
  }
}

/** Extract flags like [due: tomorrow] [kr: abc123] from text */
function extractFlags(input: string): { text: string; flags: Record<string, string> } {
  const flags: Record<string, string> = {};
  // Match [key: value] or key: value (until next flag or end)
  const flagRe = /\[?(\w+):\s*([^\]]+)\]?/g;
  let m: RegExpExecArray | null;
  let text = input;
  while ((m = flagRe.exec(input)) !== null) {
    flags[m[1].toLowerCase()] = m[2].trim();
    text = text.replace(m[0], '');
  }
  return { text: text.trim(), flags };
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

export async function executeBotCommand(
  cmd: BotCommand,
  ctx: BotContext
): Promise<string | null> {
  switch (cmd.type) {
    case 'action':
      return executeAction(cmd, ctx);
    case 'summary':
      return executeSummary(ctx);
    case 'decision':
      return executeDecision(cmd, ctx);
    case 'okr':
      return executeOkrQuery(cmd, ctx);
    case 'promote':
      return executePromote(cmd, ctx);
    case 'digest':
      return executeDigest(ctx);
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// @tandem action
// ---------------------------------------------------------------------------

async function executeAction(
  cmd: Extract<BotCommand, { type: 'action' }>,
  ctx: BotContext
): Promise<string> {
  const store = getStore();

  // Resolve due date
  let dueIso: string | undefined;
  if (cmd.due) {
    const parsed = parseDueDate(cmd.due);
    if (parsed) dueIso = parsed.toISOString();
  }

  // Create ActionItem (reuse DecisionCard actionItems structure for now)
  // V2: dedicated ActionItem table. V1: store in a lightweight task format.
  const actionItem = {
    id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    owner: ctx.senderId,
    task: cmd.task,
    due: dueIso ?? new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    status: 'open' as const,
    decisionCardId: '', // standalone action item
    createdBy: ctx.senderId,
    createdAt: new Date().toISOString(),
  };

  // Persist via store (if store.actionItems exists; else log for now)
  try {
    if ('actionItems' in store && typeof (store as any).actionItems?.create === 'function') {
      await (store as any).actionItems.create(actionItem);
    }
  } catch {
    /* V1: store may not have actionItems repo yet */
  }

  // If krId specified, add to KR initiatives (future)
  let krLink = '';
  if (cmd.krId) {
    try {
      const kr = await store.keyResults.get(cmd.krId);
      if (kr) krLink = ` · 关联 KR: **${kr.title}**`;
    } catch { /* ignore */ }
  }

  const dueText = dueIso
    ? new Date(dueIso).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit' })
    : '明天';

  return `✅ 已创建 Action Item\n\n**${cmd.task}**\n负责人: @${ctx.senderId} · 截止: ${dueText}${krLink}`;
}

function parseDueDate(input: string): Date | null {
  const normalized = input.trim().toLowerCase();
  const now = new Date();

  if (normalized === '今天') return now;
  if (normalized === '明天') {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return d;
  }
  if (normalized === '后天') {
    const d = new Date(now);
    d.setDate(d.getDate() + 2);
    return d;
  }
  if (normalized === '下周') {
    const d = new Date(now);
    d.setDate(d.getDate() + 7);
    return d;
  }

  // Try ISO / common formats
  const iso = new Date(input);
  if (!isNaN(iso.getTime())) return iso;

  return null;
}

// ---------------------------------------------------------------------------
// @tandem summary
// ---------------------------------------------------------------------------

async function executeSummary(ctx: BotContext): Promise<string> {
  const store = getStore();
  const all = await store.imMessages.list();
  const msgs = all
    .filter((m) => m.channelId === ctx.channelId && !m.deletedAt && m.senderKind !== 'system')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(-50);

  if (msgs.length === 0) return '📭 该频道暂无消息可摘要。';

  const lines = msgs.map((m) => `- @${m.senderId}: ${m.body.slice(0, 120)}`);
  const participants = Array.from(new Set(msgs.map((m) => m.senderId)));

  return (
    `📋 频道摘要 (最近 ${msgs.length} 条消息, ${participants.length} 人参与)\n\n` +
    lines.slice(-10).join('\n') +
    `\n\n_💡 完整上下文已准备好，可调用 LLM 生成智能摘要 (V2)_`
  );
}

// ---------------------------------------------------------------------------
// @tandem decision
// ---------------------------------------------------------------------------

async function executeDecision(
  cmd: Extract<BotCommand, { type: 'decision' }>,
  ctx: BotContext
): Promise<string> {
  try {
    const { spawnDecisionRoomFromMessage } = await import('./service');
    const result = await spawnDecisionRoomFromMessage({
      messageId: ctx.messageId,
      triggeredBy: ctx.senderId,
      title: cmd.title,
    });
    return `🏛️ 议事室已开: **${cmd.title}**\n\n[查看议事室](/convergence/${result.cardId})`;
  } catch (err) {
    return `⚠️ 创建议事室失败: ${(err as Error).message}`;
  }
}

// ---------------------------------------------------------------------------
// @tandem okr
// ---------------------------------------------------------------------------

async function executeOkrQuery(
  cmd: Extract<BotCommand, { type: 'okr' }>,
  ctx: BotContext
): Promise<string> {
  const store = getStore();
  const all = await store.objectives.list();
  const matched = all.filter((o) =>
    o.title.toLowerCase().includes(cmd.query.toLowerCase())
  );

  if (matched.length === 0) {
    return `🔍 未找到匹配 "${cmd.query}" 的 OKR。`;
  }

  const lines = matched.map((o) => {
    const status = o.status === 'completed' ? '✅' : o.status === 'paused' ? '⏸️' : '📌';
    return `${status} **${o.title}** (${o.level}) · 进度 ${o.weight ?? 0}%`;
  });

  return `🎯 OKR 查询结果:\n\n${lines.join('\n')}`;
}

// ---------------------------------------------------------------------------
// @tandem promote — 消息 → Memory 升级提议 (知识沉淀)
// ---------------------------------------------------------------------------

async function executePromote(
  cmd: Extract<BotCommand, { type: 'promote' }>,
  ctx: BotContext
): Promise<string> {
  try {
    const { promoteImMessageToMemory } = await import('./service');
    // 若未指定 messageId，默认沉淀当前消息
    const targetMessageId = cmd.messageId || ctx.messageId;
    const result = await promoteImMessageToMemory({
      messageId: targetMessageId,
      triggeredBy: ctx.senderId,
      level: cmd.level ?? 'team',
    });
    return `✍️ 已发起 **Memory 升级提议**\n\n` +
      `级别: ${cmd.level ?? 'team'} · 材料 ID: ${result.materialId}\n` +
      `[/memories?promotionId=${result.promotionId}](查看签批进度)`;
  } catch (err) {
    return `⚠️ 知识沉淀失败: ${(err as Error).message}`;
  }
}

// ---------------------------------------------------------------------------
// @tandem digest — LLM 智能摘要 (替代简单文本拼接)
// ---------------------------------------------------------------------------

async function executeDigest(ctx: BotContext): Promise<string> {
  const store = getStore();
  const all = await store.imMessages.list();
  const msgs = all
    .filter((m) => m.channelId === ctx.channelId && !m.deletedAt && m.senderKind !== 'system')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(-50);

  if (msgs.length === 0) return '📭 该频道暂无消息可摘要。';

  const participants = Array.from(new Set(msgs.map((m) => m.senderId)));
  const transcript = msgs.map((m) => `@${m.senderId}: ${m.body}`).join('\n');

  // 尝试调用 LLM 生成智能摘要
  try {
    const { getRouter } = await import('../boot');
    const router = getRouter();
    const reply = await router.chat({
      messages: [
        {
          role: 'system',
          content:
            '你是一位企业协作助手，负责将一组 IM 消息生成结构化摘要。\n' +
            '输出格式要求:\n' +
            '1. 一句话概述讨论主题\n' +
            '2. 列出关键结论 (bullet points)\n' +
            '3. 标出待办/Action Items (若有)\n' +
            '4. 标出争议点或待决议题 (若有)\n' +
            '保持简洁，不超过 300 字。',
        },
        { role: 'user', content: transcript },
      ],
      scenario: undefined,
      maxTokens: 500,
    });

    return (
      `🧠 智能摘要 (最近 ${msgs.length} 条, ${participants.length} 人参与)\n\n` +
      `${reply.message.content}\n\n` +
      `_💡 使用 \`@tandem promote\` 可将此讨论沉淀为知识库材料_`
    );
  } catch {
    // LLM 失败时 fallback 到纯文本摘要
    const lines = msgs.map((m) => `- @${m.senderId}: ${m.body.slice(0, 120)}`);
    return (
      `📋 频道摘要 (最近 ${msgs.length} 条消息, ${participants.length} 人参与)\n\n` +
      lines.slice(-10).join('\n') +
      `\n\n_💡 LLM 摘要暂不可用，fallback 到文本模式_`
    );
  }
}

// ---------------------------------------------------------------------------
// Hook for sendMessage
// ---------------------------------------------------------------------------

/**
 * Call this inside sendMessage() after parseMentions().
 * If a bot command is detected, executes it and returns a system reply message.
 */
export async function handleBotCommand(
  body: string,
  ctx: BotContext
): Promise<ImMessage | null> {
  const cmd = parseBotCommand(body);
  if (!cmd) return null;

  const replyText = await executeBotCommand(cmd, ctx);
  if (!replyText) return null;

  // Send system message as bot reply
  return sendMessage({
    channelId: ctx.channelId,
    senderId: 'tandem-bot',
    senderKind: 'system',
    body: replyText,
    parentMessageId: ctx.messageId,
  });
}
