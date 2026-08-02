/**
 * HR 薪酬定价治理服务 (直连 typed 表)
 *
 * 治理唯一真源 comp_skill_def: 列岗族/技能矩阵、改价 → 刷新带宽缓存。
 * 技能工资恒以实时 Σ定价 呈现。
 */

import { and, asc, eq } from 'drizzle-orm';
import { db } from '../infra/drizzle-client';
import { compJobFamily, compSkillDef } from '../infra/drizzle-schema';
import type { CompLevel } from '../types/comp';
import { COMP_LEVEL_ORDER } from '../types/comp';
import { skillWageByLevel, refreshBandSkillWageCache } from './skill-service';

export interface FamilyLite {
  id: string;
  board: string;
  name: string;
  jobClass: string;
  sequence: string;
  reachableLevels: CompLevel[];
}

export async function listFamilies(tenantId: string): Promise<FamilyLite[]> {
  const rows = await db
    .select()
    .from(compJobFamily)
    .where(eq(compJobFamily.tenantId, tenantId))
    .orderBy(asc(compJobFamily.board), asc(compJobFamily.name));
  return rows.map((r) => ({
    id: r.id,
    board: r.board,
    name: r.name,
    jobClass: r.jobClass,
    sequence: r.sequence,
    reachableLevels: COMP_LEVEL_ORDER.filter((l) => ((r.reachableLevels as CompLevel[]) ?? []).includes(l)),
  }));
}

export interface MatrixSkill {
  id: string;
  name: string;
  skillWage: number;
  requiredAt: CompLevel[];
  source: string;
}

export interface FamilySkillMatrix {
  family: FamilyLite | null;
  levels: CompLevel[];
  skills: MatrixSkill[];
  levelTotals: Partial<Record<CompLevel, number>>;
}

export async function getFamilySkillMatrix(
  tenantId: string,
  familyId: string,
): Promise<FamilySkillMatrix> {
  const [fam] = await db
    .select()
    .from(compJobFamily)
    .where(and(eq(compJobFamily.tenantId, tenantId), eq(compJobFamily.id, familyId)))
    .limit(1);

  const skillRows = await db
    .select()
    .from(compSkillDef)
    .where(and(eq(compSkillDef.tenantId, tenantId), eq(compSkillDef.familyId, familyId)))
    .orderBy(asc(compSkillDef.skillWage));

  const byLevel = await skillWageByLevel(tenantId, familyId);
  const levelTotals: Partial<Record<CompLevel, number>> = {};
  for (const r of byLevel) levelTotals[r.level] = r.total;

  const reachable = fam
    ? COMP_LEVEL_ORDER.filter((l) => ((fam.reachableLevels as CompLevel[]) ?? []).includes(l))
    : COMP_LEVEL_ORDER;

  return {
    family: fam
      ? {
          id: fam.id,
          board: fam.board,
          name: fam.name,
          jobClass: fam.jobClass,
          sequence: fam.sequence,
          reachableLevels: reachable,
        }
      : null,
    levels: reachable,
    skills: skillRows.map((r) => ({
      id: r.id,
      name: r.name,
      skillWage: r.skillWage,
      requiredAt: (r.requiredAt as CompLevel[]) ?? [],
      source: r.source,
    })),
    levelTotals,
  };
}

/** 改价: 更新技能定价 → 刷新带宽 skillWageCached。返回受影响岗族的新逐级 Σ。 */
export async function updateSkillWage(
  tenantId: string,
  skillId: string,
  newWage: number,
): Promise<{ ok: boolean; familyId: string; levelTotals: Partial<Record<CompLevel, number>> }> {
  const [skill] = await db
    .select()
    .from(compSkillDef)
    .where(and(eq(compSkillDef.tenantId, tenantId), eq(compSkillDef.id, skillId)))
    .limit(1);
  if (!skill) throw new Error('skill not found');

  await db
    .update(compSkillDef)
    .set({ skillWage: Math.max(0, Math.round(newWage)) })
    .where(and(eq(compSkillDef.tenantId, tenantId), eq(compSkillDef.id, skillId)));

  await refreshBandSkillWageCache(tenantId, skill.familyId);

  const byLevel = await skillWageByLevel(tenantId, skill.familyId);
  const levelTotals: Partial<Record<CompLevel, number>> = {};
  for (const r of byLevel) levelTotals[r.level] = r.total;
  return { ok: true, familyId: skill.familyId, levelTotals };
}
