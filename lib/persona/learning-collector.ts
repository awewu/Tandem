/**
 * Persona Learning Collector · 自动从行为提取学习信号
 *
 * 触发: 每次 DecisionCard COMMIT / VETO 后, 或定时任务每日扫描.
 *
 * 学习内容:
 *   - decisionHistory 累计统计 (total / selfMade / aiAssisted / vetoed)
 *   - styleProfile 风格特征 (decisionSpeed / riskAppetite / preferredOptions)
 *   - communicationExamples 收录最近沟通片段 (上限 100 条)
 *   - growthAreas 自动识别短板 (V2 用 LLM 分析)
 *
 * 注: 仅当 persona.learningActive=true 时执行.
 */

import { getStore } from '../storage/repository';
import { checkUpgradeEligibility } from './evolution';
import type { DecisionCard } from '../types/decision-card';
import type { Persona, StyleProfile } from '../types/persona';

const COMMUNICATION_EXAMPLES_CAP = 100;

/**
 * 决议结束后的学习钩子.
 * 在 commit / veto 时由 orchestrator 触发.
 */
export async function ingestDecisionCard(card: DecisionCard): Promise<void> {
  const store = getStore();
  const userId = card.createdBy;
  const personas = await store.personas.list({ userId } as never);
  const persona = personas[0];
  if (!persona || !persona.learningActive) return;

  const stats = persona.decisionHistory;
  const quality = computeDecisionQuality(card);
  const krHit = computeKrHit(card);

  const newStats = {
    ...stats,
    totalDecisions: stats.totalDecisions + 1,
    selfMade: stats.selfMade + (card.selected === 'D' ? 1 : 0),
    aiAssisted: stats.aiAssisted + (card.selected !== 'D' && card.selected ? 1 : 0),
    vetoedByUser: stats.vetoedByUser + (card.convergenceState === 'VETOED' ? 1 : 0),
  };
  newStats.vetoRate =
    newStats.totalDecisions > 0 ? newStats.vetoedByUser / newStats.totalDecisions : 0;

  // Rolling average of decision quality (0-1)
  const prevQuality = stats.avgDecisionQuality ?? 0.5;
  newStats.avgDecisionQuality =
    (prevQuality * (newStats.totalDecisions - 1) + quality) / newStats.totalDecisions;

  // Rolling KR hit rate
  const prevHit = stats.krHitRate ?? 0;
  newStats.krHitRate =
    (prevHit * (newStats.totalDecisions - 1) + krHit) / newStats.totalDecisions;

  // 风格信号
  const styleProfile = updateStyleProfile(persona.styleProfile, card);

  // bossCaptureScore: 综合公式
  // (selfMade + aiAssisted commit) / total - vetoRate + qualityBonus
  const qualityBonus = (newStats.avgDecisionQuality - 0.5) * 0.2;
  const captureScore = clamp01(
    newStats.totalDecisions > 0
      ? (newStats.selfMade + newStats.aiAssisted) / newStats.totalDecisions -
          newStats.vetoRate +
          qualityBonus
      : 0
  );

  await store.personas.update(persona.id, {
    decisionHistory: newStats,
    styleProfile,
    bossCaptureScore: captureScore,
    updatedAt: new Date().toISOString(),
  } as never);

  // 阶段升级评估 (autonomy: 仅返回建议, 不自动升级)
  // 实际升级由员工本人在 UI 触发 (upgradeStage)
  try {
    const updated = await store.personas.get(persona.id);
    if (updated) checkUpgradeEligibility(updated);
  } catch {
    /* ignore */
  }
}

