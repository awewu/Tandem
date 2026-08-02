import { describe, it, expect } from 'vitest';
import { nineBoxOutcome } from '../../lib/comp/review-service';

describe('review-service: nineBoxOutcome 映射', () => {
  it('(3,3) 高潜力高绩效 → promote', () => {
    expect(nineBoxOutcome(3, 3)).toBe('promote');
  });

  it('(3,2) 高潜力中绩效 → promote', () => {
    expect(nineBoxOutcome(3, 2)).toBe('promote');
  });

  it('(2,2) 中潜力中绩效 → hold', () => {
    expect(nineBoxOutcome(2, 2)).toBe('hold');
  });

  it('(1,1) 低潜力低绩效 → demote', () => {
    expect(nineBoxOutcome(1, 1)).toBe('demote');
  });

  it('(2,1) 中潜力低绩效 → pip', () => {
    expect(nineBoxOutcome(2, 1)).toBe('pip');
  });

  it('(3,1) 高潜力低绩效 → watch', () => {
    expect(nineBoxOutcome(3, 1)).toBe('watch');
  });

  it('越界值 → hold (安全缺省)', () => {
    expect(nineBoxOutcome(0, 0)).toBe('hold');
    expect(nineBoxOutcome(4, 4)).toBe('hold');
  });
});
