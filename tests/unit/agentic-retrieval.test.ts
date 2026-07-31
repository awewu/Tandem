/**
 * tests/unit/agentic-retrieval.test.ts · Agentic RAG (P1) 真闭环 (2026-07-29)
 *
 * 固化确定性部分 (不打真实 LLM / embedding):
 *   ① reciprocalRankFusion: 多路命中叠加 + 去重 + limit
 *   ② parseSubQueries / shouldDecompose: 解析与门槛
 *   ③ decomposeQuery: 假 router 驱动分解; 出错 fail-soft → []
 *   ④ agenticSearch: 多子查询并行 + RRF 融合去重; 单查询保持原序 (向后兼容)
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  reciprocalRankFusion,
  parseSubQueries,
  shouldDecompose,
  decomposeQuery,
  agenticSearch,
  type RetrievalHit,
} from '@/lib/memory/agentic-retrieval';

const GLOBAL_ROUTER_KEY = '__tandem_router__';
afterEach(() => {
  delete (globalThis as Record<string, unknown>)[GLOBAL_ROUTER_KEY];
});

function hit(id: string, sim: number, source: 'memory' | 'material' = 'memory'): RetrievalHit {
  return { id, title: `t-${id}`, body: `b-${id}`, similarity: sim, source } as RetrievalHit;
}

describe('reciprocalRankFusion', () => {
  it('多路共同命中的 doc 排名更高, 去重', () => {
    const list1 = [hit('A', 0.9), hit('B', 0.5)];
    const list2 = [hit('B', 0.8), hit('C', 0.4)];
    const fused = reciprocalRankFusion([list1, list2]);
    // B 命中两路 (rank2+rank1) > A (rank1 单路) > C (rank2 单路)
    expect(fused.map((h) => h.id)).toEqual(['B', 'A', 'C']);
    // 去重: B 只出现一次, 且保留相似度更高的那份 (0.8)
    expect(fused.filter((h) => h.id === 'B')).toHaveLength(1);
    expect(fused.find((h) => h.id === 'B')!.similarity).toBe(0.8);
  });

  it('limit 截断', () => {
    const fused = reciprocalRankFusion([[hit('A', 0.9), hit('B', 0.5), hit('C', 0.3)]], { limit: 2 });
    expect(fused).toHaveLength(2);
  });
});

describe('parseSubQueries', () => {
  it('解析 JSON + 去 code fence + 去重 + 截断 4', () => {
    const raw = '```json\n{"subQueries":["a","a","b","c","d","e"]}\n```';
    expect(parseSubQueries(raw)).toEqual(['a', 'b', 'c', 'd']);
  });
  it('非法输入 → []', () => {
    expect(parseSubQueries('not json')).toEqual([]);
    expect(parseSubQueries('{"x":1}')).toEqual([]);
  });
});

describe('shouldDecompose', () => {
  it('对比/多意图问题触发', () => {
    expect(shouldDecompose('对比 A 方案和 B 方案的风险与成本')).toBe(true);
  });
  it('简短单意图不触发', () => {
    expect(shouldDecompose('查 SOP')).toBe(false);
  });
});

describe('decomposeQuery', () => {
  it('假 router 驱动分解', async () => {
    (globalThis as Record<string, unknown>)[GLOBAL_ROUTER_KEY] = {
      chat: async () => ({
        message: { role: 'assistant', content: '{"subQueries":["A 方案风险","B 方案成本"]}' },
        usage: { totalTokens: 10 },
      }),
    };
    const subs = await decomposeQuery('对比 A 方案和 B 方案的风险与成本');
    expect(subs).toEqual(['A 方案风险', 'B 方案成本']);
  });

  it('router 抛错 → fail-soft []', async () => {
    (globalThis as Record<string, unknown>)[GLOBAL_ROUTER_KEY] = {
      chat: async () => { throw new Error('boom'); },
    };
    expect(await decomposeQuery('对比 A 和 B 的风险与成本', { force: true })).toEqual([]);
  });

  it('简单问题不触发 LLM → []', async () => {
    expect(await decomposeQuery('SOP')).toEqual([]);
  });
});

describe('agenticSearch', () => {
  const fakeRetriever = {
    async search(q: string): Promise<RetrievalHit[]> {
      if (q === 'main') return [hit('A', 0.9), hit('B', 0.5)];
      if (q === 'sub') return [hit('B', 0.8), hit('C', 0.4)];
      return [];
    },
  };

  it('多子查询并行 + RRF 融合去重', async () => {
    const res = await agenticSearch(fakeRetriever, 'main', { subQueries: ['sub'], limit: 5 });
    expect(res.map((h) => h.id)).toEqual(['B', 'A', 'C']);
  });

  it('单查询 (decompose=false) 保持原序, 向后兼容', async () => {
    const single = {
      async search(): Promise<RetrievalHit[]> {
        return [hit('X', 0.3), hit('Y', 0.9)];
      },
    };
    const res = await agenticSearch(single, 'q', { decompose: false, limit: 5 });
    expect(res.map((h) => h.id)).toEqual(['X', 'Y']);
  });

  it('单路 search 抛错不影响其它路 (fail-soft)', async () => {
    const flaky = {
      async search(q: string): Promise<RetrievalHit[]> {
        if (q === 'bad') throw new Error('down');
        return [hit('Z', 0.7)];
      },
    };
    const res = await agenticSearch(flaky, 'ok', { subQueries: ['bad'], limit: 5 });
    expect(res.map((h) => h.id)).toEqual(['Z']);
  });
});
