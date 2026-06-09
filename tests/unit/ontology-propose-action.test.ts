/**
 * ON-2 · 中央 AI 决策调配 (proposeAction → 否决窗 → 兑现) 单测 (2026-06-09)
 *
 * 验证延迟执行闭环:
 *   - 提议黄区动作 → pending_veto, **不立即写** (否决窗内)
 *   - confirmAndMaterialize → 真写发生 (CheckIn + KR + rollup)
 *   - vetoProxyAction → 兑现被拒, 不写
 *   - reconcileOntologyActionVetoWindows → 窗口静默过 → 自动兑现真写
 *   - 提议非法动作 → rejected (不进否决队列)
 *   - 幂等: 确认两次不重复写
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { setStore, getStore } from '@/lib/storage/repository';
import {
  proposeAction,
  confirmAndMaterialize,
  reconcileOntologyActionVetoWindows,
} from '@/lib/ontology';
import { vetoProxyAction } from '@/lib/persona/proxy-actions';
import { COMPANY_BRAIN_PERSONA_ID } from '@/lib/persona/company-brain';
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

// proposer = 员工 u-1 本人的分身 (宪法 A: self-delegation)
function propose(extra?: { vetoWindowMs?: number }) {
  return proposeAction({
    actionId: 'kr.checkin',
    input: { krId: 'kr-1', currentValue: 40, confidenceAfter: 'at-risk', progressAfter: 40 },
    proposerPersonaId: 'persona_u-1',
    onBehalfOfUserId: 'u-1',
    tenantId: 'default',
    reason: '员工分身: 检测到该 KR 滞后, 代起草进度更新',
    ...extra,
  });
}

describe('ON-2 · proposeAction 决策调配', () => {
  beforeEach(async () => {
    const store = createInMemoryStore();
    setStore(store);
    await store.objectives.create(obj({ id: 'o-team', title: '团队目标', currentProgress: 0 }));
    await store.keyResults.create(kr({ id: 'kr-1', title: 'KR 新签', objectiveId: 'o-team', currentValue: 0 }));
    // 员工 u-1 本人的分身 (合法 proposer)
    await store.personas.create({
      id: 'persona_u-1', userId: 'u-1', schemaVersion: 'tandem.v1', stage: 'apprentice',
      delegationLevel: 'commit_short', styleProfile: {},
      decisionHistory: { totalDecisions: 0, selfMade: 0, aiAssisted: 0, vetoedByUser: 0, vetoRate: 0 },
    } as never);
  });

  it('提议黄区动作 (kr.checkin) → pending_veto, 否决窗内不写', async () => {
    const r = await propose();
    expect(r.status).toBe('pending_veto');
    expect(r.zone).toBe('yellow');
    expect(r.proxyActionId).toBeTruthy();

    // 关键: 真写还没发生
    expect(await getStore().checkIns.list()).toHaveLength(0);
    expect((await getStore().keyResults.get('kr-1'))!.currentValue).toBe(0);

    // ProxyAction 进了否决队列
    const pa = await getStore().proxyActions.get(r.proxyActionId!);
    expect(pa!.status).toBe('awaiting_veto');
    expect(pa!.kind).toBe('ontology_action');
  });

  it('人工确认 → 兑现真写 (CheckIn + KR + rollup)', async () => {
    const r = await propose();
    const m = await confirmAndMaterialize(r.proxyActionId!, 'manager-1');
    expect(m.ok).toBe(true);
    expect(m.execResult?.ok).toBe(true);

    // 真写已发生
    expect(await getStore().checkIns.list()).toHaveLength(1);
    expect((await getStore().keyResults.get('kr-1'))!.currentValue).toBe(40);
    // rollup 传播: Objective 0 → 0.4
    expect((await getStore().objectives.get('o-team'))!.currentProgress).toBeCloseTo(0.4, 5);
    // ProxyAction 落定
    expect((await getStore().proxyActions.get(r.proxyActionId!))!.status).toBe('executed');
  });

  it('否决 → 兑现被拒, 不写', async () => {
    const r = await propose();
    await vetoProxyAction(r.proxyActionId!, 'u-1', '数值不对');
    const m = await confirmAndMaterialize(r.proxyActionId!, 'u-1');
    expect(m.ok).toBe(false);
    expect(await getStore().checkIns.list()).toHaveLength(0);
    expect((await getStore().keyResults.get('kr-1'))!.currentValue).toBe(0);
  });

  it('否决窗静默过 → reconcile 自动兑现真写', async () => {
    const r = await propose({ vetoWindowMs: 0 }); // 立即过期
    expect(r.status).toBe('pending_veto');

    const rec = await reconcileOntologyActionVetoWindows();
    expect(rec.materialized).toBe(1);
    expect(rec.failed).toBe(0);

    expect(await getStore().checkIns.list()).toHaveLength(1);
    expect((await getStore().keyResults.get('kr-1'))!.currentValue).toBe(40);
    expect((await getStore().proxyActions.get(r.proxyActionId!))!.status).toBe('executed');
  });

  it('reconcile 不碰仍在窗口内的提议', async () => {
    await propose(); // 默认 24h 窗口
    const rec = await reconcileOntologyActionVetoWindows();
    expect(rec.materialized).toBe(0);
    expect(await getStore().checkIns.list()).toHaveLength(0);
  });

  it('提议非法动作 (KR 不存在) → rejected, 不进否决队列', async () => {
    const r = await proposeAction({
      actionId: 'kr.checkin',
      input: { krId: 'nope', currentValue: 10 },
      proposerPersonaId: 'company-brain',
      onBehalfOfUserId: 'u-1',
      tenantId: 'default',
    });
    expect(r.status).toBe('rejected');
    expect(await getStore().proxyActions.list()).toHaveLength(0);
  });

  it('提议未注册动作 → rejected', async () => {
    const r = await proposeAction({
      actionId: 'nope.action',
      input: {},
      proposerPersonaId: 'persona_u-1',
      onBehalfOfUserId: 'u-1',
      tenantId: 'default',
    });
    expect(r.status).toBe('rejected');
  });

  it('宪法 A: 中央 AI persona 作为 proposer → 硬拒, 不进队列', async () => {
    const r = await proposeAction({
      actionId: 'kr.checkin',
      input: { krId: 'kr-1', currentValue: 40 },
      proposerPersonaId: COMPANY_BRAIN_PERSONA_ID,
      onBehalfOfUserId: 'u-1',
      tenantId: 'default',
    });
    expect(r.status).toBe('rejected');
    expect(r.reasons.join('')).toContain('中央 AI');
    expect(await getStore().proxyActions.list()).toHaveLength(0);
    expect(await getStore().checkIns.list()).toHaveLength(0);
  });

  it('宪法 A: 分身替他人发起 (cross-user) → 拒', async () => {
    const r = await proposeAction({
      actionId: 'kr.checkin',
      input: { krId: 'kr-1', currentValue: 40 },
      proposerPersonaId: 'persona_u-1', // u-1 的分身
      onBehalfOfUserId: 'u-2',           // 却想替 u-2 发起
      tenantId: 'default',
    });
    expect(r.status).toBe('rejected');
    expect(r.reasons.join('')).toContain('self-delegation');
  });

  it('proposer 分身不存在 → 拒', async () => {
    const r = await proposeAction({
      actionId: 'kr.checkin',
      input: { krId: 'kr-1', currentValue: 40 },
      proposerPersonaId: 'persona_ghost',
      onBehalfOfUserId: 'ghost',
      tenantId: 'default',
    });
    expect(r.status).toBe('rejected');
  });

  it('幂等: 兑现后再确认不重复写', async () => {
    const r = await propose();
    await confirmAndMaterialize(r.proxyActionId!, 'manager-1');
    const second = await confirmAndMaterialize(r.proxyActionId!, 'manager-1');
    expect(second.ok).toBe(true);
    // 仍只有一条 check-in
    expect(await getStore().checkIns.list()).toHaveLength(1);
  });
});
