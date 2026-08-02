/**
 * 技能工资纯函数 (L2 规则层)
 *
 * 核心不变式 (§4.1): 某层级技能工资 = 该层级所有必备技能 skillWage 之和。
 * 员工实得技能工资 = 已认证且当前层级必备的技能 skillWage 之和。
 */

import type { CompLevel, SkillDef } from '../types/comp';

/** 某岗族在指定层级的"标准"技能工资 = Σ(requiredAt ∋ level 的技能定价) */
export function skillWageForLevel(skills: SkillDef[], level: CompLevel): number {
  return skills
    .filter((s) => s.requiredAt.includes(level))
    .reduce((sum, s) => sum + (s.skillWage || 0), 0);
}

/**
 * 员工实得技能工资: 仅计入"已认证 且 当前层级必备"的技能。
 * 未认证的必备技能不计入 (反禀赋: 未证明的能力不发钱)。
 */
export function employeeSkillWage(
  skills: SkillDef[],
  level: CompLevel,
  certifiedSkillIds: ReadonlySet<string> | string[],
): number {
  const certified =
    certifiedSkillIds instanceof Set
      ? certifiedSkillIds
      : new Set(certifiedSkillIds);
  return skills
    .filter((s) => s.requiredAt.includes(level) && certified.has(s.id))
    .reduce((sum, s) => sum + (s.skillWage || 0), 0);
}

/** 下一级缺口: 目标层级必备但员工尚未认证的技能 */
export function nextLevelGap(
  skills: SkillDef[],
  targetLevel: CompLevel,
  certifiedSkillIds: ReadonlySet<string> | string[],
): SkillDef[] {
  const certified =
    certifiedSkillIds instanceof Set
      ? certifiedSkillIds
      : new Set(certifiedSkillIds);
  return skills.filter(
    (s) => s.requiredAt.includes(targetLevel) && !certified.has(s.id),
  );
}

export interface ReconcileResult {
  ok: boolean;
  level: CompLevel;
  /** 由技能定价推算的应有技能工资 */
  expected: number;
  /** 薪酬总表(带宽表)登记的技能工资 */
  actual: number;
  diff: number;
}

/**
 * 导入对账 (§4.1 数据质量容错):
 * 校验 带宽表.技能工资 == Σ 技能定价。差异标记异常, 不盲信源表。
 */
export function reconcileSkillWage(
  skills: SkillDef[],
  level: CompLevel,
  bandSkillWage: number,
): ReconcileResult {
  const expected = skillWageForLevel(skills, level);
  const diff = bandSkillWage - expected;
  return { ok: diff === 0, level, expected, actual: bandSkillWage, diff };
}
