/**
 * lib/agent-runtime/info-flow.ts · P1 #7 FIDES 信息流确定性执行
 *
 * 前沿 (FIDES, Microsoft Agent Framework 2026): 每条内容携带 integrity label
 * (trusted/untrusted)。不可信内容 (web search / 手抄 / 邮件 / 外部) 进入 context 后,
 * 下游敏感工具 (写 Memory / 发通知 / 执行动作) 执行前**确定性**检查: 若 context 含
 * 不可信内容 → 拒绝 (不依赖模型判断)。模型决定做什么, 框架决定什么被允许。ASR 大幅下降。
 *
 * 本实现 (推理时翻译, 无模型内部访问):
 *   - classifyIntegrity(toolName): 按 skill/工具来源判定 trusted/untrusted
 *   - isSensitiveTool(toolName): 判定是否敏感 (写/外发/执行)
 *   - wrapUntrusted(text): 用 [UNTRUSTED]...[/UNTRUSTED] 包裹, 让下游可见来源
 *
 * 纪律: 纯确定性规则, 不调 LLM; 保守默认 (未知来源按内部只读=trusted, 避免误伤既有只读流)。
 */

export type Integrity = 'trusted' | 'untrusted';

/**
 * 不可信来源工具 (其返回内容视为 untrusted): 外部网页 / 手抄(外部用户产出) / 邮件 / 外部 AI / MCP。
 * 用子串匹配 skill id (点号或双下划线形式均可命中)。
 */
const UNTRUSTED_PATTERNS = [
  'web.search', 'web_search', 'websearch',
  'shouchao', 'shou_chao',
  'mail', 'email',
  'external', 'guest', 'partner',
  'crawl', 'fetch_url', 'browse',
];

/**
 * 敏感工具 (执行前需检查信息流): 写记忆 / 发通知 / 提议或执行动作 / 发送消息。
 */
const SENSITIVE_PATTERNS = [
  'memory.write', 'memory_write', 'write_memory', 'promote',
  'notification', 'notify', 'send',
  'action.execute', 'execute_action', 'propose_action', 'proposeaction',
  'checkin', 'check_in', 'okr.write', 'okr_write',
  'im.send', 'message.send',
];

function matchesAny(name: string, patterns: string[]): boolean {
  const n = name.toLowerCase();
  return patterns.some((p) => n.includes(p));
}

/** 判定一个工具返回内容的完整性标签。未知 → trusted (内部只读默认可信, 零回归)。 */
export function classifyIntegrity(toolName: string, opts: { isMcp?: boolean } = {}): Integrity {
  if (opts.isMcp) return 'untrusted'; // 外部 MCP server 一律不可信
  return matchesAny(toolName, UNTRUSTED_PATTERNS) ? 'untrusted' : 'trusted';
}

/** 判定一个工具是否敏感 (执行前需信息流检查)。 */
export function isSensitiveTool(toolName: string): boolean {
  return matchesAny(toolName, SENSITIVE_PATTERNS);
}

const UNTRUSTED_OPEN = '[UNTRUSTED';
const UNTRUSTED_CLOSE = '[/UNTRUSTED]';

/** 用来源标记包裹不可信内容, 让模型与下游可见其来源 (但不阻止读取)。 */
export function wrapUntrusted(text: string, source: string): string {
  return `${UNTRUSTED_OPEN} source=${source}]\n${text}\n${UNTRUSTED_CLOSE}`;
}

/** 判断一段文本是否含被标记的不可信内容 (用于敏感工具前置检查)。 */
export function containsUntrusted(text: string): boolean {
  return text.includes(UNTRUSTED_OPEN) && text.includes(UNTRUSTED_CLOSE);
}
