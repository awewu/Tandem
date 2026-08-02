import { describe, it, expect } from 'vitest';
import { analyzeQuotePricing, median, type QuoteInsightInput } from '@/lib/pms/quote-insights';
import type { QuoteSystem } from '@/lib/types/pms';

function q(id: string, dealerOrgId: string, items: Array<{ key?: string; model?: string; unitPrice: number; costType?: 'equipment' | 'material' }>): QuoteInsightInput {
  const systems: QuoteSystem[] = [
    {
      id: `${id}_sys`,
      name: 's',
      subtotal: 0,
      items: items.map((it, i) => ({
        id: `${id}_it${i}`,
        costType: it.costType ?? 'equipment',
        model: it.model,
        productCatalogId: it.key,
        quantity: 1,
        listPrice: it.unitPrice,
        unitPrice: it.unitPrice,
        amount: it.unitPrice,
      })),
    },
  ];
  return { id, dealerOrgId, systems };
}

describe('median', () => {
  it('奇/偶数长度', () => {
    expect(median([100, 300, 200])).toBe(200);
    expect(median([100, 200, 300, 400])).toBe(250);
    expect(median([])).toBe(0);
  });
});

describe('analyzeQuotePricing', () => {
  it('空输入 → 零统计零异常', () => {
    const r = analyzeQuotePricing([]);
    expect(r.quoteCount).toBe(0);
    expect(r.productStats).toHaveLength(0);
    expect(r.anomalies).toHaveLength(0);
  });

  it('分产品统计 min/max/median/mean 正确', () => {
    const quotes = [
      q('a', 'org1', [{ key: 'cat1', model: 'HP-12', unitPrice: 1000 }]),
      q('b', 'org2', [{ key: 'cat1', model: 'HP-12', unitPrice: 2000 }]),
      q('c', 'org3', [{ key: 'cat1', model: 'HP-12', unitPrice: 3000 }]),
    ];
    const r = analyzeQuotePricing(quotes);
    expect(r.quoteCount).toBe(3);
    const stat = r.productStats.find((s) => s.productKey === 'cat1')!;
    expect(stat.count).toBe(3);
    expect(stat.min).toBe(1000);
    expect(stat.max).toBe(3000);
    expect(stat.median).toBe(2000);
    expect(stat.mean).toBe(2000);
  });

  it('below_floor: 单价低于目录限价 → critical, 且不重复报 low_outlier', () => {
    const quotes = [
      q('a', 'org1', [{ key: 'cat1', unitPrice: 600 }]),
      q('b', 'org2', [{ key: 'cat1', unitPrice: 1000 }]),
      q('c', 'org3', [{ key: 'cat1', unitPrice: 1000 }]),
    ];
    const floors = new Map([['cat1', 800]]);
    const r = analyzeQuotePricing(quotes, floors);
    const belowFloor = r.anomalies.filter((a) => a.type === 'below_floor');
    expect(belowFloor).toHaveLength(1);
    expect(belowFloor[0].quoteId).toBe('a');
    expect(belowFloor[0].severity).toBe('critical');
    expect(belowFloor[0].floor).toBe(800);
    // 破限价的行不应再报 low_outlier
    expect(r.anomalies.filter((a) => a.quoteId === 'a' && a.type === 'low_outlier')).toHaveLength(0);
  });

  it('low_outlier: ≥3 同侪, 低于中位数 30%/50% 分级 warning/critical', () => {
    const quotes = [
      q('a', 'org1', [{ key: 'cat1', unitPrice: 1000 }]),
      q('b', 'org2', [{ key: 'cat1', unitPrice: 1000 }]),
      q('c', 'org3', [{ key: 'cat1', unitPrice: 1000 }]),
      q('d', 'org4', [{ key: 'cat1', unitPrice: 600 }]), // 低 40% → warning
      q('e', 'org5', [{ key: 'cat1', unitPrice: 400 }]), // 低 60% → critical
    ];
    const r = analyzeQuotePricing(quotes);
    const warn = r.anomalies.find((a) => a.quoteId === 'd');
    const crit = r.anomalies.find((a) => a.quoteId === 'e');
    expect(warn?.type).toBe('low_outlier');
    expect(warn?.severity).toBe('warning');
    expect(crit?.severity).toBe('critical');
  });

  it('同侪不足 (<3 份) → 不报 low_outlier', () => {
    const quotes = [
      q('a', 'org1', [{ key: 'cat1', unitPrice: 1000 }]),
      q('b', 'org2', [{ key: 'cat1', unitPrice: 300 }]),
    ];
    const r = analyzeQuotePricing(quotes);
    expect(r.anomalies.filter((a) => a.type === 'low_outlier')).toHaveLength(0);
  });

  it('无目录 id 的非设备行不参与归集; 设备行按 model 归集', () => {
    const quotes = [
      q('a', 'org1', [{ model: 'HP-X', unitPrice: 1000, costType: 'equipment' }]),
      q('b', 'org2', [{ model: '辅材A', unitPrice: 10, costType: 'material' }]), // 无 key 非设备 → 忽略
    ];
    const r = analyzeQuotePricing(quotes);
    expect(r.productStats.find((s) => s.productKey === 'model:HP-X')).toBeDefined();
    expect(r.productStats.find((s) => s.productLabel === '辅材A')).toBeUndefined();
  });
});
