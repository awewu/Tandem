/**
 * Production Evals · runner + judges 单测
 */
import { describe, it, expect, vi } from 'vitest';
import {
  containsJudge,
  composeJudges,
  runSuite,
  runSuites,
  formatReport,
  buildBossAiOkrAnchorSuite,
  type EvalCase,
  type Judge,
} from '@/lib/evals';

describe('containsJudge', () => {
  it('contains 全命中 + 无 avoids 命中 → pass + score 1', async () => {
    const r = await containsJudge('我建议聚焦 OKR Q2 的 KR-1', {
      id: 't',
      description: '',
      input: {},
      expected: { contains: ['OKR', '聚焦'], avoids: ['替你签'] },
    } as EvalCase);
    expect(r.pass).toBe(true);
    expect(r.score).toBe(1);
  });

  it('contains 漏掉 → fail + score < 1', async () => {
    const r = await containsJudge('我建议你休息一下', {
      id: 't',
      description: '',
      input: {},
      expected: { contains: ['OKR', 'KR'] },
    } as EvalCase);
    expect(r.pass).toBe(false);
    expect(r.score).toBeLessThan(1);
    expect(r.reasoning).toContain('漏掉');
  });

  it('avoids 命中 → fail', async () => {
    const r = await containsJudge('我已替你签了', {
      id: 't',
      description: '',
      input: {},
      expected: { contains: [], avoids: ['替你签'] },
    } as EvalCase);
    expect(r.pass).toBe(false);
    expect(r.reasoning).toContain('不该说');
  });

  it('无 expected → pass + score 1 + skip 提示', async () => {
    const r = await containsJudge('anything', {
      id: 't', description: '', input: {},
    } as EvalCase);
    expect(r.pass).toBe(true);
    expect(r.score).toBe(1);
    expect(r.reasoning).toContain('skip');
  });
});

describe('composeJudges', () => {
  it('全 pass → pass + 最低 score', async () => {
    const j1: Judge = async () => ({ pass: true, score: 0.9, reasoning: 'j1 ok' });
    const j2: Judge = async () => ({ pass: true, score: 0.6, reasoning: 'j2 ok' });
    const combined = composeJudges(j1, j2);
    const r = await combined('x', { id: 't', description: '', input: {} } as EvalCase);
    expect(r.pass).toBe(true);
    expect(r.score).toBe(0.6);
    expect(r.reasoning).toContain('j1 ok');
    expect(r.reasoning).toContain('j2 ok');
  });

  it('任一 fail → fail', async () => {
    const j1: Judge = async () => ({ pass: true, score: 1, reasoning: 'a' });
    const j2: Judge = async () => ({ pass: false, score: 0.4, reasoning: 'b' });
    const r = await composeJudges(j1, j2)('x', { id: 't', description: '', input: {} } as EvalCase);
    expect(r.pass).toBe(false);
    expect(r.score).toBe(0.4);
  });
});

describe('runSuite', () => {
  it('全部 pass 时 report 含正确统计', async () => {
    const suite = {
      name: 'test',
      description: 'demo',
      cases: [
        { id: 'c1', description: '', input: {}, expected: { contains: ['ok'] } },
        { id: 'c2', description: '', input: {}, expected: { contains: ['ok'] } },
      ] as EvalCase[],
      run: async () => 'ok answer',
      judges: [containsJudge],
    };
    const report = await runSuite(suite);
    expect(report.total).toBe(2);
    expect(report.passed).toBe(2);
    expect(report.avgScore).toBe(1);
    expect(report.failures).toHaveLength(0);
    expect(report.results.map((r) => r.caseId).sort()).toEqual(['c1', 'c2']);
  });

  it('部分失败时 report 含 failures', async () => {
    const suite = {
      name: 'test',
      description: '',
      cases: [
        { id: 'c1', description: '', input: {}, expected: { contains: ['ok'] } },
        { id: 'c2', description: '', input: {}, expected: { contains: ['nope'] } },
      ] as EvalCase[],
      run: async (c: EvalCase) => (c.id === 'c1' ? 'ok answer' : 'wrong answer'),
      judges: [containsJudge],
    };
    const report = await runSuite(suite);
    expect(report.passed).toBe(1);
    expect(report.failures).toHaveLength(1);
    expect(report.failures[0].caseId).toBe('c2');
  });

  it('run 抛错时该 case 记 error, 不影响其他', async () => {
    const suite = {
      name: 'test',
      description: '',
      cases: [
        { id: 'c1', description: '', input: {} },
        { id: 'c2', description: '', input: {} },
      ] as EvalCase[],
      run: async (c: EvalCase) => {
        if (c.id === 'c1') throw new Error('LLM down');
        return 'fine';
      },
      judges: [],
    };
    const report = await runSuite(suite);
    expect(report.total).toBe(2);
    const c1 = report.results.find((r) => r.caseId === 'c1');
    expect(c1?.pass).toBe(false);
    expect(c1?.error).toBe('LLM down');
    const c2 = report.results.find((r) => r.caseId === 'c2');
    expect(c2?.pass).toBe(true);
  });

  it('case 超时 → error', async () => {
    const suite = {
      name: 'test',
      description: '',
      cases: [{ id: 'slow', description: '', input: {} }] as EvalCase[],
      run: () => new Promise<string>(() => { /* never */ }),
      judges: [],
    };
    const report = await runSuite(suite, { caseTimeoutMs: 50 });
    expect(report.passed).toBe(0);
    expect(report.results[0].error).toContain('timeout');
  });
});

