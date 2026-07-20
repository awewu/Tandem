/**
 * ON-1 · kr.checkin Action Type + executeAction 引擎单测 (2026-06-09)
 *
 * 验证声明式动作引擎完整闭环:
 *   - submission criteria 校验 (KR 存在 / 授权 / 废弃 / 数值与信心度合法)
 *   - 动作闸 (derive-zone): 人工 owner 放行; AI 代行黄区+ fail-closed 拦截
 *   - 主写: CheckIn 落库 + KR.currentValue/confidence 同步
 *   - 声明式副作用: rollup 传播 (lineage) + kr-progressed 事件, 各自幂等 + fail-soft
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { setStore, getStore } from '@/lib/storage/repository';
import { executeAction, ensureCoreActions, type KrCheckinResult } from '@/lib/ontology';
import { eventBus } from '@/lib/events/bus';
import type { Objective, KeyResult } from '@/lib/types/okr-tti';

const NOW = '2026-06-09T00:00:00.000Z';

function obj(p: Partial<Objective> & Pick<Objective, 'id' | 'title'>): Objective {
  return {
    cycleId: 'cyc-1', level: 'team', ownerId: 'u-1', visibility: 'public',
    weight: 100, status: 'active', confidence: 'on-track', tags: [],
    collaboratorIds: [], watcherIds: [], createdAt: NOW, updatedAt: NOW, ...p,
  } as Objective;
}
function kr(p: Partial<KeyResult> & Pick<KeyResult, 'id' | 'title' | 'objectiveId'>): KeyResult {
  return {
    ownerId: 'u-1', coOwnerIds: [], measureType: 'numeric', computeMethod: 'latest',
    startValue: 0, targetValue: 100, currentValue: 0, confidence: 'on-track',
    riskStatus: 'on_track', weight: 1, status: 'active', tags: [],
    collaboratorIds: [], watcherIds: [], createdAt: NOW, updatedAt: NOW, ...p,
  } as KeyResult;
}

const HUMAN = { actorUserId: 'u-1', isProxy: false };

describe('ON-1 · kr.checkin action', () => {
  beforeEach(async () => {
    ensureCoreActions();
    const store = createInMemoryStore();
    setStore(store);
    await store.objectives.create(obj({ id: 'o-team', title: '团队目标', currentProgress: 0 }));
    await store.keyResults.create(kr({ id: 'kr-1', title: 'KR 新签', objectiveId: 'o-team', currentValue: 0 }));
  });

  it('owner check-in: 主写 + KR 同步 + rollup lineage', async () => {
    const r = await executeAction<KrCheckinResult>(
      'kr.checkin',
      { krId: 'kr-1', currentValue: 30, confidenceAfter: 'at-risk', progressBefore: 0, progressAfter: 30, achievements: '完成客户拜访' },
      HUMAN,
    );
    expect(r.ok).toBe(true);
    expect(r.result!.currentValueBefore).toBe(0);
    expect(r.result!.currentValueAfter).toBe(30);

    // KR 真同步
    const kr1 = await getStore().keyResults.get('kr-1');
    expect(kr1!.currentValue).toBe(30);
    expect(kr1!.confidence).toBe('at-risk');

    // CheckIn 落库
    const checkIns = await getStore().checkIns.list();
    expect(checkIns).toHaveLength(1);
    expect(checkIns[0].scopeId).toBe('kr-1');

    // 副作用: rollup 传播成功, lineage 含 o-team
    const rollup = r.sideEffects.find((s) => s.name === 'okr.rollup.propagate');
    expect(rollup?.ok).toBe(true);
    const lineage = rollup!.data as Array<{ objectiveId: string; to: number }>;
    expect(lineage.map((l) => l.objectiveId)).toContain('o-team');

    // 副作用: kr-progressed 事件成功
    expect(r.sideEffects.find((s) => s.name === 'okr.kr-progressed.emit')?.ok).toBe(true);

    // Objective 进度真被 rollup 重算 (0 → 0.3)
    const o = await getStore().objectives.get('o-team');
    expect(o!.currentProgress).toBeCloseTo(0.3, 5);
  });

  it('kr-progressed 事件真发出 (订阅者收到)', async () => {
    const seen: unknown[] = [];
    const off = eventBus.on('okr.kr-progressed', async (p) => { seen.push(p); });
    try {
      await executeAction('kr.checkin', { krId: 'kr-1', currentValue: 50, progressAfter: 50, achievements: '推进到 50' }, HUMAN);
    } finally {
      off();
    }
    expect(seen).toHaveLength(1);
    expect((seen[0] as { krId: string }).krId).toBe('kr-1');
  });

  it('submission criteria: KR 不存在 → not_found', async () => {
    const r = await executeAction('kr.checkin', { krId: 'nope', currentValue: 10 }, HUMAN);
    expect(r.ok).toBe(false);
    expect(r.blocked?.code).toBe('not_found');
  });

  it('submission criteria: 非 owner 非 coOwner → forbidden', async () => {
    const r = await executeAction('kr.checkin', { krId: 'kr-1', currentValue: 10 }, { actorUserId: 'stranger', isProxy: false });
    expect(r.ok).toBe(false);
    expect(r.blocked?.code).toBe('forbidden');
  });

  it('submission criteria: demo 模式放行非 owner', async () => {
    const r = await executeAction('kr.checkin', { krId: 'kr-1', currentValue: 10, achievements: 'demo 推进事项' }, { actorUserId: 'admin', isProxy: false, demo: true });
    expect(r.ok).toBe(true);
  });

  it('submission criteria: currentValue 非有限数 → invalid', async () => {
    const r = await executeAction('kr.checkin', { krId: 'kr-1', currentValue: Number.NaN }, HUMAN);
    expect(r.ok).toBe(false);
    expect(r.blocked?.code).toBe('invalid');
  });

  it('submission criteria: currentValue 为负数 → invalid', async () => {
    const r = await executeAction('kr.checkin', { krId: 'kr-1', currentValue: -1 }, HUMAN);
    expect(r.ok).toBe(false);
    expect(r.blocked?.code).toBe('invalid');
    expect(await getStore().checkIns.list()).toHaveLength(0);
  });

  it('submission criteria: 推进事项为空 → invalid', async () => {
    const r = await executeAction('kr.checkin', { krId: 'kr-1', achievements: '   ' }, HUMAN);
    expect(r.ok).toBe(false);
    expect(r.blocked?.code).toBe('invalid');
    expect(await getStore().checkIns.list()).toHaveLength(0);
  });

  it('submission criteria: 非法 confidence → invalid', async () => {
    const r = await executeAction('kr.checkin', { krId: 'kr-1', confidenceAfter: 'great' as never }, HUMAN);
    expect(r.ok).toBe(false);
    expect(r.blocked?.code).toBe('invalid');
  });

  it('submission criteria: 已废弃 KR → invalid', async () => {
    await getStore().keyResults.update('kr-1', { status: 'abandoned' });
    const r = await executeAction('kr.checkin', { krId: 'kr-1', currentValue: 10 }, HUMAN);
    expect(r.ok).toBe(false);
    expect(r.blocked?.code).toBe('invalid');
  });

  it('动作闸 fail-closed: AI 代行 (isProxy, 无 commit 委托) 被拦在 gate', async () => {
    const r = await executeAction(
      'kr.checkin',
      { krId: 'kr-1', currentValue: 30, achievements: 'AI 代行推进事项' },
      { actorUserId: 'u-1', isProxy: true, delegationLevel: 'report_only' },
    );
    expect(r.ok).toBe(false);
    expect(r.blocked?.stage).toBe('gate');
    // 主写未发生
    expect(await getStore().checkIns.list()).toHaveLength(0);
  });

  it('未注册 action → not_found, 不抛', async () => {
    const r = await executeAction('nope.action', {}, HUMAN);
    expect(r.ok).toBe(false);
    expect(r.blocked?.code).toBe('not_found');
  });

  it('只改信心度不改数值: currentValueAfter=null, KR.confidence 更新', async () => {
    const r = await executeAction<KrCheckinResult>('kr.checkin', { krId: 'kr-1', confidenceAfter: 'off-track', achievements: '风险升级' }, HUMAN);
    expect(r.ok).toBe(true);
    expect(r.result!.currentValueAfter).toBeNull();
    expect((await getStore().keyResults.get('kr-1'))!.confidence).toBe('off-track');
  });

  it('已填报 check-in 可修改: 更新原记录, 不新增记录', async () => {
    const created = await executeAction<KrCheckinResult>(
      'kr.checkin',
      { krId: 'kr-1', currentValue: 30, confidenceAfter: 'at-risk', progressBefore: 0, progressAfter: 30, achievements: '初次推进' },
      HUMAN,
    );
    expect(created.ok).toBe(true);

    const updated = await executeAction<KrCheckinResult>(
      'kr.checkin',
      {
        checkInId: created.result!.checkIn.id,
        krId: 'kr-1',
        currentValue: 45,
        confidenceAfter: 'on-track',
        progressBefore: 0,
        progressAfter: 45,
        achievements: '修改后的推进事项',
        blockers: '已解除阻碍',
        nextSteps: '继续跟进',
      },
      HUMAN,
    );

    expect(updated.ok).toBe(true);
    const checkIns = await getStore().checkIns.list();
    expect(checkIns).toHaveLength(1);
    expect(checkIns[0].id).toBe(created.result!.checkIn.id);
    expect(checkIns[0].achievements).toBe('修改后的推进事项');
    expect(checkIns[0].blockers).toBe('已解除阻碍');
    expect(checkIns[0].nextSteps).toBe('继续跟进');
    expect((await getStore().keyResults.get('kr-1'))!.currentValue).toBe(45);
  });
});
