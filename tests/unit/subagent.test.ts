/**
 * Subagent 单测 · lib/agent-runtime/subagent.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { runMultiStepMock } = vi.hoisted(() => ({ runMultiStepMock: vi.fn() }));
vi.mock('@/lib/agent-runtime/multi-step', () => ({
  runMultiStep: runMultiStepMock,
}));

import { spawnSubagent, spawnSubagentsParallel } from '@/lib/agent-runtime/subagent';

describe('spawnSubagent', () => {
  beforeEach(() => {
    runMultiStepMock.mockReset();
  });

  it('成功执行返回 summary + ok=true', async () => {
    runMultiStepMock.mockResolvedValueOnce({
      finalAnswer: '• 他擅长产品需求拆解\n• 提案 12 次, 通过 10 次',
      stepsExecuted: 3,
      finishedNaturally: true,
      trace: [{ step: 1, thought: 't', finished: false }],
      totalTokensUsed: 500,
      totalLatencyMs: 1200,
    });

    const r = await spawnSubagent({
      task: '查这位同事的提案',
      parentSystemHint: '主任务: 写 1on1 brief',
      isolatedToolset: ['memory.search'],
      actorUserId: 'u1',
    });

    expect(r.ok).toBe(true);
    expect(r.summary).toContain('提案');
    expect(r.tokensUsed).toBe(500);
    expect(runMultiStepMock).toHaveBeenCalledOnce();
    const args = runMultiStepMock.mock.calls[0][0];
    expect(args.userQuery).toBe('查这位同事的提案');
    expect(args.toolset).toEqual(['memory.search']);
    expect(args.maxSteps).toBe(4); // default subagent
    expect(args.mode).toBe('prompt');
    expect(args.systemPrompt).toContain('子代理');
    expect(args.systemPrompt).toContain('主任务: 写 1on1 brief');
  });

  it('failOver: 内部异常时不抛, 返回 ok=false + summary 携带错误', async () => {
    runMultiStepMock.mockRejectedValueOnce(new Error('llm down'));

    const r = await spawnSubagent({
      task: '查 X',
      actorUserId: 'u1',
    });

    expect(r.ok).toBe(false);
    expect(r.summary).toContain('llm down');
    expect(r.error).toBe('llm down');
    expect(r.trace).toEqual([]);
  });

  it('过长 finalAnswer 自动截断', async () => {
    runMultiStepMock.mockResolvedValueOnce({
      finalAnswer: 'A'.repeat(3000),
      stepsExecuted: 2,
      finishedNaturally: true,
      trace: [],
      totalTokensUsed: 100,
      totalLatencyMs: 100,
    });

    const r = await spawnSubagent({ task: 't', actorUserId: 'u1' });
    expect(r.summary.length).toBeLessThanOrEqual(1600);
    expect(r.summary).toContain('截断');
  });
});

describe('spawnSubagentsParallel', () => {
  beforeEach(() => {
    runMultiStepMock.mockReset();
  });

  it('并行多个子任务, 顺序对应输入', async () => {
    // 按 task 内容路由返回, 不依赖调用顺序 (Promise.all 并发不保序)
    runMultiStepMock.mockImplementation(async (args: { userQuery: string }) => ({
      finalAnswer: `${args.userQuery} 摘要`,
      stepsExecuted: 1,
      finishedNaturally: true,
      trace: [],
      totalTokensUsed: 1,
      totalLatencyMs: 1,
    }));

    const rs = await spawnSubagentsParallel([
      { task: 'A', actorUserId: 'u1' },
      { task: 'B', actorUserId: 'u1' },
      { task: 'C', actorUserId: 'u1' },
    ]);

    expect(rs).toHaveLength(3);
    expect(rs[0].summary).toBe('A 摘要');
    expect(rs[1].summary).toBe('B 摘要');
    expect(rs[2].summary).toBe('C 摘要');
    expect(rs.every((r) => r.ok)).toBe(true);
  });

  it('某个子任务失败不影响其他', async () => {
    runMultiStepMock.mockImplementation(async (args: { userQuery: string }) => {
      if (args.userQuery === 'B') throw new Error('B 挂');
      return {
        finalAnswer: `${args.userQuery} ok`,
        stepsExecuted: 1,
        finishedNaturally: true,
        trace: [],
        totalTokensUsed: 1,
        totalLatencyMs: 1,
      };
    });

    const rs = await spawnSubagentsParallel([
      { task: 'A', actorUserId: 'u1' },
      { task: 'B', actorUserId: 'u1' },
      { task: 'C', actorUserId: 'u1' },
    ]);

    expect(rs[0].ok).toBe(true);
    expect(rs[1].ok).toBe(false);
    expect(rs[1].summary).toContain('B 挂');
    expect(rs[2].ok).toBe(true);
  });
});
