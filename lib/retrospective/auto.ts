/**
 * Auto Retrospective · 决议执行后自动复盘
 *
 * 触发: 决议 COMMIT 后 N 天 (默认 7 天) 自动复盘.
 *
 * 流程:
 *   1. 调度器扫描 vetoWindowEnds < now - 7d 且 retrospective 缺失的卡
 *   2. LLM (long_context 场景 → Kimi K2) 综合 ORIGIN + Action item 完成度生成草稿
 *   3. 推送给负责人 review
 *   4. 决定是否 promote 为 Memory (case 类型)
 */

import { getStore } from '../storage/repository';
import { getRouter } from '../boot';
import { audit } from '../audit/log';
import type { DecisionCard } from '../types/decision-card';

const RETROSPECTIVE_DELAY_DAYS = 7;

export interface RetrospectiveDraft {
  cardId: string;
  actualOutcome: string;
  learning: string;
  shouldPromoteToMemory: boolean;
  promoteAs?: 'sop' | 'case';
}

export async function generateRetrospective(cardId: string): Promise<RetrospectiveDraft | null> {
  const store = getStore();
  const card = await store.decisionCards.get(cardId);
  if (!card || card.convergenceState !== 'COMMIT') return null;

  // Action item 完成度
  const actionItems = card.actionItems ?? [];
  const doneCount = actionItems.filter((a) => a.status === 'done').length;
  const completionRate = actionItems.length > 0 ? doneCount / actionItems.length : 0;

  const router = getRouter();
  let aiText = '';
  try {
    const res = await router.chat({
      scenario: 'long_context',
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content: `你是 Tandem 复盘 Agent. 任务: 基于决议 + Action items 完成度, 生成复盘.

输出 JSON: {actualOutcome, learning, shouldPromoteToMemory (boolean), promoteAs ("sop" | "case" | null)}.

判断 shouldPromoteToMemory:
- 决议很成功且方法可复用 → true, promoteAs: "sop"
- 决议失败但教训重要 → true, promoteAs: "case"
- 普通决议 → false`,
        },
        {
          role: 'user',
          content: `决议: ${card.title}
选定: ${card.selected ?? '(未选)'}
Action items 完成率: ${(completionRate * 100).toFixed(0)}%
${actionItems.map((a) => `- [${a.status}] ${a.task}`).join('\n')}`,
        },
      ],
      responseFormat: 'json',
    });
    aiText = typeof res.message.content === 'string' ? res.message.content : '{}';
  } catch {
    aiText = '{}';
  }

  let parsed: Partial<RetrospectiveDraft> = {};
  try {
    parsed = JSON.parse(aiText);
  } catch {
    /* fallback */
  }

  const draft: RetrospectiveDraft = {
    cardId,
    actualOutcome: parsed.actualOutcome ?? `Action items 完成率 ${(completionRate * 100).toFixed(0)}%`,
    learning: parsed.learning ?? '',
    shouldPromoteToMemory: parsed.shouldPromoteToMemory ?? false,
    promoteAs: parsed.promoteAs,
  };

  // 写回 DecisionCard.retrospective
  await store.decisionCards.update(cardId, {
    retrospective: {
      reviewAt: new Date().toISOString(),
      actualOutcome: draft.actualOutcome,
      learning: draft.learning,
    },
  });

  await audit('decision_card.update', 'system', {
    targetId: cardId,
    targetType: 'decision_card',
    metadata: { event: 'retrospective_generated', shouldPromoteToMemory: draft.shouldPromoteToMemory },
  });

  // S3 · Reflection 闭环: shouldPromoteToMemory=true 时自动起草 Memory 候选
  if (draft.shouldPromoteToMemory && draft.promoteAs && draft.learning) {
    try {
      await autoProposeMemoryFromRetrospective({
        cardId,
        cardTitle: card.title,
        learning: draft.learning,
        actualOutcome: draft.actualOutcome,
        promoteAs: draft.promoteAs,
        proposerId: 'system',
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[reflection] auto-propose failed:', err);
    }
  }

  return draft;
}

/**
 * S3 · 自动从复盘起草 Memory 候选 (走标准签批流程, 不绕过审批)
 *
 * 行为:
 *   1. 创建 Material (sourceMaterialId 用 cardId, 类型 'retrospective')
 *   2. proposePromotion(level='team', proposedType='sop'|'case')
 *   3. 写 audit memory.promotion_proposed (proposerId='system' 标记 AI 起草)
 *
 * 这就把"7 天后复盘"和"Memory 沉淀"打通了 — Nous Hermes 的 Reflection 闭环.
 * 主管/steward 看到 system 起草的 promotion 时, 走人审, AI 不绕过.
 */
async function autoProposeMemoryFromRetrospective(input: {
  cardId: string;
  cardTitle: string;
  learning: string;
  actualOutcome: string;
  promoteAs: 'sop' | 'case';
  proposerId: string;
}): Promise<void> {
  const store = getStore();
  const now = new Date().toISOString();
  // 1. Material (用决议为源, 类型固定 retrospective)
  const material = await store.materials.create({
    type: 'retrospective',
    title: `复盘提取: ${input.cardTitle}`,
    body: `**实际结果**\n${input.actualOutcome}\n\n**关键学习**\n${input.learning}`,
    originRefs: [`decision_card:${input.cardId}`],
    participants: [input.proposerId],
    visibility: 'team',
    createdBy: input.proposerId,
    createdAt: now,
    updatedAt: now,
  });

  // 2. Promotion request (默认 team 级, 主管签即可, 反 AI 绕过)
  const { proposePromotion } = await import('../memory/promotion-flow');
  await proposePromotion({
    materialId: material.id,
    proposedType: input.promoteAs,
    proposedTitle: input.cardTitle,
    proposedBody: input.learning,
    proposerId: input.proposerId,
    level: 'team',
  });

  await audit('decision_card.update', 'system', {
    targetId: input.cardId,
    targetType: 'decision_card',
    metadata: { event: 'reflection_promoted_to_memory_candidate', promoteAs: input.promoteAs },
  });
}

/**
 * 调度任务: 扫描所有需要复盘的决议
 */
export async function scanRetrospectives(): Promise<{ processed: number }> {
  const store = getStore();
  const now = Date.now();
  const cutoff = now - RETROSPECTIVE_DELAY_DAYS * 86400_000;

  const cards = await store.decisionCards.list();
  const candidates = cards.filter(
    (c: DecisionCard) =>
      c.convergenceState === 'COMMIT' &&
      !c.retrospective &&
      new Date(c.createdAt).getTime() < cutoff
  );

  let count = 0;
  for (const card of candidates) {
    try {
      await generateRetrospective(card.id);
      count++;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[retrospective] failed for ${card.id}:`, err);
    }
  }
  return { processed: count };
}
