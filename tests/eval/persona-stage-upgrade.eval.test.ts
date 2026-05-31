/**
 * §P1a Eval Harness Skeleton — Persona Stage Upgrade Eligibility (offline, no LLM)
 *
 * 目的: 锁住 lib/persona/evolution.ts::checkUpgradeEligibility 在边界条件
 * (时长/决议数/否决率/已满级) 上的判定语义.
 *
 * 跑法: `npx vitest run tests/eval/persona-stage-upgrade.eval.test.ts`
 *
 * 通过门槛:
 *   - pass rate = 100% (升级语义关乎员工尊严, 任何 case 失败都得拍紧)
 *   - avg score ≥ 0.95
 */
import { describe, it, expect } from 'vitest';
import {
  runSuite,
  containsJudge,
  type EvalCase,
  type EvalInput,
  type EvalSuite,
} from '@/lib/evals';
import { checkUpgradeEligibility } from '@/lib/persona/evolution';
import type { Persona, PersonaStage } from '@/lib/types/persona';

// ──────────────────────────────────────────────────────────────────
// Persona fixture builder
// ──────────────────────────────────────────────────────────────────

const NOW = Date.now();
const D = (daysAgo: number) => new Date(NOW - daysAgo * 86_400_000).toISOString();

function buildPersona(opts: {
  stage: PersonaStage;
  daysInStage: number;
  totalDecisions: number;
  vetoRate: number;
}): Persona {
  return {
    id: 'p_test',
    userId: 'u_test',
    schemaVersion: 'tandem.v1',
    stage: opts.stage,
    stageEnteredAt: D(opts.daysInStage),
    delegationLevel: 'observe_only',
    decisionHistory: {
      totalDecisions: opts.totalDecisions,
      selfMade: 0,
      aiAssisted: opts.totalDecisions,
      vetoedByUser: Math.round(opts.totalDecisions * opts.vetoRate),
      vetoRate: opts.vetoRate,
    },
    styleProfile: {
      decisionSpeed: 'medium',
      riskAppetite: 0.5,
      communicationStyle: 'analytical',
      preferredOptions: [],
      communicationExamples: [],
    },
    growthAreas: [],
    bossCaptureScore: 50,
    dataOwnership: {
      companyOwnsData: true,
      anonymizationPending: false,
      employeeCanExportOrigins: true,
    },
    createdAt: D(opts.daysInStage),
    updatedAt: D(0),
    learningActive: true,
  };
}

// ──────────────────────────────────────────────────────────────────
// Suite cases · 6 边界 case
// ──────────────────────────────────────────────────────────────────

interface PersonaInput extends EvalInput {
  context: { persona: Persona };
}

/**
 * 评分: actualOutput = `eligible=<bool> | nextStage=<stage|null> | reason=<text>`.
 * 用 contains/avoids 锁判定 + 期望阶段 (不锁原因措辞).
 */
const cases: EvalCase<PersonaInput>[] = [
  {
    id: 'persona-upgrade.case-1-newborn-eligible',
    description: 'newborn 满 14 天 + 10 决议 + 否决率 20% → 可升 apprentice',
    input: {
      context: { persona: buildPersona({ stage: 'newborn', daysInStage: 15, totalDecisions: 10, vetoRate: 0.2 }) },
    },
    expected: { contains: ['eligible=true', 'nextStage=apprentice'] },
  },
  {
    id: 'persona-upgrade.case-2-newborn-too-young',
    description: 'newborn 才 5 天 → 时长不够, 不能升级',
    input: {
      context: { persona: buildPersona({ stage: 'newborn', daysInStage: 5, totalDecisions: 50, vetoRate: 0.05 }) },
    },
    expected: { contains: ['eligible=false', 'nextStage=apprentice'], avoids: ['eligible=true'] },
  },
  {
    id: 'persona-upgrade.case-3-apprentice-veto-too-high',
    description: 'apprentice 满时长 + 决议数, 但否决率 40% (> 30% 上限) → 不能升级',
    input: {
      context: { persona: buildPersona({ stage: 'apprentice', daysInStage: 70, totalDecisions: 60, vetoRate: 0.4 }) },
    },
    expected: { contains: ['eligible=false', 'nextStage=assistant'], avoids: ['eligible=true'] },
  },
  {
    id: 'persona-upgrade.case-4-assistant-eligible',
    description: 'assistant 满 180d + 200 决议 + vetoRate 15% → 可升 deputy',
    input: {
      context: { persona: buildPersona({ stage: 'assistant', daysInStage: 200, totalDecisions: 250, vetoRate: 0.15 }) },
    },
    expected: { contains: ['eligible=true', 'nextStage=deputy'] },
  },
  {
    id: 'persona-upgrade.case-5-deputy-decisions-shy',
    description: 'deputy 满 365d 但只有 500 决议 (需要 800) → 不能升级',
    input: {
      context: { persona: buildPersona({ stage: 'deputy', daysInStage: 400, totalDecisions: 500, vetoRate: 0.05 }) },
    },
    expected: { contains: ['eligible=false', 'nextStage=partner'], avoids: ['eligible=true'] },
  },
  {
    id: 'persona-upgrade.case-6-partner-already-top',
    description: 'partner 已最高级 → eligible=false 且 nextStage=null',
    input: {
      context: { persona: buildPersona({ stage: 'partner', daysInStage: 999, totalDecisions: 9999, vetoRate: 0.05 }) },
    },
    expected: { contains: ['eligible=false', 'nextStage=null'], avoids: ['eligible=true'] },
  },
];

const suite: EvalSuite<PersonaInput> = {
  name: 'persona-stage-upgrade',
  description: 'checkUpgradeEligibility offline benchmark (no LLM, deterministic).',
  cases,
  run: async (c) => {
    const r = checkUpgradeEligibility(c.input.context.persona);
    return `eligible=${r.eligible} | nextStage=${r.nextStage} | reason=${r.reason}`;
  },
  judges: [containsJudge],
  meta: { runner: 'persona-stage-upgrade-v1', judge: 'containsJudge' },
};

// ──────────────────────────────────────────────────────────────────

describe('§eval · persona stage upgrade benchmark', () => {
  it('boundary cases on stage upgrade are decided correctly', async () => {
    const report = await runSuite(suite, { concurrency: 6 });

    if (report.failures.length > 0) {
      // eslint-disable-next-line no-console
      console.log('[persona-stage-upgrade] failures:', report.failures);
    }

    expect(report.total).toBe(cases.length);
    expect(report.passed).toBe(report.total);
    expect(report.avgScore).toBeGreaterThanOrEqual(0.95);
  });
});
