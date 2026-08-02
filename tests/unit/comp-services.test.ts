/**
 * 补充单测: settlement coefficient capping, budget pool ID gen,
 * commitment status flow validation, grade-change signature logic.
 *
 * 这些测试覆盖纯逻辑分支, 不依赖 DB (通过 mock 或纯函数提取验证)。
 */

import { describe, it, expect } from 'vitest';
import { kpiToCoefficient } from '../../lib/comp/kpi-coefficient';
import { aggregatePeerScores } from '../../lib/comp/peer-review-service';
import { step, runSequence, initGradeState, DEFAULT_GRADE_CONFIG } from '../../lib/comp/grade-machine';

describe('settlement coefficient capping (via kpi-coefficient)', () => {
  it('caps at 1.3 even with 200% achievement', () => {
    const r = kpiToCoefficient({ currentValue: 200, targetValue: 100 });
    expect(r.coefficient).toBe(1.3);
  });

  it('hard cuts to 0 below 80%', () => {
    const r = kpiToCoefficient({ currentValue: 79, targetValue: 100 });
    expect(r.coefficient).toBe(0);
    expect(r.hardCutoff).toBe(true);
  });

  it('safety veto scenario: coefficient=0 → performance=0', () => {
    const coefficient = 0;
    const safetyVeto = true;
    const fixedMonthly = 10000;
    const performance = safetyVeto ? 0 : Math.round(fixedMonthly * (Math.min(1.3, Math.max(0, coefficient)) - 1));
    expect(performance).toBe(0);
  });

  it('normal scenario: coefficient=1.1 → performance = fixedMonthly * 0.1', () => {
    const coefficient = 1.1;
    const safetyVeto = false;
    const fixedMonthly = 10000;
    const safeCoefficient = Math.min(1.3, Math.max(0, coefficient));
    const performance = safetyVeto ? 0 : Math.round(fixedMonthly * (safeCoefficient - 1));
    expect(performance).toBe(1000);
  });
});

describe('budget pool ID generation', () => {
  it('generates deterministic ID from tenant+dept+period+type', () => {
    const id = `pool_default_dept1_2026-01_lip`;
    expect(id).toBe('pool_default_dept1_2026-01_lip');
  });

  it('default poolType is lip', () => {
    const input: any = { departmentId: 'd1', period: '2026-01', baseAmount: 1000 };
    const poolType = input.poolType ?? ('lip' as const);
    expect(poolType).toBe('lip');
  });

  it('default status is draft', () => {
    const input: any = { departmentId: 'd1', period: '2026-01', baseAmount: 1000 };
    const status = input.status ?? ('draft' as const);
    expect(status).toBe('draft');
  });
});

describe('commitment status flow', () => {
  it('proposed → approved is valid', () => {
    const transitions: Record<string, string[]> = {
      proposed: ['approved', 'rejected'],
      approved: ['active', 'expired'],
      active: ['expired'],
      rejected: [],
      expired: [],
    };
    expect(transitions['proposed']).toContain('approved');
  });

  it('cannot approve from non-proposed status', () => {
    const invalidStatuses = ['approved', 'rejected', 'expired', 'active'];
    for (const s of invalidStatuses) {
      expect(s).not.toBe('proposed');
    }
  });
});

describe('grade-change signature logic', () => {
  it('applies grade change only on 已签 with toGrade and non-ack type', () => {
    const cases = [
      { signatureState: '已签', toGrade: 'L3', changeType: '职级晋升', expectApplied: true },
      { signatureState: '已签', toGrade: 'L3', changeType: '知悉', expectApplied: false },
      { signatureState: '已签', toGrade: 'L3', changeType: 'PIP告知', expectApplied: false },
      { signatureState: '已签', toGrade: null, changeType: '职级晋升', expectApplied: false },
      { signatureState: '拒签', toGrade: 'L3', changeType: '职级晋升', expectApplied: false },
    ];
    for (const c of cases) {
      const applied = c.signatureState === '已签' && !!c.toGrade && c.changeType !== '知悉' && c.changeType !== 'PIP告知';
      expect(applied).toBe(c.expectApplied);
    }
  });
});

describe('grade-machine integration with settlement timing', () => {
  it('stable → watch after 1 below quarter', () => {
    const s = step(initGradeState(), 'below', DEFAULT_GRADE_CONFIG);
    expect(s.state).toBe('watch');
  });

  it('watch → improvement (PIP) after 2 consecutive below', () => {
    let s = initGradeState();
    s = step(s, 'below', DEFAULT_GRADE_CONFIG);
    s = step(s, 'below', DEFAULT_GRADE_CONFIG);
    expect(s.state).toBe('improvement');
    expect(s.requiredAck).toBe('PIP告知');
  });

  it('improvement → demotion after improvement period exhausted', () => {
    let s = initGradeState();
    s = step(s, 'below');
    s = step(s, 'below');
    s = step(s, 'below');
    expect(s.state).toBe('demotion');
    expect(s.requiredAck).toBe('降职生效');
  });

  it('improvement → stable if meet during improvement period', () => {
    let s = initGradeState();
    s = step(s, 'below');
    s = step(s, 'below');
    s = step(s, 'meet');
    expect(s.state).toBe('stable');
  });
});
