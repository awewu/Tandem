/**
 * §Production Evals · 公开 API
 *
 * 用法 (节点环境 / cron):
 *
 *   import { runSuite, buildBossAiOkrAnchorSuite, makeProductionRunner, formatReport } from '@/lib/evals';
 *
 *   const run = makeProductionRunner('https://tandem.local', cookie);
 *   const suite = buildBossAiOkrAnchorSuite(run, { useLlmJudge: true });
 *   const report = await runSuite(suite);
 *   console.log(formatReport(report));
 */
export type {
  EvalCase,
  EvalCaseResult,
  EvalInput,
  EvalSuite,
  Judge,
  RunFn,
  SuiteReport,
} from './types';

export { containsJudge, llmRubricJudge, composeJudges } from './judges';
export { runSuite, runSuites, formatReport } from './runner';
export type { RunSuiteOptions } from './runner';
export {
  buildBossAiOkrAnchorSuite,
  makeProductionRunner,
} from './suites/boss-ai-okr-anchor';
export { buildBossAiSafetySuite } from './suites/boss-ai-safety';
