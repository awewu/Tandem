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
  OkrOptimizationProposal,
} from '@/lib/types/company-brain';
import { DEFAULT_BRAIN_VERSION_ID } from '@/lib/types/company-brain';
import { computeKRProgress, effectiveObjectiveProgress } from '@/lib/types/okr-tti';
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

/**
 * ON-3 · OKR 健康分析 (参谋视角): 扫 active 周期内公司/团队层 KR,
 * 识别偏离 on-track 的承压 KR, 产出**优化方向提议** (advisory)。
 *
 * 宪法裁定 A 边界: 纯读 OKR 真值 → 产出供治理审视的建议, **不**创建 ProxyAction,
 * **不**自动改任何 OKR; status 一律 'pending', 须人工治理处置。永不抛错。
 *
 * @param maxKrProposals 承压 KR 提议上限 (默认 5), 按进度从低到高取最承压的。
 * @param maxObjectiveProposals 停滞目标提议上限 (默认 3), 按进度从低到高。
 * @param windowDays check-in 趋势窗口 (默认 30 天), 用于长期承压预警。
 * @param maxTrendProposals 停滞趋势提议上限 (默认 3)。
 * @param enrichWithLlm true 时调 LLM 读 check-in blockers/nextSteps 做深析归因 (fail-soft 回退模板)。
 */
