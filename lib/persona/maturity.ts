/**
 * Mode Proficiency · 主分身各技能模式专长度评分
 *
 * P3 (2026-05-28): 启发式算法 v0.
 * 核心: 主分身 overallStage(1-5) 唯一; 各模式 0-100 独立专长度.
 *
 * 评分输入:
 *   - sampleCount: 该模式的训练样本量 (员工历史产出 + 对话纠偏)
 *   - recentDays: 最近一次活跃距今天数 (时间衰减)
 *   - endorsementCount: 同事/上级对该模式产出的认可数
 *   - okrContribution: 该模式协助推进 OKR 的次数
 *
 * v1 (P4-P5) 改进:
 *   - 接入 360° 反馈实际数据
 *   - K-匿名后的同侪对比基线
 *   - LLM 自评 (主分身定期自检 "我对这个模式真懂吗")
 */

import type { SkillMode } from './skill-modes';

export interface ProficiencyInput {
  sampleCount: number;       // 0+
  recentDays: number;         // 0+ (越大越衰减)
  endorsementCount: number;   // 0+
  okrContribution: number;    // 0+
}

/**
 * 计算单个模式 0-100 专长度.
 *
 * 公式 (启发式 v0):
 *   base = log10(samples+1) × 20  (饱和到 100, 100 个样本 ≈ 40 分)
 *   decay = exp(-recentDays / 90) (90 天半衰)
 *   bonus = endorsementCount × 3 + okrContribution × 5
 *   score = clamp(base × decay + bonus, 0, 100)
 */
export function computeModeProficiency(input: ProficiencyInput): number {
  const { sampleCount, recentDays, endorsementCount, okrContribution } = input;

  const base = Math.min(100, Math.log10(sampleCount + 1) * 20);
  const decay = Math.exp(-Math.max(0, recentDays) / 90);
  const bonus = endorsementCount * 3 + okrContribution * 5;

  const raw = base * decay + bonus;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

/**
 * 单分身一致性铁律: 整体 stage(1-5) 与各模式 proficiency 是两层.
 * stage 由整体决策数 + bossCaptureScore + 阶段晋升签批 决定 (现有 PersonaStage),
 * proficiency 仅是该模式的"专长度"指示.
 *
 * 规则: 任何模式的 proficiency 不能反过来推 stage,
 *       avoid 出现 "设计 5★ PM 1★" 撕裂的认知.
 */
export type ModeProficiencyMap = Partial<Record<SkillMode, number>>;

/**
 * 计算 5 模式的 proficiency map.
 * 调用方应该传入按模式分组的样本数据.
 */
export function computeAllModeProficiencies(
  byMode: Partial<Record<SkillMode, ProficiencyInput>>
): ModeProficiencyMap {
  const out: ModeProficiencyMap = {};
  for (const key of Object.keys(byMode) as SkillMode[]) {
    const input = byMode[key];
    if (input) {
      out[key] = computeModeProficiency(input);
    }
  }
  return out;
}

/**
 * UI 友好: 把 0-100 分映射到 ★ 等级 (1-5 星).
 * 80+: 5★, 60+: 4★, 40+: 3★, 20+: 2★, else 1★
 */
export function proficiencyToStars(score: number): 1 | 2 | 3 | 4 | 5 {
  if (score >= 80) return 5;
  if (score >= 60) return 4;
  if (score >= 40) return 3;
  if (score >= 20) return 2;
  return 1;
}

/**
 * 估算时给 mock 数据使用 (开发期).
 * P5 数据通路打通后改读真实 store.
 */
export function getMockProficiencies(): ModeProficiencyMap {
  return {
    design: computeModeProficiency({ sampleCount: 47, recentDays: 3, endorsementCount: 12, okrContribution: 4 }),
    pm: computeModeProficiency({ sampleCount: 23, recentDays: 7, endorsementCount: 5, okrContribution: 6 }),
    tech: computeModeProficiency({ sampleCount: 156, recentDays: 1, endorsementCount: 28, okrContribution: 12 }),
    marketing: computeModeProficiency({ sampleCount: 8, recentDays: 30, endorsementCount: 1, okrContribution: 1 }),
    strategy: computeModeProficiency({ sampleCount: 31, recentDays: 14, endorsementCount: 7, okrContribution: 5 }),
  };
}
