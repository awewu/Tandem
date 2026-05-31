/**
 * D-01: 文档 @ 引用 → LLM 上下文展开
 *
 * 语法: `[[doc:<id>|<显示标题>]]` (与 @OKR/@KR 同族, 不冲突)
 * 例子: "请基于 [[doc:abc123|2025-Q1合同.pdf]] 给出风险点"
 *
 * 用途: 在调用 router.chat 前把所有 mention 替换为 LLM 可读的内容块,
 * 让 LLM 真正"看到"文件原文, 而不是停在 mention 字符串.
 *
 * 注入格式 (一段附录):
 *   [文件 1: 2025-Q1合同.pdf]
 *   <content>... 解析文本 ...</content>
 *
 * 防爆量: 每个文件最多注入 8000 字 (≈ 4k token), 超出截断 + 标注
 */

import { getStore } from '@/lib/storage/repository';

const MENTION_RE = /\[\[doc:([\w-]+)(?:\|([^\]]+))?\]\]/g;
const PER_FILE_CHAR_BUDGET = 8000;
const TOTAL_CHAR_BUDGET = 24_000;

export interface ResolvedMention {
  id: string;
  title: string;
  found: boolean;
  charCount: number;
  truncated: boolean;
}

export interface ResolveResult {
  /** 原文中所有 mention 已替换为 (见附录 N: title) 标签 */
  inlineText: string;
  /** 附录块, 可拼到 systemContent 末尾 */
  appendix: string;
  /** 命中 / 未命中详情 */
  mentions: ResolvedMention[];
}

/**
 * 提取并展开 text 中的所有 [[doc:id|title]] mention.
 * 返回: 替换后的 inline 文本 + 附录块 + 命中详情.
 */
export async function resolveDocumentMentions(text: string): Promise<ResolveResult> {
  const matches = Array.from(text.matchAll(MENTION_RE));
  if (matches.length === 0) {
    return { inlineText: text, appendix: '', mentions: [] };
  }

  const store = getStore();
  const mentions: ResolvedMention[] = [];
  const blocks: string[] = [];
  let totalBudget = TOTAL_CHAR_BUDGET;
  let idx = 0;

  for (const m of matches) {
    const id = m[1];
    const titleHint = m[2]?.trim();
    idx++;
    try {
      const doc = await store.documents.get(id);
      if (!doc) {
        mentions.push({ id, title: titleHint ?? id, found: false, charCount: 0, truncated: false });
        continue;
      }
      const title = doc.title ?? titleHint ?? id;
      const raw = typeof doc.content === 'string' ? doc.content : JSON.stringify(doc.content ?? '');
      const perFile = Math.min(PER_FILE_CHAR_BUDGET, Math.max(0, totalBudget));
      const truncated = raw.length > perFile;
      const slice = truncated ? raw.slice(0, perFile) + `\n... [已截断, 原文 ${raw.length} 字]` : raw;
      totalBudget -= slice.length;

      blocks.push(`[附录 ${idx}: ${title}]\n<content>\n${slice}\n</content>`);
      mentions.push({ id, title, found: true, charCount: slice.length, truncated });
    } catch {
      mentions.push({ id, title: titleHint ?? id, found: false, charCount: 0, truncated: false });
    }
  }

  // 替换 inline mention 为短标签, 让 LLM 知道这是引用
  let inlineIdx = 0;
  const inlineText = text.replace(MENTION_RE, (_, id: string, hint?: string) => {
    inlineIdx++;
    const m = mentions[inlineIdx - 1];
    if (!m?.found) return `(文档 ${hint ?? id} 未找到)`;
    return `(见附录 ${inlineIdx}: ${m.title})`;
  });

  const appendix =
    blocks.length > 0
      ? `\n\n---\n\n## 用户引用的文档原文\n\n${blocks.join('\n\n---\n\n')}`
      : '';

  return { inlineText, appendix, mentions };
}

/** 快速判断字符串里是否含 mention, 避免无谓 IO. */
export function hasDocumentMention(text: string): boolean {
  return /\[\[doc:[\w-]+/.test(text);
}
