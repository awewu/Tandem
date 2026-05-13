/**
 * Persona Evolution Engine · 5 阶段升级引擎
 *
 * 对应 PERSONA-EVOLUTION + MANIFESTO 第十二/十三条
 *
 * 5 阶段:
 *   newborn 🥚 (0-2w, 仅旁听)
 *   apprentice 🐣 (2w-2m, 简单 standup)
 *   assistant 🐤 (2m-6m, 绿区会议表态)
 *   deputy 🦅 (6m-1y, 黄区会议短承诺)
 *   partner 🐉 (>1y, 跨企业除红区)
 *
 * 升级条件:
 *   - 时长达标 (minDays)
 *   - 决议数达标 (minDecisions)
 *   - 否决率达标 (vetoRate ≤ maxVetoRate)
 *   - 最终员工本人确认 (autonomy bound)
 */

import type {
  Persona,
  PersonaStage,
  DecisionHistoryStats,
  StyleProfile,
  GrowthArea,
} from '../types/persona';
import {
  STAGE_TO_DEFAULT_DELEGATION,
  STAGE_UPGRADE_CRITERIA,
  canUpgradeStage,
} from '../types/persona';
import { getStore, generateId } from '../storage/repository';
import { audit } from '../audit/log';

const STAGE_ORDER: PersonaStage[] = [
  'newborn',
  'apprentice',
  'assistant',
  'deputy',
  'partner',
];

// ---------------------------------------------------------------------------
// 创建 / 初始化
// ---------------------------------------------------------------------------

export async function createPersona(userId: string): Promise<Persona> {
  const store = getStore();
  const now = new Date().toISOString();

  const initial: Omit<Persona, 'id'> = {
    userId,
    schemaVersion: 'tandem.v1',
    stage: 'newborn',
    stageEnteredAt: now,
    delegationLevel: STAGE_TO_DEFAULT_DELEGATION.newborn,
    decisionHistory: emptyHistory(),
    styleProfile: emptyStyle(),
    growthAreas: [],
    bossCaptureScore: 0,
    dataOwnership: {
      companyOwnsData: true,
      anonymizationPending: false,
      employeeCanExportOrigins: true,
    },
    learningActive: true,
    createdAt: now,
    updatedAt: now,
  };

  return store.personas.create({ ...initial, id: generateId('persona') });
}

function emptyHistory(): DecisionHistoryStats {
  return {
    totalDecisions: 0,
    selfMade: 0,
    aiAssisted: 0,
    vetoedByUser: 0,
    vetoRate: 0,
    avgDecisionQuality: 0.5,
    krHitRate: 0,
  };
}

function emptyStyle(): StyleProfile {
  return {
    decisionSpeed: 'medium',
    riskAppetite: 0.5,
    communicationStyle: 'analytical',
    preferredOptions: [],
    communicationExamples: [],
  };
}

// ---------------------------------------------------------------------------
// 决议归档时更新 Persona 统计 (议事室 COMMIT 后调用)
// ---------------------------------------------------------------------------

export async function recordDecision(
  userId: string,
  meta: { selectedByAi: boolean; vetoed: boolean; selectedOption?: 'A' | 'B' | 'C' | 'D' }
): Promise<Persona> {
  const store = getStore();
  const personas = await store.personas.list({ userId } as never);
  const persona = personas[0];
  if (!persona) {
    throw new Error(`Persona not found for user ${userId}`);
  }

  const h = persona.decisionHistory;
  const total = h.totalDecisions + 1;
  const aiAssisted = h.aiAssisted + (meta.selectedByAi ? 1 : 0);
  const selfMade = h.selfMade + (meta.selectedByAi ? 0 : 1);
  const vetoedByUser = h.vetoedByUser + (meta.vetoed ? 1 : 0);

  const newHistory: DecisionHistoryStats = {
    totalDecisions: total,
    selfMade,
    aiAssisted,
    vetoedByUser,
    vetoRate: total > 0 ? vetoedByUser / total : 0,
    avgDecisionQuality: h.avgDecisionQuality ?? 0.5,
    krHitRate: h.krHitRate ?? 0,
  };

  // 更新偏好选项
  const newStyle = updateStyleFromChoice(persona.styleProfile, meta.selectedOption);

  return store.personas.update(persona.id, {
    decisionHistory: newHistory,
    styleProfile: newStyle,
    updatedAt: new Date().toISOString(),
  });
}

