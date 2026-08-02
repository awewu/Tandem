/**
 * lib/memory/compression.ts · P1 #8 SimpleMem 语义无损压缩
 *
 * 前沿 (SimpleMem, arXiv 2026): 记忆正文原样存储信息密度低, 检索时塞入 context 浪费 token。
 * 做法: 记忆物化 (materializePromotion) 时用 LLM 把正文蒸馏为**结构化摘要 + 关键事实**,
 * 存压缩版 (compressedBody/compressedFacts) + 保留原始 body。检索/注入时优先用压缩版省 token,
 * 需要细节时展开原始 body。F1 +26.4%, token -30x (论文数据)。
 *
 * 纪律: LLM best-effort fail-soft; 压缩失败保持 compressedBody 空 (回退用原始 body, 零回归)。
 */

import type { MemoryEntry } from '@/lib/types/memory';
import { getStore } from '@/lib/storage/repository';
import { logger } from '@/lib/infra/logger';

/** 短记忆无需压缩的阈值 (正文字符数); 低于此直接跳过。 */
const MIN_COMPRESS_LEN = 400;

export interface CompressionResult {
  compressedBody: string;
  compressedFacts: string[];
}

/**
 * 用 LLM 把一段记忆正文压缩为结构化摘要 + 关键事实。
 * 正文过短 → 返回 null (无需压缩)。LLM 失败 → 返回 null (回退原始 body)。
 */
export async function compressMemoryBody(
  title: string,
  body: string,
): Promise<CompressionResult | null> {
  if (!body || body.length < MIN_COMPRESS_LEN) return null;
  try {
    const { getRouter } = await import('@/lib/boot');
    const router = getRouter();
    const system =
      '你是企业知识压缩官。把给定记忆正文**无损压缩**为结构化摘要 + 关键事实, 保留所有决策/数字/约束/负责人, 去掉冗余表述。' +
      '只输出 JSON: {"summary":"≤200字结构化摘要","facts":["关键事实1","关键事实2",...(≤5条)]}。';
    // eslint-disable-next-line no-restricted-syntax -- governed-chat-exempt: 记忆压缩只读只记 (宪法A), 人工签批后触发
    const reply = await router.chat({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `标题: ${title}\n\n正文:\n${body.slice(0, 4000)}` },
      ],
      scenario: 'long_context',
      maxTokens: 500,
      metadata: { userId: '__memory_compress__', feature: 'memory_compression' },
    });
    const content = typeof reply.message.content === 'string' ? reply.message.content : JSON.stringify(reply.message.content);
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const parsed = JSON.parse(m[0]) as { summary?: unknown; facts?: unknown };
    const summary = typeof parsed.summary === 'string' ? parsed.summary.slice(0, 400) : '';
    const facts = Array.isArray(parsed.facts)
      ? parsed.facts.filter((f): f is string => typeof f === 'string').map((f) => f.slice(0, 200)).slice(0, 5)
      : [];
    if (!summary && facts.length === 0) return null;
    return { compressedBody: summary, compressedFacts: facts };
  } catch (err) {
    logger.warn({ err: (err as Error).message, title }, '[memory-compression] failed (fail-soft → keep original)');
    return null;
  }
}

/**
 * 对一条已存储记忆跑压缩并写回 compressedBody/compressedFacts (best-effort)。
 * 供 materializePromotion fire-and-forget 调用。永不抛。
 */
export async function compressAndStore(entryId: string): Promise<void> {
  try {
    const store = getStore();
    const entry = (await store.memories.get(entryId)) as MemoryEntry | null;
    if (!entry) return;
    if (entry.compressedBody) return; // 已压缩, 幂等跳过
    const result = await compressMemoryBody(entry.title, entry.body);
    if (!result) return;
    await store.memories.update(entryId, {
      compressedBody: result.compressedBody,
      compressedFacts: result.compressedFacts,
    } as Partial<MemoryEntry>);
    logger.info({ entryId, facts: result.compressedFacts.length }, '[memory-compression] stored compressed memory');
  } catch (err) {
    logger.warn({ err: (err as Error).message, entryId }, '[memory-compression] compressAndStore failed');
  }
}

/**
 * 检索/注入时取记忆的"精简正文": 有压缩版用压缩版 (省 token), 否则用原始 body。
 */
export function memoryInjectionText(m: Pick<MemoryEntry, 'body' | 'compressedBody' | 'compressedFacts'>): string {
  if (m.compressedBody) {
    const facts = (m.compressedFacts ?? []).length > 0 ? `\n关键事实: ${(m.compressedFacts ?? []).join('; ')}` : '';
    return `${m.compressedBody}${facts}`;
  }
  return m.body ?? '';
}
