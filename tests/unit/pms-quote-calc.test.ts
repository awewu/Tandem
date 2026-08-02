import { describe, it, expect } from 'vitest';
import {
  computeItemAmount,
  computeSystemSubtotal,
  computeQuoteTotals,
  recomputeQuote,
  genVerifyCode,
  isValidVerifyCodeFormat,
} from '@/lib/pms/quote-calc';
import type { QuoteSystem } from '@/lib/types/pms';

describe('PMS quote-calc · computeItemAmount 折后单价与行小计', () => {
  it('折扣计算: 面价 24700 × 0.85 × 1台', () => {
    const r = computeItemAmount({ listPrice: 24700, discountRate: 0.85, unitPrice: NaN, quantity: 1 });
    expect(r.unitPrice).toBe(20995);
    expect(r.amount).toBe(20995);
  });

  it('无折扣 = 面价', () => {
    const r = computeItemAmount({ listPrice: 9500, discountRate: undefined, unitPrice: NaN, quantity: 1 });
    expect(r.unitPrice).toBe(9500);
  });

  it('折后单价手填优先于折扣', () => {
    const r = computeItemAmount({ listPrice: 4600, discountRate: 0.85, unitPrice: 3910, quantity: 2 });
    expect(r.unitPrice).toBe(3910);
    expect(r.amount).toBe(7820);
  });

  it('数量为负/异常 → 归零, 不产生负金额', () => {
    const r = computeItemAmount({ listPrice: 100, discountRate: 1, unitPrice: NaN, quantity: -5 });
    expect(r.amount).toBe(0);
  });
});

describe('PMS quote-calc · computeSystemSubtotal / computeQuoteTotals 分项汇总', () => {
  const systems: QuoteSystem[] = [
    {
      id: 's1',
      name: '两联供系统',
      items: [
        { id: 'i1', costType: 'equipment', quantity: 1, listPrice: 24700, discountRate: 0.85, unitPrice: 20995, amount: 20995 },
        { id: 'i2', costType: 'installation', quantity: 1, listPrice: 600, unitPrice: 600, amount: 600 },
      ],
      subtotal: 0,
    },
    {
      id: 's2',
      name: '新风系统',
      items: [
        { id: 'i3', costType: 'equipment', quantity: 1, listPrice: 9500, unitPrice: 9500, amount: 9500 },
        { id: 'i4', costType: 'material', quantity: 70, listPrice: 169, unitPrice: 169, amount: 11830 },
      ],
      subtotal: 0,
    },
  ];

  it('系统小计', () => {
    expect(computeSystemSubtotal(systems[0].items)).toBe(21595);
    expect(computeSystemSubtotal(systems[1].items)).toBe(21330);
  });

  it('按 costType 归集 + 总价', () => {
    const t = computeQuoteTotals(systems);
    expect(t.equipment).toBe(30495); // 20995 + 9500
    expect(t.installation).toBe(600);
    expect(t.material).toBe(11830);
    expect(t.total).toBe(42925);
  });

  it('未知 costType 归入 other', () => {
    const t = computeQuoteTotals([
      { id: 'x', name: 'x', subtotal: 0, items: [{ id: 'i', costType: 'weird' as never, quantity: 1, listPrice: 100, unitPrice: 100, amount: 100 }] },
    ]);
    expect(t.other).toBe(100);
    expect(t.total).toBe(100);
  });
});

describe('PMS quote-calc · recomputeQuote 整单重算 (单一真值)', () => {
  it('从面价+折扣重算行/系统/分项, 忽略传入的脏 amount', () => {
    const { systems, totals } = recomputeQuote([
      {
        id: 's1',
        name: '生活热水系统',
        subtotal: 999999, // 脏数据, 应被重算覆盖
        items: [
          { id: 'i1', costType: 'equipment', quantity: 2, listPrice: 12500, discountRate: 0.85, unitPrice: NaN, amount: 999999 },
        ],
      },
    ]);
    expect(systems[0].items[0].unitPrice).toBe(10625);
    expect(systems[0].items[0].amount).toBe(21250);
    expect(systems[0].subtotal).toBe(21250);
    expect(totals.equipment).toBe(21250);
    expect(totals.total).toBe(21250);
  });
});

describe('PMS quote-calc · genVerifyCode 验真码', () => {
  it('格式 XXXX-XXXX-XXXX 且无易混字符', () => {
    const code = genVerifyCode();
    expect(isValidVerifyCodeFormat(code)).toBe(true);
    expect(code).not.toMatch(/[01OIL]/);
  });

  it('可注入 rand 保证确定性', () => {
    expect(genVerifyCode(() => 0)).toBe('AAAA-AAAA-AAAA');
  });

  it('isValidVerifyCodeFormat 拒绝非法格式', () => {
    expect(isValidVerifyCodeFormat('abc')).toBe(false);
    expect(isValidVerifyCodeFormat('AAAA-AAAA-AAA0')).toBe(false); // 含 0
  });
});
