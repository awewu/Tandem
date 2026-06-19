/**
 * Specialist subagents 单测
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock multi-step so spawnSubagent -> spawnSpecialist never hits LLM/DB
const { runMultiStepMock } = vi.hoisted(() => ({ runMultiStepMock: vi.fn() }));
vi.mock('@/lib/agent-runtime/multi-step', () => ({ runMultiStep: runMultiStepMock }));

import {
  listSpecialists,
  getSpecialist,
  matchSpecialist,
  SPECIALISTS,
} from '@/lib/agent-runtime/agent-definitions';
import { spawnSpecialist } from '@/lib/agent-runtime/subagent';

const OK_RESULT = {
  finalAnswer: '• 结论摘要',
  stepsExecuted: 2,
  finishedNaturally: true,
  trace: [],
  totalTokensUsed: 320,
  totalLatencyMs: 800,
};

describe('agent-definitions', () => {
  it('每个专家 toolset 非空且 id 格式合法', () => {
    for (const def of listSpecialists()) {
      expect(def.toolset.length).toBeGreaterThan(0);
      for (const id of def.toolset) {
        expect(id).toMatch(/^[a-z_]+\.[a-z_]+$/);
      }
    }
  });

  it('id 与 map key 一致, name 无重复', () => {
    const names = new Set<string>();
    for (const [key, def] of Object.entries(SPECIALISTS)) {
      expect(def.id).toBe(key);
      expect(names.has(def.name)).toBe(false);
      names.add(def.name);
    }
  });

  it('getSpecialist 命中/未命中', () => {
    expect(getSpecialist('okr-analyst')?.name).toBe('OKR 对齐分析师');
    expect(getSpecialist('nope')).toBeUndefined();
  });

  it('matchSpecialist 关键词匹配', () => {
    expect(matchSpecialist('OKR 对齐有没有偏移')?.id).toBe('okr-analyst');
    expect(matchSpecialist('绩效红色清单')?.id).toBe('performance-reviewer');
    expect(matchSpecialist('随便聊聊天气')).toBeNull();
  });
});

describe('spawnSpecialist', () => {
  beforeEach(() => {
    runMultiStepMock.mockReset();
    runMultiStepMock.mockResolvedValue(OK_RESULT);
  });

  it('显式 specialistId: toolset/scenario/maxSteps 按定义注入', async () => {
    const r = await spawnSpecialist({
      specialistId: 'okr-analyst',
      task: '看 Q2 目标进度',
      actorUserId: 'u1',
    });

    expect(r.matchReason).toBe('explicit');
    expect(r.specialist).toEqual({ id: 'okr-analyst', name: 'OKR 对齐分析师' });
    expect(r.ok).toBe(true);

    const passed = runMultiStepMock.mock.calls[0][0];
    expect(passed.toolset).toEqual(SPECIALISTS['okr-analyst'].toolset);
    expect(passed.scenario).toBe('reasoning_complex');
    expect(passed.maxSteps).toBe(5);
    expect(passed.systemPrompt).toContain('OKR 对齐分析师');
  });

  it('自动匹配: matchReason=matched, 选对专家', async () => {
    const r = await spawnSpecialist({ task: '盘点人才 谁该晋升', actorUserId: 'u1' });
    expect(r.matchReason).toBe('matched');
    expect(r.specialist?.id).toBe('talent-scout');
  });

  it('未知 specialistId → no_match, 不调 runMultiStep', async () => {
    const r = await spawnSpecialist({ specialistId: 'ghost', task: 't', actorUserId: 'u1' });
    expect(r.ok).toBe(false);
    expect(r.matchReason).toBe('no_match');
    expect(runMultiStepMock).not.toHaveBeenCalled();
  });

  it('无匹配关键词 → no_specialist_matched, 不调 runMultiStep', async () => {
    const r = await spawnSpecialist({ task: '今天午饭吃什么', actorUserId: 'u1' });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('no_specialist_matched');
    expect(runMultiStepMock).not.toHaveBeenCalled();
  });
});
