/**
 * 初步选型报价（诚实版 · 第 3 步）—— 纯函数装配层。
 * 事实源：docs/RYSNOVA-DIAGNOSIS-LIGHT-INTAKE-ALIGNMENT-2026-07-05.md §0/§4/§5（A：初步区间报价）。
 *
 * 诚实红线（写死）：
 *  - 只用产品目录**真实 listPrice**（牌价，公开安全）聚合出区间；不引入面积×魔数、不编造节能/ROI。
 *  - 三档差异来自**真实价格分布**（各系统 min/中位/max 求和），不是拍脑袋的档位倍率。
 *  - 无目录价的系统 → 标「需现场核算」，从合计中排除；绝不用 0 或臆造值充数。
 *  - 全部标注「初步预估 · 以现场勘测为准」。精确 BOM / 最终报价下沉报价/设计阶段。
 */

/** 单系统价格带（由 catalog 用真实 listPrice 计算后传入）。 */
export interface SystemPriceBand {
  code: string;
  label: string;
  priced: boolean;
  count: number;
  /** 该系统匹配到的真实牌价（升序），仅 priced=true 时存在。 */
  prices?: number[];
  currency?: string;
}

export interface QuoteTier {
  id: 'essential' | 'balanced' | 'premium';
  label: string;
  low: number;
  high: number;
  /** 纳入计价的系统 code。 */
  pricedSystems: string[];
}

export interface IndicativeQuote {
  available: boolean;
  currency: string;
  tiers: QuoteTier[];
  /** 有目录价、纳入计算的系统。 */
  pricedSystems: { code: string; label: string }[];
  /** 无目录价、需现场核算的系统（诚实披露）。 */
  unpricedSystems: { code: string; label: string }[];
  coverage: { priced: number; total: number };
  disclaimer: string;
}

const DISCLAIMER = '初步预估，基于产品目录牌价按系统区间测算，仅供参考；精确选型与最终报价以现场勘测和设计为准。';

function median(sorted: number[]): number {
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** 求和辅助：对每个已计价系统取某个价格点后求和。 */
function sumBy(bands: SystemPriceBand[], pick: (prices: number[]) => number): number {
  return bands.reduce((acc, b) => acc + (b.priced && b.prices?.length ? pick(b.prices) : 0), 0);
}

/**
 * 由各系统真实价格带装配三档初步区间报价。
 * essential=Σmin..Σ中位；balanced=Σ中位..Σ(中位与max之间)；premium=..Σmax。
 * 所有端点均为真实牌价的求和/插值，四舍五入到整数元。
 */
export function composeIndicativeQuote(bands: SystemPriceBand[]): IndicativeQuote {
  const priced = bands.filter((b) => b.priced && (b.prices?.length ?? 0) > 0);
  const currency = bands.find((b) => b.currency)?.currency || 'CNY';
  const pricedSystems = priced.map((b) => ({ code: b.code, label: b.label }));
  const unpricedSystems = bands.filter((b) => !b.priced).map((b) => ({ code: b.code, label: b.label }));

  if (!priced.length) {
    return {
      available: false, currency, tiers: [],
      pricedSystems, unpricedSystems,
      coverage: { priced: 0, total: bands.length },
      disclaimer: '所选系统暂无可用目录价，初步报价将在现场勘测与选型后提供。',
    };
  }

  const sumMin = sumBy(priced, (p) => p[0]);
  const sumMed = sumBy(priced, (p) => median(p));
  const sumMax = sumBy(priced, (p) => p[p.length - 1]);
  const sumUpperMid = Math.round((sumMed + sumMax) / 2);
  const r = (n: number) => Math.round(n);
  const ids: string[] = priced.map((b) => b.code);

  const tiers: QuoteTier[] = [
    { id: 'essential', label: '基础舒适', low: r(sumMin), high: r(sumMed), pricedSystems: ids },
    { id: 'balanced', label: '均衡推荐', low: r(sumMed), high: sumUpperMid, pricedSystems: ids },
    { id: 'premium', label: '高阶全生命周期', low: sumUpperMid, high: r(sumMax), pricedSystems: ids },
  ];

  return {
    available: true, currency, tiers,
    pricedSystems, unpricedSystems,
    coverage: { priced: priced.length, total: bands.length },
    disclaimer: DISCLAIMER,
  };
}

/** 报价用系统关键词（匹配产品 category/名称/定位文本；供 catalog 侧真实价筛选）。 */
export const SYSTEM_QUOTE_KEYWORDS: Record<string, string[]> = {
  hot_water: ['热水', '中央热水'],
  heating: ['采暖', '地暖', '暖气'],
  water_treatment: ['净水', '软水', '水处理', '过滤'],
  fresh_air: ['新风', '除湿'],
  air: ['空调', '全空气', '恒温', '五恒'],
  smart_control: ['智能', '智控', '控制', 'econet'],
};
