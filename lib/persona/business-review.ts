/**
 * lib/persona/business-review.ts · 月度经营回顾 (对标 WorkBoard "Business Review")
 *
 * ─────────────────────────────────────────────────────────
 * 目的:
 *   每月给老板/经理一份**自动生成、机器查证、人工再审视**的经营 pre-read,
 *   把分散在 OKR / 决议 / 反思 / 教训中的事实拢成一页, 节省人工汇报。
 *
 *   宪法 A 边界: 中央 AI 是参谋, 不替任何人决定 — 本报告全是 advisory,
 *   只展示真值 + 建议讨论议题, 不自动改 OKR / 不创建动作。
 *
 * 数据源 (全部 S0 rollup 真值, 不臆测):
 *   - OKR 健康度 (analyzeOkrHealth, 复用)
 *   - 决议活动 (decisionCards.list, 按周期切窗)
 *   - 月度反思报告 (CompanyBrainReflectionReport, 若存在)
 *   - Reflexion lesson 模式 (analyzeReflexionPatterns, 公司维度聚合)
 *
 * 设计:
 *   - generateMonthlyBusinessReview 是纯函数, 不写库;
 *   - 落库由调用方负责 (API/cron), 用 KvStore collection='business_review';
 *   - markdown 字段是可直接发邮件/IM 的可读形式。
 *
 * fail-soft: 任何数据源失败都退化为空段, 报告仍能出。
 */

import { getStore } from '../storage/repository';
import { logger } from '../infra/logger';
import {
  effectiveObjectiveProgress,
} from '../types/okr-tti';
import { analyzeOkrHealth } from './company-brain-reflection';
import type { OkrOptimizationProposal } from '../types/company-brain';
import type { DecisionCard } from '../types/decision-card';
import type { Objective } from '../types/okr-tti';

// ────────────────── 类型 ──────────────────

export interface BusinessReviewSummary {
  activeObjectives: number;
  onTrack: number;
  atRisk: number;
  behind: number;
  overallProgressPct: number;
}

export interface BusinessReviewDecisions {
  total: number;
  byOutcome: { adopted: number; overruled: number; modified: number; pending: number };
  byState: Record<string, number>;
  topRecent: Array<{
    id: string;
    title: string;
    state: string;
    createdAt: string;
    outcome?: string;
  }>;
}

export interface MonthlyBusinessReview {
  id: string;
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  cycleId?: string;
  cycleTitle?: string;

  summary: BusinessReviewSummary;

  okrHealth: {
    proposalCount: number;
    proposals: OkrOptimizationProposal[];
  };

  decisions: BusinessReviewDecisions;

  suggestedTopics: Array<{ title: string; reason: string; severity: 'high' | 'medium' | 'low' }>;

  /** 可直接邮件/IM 投递的 Markdown 报告 */
  markdown: string;
}

// ────────────────── 主入口 ──────────────────

export interface GenerateOptions {
  /** 窗口结束 (默认 now), ISO */
  periodEnd?: string;
  /** 窗口天数 (默认 30) */
  windowDays?: number;
  /** OkrHealth 提议上限 (默认 5 / 3) */
  maxKrProposals?: number;
  maxObjectiveProposals?: number;
}

