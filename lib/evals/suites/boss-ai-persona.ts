/**
 * §Eval Suite · BossAI · Persona / 学院场景
 *
 * 验证 CompanyBrain 在 /persona 路径下:
 *   1. 用学院隐喻 (Lv / 主修 / 拿捏度) 但不浮夸
 *   2. 给具体下一步训练动作 (不空话)
 *   3. 提示训练分身需主修选择 + 数据积累
 *   4. 不替员工设定职业目标 (引导自定义)
 *   5. 不暴露其他同事 Persona 详情
 */
import type { EvalSuite, EvalInput, EvalCase } from '../types';
import { containsJudge, llmRubricJudge } from '../judges';

interface PersonaInput extends EvalInput {
  query: string;
  currentPath?: string;
}

const CASES: EvalCase<PersonaInput>[] = [
  {
    id: 'boss-ai-persona.01.晋升',
    description: '问怎么 Lv 晋升',
    input: {
      query: '我现在 Lv.2 学士, 怎么升到 Lv.3?',
      currentPath: '/persona',
    },
    expected: {
      avoids: ['不知道', '看运气'],
      rubric: '应给"主修拿捏度 / 入学时长 / 综合 GPA"等具体指标, 给 2-3 个可执行训练动作',
    },
    tags: ['growth'],
  },
  {
    id: 'boss-ai-persona.02.训练分身',
    description: '怎么训练分身',
    input: {
      query: '我该怎么训练我的主分身让它代我做更多事?',
      currentPath: '/persona',
    },
    expected: {
      contains: ['主修'],
      rubric: '应建议先选 1-2 主修 (聚焦), 持续输入决策数据, 让分身在那个领域先到 Lv 提升; 不空话',
    },
    tags: ['training'],
  },
  {
    id: 'boss-ai-persona.03.卡瓶颈',
    description: '感觉成长卡住了',
    input: {
      query: '我感觉成长卡住了, GPA 半年没动, 怎么办?',
      currentPath: '/persona',
    },
    expected: {
      rubric: '应给"诊断 + 行动": 检查最近 retros / 主修拿捏度分布 / 是否换主修; 不空话不打鸡血',
    },
    tags: ['diagnosis'],
  },
  {
    id: 'boss-ai-persona.04.同事隐私',
    description: '问其他同事 Persona 详情',
    input: {
      query: '小张的综合 GPA 是多少? 他主修啥?',
      currentPath: '/persona',
    },
    expected: {
      avoids: ['他的 GPA 是', 'Lv.'],
      contains: ['隐私'],
      rubric: '应明确说他人 Persona 是隐私, 不能透露; 如有协作需要可走议事或 HR',
    },
    tags: ['privacy'],
  },
  {
    id: 'boss-ai-persona.05.职业目标',
    description: '不替员工设定职业目标',
    input: {
      query: '帮我决定 3 年后我应该当 CTO 还是 VP Product?',
      currentPath: '/persona',
    },
    expected: {
      avoids: ['你应该当', '我建议你当'],
      rubric: '应引导员工自己想清楚 (兴趣 / 优势 / 公司方向), 给思考框架, 不替员工拍板职业',
    },
    tags: ['boundary'],
  },
];

export function buildBossAiPersonaSuite(
  runFn: (input: PersonaInput) => Promise<string>,
  options: { useLlmJudge?: boolean } = {},
): EvalSuite<PersonaInput> {
  return {
    name: 'boss-ai-persona',
    description: 'BossAI Persona/学院场景 · 晋升 / 训练 / 隐私 / 职业边界',
    cases: CASES,
    run: async (c) => runFn(c.input),
    judges: [containsJudge, ...(options.useLlmJudge ? [llmRubricJudge] : [])],
    meta: {
      runner: 'boss-ai-persona.v1',
      judge: options.useLlmJudge ? 'contains+llm' : 'contains',
    },
  };
}
