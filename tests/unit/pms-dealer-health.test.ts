import { describe, it, expect } from 'vitest';
import {
  computeHealthScore,
  healthRank,
  DEFAULT_HEALTH_WEIGHTS,
} from '@/lib/pms/dealer-health-service';

describe('PMS dealer-health · computeHealthScore', () => {
  it('全满分 → 100', () => {
    expect(computeHealthScore({ compliance: 100, performance: 100, service: 100, cooperation: 100 })).toBe(100);
  });
  it('加权求和 (默认权重 0.3/0.3/0.25/0.15)', () => {
    // 80*.3 + 90*.3 + 70*.25 + 60*.15 = 24 + 27 + 17.5 + 9 = 77.5
    expect(computeHealthScore({ compliance: 80, performance: 90, service: 70, cooperation: 60 })).toBe(77.5);
  });
  it('权重合计为 1', () => {
    const w = DEFAULT_HEALTH_WEIGHTS;
    expect(w.compliance + w.performance + w.service + w.cooperation).toBeCloseTo(1, 6);
  });
});

describe('PMS dealer-health · healthRank', () => {
  it('分档 A/B/C/D', () => {
    expect(healthRank(95)).toBe('A');
    expect(healthRank(90)).toBe('A');
    expect(healthRank(80)).toBe('B');
    expect(healthRank(75)).toBe('B');
    expect(healthRank(65)).toBe('C');
    expect(healthRank(60)).toBe('C');
    expect(healthRank(50)).toBe('D');
  });
});
