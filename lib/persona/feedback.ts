/**
 * Persona Feedback Service · 闭环④ 反馈评分
 *
 * - 记录用户对每条 ProxyAction 的 👍/👎
 * - 反馈计入 bossCaptureScore 的多维公式
 */

import { getStore } from '../storage/repository';
import type { PersonaFeedback } from '../types/persona-feedback';
import type { Persona } from '../types/persona';

export interface CreateFeedbackInput {
  proxyActionId: string;
  userId: string;
  personaId: string;
  tenantId: string;
  kind: 'thumbs_up' | 'thumbs_down';
  reason?: string;
}

/** 创建反馈记录 */
export async function createFeedback(input: CreateFeedbackInput): Promise<PersonaFeedback> {
  const store = getStore();
  const feedback = await store.personaFeedbacks.create({
    id: generateId(),
    ...input,
    createdAt: new Date().toISOString(),
  });
  return feedback;
}

/** 列出用户的所有反馈 */
export async function listFeedbackByUser(userId: string, limit = 100): Promise<PersonaFeedback[]> {
  const store = getStore();
  const all = await store.personaFeedbacks.list();
  return all
    .filter((f) => f.userId === userId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit);
}

/** 计算最近N条反馈的得分 */
export function computeFeedbackBonus(
  feedbacks: Pick<PersonaFeedback, 'kind'>[],
  maxBonus = 5
): number {
  if (feedbacks.length === 0) return 0;
  let sum = 0;
  for (const f of feedbacks) {
    sum += f.kind === 'thumbs_up' ? 1 : -1;
  }
  const avg = sum / feedbacks.length;
  return Math.round(avg * maxBonus);
}

/** 重新计算并更新 bossCaptureScore (包含 feedback) */
export async function recalcBossCaptureScore(persona: Persona): Promise<number> {
  const store = getStore();

  // 1. 阶段基础分
  const stageWeight: Record<Persona['stage'], number> = {
    newborn: 10,
    apprentice: 25,
    assistant: 50,
    deputy: 75,
    partner: 95,
  };
  const base = stageWeight[persona.stage];

  // 2. 否决率奖励
  const vetoBonus = (1 - persona.decisionHistory.vetoRate) * 5;

  // 3. 反馈奖励 (最近50条)
  const feedbacks = await listFeedbackByUser(persona.userId, 50);
  const feedbackBonus = computeFeedbackBonus(feedbacks, 5);

  const newScore = Math.min(100, Math.round(base + vetoBonus + feedbackBonus));

  // 更新 persona
  await store.personas.update(persona.id, {
    bossCaptureScore: newScore,
    updatedAt: new Date().toISOString(),
  } as never);

  return newScore;
}

function generateId(): string {
  return `pf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
