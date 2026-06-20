/**
 * 搭字手抄 · 语义检索集成验证 (防假闭环)
 *
 * 关键: 验证"配上 embedding 后, 同义词真能召回"——而不仅是 Jaccard 兜底.
 * 用 mock embedding 模拟向量空间: "年假" 与 "休假" 向量相近, 与 "报销" 远.
 * 这样断言 searchNotesForAsk 走的是语义路径, 且语义路径确实命中同义词.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// mock embedding: 用一个极简"语义空间"——同主题词共享一个基向量
const SEMANTIC_GROUPS: Record<string, number[]> = {
  休假: [1, 0, 0],
  年假: [0.96, 0.1, 0], // 与"休假"高度相近
  请假: [0.9, 0.2, 0],
  报销: [0, 1, 0], // 与休假正交
  发票: [0, 0.95, 0.1],
};
function vecFor(text: string): number[] {
  for (const [kw, v] of Object.entries(SEMANTIC_GROUPS)) {
    if (text.includes(kw)) return v;
  }
  return [0, 0, 1]; // 无关主题
}

vi.mock('@/lib/infra/embedding', () => ({
  isEmbeddingConfigured: async () => true,
  embed: async (text: string) => vecFor(text),
  cosineSim: (a: number[], b: number[]) => {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    const d = Math.sqrt(na) * Math.sqrt(nb);
    return d === 0 ? 0 : dot / d;
  },
}));

import { setStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { createNote, searchNotesForAsk } from '@/lib/shouchao/service';

const OWNER = 'user_a';
const TENANT = 'default';

beforeEach(() => {
  setStore(createInMemoryStore());
});

describe('语义检索 (embedding 路径)', () => {
  it('同义词召回: 提问"休假" 命中标题为"年假"的笔记 (Jaccard 做不到)', async () => {
    await createNote({ ownerId: OWNER, tenantId: TENANT, title: '年假怎么休', content: '年假相关说明' });
    await createNote({ ownerId: OWNER, tenantId: TENANT, title: '报销流程', content: '发票相关' });

    const hits = await searchNotesForAsk(OWNER, '休假');
    expect(hits.length).toBeGreaterThan(0);
    // 语义最相关的应是"年假"那条, 而非"报销"
    expect(hits[0].note.title).toBe('年假怎么休');
    // 且分数来自向量相似度 (高), 不是 0 回落
    expect(hits[0].score).toBeGreaterThan(0.5);
  });

  it('语义不相关的笔记被过滤 (低于阈值)', async () => {
    await createNote({ ownerId: OWNER, tenantId: TENANT, title: '报销流程', content: '发票' });
    const hits = await searchNotesForAsk(OWNER, '休假');
    // "报销"与"休假"正交, 不应作为高分命中; 命中则分数应极低或被过滤
    const reim = hits.find((h) => h.note.title === '报销流程');
    if (reim) expect(reim.score).toBeLessThan(0.3);
  });
});
