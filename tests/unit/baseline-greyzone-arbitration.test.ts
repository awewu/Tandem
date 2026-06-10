/**
 * tests/unit/baseline-greyzone-arbitration.test.ts · S3/CA-2 灰区 LLM 仲裁锁
 *
 * 验证 checkBaseline 对"公司级记忆命中、相似度落 [softWarn=0.2, hardBlock=0.45) 灰区"
 * 的处理: 旧逻辑一律 SOFT_WARN; 新逻辑跑 LLM 仲裁可升级 HARD_BLOCK / 降级 PASS / 维持。
 *
 *   1. 仲裁 HARD_BLOCK → verdict 升级 + requireHumanConfirm + arbitration 字段
 *   2. 仲裁 PASS       → verdict 降级到 PASS
 *   3. env=off          → 退回纯启发式 SOFT_WARN, 无 arbitration
 *   4. router 抛错      → fail-soft, 保留启发式 SOFT_WARN
 *   5. 无灰区命中 (无公司级记忆) → PASS, 不触发仲裁
 *
 * 设计: 用纯英文 token 让 Jaccard 相似度可复现 —— intent {alpha,beta} vs 公司记忆
 * 6 token (alpha beta gamma delta epsilon zeta) → inter=2/union=6 = 0.333 (灰区)。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setStore, getStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { checkBaseline } from '@/lib/memory/baseline-guard';
import { listDecisions } from '@/lib/persona/company-brain-decision';
import type { MemoryEntry } from '@/lib/types/memory';

const G = globalThis as unknown as { __tandem_router__?: unknown };

function installFakeRouter(verdict: 'PASS' | 'SOFT_WARN' | 'HARD_BLOCK', rationale = 'r') {
  G.__tandem_router__ = {
    chat: async () => ({
      id: 'fake',
      message: { role: 'assistant', content: JSON.stringify({ verdict, rationale }) },
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    }),
    listProviders: () => ['fake'],
    healthCheckAll: async () => ({}),
  };
}

function installThrowingRouter() {
  G.__tandem_router__ = {
    chat: async () => {
      throw new Error('boom');
    },
    listProviders: () => ['fake'],
    healthCheckAll: async () => ({}),
  };
}

async function seedCompanyGreyMemory(): Promise<void> {
  const now = new Date().toISOString();
  const entry: MemoryEntry = {
    id: 'mem_company_redline',
    type: 'redline',
    title: 'alpha',
    body: 'beta gamma delta epsilon zeta',
    status: 'active',
    signers: [],
    ownershipLevel: 'company',
    referenceCount: 0,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  } as MemoryEntry;
  await getStore().memories.create(entry as never);
}

const INTENT = 'alpha beta';

beforeEach(() => {
  setStore(createInMemoryStore());
  delete process.env.BASELINE_GREYZONE_ARBITRATION;
});

afterEach(() => {
  delete G.__tandem_router__;
  delete process.env.BASELINE_GREYZONE_ARBITRATION;
});

describe('S3/CA-2 · 灰区 LLM 仲裁', () => {
  it('仲裁 HARD_BLOCK → 升级 verdict + requireHumanConfirm + arbitration 字段', async () => {
    await seedCompanyGreyMemory();
    installFakeRouter('HARD_BLOCK', '该意图直接执行了公司红线禁止的动作');

    const d = await checkBaseline({ intent: INTENT, actorUserId: 'u_alice', agentKind: 'persona' });

    expect(d.verdict).toBe('HARD_BLOCK');
    expect(d.requireHumanConfirm).toBe(true);
    expect(d.arbitration?.verdict).toBe('HARD_BLOCK');
    expect(d.arbitration?.memoryIds).toContain('mem_company_redline');
    expect(d.reasons.some((r) => r.includes('灰区 LLM 仲裁'))).toBe(true);
  });

  it('仲裁 PASS → 降级到 PASS (减少误扰)', async () => {
    await seedCompanyGreyMemory();
    installFakeRouter('PASS', '仅话题相关, 不构成违反');

    const d = await checkBaseline({ intent: INTENT, actorUserId: 'u_alice', agentKind: 'persona' });

    expect(d.verdict).toBe('PASS');
    expect(d.arbitration?.verdict).toBe('PASS');
  });

  it('env=off → 退回纯启发式 SOFT_WARN, 无 arbitration', async () => {
    await seedCompanyGreyMemory();
    installFakeRouter('HARD_BLOCK'); // 即使 router 会判 HARD, 开关关掉也不调用
    process.env.BASELINE_GREYZONE_ARBITRATION = 'off';

    const d = await checkBaseline({ intent: INTENT, actorUserId: 'u_alice', agentKind: 'persona' });

    expect(d.verdict).toBe('SOFT_WARN');
    expect(d.arbitration).toBeUndefined();
  });

  it('router 抛错 → fail-soft, 保留启发式 SOFT_WARN', async () => {
    await seedCompanyGreyMemory();
    installThrowingRouter();

    const d = await checkBaseline({ intent: INTENT, actorUserId: 'u_alice', agentKind: 'persona' });

    expect(d.verdict).toBe('SOFT_WARN');
    expect(d.arbitration).toBeUndefined();
  });

  it('无公司级灰区命中 → PASS, 不触发仲裁', async () => {
    installFakeRouter('HARD_BLOCK');
    const d = await checkBaseline({ intent: 'totally unrelated query xyz', actorUserId: 'u_alice', agentKind: 'persona' });
    expect(d.verdict).toBe('PASS');
    expect(d.arbitration).toBeUndefined();
  });

  // §CA-13 闭环 · 灰区仲裁落 decision (2026-06-09)
  it('仲裁命中 → 落地一条 baseline_arbitration CA-13 决策 (refId=checkId)', async () => {
    await seedCompanyGreyMemory();
    installFakeRouter('HARD_BLOCK', '违反公司红线');

    const d = await checkBaseline({ intent: INTENT, actorUserId: 'u_alice', agentKind: 'persona' });

    const decisions = await listDecisions({ context: 'baseline_arbitration' });
    expect(decisions.length).toBe(1);
    const rec = decisions[0];
    expect(rec.refId).toBe(d.checkId);
    expect(rec.refType).toBe('baseline_check');
    expect(rec.feedback.outcome).toBe('pending');
    expect(rec.outputSummary).toContain('HARD_BLOCK');
    expect(rec.inputSummary).toContain('SOFT_WARN→HARD_BLOCK'); // 启发式 vs 仲裁前后
    expect(rec.retrievedMemoryIds).toContain('mem_company_redline');
  });

  it('env=off → 不落 baseline_arbitration 决策 (没仲裁就没记录)', async () => {
    await seedCompanyGreyMemory();
    installFakeRouter('HARD_BLOCK');
    process.env.BASELINE_GREYZONE_ARBITRATION = 'off';

    await checkBaseline({ intent: INTENT, actorUserId: 'u_alice', agentKind: 'persona' });

    const decisions = await listDecisions({ context: 'baseline_arbitration' });
    expect(decisions.length).toBe(0);
  });
});
