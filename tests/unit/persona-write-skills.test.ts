/**
 * tests/unit/persona-write-skills.test.ts · 搭子「装手」写动作 skill 治理 (S1 · 2026-06-09)
 *
 * 验证: tool-loop 可调的写动作提议 (okr.checkin_propose / persona.propose_action) 严格走
 * proposeAction 下游治理 —— 宪法 A 拒中央 AI / 搭子 self-delegation 黄区→24h否决窗 /
 * 委托级别越权升红 / validate 失败拒 / 通用桥未注册动作拒 / 无分身拒。
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { setStore, getStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { skillRegistry } from '@/lib/taf/skills/registry';
import { registerBuiltinSkills } from '@/lib/taf/skills/builtin';
import '@/lib/ontology'; // import 即注册 kr.checkin (ensureCoreActions)
import { COMPANY_BRAIN_USER_ID } from '@/lib/persona/company-brain';
import { shouldAct } from '@/lib/persona/persona-act';
import type { SkillContext } from '@/lib/taf/skills/registry';

const TENANT = 'default';

beforeEach(() => {
  setStore(createInMemoryStore());
  skillRegistry.clear();
  registerBuiltinSkills();
});

async function seedPersona(userId: string, delegationLevel: string): Promise<void> {
  await getStore().personas.create({
    id: `persona_${userId}`,
    userId,
    schemaVersion: 'tandem.v1',
    stage: 'deputy',
    stageEnteredAt: new Date().toISOString(),
    delegationLevel,
    learningActive: true,
    styleProfile: {
      decisionSpeed: 'medium',
      riskAppetite: 0.5,
      communicationStyle: 'direct',
      preferredOptions: [],
      communicationExamples: [],
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as never);
}

async function seedKr(id: string, ownerId: string): Promise<void> {
  await getStore().keyResults.create({
    id,
    objectiveId: 'obj_1',
    ownerId,
    title: '测试 KR',
    status: 'active',
    currentValue: 0,
    startValue: 0,
    targetValue: 100,
    weight: 1,
    confidence: 'on-track',
    unit: '%',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as never);
}

function ctx(userId: string): SkillContext {
  return { userId, isProxy: true, tenantId: TENANT };
}

describe('搭子写动作 · 宪法 A (中央 AI 永不可 proposer)', () => {
  it('中央 AI userId 提议 → 被宪法 A 硬拒', async () => {
    await seedPersona(COMPANY_BRAIN_USER_ID, 'commit_short');
    await seedKr('kr_cb', COMPANY_BRAIN_USER_ID);

    const r = await skillRegistry.execute(
      'okr.checkin_propose',
      { krId: 'kr_cb', currentValue: 50 },
      ctx(COMPANY_BRAIN_USER_ID),
    );

    expect(r.ok).toBe(false);
    expect((r.data as { status?: string })?.status).toBe('rejected');
    expect(r.error).toContain('中央 AI');
    // 不得落任何 ProxyAction
    expect(await getStore().proxyActions.list()).toHaveLength(0);
  });
});

describe('搭子写动作 · okr.checkin_propose (self-delegation)', () => {
  it('commit_short 分身提议 KR check-in → 黄区 pending_veto + 落 24h 否决窗 ProxyAction', async () => {
    await seedPersona('u_alice', 'commit_short');
    await seedKr('kr_1', 'u_alice');

    const r = await skillRegistry.execute(
      'okr.checkin_propose',
      { krId: 'kr_1', currentValue: 60, confidence: 'at-risk', reason: '季中复盘' },
      ctx('u_alice'),
    );

    expect(r.ok).toBe(true);
    const data = r.data as { status: string; zone: string; proxyActionId?: string };
    expect(data.status).toBe('pending_veto');
    expect(data.zone).toBe('yellow');
    expect(data.proxyActionId).toBeTruthy();

    // 落了一条 ontology_action awaiting_veto, 且尚未真写 (KR.currentValue 仍为 0)
    const pas = await getStore().proxyActions.list();
    expect(pas).toHaveLength(1);
    expect(pas[0].kind).toBe('ontology_action');
    expect(pas[0].status).toBe('awaiting_veto');
    expect(pas[0].vetoUntil).toBeTruthy();
    const kr = await getStore().keyResults.get('kr_1');
    expect(kr?.currentValue).toBe(0); // 延迟执行: 否决窗内不写
  });

  it('soft_opinion 分身提议 commit 类动作 → 越权升红 → rejected, 不落 ProxyAction', async () => {
    await seedPersona('u_bob', 'soft_opinion');
    await seedKr('kr_2', 'u_bob');

    const r = await skillRegistry.execute(
      'okr.checkin_propose',
      { krId: 'kr_2', currentValue: 30 },
      ctx('u_bob'),
    );

    expect(r.ok).toBe(false);
    const data = r.data as { status: string; zone: string };
    expect(data.status).toBe('rejected');
    expect(data.zone).toBe('red');
    expect(await getStore().proxyActions.list()).toHaveLength(0);
  });

  it('KR 不存在 → validate 失败 → rejected (green), 不落 ProxyAction', async () => {
    await seedPersona('u_carol', 'commit_short');

    const r = await skillRegistry.execute(
      'okr.checkin_propose',
      { krId: 'nope', currentValue: 1 },
      ctx('u_carol'),
    );

    expect(r.ok).toBe(false);
    const data = r.data as { status: string; reasons?: string[] };
    expect(data.status).toBe('rejected');
    expect((data.reasons ?? []).join(' ')).toContain('kr not found');
    expect(await getStore().proxyActions.list()).toHaveLength(0);
  });

  it('无本人分身 → 提议失败 (须先有 Persona)', async () => {
    await seedKr('kr_3', 'u_nopersona');

    const r = await skillRegistry.execute(
      'okr.checkin_propose',
      { krId: 'kr_3', currentValue: 1 },
      ctx('u_nopersona'),
    );

    expect(r.ok).toBe(false);
    expect(r.error).toContain('未找到本人分身');
  });
});

describe('搭子写动作 · persona.propose_action (泛化桥)', () => {
  it('提议已注册动作 kr.checkin (commit_short) → pending_veto', async () => {
    await seedPersona('u_dave', 'commit_short');
    await seedKr('kr_4', 'u_dave');

    const r = await skillRegistry.execute(
      'persona.propose_action',
      { actionId: 'kr.checkin', input: { krId: 'kr_4', currentValue: 40 } },
      ctx('u_dave'),
    );

    expect(r.ok).toBe(true);
    expect((r.data as { status: string }).status).toBe('pending_veto');
  });

  it('提议未注册动作 → rejected (action 未注册)', async () => {
    await seedPersona('u_dave', 'commit_short');

    const r = await skillRegistry.execute(
      'persona.propose_action',
      { actionId: 'nope.action', input: {} },
      ctx('u_dave'),
    );

    expect(r.ok).toBe(false);
    const data = r.data as { status: string; reasons?: string[] };
    expect(data.status).toBe('rejected');
    expect((data.reasons ?? []).join(' ')).toContain('未注册');
  });

  it('actionId 非法 → 直接拒, 不进 proposeAction', async () => {
    await seedPersona('u_dave', 'commit_short');
    const r = await skillRegistry.execute(
      'persona.propose_action',
      { actionId: '', input: {} } as never,
      ctx('u_dave'),
    );
    expect(r.ok).toBe(false);
    expect(r.error).toContain('actionId');
  });
});

describe('搭子写动作 · 起草类代行 (A 执行肢体扩面)', () => {
  it('persona.draft_report → 落 decision_draft drafted ProxyAction (24h, 待确认)', async () => {
    await seedPersona('u_rep', 'commit_short');

    const r = await skillRegistry.execute(
      'persona.draft_report',
      { title: '第 24 周周报', body: '## 进展\n- 完成 X\n## 风险\n- Y', period: '2026-W24' },
      ctx('u_rep'),
    );

    expect(r.ok).toBe(true);
    const data = r.data as { status: string; zone: string; proxyActionId?: string; draftType?: string };
    expect(data.status).toBe('drafted');
    expect(data.zone).toBe('yellow');
    expect(data.draftType).toBe('report');

    const pas = await getStore().proxyActions.list();
    expect(pas).toHaveLength(1);
    expect(pas[0].kind).toBe('decision_draft');
    expect(pas[0].status).toBe('drafted');
    expect(pas[0].refType).toBe('draft:report');
    expect(pas[0].vetoUntil).toBeTruthy();
    expect((pas[0].metadata as { period?: string })?.period).toBe('2026-W24');
  });

  it('persona.draft_action_items → 把 items 拼成编号正文', async () => {
    await seedPersona('u_ai', 'soft_opinion'); // 起草不经委托级别门槛 (非 commit 动作)

    const r = await skillRegistry.execute(
      'persona.draft_action_items',
      { title: '复盘 · 行动项', items: ['张三跟进客户A', '李四补数据'] },
      ctx('u_ai'),
    );

    expect(r.ok).toBe(true);
    expect((r.data as { status: string }).status).toBe('drafted');
    const pas = await getStore().proxyActions.list();
    expect(pas[0].body).toContain('1. 张三跟进客户A');
    expect(pas[0].body).toContain('2. 李四补数据');
    expect(pas[0].refType).toBe('draft:action_items');
  });

  it('空 items → 拒, 不落 ProxyAction', async () => {
    await seedPersona('u_ai2', 'commit_short');
    const r = await skillRegistry.execute(
      'persona.draft_action_items',
      { title: 'x', items: [] },
      ctx('u_ai2'),
    );
    expect(r.ok).toBe(false);
    expect(await getStore().proxyActions.list()).toHaveLength(0);
  });

  it('起草无本人分身 → 拒', async () => {
    const r = await skillRegistry.execute(
      'persona.draft_report',
      { title: 't', body: 'b' },
      ctx('u_nopersona2'),
    );
    expect(r.ok).toBe(false);
    expect(r.error).toContain('未找到本人分身');
  });
});

describe('搭子写动作 · shouldAct 意图门控', () => {
  it('明确"更新进度"意图 → 触发', () => {
    expect(shouldAct('帮我把销售额这个KR的进度更新到80%').trigger).toBe(true);
    expect(shouldAct('把那个指标标记成 at-risk').trigger).toBe(true);
  });

  it('起草类意图 → 触发 (draft_intent)', () => {
    expect(shouldAct('帮我起草本周周报').reason).toBe('draft_intent');
    expect(shouldAct('把这次讨论整理成行动项').reason).toBe('draft_intent');
  });

  it('提问/闲聊/无 OKR 对象 → 不触发', () => {
    expect(shouldAct('我那个KR现在怎么样?').trigger).toBe(false); // 只问不改
    expect(shouldAct('帮我更新一下文档').trigger).toBe(false); // 非 OKR 对象
    expect(shouldAct('在吗').trigger).toBe(false);
  });
});
