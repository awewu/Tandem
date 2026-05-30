/**
 * Memory · Async Writer + Reranker 单测
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MemoryEntry } from '@/lib/types/memory';

// ───────────────────────────────────────────────────
// Reranker (deterministic, no LLM)
// ───────────────────────────────────────────────────
import {
  rerank,
  tokenize,
  bm25Lite,
  extractEntityIds,
  entityScore,
  recencyScore,
  popularityScore,
  priorityScore,
} from '@/lib/memory/reranker';

function mem(over: Partial<MemoryEntry>): MemoryEntry {
  return {
    id: over.id ?? Math.random().toString(36).slice(2, 7),
    type: 'sop',
    title: over.title ?? 'untitled',
    body: over.body ?? '',
    status: 'active',
    signers: [],
    ownershipLevel: 'company',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
    referenceCount: 0,
    ...over,
  };
}

describe('reranker · helpers', () => {
  it('tokenize 中英混合', () => {
    const t = tokenize('Tandem 的 OKR 系统怎么用 the test');
    // '的' 是 stopword 应被过滤
    expect(t).not.toContain('的');
    expect(t).toContain('tandem');
    expect(t).toContain('okr');
    expect(t).toContain('系');
    expect(t).toContain('统');
    expect(t).not.toContain('the'); // stopword
  });

  it('bm25Lite 完全无重叠 → 0', () => {
    expect(bm25Lite(['a', 'b'], ['x', 'y'])).toBe(0);
  });

  it('bm25Lite 全重叠 → 接近 1', () => {
    const s = bm25Lite(['okr', '推进'], ['okr', '推进', '客户']);
    expect(s).toBeGreaterThan(0.7);
  });

  it('extractEntityIds 抓 KR/OBJ/CONV 模式', () => {
    const e = extractEntityIds('请看 KR-1, OBJ-2, conv-abc-123');
    expect(e).toContain('kr-1');
    expect(e).toContain('obj-2');
    expect(e).toContain('conv-abc-123');
  });

  it('entityScore 全命中 → 1', () => {
    const score = entityScore(['kr-1'], mem({ body: '这是 KR-1 的进度更新' }));
    expect(score).toBe(1);
  });

  it('recencyScore 越新越高', () => {
    const now = Date.parse('2026-06-01T00:00:00Z');
    const fresh = recencyScore('2026-06-01T00:00:00Z', now);
    const stale = recencyScore('2025-06-01T00:00:00Z', now);
    expect(fresh).toBeGreaterThan(stale);
    expect(fresh).toBeCloseTo(1, 1);
    expect(stale).toBeCloseTo(0, 1);
  });

  it('popularityScore: refCount=0 → 0; max → 1', () => {
    expect(popularityScore(0, 10)).toBe(0);
    expect(popularityScore(10, 10)).toBe(1);
    expect(popularityScore(5, 10)).toBeGreaterThan(0);
    expect(popularityScore(5, 10)).toBeLessThan(1);
  });

  it('priorityScore 排序 critical > high > medium > low > undefined', () => {
    expect(priorityScore('critical')).toBeGreaterThan(priorityScore('high'));
    expect(priorityScore('high')).toBeGreaterThan(priorityScore('medium'));
    expect(priorityScore('medium')).toBeGreaterThan(priorityScore('low'));
    expect(priorityScore()).toBeGreaterThan(priorityScore('low'));
  });
});

describe('reranker · rerank', () => {
  it('完全无关 query → 排序仍稳定 (按 recency/priority)', () => {
    const memories = [
      mem({ id: 'a', title: '老', updatedAt: '2025-01-01T00:00:00Z' }),
      mem({ id: 'b', title: '新', updatedAt: '2026-05-01T00:00:00Z' }),
    ];
    const r = rerank('unrelated', memories.map((m) => ({ memory: m })), { now: Date.parse('2026-05-29T00:00:00Z') });
    // 新的应排前 (recency 权重)
    expect(r[0].memory.id).toBe('b');
  });

  it('query 含关键词 + entity → 命中文档排前', () => {
    const memories = [
      mem({ id: 'noise', title: '客户漏斗 SOP', body: '一般流程' }),
      mem({ id: 'target', title: 'KR-1 推进 SOP', body: '北区 KR-1 客户增长 30%' }),
    ];
    const r = rerank('KR-1 怎么推进', memories.map((m) => ({ memory: m })));
    expect(r[0].memory.id).toBe('target');
    expect(r[0].breakdown.entity).toBeGreaterThan(0);
  });

  it('topK 限制返回数', () => {
    const memories = Array.from({ length: 10 }, (_, i) => mem({ id: `m${i}` }));
    const r = rerank('q', memories.map((m) => ({ memory: m })), { topK: 3 });
    expect(r).toHaveLength(3);
  });

  it('initialScore 透传到 breakdown.initial 但不参与融合', () => {
    const r = rerank(
      'q',
      [{ memory: mem({ id: 'a' }), initialScore: 0.95 }],
    );
    expect(r[0].breakdown.initial).toBe(0.95);
  });

  it('多信号融合: 高 popularity + 新 + 关键词 = 综合最高', () => {
    const now = Date.parse('2026-05-29T00:00:00Z');
    const memories = [
      mem({ id: 'old-popular', title: 'OKR SOP', body: '老 SOP', referenceCount: 100, updatedAt: '2024-01-01T00:00:00Z' }),
      mem({ id: 'new-relevant', title: 'OKR 推进 SOP', body: 'OKR KR 推进流程', referenceCount: 10, updatedAt: '2026-05-20T00:00:00Z' }),
      mem({ id: 'irrelevant', title: '客户接待', body: '坐姿规范', referenceCount: 1, updatedAt: '2026-05-25T00:00:00Z' }),
    ];
    const r = rerank('OKR 怎么推进', memories.map((m) => ({ memory: m })), { now });
    expect(r[0].memory.id).toBe('new-relevant');
    expect(r[r.length - 1].memory.id).toBe('irrelevant');
  });
});

// ───────────────────────────────────────────────────
// Async Writer
// ───────────────────────────────────────────────────
import { enqueueMemoryWrite, drainMemoryWriter, memoryWriter, memoryWriterMetrics } from '@/lib/memory/async-writer';

describe('async-writer', () => {
  beforeEach(() => {
    memoryWriter().__testReset();
  });

  it('enqueue 立刻返回, 后台 flush 调 sink', async () => {
    const sink = vi.fn(async (_e: MemoryEntry) => { void _e; });
    memoryWriter().__testInject({ sink, mode: 'sync' });

    await enqueueMemoryWrite(mem({ id: 'e1' }));
    expect(sink).toHaveBeenCalledOnce();
    expect(sink.mock.calls[0][0].id).toBe('e1');
    expect(memoryWriterMetrics().flushed).toBe(1);
  });

  it('sink 异常时进重试队列, 计 failed', async () => {
    let calls = 0;
    const sink = vi.fn(async () => {
      calls++;
      if (calls === 1) throw new Error('boom');
    });
    memoryWriter().__testInject({ sink, mode: 'sync' });

    await enqueueMemoryWrite(mem({ id: 'e2' }));
    expect(memoryWriterMetrics().failed).toBe(1);
    // 退避后 drain 应成功
    await new Promise((r) => setTimeout(r, 50));
    // 强制 drain (虽然 nextAttemptAt 是 2s 后, 但 drainNow 会循环等)
    // 这里我们提前重置 nextAttemptAt 加速测试
    const w = memoryWriter() as unknown as { queue: Array<{ nextAttemptAt: number }> };
    if (w.queue.length > 0) w.queue[0].nextAttemptAt = 0;
    await drainMemoryWriter(2);
    expect(memoryWriterMetrics().flushed).toBe(1);
  });

  it('3 次失败后落 dead-letter', async () => {
    const sink = vi.fn(async () => { throw new Error('always'); });
    memoryWriter().__testInject({ sink, mode: 'sync' });

    await enqueueMemoryWrite(mem({ id: 'e3' }));
    // drain 多次 + 强制 nextAttemptAt 加速
    const w = memoryWriter() as unknown as { queue: Array<{ nextAttemptAt: number }> };
    for (let i = 0; i < 5; i++) {
      if (w.queue.length > 0) w.queue[0].nextAttemptAt = 0;
      await drainMemoryWriter(1);
    }
    const m = memoryWriterMetrics();
    expect(m.deadLetter).toBe(1);
    expect(m.queueLength).toBe(0); // 不再重试
  });

  it('queueMetrics 反映状态', async () => {
    const sink = vi.fn(async () => {});
    memoryWriter().__testInject({ sink, mode: 'sync' });

    await enqueueMemoryWrite(mem({ id: 'a' }));
    await enqueueMemoryWrite(mem({ id: 'b' }));
    await enqueueMemoryWrite(mem({ id: 'c' }));
    expect(memoryWriterMetrics().enqueued).toBe(3);
    expect(memoryWriterMetrics().flushed).toBe(3);
  });
});
