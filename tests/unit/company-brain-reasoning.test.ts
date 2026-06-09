/**
 * S2 · companyBrainReasoningPass 单测 (中央 AI 主回复深推理)
 *
 * 验证: 复杂决策类提问 → 多步收集真值 → 注入简报; 简单/事实类提问不触发;
 *        无工具命中/异常 → fail-soft 不改 prompt。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { shouldDeepReason } from '@/lib/persona/company-brain-reasoning';

describe('S2 · shouldDeepReason gate', () => {
  it('命中复杂决策关键词 (应该/为什么/比较/分析/策略)', () => {
    expect(shouldDeepReason('我们应该砍哪个项目?').trigger).toBe(true);
    expect(shouldDeepReason('为什么 R&D 团队最近落后了').trigger).toBe(true);
    expect(shouldDeepReason('比较 Q3 和 Q4 的执行健康度').trigger).toBe(true);
    expect(shouldDeepReason('给我分析一下营销线').trigger).toBe(true);
    expect(shouldDeepReason('Q3 的策略对吗').trigger).toBe(true);
  });

  it('简单事实类提问不触发 (留给 S1)', () => {
    expect(shouldDeepReason('R&D 进度怎样').trigger).toBe(false);
    expect(shouldDeepReason('OKR 列表').trigger).toBe(false);
    expect(shouldDeepReason('谁是产品经理').trigger).toBe(false);
  });

  it('空 / 过短查询不触发', () => {
    expect(shouldDeepReason('').trigger).toBe(false);
    expect(shouldDeepReason('  ').trigger).toBe(false);
    expect(shouldDeepReason('为什么').trigger).toBe(false); // <8 字
  });
});

describe('S2 · companyBrainReasoningPass', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('多步调到工具 + 有 finalAnswer → reasoned=true, 简报含真值与约束', async () => {
    const runMultiStep = vi.fn().mockResolvedValue({
      finalAnswer:
        '召回: 2025 Q2 曾决议优先 R&D。评估: KR-3 进度 32%, at-risk。风险: 季末交付滑期高。',
      stepsExecuted: 4,
      finishedNaturally: true,
      trace: [
        { step: 1, thought: 't', toolCall: { name: 'memory.search', args: {} }, finished: false },
        { step: 2, thought: 't', toolCall: { name: 'okr.health_digest', args: {} }, finished: false },
        { step: 3, thought: 't', toolCall: { name: 'decision_card.list', args: {} }, finished: false },
        { step: 4, thought: 't', finished: true },
      ],
      totalTokensUsed: 600,
      totalLatencyMs: 80,
    });
    vi.doMock('@/lib/agent-runtime/multi-step', () => ({ runMultiStep }));

    const { companyBrainReasoningPass } = await import(
      '@/lib/persona/company-brain-reasoning'
    );
    const r = await companyBrainReasoningPass(
      '我们应该砍掉哪个项目? 为什么',
      'BASE_PROMPT',
    );

    expect(runMultiStep).toHaveBeenCalledOnce();
    expect(r.reasoned).toBe(true);
    expect(r.toolsUsed).toEqual([
      'memory.search',
      'okr.health_digest',
      'decision_card.list',
    ]);
    expect(r.revisedSystemPrompt).toContain('BASE_PROMPT');
    expect(r.revisedSystemPrompt).toContain('深推理简报');
    expect(r.revisedSystemPrompt).toContain('KR-3 进度 32%');
    expect(r.revisedSystemPrompt).toContain('约束');
    expect(r.log.stepsExecuted).toBe(4);
    expect(r.log.toolCallCount).toBe(3);
  });

  it('未命中触发 gate → reasoned=false, prompt 原样返回, 不调 runMultiStep', async () => {
    const runMultiStep = vi.fn();
    vi.doMock('@/lib/agent-runtime/multi-step', () => ({ runMultiStep }));

    const { companyBrainReasoningPass } = await import(
      '@/lib/persona/company-brain-reasoning'
    );
    const r = await companyBrainReasoningPass('R&D 进度怎样', 'BASE_PROMPT');

    expect(runMultiStep).not.toHaveBeenCalled();
    expect(r.reasoned).toBe(false);
    expect(r.revisedSystemPrompt).toBe('BASE_PROMPT');
    expect(r.log.triggerReason).toMatch(/no complex-query/);
  });

  it('0 工具调用 → reasoned=false, prompt 不被污染', async () => {
    const runMultiStep = vi.fn().mockResolvedValue({
      finalAnswer: '我猜你想问 X',
      stepsExecuted: 1,
      finishedNaturally: true,
      trace: [{ step: 1, thought: 't', finished: true }],
      totalTokensUsed: 50,
      totalLatencyMs: 10,
    });
    vi.doMock('@/lib/agent-runtime/multi-step', () => ({ runMultiStep }));

    const { companyBrainReasoningPass } = await import(
      '@/lib/persona/company-brain-reasoning'
    );
    const r = await companyBrainReasoningPass(
      '为什么 R&D 落后, 应该怎么办',
      'BASE_PROMPT',
    );

    expect(r.reasoned).toBe(false);
    expect(r.revisedSystemPrompt).toBe('BASE_PROMPT');
    expect(r.toolsUsed).toEqual([]);
    expect(r.log.triggerReason).toMatch(/0 tool results/);
  });

  it('runMultiStep 抛异常 → fail-soft, prompt 原样返回', async () => {
    const runMultiStep = vi.fn().mockRejectedValue(new Error('router not booted'));
    vi.doMock('@/lib/agent-runtime/multi-step', () => ({ runMultiStep }));

    const { companyBrainReasoningPass } = await import(
      '@/lib/persona/company-brain-reasoning'
    );
    const r = await companyBrainReasoningPass(
      '我们应该砍哪个项目?',
      'BASE_PROMPT',
    );

    expect(r.reasoned).toBe(false);
    expect(r.revisedSystemPrompt).toBe('BASE_PROMPT');
    expect(r.log.triggerReason).toMatch(/exception/);
  });
});
