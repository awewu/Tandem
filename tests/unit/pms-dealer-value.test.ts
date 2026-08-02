import { describe, it, expect } from 'vitest';
import { appealProgress, weakestDimension } from '@/lib/pms/dealer-value-service';

describe('dealer-value · appealProgress 撞单申诉进度可视', () => {
  it('pending → 第1步, 未完成', () => {
    const p = appealProgress('pending');
    expect(p.step).toBe(1);
    expect(p.total).toBe(3);
    expect(p.done).toBe(false);
    expect(p.outcome).toBeUndefined();
  });

  it('under_review → 第2步, 仲裁中', () => {
    const p = appealProgress('under_review');
    expect(p.step).toBe(2);
    expect(p.done).toBe(false);
  });

  it('approved → 第3步, 完成 + 成立', () => {
    const p = appealProgress('approved');
    expect(p.step).toBe(3);
    expect(p.done).toBe(true);
    expect(p.outcome).toBe('approved');
  });

  it('rejected → 第3步, 完成 + 维持撞单', () => {
    const p = appealProgress('rejected');
    expect(p.done).toBe(true);
    expect(p.outcome).toBe('rejected');
  });

  it('未知状态 → step 0 兜底', () => {
    expect(appealProgress('weird').step).toBe(0);
  });
});

describe('dealer-value · weakestDimension 健康分短板 (加权)', () => {
  it('取加权得分最低的维度', () => {
    // compliance 权重0.3 → 90*0.3=27; performance 0.3 → 40*0.3=12 (最低加权); service 0.25*80=20; cooperation 0.15*100=15
    const w = weakestDimension({ compliance: 90, performance: 40, service: 80, cooperation: 100 });
    expect(w?.key).toBe('performance');
    expect(w?.score).toBe(40);
  });

  it('协作虽分低但权重小, 不一定是加权最低', () => {
    // compliance 0.3*50=15; performance 0.3*90=27; service 0.25*90=22.5; cooperation 0.15*60=9 → cooperation 加权最低
    const w = weakestDimension({ compliance: 50, performance: 90, service: 90, cooperation: 60 });
    expect(w?.key).toBe('cooperation');
  });
});
