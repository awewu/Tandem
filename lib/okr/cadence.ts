/**
 * Check-in 节奏（cadence）helpers
 *
 * Tita / Profit.co 默认每周一次，WorkBoard 推荐双周；
 * 本工具计算"距下次 Check-in"和"是否逾期"。
 */

import type { Cadence, CheckIn, Cycle, Objective } from '../store';

const DAY = 24 * 60 * 60 * 1000;

const CADENCE_DAYS: Record<Cadence, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
};

export const CADENCE_LABEL: Record<Cadence, string> = {
  weekly: '每周',
  biweekly: '每双周',
  monthly: '每月',
};

export interface CheckinPulse {
  /** 距上次 Check-in 的天数；从未则为 null */
  daysSinceLast: number | null;
  /** 距下次应做 Check-in 的天数（负数 = 逾期）；从未则按目标创建时间起算 */
  daysToNext: number;
  /** 是否已逾期（按节奏） */
  overdue: boolean;
  /** 距离逾期红线的紧迫程度 */
  urgency: 'fresh' | 'soon' | 'overdue';
  cadence: Cadence;
}

/** 计算单个 Objective 的 Check-in 脉搏 */
export function objectivePulse(
  obj: Objective,
  cycle: Cycle,
  checkIns: CheckIn[],
  krIds: string[],
): CheckinPulse {
  const cadence = cycle.cadence || 'weekly';
  const intervalDays = CADENCE_DAYS[cadence];
  const krIdSet = new Set(krIds);

  const relevant = checkIns.filter(
    (c) =>
      (c.scope === 'objective' && c.scopeId === obj.id) ||
      (c.scope === 'kr' && krIdSet.has(c.scopeId))
  );
  const lastCheckin = relevant.length > 0 ? Math.max(...relevant.map((c) => c.createdAt)) : null;

  const referenceTime = lastCheckin || obj.createdAt;
  const elapsed = (Date.now() - referenceTime) / DAY;
  const daysSinceLast = lastCheckin == null ? null : Math.floor(elapsed);
  const daysToNext = Math.ceil(intervalDays - elapsed);
  const overdue = daysToNext < 0;
  const urgency: CheckinPulse['urgency'] =
    overdue ? 'overdue' : daysToNext <= 2 ? 'soon' : 'fresh';

  return { daysSinceLast, daysToNext, overdue, urgency, cadence };
}

export function pulseLabel(pulse: CheckinPulse): string {
  if (pulse.daysSinceLast == null) {
    return pulse.daysToNext < 0
      ? `创建已超过 ${-pulse.daysToNext} 天，仍无 Check-in`
      : `${pulse.daysToNext} 天内做首次 Check-in`;
  }
  if (pulse.overdue) {
    return `Check-in 已逾期 ${-pulse.daysToNext} 天`;
  }
  if (pulse.daysToNext === 0) return '今天该 Check-in 了';
  return `${pulse.daysToNext} 天后该 Check-in（上次 ${pulse.daysSinceLast} 天前）`;
}

/** 周期级别：未逾期、即将逾期、已逾期 各多少 */
export function summarizePulses(pulses: CheckinPulse[]) {
  return {
    total: pulses.length,
    fresh: pulses.filter((p) => p.urgency === 'fresh').length,
    soon: pulses.filter((p) => p.urgency === 'soon').length,
    overdue: pulses.filter((p) => p.urgency === 'overdue').length,
  };
}
