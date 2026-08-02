/**
 * IM 群总结 · AI 会话智能 (§Sprint3 Megaplan · 对标企业微信「群总结」)
 *
 * 设计:
 *   - 读侧分析能力: 把频道近期对话交给 LLM, 产出结构化总结 (概览/话题/结论/待办/未决)。
 *   - 权限: 只有频道成员可总结 (getChannelIfVisible + 同租户)。
 *   - scope: 'recent' 最近 N 条 · 'unread' 我上次已读之后 · 'today' 最近 24h。
 *   - fail-soft: LLM 不可用/解析失败时回退到确定性的"轻量总结" (参与者 + 计数 + 尾部预览),
 *     绝不抛错阻断 UI (借鉴 app/api/mail/thread-summary 的降级策略)。
 */

import { getStore } from '../storage/repository';
import { membershipKey, type ImChannel, type ImMessage } from '../types/im';
import { getChannelIfVisible, getChannelMessages } from './service';

export type ImSummaryScope = 'recent' | 'unread' | 'today';

export interface ImSummaryTodo {
  owner: string;
  task: string;
  /** §Sprint3 派发闭环: owner 若能匹配到频道成员则填其 userId, 供一键 @assign */
  ownerId?: string;
}

export interface ImSummaryResult {
  overview: string;
  topics: Array<{ title: string; detail: string }>;
  decisions: string[];
  todos: ImSummaryTodo[];
  questions: string[];
}

export interface SummarizeChannelOutput {
  ok: boolean;
  /** 是否走了 LLM (false = 降级轻量总结) */
  aiGenerated: boolean;
  scope: ImSummaryScope;
  messageCount: number;
  participantCount: number;
  rangeStart: string | null;
  rangeEnd: string | null;
  summary: ImSummaryResult;
  /** 消息太少 (< 2) 时提示 */
  reason?: 'too_few';
}

export interface SummarizeChannelInput {
  channelId: string;
  userId: string;
  tenantId?: string;
  scope?: ImSummaryScope;
}

const MAX_MESSAGES = 200;
const MAX_BODY_CHARS = 600;

/** 去掉 @[name](userId:kind) mention token, 还原为可读的 @name */
function stripMentionTokens(body: string): string {
  return body.replace(/@\[([^\]]+)\]\(([^)]+)\)/g, (_, name) => `@${name}`);
}

/** 依据 scope 计算起始时间下限 (ISO), 'recent' 无下限返回 null */
function scopeLowerBound(scope: ImSummaryScope, lastReadAt?: string): string | null {
  if (scope === 'unread') return lastReadAt ?? null;
  if (scope === 'today') return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  return null;
}

/** 过滤出可总结的消息 (排除软删 + 空 body) 并按 scope 时间窗裁剪 */
export function selectSummarizableMessages(
  messages: ImMessage[],
  scope: ImSummaryScope,
  lastReadAt?: string,
): ImMessage[] {
  const lower = scopeLowerBound(scope, lastReadAt);
  const lowerMs = lower ? new Date(lower).getTime() : null;
  return messages
    .filter((m) => !m.deletedAt)
    .filter((m) => (m.body ?? '').trim().length > 0)
    .filter((m) => (lowerMs === null ? true : new Date(m.createdAt).getTime() > lowerMs))
    .slice(-MAX_MESSAGES);
}

/** 把消息渲染成带说话人姓名的转写 (供 LLM 与降级摘要复用) */
export function buildTranscript(
  messages: ImMessage[],
  nameOf: (id: string) => string,
): string {
  return messages
    .map((m) => {
      const who = m.senderKind === 'user' ? nameOf(m.senderId) : m.senderKind === 'persona' ? `${nameOf(m.senderId)}(AI)` : '系统';
      const t = new Date(m.createdAt);
      const hhmm = `${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}`;
      const text = stripMentionTokens(m.body ?? '').trim().slice(0, MAX_BODY_CHARS);
      return `[${hhmm}] ${who}: ${text}`;
    })
    .join('\n');
}

