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
  const t0 = Date.now();
  const store = getStore();
  const card = await store.decisionCards.get(cardId);
  if (!card || card.convergenceState !== 'COMMIT') return null;

  // Action item 完成度
  const actionItems = card.actionItems ?? [];
  const doneCount = actionItems.filter((a) => a.status === 'done').length;
  const completionRate = actionItems.length > 0 ? doneCount / actionItems.length : 0;

  const router = getRouter();
  let aiText = '';
  let llmRan = false;
  let llmUsage: { promptTokens?: number; completionTokens?: number } | undefined;
  let llmModel = 'unknown';

  // §T15 baseline-guard: 自动复盘前的组织记忆基线校验
  // actor 用决议发起人 (autonomous 后台任务, 但责任归属到 createdBy)
  const actorUserId = card.createdBy ?? 'system';
  let baselineContext = '';
  let baselineBlocked = false;
  try {
    const { checkBaseline } = await import('../memory/baseline-guard');
    const guard = await checkBaseline({
      intent: `自动复盘决议: ${card.title}`,
      actorUserId,
      agentKind: 'autonomous',
      toolName: 'retrospective.auto',
    });
    if (guard.verdict === 'HARD_BLOCK') {
      baselineBlocked = true;
      // 通知治理委员会
      try {
        const { emit } = await import('../workflows/engine');
        await emit({
          type: 'workflow.custom',
          payload: {
            customType: 'retrospective.baseline.blocked',
            cardId,
            actorUserId,
            reason: guard.reasons.join('; '),
            hits: guard.hits.slice(0, 5).map((h) => ({
              memoryId: h.memoryId,
              title: h.title,
              ownershipLevel: h.ownershipLevel,
            })),
            checkId: guard.checkId,
          },
        });
      } catch {
        /* workflow 失败不阻塞, baseline-guard 已 audit */
      }
    } else if (guard.verdict === 'SOFT_WARN' && guard.contextToInject) {
      baselineContext = guard.contextToInject;
    }
  } catch {
    /* baseline-guard 失败 fail-open, 不阻塞复盘 */
  }

  if (baselineBlocked) {
    // 降级: 不调 LLM, 用基于数据的降级版本
    aiText = JSON.stringify({
      actualOutcome: `Action items 完成率 ${(completionRate * 100).toFixed(0)}% (LLM 复盘被组织记忆基线阻断, 仅数据视图)`,
      learning: '本次复盘的 LLM 推演命中组织记忆基线红线, 需员工人工补完关键学习并经主管签批后方可入 Memory.',
      shouldPromoteToMemory: false,
      promoteAs: null,
    });
  } else {
    const systemBase = `你是 Tandem 复盘 Agent. 任务: 基于决议 + Action items 完成度, 生成复盘.

输出 JSON: {actualOutcome, learning, shouldPromoteToMemory (boolean), promoteAs ("sop" | "case" | null)}.

判断 shouldPromoteToMemory:
- 决议很成功且方法可复用 → true, promoteAs: "sop"
- 决议失败但教训重要 → true, promoteAs: "case"
- 普通决议 → false`;
    const systemContent = baselineContext
      ? `${baselineContext}\n\n---\n\n${systemBase}\n- 必须遵守上方的组织记忆基线`
      : systemBase;
    try {
      const res = await router.chat({
        scenario: 'long_context',
        temperature: 0.4,
        messages: [
          { role: 'system', content: systemContent },
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
      llmRan = true;
      llmUsage = res.usage;
      llmModel = res.model ?? 'long_context';
    } catch {
      aiText = '{}';
    }
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

  // §CA-13 闭环 (2026-06-09 · 补燃料): 落地 retrospective_draft 决策给反思循环喂料.
  //   与 meeting_advice 不同: meeting_advice 是议事 COMMIT 时的 AI 建议, retrospective_draft 是 7 天后
  //   AI 看 action item 完成率回头反思. 不同 LLM 调用 = 不同决策 = 应分别评估.
  //   仅 LLM 真跑过才记 (baseline_blocked 走数据降级 path, 不是 AI 决策, 不该污染 adoptionRate 分母).
  //   Owner 在台账/admin 看到草稿后通过 admin inline 反馈 (781fd5e) 标 adopted/overruled.
  if (llmRan) {
    try {
      const { recordDecision } = await import('../persona/company-brain-decision');
      const { estimateCostMicroUsd } = await import('../analytics/track');
      const tokensIn = llmUsage?.promptTokens ?? 0;
      const tokensOut = llmUsage?.completionTokens ?? 0;
      const inputSummary = `复盘: ${card.title} · 完成率 ${(completionRate * 100).toFixed(0)}%`;
      const outputSummary = `${draft.actualOutcome.slice(0, 200)} · 学习: ${draft.learning.slice(0, 200)}${
        draft.shouldPromoteToMemory ? ` · 提议入 Memory (${draft.promoteAs})` : ''
      }`;
      await recordDecision({
        context: 'retrospective_draft',
        inputSummary,
        outputSummary,
        modelUsed: llmModel,
        providerUsed: 'router',
        scenario: 'long_context',
        tokensIn,
        tokensOut,
        costMicroUsd: estimateCostMicroUsd(llmModel, tokensIn, tokensOut),
        latencyMs: Date.now() - t0,
        refId: cardId,
        refType: 'decision_card',
      });
    } catch {
      /* 决策记录失败不影响复盘主流程 */
    }
  }

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
