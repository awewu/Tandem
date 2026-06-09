/**
 * tests/unit/company-brain-perception.test.ts
 *
 * 锁 S1·CA-6/7 中央 AI 内部感知层 (company-brain-perception.ts):
 *   1. 闲聊 (无内部数据关键词) → 不跑 tool-loop, prompt 原样
 *   2. 数据类问题 + 工具拿到真值 → perceived=true, systemPrompt 注入真值块
 *   3. 数据类问题 + 工具 0 结果 → perceived=false, prompt 原样
 *   4. runToolLoop 抛错 → fail-soft, perceived=false, 不抛
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const BASE_PROMPT = 'You are CompanyBrain. 基线在此。';

describe('S1·CA-6/7 · companyBrainPerceptionPass · 中央 AI 装眼睛', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('闲聊 (无内部数据关键词) → 不跑 tool-loop, prompt 原样', async () => {
    const runToolLoop = vi.fn();
    vi.doMock('@/lib/agent-runtime/tool-loop', () => ({ runToolLoop }));

    const { companyBrainPerceptionPass } = await import('@/lib/persona/company-brain-perception');
    const r = await companyBrainPerceptionPass('今天天气不错啊', BASE_PROMPT);

    expect(r.perceived).toBe(false);
    expect(r.revisedSystemPrompt).toBe(BASE_PROMPT);
    expect(runToolLoop).not.toHaveBeenCalled();
  });

  it('数据类问题 + 工具拿到真值 → perceived=true, 注入内部真值块', async () => {
    const runToolLoop = vi.fn(async () => ({
      finalMessage: '已收集',
      roundsExecuted: 2,
      finishedNaturally: true,
      toolInvocations: [
        {
          toolCallId: 't1',
          name: 'okr.health_digest',
          args: {},
          result: '{"worst":[{"title":"Q3 增长","progressPct":18}]}',
          ok: true,
          latencyMs: 10,
        },
      ],
      totalTokensUsed: 100,
      totalLatencyMs: 20,
    }));
    vi.doMock('@/lib/agent-runtime/tool-loop', () => ({ runToolLoop }));

    const { companyBrainPerceptionPass } = await import('@/lib/persona/company-brain-perception');
    const r = await companyBrainPerceptionPass('当前 OKR 进度怎么样, 哪些目标 at-risk?', BASE_PROMPT);

    expect(runToolLoop).toHaveBeenCalledOnce();
    expect(r.perceived).toBe(true);
    expect(r.revisedSystemPrompt).toContain('内部真实数据');
    expect(r.revisedSystemPrompt).toContain('okr.health_digest');
    expect(r.revisedSystemPrompt).toContain('Q3 增长');

    const call = (runToolLoop.mock.calls[0] as unknown[])[0] as { toolset: string[]; actorUserId: string };
    expect(call.toolset).toContain('okr.health_digest');
    expect(call.toolset).not.toContain('hr.salary_read');
    expect(call.actorUserId).toBe('__company__');
  });

  it('数据类问题 + 工具 0 成功结果 → perceived=false, prompt 原样', async () => {
    const runToolLoop = vi.fn(async () => ({
      finalMessage: '无需查询',
      roundsExecuted: 1,
      finishedNaturally: true,
      toolInvocations: [],
      totalTokensUsed: 30,
      totalLatencyMs: 5,
    }));
    vi.doMock('@/lib/agent-runtime/tool-loop', () => ({ runToolLoop }));

    const { companyBrainPerceptionPass } = await import('@/lib/persona/company-brain-perception');
    const r = await companyBrainPerceptionPass('KR 完成率如何', BASE_PROMPT);

    expect(r.perceived).toBe(false);
    expect(r.revisedSystemPrompt).toBe(BASE_PROMPT);
  });

  it('runToolLoop 抛错 → fail-soft, 不抛, perceived=false', async () => {
    const runToolLoop = vi.fn(async () => {
      throw new Error('boom');
    });
    vi.doMock('@/lib/agent-runtime/tool-loop', () => ({ runToolLoop }));

    const { companyBrainPerceptionPass } = await import('@/lib/persona/company-brain-perception');
    const r = await companyBrainPerceptionPass('议事决议执行情况', BASE_PROMPT);

    expect(r.perceived).toBe(false);
    expect(r.revisedSystemPrompt).toBe(BASE_PROMPT);
    expect(r.log.triggerReason).toContain('exception');
  });
});
