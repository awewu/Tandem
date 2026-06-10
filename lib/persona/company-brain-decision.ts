/**
 * CompanyBrain Decision · 决策记录 + 反馈层 (CA-13)
 *
 * 每次中央 AI 输出 (im_reply / baseline_arbitration / meeting_advice / ...)
 * 都通过 recordDecision() 持久化, 后续治理委员会通过 setFeedback() 给采纳/推翻判定.
 *
 * 这是智能迭代的"训练数据"层. Reflection (反思循环) 读这层做月度自评 + 配置调整.
 */

import type {
  CompanyBrainDecision,
  CompanyBrainDecisionContext,
  CompanyBrainFeedback,
  CompanyBrainFeedbackOutcome,
} from '@/lib/types/company-brain';
import type { DecisionCard } from '@/lib/types/decision-card';
import { getStore } from '@/lib/storage/repository';
import { logger } from '@/lib/infra/logger';
import {
  DEFAULT_BRAIN_VERSION_NUMBER,
} from '@/lib/types/company-brain';

export interface RecordDecisionInput {
  context: CompanyBrainDecisionContext;
  inputSummary: string;
  outputSummary: string;
  retrievedMemoryIds?: string[];
  modelUsed: string;
  providerUsed: string;
  scenario: string;
  tokensIn: number;
  tokensOut: number;
  costMicroUsd: number;
  latencyMs: number;
  aiTraceId?: string;
  refId?: string;
  refType?: string;
  tenantId?: string;
  brainVersion?: number;
}

