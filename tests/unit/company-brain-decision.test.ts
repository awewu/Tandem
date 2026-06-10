/**
 * §CA-13 (CENTRAL-AI-ARCHITECTURE.md) · CompanyBrain Decision 闭环 e2e
 *
 * record → list → setFeedback → metrics
 */
import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {
  recordDecision,
  setFeedback,
  listDecisions,
  markStaleDecisionsIgnored,
  recordMeetingAdviceOutcome,
  getDecisionByRefId,
} from '@/lib/persona/company-brain-decision';
import type { DecisionCard } from '@/lib/types/decision-card';
import { computeMetrics } from '@/lib/persona/company-brain-metrics';
import { getStore, setStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';

beforeAll(() => {
  setStore(createInMemoryStore());
});

async function reset() {
  const store = getStore();
  const all = await store.companyBrainDecisions.list();
  for (const d of all) {
    await store.companyBrainDecisions.delete(d.id);
  }
}

describe('CompanyBrain Decision · CA-13 闭环', () => {
  beforeEach(async () => {
    await reset();
  });

  it('recordDecision 落地一条 pending 决策', async () => {
    const d = await recordDecision({
      context: 'im_reply',
      inputSummary: '客户询问退款政策',
      outputSummary: '根据公司政策, 14 天内可全额退款',
      modelUsed: 'claude-opus-4-5',
      providerUsed: 'anthropic',
      scenario: 'reasoning_complex',
      tokensIn: 100,
      tokensOut: 50,
      costMicroUsd: 1500,
      latencyMs: 800,
      aiTraceId: 'imtrace_test_1',
      refId: 'msg_test_1',
      refType: 'im_message',
    });
    expect(d).not.toBeNull();
    expect(d!.feedback.outcome).toBe('pending');
    expect(d!.context).toBe('im_reply');
    expect(d!.refId).toBe('msg_test_1');
  });

  it('setFeedback 把 pending 转为 adopted', async () => {
    const d = await recordDecision({
      context: 'im_reply',
      inputSummary: '问题 A',
      outputSummary: '答复 A',
      modelUsed: 'claude-opus-4-5',
      providerUsed: 'anthropic',
      scenario: 'reasoning_complex',
      tokensIn: 50,
      tokensOut: 30,
      costMicroUsd: 800,
      latencyMs: 500,
    });
    const updated = await setFeedback(d!.id, {
      outcome: 'adopted',
      feedbackBy: 'user_alice',
    });
    expect(updated!.feedback.outcome).toBe('adopted');
    expect(updated!.feedback.feedbackBy).toBe('user_alice');
    expect(updated!.feedback.feedbackAt).toBeDefined();
  });

  it('setFeedback overruled 带 reason 截断 ≤ 500', async () => {
    const d = await recordDecision({
      context: 'im_reply',
      inputSummary: '客户投诉',
      outputSummary: '建议立刻退款',
      modelUsed: 'claude-opus-4-5',
      providerUsed: 'anthropic',
      scenario: 'reasoning_complex',
      tokensIn: 100,
      tokensOut: 80,
      costMicroUsd: 2000,
      latencyMs: 900,
    });
    const longReason = '这建议不对'.repeat(200); // 1200 字
    const updated = await setFeedback(d!.id, {
      outcome: 'overruled',
      feedbackBy: 'champion_bob',
      reason: longReason,
    });
    expect(updated!.feedback.outcome).toBe('overruled');
    expect(updated!.feedback.reason!.length).toBeLessThanOrEqual(500);
  });

  it('listDecisions 按 context + outcome filter', async () => {
    await recordDecision({
      context: 'im_reply',
      inputSummary: 'A',
      outputSummary: 'a',
      modelUsed: 'm',
      providerUsed: 'p',
      scenario: 's',
      tokensIn: 1,
      tokensOut: 1,
      costMicroUsd: 1,
      latencyMs: 1,
    });
    const meeting = await recordDecision({
      context: 'meeting_advice',
      inputSummary: 'B',
      outputSummary: 'b',
      modelUsed: 'm',
      providerUsed: 'p',
      scenario: 's',
      tokensIn: 1,
      tokensOut: 1,
      costMicroUsd: 1,
      latencyMs: 1,
    });
    await setFeedback(meeting!.id, { outcome: 'adopted', feedbackBy: 'u' });

    const imOnly = await listDecisions({ context: 'im_reply' });
    expect(imOnly.length).toBe(1);
    expect(imOnly[0].context).toBe('im_reply');

    const adopted = await listDecisions({ outcome: 'adopted' });
    expect(adopted.length).toBe(1);
    expect(adopted[0].context).toBe('meeting_advice');

    const pendingIm = await listDecisions({ context: 'im_reply', outcome: 'pending' });
    expect(pendingIm.length).toBe(1);
  });

  it('markStaleDecisionsIgnored 把超期 pending 标 ignored', async () => {
    // 手工塞 1 条 8 天前的 pending decision
    const store = getStore();
    const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    await store.companyBrainDecisions.create({
      id: 'cbd_stale_1',
      createdAt: oldDate,
      tenantId: 'default',
      context: 'im_reply',
      inputSummary: 'stale',
      retrievedMemoryIds: [],
      outputSummary: 'stale answer',
      modelUsed: 'm',
      providerUsed: 'p',
      scenario: 's',
      tokensIn: 0,
      tokensOut: 0,
      costMicroUsd: 0,
      latencyMs: 0,
      feedback: { outcome: 'pending' },
      brainVersion: 1,
    });
    const r = await markStaleDecisionsIgnored(7);
    expect(r.ignored).toBeGreaterThanOrEqual(1);
    const stale = await store.companyBrainDecisions.get('cbd_stale_1');
    expect(stale!.feedback.outcome).toBe('ignored');
    expect(stale!.feedback.reason).toContain('7 天无反馈');
  });

  it('computeMetrics 算采纳率/推翻率', async () => {
    // 3 条: 1 adopted, 1 overruled, 1 pending
    const d1 = await recordDecision({
      context: 'im_reply',
      inputSummary: 'A', outputSummary: 'a', modelUsed: 'm', providerUsed: 'p',
      scenario: 's', tokensIn: 10, tokensOut: 10, costMicroUsd: 100, latencyMs: 100,
    });
    const d2 = await recordDecision({
      context: 'im_reply',
      inputSummary: 'B', outputSummary: 'b', modelUsed: 'm', providerUsed: 'p',
      scenario: 's', tokensIn: 10, tokensOut: 10, costMicroUsd: 200, latencyMs: 200,
    });
    await recordDecision({
      context: 'im_reply',
      inputSummary: 'C', outputSummary: 'c', modelUsed: 'm', providerUsed: 'p',
      scenario: 's', tokensIn: 10, tokensOut: 10, costMicroUsd: 300, latencyMs: 300,
    });
    await setFeedback(d1!.id, { outcome: 'adopted', feedbackBy: 'u' });
    await setFeedback(d2!.id, { outcome: 'overruled', feedbackBy: 'u', reason: 'no good' });

    const report = await computeMetrics({ windowDays: 30 });
    expect(report.overall.total).toBe(3);
    expect(report.overall.adopted).toBe(1);
    expect(report.overall.overruled).toBe(1);
    expect(report.overall.pending).toBe(1);
    // adoption rate = 1 / (3-1) = 0.5
    expect(report.overall.adoptionRate).toBeCloseTo(0.5);
    expect(report.overall.overruleRate).toBeCloseTo(0.5);
    // avg cost = 200 micro
    expect(report.overall.avgCostMicroUsd).toBe(200);
    expect(report.overall.avgLatencyMs).toBe(200);
  });

  // §2026-06-09 · BossAI 灵魂入口接入 CA-13 飞轮
  it('boss_ai_reply 上下文落地 + listDecisions 可过滤', async () => {
    const d = await recordDecision({
      context: 'boss_ai_reply',
      inputSummary: '我现在该聚焦哪个 KR?',
      outputSummary: '优先 KR-2, R&D 那条已 at-risk',
      modelUsed: 'claude-opus-4-5',
      providerUsed: 'anthropic',
      scenario: 'reasoning_complex',
      tokensIn: 100,
      tokensOut: 80,
      costMicroUsd: 1500,
      latencyMs: 4200,
      aiTraceId: 'sess_abc',
      refId: 'sess_abc',
      refType: 'boss_ai_session',
    });
    expect(d).not.toBeNull();
    expect(d!.context).toBe('boss_ai_reply');
    expect(d!.refType).toBe('boss_ai_session');
    expect(d!.feedback.outcome).toBe('pending');

    const bossOnly = await listDecisions({ context: 'boss_ai_reply' });
    expect(bossOnly.length).toBe(1);
    expect(bossOnly[0].id).toBe(d!.id);
  });

  it('computeMetrics 在 byContext 里包含 boss_ai_reply bucket', async () => {
    // 一条 BossAI + 一条 IM, 验证两个 context 都被聚合 (不互相吃)
    await recordDecision({
      context: 'boss_ai_reply',
      inputSummary: 'Q1', outputSummary: 'A1', modelUsed: 'm', providerUsed: 'p',
      scenario: 's', tokensIn: 1, tokensOut: 1, costMicroUsd: 1, latencyMs: 1,
    });
    await recordDecision({
      context: 'im_reply',
      inputSummary: 'Q2', outputSummary: 'A2', modelUsed: 'm', providerUsed: 'p',
      scenario: 's', tokensIn: 1, tokensOut: 1, costMicroUsd: 1, latencyMs: 1,
    });

    const report = await computeMetrics({ windowDays: 30 });
    expect(report.overall.total).toBe(2);
    expect(report.byContext.boss_ai_reply).toBeDefined();
    expect(report.byContext.boss_ai_reply.total).toBe(1);
    expect(report.byContext.im_reply.total).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// §CA-13 议事闭环 · recordMeetingAdviceOutcome (选项采纳信号自动回灤)
// ---------------------------------------------------------------------------

function buildCard(selected?: 'A' | 'B' | 'C' | 'D'): DecisionCard {
  return {
    id: `card_${Math.random().toString(36).slice(2, 10)}`,
    schemaVersion: 'tandem.v1',
    title: '是否引入新供应商',
    decisionClass: 'complex',
    convergenceState: 'COMMIT',
    elapsedSeconds: 120,
    options: [
      { id: 'A', type: 'SOP', description: '按采购 SOP 走', confidence: 0.6, risk: 'low', citedMemory: ['mem_sop_1'] },
      { id: 'B', type: 'AGENT_REASONING', description: 'AI 推演: 分两批试单', reasoning: '降低风险', confidence: 0.8, risk: 'medium', citedMemory: ['mem_case_1'] },
      { id: 'C', type: 'HISTORICAL', description: '参考去年案例', confidence: 0.5, risk: 'medium' },
      { id: 'D', type: 'ORIGINAL', description: '员工原创方案', confidence: 0, risk: 'medium', humanOnly: true, novelInsight: '自建产线' },
    ],
    selected,
    actionItems: [],
    createdBy: 'u_creator',
    createdAt: new Date().toISOString(),
    watermark: { isProxy: false },
  };
}

describe('CompanyBrain Decision · CA-13 议事闭环 (meeting outcome)', () => {
  beforeEach(async () => {
    await reset();
  });

  it('选 B (AI 推演) → adopted, 落 meeting_advice + 立即反馈', async () => {
    const card = buildCard('B');
    const d = await recordMeetingAdviceOutcome(card, { decidedBy: 'u1' });
    expect(d).not.toBeNull();
    expect(d!.context).toBe('meeting_advice');
    expect(d!.refId).toBe(card.id);
    expect(d!.feedback.outcome).toBe('adopted');
    expect(d!.outputSummary).toContain('AI 推演');
    expect(d!.retrievedMemoryIds).toContain('mem_case_1');
  });

  it('选 D (员工原创) → overruled', async () => {
    const d = await recordMeetingAdviceOutcome(buildCard('D'), { decidedBy: 'u1' });
    expect(d!.feedback.outcome).toBe('overruled');
  });

  it('选 A (SOP) / C (历史) → modified', async () => {
    const a = await recordMeetingAdviceOutcome(buildCard('A'), { decidedBy: 'u1' });
    expect(a!.feedback.outcome).toBe('modified');
    const c = await recordMeetingAdviceOutcome(buildCard('C'), { decidedBy: 'u1' });
    expect(c!.feedback.outcome).toBe('modified');
  });

  it('无选择且未否决 → 跳过 (null)', async () => {
    const d = await recordMeetingAdviceOutcome(buildCard(undefined), { decidedBy: 'u1' });
    expect(d).toBeNull();
  });

  it('VETO 翻转既有决策为 overruled, 不重复落条 (同卡单计)', async () => {
    const card = buildCard('B');
    // COMMIT: 先记一条 adopted
    await recordMeetingAdviceOutcome(card, { decidedBy: 'u1' });
    // VETO: 翻转为 overruled
    const vetoed = await recordMeetingAdviceOutcome(card, { decidedBy: 'u2', vetoed: true });
    expect(vetoed!.feedback.outcome).toBe('overruled');

    // 同卡只应有 1 条 meeting_advice 决策
    const all = await listDecisions({ context: 'meeting_advice', tenantId: 'default' });
    const sameCard = all.filter((x) => x.refId === card.id);
    expect(sameCard.length).toBe(1);
    const latest = await getDecisionByRefId(card.id, 'decision_card');
    expect(latest!.feedback.outcome).toBe('overruled');
    expect(latest!.feedback.feedbackBy).toBe('u2');
  });
});
