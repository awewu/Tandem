/**
 * §P1a Eval Harness Skeleton — Memory Rerank Benchmark (offline, no LLM)
 *
 * 目的: 锁住 lib/memory/reranker.ts::rerank 在常见 query 下的"排序对不对".
 *
 * 跑法: `npx vitest run tests/eval/memory-rerank.eval.test.ts`
 *
 * 通过门槛:
 *   - pass rate ≥ 90% (允许 1 条勉强排序)
 *   - avg score ≥ 0.85
 */
import { describe, it, expect } from 'vitest';
import {
  runSuite,
  containsJudge,
  type EvalCase,
  type EvalSuite,
} from '@/lib/evals';
import { rerank } from '@/lib/memory/reranker';
import type { MemoryEntry } from '@/lib/types/memory';

// ──────────────────────────────────────────────────────────────────
// Fixture: 一组拟真 memory, 覆盖 OKR / 1on1 / 议事 / 决议 / 通用 SOP
// ──────────────────────────────────────────────────────────────────

const NOW = Date.parse('2026-05-31T00:00:00Z');
const D = (daysAgo: number) =>
  new Date(NOW - daysAgo * 86_400_000).toISOString();

function mem(p: Partial<MemoryEntry> & Pick<MemoryEntry, 'id' | 'title' | 'body'>): MemoryEntry {
  return {
    type: 'standard',
    status: 'signed',
    signers: [],
    ownershipLevel: 'company',
    referenceCount: 0,
    createdAt: D(30),
    updatedAt: D(30),
    ...p,
  } as MemoryEntry;
}

const POOL: MemoryEntry[] = [
  mem({
    id: 'm-okr-q2',
    title: 'Q2 OKR · KR-2 提升新签 30%',
    body: '关键结果 KR-2: 新签客户数从 100 提升到 130. 负责人 张伟. 状态进行中.',
    referenceCount: 12,
    updatedAt: D(2),
    priority: 'high',
  }),
  mem({
    id: 'm-1on1-may',
    title: '5 月 1on1 张伟 ↔ 王主管',
    body: '议题: 销售漏斗瓶颈. 行动项: 周三前出新流程.',
    referenceCount: 3,
    updatedAt: D(7),
    priority: 'medium',
  }),
  mem({
    id: 'm-conv-pricing',
    title: '议事 conv-pricing-2026 定价调整',
    body: '决议: SKU A 涨价 5%, SKU B 不动. KR-2 关联.',
    referenceCount: 8,
    updatedAt: D(5),
    priority: 'high',
  }),
  mem({
    id: 'm-sop-onboarding',
    title: '员工 onboarding SOP',
    body: '新人入职第 1 周必看. 跟当前 OKR 无直接关联.',
    referenceCount: 25,
    updatedAt: D(120),
    priority: 'low',
  }),
  mem({
    id: 'm-decision-archive',
    title: '历史决议: 2025 年市场预算',
    body: '2025 Q3 增加市场预算 200w. 已归档.',
    referenceCount: 1,
    updatedAt: D(280),
    priority: 'low',
  }),
  mem({
    id: 'm-noise-cafeteria',
    title: '食堂周菜单',
    body: '周一: 番茄牛腩. 周二: 鱼香肉丝. (无关业务)',
    referenceCount: 0,
    updatedAt: D(1),
    priority: 'low',
  }),
];

// ──────────────────────────────────────────────────────────────────
// Suite: rerank 输出的 top-1 id 必须命中 expected.contains[0]
// ──────────────────────────────────────────────────────────────────

interface RerankInput {
  query: string;
}

/**
 * 评分语义: actualOutput = `top1=<id> | top3=<a>,<b>,<c>`.
 *   contains 用 `top1=m-X` 锁 top-1; avoids 用 `top1=m-Y` 排除某条进 top-1.
 *   不假设 popularity 高 / SOP 不能进 top-3 — 只要 top-1 对就算赢.
 */
const cases: EvalCase<RerankInput>[] = [
  {
    id: 'memory-rerank.case-1-kr-direct',
    description: '直接问 KR-2, top-1 应该命中 OKR/议事中提到 KR-2 的条目 (m-okr-q2 或 m-conv-pricing)',
    input: { query: 'KR-2 进展如何' },
    expected: { contains: ['top1=m-okr-q2'], avoids: ['top1=m-noise-cafeteria'] },
  },
  {
    id: 'memory-rerank.case-2-1on1',
    description: '问 1on1 销售瓶颈, top-1 应该是 m-1on1-may',
    input: { query: '上次 1on1 张伟说了销售漏斗瓶颈' },
    expected: { contains: ['top1=m-1on1-may'], avoids: ['top1=m-noise-cafeteria'] },
  },
  {
    id: 'memory-rerank.case-3-pricing',
    description: '问议事室定价决议, top-1 应该是 m-conv-pricing',
    input: { query: '上次议事 conv-pricing-2026 定的什么' },
    expected: { contains: ['top1=m-conv-pricing'], avoids: ['top1=m-decision-archive'] },
  },
  {
    id: 'memory-rerank.case-4-sop-far',
    description: '问 onboarding SOP, top-1 应该是 m-sop-onboarding (老 + 高引用)',
    input: { query: '新人入职 onboarding 流程' },
    expected: { contains: ['top1=m-sop-onboarding'] },
  },
  {
    id: 'memory-rerank.case-5-historical',
    description: '问 2025 市场预算, top-1 应该是 m-decision-archive',
    input: { query: '2025 年市场预算决议' },
    expected: { contains: ['top1=m-decision-archive'] },
  },
  {
    id: 'memory-rerank.case-6-noise-rejection',
    description: '问 OKR 完成进度, top-1 必须是 m-okr-q2; 食堂菜单条目不能挤进 top-1',
    input: { query: 'OKR 完成进度更新 KR-2' },
    expected: { contains: ['top1=m-okr-q2'], avoids: ['top1=m-noise-cafeteria'] },
  },
];

const suite: EvalSuite<RerankInput> = {
  name: 'memory-rerank',
  description: 'Memory reranker offline benchmark (no LLM, deterministic).',
  cases,
  run: async (c) => {
    const res = rerank(
      c.input.query,
      POOL.map((memory) => ({ memory })),
      { topK: 3, now: NOW },
    );
    const ids = res.map((r) => r.memory.id);
    return `top1=${ids[0] ?? ''} | top3=${ids.join(',')}`;
  },
  judges: [containsJudge],
  meta: { runner: 'memory-rerank-v1', judge: 'containsJudge' },
};

// ──────────────────────────────────────────────────────────────────

describe('§eval · memory rerank benchmark', () => {
  it('top-3 should put the right memory first on common queries', async () => {
    const report = await runSuite(suite, { concurrency: 6 });

    // 调试输出
    if (report.failures.length > 0) {
      // eslint-disable-next-line no-console
      console.log('[memory-rerank] failures:', report.failures);
    }

    expect(report.total).toBe(cases.length);
    expect(report.passed / report.total).toBeGreaterThanOrEqual(0.9);
    expect(report.avgScore).toBeGreaterThanOrEqual(0.85);
  });
});
