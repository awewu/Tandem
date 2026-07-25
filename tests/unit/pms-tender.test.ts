import { describe, it, expect } from 'vitest';
import { canTransitionTender, bidDiscountRate } from '@/lib/pms/tender-service';
import { weightedPipelineValue, OPPORTUNITY_STAGE_PROBABILITY } from '@/lib/pms/project-service';

describe('PMS tender · FSM canTransitionTender', () => {
  it('合法流转', () => {
    expect(canTransitionTender('preparing', 'submitted')).toBe(true);
    expect(canTransitionTender('submitted', 'opened')).toBe(true);
    expect(canTransitionTender('opened', 'won')).toBe(true);
    expect(canTransitionTender('opened', 'lost')).toBe(true);
  });
  it('任一非终态可 lost', () => {
    expect(canTransitionTender('preparing', 'lost')).toBe(true);
    expect(canTransitionTender('submitted', 'lost')).toBe(true);
  });
  it('非法流转 + 终态', () => {
    expect(canTransitionTender('preparing', 'opened')).toBe(false); // 跳过 submitted
    expect(canTransitionTender('submitted', 'won')).toBe(false);
    expect(canTransitionTender('won', 'lost')).toBe(false);
    expect(canTransitionTender('lost', 'preparing')).toBe(false);
    expect(canTransitionTender('unknown', 'submitted')).toBe(false);
  });
});

describe('PMS tender · bidDiscountRate (下浮率)', () => {
  it('正常下浮率保留两位', () => {
    expect(bidDiscountRate(1000000, 900000)).toBe(10);
    expect(bidDiscountRate(1000000, 855000)).toBe(14.5);
  });
  it('报价>=控制价 → 0', () => {
    expect(bidDiscountRate(1000000, 1000000)).toBe(0);
    expect(bidDiscountRate(1000000, 1100000)).toBe(0);
  });
  it('缺失/非法 → null', () => {
    expect(bidDiscountRate(undefined, 900000)).toBeNull();
    expect(bidDiscountRate(1000000, undefined)).toBeNull();
    expect(bidDiscountRate(0, 900000)).toBeNull();
  });
});

describe('PMS project · weightedPipelineValue (管道加权)', () => {
  it('按阶段概率加权; won=1; lost/cancelled=0', () => {
    const p = weightedPipelineValue([
      { stage: 'bidding', status: 'active', estimatedAmount: 1000000 }, // 0.6 → 600000
      { stage: 'negotiation', status: 'active', estimatedAmount: 500000 }, // 0.8 → 400000
      { stage: 'won', status: 'won', estimatedAmount: 300000 }, // 1.0 → 300000
      { stage: 'lost', status: 'lost', estimatedAmount: 999999 }, // 0
    ]);
    expect(p.opportunityCount).toBe(4);
    expect(p.wonValue).toBe(300000);
    expect(p.totalValue).toBe(1800000); // 1000000+500000+300000 (lost 排除)
    expect(p.weightedValue).toBe(1300000); // 600000+400000+300000
  });

  it('未知阶段回落 0.1', () => {
    const p = weightedPipelineValue([{ stage: 'mystery', status: 'active', estimatedAmount: 1000000 }]);
    expect(p.weightedValue).toBe(100000);
  });

  it('空 → 全 0', () => {
    const p = weightedPipelineValue([]);
    expect(p).toEqual({ opportunityCount: 0, totalValue: 0, weightedValue: 0, wonValue: 0 });
  });

  it('概率表覆盖常见阶段', () => {
    expect(OPPORTUNITY_STAGE_PROBABILITY.bidding).toBe(0.6);
    expect(OPPORTUNITY_STAGE_PROBABILITY.contract).toBe(0.95);
    expect(OPPORTUNITY_STAGE_PROBABILITY.won).toBe(1.0);
    expect(OPPORTUNITY_STAGE_PROBABILITY.lost).toBe(0);
  });
});
