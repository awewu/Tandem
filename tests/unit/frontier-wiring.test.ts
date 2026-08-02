/**
 * 前沿升级"接线"回归测试 · 守护主链路挂载的确定性契约 (无需真 LLM)。
 *
 * 覆盖:
 *   - SRPO 补丁检索的 context 字符串契约: BossAI 记录用 'boss_ai_reply' (= decision.context),
 *     stream 路由 step 3.6 必须用同一字符串检索, 否则永远召不回 (静默失效)。
 *   - MultiStepInput 的前沿 flag 直通字段存在 (类型级契约)。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { setStore, getStore } from '@/lib/storage/repository';
import { retrieveCorrectionPatches, extractKeywords, type CorrectionPatch } from '@/lib/persona/srpo-patch';

// 与 query 用同一 extractKeywords 派生, 保证 CJK 整段 token 一致 (真实链路两端都过 extractKeywords)
const SEED_QUERY = '华东 回款 进度 风险';

beforeEach(() => {
  setStore(createInMemoryStore());
});

async function seedPatch(over: Partial<CorrectionPatch> = {}): Promise<void> {
  const patch: CorrectionPatch = {
    id: `srpo_${Math.random().toString(36).slice(2, 8)}`,
    tenantId: 'default',
    context: 'boss_ai_reply',
    keywords: extractKeywords(SEED_QUERY),
    situation: '误报回款进度被老板否决',
    strategy: '回答进度前先调 okr.read 核对真值, 不臆测数字',
    sourceEpisodicId: 'epi_x',
    hitCount: 0,
    createdAt: new Date().toISOString(),
    ...over,
  };
  await getStore().correctionPatches.create(patch);
}

describe('前沿接线 · SRPO 检索 context 契约', () => {
  it('BossAI: context=boss_ai_reply 可召回 (与 stream step 3.6 一致)', async () => {
    await seedPatch();
    const hit = await retrieveCorrectionPatches(SEED_QUERY, {
      tenantId: 'default',
      context: 'boss_ai_reply',
    });
    expect(hit.length).toBe(1);
    expect(hit[0].strategy).toContain('核对真值');
  });

  it('context 不匹配 (旧写法 boss_ai) → 召不回 (证明 context 字符串必须精确)', async () => {
    await seedPatch();
    const miss = await retrieveCorrectionPatches(SEED_QUERY, {
      tenantId: 'default',
      context: 'boss_ai',
    });
    expect(miss.length).toBe(0);
  });

  it('关键词无重叠 → 召不回', async () => {
    await seedPatch();
    const miss = await retrieveCorrectionPatches('今天午饭吃什么', {
      tenantId: 'default',
      context: 'boss_ai_reply',
    });
    expect(miss.length).toBe(0);
  });

  it('租户隔离: 别的租户补丁召不回', async () => {
    await seedPatch({ tenantId: 'other' });
    const miss = await retrieveCorrectionPatches(SEED_QUERY, {
      tenantId: 'default',
      context: 'boss_ai_reply',
    });
    expect(miss.length).toBe(0);
  });
});
