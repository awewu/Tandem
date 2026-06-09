/**
 * tests/unit/reflexion.test.ts · B-024 真学习 (Reflexion) 锁
 *
 *   1. detectReflexionTrigger: VETO / 弃用改 D / 复盘 → 有信号; 普通 COMMIT → null
 *   2. reflectOnDecision: VETO → 落库个人 episodic lesson (tag=reflexion)
 *   3. 无信号 / 无 active persona → reflected=false, 不落库
 *   4. retrievePersonaSelfHints: 按 user + tag 过滤并排序
 *   5. injectSelfHints: 注入到 systemPrompt
 *   6. fail-soft: router 抛错不抛
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setStore, getStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import type { DecisionCard } from '@/lib/types/decision-card';

const USER = 'user_alice';
const G = globalThis as unknown as { __tandem_router__?: unknown };

function installFakeRouter(lesson = '我主推的 B 选项低估了预算风险', hint = '涉及预算>10万先核 ROI 再提交') {
  G.__tandem_router__ = {
    chat: async () => ({
      id: 'fake',
      message: { role: 'assistant', content: JSON.stringify({ lesson, hint }) },
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    }),
    listProviders: () => ['fake'],
    healthCheckAll: async () => ({}),
  };
}

async function seedPersona(learningActive = true): Promise<void> {
  await getStore().personas.create({
    id: 'persona_alice',
    userId: USER,
    learningActive,
    stage: 'apprentice',
    delegationLevel: 'draft_only',
    styleProfile: {},
    decisionHistory: { totalDecisions: 0, selfMade: 0, aiAssisted: 0, vetoedByUser: 0, vetoRate: 0 },
  } as never);
}

function makeCard(over: Partial<DecisionCard> = {}): DecisionCard {
  return {
    id: 'dc1',
    schemaVersion: 'tandem.v1',
    title: '是否上线新功能',
    decisionClass: 'simple',
    convergenceState: 'COMMIT',
    elapsedSeconds: 60,
    options: [
      { id: 'A', type: 'SOP', description: 'A 方案', confidence: 0.5, risk: 'low' },
      { id: 'B', type: 'AGENT_REASONING', description: 'B 方案', reasoning: '推演', confidence: 0.6, risk: 'medium' },
    ],
    actionItems: [],
    createdBy: USER,
    createdAt: new Date().toISOString(),
    watermark: { isProxy: true },
    ...over,
  } as DecisionCard;
}

beforeEach(() => {
  setStore(createInMemoryStore());
  installFakeRouter();
});

describe('B-024 · detectReflexionTrigger', () => {
  it('VETOED → veto', async () => {
    const { detectReflexionTrigger } = await import('@/lib/persona/reflexion');
    expect(detectReflexionTrigger(makeCard({ convergenceState: 'VETOED' }))).toBe('veto');
  });

  it('COMMIT + selected D (有 AI 选项) → rejected_for_original', async () => {
    const { detectReflexionTrigger } = await import('@/lib/persona/reflexion');
    const card = makeCard({ selected: 'D', convergenceState: 'COMMIT' });
    expect(detectReflexionTrigger(card)).toBe('rejected_for_original');
  });

  it('复盘回填 learning → retrospective', async () => {
    const { detectReflexionTrigger } = await import('@/lib/persona/reflexion');
    const card = makeCard({ retrospective: { reviewAt: 't', learning: '上线后回滚了' } });
    expect(detectReflexionTrigger(card)).toBe('retrospective');
  });

  it('普通 COMMIT (选 B, 无复盘) → null', async () => {
    const { detectReflexionTrigger } = await import('@/lib/persona/reflexion');
    expect(detectReflexionTrigger(makeCard({ selected: 'B' }))).toBeNull();
  });
});

describe('B-024 · reflectOnDecision', () => {
  it('VETO → 落库个人 episodic lesson (tag=reflexion)', async () => {
    await seedPersona();
    const { reflectOnDecision } = await import('@/lib/persona/reflexion');
    const r = await reflectOnDecision(makeCard({ convergenceState: 'VETOED' }));

    expect(r.reflected).toBe(true);
    expect(r.trigger).toBe('veto');
    expect(r.hint).toContain('ROI');

    const mems = await getStore().memories.list();
    const lesson = mems.find((m) => m.id === r.memoryId);
    expect(lesson).toBeTruthy();
    expect(lesson?.type).toBe('lesson');
    expect(lesson?.kind).toBe('episodic');
    expect(lesson?.ownershipLevel).toBe('personal');
    expect(lesson?.ownerUserId).toBe(USER);
    expect(lesson?.tags).toContain('reflexion');
  });

  it('无结果信号 → reflected=false, 不落库', async () => {
    await seedPersona();
    const { reflectOnDecision } = await import('@/lib/persona/reflexion');
    const r = await reflectOnDecision(makeCard({ selected: 'B' }));
    expect(r.reflected).toBe(false);
    expect((await getStore().memories.list()).length).toBe(0);
  });

  it('无 active persona → reflected=false', async () => {
    await seedPersona(false);
    const { reflectOnDecision } = await import('@/lib/persona/reflexion');
    const r = await reflectOnDecision(makeCard({ convergenceState: 'VETOED' }));
    expect(r.reflected).toBe(false);
    expect(r.reason).toBe('no-active-persona');
  });

  it('router 抛错 → fail-soft, 不抛', async () => {
    await seedPersona();
    G.__tandem_router__ = { chat: async () => { throw new Error('boom'); }, listProviders: () => [], healthCheckAll: async () => ({}) };
    const { reflectOnDecision } = await import('@/lib/persona/reflexion');
    const r = await reflectOnDecision(makeCard({ convergenceState: 'VETOED' }));
    expect(r.reflected).toBe(false);
    expect(r.reason).toContain('exception');
  });
});

describe('B-024 · retrieve + inject self-hints', () => {
  it('按 user + tag 过滤并注入 systemPrompt', async () => {
    await seedPersona();
    const { reflectOnDecision, retrievePersonaSelfHints, injectSelfHints } = await import('@/lib/persona/reflexion');
    await reflectOnDecision(makeCard({ title: '预算审批流程', convergenceState: 'VETOED' }));

    const hints = await retrievePersonaSelfHints(USER, '预算 ROI 怎么算', 3);
    expect(hints.length).toBe(1);

    const inj = await injectSelfHints('基线 prompt', USER, '预算 ROI 怎么算');
    expect(inj.hintCount).toBe(1);
    expect(inj.revisedSystemPrompt).toContain('自省教训');
    expect(inj.revisedSystemPrompt).toContain('基线 prompt');
  });

  it('别的员工的自省不串台', async () => {
    await seedPersona();
    const { reflectOnDecision, retrievePersonaSelfHints } = await import('@/lib/persona/reflexion');
    await reflectOnDecision(makeCard({ convergenceState: 'VETOED' }));

    const hints = await retrievePersonaSelfHints('user_other', '随便问', 3);
    expect(hints.length).toBe(0);
  });

  it('无自省 → injectSelfHints 原样返回', async () => {
    const { injectSelfHints } = await import('@/lib/persona/reflexion');
    const inj = await injectSelfHints('基线 prompt', USER, '随便问');
    expect(inj.hintCount).toBe(0);
    expect(inj.revisedSystemPrompt).toBe('基线 prompt');
  });
});
