/**
 * Answer Pipeline · 中央 AI / 搭子 回答编排的共享判定 (快慢双轨 · 2026-07)
 *
 * 治理倒置架构下, 回答分两轨:
 *   - 快道 (简单问题): 自由生成 → 确定性红线快检 → 直接交付 (不进 LLM critique 环, 省延迟/成本)。
 *   - 慢道 (复杂/决策类): 自由生成 → output-guard 出口对齐裁判 (服务/偏离/冲突 + 冲突 revise) → 交付。
 *
 * 本模块只提供纯函数判定 (无 IO), 供 BossAI stream / IM 中央AI / 搭子 三处复用,
 * 避免在多处各写一份分流逻辑。真正的生成/裁判仍在各自出口内联执行 (保留流式体验)。
 */

import { shouldDeepReason } from './company-brain-reasoning';
import { matchHardRefuse, type HardRefuseResult } from '@/lib/governance/hard-refuse-redlines';

export { matchHardRefuse };
export type { HardRefuseResult };

/**
 * 是否对回答跑「完整出口对齐裁判」(output-guard 的 LLM critique 环).
 *
 * 命中复杂/决策类关键词 (shouldDeepReason) → 慢道跑全环;
 * 简单问题 (寒暄/事实查询) → 快道跳过 LLM critique, 仅靠入口红线快检兜底。
 *
 * 注: 无论快慢, 回答长度过长 (可能夹带结论) 时仍建议跑裁判 —— 由 minLenForceCritique 兜。
 */
export function shouldFullCritique(
  query: string,
  responseLength = 0,
  opts?: { minLenForceCritique?: number },
): { full: boolean; reason: string } {
  const gate = shouldDeepReason(query);
  if (gate.trigger) return { full: true, reason: `complex/decision: ${gate.reason}` };
  const minLen = opts?.minLenForceCritique ?? 600;
  if (responseLength >= minLen) {
    return { full: true, reason: `long response (${responseLength} ≥ ${minLen}) may carry conclusions` };
  }
  return { full: false, reason: 'simple query · fast track (skip LLM critique)' };
}
