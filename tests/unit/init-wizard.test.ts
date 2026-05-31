/**
 * /tandem init 冷启动 wizard 单测
 *
 * 覆盖:
 *   1. inferOkrCycleLength 4 类周期识别 (Q/H/月/年) + 空样本
 *   2. inferOkrNaming 命名规范识别 + 置信度阈值
 *   3. extractRedlinesHeuristic 关键词分级 (HARD_BLOCK / SOFT_WARN)
 *   4. runInit 全路径 (LLM 不可用 → heuristic 降级)
 *   5. runInit preExtractedRedlines 走测试快路径
 *   6. runInit 体积超限 → 截断 + warning
 *   7. runInit 输出 manifest 始终 signed=false (反 AI 偷渡治理)
 *   8. LLM 失败容错: deps.router 提供但失败 → 降级到 heuristic + warning
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { setStore, getStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import {
  runInit,
  inferOkrCycleLength,
  inferOkrNaming,
  extractRedlinesHeuristic,
  extractRedlinesViaLLM,
} from '@/lib/onboarding/init-wizard';
import type { TandemRouter } from '@/lib/taf/router';

beforeAll(() => setStore(createInMemoryStore()));

beforeEach(async () => {
  const store = getStore();
  for (const m of await store.workspaceManifests.list()) {
    await store.workspaceManifests.delete(m.id);
  }
});

// ---------------------------------------------------------------------------
// 1. inferOkrCycleLength
// ---------------------------------------------------------------------------

describe('inferOkrCycleLength', () => {
  it('空样本 → 默认 3 个月 confidence=0', () => {
    const r = inferOkrCycleLength([]);
    expect(r.value).toBe(3);
    expect(r.confidence).toBe(0);
  });

  it('多数季度 → 3 个月', () => {
    const r = inferOkrCycleLength([
      { objectiveTitle: 'O1', krs: [], cycle: '2026-Q1' },
      { objectiveTitle: 'O2', krs: [], cycle: '2026-Q2' },
      { objectiveTitle: 'O3', krs: [], cycle: '2025 quarter 4' },
    ]);
    expect(r.value).toBe(3);
    expect(r.confidence).toBe(1);
  });

  it('多数半年 → 6 个月', () => {
    const r = inferOkrCycleLength([
      { objectiveTitle: 'O1', krs: [], cycle: '2026 H1' },
      { objectiveTitle: 'O2', krs: [], cycle: '2026 H2' },
      { objectiveTitle: 'O3', krs: [], cycle: '2025 上半年' },
    ]);
    expect(r.value).toBe(6);
  });

  it('多数月度 → 1 个月', () => {
    const r = inferOkrCycleLength([
      { objectiveTitle: 'O1', krs: [], cycle: 'Sep 2026' },
      { objectiveTitle: 'O2', krs: [], cycle: 'Oct 2026' },
      { objectiveTitle: 'O3', krs: [], cycle: '2026 11月' },
    ]);
    expect(r.value).toBe(1);
  });

  it('多数年度 → 12 个月', () => {
    const r = inferOkrCycleLength([
      { objectiveTitle: 'O1', krs: [], cycle: '2026' },
      { objectiveTitle: 'O2', krs: [], cycle: '2025 year' },
    ]);
    expect(r.value).toBe(12);
  });

  it('cycle 字段全空 → 默认 3 confidence 低', () => {
    const r = inferOkrCycleLength([
      { objectiveTitle: 'O1', krs: [] },
      { objectiveTitle: 'O2', krs: [] },
    ]);
    expect(r.value).toBe(3);
    expect(r.confidence).toBeLessThan(0.5);
  });
});

// ---------------------------------------------------------------------------
// 2. inferOkrNaming
// ---------------------------------------------------------------------------

describe('inferOkrNaming', () => {
  it('多数 "O数字" 开头 → 推断标准命名', () => {
    const r = inferOkrNaming([
      { objectiveTitle: 'O1 增长', krs: [] },
      { objectiveTitle: 'O2 利润', krs: [] },
      { objectiveTitle: 'O3 招聘', krs: [] },
    ]);
    expect(r).toBeTruthy();
    expect(r!.value).toBe('O{n} / KR{n}.{m}');
    expect(r!.confidence).toBe(1);
  });

  it('置信度 < 0.5 → undefined', () => {
    const r = inferOkrNaming([
      { objectiveTitle: '增长', krs: [] },
      { objectiveTitle: '利润', krs: [] },
      { objectiveTitle: 'O3 招聘', krs: [] },
    ]);
    expect(r).toBeUndefined();
  });

  it('空样本 → undefined', () => {
    expect(inferOkrNaming([])).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 3. extractRedlinesHeuristic
// ---------------------------------------------------------------------------

describe('extractRedlinesHeuristic', () => {
  it('严禁 → HARD_BLOCK', () => {
    const r = extractRedlinesHeuristic(['严禁向第三方泄露客户数据']);
    expect(r).toHaveLength(1);
    expect(r[0].verdict).toBe('HARD_BLOCK');
    expect(r[0].title).toMatch(/严禁/);
  });

  it('禁止 → HARD_BLOCK', () => {
    const r = extractRedlinesHeuristic(['禁止在公司内部使用未审批的 AI 工具']);
    expect(r[0].verdict).toBe('HARD_BLOCK');
  });

  it('避免/尽量 → SOFT_WARN', () => {
    const r = extractRedlinesHeuristic(['避免在客户邮件中使用过度营销话术']);
    expect(r[0].verdict).toBe('SOFT_WARN');
  });

  it('鼓励/提倡 → SOFT_WARN (低权重)', () => {
    const r = extractRedlinesHeuristic(['鼓励员工持续学习并分享']);
    expect(r[0].verdict).toBe('SOFT_WARN');
  });

  it('混合分级 + 顺序保留', () => {
    const r = extractRedlinesHeuristic([
      '严禁数据外泄。鼓励透明文化。避免内卷加班。',
    ]);
    expect(r).toHaveLength(3);
    expect(r[0].verdict).toBe('HARD_BLOCK');
    expect(r[1].verdict).toBe('SOFT_WARN');
    expect(r[2].verdict).toBe('SOFT_WARN');
  });

  it('截断到 ≤ 30 条 (heuristic 上限)', () => {
    const lines = Array.from({ length: 50 }, (_, i) => `严禁规则 ${i}`).join('。');
    const r = extractRedlinesHeuristic([lines]);
    expect(r.length).toBeLessThanOrEqual(30);
  });

  it('过长句子被截到 50 字 title + 完整 rationale', () => {
    const long = '严禁' + '违反规则的行为'.repeat(20);
    const r = extractRedlinesHeuristic([long]);
    expect(r[0].title.length).toBeLessThanOrEqual(50);
    expect(r[0].title).toMatch(/\.\.\.$/);
    expect(r[0].rationale.length).toBeLessThanOrEqual(200);
  });
});

// ---------------------------------------------------------------------------
// 4-8. runInit
// ---------------------------------------------------------------------------

describe('runInit', () => {
  const baseInput = {
    tenantId: 'tenant_acme',
    initiatedBy: 'u_ceo',
    workspaceName: '事半',
    workspaceOverview: '中国民企 OKR 协作 OS',
  };

  it('preExtractedRedlines 走快路径 (跳过 LLM/heuristic)', async () => {
    const r = await runInit(
      {
        ...baseInput,
        okrSamples: [
          { objectiveTitle: 'O1 增长', krs: ['KR1 收入 +30%'], cycle: '2026-Q1' },
        ],
      },
      {
        preExtractedRedlines: [
          {
            id: 'r1',
            title: '客户数据红线',
            rationale: 'NDA 客户数据不得离开',
            triggers: ['客户名单'],
            verdict: 'HARD_BLOCK',
          },
        ],
      },
    );
    expect(r.manifest.workspaceName).toBe('事半');
    expect(r.manifest.redlines).toHaveLength(1);
    expect(r.manifest.signed).toBe(false); // 永远是草稿
    expect(r.inferences.okrCycleLengthMonths.value).toBe(3);
    expect(r.inferences.okrCycleLengthMonths.confidence).toBe(1);
    expect(r.inferences.okrNamingConvention?.value).toBe('O{n} / KR{n}.{m}');
  });

  it('无 router + 有 redlineDocuments → 走 heuristic + warning', async () => {
    const r = await runInit({
      ...baseInput,
      redlineDocuments: ['严禁向第三方泄露客户名单。'],
    });
    expect(r.manifest.redlines).toHaveLength(1);
    expect(r.manifest.redlines[0].verdict).toBe('HARD_BLOCK');
    expect(r.warnings.some((w) => w.includes('heuristic'))).toBe(true);
  });

  it('LLM 失败 → 降级到 heuristic + warning', async () => {
    const failingRouter = {
      chat: vi.fn(async () => {
        throw new Error('LLM unavailable');
      }),
    } as unknown as TandemRouter;

    const r = await runInit(
      {
        ...baseInput,
        redlineDocuments: ['严禁外发数据。'],
      },
      { router: failingRouter },
    );
    expect(r.manifest.redlines).toHaveLength(1);
    expect(r.warnings.some((w) => w.includes('LLM 红线抽取失败'))).toBe(true);
  });

  it('manifest 始终 signed=false (反 AI 偷渡治理)', async () => {
    const r = await runInit({
      ...baseInput,
      redlineDocuments: ['严禁泄露。'],
    });
    expect(r.manifest.signed).toBe(false);
    expect(r.manifest.signedByCeo).toBeUndefined();
    expect(r.manifest.signedBySteward).toBeUndefined();
  });

  it('体积超限红线 → 截到 20 + warning', async () => {
    // heuristic 上限 30, 模拟从 LLM 拿到 25 条 (在 manifest 上限 20 之上)
    const fakeLLMRouter = {
      chat: vi.fn(async () => ({
        message: {
          role: 'assistant',
          content: JSON.stringify({
            redlines: Array.from({ length: 25 }, (_, i) => ({
              id: `r${i}`,
              title: `红线${i}`,
              rationale: 'x',
              verdict: 'SOFT_WARN' as const,
              triggers: [],
            })),
          }),
        },
        usage: { promptTokens: 100, completionTokens: 50 },
        finishReason: 'stop' as const,
      })),
    } as unknown as TandemRouter;

    const r = await runInit(
      {
        ...baseInput,
        redlineDocuments: ['stub'],
      },
      { router: fakeLLMRouter },
    );
    expect(r.manifest.redlines).toHaveLength(20);
    expect(r.warnings.some((w) => w.includes('25 条红线超出上限 20'))).toBe(true);
  });

  it('manifest 写入后再 getWorkspaceManifest 能拿到 + 未签', async () => {
    await runInit({
      ...baseInput,
      vocab: [{ term: 'PE', translation: 'Product Engineer' }],
      cultureTags: ['扁平', '结果导向'],
    });
    const store = getStore();
    const list = await store.workspaceManifests.list();
    expect(list).toHaveLength(1);
    expect(list[0].vocab).toHaveLength(1);
    expect(list[0].cultureTags).toEqual(['扁平', '结果导向']);
    expect(list[0].signed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// extractRedlinesViaLLM 防御性 (filter invalid)
// ---------------------------------------------------------------------------

describe('extractRedlinesViaLLM 防御性过滤', () => {
  it('LLM 返回脏数据 (verdict 非法 / 缺字段) → filter 掉', async () => {
    const mockRouter = {
      chat: vi.fn(async () => ({
        message: {
          role: 'assistant',
          content: JSON.stringify({
            redlines: [
              { id: 'r1', title: 'OK 红线', rationale: 'x', verdict: 'HARD_BLOCK', triggers: ['a'] },
              { id: 'r2', title: '坏 verdict', rationale: 'x', verdict: 'WHATEVER', triggers: [] },
              { title: '缺 id', rationale: 'x', verdict: 'SOFT_WARN', triggers: [] },
              null,
              'string-not-obj',
            ],
          }),
        },
        usage: { promptTokens: 0, completionTokens: 0 },
        finishReason: 'stop' as const,
      })),
    } as unknown as TandemRouter;

    const result = await extractRedlinesViaLLM(['x'], mockRouter);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('r1');
  });

  it('LLM 返回 triggers 非数组 → 设为 []', async () => {
    const mockRouter = {
      chat: vi.fn(async () => ({
        message: {
          role: 'assistant',
          content: JSON.stringify({
            redlines: [
              { id: 'r1', title: 'OK', rationale: 'x', verdict: 'HARD_BLOCK', triggers: 'not-array' },
            ],
          }),
        },
        usage: { promptTokens: 0, completionTokens: 0 },
        finishReason: 'stop' as const,
      })),
    } as unknown as TandemRouter;

    const result = await extractRedlinesViaLLM(['x'], mockRouter);
    expect(result[0].triggers).toEqual([]);
  });
});
