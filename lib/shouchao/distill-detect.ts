/**
 * A2 · 个人蒸馏候选检测 (纯逻辑, 无 DB/LLM, 便于单测)
 *
 * 输入本人已授权的笔记, 输出"沉淀建议草稿"。规则化、确定性:
 *   - structure: 清单/表格型笔记 → 建议抽取成数据库
 *   - summarize: 超长且无摘要的笔记 → 建议生成摘要
 *   - link:      主题相近的两条笔记 → 建议互加双链
 */

import type { ShouchaoDistillType } from '../types/shouchao-distillation';

export interface DistillNote {
  id: string;
  title: string;
  content: string;
}

export interface DistillDraft {
  type: ShouchaoDistillType;
  noteIds: string[];
  signature: string;
  suggestion: string;
  rationale: string;
}

const LONG_CHARS = 800;
const LINK_SIM_THRESHOLD = 0.32;
const MAX_LINK_PAIRS = 10;

export function signatureOf(type: ShouchaoDistillType, noteIds: string[]): string {
  return `${type}:${[...noteIds].sort().join(',')}`;
}

/** 中英混合分词 (英文整词 / 中文单字), 与 retriever 一致。 */
export function tokenizeMixed(s: string): Set<string> {
  const out = new Set<string>();
  const re = /([a-zA-Z0-9]+)|([\u4e00-\u9fa5])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s.toLowerCase())) !== null) out.add(m[1] ?? m[2]);
  return out;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  a.forEach((t) => {
    if (b.has(t)) inter++;
  });
  return inter / (a.size + b.size - inter);
}

/** 清单/表格型: 含 GFM 表格行, 或 >=3 行 markdown 列表/键值。 */
export function detectStructurable(note: DistillNote): boolean {
  const lines = note.content.split(/\r?\n/).map((l) => l.trim());
  const tableRows = lines.filter((l) => /^\|.*\|$/.test(l)).length;
  if (tableRows >= 2) return true;
  const listRows = lines.filter((l) => /^([-*+]|\d+\.)\s+/.test(l)).length;
  const kvRows = lines.filter((l) => /^[^\s:：][^:：]{0,20}[:：]\s*\S+/.test(l)).length;
  return listRows >= 3 || kvRows >= 3;
}

/** 超长且开头无摘要 (无 "摘要"/"TL;DR"/">" 引言) 的笔记。 */
export function detectLongForSummary(note: DistillNote): boolean {
  if (note.content.length < LONG_CHARS) return false;
  const head = note.content.slice(0, 80);
  return !/摘要|tl;dr|tldr|^\s*>/i.test(head);
}

/** 两条笔记是否已互链 (content 含对方标题的 [[双链]])。 */
function alreadyLinked(a: DistillNote, b: DistillNote): boolean {
  return a.content.includes(`[[${b.title}]]`) || b.content.includes(`[[${a.title}]]`);
}

/**
 * 从一批笔记产出蒸馏草稿。确定性: 输入相同 → 输出(及顺序)相同。
 * link 对按相似度降序, 上限 MAX_LINK_PAIRS。
 */
export function buildCandidates(notes: DistillNote[]): DistillDraft[] {
  const drafts: DistillDraft[] = [];

  // structure + summarize (逐条)
  for (const n of notes) {
    if (detectStructurable(n)) {
      drafts.push({
        type: 'structure',
        noteIds: [n.id],
        signature: signatureOf('structure', [n.id]),
        suggestion: `《${n.title || '未命名'}》像清单/表格，建议用「AI 导入」抽取成数据库，便于筛选与统计。`,
        rationale: '检测到多行清单 / 键值 / 表格结构',
      });
    }
    if (detectLongForSummary(n)) {
      drafts.push({
        type: 'summarize',
        noteIds: [n.id],
        signature: signatureOf('summarize', [n.id]),
        suggestion: `《${n.title || '未命名'}》较长（${n.content.length} 字），建议在开头补一段摘要，便于日后检索回顾。`,
        rationale: `正文约 ${n.content.length} 字且无摘要`,
      });
    }
  }

  // link (两两相似)
  const toks = notes.map((n) => ({ n, t: tokenizeMixed(`${n.title} ${n.content}`) }));
  const pairs: Array<{ a: DistillNote; b: DistillNote; sim: number }> = [];
  for (let i = 0; i < toks.length; i++) {
    for (let j = i + 1; j < toks.length; j++) {
      const sim = jaccard(toks[i].t, toks[j].t);
      if (sim >= LINK_SIM_THRESHOLD && !alreadyLinked(toks[i].n, toks[j].n)) {
        pairs.push({ a: toks[i].n, b: toks[j].n, sim });
      }
    }
  }
  pairs
    .sort((x, y) => y.sim - x.sim)
    .slice(0, MAX_LINK_PAIRS)
    .forEach(({ a, b, sim }) => {
      const ids = [a.id, b.id];
      drafts.push({
        type: 'link',
        noteIds: ids,
        signature: signatureOf('link', ids),
        suggestion: `《${a.title || '未命名'}》与《${b.title || '未命名'}》主题相近，建议互加双链 [[…]] 形成知识网络。`,
        rationale: `Jaccard 相似度 ${sim.toFixed(2)}`,
      });
    });

  return drafts;
}