function updateStyleFromChoice(
  style: StyleProfile,
  option?: 'A' | 'B' | 'C' | 'D'
): StyleProfile {
  if (!option) return style;
  const map: Record<'A' | 'B' | 'C' | 'D', StyleProfile['preferredOptions'][number]> = {
    A: 'SOP',
    B: 'reasoning',
    C: 'historical',
    D: 'original',
  };
  const newPref = map[option];
  const recent = [...style.preferredOptions.slice(-19), newPref];
  return { ...style, preferredOptions: recent };
}

// ---------------------------------------------------------------------------
// 阶段升级检查 (定时任务调用 / 决议归档后调用)
// ---------------------------------------------------------------------------

export interface UpgradeCheckResult {
  eligible: boolean;
  currentStage: PersonaStage;
  nextStage: PersonaStage | null;
  reason: string;
  /** 员工需手动确认 (autonomy 守门) */
  requiresUserConfirmation: boolean;
}

export function checkUpgradeEligibility(persona: Persona): UpgradeCheckResult {
  const idx = STAGE_ORDER.indexOf(persona.stage);
  const next = idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1] : null;

  if (!next) {
    return {
      eligible: false,
      currentStage: persona.stage,
      nextStage: null,
      reason: '已达最高阶段 (partner)',
      requiresUserConfirmation: false,
    };
  }

  const ok = canUpgradeStage(persona);
  if (!ok) {
    const c = STAGE_UPGRADE_CRITERIA[persona.stage]!;
    const ageDays =
      (Date.now() - new Date(persona.stageEnteredAt).getTime()) / 86_400_000;
    const missing: string[] = [];
    if (ageDays < c.minDays) missing.push(`时长 (${ageDays.toFixed(0)}/${c.minDays}天)`);
    if (persona.decisionHistory.totalDecisions < c.minDecisions) {
      missing.push(`决议数 (${persona.decisionHistory.totalDecisions}/${c.minDecisions})`);
    }
    if (persona.decisionHistory.vetoRate > c.maxVetoRate) {
      missing.push(
        `否决率过高 (${(persona.decisionHistory.vetoRate * 100).toFixed(1)}% > ${(
          c.maxVetoRate * 100
        ).toFixed(0)}%)`
      );
    }
    return {
      eligible: false,
      currentStage: persona.stage,
      nextStage: next,
      reason: `未满足: ${missing.join(', ')}`,
      requiresUserConfirmation: false,
    };
  }

  return {
    eligible: true,
    currentStage: persona.stage,
    nextStage: next,
    reason: '所有条件已满足',
    requiresUserConfirmation: true,
  };
}

/** 员工确认升级 (autonomy 守门) */
export async function upgradeStage(personaId: string, triggeredBy: 'user' | 'auto' = 'user'): Promise<Persona> {
  const store = getStore();
  const persona = await store.personas.get(personaId);
  if (!persona) throw new Error(`Persona ${personaId} not found`);

  const check = checkUpgradeEligibility(persona);
  if (!check.eligible || !check.nextStage) {
    throw new Error(`不可升级: ${check.reason}`);
  }

  const updated = await store.personas.update(personaId, {
    stage: check.nextStage,
    stageEnteredAt: new Date().toISOString(),
    delegationLevel: STAGE_TO_DEFAULT_DELEGATION[check.nextStage],
    updatedAt: new Date().toISOString(),
  });

  await audit('persona.upgrade', triggeredBy === 'auto' ? 'system' : persona.userId, {
    targetId: personaId,
    targetType: 'persona',
    metadata: {
      from: check.currentStage,
      to: check.nextStage,
      triggeredBy,
      decisions: persona.decisionHistory.totalDecisions,
      vetoRate: persona.decisionHistory.vetoRate,
    },
  });

  return updated;
}