function updateStyleProfile(prev: StyleProfile, card: DecisionCard): StyleProfile {
  // 平均决策耗时 → decisionSpeed (使用指数移动平均, 更重视近期)
  const elapsed = card.elapsedSeconds ?? 0;
  let decisionSpeed: StyleProfile['decisionSpeed'] = prev.decisionSpeed;
  if (elapsed > 0) {
    const current = elapsed < 5 * 60 ? 'fast' : elapsed < 15 * 60 ? 'medium' : 'slow';
    // 70% 历史 + 30% 最新
    const speedScore = { fast: 0, medium: 0.5, slow: 1 };
    const hist = speedScore[prev.decisionSpeed] ?? 0.5;
    const now = speedScore[current] ?? 0.5;
    const blended = hist * 0.7 + now * 0.3;
    decisionSpeed = blended < 0.25 ? 'fast' : blended < 0.75 ? 'medium' : 'slow';
  }

  // 风险偏好: 看选定的 option type + 决策质量
  const opts = (card.options ?? []) as Array<{ id: string; risk?: string }>;
  const picked = opts.find((o) => o.id === card.selected);
  let risk = prev.riskAppetite;
  if (picked?.risk === 'low') risk = clamp01(risk - 0.03);
  else if (picked?.risk === 'high') risk = clamp01(risk + 0.03);

  // 高质量原创决策 → 略微提升风险偏好 (鼓励创新)
  const quality = computeDecisionQuality(card);
  if (card.selected === 'D' && quality > 0.7) {
    risk = clamp01(risk + 0.02);
  }

  // 偏好选项 (滚动窗口, 加权: 近期权重更高)
  const optionTypeMap: Record<string, StyleProfile['preferredOptions'][number]> = {
    A: 'SOP',
    B: 'reasoning',
    C: 'historical',
    D: 'original',
  };
  const preferred = [...prev.preferredOptions];
  const mapped = card.selected ? optionTypeMap[card.selected] : undefined;
  if (mapped) {
    preferred.push(mapped);
    if (preferred.length > 50) preferred.shift();
  }

  // 沟通示例: 议事室 commit 时把 reasoning 收录
  const examples = [...(prev.communicationExamples ?? [])];
  const reasoning = picked && (picked as { reasoning?: string }).reasoning;
  if (typeof reasoning === 'string' && reasoning.length > 20) {
    examples.push(reasoning);
    if (examples.length > COMMUNICATION_EXAMPLES_CAP) examples.shift();
  }

  // 沟通风格演化: 基于 reasoning 长度和复杂度
  let communicationStyle = prev.communicationStyle;
  if (typeof reasoning === 'string') {
    const len = reasoning.length;
    const hasNumbers = /\d+/.test(reasoning);
    const hasBullets = /[\-\*•]/.test(reasoning);
    if (len > 300 && hasNumbers && hasBullets) {
      communicationStyle = 'analytical';
    } else if (len > 200 && !hasNumbers) {
      communicationStyle = 'diplomatic';
    } else if (len < 100) {
      communicationStyle = 'direct';
    }
  }

  return {
    ...prev,
    decisionSpeed,
    riskAppetite: risk,
    preferredOptions: preferred,
    communicationExamples: examples,
    communicationStyle,
  };
}

// ---------------------------------------------------------------------------
// Decision quality scoring (0-1)
// ---------------------------------------------------------------------------

function computeDecisionQuality(card: DecisionCard): number {
  let score = 0.5; // baseline

  // 有明确的预期 KR 影响
  if (card.expectedKrImpact && card.expectedKrImpact.length > 0) score += 0.1;

  // 有关联的 Action Items (可执行)
  if (card.actionItems && card.actionItems.length > 0) score += 0.1;

  // 有复盘 (事后验证)
  if (card.retrospective) score += 0.2;

  // 决策耗时适中 (3-15 min = 认真但不拖延)
  const elapsed = card.elapsedSeconds ?? 0;
  if (elapsed >= 3 * 60 && elapsed <= 15 * 60) score += 0.1;

  // 选择了原创方案 (D) → 鼓励独立思考
  if (card.selected === 'D') score += 0.1;

  // 有 materialRefs (充分调研)
  if (card.materialRefs && card.materialRefs.length > 0) score += 0.05;

  return clamp01(score);
}

