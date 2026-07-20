/**
 * tests/unit/eval-graders.test.ts · Eval graders (P0 · 2026-07-20)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EvalTrace, EvalTraceKind } from '@/lib/types/eval';
import {
  runRuleGraders,
  toolGroundedGrader,
  noForbiddenToolGrader,
  convergedGrader,
  zoneCompliantGrader,
} from '@/lib/eval/graders';

function trace(kind: EvalTraceKind, over: Partial<EvalTrace> = {}): EvalTrace {
  return {
    id: 't1',
    traceId: 'tr1',
    tenantId: 'default',
    kind,
    actorUserId: 'u1',
    isProxy: false,
    inputSummary: 'q',
    toolInvocations: [],
    finalOutputSummary: 'a',
    roundsExecuted: 1,
    finishedNaturally: true,
    tokensUsed: 100,
    latencyMs: 10,
    createdAt: new Date().toISOString(),
    ...over,
  };
}

describe('rule graders', () => {
  it('tool-grounded: 0 ok 工具 → fail; ≥1 ok → pass', () => {
    expect(toolGroundedGrader.grade(trace('perception', { toolInvocations: [] }))).toMatchObject({ pass: false });
    expect(
      toolGroundedGrader.grade(trace('perception', { toolInvocations: [{ name: 'okr.read', ok: true }] })),
    ).toMatchObject({ pass: true, score: 1 });
  });

  it('no-forbidden-tool: 命中 tool_not_allowed → fail', () => {
    const t = trace('reasoning', {
      toolInvocations: [{ name: 'evil.tool', ok: false, error: 'tool_not_allowed' }],
    });
    expect(noForbiddenToolGrader.grade(t)).toMatchObject({ pass: false });
    const clean = trace('reasoning', { toolInvocations: [{ name: 'okr.read', ok: true }] });
    expect(noForbiddenToolGrader.grade(clean)).toMatchObject({ pass: true });
  });

  it('converged: finishedNaturally=false → fail', () => {
    expect(convergedGrader.grade(trace('perception', { finishedNaturally: false }))).toMatchObject({ pass: false });
    expect(convergedGrader.grade(trace('perception', { finishedNaturally: true }))).toMatchObject({ pass: true });
  });

  it('zone-compliant: act 有 red-zone 拒绝 → fail', () => {
    expect(zoneCompliantGrader.grade(trace('act', { meta: { rejectedRed: 2 } }))).toMatchObject({ pass: false });
    expect(zoneCompliantGrader.grade(trace('act', { meta: { rejectedRed: 0 } }))).toMatchObject({ pass: true });
  });

  it('runRuleGraders: 只跑适用 kind 的 grader', () => {
    const grades = runRuleGraders(trace('perception', { toolInvocations: [{ name: 'okr.read', ok: true }] }));
    const ids = grades.map((g) => g.graderId);
    expect(ids).toContain('tool-grounded');
    expect(ids).toContain('no-forbidden-tool');
    expect(ids).toContain('converged');
    // zone-compliant 只对 act
    expect(ids).not.toContain('zone-compliant');
  });
});

describe('LLM grader (fail-soft)', () => {
  beforeEach(() => vi.resetModules());

  it('router 抛错 → 返回 insufficient (pass=true, score=0.5), 不抛', async () => {
    vi.doMock('@/lib/boot', () => ({
      getRouter: () => ({ chat: async () => { throw new Error('no api key'); } }),
    }));
    const { answerQualityGrader } = await import('@/lib/eval/graders');
    const t = trace('decision', { finalOutputSummary: '本季度 OKR 进度 60%' });
    const g = await answerQualityGrader.grade(t);
    expect(g.graderId).toBe('answer-quality');
    expect(g.pass).toBe(true);
    expect(g.score).toBe(0.5);
    expect(g.notes).toContain('unavailable');
  });

  it('router 返回合法 JSON → 采用其分数', async () => {
    vi.doMock('@/lib/boot', () => ({
      getRouter: () => ({
        chat: async () => ({
          message: { role: 'assistant', content: '{"score":0.9,"pass":true,"notes":"基于真值"}' },
        }),
      }),
    }));
    const { answerQualityGrader } = await import('@/lib/eval/graders');
    const g = await answerQualityGrader.grade(trace('decision', { finalOutputSummary: 'x' }));
    expect(g.score).toBeCloseTo(0.9, 5);
    expect(g.pass).toBe(true);
  });
});