// ---------------------------------------------------------------------------
// 自动升阶扫描器 (cron 调用, 宪章 §15: AI 助员工成长)
// ---------------------------------------------------------------------------

/**
 * 自动升阶策略 (autonomy 守门):
 *   - newborn → apprentice : 自动 (低风险, 仅旁听 → 简单汇报)
 *   - apprentice → assistant : 自动 (绿区会议表态, 仍受 24h 否决保护)
 *   - assistant → deputy : 创建"升级提议", 等员工本人确认 (黄区代行需明确授权)
 *   - deputy → partner : 创建"升级提议", 等员工本人确认 (跨企业代行需 explicit consent)
 *
 * 这样既不让员工每次手动升级 (繁琐), 也不让 AI 越权扩张代行边界.
 */
const SILENT_AUTO_UPGRADE_FROM: PersonaStage[] = ['newborn', 'apprentice'];

export interface PersonaScanResult {
  scanned: number;
  autoUpgraded: number;
  awaitingConfirmation: number;
}

export async function scanPersonaUpgrades(): Promise<PersonaScanResult> {
  const store = getStore();
  const all = await store.personas.list();
  let autoUpgraded = 0;
  let awaiting = 0;

  for (const p of all) {
    const check = checkUpgradeEligibility(p);
    if (!check.eligible || !check.nextStage) continue;

    if (SILENT_AUTO_UPGRADE_FROM.includes(p.stage)) {
      // 静默自动升 (低风险阶段)
      try {
        await upgradeStage(p.id, 'auto');
        autoUpgraded++;
      } catch {
        /* ignore concurrent upgrade */
      }
    } else {
      // 高风险阶段: 标记为待确认 (写到 growthAreas, 让 UI 暴露)
      const hasPending = p.growthAreas.some(
        (g) => g.category === 'upgrade_proposal' && g.status === 'identified'
      );
      if (!hasPending) {
        await store.personas.update(p.id, {
          growthAreas: [
            ...p.growthAreas,
            {
              id: generateId('growth'),
              category: 'upgrade_proposal',
              description: `符合升级 ${check.currentStage} → ${check.nextStage} 条件, 等待员工本人确认 (autonomy 守门)`,
              identifiedAt: new Date().toISOString(),
              status: 'identified',
            } satisfies GrowthArea,
          ],
          updatedAt: new Date().toISOString(),
        });
        awaiting++;
      }
    }
  }

  return { scanned: all.length, autoUpgraded, awaitingConfirmation: awaiting };
}

// ---------------------------------------------------------------------------
// 降级 (员工主动 / 异常 vetoRate 自动触发)
// ---------------------------------------------------------------------------

export async function downgradeStage(
  personaId: string,
  reason: string
): Promise<Persona> {
  const store = getStore();
  const persona = await store.personas.get(personaId);
  if (!persona) throw new Error(`Persona ${personaId} not found`);

  const idx = STAGE_ORDER.indexOf(persona.stage);
  if (idx === 0) {
    return persona; // 已最低
  }

  const previous = STAGE_ORDER[idx - 1];
  return store.personas.update(personaId, {
    stage: previous,
    stageEnteredAt: new Date().toISOString(),
    delegationLevel: STAGE_TO_DEFAULT_DELEGATION[previous],
    growthAreas: [
      ...persona.growthAreas,
      {
        id: generateId('growth'),
        category: 'downgrade',
        description: `阶段降级: ${reason}`,
        identifiedAt: new Date().toISOString(),
        status: 'identified',
      } satisfies GrowthArea,
    ],
    updatedAt: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// 拿捏老板度计算 (基于多维度)
// ---------------------------------------------------------------------------

export function computeBossCaptureScore(persona: Persona): number {
  const stageWeight: Record<PersonaStage, number> = {
    newborn: 10,
    apprentice: 25,
    assistant: 50,
    deputy: 75,
    partner: 95,
  };
  const base = stageWeight[persona.stage];
  const vetoBonus = (1 - persona.decisionHistory.vetoRate) * 5; // 0-5
  return Math.min(100, Math.round(base + vetoBonus));
}
