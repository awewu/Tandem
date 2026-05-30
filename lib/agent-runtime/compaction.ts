/**
 * Compaction · 上下文自动压缩
 *
 * §2026-05-29 Owner 决议补完 (Anthropic Claude Agent SDK 2026 最佳实践):
 *   "长会话 / 长议事必备 — 接近 context limit 时自动把中间历史摘成 1 段, 保留首尾.
 *    避免硬截断丢关键信息."
 *
 * 策略 (从 Claude Code /compact 灵感):
 *   - 保留所有 system 消息 (含 OKR Anchor)
 *   - 保留首个 user 消息 (任务原始锚点)
 *   - 保留最后 N 轮 (默认 4) 完整对话
 *   - 中间段落 → 调 LLM 摘要成 1 个 system 消息 ("【对话摘要】...")
 *
 * 字符阈值粗略对应 token (中文 ~1.5 char/token, 英文 ~4 char/token):
 *   - default trigger = 24000 chars (~ 12K-16K tokens, 安全余量)
 *
 * 永不抛错: 摘要失败时降级为硬截断 (drop 中间, 不影响主流程).
 */

import type { ChatMessage, ScenarioTag } from '@/lib/taf/provider/types';
import { logger } from '@/lib/infra/logger';

export interface CompactionOptions {
  /** 触发摘要的总字符阈值 (默认 24000) */
  triggerChars?: number;
  /** 保留最后 N 轮对话 (一轮 = user + assistant, 默认 4) */
  keepLastTurns?: number;
  /** 摘要用的 scenario (默认 reasoning_short, 便宜小模型即可) */
  scenario?: ScenarioTag;
  /** 是否启用 LLM 摘要 (false 则硬截断, 默认 true) */
  enableLlmSummary?: boolean;
}

export interface CompactionResult {
  messages: ChatMessage[];
  /** 是否进行了压缩 */
  compacted: boolean;
  /** 删除的中间消息数 */
  droppedCount: number;
  /** 是否调用了 LLM 摘要 */
  usedLlm: boolean;
  /** 压缩前 / 后的总字符数 */
  charsBeforeAfter?: { before: number; after: number };
}

const DEFAULTS: Required<CompactionOptions> = {
  triggerChars: 24000,
  keepLastTurns: 4,
  scenario: 'high_frequency',
  enableLlmSummary: true,
};

/**
 * Compact 消息数组. 若总字符 < trigger 则原样返回.
 */
export async function compactMessages(
  messages: ChatMessage[],
  opts: CompactionOptions = {},
): Promise<CompactionResult> {
  const o = { ...DEFAULTS, ...opts };
  const totalChars = totalCharsOf(messages);

  if (totalChars < o.triggerChars) {
    return { messages, compacted: false, droppedCount: 0, usedLlm: false };
  }

  // 1. 拆分: systems | firstUser | middle | lastNTurns
  const systems: ChatMessage[] = [];
  const rest: ChatMessage[] = [];
  for (const m of messages) {
    if (m.role === 'system') systems.push(m);
    else rest.push(m);
  }

  // 第一个 user (任务锚点)
  const firstUserIdx = rest.findIndex((m) => m.role === 'user');
  const firstUser = firstUserIdx >= 0 ? rest[firstUserIdx] : null;
  const afterFirstUser = firstUserIdx >= 0 ? rest.slice(firstUserIdx + 1) : rest;

  // 保留最后 N 轮 (一轮 = 一对 user/assistant, 这里近似为 N*2 条)
  const keepCount = Math.max(1, o.keepLastTurns) * 2;
  const tail = afterFirstUser.slice(-keepCount);
  const middle = afterFirstUser.slice(0, Math.max(0, afterFirstUser.length - keepCount));

  if (middle.length === 0) {
    // 触发了阈值但中间没什么可压, 直接放过
    return { messages, compacted: false, droppedCount: 0, usedLlm: false };
  }

  // 2. 摘要中间段
  let summaryText: string;
  let usedLlm = false;
  if (o.enableLlmSummary) {
    try {
      summaryText = await llmSummarize(middle, o.scenario);
      usedLlm = true;
    } catch (err) {
      logger.warn({ err: (err as Error).message }, '[compaction] LLM 摘要失败, 降级硬截断');
      summaryText = hardTruncateSummary(middle);
    }
  } else {
    summaryText = hardTruncateSummary(middle);
  }

  const summaryBlock: ChatMessage = {
    role: 'system',
    content: `【对话摘要 · 自动压缩 ${middle.length} 条历史消息】\n${summaryText}`,
  };

  // 3. 拼回
  const out: ChatMessage[] = [
    ...systems,
    ...(firstUser ? [firstUser] : []),
    summaryBlock,
    ...tail,
  ];

  const afterChars = totalCharsOf(out);

  return {
    messages: out,
    compacted: true,
    droppedCount: middle.length,
    usedLlm,
    charsBeforeAfter: { before: totalChars, after: afterChars },
  };
}

// ──────────────────────────────────────────────────────────────────
// LLM 摘要
// ──────────────────────────────────────────────────────────────────
async function llmSummarize(middle: ChatMessage[], scenario: ScenarioTag): Promise<string> {
  const { getRouter } = await import('@/lib/boot');
  const router = getRouter();

  const transcript = middle
    .map((m) => `[${m.role}] ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`)
    .join('\n')
    .slice(0, 30000); // 摘要输入硬上限

  const reply = await router.chat({
    messages: [
      {
        role: 'system',
        content:
          '你是对话摘要器. 把多轮对话压缩成简短要点 (≤300字), ' +
          '保留: 关键决定 / 用户提的事实 / 工具调用结果 / 待办. ' +
          '丢弃: 寒暄, 重复, 已被后续推翻的早期回答. ' +
          '用第三人称客观描述, 不要"我说/你说".',
      },
      {
        role: 'user',
        content: `请摘要下列对话:\n\n${transcript}`,
      },
    ],
    scenario,
    maxTokens: 600,
    temperature: 0.2,
  });

  return typeof reply.message.content === 'string'
    ? reply.message.content.trim()
    : '(摘要失败 · 内容非字符串)';
}

// ──────────────────────────────────────────────────────────────────
// 降级硬截断 (不调 LLM)
// ──────────────────────────────────────────────────────────────────
function hardTruncateSummary(middle: ChatMessage[]): string {
  const lines: string[] = [
    `(LLM 摘要不可用 · 已硬截断 ${middle.length} 条历史消息)`,
    '',
    '保留首条 user / 末尾 N 轮的关键信息, 中间内容已丢弃.',
    `丢弃统计: user=${middle.filter((m) => m.role === 'user').length}, ` +
      `assistant=${middle.filter((m) => m.role === 'assistant').length}, ` +
      `tool=${middle.filter((m) => m.role === 'tool').length}`,
  ];
  // 取每条前 80 字作为指纹, 让后续模型不至于完全失忆
  const fingerprints = middle.slice(0, 10).map((m, i) => {
    const c = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
    return `  ${i + 1}. [${m.role}] ${c.slice(0, 80).replace(/\s+/g, ' ')}`;
  });
  if (fingerprints.length > 0) {
    lines.push('', '历史消息指纹 (前 10 条, 每条 80 字):', ...fingerprints);
  }
  return lines.join('\n');
}

// ──────────────────────────────────────────────────────────────────
// helpers
// ──────────────────────────────────────────────────────────────────
function totalCharsOf(messages: ChatMessage[]): number {
  let n = 0;
  for (const m of messages) {
    n += typeof m.content === 'string' ? m.content.length : JSON.stringify(m.content).length;
  }
  return n;
}
