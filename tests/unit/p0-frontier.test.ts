/**
 * P0 前沿升级单测 · 纯函数部分 (Pass^k / 失败归因判定 / SRPO 关键词与拼装)
 */
import { describe, it, expect } from 'vitest';
import { computePassK, tracePassed, normalizeInput } from '@/lib/eval/pass-k';
import { isFailedTrace } from '@/lib/eval/failure-attribution';
import { extractKeywords, buildCorrectionPromptBlock } from '@/lib/persona/srpo-patch';
import type { EvalTrace } from '@/lib/types/eval';
import type { CorrectionPatch } from '@/lib/persona/srpo-patch';

function mkTrace(partial: Partial<EvalTrace>): EvalTrace {
  return {
    id: partial.id ?? `evt_${Math.random().toString(36).slice(2)}`,
    traceId: 'tr',
    tenantId: 'default',
    kind: 'perception',
    actorUserId: 'u1',
    isProxy: false,
    inputSummary: 'OKR 进度如何',
    toolInvocations: [],
    finalOutputSummary: 'ok',
    roundsExecuted: 1,
    finishedNaturally: true,
    tokensUsed: 100,
    latencyMs: 100,
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

describe('P0-2 Pass^k 多试一致性', () => {
  it('tracePassed: 全 grade pass → true; 有 fail 或无 grade → false', () => {
    expect(tracePassed({ grades: [{ graderId: 'a', score: 1, pass: true, rubric: '', gradedAt: '' }] })).toBe(true);
    expect(tracePassed({ grades: [{ graderId: 'a', score: 0, pass: false, rubric: '', gradedAt: '' }] })).toBe(false);
    expect(tracePassed({ grades: [] })).toBe(false);
    expect(tracePassed({})).toBe(false);
  });

  it('normalizeInput: 大小写/空白/标点归一', () => {
    expect(normalizeInput('  OKR 进度，如何？ ')).toBe('okr 进度如何');
  });

  it('k=3: 同一输入 3 条全过 → passAtK=1', () => {
    const g = [{ graderId: 'a', score: 1, pass: true, rubric: '', gradedAt: '' }];
    const traces = [
      mkTrace({ inputSummary: 'OKR 进度如何', grades: g, createdAt: '2026-01-03' }),
      mkTrace({ inputSummary: 'OKR 进度如何', grades: g, createdAt: '2026-01-02' }),
      mkTrace({ inputSummary: 'OKR 进度如何', grades: g, createdAt: '2026-01-01' }),
    ];
    const r = computePassK(traces, 3);
    expect(r.eligibleGroups).toBe(1);
    expect(r.consistentGroups).toBe(1);
    expect(r.passAtK).toBe(1);
    expect(r.singlePassRate).toBe(1);
  });

  it('k=3: 3 条里 1 条 fail → passAtK=0 但 singlePassRate=2/3', () => {
    const pass = [{ graderId: 'a', score: 1, pass: true, rubric: '', gradedAt: '' }];
    const fail = [{ graderId: 'a', score: 0, pass: false, rubric: '', gradedAt: '' }];
    const traces = [
      mkTrace({ inputSummary: 'q', grades: pass, createdAt: '2026-01-03' }),
      mkTrace({ inputSummary: 'q', grades: pass, createdAt: '2026-01-02' }),
      mkTrace({ inputSummary: 'q', grades: fail, createdAt: '2026-01-01' }),
    ];
    const r = computePassK(traces, 3);
    expect(r.eligibleGroups).toBe(1);
    expect(r.consistentGroups).toBe(0);
    expect(r.passAtK).toBe(0);
    expect(r.singlePassRate).toBeCloseTo(2 / 3, 5);
  });

  it('样本不足 k 条 → 不计入', () => {
    const g = [{ graderId: 'a', score: 1, pass: true, rubric: '', gradedAt: '' }];
    const traces = [mkTrace({ inputSummary: 'q', grades: g }), mkTrace({ inputSummary: 'q', grades: g })];
    const r = computePassK(traces, 3);
    expect(r.eligibleGroups).toBe(0);
    expect(r.passAtK).toBeNull();
  });
});

describe('P0-3 失败归因判定 (isFailedTrace)', () => {
  it('自然收敛 + 全 ok + 全 pass → 非失败', () => {
    expect(isFailedTrace(mkTrace({ grades: [{ graderId: 'a', score: 1, pass: true, rubric: '', gradedAt: '' }] }))).toBe(false);
  });
  it('未自然收敛 → 失败', () => {
    expect(isFailedTrace(mkTrace({ finishedNaturally: false }))).toBe(true);
  });
  it('有工具报错 → 失败', () => {
    expect(isFailedTrace(mkTrace({ toolInvocations: [{ name: 'x', ok: false, error: 'boom' }] }))).toBe(true);
  });
  it('有 grader fail → 失败', () => {
    expect(isFailedTrace(mkTrace({ grades: [{ graderId: 'a', score: 0, pass: false, rubric: '', gradedAt: '' }] }))).toBe(true);
  });
});

describe('P0-5 SRPO 关键词与提示拼装', () => {
  it('extractKeywords: 提取中英关键词, 去重', () => {
    const kw = extractKeywords('更新 OKR 进度 update okr progress OKR');
    expect(kw).toContain('okr');
    expect(kw.filter((k) => k === 'okr').length).toBe(1);
    expect(kw.length).toBeLessThanOrEqual(8);
  });

  it('buildCorrectionPromptBlock: 无补丁 → 空串', () => {
    expect(buildCorrectionPromptBlock([])).toBe('');
  });

  it('buildCorrectionPromptBlock: 有补丁 → 含情形与修正', () => {
    const patches: CorrectionPatch[] = [
      {
        id: 'srpo_1',
        tenantId: 'default',
        context: 'im_reply',
        keywords: ['okr'],
        situation: '误报进度',
        strategy: '先核对真值再回复',
        sourceEpisodicId: 'epi_1',
        hitCount: 0,
        createdAt: new Date().toISOString(),
      },
    ];
    const block = buildCorrectionPromptBlock(patches);
    expect(block).toContain('历史修正经验');
    expect(block).toContain('误报进度');
    expect(block).toContain('先核对真值再回复');
  });
});
