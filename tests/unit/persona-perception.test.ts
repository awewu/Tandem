/**
 * tests/unit/persona-perception.test.ts
 *
 * 锁 序2 搭子感知前置 (persona-perception.ts) —— 把只读 tool-loop 装进搭子回复路径:
 *   1. 闲聊 (无内部数据关键词) → 不跑 tool-loop, prompt 原样
 *   2. 数据类问题 + 工具拿到本人真值 → perceived=true, systemPrompt 注入真值块, actorUserId=本人, isProxy=true
 *   3. 数据类问题 + 工具 0 结果 → perceived=false, prompt 原样
 *   4. runToolLoop 抛错 → fail-soft, perceived=false, 不抛
 *   5. 工具白名单只含只读 (无 hr.salary_read / convergence.start 等写/红区动作)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const BASE_PROMPT = '你是张伟的 AI 分身。基线在此。';
const ACTOR = 'user-zhangwei';

describe('序2 · personaPerceptionPass · 搭子装执行肢体 (只读感知)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('闲聊 (无内部数据关键词) → 不跑 tool-loop, prompt 原样', async () => {
    const runToolLoop = vi.fn();
    vi.doMock('@/lib/agent-runtime/tool-loop', () => ({ runToolLoop }));

    const { personaPerceptionPass } = await import('@/lib/persona/persona-perception');
    const r = await personaPerceptionPass('中午一起吃饭吗', BASE_PROMPT, ACTOR);

    expect(r.perceived).toBe(false);
    expect(r.revisedSystemPrompt).toBe(BASE_PROMPT);
    expect(runToolLoop).not.toHaveBeenCalled();
  });

  it('数据类问题 + 工具拿到本人真值 → perceived=true, 注入真值, 本人身份 + isProxy', async () => {
    const runToolLoop = vi.fn(async () => ({
      finalMessage: '已收集',
      roundsExecuted: 2,
      finishedNaturally: true,
      toolInvocations: [
        {
          toolCallId: 't1',
          name: 'okr.read',
          args: {},
          result: '{"kr":"我的 Q3 KR","progressPct":42}',
          ok: true,
          latencyMs: 10,
        },
      ],
      totalTokensUsed: 100,
      totalLatencyMs: 20,
    }));
    vi.doMock('@/lib/agent-runtime/tool-loop', () => ({ runToolLoop }));

    const { personaPerceptionPass } = await import('@/lib/persona/persona-perception');
    const r = await personaPerceptionPass('我那个 KR 现在进度怎么样', BASE_PROMPT, ACTOR);

    expect(runToolLoop).toHaveBeenCalledOnce();
    expect(r.perceived).toBe(true);
    expect(r.revisedSystemPrompt).toContain('内部真实数据');
    expect(r.revisedSystemPrompt).toContain('okr.read');
    expect(r.revisedSystemPrompt).toContain('我的 Q3 KR');

    const call = (runToolLoop.mock.calls[0] as unknown[])[0] as {
      toolset: string[];
      actorUserId: string;
      isProxy: boolean;
    };
    expect(call.actorUserId).toBe(ACTOR);
    expect(call.isProxy).toBe(true);
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

    const { personaPerceptionPass } = await import('@/lib/persona/persona-perception');
    const r = await personaPerceptionPass('我的目标完成率如何', BASE_PROMPT, ACTOR);

    expect(r.perceived).toBe(false);
    expect(r.revisedSystemPrompt).toBe(BASE_PROMPT);
  });

  it('runToolLoop 抛错 → fail-soft, 不抛, perceived=false', async () => {
    const runToolLoop = vi.fn(async () => {
      throw new Error('boom');
    });
    vi.doMock('@/lib/agent-runtime/tool-loop', () => ({ runToolLoop }));

    const { personaPerceptionPass } = await import('@/lib/persona/persona-perception');
    const r = await personaPerceptionPass('我的议事决议执行情况', BASE_PROMPT, ACTOR);

    expect(r.perceived).toBe(false);
    expect(r.revisedSystemPrompt).toBe(BASE_PROMPT);
    expect(r.log.triggerReason).toContain('exception');
  });

  it('工具白名单只含只读 (无 hr.salary_read / convergence.start 等写/红区)', async () => {
    const { PERSONA_PERCEPTION_TOOLSET } = await import('@/lib/persona/persona-perception');
    expect([...PERSONA_PERCEPTION_TOOLSET]).toEqual(['okr.read', 'memory.search', 'decision_card.list']);
    expect(PERSONA_PERCEPTION_TOOLSET).not.toContain('hr.salary_read');
    expect(PERSONA_PERCEPTION_TOOLSET).not.toContain('convergence.start');
  });
});
