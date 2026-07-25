import { describe, it, expect } from 'vitest';
import type { EvalGrade, EvalTrace } from '@/lib/types/eval';
import { pmsStructuredGrader, pmsGroundedGrader, pmsAiLiveGrader, runRuleGraders, type Grader } from '@/lib/eval/graders';
import { countGroundedRefs } from '@/lib/pms/ai-service';

/** rule graders 均同步; 断言为 EvalGrade 便于取字段 */
const g = (grader: Grader, trace: EvalTrace): EvalGrade => grader.grade(trace) as EvalGrade;

function mkTrace(meta: Record<string, unknown>, outputSummary = 'x'): EvalTrace {
  return {
    id: 'evt_x',
    traceId: 't',
    tenantId: 'default',
    kind: 'pms_analysis',
    actorUserId: '__pms_ai__',
    isProxy: false,
    inputSummary: 'in',
    toolInvocations: [],
    finalOutputSummary: outputSummary,
    roundsExecuted: 0,
    finishedNaturally: true,
    tokensUsed: 100,
    latencyMs: 0,
    meta,
    grades: [],
    createdAt: new Date().toISOString(),
  };
}

describe('pms-ai · countGroundedRefs', () => {
  it('统计输出命中的输入实体数 (去重, 忽略过短)', () => {
    expect(countGroundedRefs(['成都医院', '冷水机组', '开利'], '成都医院项目冷水机组被开利替换风险')).toBe(3);
    expect(countGroundedRefs(['成都医院', '不存在'], '成都医院有风险')).toBe(1);
    expect(countGroundedRefs(['a'], 'aaaa')).toBe(0); // 过短(<2)忽略
    expect(countGroundedRefs([], 'anything')).toBe(0);
    expect(countGroundedRefs(['x'], '')).toBe(0);
  });
});

describe('pms-eval · graders', () => {
  it('pms-structured: parsed 且输出非空 → pass', () => {
    expect(g(pmsStructuredGrader, mkTrace({ parsed: true }, '有内容')).pass).toBe(true);
    expect(g(pmsStructuredGrader, mkTrace({ parsed: false }, '有内容')).pass).toBe(false);
    expect(g(pmsStructuredGrader, mkTrace({ parsed: true }, '')).pass).toBe(false);
  });

  it('pms-grounded: groundedRefs>=1 → pass', () => {
    expect(g(pmsGroundedGrader, mkTrace({ groundedRefs: 2 })).pass).toBe(true);
    expect(g(pmsGroundedGrader, mkTrace({ groundedRefs: 0 })).pass).toBe(false);
    expect(g(pmsGroundedGrader, mkTrace({})).pass).toBe(false);
  });

  it('pms-ai-live: source=ai 满分, 降级 rule 半分但恒 pass (观测)', () => {
    const ai = g(pmsAiLiveGrader, mkTrace({ source: 'ai' }));
    expect(ai.score).toBe(1);
    expect(ai.pass).toBe(true);
    const rule = g(pmsAiLiveGrader, mkTrace({ source: 'rule' }));
    expect(rule.score).toBe(0.5);
    expect(rule.pass).toBe(true);
  });

  it('runRuleGraders 对 pms_analysis 跑出 PMS 三项 + 通用项, 不含 tool-grounded (无 tool)', () => {
    const grades = runRuleGraders(mkTrace({ parsed: true, groundedRefs: 1, source: 'ai' }, 'out'));
    const ids = grades.map((gr) => gr.graderId);
    expect(ids).toContain('pms-structured');
    expect(ids).toContain('pms-grounded');
    expect(ids).toContain('pms-ai-live');
    expect(ids).not.toContain('tool-grounded'); // tool-grounded 不 appliesTo pms_analysis
  });
});
