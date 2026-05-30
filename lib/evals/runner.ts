/**
 * §Production Evals · Suite Runner
 *
 * runSuite(suite) -> SuiteReport
 *   1. 对每个 case: 跑 suite.run(case) 拿 actual output
 *   2. 把多个 judge 合成 (composeJudges), 出 {pass, score, reasoning}
 *   3. 汇总 -> SuiteReport
 *
 * 永不抛错: case 失败时, 该 case 记 error, suite 继续跑.
 * 并发控制: 默认 concurrency=3, 不让 LLM provider 限流被打.
 *
 * 集成路径:
 *   - 单测: vitest run tests/unit/evals-*  (mock LLM, 验证 runner 正确性)
 *   - 真实 eval: pnpm run evals 或 RUN_EVALS=1 vitest run tests/evals/  (调真 LLM)
 *   - Nightly cron: scripts/run-evals.* 跑全部 suite, 推送 /admin/usage
 */
import type {
  EvalSuite,
  SuiteReport,
  EvalCaseResult,
  Judge,
} from './types';
import { composeJudges } from './judges';

export interface RunSuiteOptions {
  /** 同时跑几条 case (默认 3) */
  concurrency?: number;
  /** 单个 case 超时 (ms, 默认 60000) */
  caseTimeoutMs?: number;
  /** 失败立刻停 (默认 false) */
  bail?: boolean;
}

export async function runSuite<TIn, TOut>(
  suite: EvalSuite<TIn, TOut>,
  opts: RunSuiteOptions = {},
): Promise<SuiteReport> {
  const concurrency = opts.concurrency ?? 3;
  const caseTimeoutMs = opts.caseTimeoutMs ?? 60_000;
  const startedAt = Date.now();
  const ranAt = new Date(startedAt).toISOString();
  const judge = (suite.judges.length > 0
    ? composeJudges(...(suite.judges as Judge[]))
    : (async () => ({ pass: true, score: 1, reasoning: '(no judges)' }))) as Judge<TIn, TOut>;

  const results: EvalCaseResult[] = [];
  const queue = [...suite.cases];
  let bailed = false;

  async function runOne(c: typeof suite.cases[number]): Promise<EvalCaseResult> {
    const start = Date.now();
    try {
      const actual = await withTimeout(suite.run(c), caseTimeoutMs);
      const verdict = await judge(actual, c);
      return {
        caseId: c.id,
        pass: verdict.pass,
        score: verdict.score,
        reasoning: verdict.reasoning,
        actualOutput: String(actual).slice(0, 2000),
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      return {
        caseId: c.id,
        pass: false,
        score: 0,
        reasoning: `(异常: ${(err as Error).message})`,
        actualOutput: '',
        latencyMs: Date.now() - start,
        error: (err as Error).message,
      };
    }
  }

  // 简单并发池
  async function worker() {
    while (queue.length > 0 && !bailed) {
      const c = queue.shift();
      if (!c) break;
      const r = await runOne(c);
      results.push(r);
      if (opts.bail && !r.pass) {
        bailed = true;
        break;
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const passed = results.filter((r) => r.pass).length;
  const avgScore = results.length > 0 ? results.reduce((s, r) => s + r.score, 0) / results.length : 0;
  const failures = results.filter((r) => !r.pass);

  return {
    suiteName: suite.name,
    ranAt,
    durationMs: Date.now() - startedAt,
    total: results.length,
    passed,
    avgScore,
    results: results.sort((a, b) => a.caseId.localeCompare(b.caseId)),
    failures,
    meta: {
      runner: 'lib/evals/runner.ts',
      judge: suite.judges.map((j) => j.name || 'anonymous').join('+') || 'noop',
      ...suite.meta,
    },
  };
}

/**
 * 多 suite 并行 (suite 之间不抢资源时用).
 * 返回报告数组 + 一个聚合 summary.
 */
export async function runSuites(
  // 接受任意 EvalSuite 泛型实例 (跨 input/output 类型的 suite 列表)
  suites: ReadonlyArray<EvalSuite<unknown, unknown>>,
  opts: RunSuiteOptions = {},
): Promise<{
  reports: SuiteReport[];
  summary: { totalSuites: number; totalCases: number; totalPassed: number; avgScore: number };
}> {
  const reports = await Promise.all(suites.map((s) => runSuite(s, opts)));
  const totalCases = reports.reduce((s, r) => s + r.total, 0);
  const totalPassed = reports.reduce((s, r) => s + r.passed, 0);
  const avgScore = totalCases > 0
    ? reports.reduce((s, r) => s + r.avgScore * r.total, 0) / totalCases
    : 0;
  return {
    reports,
    summary: {
      totalSuites: reports.length,
      totalCases,
      totalPassed,
      avgScore,
    },
  };
}

/**
 * 格式化报告 (markdown), 给 nightly cron 推送 IM 用.
 */
export function formatReport(report: SuiteReport): string {
  const passRate = report.total > 0 ? Math.round((report.passed / report.total) * 100) : 0;
  const score = (report.avgScore * 100).toFixed(1);
  const head = [
    `# Eval Report · ${report.suiteName}`,
    `- ran: ${report.ranAt}`,
    `- pass: ${report.passed} / ${report.total} (${passRate}%)`,
    `- score: ${score} / 100`,
    `- duration: ${report.durationMs} ms`,
    '',
  ];
  if (report.failures.length === 0) {
    head.push('✅ 全部 case 通过.');
    return head.join('\n');
  }
  head.push(`❌ ${report.failures.length} case 失败:\n`);
  for (const f of report.failures.slice(0, 10)) {
    head.push(`- **${f.caseId}** (score ${f.score.toFixed(2)}, ${f.latencyMs}ms)`);
    head.push(`  - ${f.reasoning}`);
    head.push(`  - actual: \`${f.actualOutput.slice(0, 200).replace(/\n/g, ' ')}\``);
  }
  if (report.failures.length > 10) {
    head.push(`- ... 还有 ${report.failures.length - 10} 条失败省略`);
  }
  return head.join('\n');
}

// ──────────────────────────────────────────────────────────────────
// helpers
// ──────────────────────────────────────────────────────────────────
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`case timeout (${ms}ms)`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); })
     .catch((e) => { clearTimeout(t); reject(e); });
  });
}
