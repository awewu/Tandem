// 定价毛利闸（基座3）纯逻辑：与服务解耦，便于单测与复用。
export interface MarginResult {
  marginAmt: number;
  marginRate: number;
  floor: number;
  gatePassed: boolean;
}

/** 毛利 = 拟定价 - 成本；毛利率 = 毛利/拟定价；低于 floor 则不过闸。 */
export function computeMargin(proposedPrice: number, costPrice: number, floor: number): MarginResult {
  const price = Number(proposedPrice) || 0;
  const cost = Number(costPrice) || 0;
  const marginAmt = price - cost;
  const marginRate = price > 0 ? marginAmt / price : 0;
  return { marginAmt, marginRate, floor, gatePassed: marginRate >= floor };
}