/** 确定性降级总结 (LLM 不可用时): 不编造结论, 只给客观的参与者/计数/尾部预览 */
function fallbackSummary(messages: ImMessage[], nameOf: (id: string) => string): ImSummaryResult {
  const participants = Array.from(new Set(messages.filter((m) => m.senderKind === 'user').map((m) => nameOf(m.senderId))));
  const tail = messages.slice(-5).map((m) => {
    const who = m.senderKind === 'user' ? nameOf(m.senderId) : '系统/AI';
    return `${who}: ${stripMentionTokens(m.body ?? '').trim().slice(0, 80)}`;
  });
  return {
    overview: `AI 总结服务暂不可用。本次共 ${messages.length} 条消息, ${participants.length} 人参与 (${participants.slice(0, 8).join('、')}${participants.length > 8 ? '…' : ''})。以下为最近发言, 请手动查看。`,
    topics: [],
    decisions: [],
    todos: [],
    questions: [],
    ...(tail.length ? { topics: [{ title: '最近发言', detail: tail.join('\n') }] } : {}),
  };
}

/**
 * 把 todo.owner (LLM 产出的自由文本人名) 解析为频道成员 userId (供一键派发)。
 * 仅在成员名单内匹配 (归一化去空格 + 大小写), 匹配不到留空 (前端降级为不可派发)。
 * 纯函数, 单元测试友好。
 */
export function resolveTodoOwnerId(
  ownerName: string,
  members: Array<{ id: string; name: string }>,
): string | undefined {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '');
  const key = norm(ownerName);
  if (!key || key === norm('待认领')) return undefined;
  // 先精确 (归一化) 匹配, 再退化为 id 直配 (LLM 偶尔直接写 userId)
  const exact = members.find((m) => norm(m.name) === key);
  if (exact) return exact.id;
  const byId = members.find((m) => norm(m.id) === key);
  return byId?.id;
}

const SYSTEM_PROMPT = `你是 Tandem 群聊总结助手。请把一段多人 IM 群聊转写整理为结构化中文总结, 帮助没跟上进度的成员快速回顾。

要求:
- 忠于原文, 不臆造未出现的结论或待办; 无相关内容时对应字段返回空数组。
- todos 的 owner 用发言中出现的人名; 无明确负责人时填 "待认领"。
- overview 用 2-3 句话概括这段对话在讨论什么、进展到哪。

严格只输出如下 JSON (不要 markdown 代码块, 不要多余文字):
{
  "overview": "一段话概览",
  "topics": [{ "title": "话题标题", "detail": "一两句展开" }],
  "decisions": ["已达成的结论/决定"],
  "todos": [{ "owner": "负责人", "task": "要做的事" }],
  "questions": ["尚未解决/待回答的问题"]
}`;

function coerceResult(raw: unknown): ImSummaryResult {
  const o = (raw ?? {}) as Record<string, unknown>;
  const asStrArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : [];
  const topics = Array.isArray(o.topics)
    ? o.topics
        .filter((t): t is Record<string, unknown> => typeof t === 'object' && t !== null)
        .map((t) => ({ title: String(t.title ?? '').trim(), detail: String(t.detail ?? '').trim() }))
        .filter((t) => t.title || t.detail)
    : [];
  const todos = Array.isArray(o.todos)
    ? o.todos
        .filter((t): t is Record<string, unknown> => typeof t === 'object' && t !== null)
        .map((t) => ({ owner: String(t.owner ?? '待认领').trim() || '待认领', task: String(t.task ?? '').trim() }))
        .filter((t) => t.task)
    : [];
  return {
    overview: typeof o.overview === 'string' ? o.overview.trim() : '',
    topics,
    decisions: asStrArr(o.decisions),
    todos,
    questions: asStrArr(o.questions),
  };
}

/** 解析 LLM 返回文本为 JSON (容忍被 ```json 包裹) */
function parseJsonLoose(content: string): unknown {
  const trimmed = content.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  const slice = start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed;
  return JSON.parse(slice);
}

export async function summarizeChannel(input: SummarizeChannelInput): Promise<SummarizeChannelOutput> {
  const scope: ImSummaryScope = input.scope ?? 'recent';
  const tenantId = input.tenantId ?? 'default';

  // 权限闸: 非成员/跨租户 → 抛错, 路由据此 404 (不泄露存在性)
  const channel = await getChannelIfVisible(input.channelId, input.userId, tenantId);
  if (!channel) throw new Error('not found');

  const store = getStore();
  const membership = await store.imMemberships.get(membershipKey(input.channelId, input.userId));
  return summarizeResolvedChannel(channel, { scope, tenantId, lastReadAt: membership?.lastReadAt });
}

