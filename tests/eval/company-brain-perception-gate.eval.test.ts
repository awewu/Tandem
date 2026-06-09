/**
 * §Eval Harness — 中央 AI 感知 Gate Benchmark (offline, no LLM)
 *
 * 目的: 锁住 `lib/persona/company-brain-perception.ts::shouldPerceive` 的判定边界。
 *
 * 为什么这是高价值回归基线 (学 Palantir AIP Evals: "把 LLM 逻辑当软件测"):
 *   感知 gate 是中央 AI "睁眼/闭眼"的开关 —— trigger=true 才会跑 runToolLoop 查 S0 rollup 真值,
 *   trigger=false 则只凭静态上下文作答。一旦有人收窄 INTERNAL_DATA_RE (或误改),
 *   "KR3 进展如何"这类问题会悄悄掉出触发集 → 中央 AI 对内部数据**又变瞎子**, 而单测可能仍全绿
 *   (ROADMAP P1.5 已记过一次"精致的假" tool-name 点号 bug 的同类教训)。
 *   本 suite 用确定性 case 把"哪些问题必须睁眼 / 哪些不该浪费 tool-loop"钉死。
 *
 * 跑法: `npx vitest run tests/eval/company-brain-perception-gate.eval.test.ts`
 *
 * 通过门槛 (确定性逻辑, 不容退化):
 *   - pass rate = 100% (全过)
 *   - avg score ≥ 0.99
 */
import { describe, it, expect } from 'vitest';
import {
  runSuite,
  containsJudge,
  type EvalCase,
  type EvalSuite,
} from '@/lib/evals';
import { shouldPerceive } from '@/lib/persona/company-brain-perception';

// ──────────────────────────────────────────────────────────────────
// Case 输入: 一句用户问中央 AI 的话
// ──────────────────────────────────────────────────────────────────

interface GateInput {
  query: string;
}

/**
 * 评分语义: actualOutput = `trigger=<bool> | reason=<...>`.
 *   正例 contains `trigger=true` (该睁眼查真值); 反例 contains `trigger=false` (闲聊不浪费 tool-loop)。
 */
const cases: EvalCase<GateInput>[] = [
  // ── 必须触发 (该查内部真值的问题) ───────────────────────────────
  {
    id: 'cb-perception.case-1-okr-progress',
    description: '问 OKR 进度 → 必须睁眼查真值',
    input: { query: '现在公司 OKR 进度怎样了' },
    expected: { contains: ['trigger=true'], avoids: ['trigger=false'] },
  },
  {
    id: 'cb-perception.case-2-kr-boundary',
    description: 'KR 带词边界 (KR 后跟空格) → 命中 KR\\b',
    input: { query: 'R&D 最迟的 KR 怎么样' },
    expected: { contains: ['trigger=true'], avoids: ['trigger=false'] },
  },
  {
    id: 'cb-perception.case-3-kr3-no-boundary',
    description: '关键回归: "KR3" 后无词边界, KR\\b 不命中, 必须靠 "进展" 兜住 → 仍触发 (防瞎子)',
    input: { query: 'KR3 进展如何' },
    expected: { contains: ['trigger=true'], avoids: ['trigger=false'] },
  },
  {
    id: 'cb-perception.case-4-laggards',
    description: '问哪些目标落后 → 触发',
    input: { query: '哪些目标落后了' },
    expected: { contains: ['trigger=true'], avoids: ['trigger=false'] },
  },
  {
    id: 'cb-perception.case-5-at-risk',
    description: '问 at-risk 项 → 触发',
    input: { query: '有哪些 at-risk 的关键结果' },
    expected: { contains: ['trigger=true'], avoids: ['trigger=false'] },
  },
  {
    id: 'cb-perception.case-6-decision',
    description: '问议事/决议 → 触发 (decision_card 感知)',
    input: { query: '上次议事的决议是什么' },
    expected: { contains: ['trigger=true'], avoids: ['trigger=false'] },
  },
  {
    id: 'cb-perception.case-7-health',
    description: '问健康度 → 触发',
    input: { query: '团队 OKR 健康度如何' },
    expected: { contains: ['trigger=true'], avoids: ['trigger=false'] },
  },
  {
    id: 'cb-perception.case-8-completion-rate',
    description: '问完成率 → 触发',
    input: { query: '本周期完成率多少' },
    expected: { contains: ['trigger=true'], avoids: ['trigger=false'] },
  },

  // ── 不应触发 (闲聊/无关, 省 tool-loop token) ─────────────────────
  {
    id: 'cb-perception.case-9-greeting',
    description: '寒暄 → 不触发',
    input: { query: '你好，今天天气不错' },
    expected: { contains: ['trigger=false'], avoids: ['trigger=true'] },
  },
  {
    id: 'cb-perception.case-10-creative',
    description: '创作请求 (无内部数据词) → 不触发',
    input: { query: '帮我写一首关于春天的诗' },
    expected: { contains: ['trigger=false'], avoids: ['trigger=true'] },
  },
  {
    id: 'cb-perception.case-11-thanks',
    description: '道谢 → 不触发',
    input: { query: '谢谢你的帮助' },
    expected: { contains: ['trigger=false'], avoids: ['trigger=true'] },
  },
  {
    id: 'cb-perception.case-12-empty',
    description: '空 query → 不触发',
    input: { query: '   ' },
    expected: { contains: ['trigger=false'], avoids: ['trigger=true'] },
  },
];

const suite: EvalSuite<GateInput> = {
  name: 'company-brain-perception-gate',
  description: '中央 AI 感知 gate 启发式判定 offline benchmark (no LLM, deterministic).',
  cases,
  run: async (c) => {
    const r = shouldPerceive(c.input.query);
    return `trigger=${r.trigger} | reason=${r.reason}`;
  },
  judges: [containsJudge],
  meta: { runner: 'cb-perception-gate-v1', judge: 'containsJudge' },
};

// ──────────────────────────────────────────────────────────────────

describe('§eval · 中央 AI 感知 gate benchmark', () => {
  it('该睁眼的问题必触发, 闲聊必不触发 (防"瞎子"回归)', async () => {
    const report = await runSuite(suite, { concurrency: 6 });

    if (report.failures.length > 0) {
      // eslint-disable-next-line no-console
      console.log('[cb-perception-gate] failures:', report.failures);
    }

    expect(report.total).toBe(cases.length);
    // 确定性逻辑: 必须 100% 通过
    expect(report.passed).toBe(cases.length);
    expect(report.avgScore).toBeGreaterThanOrEqual(0.99);
  });
});
