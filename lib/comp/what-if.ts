/**
 * 薪酬 What-if 试算 (PRD §9) — 纯函数
 *
 * 与后端结算共用 salary + skill-wage, 保证口径同源。
 * 支持三种手柄: 换任务档(B轨) / 认证新技能(A轨内) / 升级换带宽(A轨跨级)。
 */

import type { GradeBand, SkillDef, TaskGear } from '../types/comp';
import { employeeSkillWage } from './skill-wage';
import { composeEmployeeMonthly } from './salary';

export interface WhatIfParams {
  /** 当前带宽行 */
  fromBand: GradeBand;
  /** 升级目标带宽 (不传 = 同级不变) */
  toBand?: GradeBand;
  fromGear: TaskGear;
  /** 目标任务档 (不传 = 不变) */
  toGear?: TaskGear;
  /** 该岗族技能库 */
  skills: SkillDef[];
  /** 当前已认证技能 */
  certifiedBefore: string[];
  /** 计划认证后的技能集合 (不传 = 不变) */
  certifiedAfter?: string[];
}

export interface WhatIfResult {
  before: number;
  after: number;
  delta: number;
  /** 三段各自的增量 (base / skill / task) */
  breakdown: { base: number; skill: number; task: number };
}

export function simulate(p: WhatIfParams): WhatIfResult {
  const toBand = p.toBand ?? p.fromBand;
  const toGear = p.toGear ?? p.fromGear;
  const certifiedAfter = p.certifiedAfter ?? p.certifiedBefore;

  const beforeSkill = employeeSkillWage(p.skills, p.fromBand.level, p.certifiedBefore);
  const afterSkill = employeeSkillWage(p.skills, toBand.level, certifiedAfter);

  const before = composeEmployeeMonthly(p.fromBand, p.fromGear, beforeSkill);
  const after = composeEmployeeMonthly(toBand, toGear, afterSkill);

  return {
    before: before.monthly,
    after: after.monthly,
    delta: after.monthly - before.monthly,
    breakdown: {
      base: after.base - before.base,
      skill: after.skill - before.skill,
      task: after.task - before.task,
    },
  };
}
