/**
 * 种子装载 (Phase 2) — 纯函数
 *
 * 把 lib/comp/seed/*.json (导入产物) 转成类型化配置模型:
 *  - 从技能推导岗族可达等级 (reachableLevels)
 *  - 标记对账异常项 needsReview (未确认前冻结, §4.1)
 */

import type { CompLevel } from '../types/comp';
import { COMP_LEVEL_ORDER } from '../types/comp';
import { skillWageForLevel } from './skill-wage';

export interface RawSkill {
  board: string;
  family: string;
  name: string;
  skillWage: number;
  requiredAt: CompLevel[];
  source: string;
}

export interface FamilyMeta {
  board: string;
  family: string;
  /** 由技能 requiredAt 并集推导, 按等级顺序排列 */
  reachableLevels: CompLevel[];
}

/** 从技能集推导各岗族的可达等级 (天花板差异化) */
export function deriveFamilies(skills: RawSkill[]): FamilyMeta[] {
  const map = new Map<string, { board: string; family: string; levels: Set<CompLevel> }>();
  for (const s of skills) {
    const key = `${s.board}|${s.family}`;
    if (!map.has(key)) map.set(key, { board: s.board, family: s.family, levels: new Set() });
    for (const l of s.requiredAt) map.get(key)!.levels.add(l);
  }
  return Array.from(map.values()).map((e) => ({
    board: e.board,
    family: e.family,
    reachableLevels: COMP_LEVEL_ORDER.filter((l) => e.levels.has(l)),
  }));
}

/** 对账异常项的 key 集合 (family|level) */
export function reviewKeySet(reconcile: { family: string; level: string }[]): Set<string> {
  return new Set(reconcile.map((r) => `${r.family}|${r.level}`));
}

export function isReviewNeeded(set: Set<string>, family: string, level: string): boolean {
  return set.has(`${family}|${level}`);
}

/** 某岗族各等级的应有技能工资 (Σ定价), 供 seed 校验 / 展示 */
export function expectedWageByLevel(familySkills: RawSkill[]): Partial<Record<CompLevel, number>> {
  const out: Partial<Record<CompLevel, number>> = {};
  const defs = familySkills.map((s) => ({
    id: s.name, tenantId: '', familyId: '', name: s.name,
    skillWage: s.skillWage, requiredAt: s.requiredAt, source: s.source as never, matrixVersion: '',
  }));
  for (const lvl of COMP_LEVEL_ORDER) {
    const v = skillWageForLevel(defs, lvl);
    if (v > 0) out[lvl] = v;
  }
  return out;
}
