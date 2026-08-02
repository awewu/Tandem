/**
 * 员工职级/薪酬看板服务 (直连 typed 表 + 复用纯函数)
 *
 * 组合员工侧 /organization/performance 看板数据:
 *   三段薪资构成 + 已认证技能工资 + 当前层级标准(真源Σ) + 下一级缺口。
 */

import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../infra/drizzle-client';
import {
  compEmployeeGrade,
  compJobFamily,
  compGradeBand,
  compSkillDef,
  compGradeCertification,
} from '../infra/drizzle-schema';
import type { CompLevel, SkillDef, TaskGear } from '../types/comp';
import { COMP_LEVEL_ORDER } from '../types/comp';
import { skillWageByLevel, employeeSkillWage } from './skill-service';
import { nextLevelGap } from './skill-wage';

export interface GradeViewGapSkill {
  id: string;
  name: string;
  skillWage: number;
}

export interface EmployeeGradeView {
  status: 'ok' | 'notfound';
  employeeId: string;
  family?: { id: string; name: string; board: string };
  jobClass?: string;
  level?: CompLevel;
  taskGear?: TaskGear;
  breakdown?: { base: number; skill: number; task: number; monthly: number };
  /** 员工实得技能工资 (已认证 Σ) */
  certifiedSkillWage?: number;
  /** 当前层级标准技能工资 (真源实时 Σ) */
  standardSkillWage?: number;
  nextLevel?: {
    level: CompLevel;
    standardSkillWage: number;
    gapSkills: GradeViewGapSkill[];
  } | null;
}

function toSkillDef(r: typeof compSkillDef.$inferSelect): SkillDef {
  return {
    id: r.id,
    tenantId: r.tenantId,
    familyId: r.familyId,
    name: r.name,
    skillWage: r.skillWage,
    requiredAt: (r.requiredAt as CompLevel[]) ?? [],
    source: r.source as SkillDef['source'],
    matrixVersion: r.matrixVersion,
  };
}

export async function getEmployeeGradeView(
  tenantId: string,
  employeeId: string,
): Promise<EmployeeGradeView> {
  const grades = await db
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
  const g = grades[0];
  if (!g) return { status: 'notfound', employeeId };

  const level = g.currentLevel as CompLevel;
  const gear = g.taskGear as TaskGear;

  const [fam] = await db
    .select()
    .from(compJobFamily)
    .where(eq(compJobFamily.id, g.familyId))
    .limit(1);

  // 真源: 各层级标准技能工资 (实时 Σ 定价)
  const byLevel = await skillWageByLevel(tenantId, g.familyId);
  const levelMap = new Map(byLevel.map((r) => [r.level, r.total]));
  const standardSkillWage = levelMap.get(level) ?? 0;

  // 员工实得技能工资 (已认证 Σ)
  const certifiedSkillWage = await employeeSkillWage(tenantId, employeeId, g.familyId, level);

  // 带宽 (口径一: 按 岗类×层级, familyId 可空)
  const [band] = await db
    .select()
    .from(compGradeBand)
    .where(
      and(
        eq(compGradeBand.tenantId, tenantId),
        eq(compGradeBand.jobClass, g.jobClass),
        eq(compGradeBand.level, level),
      ),
    )
    .limit(1);
  const base = g.baseWageSnapshot;
  const gears = (band?.taskGears as Record<string, number> | undefined) ?? {};
  const task = band ? Number(gears[gear] ?? band.taskWageStd) : 0;
  const monthly = base + certifiedSkillWage + task;

  // 下一级缺口
  const reachable = ((fam?.reachableLevels as CompLevel[]) ?? COMP_LEVEL_ORDER).filter((l) =>
    COMP_LEVEL_ORDER.includes(l),
  );
  const orderedReachable = COMP_LEVEL_ORDER.filter((l) => reachable.includes(l));
  const curIdx = orderedReachable.indexOf(level);
  const nextLvl = curIdx >= 0 && curIdx < orderedReachable.length - 1 ? orderedReachable[curIdx + 1] : null;

  let nextLevel: EmployeeGradeView['nextLevel'] = null;
  if (nextLvl) {
    const skillRows = await db
      .select()
      .from(compSkillDef)
      .where(and(eq(compSkillDef.tenantId, tenantId), eq(compSkillDef.familyId, g.familyId)));
    const certRows = await db
      .select({ skillId: compGradeCertification.skillId })
      .from(compGradeCertification)
      .where(
        and(
          eq(compGradeCertification.tenantId, tenantId),
          eq(compGradeCertification.employeeId, employeeId),
          eq(compGradeCertification.status, '已认证'),
        ),
      );
    const skills = skillRows.map(toSkillDef);
    const certifiedIds = certRows.map((c) => c.skillId);
    const gap = nextLevelGap(skills, nextLvl, certifiedIds);
    nextLevel = {
      level: nextLvl,
      standardSkillWage: levelMap.get(nextLvl) ?? 0,
      gapSkills: gap.map((s) => ({ id: s.id, name: s.name, skillWage: s.skillWage })),
    };
  }

  return {
    status: 'ok',
    employeeId,
    family: fam ? { id: fam.id, name: fam.name, board: fam.board } : undefined,
    jobClass: g.jobClass,
    level,
    taskGear: gear,
    breakdown: { base, skill: certifiedSkillWage, task, monthly },
    certifiedSkillWage,
    standardSkillWage,
    nextLevel,
  };
}
