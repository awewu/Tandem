// 渠道返利毛利闸（基座3）纯逻辑：返利后净毛利低于 floor 则不过闸。
export interface RebateMarginResult {
  rebateRatio: number;
  baseMarginRate: number;
  netMarginRate: number;
  floor: number;
  gatePassed: boolean;
}

export function computeRebateMargin(amount: number, gmv: number, baseMarginRate: number, floor: number): RebateMarginResult {
  const rebateRatio = gmv > 0 ? (Number(amount) || 0) / gmv : 0;
  const base = Number(baseMarginRate) || 0;
  const netMarginRate = base - rebateRatio;
  return { rebateRatio, baseMarginRate: base, netMarginRate, floor, gatePassed: netMarginRate >= floor };
}
