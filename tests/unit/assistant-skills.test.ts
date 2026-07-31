/**
 * tests/unit/assistant-skills.test.ts · 搭子「个人助理」技能组真闭环 (S1 · 2026-07-29)
 *
 * 验证 (防假闭环 · 见 memory 7b67ce8c):
 *   - 5 个助理技能确实注册进 skillRegistry。
 *   - create_event 真写入日历 → schedule_summary 真查得到 (端到端闭环, 非 stub)。
 *   - find_time 建议真避开已占用时段。
 *   - shouldAssist 写意图门控: 命中"约会议/提醒参会人", 放过纯查询 (交 perception 只读)。
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { setStore, getStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { skillRegistry } from '@/lib/taf/skills/registry';
import { registerBuiltinSkills } from '@/lib/taf/skills/builtin';
import {
  AssistantScheduleSummarySkill,
  AssistantFindTimeSkill,
  AssistantCreateEventSkill,
  ASSISTANT_SKILL_IDS,
} from '@/lib/taf/skills/assistant-skills';
import { shouldAssist } from '@/lib/persona/persona-assistant';
import type { SkillContext } from '@/lib/taf/skills/registry';

const TENANT = 'default';
let userId: string;

beforeEach(async () => {
  setStore(createInMemoryStore());
  skillRegistry.clear();
  registerBuiltinSkills();
  const u = await getStore().auth.users.create({
    email: 'assistant-test@t.local',
    name: '助理测试',
    tenantId: TENANT,
    roles: ['employee'],
  } as never);
  userId = (u as { id: string }).id;
});

function ctx(): SkillContext {
  return { userId, isProxy: true, tenantId: TENANT };
}

describe('assistant skills · 注册', () => {
  it('5 个助理技能全部注册进 registry', () => {
    for (const id of ASSISTANT_SKILL_IDS) {
      expect(skillRegistry.has(id)).toBe(true);
    }
    expect(ASSISTANT_SKILL_IDS.length).toBe(5);
  });
});

describe('assistant skills · 真闭环 (create → read)', () => {
  it('create_event 真写入日历, schedule_summary 真查得到', async () => {
    const start = new Date(Date.now() + 2 * 3600_000);
    const end = new Date(Date.now() + 3 * 3600_000);
    const created = (await AssistantCreateEventSkill.execute(
      { title: '渠道复盘会', startAt: start.toISOString(), endAt: end.toISOString() },
      ctx(),
    )) as { ok: boolean; data?: { eventId?: string } };

    expect(created.ok).toBe(true);
    expect(created.data?.eventId).toBeTruthy();

    const summary = (await AssistantScheduleSummarySkill.execute({ range: 'week' }, ctx())) as {
      ok: boolean;
      data: { events: Array<{ id: string; title: string }> };
    };
    expect(summary.ok).toBe(true);
    const ids = summary.data.events.map((e) => e.id);
    expect(ids).toContain(created.data!.eventId);
    const titles = summary.data.events.map((e) => e.title);
    expect(titles).toContain('渠道复盘会');
  });

  it('create_event 拒绝非法时间 (end <= start)', async () => {
    const t = new Date(Date.now() + 3600_000).toISOString();
    const res = (await AssistantCreateEventSkill.execute(
      { title: '坏事件', startAt: t, endAt: t },
      ctx(),
    )) as { ok: boolean; error?: string };
    expect(res.ok).toBe(false);
  });
});

describe('assistant skills · find_time 避开占用', () => {
  it('建议时段避开已占用会议', async () => {
    const day = '2030-06-03'; // 固定未来工作日, 避免与其它测试事件窗口重叠
    await AssistantCreateEventSkill.execute(
      { title: '占用时段', startAt: `${day}T10:00:00.000Z`, endAt: `${day}T11:00:00.000Z` },
      ctx(),
    );

    const res = (await AssistantFindTimeSkill.execute(
      {
        durationMin: 60,
        rangeStart: `${day}T09:00:00.000Z`,
        rangeEnd: `${day}T18:00:00.000Z`,
        preference: 'any',
      },
      ctx(),
    )) as { ok: boolean; data: { suggestions: Array<{ startAt: string }> } };

    expect(res.ok).toBe(true);
    const starts = res.data.suggestions.map((s) => s.startAt);
    expect(starts).toContain('2030-06-03T09:00:00.000Z'); // 占用前的空档
    expect(starts).not.toContain('2030-06-03T10:00:00.000Z'); // 被占用不应建议
  });
});

describe('shouldAssist · 写意图门控', () => {
  it('命中创建/提醒意图', () => {
    expect(shouldAssist('帮我约周二下午3点和老王开个会').trigger).toBe(true);
    expect(shouldAssist('加个日程明天上午跟进渠道').trigger).toBe(true);
    expect(shouldAssist('提醒一下明天会议的参会人').trigger).toBe(true);
  });

  it('放过纯查询 (交 perception 只读) 与闲聊', () => {
    expect(shouldAssist('我今天有什么安排').trigger).toBe(false);
    expect(shouldAssist('本周还有几个会').trigger).toBe(false);
    expect(shouldAssist('你好').trigger).toBe(false);
  });
});
