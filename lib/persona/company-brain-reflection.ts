/**
 * §CA-13 · CompanyBrain Monthly Reflection 生成器
 *
 * 长回路 (月级) 自我观察:
 *   1. 拉取窗口期 (默认 30 天) 的 BrainMetricsReport
 *   2. 取当前 Version 配置
 *   3. 调 LLM 分析:
 *      - strengths: 哪些 context 采纳率高 / 表现稳健
 *      - failurePatterns: 推翻模式 + sampleDecisionIds + suggestedFix
 *      - proposedChanges: 配置 diff (style / prompt / threshold / topK) + rationale
 *   4. 落地为 CompanyBrainReflectionReport (approvalStatus='pending')
 *   5. 写 audit, 等 Owner / 治理委员会签批 → 创建新 Version
 *
 * 入口:
 *   - admin API: POST /api/admin/company-brain/reflection (本文件 generateReflection)
 *   - cron (V2): 每月 1 号自动跑
 *
 * 失败策略: 永不抛错; 不可生成时返回 null + warn.
 */

import type {
  CompanyBrainReflectionReport,
  CompanyBrainVersion,
  CompanyBrainDecisionContext,
  CompanyBrainVersionMetrics,
} from '@/lib/types/company-brain';
import { DEFAULT_BRAIN_VERSION_ID } from '@/lib/types/company-brain';
import { getStore } from '@/lib/storage/repository';
import { logger } from '@/lib/infra/logger';
import { audit } from '@/lib/audit/log';
import { computeMetrics, bucketToVersionMetrics } from './company-brain-metrics';

export interface GenerateReflectionInput {
  /** 反思窗口长度 (天), 默认 30 */
  windowDays?: number;
  /** 租户隔离 */
  tenantId?: string;
  /** 是否调 LLM 做深度分析; false 时仅启发式总结, 用于离线/无 API key 环境 */
  useLlm?: boolean;
  /** LLM 调用方 actor (写 audit), 默认 'system' */
  actorUserId?: string;
}

/**
 * 启发式失败模式分析: 把 metrics.topFailurePatterns 翻译成 ReflectionReport 的 failurePatterns 结构.
 * 不调 LLM, 永远可跑.
 */
function heuristicFailurePatterns(
  metrics: Awaited<ReturnType<typeof computeMetrics>>,
): CompanyBrainReflectionReport['failurePatterns'] {
  const out: CompanyBrainReflectionReport['failurePatterns'] = [];
  // 找占比最高的 context (用于 affectedContext 兜底归因)
  const contextEntries = Object.entries(metrics.byContext) as Array<[
    CompanyBrainDecisionContext,
    typeof metrics.overall,
  ]>;
  const dominantContext: CompanyBrainDecisionContext =
    contextEntries.sort((a, b) => b[1].overruled - a[1].overruled)[0]?.[0] ?? 'im_reply';

  for (const fp of metrics.topFailurePatterns.slice(0, 5)) {
    out.push({
      pattern: `频繁推翻关键词: "${fp.keyword}" (出现 ${fp.count} 次)`,
      sampleDecisionIds: fp.sampleDecisionIds,
      affectedContext: dominantContext,
      suggestedFix: `检视相关 Memory 是否缺失或过时, 或 system prompt 中是否过度泛化导致跑偏.`,
    });
  }
  return out;
}

function heuristicStrengths(
  metrics: Awaited<ReturnType<typeof computeMetrics>>,
): string[] {
  const out: string[] = [];
  for (const [ctx, b] of Object.entries(metrics.byContext)) {
    if (b.total >= 5 && b.adoptionRate >= 0.7) {
      out.push(`${ctx}: 决策 ${b.total} 次, 采纳率 ${(b.adoptionRate * 100).toFixed(0)}% (稳健)`);
    }
  }
  if (out.length === 0 && metrics.overall.total > 0) {
    out.push(`整体决策 ${metrics.overall.total} 次, 采纳率 ${(metrics.overall.adoptionRate * 100).toFixed(0)}%`);
  }
  return out;
}

