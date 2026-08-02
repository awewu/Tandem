/**
 * What-if 收入试算服务 (直连 typed 表 + 复用纯函数)
 *
 * 员工双轨自服务: 换任务档(B轨) / 认证技能或升级(A轨) → 预览月薪变化。
 * 数据真实: base 走员工快照, task 走带宽 A-G, skill 走实时 Σ定价。
 */

import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../infra/drizzle-client';
import { compEmployeeGrade, compGradeBand } from '../infra/drizzle-schema';
import type { CompLevel, TaskGear } from '../types/comp';
import { skillWageByLevel, employeeSkillWage } from './skill-service';

export interface WhatIfOpts {
  toGear?: TaskGear;
  toLevel?: CompLevel;
  /** 假设目标层级必备技能全部认证 (A轨升级预览) */
  certifyAll?: boolean;
}

export interface WhatIfComposition {
  base: number;
  skill: number;
  task: number;
  monthly: number;
}

export interface WhatIfResult {
  status: 'ok' | 'notfound';
  before?: WhatIfComposition;
  after?: WhatIfComposition;
  delta?: number;
  deltaBreakdown?: { base: number; skill: number; task: number };
}

async function bandFor(tenantId: string, jobClass: string, level: CompLevel) {
  const [b] = await db
    .select()
    .from(compGradeBand)
    .where(
      and(
        eq(compGradeBand.tenantId, tenantId),
        eq(compGradeBand.jobClass, jobClass),
        eq(compGradeBand.level, level),
      ),
    )
    .limit(1);
  return b;
}

function taskOf(band: { taskGears: unknown; taskWageStd: number } | undefined, gear: TaskGear): number {
  if (!band) return 0;
  const gears = (band.taskGears as Record<string, number> | null) ?? {};
  return Number(gears[gear] ?? band.taskWageStd);
}

export async function simulateForEmployee(
  tenantId: string,
  employeeId: string,
  opts: WhatIfOpts,
): Promise<WhatIfResult> {
  const [g] = await db
    .select()
    .from(compEmployeeGrade)
    .where(
      and(
        eq(compEmployeeGrade.tenantId, tenantId),
        eq(compEmployeeGrade.employeeId, employeeId),
        isNull(compEmployeeGrade.effectiveTo),
      ),
    )
    .limit(1);
  if (!g) return { status: 'notfound' };

  const base = g.baseWageSnapshot;
  const curLevel = g.currentLevel as CompLevel;
  const curGear = g.taskGear as TaskGear;

  // 现状
  const curBand = await bandFor(tenantId, g.jobClass, curLevel);
  const curSkill = await employeeSkillWage(tenantId, employeeId, g.familyId, curLevel);
  const before: WhatIfComposition = {
    base, skill: curSkill, task: taskOf(curBand, curGear),
    monthly: base + curSkill + taskOf(curBand, curGear),
  };

  // 目标场景
  const tgtLevel = opts.toLevel ?? curLevel;
  const tgtGear = opts.toGear ?? curGear;
  const tgtBand = tgtLevel === curLevel ? curBand : await bandFor(tenantId, g.jobClass, tgtLevel);

  let tgtSkill: number;
  if (opts.certifyAll) {
    const byLevel = await skillWageByLevel(tenantId, g.familyId);
    tgtSkill = byLevel.find((r) => r.level === tgtLevel)?.total ?? 0;
  } else if (tgtLevel === curLevel) {
    tgtSkill = curSkill;
  } else {
    tgtSkill = await employeeSkillWage(tenantId, employeeId, g.familyId, tgtLevel);
  }

  const after: WhatIfComposition = {
    base, skill: tgtSkill, task: taskOf(tgtBand, tgtGear),
    monthly: base + tgtSkill + taskOf(tgtBand, tgtGear),
  };

  return {
    status: 'ok',
    before,
    after,
    delta: after.monthly - before.monthly,
    deltaBreakdown: {
      base: after.base - before.base,
      skill: after.skill - before.skill,
      task: after.task - before.task,
    },
  };
}