function computeKrHit(card: DecisionCard): number {
  // 是否关联了 KR
  if (!card.primaryKrId && !card.relatedKr?.length) return 0;

  // 如果有 retrospective 且实际结果正面 → 命中
  const retro = card.retrospective;
  if (retro) {
    const outcome = (retro.actualOutcome ?? '').toLowerCase();
    const positive = /成功|达成|完成|positive|achieved|completed/.test(outcome);
    const negative = /失败|未达成|取消|negative|failed|cancelled/.test(outcome);
    if (positive) return 1;
    if (negative) return 0;
  }

  // 无 retrospective 时, 用 expectedKrImpact 的存在作为代理信号
  return card.expectedKrImpact && card.expectedKrImpact.length > 0 ? 0.7 : 0.3;
}

/**
 * 计算到下一阶段的"距离" (用于 UI 显示进度条)
 */
export interface StageProgress {
  currentStage: Persona['stage'];
  nextStage: Persona['stage'] | null;
  daysInStage: number;
  daysRequired: number;
  decisionsMade: number;
  decisionsRequired: number;
  vetoRate: number;
  maxVetoRate: number;
  /** 0-1 (综合达成率) */
  overallProgress: number;
  /** 是否所有条件满足, 等待员工本人确认 */
  readyForUpgrade: boolean;
  blockedReasons: string[];
}

export async function computeStageProgress(personaId: string): Promise<StageProgress | null> {
  const store = getStore();
  const persona = await store.personas.get(personaId);
  if (!persona) return null;

  const STAGE_ORDER: Persona['stage'][] = ['newborn', 'apprentice', 'assistant', 'deputy', 'partner'];
  const currentIdx = STAGE_ORDER.indexOf(persona.stage);
  const next = STAGE_ORDER[currentIdx + 1] ?? null;

  const daysInStage = Math.floor(
    (Date.now() - new Date(persona.stageEnteredAt).getTime()) / 86400_000
  );

  // 升级条件 (与 lib/types/persona.ts:STAGE_UPGRADE_CRITERIA 对齐)
  const criteria: Record<string, { minDays: number; minDecisions: number; maxVetoRate: number }> = {
    newborn: { minDays: 14, minDecisions: 5, maxVetoRate: 1.0 },
    apprentice: { minDays: 60, minDecisions: 30, maxVetoRate: 0.4 },
    assistant: { minDays: 180, minDecisions: 80, maxVetoRate: 0.25 },
    deputy: { minDays: 365, minDecisions: 200, maxVetoRate: 0.15 },
    partner: { minDays: Infinity, minDecisions: Infinity, maxVetoRate: 0 },
  };
  const c = criteria[persona.stage];

  const blockedReasons: string[] = [];
  if (daysInStage < c.minDays) blockedReasons.push(`时长不足 (${daysInStage}/${c.minDays} 天)`);
  if (persona.decisionHistory.totalDecisions < c.minDecisions) {
    blockedReasons.push(`决议数不足 (${persona.decisionHistory.totalDecisions}/${c.minDecisions})`);
  }
  if (persona.decisionHistory.vetoRate > c.maxVetoRate) {
    blockedReasons.push(
      `否决率过高 (${(persona.decisionHistory.vetoRate * 100).toFixed(1)}% > ${(c.maxVetoRate * 100).toFixed(0)}%)`
    );
  }

  const dayProg = Math.min(1, daysInStage / c.minDays);
  const decProg = Math.min(1, persona.decisionHistory.totalDecisions / c.minDecisions);
  const vetoProg = persona.decisionHistory.vetoRate <= c.maxVetoRate ? 1 : 0;

  return {
    currentStage: persona.stage,
    nextStage: next,
    daysInStage,
    daysRequired: c.minDays,
    decisionsMade: persona.decisionHistory.totalDecisions,
    decisionsRequired: c.minDecisions,
    vetoRate: persona.decisionHistory.vetoRate,
    maxVetoRate: c.maxVetoRate,
    overallProgress: (dayProg + decProg + vetoProg) / 3,
    readyForUpgrade: blockedReasons.length === 0 && next !== null,
    blockedReasons,
  };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