function heuristicProposedChanges(
  metrics: Awaited<ReturnType<typeof computeMetrics>>,
  current: CompanyBrainVersion | null,
): CompanyBrainReflectionReport['proposedChanges'] {
  const overruleRate = metrics.overall.overruleRate;
  const reasons: string[] = [];
  const proposed: CompanyBrainReflectionReport['proposedChanges'] = {
    rationale: '',
  };

  // 推翻率高 → 收紧 baseline (降低 hardBlock 阈值, 让更多决策走议事/人工)
  if (overruleRate >= 0.3 && current) {
    const newHard = Math.max(0.3, current.baselineThresholds.hardBlock - 0.05);
    proposed.baselineThresholdsDiff = { hardBlock: newHard };
    reasons.push(
      `推翻率 ${(overruleRate * 100).toFixed(0)}% 偏高, 建议下调 hardBlock 阈值 ${current.baselineThresholds.hardBlock} → ${newHard.toFixed(2)}, 让更多边界场景转人工`,
    );
  }

  // 推翻率低 + 采纳率高 → 放宽召回, 多注入 Memory
  if (
    overruleRate <= 0.1 &&
    metrics.overall.adoptionRate >= 0.7 &&
    current &&
    current.topKMemoriesInjected < 20
  ) {
    proposed.topKMemoriesInjectedDiff = current.topKMemoriesInjected + 2;
    reasons.push(
      `表现稳健 (采纳 ${(metrics.overall.adoptionRate * 100).toFixed(0)}% / 推翻 ${(overruleRate * 100).toFixed(0)}%), 建议把召回 Memory 数 ${current.topKMemoriesInjected} → ${current.topKMemoriesInjected + 2}, 提升回答深度`,
    );
  }

  // 失败模式集中在某 context → 提示加针对性 system prompt
  if (metrics.topFailurePatterns.length >= 3) {
    const keywords = metrics.topFailurePatterns.slice(0, 3).map((p) => p.keyword).join('/');
    reasons.push(
      `Top 失败模式关键词集中: ${keywords}; 建议在 systemPromptTemplate 增补针对性约束`,
    );
  }

  if (reasons.length === 0) {
    reasons.push('当前指标稳健, 无显著调整建议. 继续观察.');
  }

  proposed.rationale = reasons.join('\n');
  return proposed;
}

async function getCurrentVersion(): Promise<CompanyBrainVersion | null> {
  try {
    const store = getStore();
    const versions = await store.companyBrainVersions.list();
    if (versions.length === 0) return null;
    return versions.sort((a, b) => b.version - a.version)[0];
  } catch (err) {
    logger.warn({ err: (err as Error).message }, '[reflection] getCurrentVersion failed');
    return null;
  }
}

/**
 * 生成 Reflection 报告. 永不抛错, 失败返回 null.
 *
 * V1.5 实现: 启发式 + (可选) LLM 增强
 *   - useLlm=false (默认): 纯启发式, 快速可重复
 *   - useLlm=true: 调 router 让 LLM 写更深入的 strengths/failurePatterns/rationale
 *
 * V2 拓展: 自动应用 proposedChanges (经签批后) + 触发新 Version 创建
 */
