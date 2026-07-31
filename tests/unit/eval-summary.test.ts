/**
 * tests/unit/eval-summary.test.ts · #11/#14 显影记分卡聚合 (2026-07-29)
 *
 * 固化 computeEvalSummary 的边界: 空集合 → null; grader 通过率; 归因净胜率
 * 排除 insufficient_data; 近 7 天窗口。
 */

import { describe, it, expect } from 'vitest';
import { computeEvalSummary } from '@/lib/eval/summary';

const NOW = new Date('2026-07-29T00:00:00Z').getTime();
const iso = (daysAgo: number) => new Date(NOW - daysAgo * 86400_000).toISOString();

describe('computeEvalSummary', () => {
  it('空集合 → 比率类字段为 null, 计数为 0', () => {
    const s = computeEvalSummary([], [], NOW);
    expect(s.traceTotal).toBe(0);
    expect(s.gradePassRate).toBeNull();
    expect(s.gradeAvgScore).toBeNull();
    expect(s.attribNetWinRate).toBeNull();
    expect(s.attribAvgDelta).toBeNull();
  });

  it('grader 通过率与均分跨 trace 汇总', () => {
    const s = computeEvalSummary(
      [
        { createdAt: iso(1), grades: [{ score: 0.8, pass: true }, { score: 0.4, pass: false }] },
        { createdAt: iso(2), grades: [{ score: 0.9, pass: true }] },
        { createdAt: iso(3) }, // 未评分
      ],
      [],
      NOW,
    );
    expect(s.traceTotal).toBe(3);
    expect(s.gradedTotal).toBe(2);
    expect(s.gradePassRate).toBeCloseTo(2 / 3); // 3 grade 中 2 pass
    expect(s.gradeAvgScore).toBeCloseTo((0.8 + 0.4 + 0.9) / 3);
  });

  it('近 7 天窗口只数窗口内 trace', () => {
    const s = computeEvalSummary(
      [{ createdAt: iso(1) }, { createdAt: iso(6) }, { createdAt: iso(10) }],
      [],
      NOW,
    );
    expect(s.traceLast7d).toBe(2);
  });

  it('归因净胜率排除 insufficient_data', () => {
    const s = computeEvalSummary(
      [],
      [
        { verdict: 'positive', progressDelta: 0.2 },
        { verdict: 'positive', progressDelta: 0.1 },
        { verdict: 'negative', progressDelta: -0.1 },
        { verdict: 'neutral', progressDelta: 0 },
        { verdict: 'insufficient_data', progressDelta: 0 },
      ],
      NOW,
    );
    expect(s.attribTotal).toBe(5);
    expect(s.attribPositive).toBe(2);
    expect(s.attribNegative).toBe(1);
    expect(s.attribInsufficient).toBe(1);
    // 有效判定 = 4 (排除 insufficient); (2-1)/4 = 0.25
    expect(s.attribNetWinRate).toBeCloseTo(0.25);
    expect(s.attribAvgDelta).toBeCloseTo((0.2 + 0.1 - 0.1 + 0 + 0) / 5);
  });

  it('全 insufficient_data → 净胜率 null', () => {
    const s = computeEvalSummary(
      [],
      [{ verdict: 'insufficient_data', progressDelta: 0 }],
      NOW,
    );
    expect(s.attribNetWinRate).toBeNull();
  });
});
