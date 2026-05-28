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
} from '@/lib/persona/company-brain-decision';
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
});