export async function analyzeOkrHealth(
  maxKrProposals = 5,
  maxObjectiveProposals = 3,
  windowDays = 30,
  maxTrendProposals = 3,
  enrichWithLlm = false,
): Promise<OkrOptimizationProposal[]> {
  try {
    const store = getStore();
    const cycles = await store.cycles.list();
    const activeCycles = cycles.filter((c) => c.isActive);
    if (activeCycles.length === 0) return [];
    const cycle = activeCycles.sort((a, b) =>
      (b.startDate ?? '').localeCompare(a.startDate ?? ''),
    )[0];

    const objectives = await store.objectives.list();
    const orgObjectives = objectives.filter(
      (o) =>
        o.cycleId === cycle.id &&
        o.status === 'active' &&
        (o.level === 'company' || o.level === 'team'),
    );
    if (orgObjectives.length === 0) return [];
    const orgObjectiveIds = new Set(orgObjectives.map((o) => o.id));

    const ts = Date.now().toString(36);
    const proposals: OkrOptimizationProposal[] = [];

    // ① 承压 KR (KR 自身信心度偏离 on-track)
    const krs = await store.keyResults.list();
    const atRisk = krs
      .filter(
        (kr) =>
          kr.status === 'active' &&
          orgObjectiveIds.has(kr.objectiveId) &&
          kr.confidence !== 'on-track',
      )
      .map((kr) => ({ kr, pct: computeKRProgress(kr) }))
      .sort((a, b) => a.pct - b.pct)
      .slice(0, maxKrProposals);

    for (const { kr, pct } of atRisk) {
      const progressPct = Math.round(pct * 100);
      proposals.push({
        id: `okropt_${kr.id}_${ts}`,
        kind: 'kr_at_risk',
        title: `承压 KR: ${kr.title}`,
        targetType: 'key_result',
        targetId: kr.id,
        metrics: { progressPct, confidence: kr.confidence },
        recommendation:
          '建议治理审视: 资源再分配 / 拆解或下调目标值 / 加派协作者 / 必要时进议事室. (参谋建议, 须人工决定)',
        rationale: `该 KR 进度 ${progressPct}% 且信心度=${kr.confidence}, 偏离 on-track. 中央 AI 作为参谋提示组织关注, 不自动调整 OKR.`,
        status: 'pending',
      });
    }

    // ② 停滞目标 (Objective 自身信心度偏离 on-track) — 目标层 rollup 视角
    const stalled = orgObjectives
      .filter((o) => o.confidence !== 'on-track')
      .map((o) => ({ o, pct: effectiveObjectiveProgress(o) }))
      .sort((a, b) => a.pct - b.pct)
      .slice(0, maxObjectiveProposals);

    for (const { o, pct } of stalled) {
      const progressPct = Math.round(pct * 100);
      proposals.push({
        id: `okropt_${o.id}_${ts}`,
        kind: 'objective_stalled',
        title: `停滞目标: ${o.title}`,
        targetType: 'objective',
        targetId: o.id,
        metrics: { progressPct, confidence: o.confidence },
        recommendation:
          '建议治理复盘: 目标是否仍优先 / 是否需重排 KR 或追加资源 / 是否进议事室重新对齐. (参谋建议, 须人工决定)',
        rationale: `该目标整体进度 ${progressPct}% 且信心度=${o.confidence}, 偏离 on-track. 中央 AI 作为参谋提示组织关注, 不自动调整 OKR.`,
        status: 'pending',
      });
    }

    // ③ 长期承压 KR (信心度仍 on-track, 但近窗口内多次 check-in 进度停滞/倒退)
    //    —— 信心度是主观自评, 趋势是客观真值; 二者背离时中央 AI 作为参谋预警。
    //    与 ① 不重叠 (① 仅取非 on-track; 这里仅取 on-track)。
    const STALL_NET_GAIN = 0.02; // 窗口内净进度增幅 ≤ 2pt 视为停滞
    const MIN_CHECKINS = 2; // 至少 2 次 check-in 才构成"趋势"
    const windowStartMs = Date.now() - windowDays * 24 * 60 * 60 * 1000;
    const checkIns = await store.checkIns.list();
    const onTrackKrs = krs.filter(
      (kr) =>
        kr.status === 'active' &&
        orgObjectiveIds.has(kr.objectiveId) &&
        kr.confidence === 'on-track',
    );
    const trendCandidates: Array<{ kr: (typeof krs)[number]; netGain: number; n: number }> = [];
    for (const kr of onTrackKrs) {
      const krCheckIns = checkIns
        .filter(
          (c) =>
            c.scope === 'kr' &&
            c.scopeId === kr.id &&
            new Date(c.createdAt).getTime() >= windowStartMs,
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      if (krCheckIns.length < MIN_CHECKINS) continue;
      const first = krCheckIns[0];
      const last = krCheckIns[krCheckIns.length - 1];
      const netGain = last.progressAfter - first.progressBefore;
      if (netGain > STALL_NET_GAIN) continue;
      trendCandidates.push({ kr, netGain, n: krCheckIns.length });
    }
    const stalledTrend = trendCandidates
      .sort((a, b) => a.netGain - b.netGain)
      .slice(0, maxTrendProposals);

    for (const { kr, netGain, n } of stalledTrend) {
      const progressPct = Math.round(computeKRProgress(kr) * 100);
      const netGainPct = Math.round(netGain * 100);
      proposals.push({
        id: `okropt_trend_${kr.id}_${ts}`,
        kind: 'kr_stalled_trend',
        title: `长期承压 KR: ${kr.title}`,
        targetType: 'key_result',
        targetId: kr.id,
        metrics: { progressPct, confidence: kr.confidence },
        recommendation:
          '建议治理核实: 信心度自评是否乐观 / 是否存在隐性阻塞 / 是否需复核 KR 设计. (参谋建议, 须人工决定)',
        rationale: `近 ${windowDays} 天 ${n} 次 check-in 净进度仅 ${netGainPct}pt (停滞/倒退), 但信心度自评仍 on-track. 中央 AI 作为参谋提示主观自评与客观趋势背离, 不自动调整 OKR.`,
        status: 'pending',
      });
    }

    // ④ (可选) LLM 深析归因: 读 check-in 的 blockers/nextSteps 文本, 把模板 rationale 升级为针对性诊断。
    //    best-effort, 失败保留模板 rationale (永不影响主流程)。
    if (enrichWithLlm && proposals.length > 0) {
      await enrichProposalRationales(proposals, checkIns, windowStartMs);
    }

    return proposals;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, '[reflection] OKR health analysis failed');
    return [];
  }
}

/**
 * skill_promotion (参谋视角): 读决策度量, 找长期高采纳/低推翻的决策场景,
 * 建议治理将其"沉淀为可复用技能/企业 Memory"(须经三级签批; 中央 AI 不自动建 Memory)。
 *
 * 宪法裁定 A 边界: 纯参谋, status='pending', 绝不自动写 Memory / 不创建 ProxyAction。
 */
