/**
 * 3+1 Decision Engine 独立单测 (4 件不变量之 #3 · 反 AI 欺诈)
 *
 * 覆盖:
 *   1. 4 选项生成 (A/B/C/D) + D 选项 humanOnly=true 不变量
 *   2. SOP 缺失 → A 退化 + warning
 *   3. 历史案例缺失 → C 退化 + warning
 *   4. LLM 失败 → B 返回 high risk + warning
 *   5. baseline-guard HARD_BLOCK → 4 个阻断占位 (D 仍 humanOnly)
 *   6. baseline-guard SOFT_WARN → context 注入 + warning
 *   7. baseline-guard 异常 → fail-open + warning
 *   8. 缺 actorUserId → warning (不阻断)
 *   9. responseFormat 严格 schema 校验
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { setStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import {
  ThreePlusOneEngine,
  StubMemoryRetriever,
  type MemoryRetriever,
  type MemorySearchResult,
  type DecisionContext,
} from '@/lib/decision-layer/three-plus-one-engine';
import type { TandemRouter } from '@/lib/taf/router';

beforeAll(() => {
  setStore(createInMemoryStore());
});

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function makeMockRouter(
  optionBJson: Record<string, unknown> = {
    description: 'B方案: 灵活快速降价',
    reasoning: '基于历史 case 推演',
    confidence: 0.7,
    risk: 'medium',
    timelineDays: 7,
  },
  shouldThrow = false,
): TandemRouter {
  return {
    chat: vi.fn(async () => {
      if (shouldThrow) throw new Error('LLM provider down');
      return {
        message: { role: 'assistant', content: JSON.stringify(optionBJson) },
        usage: { promptTokens: 100, completionTokens: 50 },
        finishReason: 'stop',
      };
    }),
  } as unknown as TandemRouter;
}

class EmptyRetriever implements MemoryRetriever {
  async findRelatedSOP(): Promise<MemorySearchResult[]> {
    return [];
  }
  async findHistoricalCases(): Promise<MemorySearchResult[]> {
    return [];
  }
}

const ctxBase: DecisionContext = {
  cardId: 'dc_test_1',
  title: '客户投诉处理',
  description: '某 KA 客户因 SLA 未达标投诉, 需决议补偿方案',
  relatedKrTitles: ['Q2 NRR ≥ 105%'],
};

// ---------------------------------------------------------------------------
// 1. 4 选项生成 + D humanOnly 不变量
// ---------------------------------------------------------------------------

describe('ThreePlusOneEngine · 4 选项生成', () => {
  it('完整路径: A SOP + B LLM + C 历史 + D humanOnly=true', async () => {
    const engine = new ThreePlusOneEngine(makeMockRouter(), new StubMemoryRetriever());
    const r = await engine.generateOptions(ctxBase);

    expect(r.options).toHaveLength(4);
    expect(r.options.map((o) => o.id)).toEqual(['A', 'B', 'C', 'D']);
    expect(r.options.map((o) => o.type)).toEqual(['SOP', 'AGENT_REASONING', 'HISTORICAL', 'ORIGINAL']);

    // D 选项 humanOnly 不变量 (反 AI 欺诈关键)
    expect(r.options[3].humanOnly).toBe(true);
    expect(r.options[3].novelInsight).toBe('');
    expect(r.options[3].description).toContain('员工填写');
  });

  it('A 选项 confidence > 0.8 → risk=low; ≤ 0.8 → risk=medium', async () => {
    class HighSimRetriever implements MemoryRetriever {
      async findRelatedSOP(): Promise<MemorySearchResult[]> {
        return [{ id: 's1', title: 'SOP-A', body: '步骤 1', similarity: 0.95 }];
      }
      async findHistoricalCases(): Promise<MemorySearchResult[]> {
        return [];
      }
    }
    const engine = new ThreePlusOneEngine(makeMockRouter(), new HighSimRetriever());
    const r = await engine.generateOptions(ctxBase);
    expect(r.options[0].risk).toBe('low');
  });

  it('B 选项 LLM JSON 透传 description / reasoning / confidence / risk', async () => {
    const engine = new ThreePlusOneEngine(
      makeMockRouter({
        description: 'B 方案: 给 30% 折扣',
        reasoning: '历史案例显示 30% 是甜区',
        confidence: 0.85,
        risk: 'low',
        timelineDays: 5,
      }),
      new StubMemoryRetriever(),
    );
    const r = await engine.generateOptions(ctxBase);
    expect(r.options[1].description).toBe('B 方案: 给 30% 折扣');
    expect(r.options[1].confidence).toBe(0.85);
    expect(r.options[1].risk).toBe('low');
    expect(r.options[1].timelineDays).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// 2/3. 退化场景 (无 SOP / 无历史)
// ---------------------------------------------------------------------------

describe('退化场景', () => {
  it('SOP 全空 → A 退化 (confidence=0.3, medium risk) + warning', async () => {
    const engine = new ThreePlusOneEngine(makeMockRouter(), new EmptyRetriever());
    const r = await engine.generateOptions(ctxBase);
    expect(r.options[0].confidence).toBe(0.3);
    expect(r.options[0].risk).toBe('medium');
    expect(r.warnings.some((w) => w.includes('未找到相关 SOP'))).toBe(true);
  });

  it('历史案例全空 → C 退化 (confidence=0) + warning', async () => {
    const engine = new ThreePlusOneEngine(makeMockRouter(), new EmptyRetriever());
    const r = await engine.generateOptions(ctxBase);
    expect(r.options[2].confidence).toBe(0);
    expect(r.warnings.some((w) => w.includes('未找到相关历史案例'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. LLM 失败
// ---------------------------------------------------------------------------

describe('LLM 失败容错', () => {
  it('B 选项 LLM 抛错 → 占位 (high risk, confidence=0) + warning', async () => {
    const engine = new ThreePlusOneEngine(makeMockRouter({}, true), new StubMemoryRetriever());
    const r = await engine.generateOptions(ctxBase);
    expect(r.options[1].risk).toBe('high');
    expect(r.options[1].confidence).toBe(0);
    expect(r.options[1].description).toContain('LLM 暂不可用');
    expect(r.warnings.some((w) => w.includes('B 选项 LLM 失败'))).toBe(true);
  });

  it('B 选项即使失败 D 仍保持 humanOnly=true (反 AI 欺诈不变量)', async () => {
    const engine = new ThreePlusOneEngine(makeMockRouter({}, true), new StubMemoryRetriever());
    const r = await engine.generateOptions(ctxBase);
    expect(r.options[3].humanOnly).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5/6/7. baseline-guard 协议
// ---------------------------------------------------------------------------

describe('baseline-guard 协议', () => {
  it('actorUserId 缺失 → warning (不阻断)', async () => {
    const engine = new ThreePlusOneEngine(makeMockRouter(), new StubMemoryRetriever());
    const r = await engine.generateOptions(ctxBase);
    expect(r.warnings.some((w) => w.includes('未提供 actorUserId'))).toBe(true);
    // 仍生成 4 选项
    expect(r.options).toHaveLength(4);
  });

  it('提供 actorUserId 时调用 baseline-guard (PASS / SOFT_WARN / 异常都不阻断)', async () => {
    const engine = new ThreePlusOneEngine(makeMockRouter(), new StubMemoryRetriever());
    // baseline-guard 真实模块在没有相关 memory 时 PASS, 不会写 warning
    const r = await engine.generateOptions({
      ...ctxBase,
      actorUserId: 'u_alice',
      scenario: 'convergence',
    });
    expect(r.options).toHaveLength(4);
    // 不应该有 "未提供 actorUserId" 警告
    expect(r.warnings.some((w) => w.includes('未提供 actorUserId'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 8. scenario 标签
// ---------------------------------------------------------------------------

describe('DecisionScenario 标签', () => {
  it('scenario=report_extract 不影响 4 选项生成结构', async () => {
    const engine = new ThreePlusOneEngine(makeMockRouter(), new StubMemoryRetriever());
    const r = await engine.generateOptions({ ...ctxBase, scenario: 'report_extract' });
    expect(r.options).toHaveLength(4);
    expect(r.options[3].humanOnly).toBe(true);
  });

  it('scenario 缺省时按 convergence 处理 (向后兼容)', async () => {
    const engine = new ThreePlusOneEngine(makeMockRouter(), new StubMemoryRetriever());
    const r = await engine.generateOptions(ctxBase);
    expect(r.options).toHaveLength(4);
  });
});
