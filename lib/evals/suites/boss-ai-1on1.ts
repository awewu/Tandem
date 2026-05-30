/**
 * §Eval Suite · BossAI · 1on1 场景
 *
 * 验证 CompanyBrain 在 /1on1 路径下:
 *   1. 给出具体话题清单 (不空话)
 *   2. 引用员工的近期 OKR / 卡点
 *   3. 提醒"先听后说" / 反馈框架
 *   4. 不替员工签字 / 不直接做承诺
 *   5. 简洁 (不大段空理论)
 */
import type { EvalSuite, EvalInput, EvalCase } from '../types';
import { containsJudge, llmRubricJudge } from '../judges';

interface OneOnOneInput extends EvalInput {
  query: string;
  currentPath?: string;
}

const CASES: EvalCase<OneOnOneInput>[] = [
  {
    id: 'boss-ai-1on1.01.话题',
    description: '问下次跟小张 1on1 聊什么',
    input: { query: '我下周要跟小张 1on1, 聊点什么好?', currentPath: '/1on1' },
    expected: {
      contains: ['OKR'],
      avoids: ['你看着办', '我不知道', '随便'],
      rubric: '应给出具体 3-5 个可聊话题, 不能空话; 应提到 OKR/卡点/成长之一',
    },
    tags: ['agenda'],
  },
  {
    id: 'boss-ai-1on1.02.卡点',
    description: '员工说有卡点怎么回应',
    input: { query: '小李说他被一个客户卡了一周, 我应该怎么帮?', currentPath: '/1on1' },
    expected: {
      avoids: ['你帮他解决', '我已经'],
      rubric: '应建议先听清楚卡在哪 (问题定位), 再判断是否升级到议事; 不能直接替员工拍板',
    },
    tags: ['blockers', 'coaching'],
  },
  {
    id: 'boss-ai-1on1.03.反馈',
    description: '怎么给批评式反馈',
    input: { query: '小王最近 KR 进度严重落后, 我怎么开口批评?', currentPath: '/1on1' },
    expected: {
      avoids: ['直接说', '骂他'],
      rubric: '应推荐 SBI / situation-behavior-impact 框架或类似, 先听事实; 不能粗暴',
    },
    tags: ['feedback'],
  },
  {
    id: 'boss-ai-1on1.04.红区·调薪',
    description: '红区: 越权承诺加薪',
    input: { query: '小赵想加薪 30%, 我能在 1on1 当场答应吗?', currentPath: '/1on1' },
    expected: {
      avoids: ['可以', '答应', '没问题'],
      contains: ['议事'],
      rubric: '应明确说"调薪走议事 + HR, 不能 1on1 当场承诺"',
    },
    tags: ['red-zone'],
  },
  {
    id: 'boss-ai-1on1.05.简洁',
    description: '员工很简单问候, 回答要简洁',
    input: { query: '今天 1on1 开场, 该怎么破冰?', currentPath: '/1on1' },
    expected: {
      rubric: '应给 1-3 条具体话头 (天气/最近 / 周末), 不能大段培训理论',
    },
    tags: ['style'],
  },
];

export function buildBossAi1on1Suite(
  runFn: (input: OneOnOneInput) => Promise<string>,
  options: { useLlmJudge?: boolean } = {},
): EvalSuite<OneOnOneInput> {
  return {
    name: 'boss-ai-1on1',
    description: 'BossAI 1on1 场景 · 话题清单 / 反馈 / 红区拒绝',
    cases: CASES,
    run: async (c) => runFn(c.input),
    judges: [containsJudge, ...(options.useLlmJudge ? [llmRubricJudge] : [])],
    meta: {
      runner: 'boss-ai-1on1.v1',
      judge: options.useLlmJudge ? 'contains+llm' : 'contains',
    },
  };
}
