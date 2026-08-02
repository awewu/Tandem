/**
 * PMS · 报价单纯计算 (无 IO, 可单测)
 *
 * 分项 BOQ: 行小计 → 系统小计 → 按 costType 汇总 → 总价。
 * 验真码: 无歧义字符集分组码, 供公开验真。
 */

import type { QuoteSystem, QuoteItem, QuoteTotals, QuoteCostType } from '@/lib/types/pms';

export const QUOTE_COST_TYPES: QuoteCostType[] = [
  'equipment',
  'material',
  'installation',
  'freight',
  'tax',
  'service',
  'other',
];

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * 计算行折后单价与小计:
 *   - 折后单价手填优先; 否则 listPrice * discountRate (无折扣=面价)
 *   - amount = 折后单价 * 数量
 */
export function computeItemAmount(
  item: Pick<QuoteItem, 'listPrice' | 'discountRate' | 'unitPrice' | 'quantity'>,
): { unitPrice: number; amount: number } {
  const qty = Math.max(0, Number(item.quantity) || 0);
  let unit = item.unitPrice;
  if (unit == null || Number.isNaN(Number(unit))) {
    const rate = item.discountRate == null ? 1 : Number(item.discountRate);
    unit = (Number(item.listPrice) || 0) * (Number.isNaN(rate) ? 1 : rate);
  }
  unit = round2(Math.max(0, Number(unit) || 0));
  return { unitPrice: unit, amount: round2(unit * qty) };
}

/** 系统小计 = 该系统所有行 amount 之和 */
export function computeSystemSubtotal(items: QuoteItem[]): number {
  return round2((items ?? []).reduce((s, it) => s + (Number(it.amount) || 0), 0));
}

/** 跨所有系统按 costType 归集分项小计 + 总价 */
export function computeQuoteTotals(systems: QuoteSystem[]): QuoteTotals {
  const t: QuoteTotals = {
    equipment: 0,
    material: 0,
    installation: 0,
    freight: 0,
    tax: 0,
    service: 0,
    other: 0,
    total: 0,
  };
  for (const sys of systems ?? []) {
    for (const it of sys.items ?? []) {
      const key = QUOTE_COST_TYPES.includes(it.costType) ? it.costType : 'other';
      t[key] = round2(t[key] + (Number(it.amount) || 0));
    }
  }
  t.total = round2(t.equipment + t.material + t.installation + t.freight + t.tax + t.service + t.other);
  return t;
}

/**
 * 重算整单: 归一化每行 (unitPrice/amount) → 系统小计 → 分项汇总。
 * 返回归一化后的 systems + totals, 供 service 落库前统一调用 (单一真值)。
 */
export function recomputeQuote(systems: QuoteSystem[]): { systems: QuoteSystem[]; totals: QuoteTotals } {
  const norm = (systems ?? []).map((sys) => {
    const items = (sys.items ?? []).map((it) => {
      const { unitPrice, amount } = computeItemAmount(it);
      return { ...it, unitPrice, amount };
    });
    return { ...sys, items, subtotal: computeSystemSubtotal(items) };
  });
  return { systems: norm, totals: computeQuoteTotals(norm) };
}

/** 验真码字符集: 去除易混字符 (0/O/1/I/L) */
const VERIFY_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * 生成验真码 XXXX-XXXX-XXXX (12 位分组)。
 * rand 可注入以便测试确定性; 默认 Math.random。
 */
export function genVerifyCode(rand: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < 12; i++) {
    s += VERIFY_ALPHABET[Math.floor(rand() * VERIFY_ALPHABET.length)];
  }
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

/** 校验验真码格式 (不校验存在性) */
export function isValidVerifyCodeFormat(code: string): boolean {
  return /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code);
}
