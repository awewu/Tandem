/**
 * tests/unit/eval-service.test.ts · Eval service trace 采集 + 回归 (P0 · 2026-07-20)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { setStore, getStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { recordEvalTrace, listTraces, runRegression } from '@/lib/eval/service';
import type { RecordTraceInput } from '@/lib/eval/service';

beforeEach(() => setStore(createInMemoryStore()));

function input(over: Partial<RecordTraceInput> = {}): RecordTraceInput {
  return {
    traceId: 'tr1',
    tenantId: 'default',
    kind: 'perception',
    actorUserId: '__company__',
    isProxy: false,
    inputSummary: '本季度 OKR 进度?',
    toolInvocations: [{ name: 'okr.read', ok: true }],
    finalOutputSummary: '公司层 OKR 平均进度 62%',
    roundsExecuted: 2,
    finishedNaturally: true,
    tokensUsed: 500,
    latencyMs: 1200,
    ...over,
  };
}

describe('recordEvalTrace', () => {
  it('落库 + 同步回填规则分', async () => {
    const t = await recordEvalTrace(input());
    expect(t).not.toBeNull();
    expect(t!.id).toMatch(/^evt_/);
    expect((t!.grades ?? []).length).toBeGreaterThanOrEqual(3);
    const stored = await getStore().evalTraces.get(t!.id);
    expect(stored).not.toBeNull();
    expect(stored!.grades!.find((g) => g.graderId === 'tool-grounded')?.pass).toBe(true);
  });

  it('截断超长 input/output', async () => {
    const t = await recordEvalTrace(input({ inputSummary: 'x'.repeat(900), finalOutputSummary: 'y'.repeat(2000) }));
    expect(t!.inputSummary.length).toBeLessThanOrEqual(501);
    expect(t!.finalOutputSummary.length).toBeLessThanOrEqual(1001);
  });

  it('fail-soft: store 异常不冒泡', async () => {
    setStore({
      ...getStore(),
      evalTraces: {
        ...getStore().evalTraces,
        create: async () => { throw new Error('db down'); },
      },
    } as never);
    const t = await recordEvalTrace(input());
    expect(t).toBeNull();
  });
});

describe('listTraces + runRegression', () => {
  it('按 kind 过滤 + 倒序', async () => {
    await recordEvalTrace(input({ kind: 'perception' }));
    await recordEvalTrace(input({ kind: 'act', toolInvocations: [], finalOutputSummary: '' }));
    const perc = await listTraces({ kind: 'perception' });
    expect(perc.every((t) => t.kind === 'perception')).toBe(true);
    expect(perc.length).toBe(1);
  });

  it('回归聚合逐 grader 通过率', async () => {
    await recordEvalTrace(input()); // tool-grounded pass
    await recordEvalTrace(input({ toolInvocations: [] })); // tool-grounded fail
    const r = await runRegression({ kind: 'perception' });
    expect(r.tracesEvaluated).toBe(2);
    expect(r.byGrader['tool-grounded'].total).toBe(2);
    expect(r.byGrader['tool-grounded'].pass).toBe(1);
    expect(r.byGrader['tool-grounded'].passRate).toBeCloseTo(0.5, 5);
    expect(r.overallPassRate).toBeGreaterThan(0);
    expect(r.overallPassRate).toBeLessThanOrEqual(1);
  });
});