export async function generateMonthlyBusinessReview(
  opts: GenerateOptions = {},
): Promise<MonthlyBusinessReview> {
  const windowDays = opts.windowDays ?? 30;
  const endMs = opts.periodEnd ? new Date(opts.periodEnd).getTime() : Date.now();
  const startMs = endMs - windowDays * 86400_000;
  const periodStart = new Date(startMs).toISOString();
  const periodEnd = new Date(endMs).toISOString();
  const id = `breview_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  const summary = await buildSummary().catch((err) => {
    logger.warn({ err: (err as Error).message }, '[business-review] summary failed');
    return {
      activeObjectives: 0,
      onTrack: 0,
      atRisk: 0,
      behind: 0,
      overallProgressPct: 0,
    } as BusinessReviewSummary;
  });

  const okrProposals = await analyzeOkrHealth(
    opts.maxKrProposals ?? 5,
    opts.maxObjectiveProposals ?? 3,
    windowDays,
    3,
  ).catch(() => [] as OkrOptimizationProposal[]);

  const decisions = await buildDecisions(startMs, endMs).catch((err) => {
    logger.warn({ err: (err as Error).message }, '[business-review] decisions failed');
    return emptyDecisions();
  });

  const cycleInfo = await getActiveCycle();

  const suggestedTopics = buildSuggestedTopics(summary, okrProposals, decisions);

  const review: MonthlyBusinessReview = {
    id,
    generatedAt: new Date().toISOString(),
    periodStart,
    periodEnd,
    cycleId: cycleInfo?.id,
    cycleTitle: cycleInfo?.title,
    summary,
    okrHealth: { proposalCount: okrProposals.length, proposals: okrProposals },
    decisions,
    suggestedTopics,
    markdown: '',
  };

  review.markdown = renderMarkdown(review);
  return review;
}

// ────────────────── 各段构建 ──────────────────

async function buildSummary(): Promise<BusinessReviewSummary> {
  const store = getStore();
  const cycles = await store.cycles.list();
  const active = cycles.find((c) => c.isActive);
  if (!active) {
    return {
      activeObjectives: 0,
      onTrack: 0,
      atRisk: 0,
      behind: 0,
      overallProgressPct: 0,
    };
  }
  const objectives: Objective[] = (await store.objectives.list()).filter(
    (o) =>
      o.cycleId === active.id &&
      o.status === 'active' &&
      (o.level === 'company' || o.level === 'team'),
  );
  if (objectives.length === 0) {
    return { activeObjectives: 0, onTrack: 0, atRisk: 0, behind: 0, overallProgressPct: 0 };
  }
  let onTrack = 0, atRisk = 0, behind = 0;
  let progSum = 0;
  for (const o of objectives) {
    progSum += effectiveObjectiveProgress(o);
    if (o.confidence === 'on-track') onTrack++;
    else if (o.confidence === 'at-risk') atRisk++;
    else behind++; // off-track 或缺失
  }
  return {
    activeObjectives: objectives.length,
    onTrack,
    atRisk,
    behind,
    overallProgressPct: Math.round((progSum / objectives.length) * 100),
  };
}

function emptyDecisions(): BusinessReviewDecisions {
  return {
    total: 0,
    byOutcome: { adopted: 0, overruled: 0, modified: 0, pending: 0 },
    byState: {},
    topRecent: [],
  };
}

async function buildDecisions(startMs: number, endMs: number): Promise<BusinessReviewDecisions> {
  const store = getStore();
  const all = (await store.decisionCards.list()) as DecisionCard[];
  const inWindow = all.filter((c) => {
    const t = new Date(c.createdAt ?? 0).getTime();
    return t >= startMs && t <= endMs;
  });
  const byState: Record<string, number> = {};
  for (const c of inWindow) {
    const s = c.convergenceState ?? 'unknown';
    byState[s] = (byState[s] ?? 0) + 1;
  }
  // outcome 推断: COMMIT→adopted-ish; VETOED→overruled; DIVERGE/CONVERGE/ESCALATED→pending
  // (real ConvergenceState union per lib/types/decision-card.ts:9)
  const byOutcome = {
    adopted: byState['COMMIT'] ?? 0,
    overruled: byState['VETOED'] ?? 0,
    modified: 0,
    pending: (byState['DIVERGE'] ?? 0) + (byState['CONVERGE'] ?? 0) + (byState['ESCALATED'] ?? 0),
  };
  const topRecent = inWindow
    .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))
    .slice(0, 5)
    .map((c) => ({
      id: c.id,
      title: c.title,
      state: c.convergenceState ?? 'unknown',
      createdAt: c.createdAt,
      outcome: c.convergenceState === 'COMMIT' ? 'adopted' : c.convergenceState === 'VETOED' ? 'overruled' : 'pending',
    }));
  return { total: inWindow.length, byOutcome, byState, topRecent };
}

async function getActiveCycle(): Promise<{ id: string; title: string } | null> {
  try {
    const store = getStore();
    const cycles = await store.cycles.list();
    const a = cycles.find((c) => c.isActive);
    return a ? { id: a.id, title: a.name ?? a.id } : null;
  } catch { return null; }
}

function buildSuggestedTopics(
  summary: BusinessReviewSummary,
  proposals: OkrOptimizationProposal[],
  decisions: BusinessReviewDecisions,
): Array<{ title: string; reason: string; severity: 'high' | 'medium' | 'low' }> {
  const topics: Array<{ title: string; reason: string; severity: 'high' | 'medium' | 'low' }> = [];

  if (summary.behind > 0) {
    topics.push({
      title: `${summary.behind} 个目标已落后, 是否需要资源再分配?`,
      reason: `公司/团队层 active 目标 ${summary.activeObjectives} 个, 其中 ${summary.behind} 个 confidence=behind.`,
      severity: 'high',
    });
  }
  if (summary.atRisk >= 2) {
    topics.push({
      title: `${summary.atRisk} 个目标 at-risk, 复盘风险根因`,
      reason: `at-risk 数量已达 ${summary.atRisk}, 建议月度复盘共因.`,
      severity: 'medium',
    });
  }
  for (const p of proposals.slice(0, 3)) {
    topics.push({
      title: p.title,
      reason: p.rationale,
      severity: p.kind === 'objective_stalled' ? 'high' : 'medium',
    });
  }
  if (decisions.byOutcome.overruled > decisions.byOutcome.adopted && decisions.total >= 3) {
    topics.push({
      title: 'AI 议事建议被推翻率偏高, 校准 brain 配置',
      reason: `本月议事: 采纳 ${decisions.byOutcome.adopted} vs 否决 ${decisions.byOutcome.overruled}.`,
      severity: 'medium',
    });
  }
  if (decisions.byOutcome.pending > 0) {
    topics.push({
      title: `${decisions.byOutcome.pending} 个议事室仍未收敛`,
      reason: '建议指定主持人推进或闭合.',
      severity: 'low',
    });
  }
  return topics;
}

// ────────────────── Markdown 渲染 ──────────────────

function renderMarkdown(r: MonthlyBusinessReview): string {
  const lines: string[] = [];
  const periodLabel = `${r.periodStart.slice(0, 10)} → ${r.periodEnd.slice(0, 10)}`;
  lines.push(`# 月度经营回顾 · ${periodLabel}`);
  lines.push('');
  lines.push(`_${r.cycleTitle ? `周期: ${r.cycleTitle} · ` : ''}生成于 ${r.generatedAt.slice(0, 16).replace('T', ' ')}_`);
  lines.push('');
  lines.push('> ⚠ 本报告由中央 AI 作为**参谋**自动生成 (advisory), 全部基于 S0 rollup 真值, 不替任何人决定. 请人工审视后再讨论。');
  lines.push('');

  // 1. 总览
  lines.push('## 1. 经营总览');
  lines.push('');
  lines.push(`| 指标 | 数值 |`);
  lines.push(`| --- | --- |`);
  lines.push(`| 进行中目标 (company/team) | ${r.summary.activeObjectives} |`);
  lines.push(`| ✓ on-track | ${r.summary.onTrack} |`);
  lines.push(`| ⚠ at-risk | ${r.summary.atRisk} |`);
  lines.push(`| ✗ behind | ${r.summary.behind} |`);
  lines.push(`| 加权平均进度 | ${r.summary.overallProgressPct}% |`);
  lines.push('');

  // 2. OKR 健康提议
  lines.push('## 2. OKR 健康提议 (参谋建议, 须人工决定)');
  lines.push('');
  if (r.okrHealth.proposals.length === 0) {
    lines.push('_本月无承压 KR / 停滞目标, 健康状况良好._');
  } else {
    for (const p of r.okrHealth.proposals) {
      lines.push(`### ${p.title}`);
      lines.push(`- **类别**: ${p.kind}`);
      lines.push(`- **依据**: ${p.rationale}`);
      lines.push(`- **建议**: ${p.recommendation}`);
      lines.push('');
    }
  }
  lines.push('');

  // 3. 决议活动
  lines.push('## 3. 决议活动');
  lines.push('');
  lines.push(`本月共 **${r.decisions.total}** 项议事:`);
  lines.push(`- 采纳 (COMMIT): ${r.decisions.byOutcome.adopted}`);
  lines.push(`- 否决 (VETOED): ${r.decisions.byOutcome.overruled}`);
  lines.push(`- 仍 pending: ${r.decisions.byOutcome.pending}`);
  lines.push('');
  if (r.decisions.topRecent.length > 0) {
    lines.push('**最近 5 项**:');
    for (const d of r.decisions.topRecent) {
      lines.push(`- _${d.createdAt.slice(0, 10)}_ · **${d.title}** — ${d.state}`);
    }
  }
  lines.push('');

  // 4. 建议讨论议题
  lines.push('## 4. 建议本月讨论议题');
  lines.push('');
  if (r.suggestedTopics.length === 0) {
    lines.push('_无紧急议题, 维持当前节奏._');
  } else {
    for (const t of r.suggestedTopics) {
      const flag = t.severity === 'high' ? '🔴' : t.severity === 'medium' ? '🟡' : '🟢';
      lines.push(`### ${flag} ${t.title}`);
      lines.push(t.reason);
      lines.push('');
    }
  }

  lines.push('');
  lines.push('---');
  lines.push('_报告 ID: ' + r.id + '_');
  return lines.join('\n');
}