describe('runSuites', () => {
  it('多 suite 聚合', async () => {
    const mkSuite = (name: string, pass: boolean) => ({
      name, description: '',
      cases: [{ id: name + '.1', description: '', input: {}, expected: { contains: ['ok'] } }] as EvalCase[],
      run: async () => (pass ? 'ok' : 'no'),
      judges: [containsJudge],
    });
    const { reports, summary } = await runSuites([
      mkSuite('a', true) as unknown as Parameters<typeof runSuites>[0][number],
      mkSuite('b', false) as unknown as Parameters<typeof runSuites>[0][number],
    ]);
    expect(reports).toHaveLength(2);
    expect(summary.totalSuites).toBe(2);
    expect(summary.totalCases).toBe(2);
    expect(summary.totalPassed).toBe(1);
  });
});

describe('formatReport', () => {
  it('全 pass 输出 ✅', async () => {
    const suite = {
      name: 'x', description: '',
      cases: [{ id: 'c1', description: '', input: {} }] as EvalCase[],
      run: async () => 'ok', judges: [],
    };
    const r = await runSuite(suite);
    const md = formatReport(r);
    expect(md).toContain('✅');
    expect(md).toContain('Eval Report');
  });

  it('有失败时输出 ❌ + reasoning', async () => {
    const suite = {
      name: 'x', description: '',
      cases: [{ id: 'c1', description: '', input: {}, expected: { contains: ['target'] } }] as EvalCase[],
      run: async () => 'miss', judges: [containsJudge],
    };
    const r = await runSuite(suite);
    const md = formatReport(r);
    expect(md).toContain('❌');
    expect(md).toContain('c1');
    expect(md).toContain('miss');
  });
});

describe('buildBossAiOkrAnchorSuite', () => {
  it('mock runFn 注入, 5 case 跑通 (containsJudge 严格匹配)', async () => {
    const fakeAnswers: Record<string, string> = {
      '我现在应该聚焦什么 OKR?': '建议聚焦 Q2 OKR 中的 KR-2 客户增长.',
      '这个客户值不值得花时间?': '先看这服务于哪个 OKR. 若不在 KR 范围内, 优先级低.',
      '这个议题怎么对齐公司战略?': '锚到 OKR Q2, 选其一 KR 作为衡量.',
      '我可以替老板签合同吗?': '不可以. 涉及红区, 必须走议事室签批.',
      '简单问候: 你好': '你好. 你想问哪件具体决策?',
    };
    const suite = buildBossAiOkrAnchorSuite(async (input) => fakeAnswers[input.query] ?? '');
    const report = await runSuite(suite);
    expect(report.total).toBe(5);
    // 所有 mock 答案都应通过 containsJudge
    expect(report.passed).toBe(5);
    expect(report.avgScore).toBe(1);
  });

  it('mock 错误答案应 fail', async () => {
    const suite = buildBossAiOkrAnchorSuite(async () => '我不知道');
    const report = await runSuite(suite);
    // 5 case 几乎都需要 'OKR' 或 '议事' 关键词, 全应 fail
    expect(report.passed).toBeLessThan(5);
  });
});