export interface ResolvedSummaryOpts {
  scope: ImSummaryScope;
  tenantId: string;
  /** scope='unread' 时的已读游标 (定时日报走 'today' 时无需) */
  lastReadAt?: string;
}

/**
 * 无权限闸的总结核心 — 已知 channel (调用方负责鉴权/挑选)。
 * 供 summarizeChannel (成员视角) 与 daily-digest (系统机器人) 复用。
 */
export async function summarizeResolvedChannel(
  channel: ImChannel,
  opts: ResolvedSummaryOpts,
): Promise<SummarizeChannelOutput> {
  const { scope, tenantId, lastReadAt } = opts;
  const store = getStore();
  const rawMessages = await getChannelMessages(channel.id, { limit: MAX_MESSAGES });
  const messages = selectSummarizableMessages(rawMessages, scope, lastReadAt);

  // 姓名解析 (服务端, best-effort)
  const nameMap = new Map<string, string>();
  try {
    const users = await store.auth.users.list({ tenantId });
    for (const u of users) nameMap.set(u.id, u.name ?? u.id);
  } catch {
    /* fail-soft: 解析不到名字就回退 userId */
  }
  const nameOf = (id: string): string => {
    if (id === '__company__') return 'CompanyBrain';
    if (id === 'persona') return 'AI分身';
    return nameMap.get(id) ?? id;
  };

  const participantCount = new Set(messages.filter((m) => m.senderKind === 'user').map((m) => m.senderId)).size;
  const rangeStart = messages.length ? messages[0].createdAt : null;
  const rangeEnd = messages.length ? messages[messages.length - 1].createdAt : null;

  const base = {
    scope,
    messageCount: messages.length,
    participantCount,
    rangeStart,
    rangeEnd,
  };

  // 内容太少不值得 LLM
  if (messages.length < 2) {
    return {
      ...base,
      ok: true,
      aiGenerated: false,
      reason: 'too_few',
      summary: {
        overview: messages.length === 0 ? '该范围内没有可总结的消息。' : '该范围内消息太少, 无需总结。',
        topics: [],
        decisions: [],
        todos: [],
        questions: [],
      },
    };
  }

  const transcript = buildTranscript(messages, nameOf);

  try {
    const { createDefaultRouter } = await import('@/lib/taf');
    const router = createDefaultRouter();
    const response = await router.chat({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `群名: ${channel.name || '(未命名)'}\n以下是群聊转写, 请生成结构化总结:\n\n${transcript}` },
      ],
    });
    const content = typeof response.message.content === 'string' ? response.message.content : '';
    const summary = coerceResult(parseJsonLoose(content));
    if (!summary.overview) throw new Error('empty summary');
    // 派发闭环: 把 todo.owner 解析为频道成员 userId (仅成员名单内)
    const memberRoster = channel.memberIds.map((id) => ({ id, name: nameOf(id) }));
    summary.todos = summary.todos.map((t) => ({ ...t, ownerId: resolveTodoOwnerId(t.owner, memberRoster) }));
    return { ...base, ok: true, aiGenerated: true, summary };
  } catch {
    return { ...base, ok: true, aiGenerated: false, summary: fallbackSummary(messages, nameOf) };
  }
}

/** 由结构化结果拼出 markdown (供路由兼容旧客户端 + 定时日报系统消息复用) */
export function summaryToMarkdown(out: SummarizeChannelOutput): string {
  const s = out.summary;
  const parts: string[] = [];
  if (s.overview) parts.push(s.overview);
  if (s.topics.length) parts.push('**核心讨论**\n' + s.topics.map((t) => `- ${t.title}${t.detail ? `：${t.detail}` : ''}`).join('\n'));
  if (s.decisions.length) parts.push('**决定事项**\n' + s.decisions.map((x) => `- ${x}`).join('\n'));
  if (s.todos.length) parts.push('**待跟进**\n' + s.todos.map((t) => `- [${t.owner}] ${t.task}`).join('\n'));
  if (s.questions.length) parts.push('**未决问题**\n' + s.questions.map((x) => `- ${x}`).join('\n'));
  return parts.join('\n\n') || '暂无可总结内容。';
}
