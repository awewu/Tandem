/**
 * S2·CA-5 · buildDecisionReasoningBrief 单测 (议事多步参谋推理)
 *
 * 验证: 多步收集真值 → 注入简报; 无工具命中/异常 → fail-soft 空简报。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { DecisionContext } from '@/lib/decision-layer/three-plus-one-engine';

const CTX: DecisionContext = {
  cardId: 'c1',
  title: '是否把客户数据迁到境外云',
  description: '为降本考虑迁移到海外服务器',
  actorUserId: 'u1',
  scenario: 'convergence',
};

describe('S2·CA-5 · buildDecisionReasoningBrief', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('多步调到工具 + 有 finalAnswer → reasoned=true, 简报含真值与约束', async () => {
    const runMultiStep = vi.fn().mockResolvedValue({
      finalAnswer: '历史决议: 2025 曾否决数据出境。OKR 对齐: 服务"合规"目标。风险: 命中红线"客户数据严禁出境"。',
      stepsExecuted: 3,
      finishedNaturally: true,
      trace: [
        { step: 1, thought: 't', toolCall: { name: 'decision_card.list', args: {} }, finished: false },
        { step: 2, thought: 't', toolCall: { name: 'memory.search', args: {} }, finished: false },
        { step: 3, thought: 't', finished: true },
      ],
      totalTokensUsed: 400,
      totalLatencyMs: 50,
    });
    vi.doMock('@/lib/agent-runtime/multi-step', () => ({ runMultiStep }));

    const { buildDecisionReasoningBrief } = await import('@/lib/decision-layer/reasoning-pass');
    const r = await buildDecisionReasoningBrief(CTX);

    expect(runMultiStep).toHaveBeenCalledOnce();
    const call = (runMultiStep.mock.calls[0] as unknown[])[0] as { toolset: string[]; mode: string; isProxy: boolean };
    expect(call.mode).toBe('native');
    expect(call.toolset).toContain('okr.health_digest');
    expect(call.toolset).toContain('decision_card.list');
    expect(call.toolset).not.toContain('hr.salary_read');

    expect(r.reasoned).toBe(true);
    expect(r.toolsUsed).toEqual(['decision_card.list', 'memory.search']);
    expect(r.brief).toContain('参谋简报');
    expect(r.brief).toContain('客户数据严禁出境');
    expect(r.brief).toContain('约束');
  });

  it('一个工具都没调到 → reasoned=false, 空简报 (不拿臆测当事实)', async () => {
    const runMultiStep = vi.fn().mockResolvedValue({
      finalAnswer: '无需查询',
      stepsExecuted: 1,
      finishedNaturally: true,
      trace: [{ step: 1, thought: 't', finished: true }],
      totalTokensUsed: 50,
      totalLatencyMs: 10,
    });
    vi.doMock('@/lib/agent-runtime/multi-step', () => ({ runMultiStep }));

    const { buildDecisionReasoningBrief } = await import('@/lib/decision-layer/reasoning-pass');
    const r = await buildDecisionReasoningBrief(CTX);

    expect(r.reasoned).toBe(false);
    expect(r.brief).toBe('');
    expect(r.toolsUsed).toEqual([]);
  });

  it('runMultiStep 抛错 → fail-soft, reasoned=false 空简报', async () => {
    const runMultiStep = vi.fn().mockRejectedValue(new Error('router not booted'));
    vi.doMock('@/lib/agent-runtime/multi-step', () => ({ runMultiStep }));

    const { buildDecisionReasoningBrief } = await import('@/lib/decision-layer/reasoning-pass');
    const r = await buildDecisionReasoningBrief(CTX);

    expect(r.reasoned).toBe(false);
    expect(r.brief).toBe('');
  });

  it('空议题 → 不跑推理', async () => {
    const runMultiStep = vi.fn();
    vi.doMock('@/lib/agent-runtime/multi-step', () => ({ runMultiStep }));

    const { buildDecisionReasoningBrief } = await import('@/lib/decision-layer/reasoning-pass');
    const r = await buildDecisionReasoningBrief({ cardId: 'c', title: '', description: '' });

    expect(runMultiStep).not.toHaveBeenCalled();
    expect(r.reasoned).toBe(false);
  });
});
