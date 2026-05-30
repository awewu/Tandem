/**
 * §Production Evals CLI
 *
 * 用法:
 *   # 1. 本地跑 (用真 LLM)
 *   npx tsx scripts/run-evals.ts --base http://localhost:3000 --cookie "$COOKIE"
 *
 *   # 2. Nightly cron (生产)
 *   BASE_URL=https://tandem.local AUTH_COOKIE="..." npx tsx scripts/run-evals.ts
 *
 *   # 3. Smoke (mock answers, 不调真 LLM)
 *   npx tsx scripts/run-evals.ts --mock
 *
 * 退出码:
 *   0  全部 suite 平均 score ≥ 0.7
 *   1  低于 0.7 (regression)
 *   2  脚本本身异常
 */
import type { EvalSuite } from '@/lib/evals';
import {
  runSuites,
  formatReport,
  buildBossAiOkrAnchorSuite,
  makeProductionRunner,
} from '@/lib/evals';

// 多 input/output 类型的 suite 集合走 unknown 桥, 避免 invariant 报错
type AnySuite = EvalSuite<unknown, unknown>;

const args = process.argv.slice(2);
function arg(name: string, fallback?: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  if (i >= 0 && args[i + 1]) return args[i + 1];
  return fallback;
}
const isMock = args.includes('--mock');

const baseUrl = arg('base', process.env.BASE_URL ?? 'http://localhost:3000')!;
const cookie = arg('cookie', process.env.AUTH_COOKIE);
const useLlmJudge = !isMock && !args.includes('--no-llm-judge');

async function main() {
  const runner = isMock
    ? async () => 'mock answer mentioning OKR, 议事'
    : makeProductionRunner(baseUrl, cookie);

  const suites: AnySuite[] = [
    buildBossAiOkrAnchorSuite(runner, { useLlmJudge }) as unknown as AnySuite,
  ];

  console.log(`[evals] base=${baseUrl} mock=${isMock} useLlmJudge=${useLlmJudge}`);
  console.log(`[evals] running ${suites.length} suite(s)...`);

  const { reports, summary } = await runSuites(suites, { concurrency: 2 });

  for (const r of reports) {
    console.log('\n' + formatReport(r));
  }

  console.log('\n=== Summary ===');
  console.log(`Suites:   ${summary.totalSuites}`);
  console.log(`Cases:    ${summary.totalCases}`);
  console.log(`Passed:   ${summary.totalPassed}`);
  console.log(`AvgScore: ${(summary.avgScore * 100).toFixed(1)} / 100`);

  if (summary.avgScore < 0.7) {
    console.error('\n[evals] ⚠️ regression: avgScore < 0.7');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[evals] fatal:', err);
  process.exit(2);
});
