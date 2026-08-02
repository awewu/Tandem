import { describe, it, expect } from 'vitest';
import { aggregatePeerScores } from '../../lib/comp/peer-review-service';

describe('aggregatePeerScores', () => {
  it('returns 0 for empty scores', () => {
    const r = aggregatePeerScores([]);
    expect(r.peerScore).toBe(0);
    expect(r.effectiveCount).toBe(0);
  });

  it('returns average for <3 scores (no drop)', () => {
    const r = aggregatePeerScores([0.8, 0.6]);
    expect(r.peerScore).toBeCloseTo(0.7, 5);
    expect(r.effectiveCount).toBe(2);
    expect(r.droppedHigh).toBeNull();
    expect(r.droppedLow).toBeNull();
  });

  it('drops highest and lowest for 4 scores', () => {
    const r = aggregatePeerScores([0.9, 0.7, 0.5, 0.8]);
    expect(r.droppedHigh).toBe(0.9);
    expect(r.droppedLow).toBe(0.5);
    expect(r.effectiveCount).toBe(2);
    expect(r.peerScore).toBeCloseTo(0.75, 5);
  });

  it('drops highest and lowest for 3 scores', () => {
    const r = aggregatePeerScores([1.0, 0.6, 0.8]);
    expect(r.droppedHigh).toBe(1.0);
    expect(r.droppedLow).toBe(0.6);
    expect(r.peerScore).toBeCloseTo(0.8, 5);
  });

  it('filters out NaN and out-of-range scores', () => {
    const r = aggregatePeerScores([0.8, NaN, 1.5, -0.1, 0.6, 0.9]);
    expect(r.rawScores).toEqual([0.8, 0.6, 0.9]);
    expect(r.effectiveCount).toBe(1);
    expect(r.peerScore).toBeCloseTo(0.8, 5);
  });
});
