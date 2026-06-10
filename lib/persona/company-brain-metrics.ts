/**
 * CompanyBrain Metrics · 智能迭代度量层 (CA-13)
 *
 * 把 CompanyBrainDecision 集合聚合成"中央 AI 的智能指标":
 *   - 采纳率 / 推翻率 / 修改率 / 忽略率
 *   - 平均成本 / 平均延迟
 *   - 按 context 分桶
 *   - 按 brainVersion 分桶 (用于版本对比)
 *   - 每日趋势
 *   - Top 失败模式 (按 reason 关键词聚类)
 *
 * 看板 GET /api/admin/company-brain/metrics 调本模块.
 */

import type {
  CompanyBrainDecision,
  CompanyBrainDecisionContext,
  CompanyBrainFeedbackOutcome,
  CompanyBrainVersionMetrics,
} from '@/lib/types/company-brain';
import { listDecisions } from './company-brain-decision';

export interface BrainMetricsBucket {
  total: number;
  adopted: number;
  modified: number;
  overruled: number;
  ignored: number;
  pending: number;
  /** (adopted + modified) / (total - pending) */
  adoptionRate: number;
  /** overruled / (total - pending) */
  overruleRate: number;
  avgCostMicroUsd: number;
  avgLatencyMs: number;
  avgCostUsd: number;
}

export interface BrainMetricsReport {
  windowStart: string;
  windowEnd: string;
  overall: BrainMetricsBucket;
  byContext: Record<CompanyBrainDecisionContext, BrainMetricsBucket>;
  byBrainVersion: Record<string, BrainMetricsBucket>;
  /** 每日趋势 (最近 30 天) */
  dailyTrend: Array<{
    date: string; // YYYY-MM-DD
    total: number;
    adoptionRate: number;
    overruleRate: number;
  }>;
  /** Top 失败模式 (推翻 reason 中出现频率高的关键词) */
  topFailurePatterns: Array<{ keyword: string; count: number; sampleDecisionIds: string[] }>;
  /** 整体决策样本 (前 10 个最近推翻的, 用于 reflection 输入) */
  recentOverrules: CompanyBrainDecision[];
}

function emptyBucket(): BrainMetricsBucket {
  return {
    total: 0,
    adopted: 0,
    modified: 0,
    overruled: 0,
    ignored: 0,
    pending: 0,
    adoptionRate: 0,
    overruleRate: 0,
    avgCostMicroUsd: 0,
    avgLatencyMs: 0,
    avgCostUsd: 0,
  };
}

function aggregate(decisions: CompanyBrainDecision[]): BrainMetricsBucket {
  const b = emptyBucket();
  if (decisions.length === 0) return b;

  let costSum = 0;
  let latSum = 0;
  for (const d of decisions) {
    b.total++;
    switch (d.feedback.outcome) {
      case 'adopted':
        b.adopted++;
        break;
      case 'modified':
        b.modified++;
        break;
      case 'overruled':
        b.overruled++;
        break;
      case 'ignored':
        b.ignored++;
        break;
      case 'pending':
        b.pending++;
        break;
    }
    costSum += d.costMicroUsd;
    latSum += d.latencyMs;
  }

  const decided = b.total - b.pending;
  b.adoptionRate = decided > 0 ? (b.adopted + b.modified) / decided : 0;
  b.overruleRate = decided > 0 ? b.overruled / decided : 0;
  b.avgCostMicroUsd = b.total > 0 ? Math.round(costSum / b.total) : 0;
  b.avgLatencyMs = b.total > 0 ? Math.round(latSum / b.total) : 0;
  b.avgCostUsd = b.avgCostMicroUsd / 10_000;

  return b;
}

function extractKeywords(text: string): string[] {
  // 简化: 中文字 + 英文词
  const words: string[] = [];
  const re = /([a-zA-Z]{3,})|([\u4e00-\u9fa5]{2,4})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text.toLowerCase())) !== null) {
    words.push(m[1] ?? m[2]);
  }
  return words;
}

/**
 * 计算 CompanyBrain 智能迭代度量
 * 默认取最近 30 天 + 最近 500 条决策
 */
