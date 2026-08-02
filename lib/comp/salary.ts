/**
 * 月薪合成纯函数 (L2/L3)
 *
 * 固定月薪 = 基本工资 + 技能工资 + 任务工资(A-G 档)。
 * 前端 What-if 与后端结算共用本模块, 保证口径同源 (§9)。
 */

import type { GradeBand, TaskGear } from '../types/comp';

export interface MonthlyComposition {
  base: number;
  skill: number;
  task: number;
  monthly: number;
}

/** 三段合成月薪 */
export function composeMonthly(base: number, skill: number, task: number): MonthlyComposition {
  const monthly = base + skill + task;
  return { base, skill, task, monthly };
}

/** 标准年薪 (不含绩效) */
export function deriveAnnual(monthly: number): number {
  return monthly * 12;
}

/** 反禀赋结构比 (基本·技能·任务), 三者之和为 1 (monthly=0 时返回全 0) */
export function structureRatio(c: MonthlyComposition): { base: number; skill: number; task: number } {
  if (c.monthly <= 0) return { base: 0, skill: 0, task: 0 };
  return {
    base: c.base / c.monthly,
    skill: c.skill / c.monthly,
    task: c.task / c.monthly,
  };
}

/** 取某任务承接档 (A-G) 的任务工资 */
export function taskWageForGear(band: GradeBand, gear: TaskGear): number {
  return band.taskGears[gear] ?? band.taskWageStd;
}

/**
 * 由带宽行 + 员工实得技能工资 + 任务档, 合成员工月薪。
 * skillWageOverride: 传入"员工已认证技能工资"; 不传则回退带宽 skillWageCached (派生缓存)。
 */
export function composeEmployeeMonthly(
  band: GradeBand,
  gear: TaskGear,
  skillWageOverride?: number,
): MonthlyComposition {
  const skill = skillWageOverride ?? band.skillWageCached;
  const task = taskWageForGear(band, gear);
  return composeMonthly(band.baseWage, skill, task);
}