export function analyzeSkillPromotion(
  metrics: Awaited<ReturnType<typeof computeMetrics>>,
  maxProposals = 3,
): OkrOptimizationProposal[] {
  const MIN_SAMPLE = 5; // 样本太小不构成"长期"信号
  const MIN_ADOPTION = 0.8; // 采纳率门槛
  const MAX_OVERRULE = 0.1; // 推翻率上限
  const ts = Date.now().toString(36);

  const candidates = (
    Object.entries(metrics.byContext) as Array<[CompanyBrainDecisionContext, typeof metrics.overall]>
  )
    .filter(
      ([, b]) =>
        b.total >= MIN_SAMPLE && b.adoptionRate >= MIN_ADOPTION && b.overruleRate <= MAX_OVERRULE,
    )
    .sort((a, b) => b[1].adoptionRate - a[1].adoptionRate || b[1].total - a[1].total)
    .slice(0, maxProposals);

  return candidates.map(([ctx, b]) => {
    const adoptionPct = Math.round(b.adoptionRate * 100);
    const overrulePct = Math.round(b.overruleRate * 100);
    return {
      id: `okropt_skill_${ctx}_${ts}`,
      kind: 'skill_promotion',
      title: `可沉淀能力: ${ctx} 场景`,
      targetType: 'capability',
      targetId: ctx,
      metrics: { progressPct: adoptionPct, confidence: '稳健' },
      recommendation:
        '建议治理将该高采纳场景沉淀为可复用技能/企业 Memory (经三级签批生效); 中央 AI 不自动建 Memory. (参谋建议, 须人工决定)',
      rationale: `近窗口 ${b.total} 次 ${ctx} 决策, 采纳率 ${adoptionPct}% / 推翻率 ${overrulePct}%, 长期稳健. 中央 AI 作为参谋建议沉淀该能力, 不自动写入.`,
      status: 'pending',
    };
  });
}

/**
 * LLM 深析归因 (best-effort): 给 OKR 优化提议补针对性诊断 rationale。
 * 读对应对象近窗口 check-in 的 blockers/nextSteps 文本; 失败保留模板 rationale。
 * 单次 LLM 调用批量处理, 控成本; 解析失败 fail-soft。
 */