export async function computeMetrics(opts: {
  tenantId?: string;
  windowDays?: number;
  limit?: number;
} = {}): Promise<BrainMetricsReport> {
  const windowDays = opts.windowDays ?? 30;
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
  const decisions = await listDecisions({
    tenantId: opts.tenantId,
    since,
    limit: opts.limit ?? 500,
  });

  const overall = aggregate(decisions);

  // by context
  const contextKeys: CompanyBrainDecisionContext[] = [
    'im_reply',
    'boss_ai_reply',
    'baseline_arbitration',
    'meeting_advice',
    'retrospective_draft',
    'document_review',
    'memory_promotion',
  ];
  const byContext = {} as Record<CompanyBrainDecisionContext, BrainMetricsBucket>;
  for (const ctx of contextKeys) {
    byContext[ctx] = aggregate(decisions.filter((d) => d.context === ctx));
  }

  // by brain version
  const byBrainVersion: Record<string, BrainMetricsBucket> = {};
  const versions = Array.from(new Set(decisions.map((d) => d.brainVersion)));
  for (const v of versions) {
    byBrainVersion[`v${v}`] = aggregate(decisions.filter((d) => d.brainVersion === v));
  }

  // daily trend (最近 30 天, 即使无数据也填 0)
  const dailyMap = new Map<string, CompanyBrainDecision[]>();
  for (const d of decisions) {
    const day = d.createdAt.slice(0, 10);
    if (!dailyMap.has(day)) dailyMap.set(day, []);
    dailyMap.get(day)!.push(d);
  }
  const dailyTrend: BrainMetricsReport['dailyTrend'] = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const ds = dailyMap.get(date) ?? [];
    const b = aggregate(ds);
    dailyTrend.push({
      date,
      total: b.total,
      adoptionRate: Math.round(b.adoptionRate * 100) / 100,
      overruleRate: Math.round(b.overruleRate * 100) / 100,
    });
  }

  // Top failure patterns (推翻 reason 关键词聚类)
  const overruleReasons = decisions
    .filter((d) => d.feedback.outcome === 'overruled' && d.feedback.reason)
    .map((d) => ({ text: d.feedback.reason!, id: d.id }));
  const keywordCount = new Map<string, { count: number; ids: string[] }>();
  for (const r of overruleReasons) {
    const words = extractKeywords(r.text);
    const uniqueWords = Array.from(new Set(words));
    for (const w of uniqueWords) {
      if (!keywordCount.has(w)) keywordCount.set(w, { count: 0, ids: [] });
      const c = keywordCount.get(w)!;
      c.count++;
      if (c.ids.length < 5) c.ids.push(r.id);
    }
  }
  const topFailurePatterns = Array.from(keywordCount.entries())
    .filter(([, v]) => v.count >= 2) // 至少 2 次才算"模式"
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([keyword, v]) => ({ keyword, count: v.count, sampleDecisionIds: v.ids }));

  const recentOverrules = decisions
    .filter((d) => d.feedback.outcome === 'overruled')
    .slice(0, 10);

  return {
    windowStart: since,
    windowEnd: new Date().toISOString(),
    overall,
    byContext,
    byBrainVersion,
    dailyTrend,
    topFailurePatterns,
    recentOverrules,
  };
}

/**
 * 把 BrainMetricsReport 压缩成 CompanyBrainVersionMetrics (用于 Version 记录)
 */
export function bucketToVersionMetrics(
  bucket: BrainMetricsBucket,
  sampleIds: string[]
): CompanyBrainVersionMetrics {
  return {
    decisionsCount: bucket.total,
    adoptionRate: Math.round(bucket.adoptionRate * 10_000) / 10_000,
    overruleRate: Math.round(bucket.overruleRate * 10_000) / 10_000,
    avgCostMicroUsd: bucket.avgCostMicroUsd,
    avgLatencyMs: bucket.avgLatencyMs,
    sampleDecisionIds: sampleIds.slice(0, 10),
  };
}

/** 简化的 outcome map (用于看板饼图) */
export function outcomeMap(bucket: BrainMetricsBucket): Record<CompanyBrainFeedbackOutcome, number> {
  return {
    adopted: bucket.adopted,
    modified: bucket.modified,
    overruled: bucket.overruled,
    ignored: bucket.ignored,
    pending: bucket.pending,
  };
}
