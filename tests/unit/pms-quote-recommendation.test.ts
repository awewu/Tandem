import { describe, it, expect } from 'vitest';
import { pickTopRecommendation } from '@/lib/pms/quote-recommendation-service';

describe('PMS quote · pickTopRecommendation', () => {
  it('取评分最高', () => {
    const recs = [
      { model: 'A', score: 0.6 },
      { model: 'B', score: 0.9 },
      { model: 'C', score: 0.7 },
    ];
    expect(pickTopRecommendation(recs)?.model).toBe('B');
  });
  it('score 缺失视为 0', () => {
    const recs = [{ model: 'A' }, { model: 'B', score: 0.1 }];
    expect(pickTopRecommendation(recs)?.model).toBe('B');
  });
  it('空 → null', () => {
    expect(pickTopRecommendation([])).toBeNull();
    // @ts-expect-error 测试非法输入
    expect(pickTopRecommendation(null)).toBeNull();
  });
});
