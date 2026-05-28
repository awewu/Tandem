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