export async function generateReflection(
  input: GenerateReflectionInput = {},
): Promise<CompanyBrainReflectionReport | null> {
  const windowDays = input.windowDays ?? 30;
  const tenantId = input.tenantId ?? 'default';
  const actorUserId = input.actorUserId ?? 'system';

  try {
    const metrics = await computeMetrics({ tenantId, windowDays });

    if (metrics.overall.total === 0) {
      logger.info({ windowDays, tenantId }, '[reflection] no decisions in window, skip');
      return null;
    }

    const currentVersion = await getCurrentVersion();
    const versionId = currentVersion?.id ?? DEFAULT_BRAIN_VERSION_ID;

    // 启发式分析 (永远可跑, 作为 LLM 失败兜底)
    let strengths = heuristicStrengths(metrics);
    let failurePatterns = heuristicFailurePatterns(metrics);
    const proposedChanges = heuristicProposedChanges(metrics, currentVersion);

    // 可选: LLM 深度分析 (V1.5 实现; 失败 fail-open 走启发式)
    if (input.useLlm) {
      try {
        const llmAnalysis = await runLlmAnalysis(metrics);
        if (llmAnalysis) {
          strengths = llmAnalysis.strengths.length > 0 ? llmAnalysis.strengths : strengths;
          failurePatterns =
            llmAnalysis.failurePatterns.length > 0 ? llmAnalysis.failurePatterns : failurePatterns;
          // rationale 拼接: 启发式 + LLM
          proposedChanges.rationale = [proposedChanges.rationale, llmAnalysis.rationale]
            .filter(Boolean)
            .join('\n\n');
        }
      } catch (err) {
        logger.warn({ err: (err as Error).message }, '[reflection] LLM analysis failed, using heuristic');
      }
    }

    // 拼成 metricsSummary (压缩到 VersionMetrics 结构)
    const metricsSummary: CompanyBrainVersionMetrics = bucketToVersionMetrics(
      metrics.overall,
      metrics.recentOverrules.map((d) => d.id),
    );

    const now = new Date().toISOString();
    const report: CompanyBrainReflectionReport = {
      id: `cbref_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: now,
      tenantId,
      windowStart: metrics.windowStart,
      windowEnd: metrics.windowEnd,
      versionId,
      metricsSummary,
      strengths,
      failurePatterns,
      proposedChanges,
      approvalStatus: 'pending',
    };

    // 持久化
    try {
      const store = getStore();
      await store.companyBrainReflections.create(report);
    } catch (err) {
      logger.warn({ err: (err as Error).message }, '[reflection] persist failed');
    }

    // Audit (governance)
    try {
      await audit('company_brain.decision_recorded', actorUserId, {
        targetId: report.id,
        targetType: 'company_brain_reflection',
        tenantId,
        metadata: {
          event: 'reflection_generated',
          windowDays,
          decisionsCount: metricsSummary.decisionsCount,
          adoptionRate: metricsSummary.adoptionRate,
          overruleRate: metricsSummary.overruleRate,
          failurePatternCount: failurePatterns.length,
          proposedRationaleLen: proposedChanges.rationale.length,
        },
      });
    } catch {
      /* audit 失败不阻塞 */
    }

    logger.info(
      {
        reportId: report.id,
        windowDays,
        adoptionRate: metricsSummary.adoptionRate,
        overruleRate: metricsSummary.overruleRate,
        failurePatterns: failurePatterns.length,
      },
      '[reflection] generated',
    );

    return report;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, '[reflection] generation failed');
    return null;
  }
}

/**
 * V1.5 LLM 深度分析 (best-effort).
 * 只读 metrics, 不读决策原文 (隐私 + token 成本); 输出结构化 JSON.
 */
async function runLlmAnalysis(
  metrics: Awaited<ReturnType<typeof computeMetrics>>,
): Promise<{
  strengths: string[];
  failurePatterns: CompanyBrainReflectionReport['failurePatterns'];
  rationale: string;
} | null> {
  try {
    const { getRouter } = await import('@/lib/boot');
    const router = getRouter();

    const summary = {
      total: metrics.overall.total,
      adoptionRate: metrics.overall.adoptionRate,
      overruleRate: metrics.overall.overruleRate,
      avgLatencyMs: metrics.overall.avgLatencyMs,
      avgCostUsd: metrics.overall.avgCostUsd,
      byContext: Object.fromEntries(
        Object.entries(metrics.byContext)
          .filter(([, b]) => b.total > 0)
          .map(([k, b]) => [k, { total: b.total, adoption: b.adoptionRate, overrule: b.overruleRate }]),
      ),
      topFailurePatterns: metrics.topFailurePatterns.slice(0, 5),
    };

    const system =
      '你是 Tandem 中央 AI 的"反思官", 任务是审视上月中央 AI 的决策表现, 输出严格的 JSON. ' +
      '只能基于给定指标, 不能编造决策内容. 中文输出. JSON 必须包含字段: ' +
      'strengths (string[]), failurePatterns (Array<{pattern, sampleDecisionIds, affectedContext, suggestedFix}>), rationale (string).';

    const user = `本期决策度量数据 (JSON):\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\`\n\n请基于上述数据, 输出 JSON 反思报告.`;

    const reply = await router.chat({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      scenario: 'reasoning_complex',
      maxTokens: 1200,
    });

    const content =
      typeof reply.message.content === 'string'
        ? reply.message.content
        : JSON.stringify(reply.message.content);

    // 提取首段 JSON (允许 markdown code fence 包裹)
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const parsed = JSON.parse(m[0]) as {
      strengths?: unknown;
      failurePatterns?: unknown;
      rationale?: unknown;
    };

    const strengths = Array.isArray(parsed.strengths)
      ? parsed.strengths.filter((s): s is string => typeof s === 'string')
      : [];
    const failurePatterns = Array.isArray(parsed.failurePatterns)
      ? (parsed.failurePatterns as Array<Record<string, unknown>>)
          .filter((fp) => typeof fp.pattern === 'string')
          .map((fp) => ({
            pattern: String(fp.pattern),
            sampleDecisionIds: Array.isArray(fp.sampleDecisionIds)
              ? (fp.sampleDecisionIds as unknown[]).filter((s): s is string => typeof s === 'string')
              : [],
            affectedContext: (typeof fp.affectedContext === 'string'
              ? fp.affectedContext
              : 'im_reply') as CompanyBrainDecisionContext,
            suggestedFix: typeof fp.suggestedFix === 'string' ? fp.suggestedFix : '',
          }))
      : [];
    const rationale = typeof parsed.rationale === 'string' ? parsed.rationale : '';

    return { strengths, failurePatterns, rationale };
  } catch (err) {
    logger.warn({ err: (err as Error).message }, '[reflection] LLM call failed');
    return null;
  }
}

/**
 * 列出已有 Reflection 报告 (admin 看板用).
 * 默认按 createdAt desc, 最近 20 条.
 */
export async function listReflections(opts: {
  tenantId?: string;
  limit?: number;
} = {}): Promise<CompanyBrainReflectionReport[]> {
  try {
    const store = getStore();
    const all = await store.companyBrainReflections.list();
    return all
      .filter((r) => !opts.tenantId || r.tenantId === opts.tenantId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, opts.limit ?? 20);
  } catch (err) {
    logger.warn({ err: (err as Error).message }, '[reflection] list failed');
    return [];
  }
}

/** proposedChanges 是否含真实配置 diff (非仅 rationale 文本) */
function hasConfigDiffs(pc: CompanyBrainReflectionReport['proposedChanges']): boolean {
  return Boolean(
    pc.styleProfileDiff ||
      (typeof pc.systemPromptDiff === 'string' && pc.systemPromptDiff.trim().length > 0) ||
      pc.baselineThresholdsDiff ||
      typeof pc.topKMemoriesInjectedDiff === 'number',
  );
}

/**
 * 应用反思的 proposedChanges, 基于 current 创建新 CompanyBrainVersion (CA-13 闭环写侧)。
 * 纯构造, 不落库; 调用方负责持久化 + 失效缓存。
 */
function buildNextVersion(
  report: CompanyBrainReflectionReport,
  current: CompanyBrainVersion,
  approverId: string,
): CompanyBrainVersion {
  const pc = report.proposedChanges;
  const nextNum = current.version + 1;
  return {
    id: `cbv_v${nextNum}_${Date.now().toString(36)}`,
    version: nextNum,
    createdAt: new Date().toISOString(),
    tenantId: report.tenantId,
    styleProfileSnapshot: { ...current.styleProfileSnapshot, ...(pc.styleProfileDiff ?? {}) },
    systemPromptTemplate:
      typeof pc.systemPromptDiff === 'string' && pc.systemPromptDiff.trim().length > 0
        ? pc.systemPromptDiff
        : current.systemPromptTemplate,
    baselineThresholds: { ...current.baselineThresholds, ...(pc.baselineThresholdsDiff ?? {}) },
    topKMemoriesInjected:
      typeof pc.topKMemoriesInjectedDiff === 'number'
        ? pc.topKMemoriesInjectedDiff
        : current.topKMemoriesInjected,
    metrics: {
      decisionsCount: 0,
      adoptionRate: 0,
      overruleRate: 0,
      avgCostMicroUsd: 0,
      avgLatencyMs: 0,
      sampleDecisionIds: [],
    },
    previousVersionId: current.id,
    createdReason: 'auto_reflection',
    reflectionReportId: report.id,
    approvedBy: approverId,
  };
}

/**
 * 签批 Reflection (Owner / 治理委员会) — CA-13 闭环写侧。
 * approve=true 且含配置 diff: 应用 diff → 创建新 CompanyBrainVersion → 失效缓存 (即时生效),
 *   并把 report.resultingVersionId 指向新版本。无 diff (仅 rationale) 则只标 approved, 不造版本。
 * approve=false: 标记 rejected。
 */
export async function approveReflection(
  reportId: string,
  approve: boolean,
  approverId: string,
  reason?: string,
): Promise<CompanyBrainReflectionReport | null> {
  try {
    const store = getStore();
    const existing = await store.companyBrainReflections.get(reportId);
    if (!existing) return null;

    let resultingVersionId: string | undefined = existing.resultingVersionId;

    // 写侧: 仅在签批通过 + 含真实配置 diff 时应用并迭代版本
    if (approve && hasConfigDiffs(existing.proposedChanges)) {
      try {
        const { invalidateBrainVersionCache, buildDefaultBrainVersion } = await import(
          './company-brain-version'
        );
        const current = (await getCurrentVersion()) ?? buildDefaultBrainVersion(existing.tenantId);
        const next = buildNextVersion(existing, current, approverId);
        await store.companyBrainVersions.create(next);
        invalidateBrainVersionCache();
        resultingVersionId = next.id;
        logger.info(
          { reportId, fromVersion: current.version, toVersion: next.version, newVersionId: next.id },
          '[reflection] approved → applied proposedChanges, new CompanyBrainVersion created',
        );
      } catch (err) {
        logger.warn(
          { err: (err as Error).message, reportId },
          '[reflection] version apply failed (report still marked approved)',
        );
      }
    }

    const updated: CompanyBrainReflectionReport = {
      ...existing,
      approvalStatus: approve ? 'approved' : 'rejected',
      approvalBy: approverId,
      approvalAt: new Date().toISOString(),
      resultingVersionId,
    };
    await store.companyBrainReflections.update(reportId, updated);

    try {
      await audit('company_brain.feedback_submitted', approverId, {
        targetId: reportId,
        targetType: 'company_brain_reflection',
        tenantId: existing.tenantId,
        metadata: {
          event: 'reflection_approval',
          approvalStatus: updated.approvalStatus,
          resultingVersionId: resultingVersionId ?? null,
          reason,
        },
      });
    } catch {
      /* audit 失败不阻塞 */
    }

    return updated;
  } catch (err) {
    logger.warn({ err: (err as Error).message, reportId }, '[reflection] approve failed');
    return null;
  }
}
