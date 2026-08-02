import { describe, it, expect } from 'vitest';
import { evaluateQuarter, evaluateQuarterMulti } from '../../lib/comp/quarter-gate';
import { initGradeState, DEFAULT_GRADE_CONFIG } from '../../lib/comp/grade-machine';

describe('evaluateQuarter', () => {
  it('returns meet when KPI achievement >= 80%', () => {
    const r = evaluateQuarter({ currentValue: 90, targetValue: 100 }, initGradeState());
    expect(r.outcome).toBe('meet');
    expect(r.newState.state).toBe('stable');
    expect(r.requiresAck).toBe(false);
  });

  it('returns below when KPI achievement < 80%', () => {
    const r = evaluateQuarter({ currentValue: 70, targetValue: 100 }, initGradeState());
    expect(r.outcome).toBe('below');
    expect(r.newState.state).toBe('watch');
  });

  it('triggers PIP ack after 2 consecutive below', () => {
    let s = initGradeState();
    s = evaluateQuarter({ currentValue: 70, targetValue: 100 }, s).newState;
    const r2 = evaluateQuarter({ currentValue: 60, targetValue: 100 }, s);
    expect(r2.newState.state).toBe('improvement');
    expect(r2.requiresAck).toBe(true);
    expect(r2.ackType).toBe('PIP告知');
  });

  it('triggers demotion ack after improvement exhausted', () => {
    let s = initGradeState();
    s = evaluateQuarter({ currentValue: 50, targetValue: 100 }, s).newState;
    s = evaluateQuarter({ currentValue: 50, targetValue: 100 }, s).newState;
    const r3 = evaluateQuarter({ currentValue: 50, targetValue: 100 }, s);
    expect(r3.newState.state).toBe('demotion');
    expect(r3.ackType).toBe('降职生效');
  });
});

describe('evaluateQuarterMulti', () => {
  it('returns meet when all KPIs pass', () => {
    const r = evaluateQuarterMulti(
      { items: [{ currentValue: 100, targetValue: 100 }, { currentValue: 110, targetValue: 100 }] },
      initGradeState(),
    );
    expect(r.outcome).toBe('meet');
  });

  it('returns below when any KPI hard-cuts', () => {
    const r = evaluateQuarterMulti(
      { items: [{ currentValue: 100, targetValue: 100 }, { currentValue: 50, targetValue: 100 }] },
      initGradeState(),
    );
    expect(r.outcome).toBe('below');
  });

  it('returns meet for empty items', () => {
    const r = evaluateQuarterMulti({ items: [] }, initGradeState());
    expect(r.outcome).toBe('meet');
  });
});