function genDecisionId(): string {
  return `cbd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 持久化一条 CompanyBrain Decision.
 * 永不抛错 (best-effort), 失败仅 warn — 决策记录不能阻塞主流程.
 */
export async function recordDecision(input: RecordDecisionInput): Promise<CompanyBrainDecision | null> {
  try {
    const store = getStore();
    const now = new Date().toISOString();
    // 取当前活跃 CompanyBrain 版本号 (V1.5 简化: 拿 versions 表最大值, 找不到默认 1)
    let brainVersion = input.brainVersion ?? DEFAULT_BRAIN_VERSION_NUMBER;
    if (input.brainVersion === undefined) {
      try {
        const versions = await store.companyBrainVersions.list();
        if (versions.length > 0) {
          brainVersion = Math.max(...versions.map((v) => v.version));
        }
      } catch {
        /* 用默认 v1 */
      }
    }

    const decision: CompanyBrainDecision = {
      id: genDecisionId(),
      createdAt: now,
      tenantId: input.tenantId ?? 'default',
      context: input.context,
      refId: input.refId,
      refType: input.refType,
      inputSummary: input.inputSummary.slice(0, 500),
      retrievedMemoryIds: input.retrievedMemoryIds ?? [],
      outputSummary: input.outputSummary.slice(0, 1000),
      modelUsed: input.modelUsed,
      providerUsed: input.providerUsed,
      scenario: input.scenario,
      tokensIn: input.tokensIn,
      tokensOut: input.tokensOut,
      costMicroUsd: input.costMicroUsd,
      latencyMs: input.latencyMs,
      aiTraceId: input.aiTraceId,
      feedback: { outcome: 'pending' },
      brainVersion,
    };

    await store.companyBrainDecisions.create(decision);
    return decision;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, '[company-brain-decision] record failed');
    return null;
  }
}

/**
 * 写反馈 (治理委员会 / 员工对中央 AI 输出的采纳/推翻).
 * outcome ∈ adopted/modified/overruled/ignored
 */
export async function setFeedback(
  decisionId: string,
  feedback: Omit<CompanyBrainFeedback, 'outcome'> & {
    outcome: Exclude<CompanyBrainFeedbackOutcome, 'pending'>;
  }
): Promise<CompanyBrainDecision | null> {
  const store = getStore();
  const decision = await store.companyBrainDecisions.get(decisionId);
  if (!decision) return null;

  const updated: CompanyBrainDecision = {
    ...decision,
    feedback: {
      outcome: feedback.outcome,
      feedbackBy: feedback.feedbackBy,
      feedbackAt: feedback.feedbackAt ?? new Date().toISOString(),
      reason: feedback.reason?.slice(0, 500),
      correctedOutput: feedback.correctedOutput?.slice(0, 1000),
    },
  };
  await store.companyBrainDecisions.update(decisionId, updated);

  logger.info(
    {
      decisionId,
      outcome: feedback.outcome,
      by: feedback.feedbackBy,
      brainVersion: decision.brainVersion,
    },
    '[company-brain-decision] feedback recorded'
  );

  return updated;
}

/** 查 decisions (按时间窗口 / context 过滤) */
export interface ListDecisionsFilter {
  tenantId?: string;
  context?: CompanyBrainDecisionContext;
  outcome?: CompanyBrainFeedbackOutcome;
  /** 取最近 N 条 (默认 100) */
  limit?: number;
  /** 创建时间 ≥ */
  since?: string;
  brainVersion?: number;
}

export async function listDecisions(filter: ListDecisionsFilter = {}): Promise<CompanyBrainDecision[]> {
  const store = getStore();
  const all = await store.companyBrainDecisions.list();

  let filtered = all;
  if (filter.tenantId) filtered = filtered.filter((d) => d.tenantId === filter.tenantId);
  if (filter.context) filtered = filtered.filter((d) => d.context === filter.context);
  if (filter.outcome) filtered = filtered.filter((d) => d.feedback.outcome === filter.outcome);
  if (filter.since) filtered = filtered.filter((d) => d.createdAt >= filter.since!);
  if (filter.brainVersion !== undefined) {
    filtered = filtered.filter((d) => d.brainVersion === filter.brainVersion);
  }

  // 按 createdAt 倒序
  filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const limit = filter.limit ?? 100;
  return filtered.slice(0, limit);
}

/**
 * 通过 refId + refType 反查 decision (UI 用 IM messageId 找对应 decision)
 * 返回最近的一条 (refId 理论上唯一, 但保守取最新)
 */
export async function getDecisionByRefId(
  refId: string,
  refType?: string
): Promise<CompanyBrainDecision | null> {
  const store = getStore();
  const all = await store.companyBrainDecisions.list();
  const matched = all
    .filter((d) => d.refId === refId && (refType === undefined || d.refType === refType))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return matched[0] ?? null;
}

/**
 * §CA-13 议事闭环 · 决议卡 COMMIT/VETO 时把"中央 AI 参谋方案 (Option B)"是否被采纳
 * 作为一条 meeting_advice 决策落地, 并**立即**写反馈 — 议事的选项选择本身就是天然的
 * 采纳/推翻信号, 立即反馈可避免 pending→ignored 衰减, 给反思循环稳定的学习梯度.
 *
 * 归因:
 *   - 选 B (AI 推演)            → adopted
 *   - 选 A/C (AI 召回的 SOP/历史) → modified (用了 AI 浮现的记忆, 非纯推演也非纯人工)
 *   - 选 D (员工原创) / VETO      → overruled
 *
 * VETO 时若已有该卡的决策记录 (COMMIT 阶段已落), 则**翻转既有记录**为 overruled,
 * 而非重复记一条 (避免同卡双计).
 *
 * 永不抛错 (best-effort).
 */
export async function recordMeetingAdviceOutcome(
  card: DecisionCard,
  opts: { decidedBy: string; vetoed?: boolean },
): Promise<CompanyBrainDecision | null> {
  try {
    const selected = card.selected;
    const vetoed = opts.vetoed ?? false;
    // 既无选择又非否决 → 无可归因信号, 跳过
    if (!selected && !vetoed) return null;

    // VETO: 优先翻转既有决策记录, 不重复落条
    if (vetoed) {
      const existing = await getDecisionByRefId(card.id, 'decision_card');
      if (existing) {
        return setFeedback(existing.id, {
          outcome: 'overruled',
          feedbackBy: opts.decidedBy,
          reason: '议事 24h 否决窗口内被撤回',
        });
      }
    }

    let outcome: Exclude<CompanyBrainFeedbackOutcome, 'pending'>;
    let reason: string;
    if (vetoed) {
      outcome = 'overruled';
      reason = '议事 24h 否决窗口内被撤回';
    } else if (selected === 'B') {
      outcome = 'adopted';
      reason = '议事选定 Option B (中央 AI 推演方案)';
    } else if (selected === 'D') {
      outcome = 'overruled';
      reason = '议事选定 Option D (员工原创), 中央 AI 方案未被采纳';
    } else {
      outcome = 'modified';
      reason = `议事选定 Option ${selected} (AI 召回的 ${selected === 'A' ? 'SOP' : '历史案例'})`;
    }

    const optionB = card.options.find((o) => o.id === 'B');
    const outputSummary = optionB?.description ?? '(本议题未生成 Option B)';
    const inputSummary = card.title;

    // 流式无 usage, 与 IM 路径一致用近似 (中文 1 char ≈ 1.5 token, 其他 ≈ 0.3)
    const estimateTokens = (text: string): number => {
      let t = 0;
      for (const ch of text) t += /[\u4e00-\u9fff]/.test(ch) ? 1.5 : 0.3;
      return Math.max(1, Math.round(t));
    };
    const tokensIn = estimateTokens(inputSummary + (optionB?.reasoning ?? ''));
    const tokensOut = estimateTokens(outputSummary);
    let costMicroUsd = 0;
    try {
      const { estimateCostMicroUsd } = await import('@/lib/analytics/track');
      costMicroUsd = estimateCostMicroUsd('claude-opus-4-5', tokensIn, tokensOut);
    } catch {
      /* 成本估算非关键 */
    }

    const decision = await recordDecision({
      context: 'meeting_advice',
      inputSummary,
      outputSummary,
      retrievedMemoryIds: optionB?.citedMemory ?? [],
      modelUsed: 'claude-opus-4-5',
      providerUsed: 'anthropic',
      scenario: 'reasoning_complex',
      tokensIn,
      tokensOut,
      costMicroUsd,
      latencyMs: 0,
      refId: card.id,
      refType: 'decision_card',
      tenantId: card.tenantId,
    });
    if (!decision) return null;

    const fed = await setFeedback(decision.id, {
      outcome,
      feedbackBy: opts.decidedBy,
      reason,
    });
    return fed ?? decision;
  } catch (err) {
    logger.warn(
      { err: (err as Error).message, cardId: card.id },
      '[company-brain-decision] meeting outcome record failed',
    );
    return null;
  }
}

/**
 * 把超过 N 天没反馈的 pending 决策标记为 'ignored' (避免 metrics 永远算不出来)
 * 由 boot 慢扫定期触发.
 */
export async function markStaleDecisionsIgnored(staleDays = 7): Promise<{ ignored: number }> {
  const store = getStore();
  const all = await store.companyBrainDecisions.list();
  const cutoff = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000).toISOString();

  let ignored = 0;
  for (const d of all) {
    if (d.feedback.outcome === 'pending' && d.createdAt < cutoff) {
      await store.companyBrainDecisions.update(d.id, {
        ...d,
        feedback: {
          outcome: 'ignored',
          feedbackAt: new Date().toISOString(),
          reason: `自动标记: ${staleDays} 天无反馈`,
        },
      });
      ignored++;
    }
  }
  if (ignored > 0) {
    logger.info({ ignored, staleDays }, '[company-brain-decision] auto-marked stale as ignored');
  }
  return { ignored };
}
