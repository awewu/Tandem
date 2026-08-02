/**
 * tests/unit/shouchao-agentic-search.test.ts · 手抄 Ask 接入 Agentic RAG (Phase2)
 *
 * 验证: searchNotesForAsk 对复杂问题会经查询分解 + RRF 融合召回更多相关笔记;
 *       简单问题保持单次检索, 无 LLM 也能跑。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setStore, getStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { createNote, searchNotesForAsk } from '@/lib/shouchao/service';

const GLOBAL_ROUTER_KEY = '__tandem_router__';
let prevRouter: unknown;

beforeEach(() => {
  setStore(createInMemoryStore());
  prevRouter = (globalThis as Record<string, unknown>)[GLOBAL_ROUTER_KEY];
});

afterEach(() => {
  (globalThis as Record<string, unknown>)[GLOBAL_ROUTER_KEY] = prevRouter;
});

describe('shouchao searchNotesForAsk · agentic retrieval', () => {
  it('简单查询走单次检索, 无 router 也成功', async () => {
    await createNote({ ownerId: 'u1', tenantId: 'default', title: 'A', content: '年假政策 15 天' });
    await createNote({ ownerId: 'u1', tenantId: 'default', title: 'B', content: '报销流程' });

    const hits = await searchNotesForAsk('u1', '年假');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].note.title).toBe('A');
  });

  it('复杂查询经分解 + RRF 提升多主题召回', async () => {
    await createNote({ ownerId: 'u1', tenantId: 'default', title: 'A', content: '北京办公室租金预算' });
    await createNote({ ownerId: 'u1', tenantId: 'default', title: 'B', content: '上海办公室人员编制' });

    (globalThis as Record<string, unknown>)[GLOBAL_ROUTER_KEY] = {
      chat: async () => ({
        message: { role: 'assistant' as const, content: '{"subQueries":["北京 租金","上海 编制"]}' },
        usage: { totalTokens: 10 },
      }),
    };

    const hits = await searchNotesForAsk('u1', '北京和上海的办公室预算与编制对比', { topK: 4, actorUserId: 'u1' });
    const titles = hits.map((h) => h.note.title);
    expect(titles).toContain('A');
    expect(titles).toContain('B');
  });
});