async function enrichProposalRationales(
  proposals: OkrOptimizationProposal[],
  checkIns: Awaited<ReturnType<ReturnType<typeof getStore>['checkIns']['list']>>,
  windowStartMs: number,
): Promise<void> {
  try {
    const recent = checkIns.filter((c) => new Date(c.createdAt).getTime() >= windowStartMs);
    const payload = proposals.map((p) => {
      const texts = recent
        .filter((c) => c.scopeId === p.targetId)
        .flatMap((c) => [c.blockers, c.nextSteps])
        .filter((t): t is string => !!t && t.trim().length > 0)
        .slice(0, 6);
      return {
        targetId: p.targetId,
        kind: p.kind,
        title: p.title,
        progressPct: p.metrics.progressPct,
        confidence: p.metrics.confidence,
        signals: texts,
      };
    });
    // 无任何 check-in 文本信号 → 不值得调 LLM (模板已足够)
    if (payload.every((p) => p.signals.length === 0)) return;

    const { getRouter } = await import('@/lib/boot');
    const router = getRouter();
    const system =
      '你是企业 OKR 治理参谋。基于每个提议的进度与 check-in 信号(阻塞/下一步), 为每条提议写一句更具针对性的中文归因诊断(≤80字), ' +
      '只指出"值得关注什么", 严禁给出会自动改 OKR 的指令。仅输出 JSON: {"diagnoses":[{"targetId":"...","rationale":"..."}]}。';
    const user = `提议与信号 (JSON):\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``;

    const reply = await router.chat({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      scenario: 'reasoning_complex',
      maxTokens: 800,
    });
    const content =
      typeof reply.message.content === 'string'
        ? reply.message.content
        : JSON.stringify(reply.message.content);
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) return;
    const parsed = JSON.parse(m[0]) as { diagnoses?: Array<{ targetId?: unknown; rationale?: unknown }> };
    if (!Array.isArray(parsed.diagnoses)) return;

    const byId = new Map<string, string>();
    for (const d of parsed.diagnoses) {
      if (typeof d.targetId === 'string' && typeof d.rationale === 'string' && d.rationale.trim()) {
        byId.set(d.targetId, d.rationale.trim());
      }
    }
    for (const p of proposals) {
      const refined = byId.get(p.targetId);
      if (refined) p.rationale = `${refined} (LLM 深析 · 参谋, 不自动改 OKR)`;
    }
  } catch (err) {
    logger.warn({ err: (err as Error).message }, '[reflection] LLM proposal enrichment failed');
  }
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

    // ON-3 · OKR 健康优化方向提议 (参谋产物, 与上面"中央 AI 自身配置"调整正交)
    //   useLlm=true 时对 OKR 提议做 LLM 深析归因; skill_promotion 读决策度量产出能力沉淀提议。
    const okrProposals = await analyzeOkrHealth(5, 3, windowDays, 3, !!input.useLlm);
    const skillProposals = analyzeSkillPromotion(metrics, 3);
    const optimizationProposals = [...okrProposals, ...skillProposals];

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
      optimizationProposals,
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
          optimizationProposalCount: optimizationProposals.length,
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

/**
 * ON-3 · 治理处置一条 OKR 优化提议 (acknowledged=已采纳关注 / dismissed=不予处理)。
 *
 * 宪法裁定 A 边界: 这**只改提议自身的 status** (advisory 生命周期), **绝不**触碰任何 OKR/本体写;
 * 组织真要据此调资源, 须人在 OKR 模块另行操作。永不抛错; 报告或提议不存在返回 null。
 */
export async function setOptimizationProposalStatus(
  reportId: string,
  proposalId: string,
  status: 'acknowledged' | 'dismissed',
  actorId: string,
): Promise<CompanyBrainReflectionReport | null> {
  try {
    const store = getStore();
    const existing = await store.companyBrainReflections.get(reportId);
    if (!existing) return null;
    const proposals = existing.optimizationProposals ?? [];
    const target = proposals.find((p) => p.id === proposalId);
    if (!target) return null;

    // 闭环 (skill_promotion 专用): 治理 acknowledged = 人工决定, 据此发起 Memory 升级签批请求
    // (进入三级签批 → 全签 + 公示期过 → materializePromotion 真写企业 Memory)。
    // 裁定 A: 中央 AI 不自动写 Memory; 这里由"人工 acknowledged"触发, 且仍须三级签批方生效。
    // 幂等: 已有 promotionRequestId 不重复发起。
    let promotionRequestId = target.promotionRequestId;
    if (status === 'acknowledged' && target.kind === 'skill_promotion' && !promotionRequestId) {
      try {
        const { proposePromotion } = await import('@/lib/memory/promotion-flow');
        const req = await proposePromotion({
          materialId: `skill_promotion:${target.id}`,
          proposedType: 'sop',
          proposedTitle: target.title,
          proposedBody: `${target.recommendation}\n\n依据: ${target.rationale}`,
          proposerId: actorId,
          level: 'company', // 企业级能力沉淀 → Lv3 三级签批 (ceo+clevel+steward)
        });
        promotionRequestId = req.id;
        logger.info(
          { reportId, proposalId, promotionRequestId, capability: target.targetId },
          '[reflection] skill_promotion acknowledged → memory promotion request created (三级签批)',
        );
      } catch (err) {
        // fail-soft: 发起失败不阻塞 advisory 处置 (proposal 仍标 acknowledged)
        logger.warn(
          { err: (err as Error).message, reportId, proposalId },
          '[reflection] skill_promotion → promotion request failed (proposal still acknowledged)',
        );
      }
    }

    const updated: CompanyBrainReflectionReport = {
      ...existing,
      optimizationProposals: proposals.map((p) =>
        p.id === proposalId ? { ...p, status, promotionRequestId } : p,
      ),
    };
    await store.companyBrainReflections.update(reportId, updated);

    try {
      await audit('company_brain.feedback_submitted', actorId, {
        targetId: proposalId,
        targetType: 'okr_optimization_proposal',
        tenantId: existing.tenantId,
        metadata: {
          event: 'optimization_proposal_disposition',
          reportId,
          status,
          kind: target.kind,
          targetType: target.targetType,
          targetId: target.targetId,
          promotionRequestId: promotionRequestId ?? null,
        },
      });
    } catch {
      /* audit 失败不阻塞 */
    }

    logger.info(
      { reportId, proposalId, status, targetId: target.targetId },
      '[reflection] optimization proposal disposed (advisory, no OKR write)',
    );
    return updated;
  } catch (err) {
    logger.warn(
      { err: (err as Error).message, reportId, proposalId },
      '[reflection] proposal disposition failed',
    );
    return null;
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
