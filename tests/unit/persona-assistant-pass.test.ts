/**
 * tests/unit/persona-assistant-pass.test.ts · 搭子个人助理写 pass 真闭环 (S1 · 2026-07-29)
 *
 * 固化 "/api/persona/stream §8" 修复: personaAssistantPass 经 tool-loop 调 assistant.create_event
 * → 真写入日历 → 返回 actions。用注入的假 router 驱动一次确定性 tool_call (不打真实 LLM),
 * 验证真闭环 (防假闭环 · memory 7b67ce8c): 写动作 ok + 事件真能被 schedule_summary 读回。
 *
 * 同时锁住写意图门控: 纯查询 (无"约/加/建") 不触发写 pass (交感知只读)。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setStore, getStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { skillRegistry } from '@/lib/taf/skills/registry';
import { registerBuiltinSkills } from '@/lib/taf/skills/builtin';
import { personaAssistantPass } from '@/lib/persona/persona-assistant';
import { AssistantScheduleSummarySkill } from '@/lib/taf/skills/assistant-skills';

const TENANT = 'default';
const GLOBAL_ROUTER_KEY = '__tandem_router__';
let userId: string;
let prevRouter: unknown;

/** 假 router: 第 1 轮回一个 assistant_create_event tool_call, 第 2 轮自然收敛。 */
function makeFakeRouter(args: { title: string; startAt: string; endAt: string }) {
  let call = 0;
  return {
    chat: async () => {
      call += 1;
      if (call === 1) {
        return {
          message: {
            role: 'assistant',
            content: '',
            toolCalls: [
              {
                id: 'tc_create_1',
                type: 'function',
                function: {
                  // sanitize 形式 (点→下划线); tool-loop 会还原成 assistant.create_event
                  name: 'assistant_create_event',
                  arguments: JSON.stringify(args),
                },
              },
            ],
          },
          usage: { totalTokens: 12 },
        };
      }
      return {
        message: { role: 'assistant', content: `已为你创建日程「${args.title}」。` },
        usage: { totalTokens: 6 },
      };
    },
  };
}

beforeEach(async () => {
  setStore(createInMemoryStore());
  skillRegistry.clear();
  registerBuiltinSkills();
  const u = await getStore().auth.users.create({
    email: 'assistant-pass@t.local',
    name: '助理pass测试',
    tenantId: TENANT,
    roles: ['employee'],
  } as never);
  userId = (u as { id: string }).id;
  prevRouter = (globalThis as Record<string, unknown>)[GLOBAL_ROUTER_KEY];
});

afterEach(() => {
  // 还原全局 router, 避免污染其它测试文件
  (globalThis as Record<string, unknown>)[GLOBAL_ROUTER_KEY] = prevRouter;
});

describe('personaAssistantPass · 写意图门控', () => {
  it('纯查询不触发写 pass (交感知只读)', async () => {
    const res = await personaAssistantPass('我今天有什么安排', '', userId, { tenantId: TENANT });
    expect(res.assisted).toBe(false);
    expect(res.actions).toHaveLength(0);
    expect(res.log.triggerReason).toBe('no_assistant_write_intent');
  });
});

describe('personaAssistantPass · 真闭环 (tool-loop → 真写日历)', () => {
  it('约会议意图 → 经 tool-loop 调 create_event 真写入, schedule_summary 读得回', async () => {
    const start = new Date(Date.now() + 26 * 3600_000); // 明天此刻
    const end = new Date(start.getTime() + 3600_000);
    (globalThis as Record<string, unknown>)[GLOBAL_ROUTER_KEY] = makeFakeRouter({
      title: 'Q3 渠道复盘会',
      startAt: start.toISOString(),
      endAt: end.toISOString(),
    });

    const res = await personaAssistantPass(
      '帮我约明天这个点开个 Q3 渠道复盘会',
      '',
      userId,
      { tenantId: TENANT },
    );

    expect(res.assisted).toBe(true);
    const created = res.actions.find((a) => a.tool === 'assistant.create_event');
    expect(created).toBeTruthy();
    expect(created!.ok).toBe(true);

    // 真闭环: 事件确实进了日历, schedule_summary 能读回
    const summary = (await AssistantScheduleSummarySkill.execute({ range: 'week' }, {
      userId,
      isProxy: true,
      tenantId: TENANT,
    })) as { ok: boolean; data: { events: Array<{ title: string }> } };
    expect(summary.ok).toBe(true);
    expect(summary.data.events.map((e) => e.title)).toContain('Q3 渠道复盘会');
  });
});
