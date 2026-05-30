/**
 * §Production Evals 类型定义
 *
 * 2026 Anthropic best practice: "build the agent loop yourself + add production evals".
 * Unit tests 验证代码正确性, evals 验证 LLM/Agent **输出质量**.
 *
 * 用法层级:
 *   Suite (一组评估)
 *     ├─ name: 'okr-anchor'
 *     ├─ cases: EvalCase[] (5-50)
 *     └─ judges: Judge[]   (1+)
 *
 *   Case (单条评估)
 *     ├─ input: 模型输入
 *     ├─ run(input) -> output (run 函数 = 系统在该输入下产出)
 *     └─ judge(output) -> score (0-1) + reasoning
 *
 * Runner:
 *   runSuite(suite) -> SuiteReport (pass rate, avg score, failures)
 *   配 nightly cron + 推送到 /admin/usage 看板.
 */
import type { ChatMessage } from '@/lib/taf/provider/types';

export interface EvalCase<TInput = EvalInput, TOutput = string> {
  /** 唯一 id (suiteName.case-N) */
  id: string;
  /** 自然语言描述 (这条 case 在测什么) */
  description: string;
  /** 输入 */
  input: TInput;
  /** 期待行为 (judge 用) */
  expected?: {
    /** 输出必须包含的子串 (任一未包含 → fail) */
    contains?: string[];
    /** 输出必须不含的子串 (任一包含 → fail) */
    avoids?: string[];
    /** 自然语言描述 (LLM-as-Judge 用作 rubric) */
    rubric?: string;
  };
  /** 类型化 expectedOutput (跟 run 函数返回类型一致, 给自定义 judge 用) */
  expectedOutput?: TOutput;
  /** 标签 (筛选用) */
  tags?: string[];
}

export interface EvalInput {
  messages?: ChatMessage[];
  query?: string;
  context?: Record<string, unknown>;
}

export interface EvalCaseResult {
  caseId: string;
  pass: boolean;
  /** 0-1, 1=完美, 0=完全失败 */
  score: number;
  /** judge 给出的解释 */
  reasoning: string;
  /** 实际输出 (用于人工抽样) */
  actualOutput: string;
  /** 系统跑这条 case 的延迟 */
  latencyMs: number;
  /** 错误信息 (如果 run 阶段抛错) */
  error?: string;
}

export interface SuiteReport {
  suiteName: string;
  ranAt: string;            // ISO
  durationMs: number;
  /** 总 case 数 */
  total: number;
  /** 通过的 */
  passed: number;
  /** 平均 score */
  avgScore: number;
  /** 详细结果 */
  results: EvalCaseResult[];
  /** 失败 case (快速查看) */
  failures: EvalCaseResult[];
  /** runner 的元信息 */
  meta: {
    runner: string;          // 比如 'okr-anchor-v1'
    judge: string;           // 比如 'contains+llm-rubric'
    provider?: string;       // 跑系统时用的 LLM provider
    model?: string;
  };
}

/**
 * judge 函数: 拿 output + case, 给一个 EvalCaseResult.
 * 多 judge 可以叠加 (取最低分 / 加权平均).
 */
export type Judge<TInput = EvalInput, TOutput = string> = (
  actual: TOutput,
  c: EvalCase<TInput, TOutput>,
) => Promise<Pick<EvalCaseResult, 'pass' | 'score' | 'reasoning'>>;

/**
 * run 函数: 实际跑系统 (调 LLM / agent / pipeline) 给出 output.
 * 由各 suite 自己实现.
 */
export type RunFn<TInput = EvalInput, TOutput = string> = (
  c: EvalCase<TInput, TOutput>,
) => Promise<TOutput>;

export interface EvalSuite<TInput = EvalInput, TOutput = string> {
  name: string;
  description: string;
  cases: EvalCase<TInput, TOutput>[];
  run: RunFn<TInput, TOutput>;
  judges: Judge<TInput, TOutput>[];
  /** 元信息 */
  meta?: Partial<SuiteReport['meta']>;
}
