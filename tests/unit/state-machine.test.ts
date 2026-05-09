/**
 * Unit Test · 议事室状态机 (宪章 §3 5 步对齐版)
 *
 * 启用: npm i -D vitest
 *       npx vitest run
 */

/* eslint-disable */
// @ts-expect-error optional dependency
import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  transition,
  detectStall,
  stepToConvergenceState,
  isFinalStep,
  stepBudgetRemainingSeconds,
  STEP_BUDGET_SECONDS,
  MAIN_STEPS,
} from '@/lib/convergence/state-machine';

describe('Convergence State Machine · 宪章 §3 五步骨架', () => {
  it('五步预算总和 = 17min 硬上限 (宪章铁律)', () => {
    const total = MAIN_STEPS.reduce((s, step) => s + STEP_BUDGET_SECONDS[step], 0);
    expect(total).toBe(17 * 60);
  });

  it('五步顺序: ALIGN → FRAME → DIVERGE → CONVERGE → COMMIT', () => {
    expect(MAIN_STEPS).toEqual(['ALIGN', 'FRAME', 'DIVERGE', 'CONVERGE', 'COMMIT']);
  });

  it('完整流程: ALIGN → FRAME → DIVERGE → CONVERGE → COMMIT', () => {
    const t0 = 1_000_000;
    let state = createInitialState('dc_test', t0);
    expect(state.step).toBe('ALIGN');

    let r = transition(state, { type: 'START', cardId: 'dc_test', userId: 'u1', at: t0 + 100 });
    expect(r.state.step).toBe('ALIGN');
    state = r.state;

    r = transition(state, {
      type: 'ALIGN_DONE',
      materialRefs: ['m1'],
      relatedKr: ['kr-1'],
      at: t0 + 200,
    });
    expect(r.state.step).toBe('FRAME');
    expect(r.state.context?.materialRefs).toEqual(['m1']);
    state = r.state;

    r = transition(state, {
      type: 'FRAMED',
      problemStatement: '客户续约谈判策略',
      decisionClass: 'complex',
      at: t0 + 250,
    });
    expect(r.state.step).toBe('DIVERGE');
    expect(r.state.frame?.decisionClass).toBe('complex');
    state = r.state;

    r = transition(state, {
      type: 'OPTIONS_GENERATED',
      options: [
        { id: 'A', type: 'SOP', description: 'sop', confidence: 0.8, risk: 'low' },
        { id: 'B', type: 'AGENT_REASONING', description: 'b', confidence: 0.7, risk: 'medium' },
        { id: 'C', type: 'HISTORICAL', description: 'c', confidence: 0.6, risk: 'medium' },
        { id: 'D', type: 'ORIGINAL', description: 'd', confidence: 0, risk: 'medium', humanOnly: true },
      ],
      at: t0 + 300,
    });
    // OPTIONS_GENERATED 不切状态, 仍在 DIVERGE
    expect(r.state.step).toBe('DIVERGE');
    expect(r.state.options?.length).toBe(4);
    state = r.state;

    // PICK_OPTION 才切到 CONVERGE
    r = transition(state, { type: 'PICK_OPTION', userId: 'u1', option: 'B', at: t0 + 400 });
    expect(r.state.step).toBe('CONVERGE');
    expect(r.state.selected).toBe('B');
    state = r.state;

    r = transition(state, { type: 'COMMIT', userId: 'u1', at: t0 + 500 });
    expect(r.state.step).toBe('COMMIT');
    expect(r.commands.find((c) => c.type === 'START_VETO_WINDOW')).toBeTruthy();
  });

  it('17 分钟硬上限自动触发 ESCALATED (宪章 §3 铁律)', () => {
    const t0 = 1_000_000;
    let state = createInitialState('dc_timeout', t0);
    state.step = 'DIVERGE';

    const result = transition(state, { type: 'TICK', at: t0 + 18 * 60 * 1000 });
    expect(result.state.step).toBe('ESCALATED');
    expect(result.state.escalationReason).toBe('hard_time_limit');
  });

  it('缺 D 选项自动 ESCALATE (宪章 §2 铁律)', () => {
    const t0 = 1_000_000;
    const state = createInitialState('dc_no_d', t0);
    state.step = 'DIVERGE';

    const result = transition(state, {
      type: 'OPTIONS_GENERATED',
      options: [
        { id: 'A', type: 'SOP', description: '', confidence: 0.8, risk: 'low' },
        { id: 'B', type: 'AGENT_REASONING', description: '', confidence: 0.7, risk: 'low' },
        { id: 'C', type: 'HISTORICAL', description: '', confidence: 0.6, risk: 'low' },
      ],
      at: t0 + 100,
    });
    expect(result.state.step).toBe('ESCALATED');
    expect(result.state.escalationReason).toBe('d_option_missing');
  });

  it('5 分钟卡顿检测', () => {
    const t0 = 1_000_000;
    const state = createInitialState('dc_stall', t0);
    state.step = 'DIVERGE';
    state.lastActivityAt = t0;

    expect(detectStall(state, t0 + 4 * 60 * 1000)).toBe(false);
    expect(detectStall(state, t0 + 6 * 60 * 1000)).toBe(true);
  });

  it('VETO 仅在 COMMIT 状态下有效', () => {
    const t0 = 1_000_000;
    const state = createInitialState('dc_veto', t0);
    state.step = 'DIVERGE'; // 非 COMMIT

    let r = transition(state, { type: 'VETO', userId: 'u1', reason: 'test', at: t0 + 100 });
    expect(r.state.step).toBe('DIVERGE'); // 不变

    state.step = 'COMMIT';
    r = transition(state, { type: 'VETO', userId: 'u1', reason: 'test', at: t0 + 100 });
    expect(r.state.step).toBe('VETOED');
  });

  it('stepToConvergenceState · 5 内部 step → 5 外部 ConvergenceState', () => {
    expect(stepToConvergenceState('ALIGN')).toBe('DIVERGE');
    expect(stepToConvergenceState('FRAME')).toBe('DIVERGE');
    expect(stepToConvergenceState('DIVERGE')).toBe('DIVERGE');
    expect(stepToConvergenceState('CONVERGE')).toBe('CONVERGE');
    expect(stepToConvergenceState('COMMIT')).toBe('COMMIT');
    expect(stepToConvergenceState('ESCALATED')).toBe('ESCALATED');
    expect(stepToConvergenceState('VETOED')).toBe('VETOED');
  });

  it('isFinalStep · COMMIT/ESCALATED/VETOED 是终态', () => {
    expect(isFinalStep('ALIGN')).toBe(false);
    expect(isFinalStep('DIVERGE')).toBe(false);
    expect(isFinalStep('CONVERGE')).toBe(false);
    expect(isFinalStep('COMMIT')).toBe(true);
    expect(isFinalStep('ESCALATED')).toBe(true);
    expect(isFinalStep('VETOED')).toBe(true);
  });

  it('stepBudgetRemainingSeconds · 软预算剩余时间', () => {
    const t0 = 1_000_000;
    const state = createInitialState('dc_budget', t0);
    state.step = 'DIVERGE';
    state.stepEnteredAt = t0;
    // 进入 DIVERGE 1 分钟, 预算 5min, 剩 4min = 240s
    expect(stepBudgetRemainingSeconds(state, t0 + 60 * 1000)).toBe(240);
    // 进入 DIVERGE 6 分钟, 超预算 1min = -60s
    expect(stepBudgetRemainingSeconds(state, t0 + 6 * 60 * 1000)).toBe(-60);
  });
});
