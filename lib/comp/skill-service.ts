/**
 * 技能定价服务 (PMS 同款 · 直连 drizzle typed 表)
 *
 * 真源 = comp_skill_def (HR 动态维护)。技能工资恒以实时 Σ定价 计算 (SQL 聚合)。
 */

import { and, eq, sql } from 'drizzle-orm';
import { db } from '../infra/drizzle-client';
import { compSkillDef, compGradeBand } from '../infra/drizzle-schema';
import type { CompLevel } from '../types/comp';

export interface SkillWageByLevelRow {
  level: CompLevel;
  total: number;
}

/**
 * 某岗族各等级的技能工资 = Σ(该等级必备技能定价)。
 * SQL 层用 jsonb_array_elements_text 展开 required_at 后 GROUP BY, 不进内存。
 */
export async function skillWageByLevel(
  tenantId: string,
  familyId: string,
): Promise<SkillWageByLevelRow[]> {
  const rows = await db.execute(sql`
    SELECT lvl AS level, SUM(${compSkillDef.skillWage})::int AS total
    FROM ${compSkillDef}, jsonb_array_elements_text(${compSkillDef.requiredAt}) AS lvl
    WHERE ${compSkillDef.tenantId} = ${tenantId} AND ${compSkillDef.familyId} = ${familyId}
    GROUP BY lvl
    ORDER BY lvl
  `);
  return (rows as unknown as Array<{ level: string; total: number }>).map((r) => ({
    level: r.level as CompLevel,
    total: Number(r.total),
  }));
}

/** 员工实得技能工资 = Σ(已认证 且 当前层级必备 的定价)。 */
export async function employeeSkillWage(
  tenantId: string,
  employeeId: string,
  familyId: string,
  level: CompLevel,
): Promise<number> {
  const rows = await db.execute(sql`
    SELECT COALESCE(SUM(${compSkillDef.skillWage}), 0)::int AS total
    FROM ${compSkillDef}
    JOIN comp_grade_certification c
      ON c.skill_id = ${compSkillDef.id} AND c.status = '已认证' AND c.employee_id = ${employeeId}
    WHERE ${compSkillDef.tenantId} = ${tenantId}
      AND ${compSkillDef.familyId} = ${familyId}
      AND ${compSkillDef.requiredAt} @> ${JSON.stringify([level])}::jsonb
  `);
  return Number((rows as unknown as Array<{ total: number }>)[0]?.total ?? 0);
}

/** 刷新带宽表的 skillWageCached (改价后重算, 非真源) */
export async function refreshBandSkillWageCache(
  tenantId: string,
  familyId: string,
): Promise<void> {
  const byLevel = await skillWageByLevel(tenantId, familyId);
  const map = new Map(byLevel.map((r) => [r.level, r.total]));
  const bands = await db
    .select()
    .from(compGradeBand)
    .where(and(eq(compGradeBand.tenantId, tenantId), eq(compGradeBand.familyId, familyId)));
  for (const b of bands) {
    const total = map.get(b.level as CompLevel) ?? 0;
    await db
      .update(compGradeBand)
      .set({ skillWageCached: total, skillWageComputedAt: new Date() })
      .where(eq(compGradeBand.id, b.id));
  }
}
