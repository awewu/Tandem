import { describe, it, expect } from 'vitest';
import {
  winRate,
  summarizeOpportunities,
  buildFunnel,
  type AnalyticsOpp,
} from '@/lib/pms/analytics-service';

describe('PMS analytics · winRate', () => {
  it('won/(won+lost) 保留一位小数(%)', () => {
    expect(winRate(3, 1)).toBe(75);
    expect(winRate(1, 2)).toBe(33.3);
    expect(winRate(2, 1)).toBe(66.7);
  });

  it('分母为 0 → 0', () => {
    expect(winRate(0, 0)).toBe(0);
  });
});

describe('PMS analytics · summarizeOpportunities', () => {
  const opps: AnalyticsOpp[] = [
    { stage: 'following', status: 'active', estimatedAmount: 10000, region: '华东' },
    { stage: 'quoted', status: 'active', estimatedAmount: 20000, region: '华东' },
    { stage: 'closed', status: 'won', estimatedAmount: 50000, region: '华南' },
    { stage: 'closed', status: 'lost', estimatedAmount: 30000, region: '华南' },
  ];

  it('总数/状态分布/阶段分布/区域分布', () => {
    const s = summarizeOpportunities(opps);
    expect(s.total).toBe(4);
    expect(s.byStatus).toEqual({ active: 2, won: 1, lost: 1 });
    expect(s.byStage).toEqual({ following: 1, quoted: 1, closed: 2 });
    expect(s.byRegion).toEqual({ 华东: 2, 华南: 2 });
  });

  it('管道金额=active 之和, 赢单金额=won 之和', () => {
    const s = summarizeOpportunities(opps);
    expect(s.totalPipeline).toBe(30000);
    expect(s.wonAmount).toBe(50000);
  });

  it('赢单率=won/(won+lost)', () => {
    const s = summarizeOpportunities(opps);
    expect(s.won).toBe(1);
    expect(s.lost).toBe(1);
    expect(s.winRate).toBe(50);
  });

  it('空数组安全', () => {
    const s = summarizeOpportunities([]);
    expect(s.total).toBe(0);
    expect(s.winRate).toBe(0);
    expect(s.totalPipeline).toBe(0);
  });

  it('缺失金额/区域按 0/unknown 处理', () => {
    const s = summarizeOpportunities([{ stage: 'following', status: 'active' }]);
    expect(s.totalPipeline).toBe(0);
    expect(s.byRegion).toEqual({ unknown: 1 });
  });
});

describe('PMS analytics · buildFunnel', () => {
  it('按标准阶段顺序输出, 缺失档补 0', () => {
    const funnel = buildFunnel({ following: 3, quoted: 2, closed: 1 });
    expect(funnel[0]).toEqual({ stage: 'initial_contact', count: 0 });
    expect(funnel.find((f) => f.stage === 'following')).toEqual({ stage: 'following', count: 3 });
    expect(funnel.find((f) => f.stage === 'closed')).toEqual({ stage: 'closed', count: 1 });
  });

  it('自定义顺序', () => {
    const funnel = buildFunnel({ a: 5, b: 2 }, ['a', 'b', 'c']);
    expect(funnel).toEqual([
      { stage: 'a', count: 5 },
      { stage: 'b', count: 2 },
      { stage: 'c', count: 0 },
    ]);
  });
});
