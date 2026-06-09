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

function installFakeRouter(
  lesson = '我主推的 B 选项低估了预算风险',
  hint = '涉及预算>10万先核 ROI 再提交',
  category = 'judgment',
  skillId = '',
) {
  G.__tandem_router__ = {
    chat: async () => ({
      id: 'fake',
      message: { role: 'assistant', content: JSON.stringify({ lesson, hint, category, skillId }) },
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

describe('B-024 · 结构化反推 (category + skillId)', () => {
  it('LLM 给 category=skill_misuse + skillId → 落库 tags 含 category:skill_misuse + skill:web.search', async () => {
    await seedPersona();
    installFakeRouter('我不该调 web.search 解算预算', '此类问题用 okr.health_digest', 'skill_misuse', 'web.search');
    const { reflectOnDecision } = await import('@/lib/persona/reflexion');

    const r = await reflectOnDecision(makeCard({ convergenceState: 'VETOED' }));
    expect(r.reflected).toBe(true);
    expect(r.category).toBe('skill_misuse');
    expect(r.skillId).toBe('web.search');

    const mem = (await getStore().memories.list()).find((m) => m.id === r.memoryId);
    expect(mem?.tags).toContain('category:skill_misuse');
    expect(mem?.tags).toContain('skill:web.search');
    expect(mem?.body).toContain('skill=web.search');
  });

  it('LLM 给非法 category → 兜底 other', async () => {
    await seedPersona();
    installFakeRouter('lesson', 'hint', 'banana_split' as never);
    const { reflectOnDecision } = await import('@/lib/persona/reflexion');
    const r = await reflectOnDecision(makeCard({ convergenceState: 'VETOED' }));
    expect(r.category).toBe('other');
  });

  it('analyzeReflexionPatterns: 聚合 byCategory 与 skillMisuseCounts', async () => {
    await seedPersona();
    const { reflectOnDecision, analyzeReflexionPatterns } = await import('@/lib/persona/reflexion');

    // 3 次 web.search 误用 + 1 次 okr_drift + 1 次 judgment
    installFakeRouter('a', 'h', 'skill_misuse', 'web.search');
    await reflectOnDecision(makeCard({ id: 'd1', convergenceState: 'VETOED', title: 'c1' }));
    await reflectOnDecision(makeCard({ id: 'd2', convergenceState: 'VETOED', title: 'c2' }));
    await reflectOnDecision(makeCard({ id: 'd3', convergenceState: 'VETOED', title: 'c3' }));

    installFakeRouter('a', 'h', 'okr_drift', '');
    await reflectOnDecision(makeCard({ id: 'd4', convergenceState: 'VETOED', title: 'c4' }));

    installFakeRouter('a', 'h', 'judgment', '');
    await reflectOnDecision(makeCard({ id: 'd5', convergenceState: 'VETOED', title: 'c5' }));

    const sum = await analyzeReflexionPatterns(USER, 30);
    expect(sum.total).toBe(5);
    expect(sum.byCategory.skill_misuse).toBe(3);
    expect(sum.byCategory.okr_drift).toBe(1);
    expect(sum.byCategory.judgment).toBe(1);
    expect(sum.skillMisuseCounts).toEqual([{ skillId: 'web.search', count: 3 }]);
  });

  it('analyzeReflexionPatterns: 别的员工不串台 + 空 → 空 summary', async () => {
    const { analyzeReflexionPatterns } = await import('@/lib/persona/reflexion');
    const sum = await analyzeReflexionPatterns('user_ghost', 30);
    expect(sum.total).toBe(0);
    expect(sum.byCategory.skill_misuse).toBe(0);
    expect(sum.skillMisuseCounts).toEqual([]);
  });

  it('analyzeReflexionPatterns: 旧自省超出窗口被排除', async () => {
    await seedPersona();
    const store = getStore();
    // 直接塞一条 31 天前的 reflexion memory
    await store.memories.create({
      id: 'old1',
      type: 'lesson',
      kind: 'episodic',
      title: '旧自省',
      body: 'b',
      status: 'active',
      signers: [],
      ownershipLevel: 'personal',
      ownerUserId: USER,
      referenceCount: 0,
      tags: ['reflexion', 'category:skill_misuse', 'skill:old.tool'],
      isActive: true,
      createdAt: new Date(Date.now() - 31 * 86400_000).toISOString(),
      updatedAt: new Date(Date.now() - 31 * 86400_000).toISOString(),
    } as never);

    const { analyzeReflexionPatterns } = await import('@/lib/persona/reflexion');
    const sum = await analyzeReflexionPatterns(USER, 30);
    expect(sum.total).toBe(0);
  });
});

// 抑制 vitest 'vi imported but unused' (保留以便后续扩展时随手 mock)
void vi;
