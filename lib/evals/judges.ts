/**
 * §Production Evals · 内置 Judges
 *
 * 1. containsJudge: 确定性, 不调 LLM, 跑 case.expected.contains/avoids
 * 2. llmRubricJudge: LLM-as-Judge, 用 case.expected.rubric 作为评分准则
 * 3. compose(...judges): 多 judge 合成 (取最低 score, AND pass)
 *
 * 2026 Anthropic best practice:
 *   "rules-based feedback > LLM-as-judge for reliability".
 *   优先用 containsJudge, 仅在需要语义评估时叠加 llmRubricJudge.
 */
import type { Judge } from './types';

/**
 * Contains Judge · 关键词匹配 (deterministic)
 *
 * pass = 所有 contains 命中 AND 没有 avoids 命中.
 * score = (命中数 - 误命中数) / 总要求数, clamped 0-1.
 */
export const containsJudge: Judge = async (actual, c) => {
  const exp = c.expected;
  if (!exp || (!exp.contains?.length && !exp.avoids?.length)) {
    return { pass: true, score: 1, reasoning: '(no contains/avoids 检查项, skip)' };
  }

  const contains = exp.contains ?? [];
  const avoids = exp.avoids ?? [];
  const text = String(actual);

  const containsHit = contains.filter((s) => text.includes(s));
  const containsMissed = contains.filter((s) => !text.includes(s));
  const avoidsHit = avoids.filter((s) => text.includes(s));

  const total = contains.length + avoids.length;
  const correct = containsHit.length + (avoids.length - avoidsHit.length);
  const score = total > 0 ? Math.max(0, Math.min(1, correct / total)) : 1;

  const pass = containsMissed.length === 0 && avoidsHit.length === 0;

  const reasoningParts: string[] = [];
  if (containsHit.length > 0) reasoningParts.push(`命中: [${containsHit.join(', ')}]`);
  if (containsMissed.length > 0) reasoningParts.push(`漏掉: [${containsMissed.join(', ')}]`);
  if (avoidsHit.length > 0) reasoningParts.push(`不该说但说了: [${avoidsHit.join(', ')}]`);

  return {
    pass,
    score,
    reasoning: reasoningParts.length > 0 ? reasoningParts.join(' · ') : 'OK',
  };
};

/**
 * LLM-as-Judge Rubric · 用便宜模型评分 (0-5 转 0-1)
 *
 * Prompt 让 judge 严格 JSON: { score: 0-5, pass: bool, reasoning: str }
 * 失败时返回 score=0, pass=false (不让 judge 故障让 suite 误绿).
 */
export const llmRubricJudge: Judge = async (actual, c) => {
  const rubric = c.expected?.rubric;
  if (!rubric) {
    return { pass: true, score: 1, reasoning: '(no rubric, skip llm judge)' };
  }

  try {
    const { getRouter } = await import('@/lib/boot');
    const router = getRouter();

    const reply = await router.chat({
      messages: [
        {
          role: 'system',
          content:
            '你是一名严格的评审. 拿到 [模型输出] + [评分准则], 给出 0-5 整数分 + pass(bool) + 一句话 reasoning.\n' +
            '5 = 完美贴合准则; 4 = 大部分贴合, 小瑕疵; 3 = 部分贴合; 2 = 模糊; 1 = 明显偏离; 0 = 完全错误.\n' +
            '严格输出 JSON: {"score": 0-5, "pass": true|false, "reasoning": "..."}. 不要 markdown, 不要其它文字.',
        },
        {
          role: 'user',
          content: [
            '【评分准则】',
            rubric,
            '',
            '【模型输出】',
            String(actual).slice(0, 4000),
          ].join('\n'),
        },
      ],
      scenario: 'high_frequency',
      maxTokens: 400,
      temperature: 0,
    });

    const content =
      typeof reply.message.content === 'string' ? reply.message.content : '';
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) {
      return { pass: false, score: 0, reasoning: `(judge 输出非 JSON: ${content.slice(0, 100)})` };
    }
    const parsed = JSON.parse(m[0]) as { score?: unknown; pass?: unknown; reasoning?: unknown };
    const score5 = typeof parsed.score === 'number' ? parsed.score : 0;
    const pass = parsed.pass === true;
    const reasoning =
      typeof parsed.reasoning === 'string' ? parsed.reasoning : '(no reasoning)';

    return {
      pass,
      score: Math.max(0, Math.min(1, score5 / 5)),
      reasoning,
    };
  } catch (err) {
    return {
      pass: false,
      score: 0,
      reasoning: `(judge 异常: ${(err as Error).message})`,
    };
  }
};

/**
 * 合成多个 judge: 取最低 score, pass = 所有 judge 都 pass.
 * reasoning = 拼接.
 */
export function composeJudges(...judges: Judge[]): Judge {
  return async (actual, c) => {
    const results = await Promise.all(judges.map((j) => j(actual, c)));
    const score = Math.min(...results.map((r) => r.score));
    const pass = results.every((r) => r.pass);
    const reasoning = results.map((r) => r.reasoning).join(' | ');
    return { pass, score, reasoning };
  };
}
