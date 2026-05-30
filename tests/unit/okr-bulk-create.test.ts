/**
 * OKR 批量创建服务单测
 *
 * 覆盖:
 *   1. matchTemplate · 关键词命中各分类 + fallback
 *   2. parseReasoningJson · 多种坏 JSON 防御
 *   3. buildSopOption · 公司 + 部门 cascade 结构 + parentLocalIndex
 *   4. buildHistoricalOption · 与 SOP 不同模板
 *   5. buildOriginalOption · humanOnly 强制 + 空 objectives
 *   6. generateBulkCreateOptions (无 router) · 4 选项全出 + B 降级
 *   7. generateBulkCreateOptions (mock router) · B 选项走 LLM 路径
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  buildSopOption,
  buildHistoricalOption,
  buildOriginalOption,
  matchTemplate,
  parseReasoningJson,
  generateBulkCreateOptions,
  type BulkCreateInput,
} from '../../lib/services/okr-bulk-create';
import { getStore, setStore } from '../../lib/storage/repository';
import { createInMemoryStore } from '../../lib/storage/memory-store';

beforeAll(() => {
  setStore(createInMemoryStore());
});

const BASE_INPUT: BulkCreateInput = {
  cycleName: '2026 Q3',
  strategy: '本季度全力做 ARR 增长 + 客户续约',
  departments: [
    { id: 'dept_sales', name: '销售部' },
    { id: 'dept_cs', name: '客户成功' },
  ],
  triggeredBy: 'user_alice',
};

describe('matchTemplate', () => {
  it('"ARR 增长" → sales 类目', () => {
    const tpl = matchTemplate('本季度全力做 ARR 增长');
    expect(tpl.category).toBe('sales');
  });

  it('"用户留存" → product', () => {
    const tpl = matchTemplate('提升用户留存到行业第一');
    expect(tpl.category).toBe('product');
  });

  it('"招聘人才" → hr', () => {
    const tpl = matchTemplate('Q3 全力招聘人才');
    expect(tpl.category).toBe('hr');
  });

  it('"工程稳定性" → engineering', () => {
    const tpl = matchTemplate('提升平台稳定性 + 工程效率');
    expect(tpl.category).toBe('engineering');
  });

  it('完全无关键词 → fallback (leadership 或第一条)', () => {
    const tpl = matchTemplate('xyz unknown gibberish');
    expect(tpl).toBeTruthy();
    expect(tpl.id).toBeTruthy();
  });
});

describe('parseReasoningJson', () => {
  it('合法 JSON', () => {
    const text = JSON.stringify({
      companyObjective: { title: 'O1', keyResults: [{ title: 'KR1' }] },
      departmentObjectives: [{ departmentId: 'd1', title: 'O', keyResults: [] }],
      reasoning: 'because',
    });
    const r = parseReasoningJson(text);
    expect(r).not.toBeNull();
    expect(r?.companyObjective.title).toBe('O1');
  });

  it('markdown 代码块包裹', () => {
    const text = '```json\n' + JSON.stringify({
      companyObjective: { title: 'O1', keyResults: [] },
      departmentObjectives: [],
      reasoning: 'r',
    }) + '\n```';
    const r = parseReasoningJson(text);
    expect(r).not.toBeNull();
  });

  it('空字符串 → null', () => {
    expect(parseReasoningJson('')).toBeNull();
  });

  it('坏 JSON → null', () => {
    expect(parseReasoningJson('{ not json')).toBeNull();
  });

  it('缺字段 → null', () => {
    const text = JSON.stringify({ companyObjective: { title: 'x' } });
    expect(parseReasoningJson(text)).toBeNull();
  });
});

describe('buildSopOption', () => {
  it('公司 Objective + 每部门 cascade Objective', () => {
    const opt = buildSopOption(BASE_INPUT);
    expect(opt.id).toBe('A');
    expect(opt.type).toBe('SOP');
    expect(opt.objectives.length).toBe(1 + BASE_INPUT.departments.length); // 1 公司 + 2 部门
    expect(opt.objectives[0].level).toBe('company');
    expect(opt.objectives[1].level).toBe('team');
    expect(opt.objectives[1].parentLocalIndex).toBe(1);
    expect(opt.objectives[1].ownerDepartmentId).toBe('dept_sales');
    expect(opt.citedTemplateIds).toBeDefined();
    expect(opt.citedTemplateIds!.length).toBe(1);
  });

  it('maxDepartments 截断', () => {
    const input = {
      ...BASE_INPUT,
      departments: Array.from({ length: 20 }, (_, i) => ({ id: `d${i}`, name: `部门${i}` })),
      maxDepartments: 3,
    };
    const opt = buildSopOption(input);
    expect(opt.objectives.length).toBe(1 + 3);
  });
});

describe('buildHistoricalOption', () => {
  it('用第二相似模板 (与 SOP 选项不同)', () => {
    const sop = buildSopOption(BASE_INPUT);
    const hist = buildHistoricalOption(BASE_INPUT);
    expect(hist.id).toBe('C');
    expect(hist.type).toBe('HISTORICAL');
    // 不应 cite 同一个模板
    expect(hist.citedTemplateIds).toBeDefined();
    if (sop.citedTemplateIds && hist.citedTemplateIds) {
      expect(hist.citedTemplateIds[0]).not.toBe(sop.citedTemplateIds[0]);
    }
  });
});

describe('buildOriginalOption', () => {
  it('humanOnly + 空 objectives', () => {
    const opt = buildOriginalOption();
    expect(opt.id).toBe('D');
    expect(opt.type).toBe('ORIGINAL');
    expect(opt.humanOnly).toBe(true);
    expect(opt.objectives).toEqual([]);
    expect(opt.confidence).toBe(0);
  });
});

describe('generateBulkCreateOptions (无 router)', () => {
  it('返回 4 选项 + B 降级', async () => {
    const result = await generateBulkCreateOptions(BASE_INPUT);
    expect(result.options.length).toBe(4);
    expect(result.options.map((o) => o.id)).toEqual(['A', 'B', 'C', 'D']);
    expect(result.source).toBe('fallback');
    expect(result.fallbackReason).toBe('no_provider_registered');
    // B 降级也要有 objectives
    const b = result.options.find((o) => o.id === 'B')!;
    expect(b.objectives.length).toBeGreaterThan(0);
    // D 永远 humanOnly
    expect(result.options.find((o) => o.id === 'D')!.humanOnly).toBe(true);
  });

  it('cycleName 透传', async () => {
    const result = await generateBulkCreateOptions(BASE_INPUT);
    expect(result.cycleName).toBe('2026 Q3');
    expect(result.strategy).toBe(BASE_INPUT.strategy);
  });
});

describe('generateBulkCreateOptions (mock router 走 LLM 路径)', () => {
  it('LLM 返回合法 JSON → B source=full', async () => {
    const mockRouter = {
      listProviders: () => ['mock-provider'],
      chat: async () => ({
        id: 'r1',
        message: {
          role: 'assistant' as const,
          content: JSON.stringify({
            companyObjective: {
              title: 'AI 推演的公司目标',
              description: '基于战略推演',
              keyResults: [
                { title: 'ARR 增长 30%', type: 'percentage', startValue: 0, targetValue: 30, unit: '%', weight: 60 },
                { title: 'NPS ≥ 50', type: 'numeric', startValue: 30, targetValue: 50, unit: '分', weight: 40 },
              ],
            },
            departmentObjectives: [
              {
                departmentId: 'dept_sales',
                title: '销售部承接',
                keyResults: [
                  { title: '签 KA', type: 'numeric', startValue: 0, targetValue: 5, unit: '家', weight: 100 },
                ],
              },
            ],
            reasoning: '战略侧重 ARR, 销售部承接 KA 客户拓展',
          }),
        },
        finishReason: 'stop' as const,
        usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
        model: 'mock-model',
      }),
    } as unknown as Parameters<typeof generateBulkCreateOptions>[1];

    const result = await generateBulkCreateOptions(BASE_INPUT, mockRouter);
    expect(result.source).toBe('full');
    expect(result.modelUsed).toBe('mock-provider');
    const b = result.options.find((o) => o.id === 'B')!;
    expect(b.type).toBe('REASONING');
    expect(b.objectives[0].title).toBe('AI 推演的公司目标');
    expect(b.objectives[0].keyResults.length).toBe(2);
    expect(b.objectives[1].ownerDepartmentId).toBe('dept_sales');
  });

  it('LLM 抛错 → B 降级', async () => {
    const mockRouter = {
      listProviders: () => ['mock-provider'],
      chat: async () => {
        throw new Error('llm down');
      },
    } as unknown as Parameters<typeof generateBulkCreateOptions>[1];

    const result = await generateBulkCreateOptions(BASE_INPUT, mockRouter);
    expect(result.source).toBe('fallback');
    expect(result.fallbackReason).toBe('llm_parse_failed');
  });

  it('LLM 返回无效 JSON → B 降级', async () => {
    const mockRouter = {
      listProviders: () => ['mock-provider'],
      chat: async () => ({
        id: 'r2',
        message: { role: 'assistant' as const, content: 'this is not json at all' },
        finishReason: 'stop' as const,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        model: 'mock-model',
      }),
    } as unknown as Parameters<typeof generateBulkCreateOptions>[1];

    const result = await generateBulkCreateOptions(BASE_INPUT, mockRouter);
    expect(result.source).toBe('fallback');
    expect(result.fallbackReason).toBe('llm_parse_failed');
  });
});

describe('选项不变量 (全部 4 路径)', () => {
  it('A/C 必有 citedTemplateIds, D 必无', async () => {
    const result = await generateBulkCreateOptions(BASE_INPUT);
    const a = result.options.find((o) => o.id === 'A')!;
    const c = result.options.find((o) => o.id === 'C')!;
    const d = result.options.find((o) => o.id === 'D')!;
    expect(a.citedTemplateIds).toBeDefined();
    expect(c.citedTemplateIds).toBeDefined();
    expect(d.citedTemplateIds).toBeUndefined();
  });

  it('每个选项 (除 D) 公司层 Objective 必为第一个', async () => {
    const result = await generateBulkCreateOptions(BASE_INPUT);
    for (const opt of result.options) {
      if (opt.objectives.length === 0) continue;
      expect(opt.objectives[0].level).toBe('company');
    }
  });
});
