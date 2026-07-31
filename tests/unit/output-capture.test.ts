/**
 * tests/unit/output-capture.test.ts · 产出捕获层 (#17) 真闭环 (2026-07-29)
 *
 * 固化 captureOutputPass: 用注入的假 router 驱动一次确定性知识提炼 (不打真实 LLM),
 * 验证:
 *   ① gate: 过短 / 阻断块 不触发提炼
 *   ② 提炼 → 落 MemoryCaptureCandidate 候选 (字段正确 + 宪法级类型强制 company)
 *   ③ 去重: 已有近似组织记忆时, 候选被跳过或标注 dedupOfMemoryId
 *   ④ 采纳闭环: 候选 → promoteTextToMemory → 生成 pending 三级签批 promotion
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setStore, getStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { captureOutputPass, shouldCapture } from '@/lib/memory/output-capture';
import { promoteTextToMemory } from '@/lib/services/text-promotion';
import type { MemoryEntry } from '@/lib/types/memory';

const TENANT = 'default';
const USER = 'u-capture-1';
const GLOBAL_ROUTER_KEY = '__tandem_router__';
let prevRouter: unknown;

function fakeRouter(candidatesJson: unknown) {
  return {
    chat: async () => ({
      message: { role: 'assistant', content: JSON.stringify({ candidates: candidatesJson }) },
      usage: { totalTokens: 20 },
    }),
  };
}

beforeEach(() => {
  setStore(createInMemoryStore());
  prevRouter = (globalThis as Record<string, unknown>)[GLOBAL_ROUTER_KEY];
});
afterEach(() => {
  (globalThis as Record<string, unknown>)[GLOBAL_ROUTER_KEY] = prevRouter;
});

const LONG = '本次渠道复盘总结: 每周五 17:00 更新经销商库存数据, 缺货 SKU 超过 3 个即触发补货流程, 由区域经理在 24 小时内确认。这是可复用的标准操作流程, 建议沉淀为部门规范。'.repeat(4);

describe('shouldCapture · gate', () => {
  it('过短产出不触发', () => {
    expect(shouldCapture('好的').trigger).toBe(false);
  });
  it('阻断/错误块不触发', () => {
    expect(shouldCapture('🚫 这个方向触到了公司红线, 我不能替你往下推'.repeat(4)).trigger).toBe(false);
  });
  it('含知识信号的长产出触发', () => {
    expect(shouldCapture(LONG).trigger).toBe(true);
  });
});

describe('captureOutputPass · 提炼落候选', () => {
  it('提炼出候选并落库, 宪法级类型强制 company', async () => {
    (globalThis as Record<string, unknown>)[GLOBAL_ROUTER_KEY] = fakeRouter([
      { title: '渠道库存周更 SOP', body: '每周五 17:00 更新经销商库存, 缺货>3 SKU 触发补货, 区域经理 24h 确认。', type: 'sop', level: 'dept', confidence: 0.9, rationale: '可复用流程' },
      { title: '不得虚报库存', body: '严禁向渠道虚报库存数据。', type: 'redline', level: 'team', confidence: 0.8 },
      { title: '低置信噪声', body: '今天天气不错。', type: 'lesson', level: 'team', confidence: 0.2 },
    ]);

    const res = await captureOutputPass({ text: LONG, authorUserId: USER, source: 'persona_chat', tenantId: TENANT, sessionId: 's1' });
    expect(res.captured).toBe(true);
    // 低置信 (0.2 < 0.6) 被过滤 → 保留 2 条
    expect(res.candidates).toHaveLength(2);

    const sop = res.candidates.find((c) => c.proposedType === 'sop');
    expect(sop?.suggestedLevel).toBe('dept');
    expect(sop?.status).toBe('pending');
    expect(sop?.originRef).toBe('persona_chat:s1');

    // redline 是宪法级 → 强制 company (即使模型建议 team)
    const redline = res.candidates.find((c) => c.proposedType === 'redline');
    expect(redline?.suggestedLevel).toBe('company');

    // 真落库
    const stored = await getStore().memoryCaptureCandidates.list({ authorUserId: USER } as never);
    expect(stored.filter((c) => c.status === 'pending')).toHaveLength(2);
  });

  it('去重: 已有近似组织记忆时候选被跳过或标注', async () => {
    // 预置一条与候选高度重合的组织级记忆
    await getStore().memories.create({
      type: 'sop',
      title: '渠道库存周更 SOP',
      body: '每周五 17:00 更新经销商库存, 缺货>3 SKU 触发补货, 区域经理 24h 确认。',
      status: 'active',
      ownershipLevel: 'company',
      signers: [],
      referenceCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as never);
    const seeded = (await getStore().memories.list())[0] as MemoryEntry;

    (globalThis as Record<string, unknown>)[GLOBAL_ROUTER_KEY] = fakeRouter([
      { title: '渠道库存周更 SOP', body: '每周五 17:00 更新经销商库存, 缺货>3 SKU 触发补货, 区域经理 24h 确认。', type: 'sop', level: 'dept', confidence: 0.9 },
    ]);

    const res = await captureOutputPass({ text: LONG, authorUserId: USER, source: 'persona_chat', tenantId: TENANT });
    // 去重生效: 要么跳过 (0 条), 要么入队但标注 dedupOfMemoryId
    expect(res.candidates.length === 0 || res.candidates[0].dedupOfMemoryId === seeded.id).toBe(true);
  });
});

describe('采纳闭环 · 候选 → 三级签批', () => {
  it('promoteTextToMemory 生成 pending promotion (与 accept 端点同源)', async () => {
    (globalThis as Record<string, unknown>)[GLOBAL_ROUTER_KEY] = fakeRouter([
      { title: '客户异议处理话术', body: '面对价格异议先共情再给价值锚点, 最后给限时优惠。', type: 'case', level: 'team', confidence: 0.85 },
    ]);
    const cap = await captureOutputPass({ text: LONG, authorUserId: USER, source: 'persona_chat', tenantId: TENANT });
    const cand = cap.candidates[0];
    expect(cand).toBeTruthy();

    const { promotionId } = await promoteTextToMemory({
      title: cand.title,
      body: cand.body,
      proposerId: USER,
      proposedType: cand.proposedType,
      level: cand.suggestedLevel,
      source: `capture:${cand.source}`,
      originRef: cand.originRef,
    });

    const promo = await getStore().promotions.get(promotionId);
    expect(promo).toBeTruthy();
    expect(promo!.status).toBe('pending');
    expect(promo!.level).toBe('team');
    expect(promo!.proposedTitle).toBe('客户异议处理话术');
  });
});
