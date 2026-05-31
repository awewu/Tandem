/**
 * tests/unit/company-brain-manifesto-injection.test.ts
 *
 * 锁: CompanyBrain system prompt 必须注入产品灵魂 6 条 + 战略红线 + 三元定位.
 *
 * 这是 Owner 2026-05-30 立的纪律落地: 灵魂不能只在 docs/, 必须在 LLM 上下文里.
 * 任何 PR 删掉灵魂注入 = 这测试炸 = PR 被打回.
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  STRATEGIC_RED_LINES,
  TANDEM_SOULS,
  tandemPositioningOneLiner,
} from '@/lib/product/manifesto';
import { buildCompanyBrainSystemPrompt } from '@/lib/persona/company-brain';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { getStore, setStore } from '@/lib/storage/repository';

beforeAll(() => {
  setStore(createInMemoryStore());
});

beforeEach(async () => {
  // 清理 store (前序测试可能有残留)
  const store = getStore();
  for (const m of await store.memories.list()) await store.memories.delete(m.id);
  for (const o of await store.objectives.list()) await store.objectives.delete(o.id);
  for (const kr of await store.keyResults.list()) await store.keyResults.delete(kr.id);
  for (const c of await store.cycles.list()) await store.cycles.delete(c.id);
});

describe('CompanyBrain · manifesto 注入', () => {
  it('system prompt 必须包含产品定位一句话', async () => {
    const prompt = await buildCompanyBrainSystemPrompt();
    expect(prompt).toContain(tandemPositioningOneLiner());
    // 三元 keyword 必现
    expect(prompt).toMatch(/事半/);
    expect(prompt).toMatch(/拿捏/);
    expect(prompt).toMatch(/搭子/);
  });

  it('system prompt 必须包含全部 6 条灵魂标题', async () => {
    const prompt = await buildCompanyBrainSystemPrompt();
    for (const soul of TANDEM_SOULS) {
      expect(prompt).toContain(soul.title);
    }
  });

  it('system prompt 必须包含战略红线全部条目', async () => {
    const prompt = await buildCompanyBrainSystemPrompt();
    for (const line of STRATEGIC_RED_LINES) {
      expect(prompt).toContain(line);
    }
  });

  it('身份约束必须明示"不能替员工劳动 + D 选项 humanOnly" (不变量 inv-3)', async () => {
    const prompt = await buildCompanyBrainSystemPrompt();
    expect(prompt).toMatch(/不能替员工劳动/);
    expect(prompt).toMatch(/humanOnly|D 选项/);
  });

  it('身份约束必须明示"任何建议回答服务哪个 OKR" (灵魂第 4 条)', async () => {
    const prompt = await buildCompanyBrainSystemPrompt();
    expect(prompt).toMatch(/这服务\/不服务哪个 OKR/);
  });

  it('注入顺序: 定位 → 灵魂 → 战略红线 → 身份约束 → OKR 上下文', async () => {
    const prompt = await buildCompanyBrainSystemPrompt();
    const idxPos = prompt.indexOf('【产品定位】');
    const idxSoul = prompt.indexOf('Tandem 产品灵魂 6 条');
    const idxRed = prompt.indexOf('【战略红线');
    const idxId = prompt.indexOf('【身份约束】');
    const idxOkr = prompt.indexOf('【当前 OKR 周期】');

    expect(idxPos).toBeGreaterThan(-1);
    expect(idxSoul).toBeGreaterThan(idxPos);
    expect(idxRed).toBeGreaterThan(idxSoul);
    expect(idxId).toBeGreaterThan(idxRed);
    expect(idxOkr).toBeGreaterThan(idxId);
  });
});
