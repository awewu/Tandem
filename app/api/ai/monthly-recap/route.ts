/**
 * /api/ai/monthly-recap
 *
 * 月报 AI 汇总 — 在周报基础上增加:
 *   1. KPI 板块数据回顾 (BSC 四维度完成率 + 环比)
 *   2. OKR 进展推进汇报 (月度进度增量 + 信心变化)
 *   3. 问题分析 (卡点归因 + 信心下滑 KR)
 *   4. 未来规划 (下月重点行动 + KPI 达标路径)
 *
 * 流程:
 *   1. 拉取 store.checkIns 中 authorId === auth.userId 且 createdAt 在 N 天内的记录
 *   2. 拉取 store.kpis + store.kpiSnapshots 计算 KPI 板块月度回顾
 *   3. 关联 KR title / target / unit, 计算硬统计
 *   4. 喂给 LLM 输出结构化 JSON 月报
 *   5. LLM 失败 → 纯规则降级
 *
 * SSE 事件: stats → kpiReview → delta → done
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot, getRouter, getStore } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { withTenantScope } from '@/lib/multi-tenant/with-tenant-scope';
import type { ChatMessage } from '@/lib/taf/provider/types';
import type { CheckIn, KeyResult } from '@/lib/types/okr-tti';
import type { Kpi, KpiCycle, KpiSnapshot } from '@/lib/types/kpi';
import { computeKpiCompletion, kpiCompletionColor } from '@/lib/types/kpi';
import { withApiLog } from '@/lib/api-log/with-api-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RequestBody {
  /** 默认 30 天 */
  days?: number;
  /** 默认当前 auth user */
  ownerId?: string;
}

interface EnrichedCheckIn {
  id: string;
  createdAt: string;
  krId: string;
  krTitle: string;
  progressBefore: number;
  progressAfter: number;
  confidenceBefore: string;
  confidenceAfter: string;
  achievements: string | null;
  blockers: string | null;
  nextSteps: string | null;
  mood: string | null;
}

interface KpiReviewItem {
  kpiId: string;
  title: string;
  bscPerspective: string;
  scope: string;
  startValue: number;
  targetValue: number;
  currentValue: number;
  completion: number;
  color: string;
  unit?: string;
  monthDelta: number;
  snapshotsCount: number;
}

interface KpiReviewSummary {
  totalKpis: number;
  bonusKpis: number;
  monitorKpis: number;
  greenCount: number;
  yellowCount: number;
  redCount: number;
  byPerspective: Array<{
    perspective: string;
    label: string;
    count: number;
    avgCompletion: number;
  }>;
  items: KpiReviewItem[];
}

interface OkrProgressItem {
  krId: string;
  krTitle: string;
  checkIns: number;
  progressDelta: number;
  finalProgress: number;
  targetValue: number;
  finalConfidence: string;
  confidenceChanged: boolean;
}

interface MonthlyStats {
  totalCheckIns: number;
  krsTouched: number;
  progressIncrement: number;
  blockersCount: number;
  byKr: OkrProgressItem[];
}

interface ActionItem {
  action: string;
  owner: string;
  deadline: string;
  priority: 'high' | 'medium' | 'low';
  relatedKpi?: string;
  relatedKr?: string;
}

interface TrendPoint {
  date: string;
  value: number;
}

interface KpiTrendItem {
  kpiId: string;
  title: string;
  bscPerspective: string;
  points: TrendPoint[];
  target: number;
  unit?: string;
}

interface KrTrendItem {
  krId: string;
  krTitle: string;
  points: TrendPoint[];
  target: number;
}

interface MonthlyRecapResult {
  summary: string;
  kpiHighlights: string[];
  okrProgress: string[];
  problemAnalysis: string[];
  futurePlan: string[];
  actionItems: ActionItem[];
}

interface MonthlyRecapResponse extends MonthlyRecapResult {
  stats: MonthlyStats;
  kpiReview: KpiReviewSummary;
  kpiTrends: KpiTrendItem[];
  krTrends: KrTrendItem[];
  checkIns: EnrichedCheckIn[];
  source: 'llm' | 'fallback';
  model?: string;
  reason?: string;
  rangeFrom: string;
  rangeTo: string;
}

const SYSTEM_PROMPT = `你是企业 OKR + KPI 月报教练。员工把过去一个月的所有 check-in 数据和 KPI 完成情况交给你，请输出严格 JSON，结构如下：

{
  "summary": "本月整体一句话总结",
  "kpiHighlights": ["KPI 达标或超额完成的亮点，例如：营收完成率 92%，超过预期进度"],
  "okrProgress": ["OKR 关键进展，例如：核心可用性 SLA 推进 15%，达成本月阶段目标"],
  "problemAnalysis": ["进度落后、信心下滑或 KPI 未达预期的分析"],
  "futurePlan": ["下月建议的 2-4 个重点行动 + KPI 达标路径"],
  "actionItems": [
    {
      "action": "具体行动描述",
      "owner": "负责人姓名或角色",
      "deadline": "YYYY-MM-DD",
      "priority": "high|medium|low",
      "relatedKpi": "关联 KPI 名称（可选）",
      "relatedKr": "关联 KR 名称（可选）"
    }
  ]
}

要求：
1. 只输出 JSON 本身，不要 markdown 代码块。
2. 每个数组 ≤ 5 条，没有的话给空数组。
3. 中文输出；语气克制、基于事实，不要堆形容词。
4. kpiHighlights 聚焦 KPI 达标情况，okrProgress 聚焦 OKR 推进，两者不要重复。
5. problemAnalysis 要分析根因而非罗列现象。
6. futurePlan 要结合 KPI 缺口和 OKR 进度给出可执行建议。
7. actionItems 是结构化行动清单，每条必须有 action/owner/deadline/priority。priority 只有 high/medium/low 三个值。deadline 为具体日期字符串。
8. 如果一个月没有任何 check-in 且无 KPI 数据，summary 直接说"本月无填报记录"。`;

const BSC_LABELS: Record<string, string> = {
  financial: '财务经营',
  customer: '客户市场',
  process: '内部流程',
  growth: '学习成长',
};

async function POSTApiHandler(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  let body: RequestBody;
  try {
    body = (await req.json().catch(() => ({}))) as RequestBody;
  } catch {
    body = {};
  }
  const days = Math.max(1, Math.min(90, body.days ?? 30));
  const ownerId = body.ownerId ?? auth.userId;

  await boot();
  const store = getStore();

  const now = new Date();
  const rangeTo = now.toISOString();
  const rangeFrom = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

  // 1. 拉 check-ins
  const allCheckIns = (await store.checkIns.list()) as CheckIn[];
  const mine = allCheckIns.filter(
    (c) =>
      c.authorId === ownerId &&
      c.scope === 'kr' &&
      c.createdAt >= rangeFrom &&
      c.createdAt <= rangeTo,
  );

  // 2. 关联 KR title
  const krCache = new Map<string, KeyResult | null>();
  async function getKr(id: string): Promise<KeyResult | null> {
    if (krCache.has(id)) return krCache.get(id)!;
    const kr = (await store.keyResults.get(id)) as KeyResult | null;
    krCache.set(id, kr ?? null);
    return kr ?? null;
  }

  const enriched: EnrichedCheckIn[] = [];
  for (const c of mine) {
    const kr = await getKr(c.scopeId);
    enriched.push({
      id: c.id,
      createdAt: c.createdAt,
      krId: c.scopeId,
      krTitle: kr?.title ?? '(已删除的 KR)',
      progressBefore: c.progressBefore,
      progressAfter: c.progressAfter,
      confidenceBefore: c.confidenceBefore,
      confidenceAfter: c.confidenceAfter,
      achievements: c.achievements ?? null,
      blockers: c.blockers ?? null,
      nextSteps: c.nextSteps ?? null,
      mood: c.mood ?? null,
    });
  }
  enriched.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  // 3. 硬统计
  const stats = computeStats(enriched, krCache);

  // 4. KPI 板块回顾
  const kpiReview = await computeKpiReview(store, auth.tenantId ?? 'default', ownerId, rangeFrom, rangeTo);

  // 4b. 趋势数据 (KPI 快照时间序列 + KR 进度时间序列)
  const { kpiTrends, krTrends } = await computeTrends(store, auth.tenantId ?? 'default', ownerId, rangeFrom, rangeTo, allCheckIns, krCache);

  // 5. LLM 流式调用 (SSE)
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const safeClose = () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch { /* ignore */ }
      };
      const send = (obj: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch { /* ignore */ }
      };

      req.signal.addEventListener('abort', safeClose);

      try {
        const router = getRouter();
        if (router.listProviders().length === 0) {
          send({ type: 'done', result: buildFallback(enriched, stats, kpiReview, kpiTrends, krTrends, rangeFrom, rangeTo, 'no_provider_registered') });
          safeClose();
          return;
        }

        const userPrompt = buildUserPrompt(enriched, stats, kpiReview, days);
        const messages: ChatMessage[] = [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ];

        // 先推 stats + kpiReview 给前端立刻渲染
        send({ type: 'stats', stats, kpiReview, kpiTrends, krTrends, checkIns: enriched, rangeFrom, rangeTo });

        let buffer = '';
        try {
          const it = router.chatStream({
            messages,
            scenario: 'long_context',
            temperature: 0.3,
            responseFormat: 'json',
            maxTokens: 1600,
            metadata: { userId: auth.userId },
          });
          for await (const chunk of it) {
            if (req.signal.aborted) break;
            const piece = typeof chunk.delta?.content === 'string' ? chunk.delta.content : '';
            if (piece) {
              buffer += piece;
              send({ type: 'delta', content: piece });
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          send({ type: 'done', result: buildFallback(enriched, stats, kpiReview, kpiTrends, krTrends, rangeFrom, rangeTo, `llm_stream_error: ${msg}`) });
          safeClose();
          return;
        }

        const parsed = parseLlmJson(buffer);
        if (!parsed) {
          send({ type: 'done', result: buildFallback(enriched, stats, kpiReview, kpiTrends, krTrends, rangeFrom, rangeTo, 'llm_json_parse_failed') });
          safeClose();
          return;
        }

        const modelUsed = router.listProviders().find(p => p.includes('claude') || p.includes('deepseek')) || 'claude-opus-4-5';

        const result: MonthlyRecapResponse = {
          ...parsed,
          stats,
          kpiReview,
          kpiTrends,
          krTrends,
          checkIns: enriched,
          source: 'llm',
          model: modelUsed,
          rangeFrom,
          rangeTo,
        };
        send({ type: 'done', result });
        safeClose();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        send({ type: 'done', result: buildFallback(enriched, stats, kpiReview, kpiTrends, krTrends, rangeFrom, rangeTo, `llm_error: ${msg}`) });
        safeClose();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

export const POST = withApiLog(POSTApiHandler, { route: '/api/ai/monthly-recap' });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeStats(checkIns: EnrichedCheckIn[], krCache: Map<string, KeyResult | null>): MonthlyStats {
  const byKr = new Map<string, OkrProgressItem>();
  let progressIncrement = 0;
  let blockersCount = 0;

  for (const c of checkIns) {
    const delta = c.progressAfter - c.progressBefore;
    progressIncrement += delta;
    if (c.blockers && c.blockers.trim()) blockersCount += 1;

    const cur = byKr.get(c.krId);
    if (cur) {
      cur.checkIns += 1;
      cur.progressDelta += delta;
      if (c.confidenceBefore !== c.confidenceAfter) cur.confidenceChanged = true;
    } else {
      const kr = krCache.get(c.krId);
      byKr.set(c.krId, {
        krId: c.krId,
        krTitle: c.krTitle,
        checkIns: 1,
        progressDelta: delta,
        finalProgress: c.progressAfter,
        targetValue: kr?.targetValue ?? 0,
        finalConfidence: c.confidenceAfter,
        confidenceChanged: false,
      });
    }
  }

  return {
    totalCheckIns: checkIns.length,
    krsTouched: byKr.size,
    progressIncrement: Math.round(progressIncrement * 100) / 100,
    blockersCount,
    byKr: Array.from(byKr.values()).sort((a, b) => b.progressDelta - a.progressDelta),
  };
}

async function computeKpiReview(
  store: ReturnType<typeof getStore>,
  tenantId: string,
  assigneeId: string,
  rangeFrom: string,
  rangeTo: string,
): Promise<KpiReviewSummary> {
  // 取 active KPI 周期
  const cycles = (await withTenantScope(store.kpiCycles, tenantId).list())
    .filter((c: KpiCycle) => c.status === 'active');
  if (cycles.length === 0) {
    return { totalKpis: 0, bonusKpis: 0, monitorKpis: 0, greenCount: 0, yellowCount: 0, redCount: 0, byPerspective: [], items: [] };
  }

  const activeCycleIds = new Set(cycles.map((c) => c.id));

  // 取该用户相关的 KPI (个人 + 部门)
  const allKpis = (await withTenantScope(store.kpis, tenantId).list()).filter(
    (k: Kpi) => activeCycleIds.has(k.cycleId) && (k.assigneeId === assigneeId || k.level === 'department'),
  );

  if (allKpis.length === 0) {
    return { totalKpis: 0, bonusKpis: 0, monitorKpis: 0, greenCount: 0, yellowCount: 0, redCount: 0, byPerspective: [], items: [] };
  }

  // 取月度快照 (rangeFrom ~ rangeTo)
  const allSnapshots = (await store.kpiSnapshots.list()) as KpiSnapshot[];
  const kpiIdSet = new Set(allKpis.map((k) => k.id));
  const monthSnapshots = allSnapshots.filter(
    (s) => kpiIdSet.has(s.kpiId) && s.date >= rangeFrom.slice(0, 10) && s.date <= rangeTo.slice(0, 10),
  );

  const items: KpiReviewItem[] = [];
  let greenCount = 0;
  let yellowCount = 0;
  let redCount = 0;
  let bonusKpis = 0;
  let monitorKpis = 0;

  for (const kpi of allKpis) {
    const completion = computeKpiCompletion(kpi);
    const color = kpiCompletionColor(completion);
    if (color === 'green') greenCount++;
    else if (color === 'yellow') yellowCount++;
    else redCount++;

    if (kpi.scope === 'bonus') bonusKpis++;
    else monitorKpis++;

    // 计算月度增量: 取月内最早和最晚快照的差
    const snaps = monthSnapshots
      .filter((s) => s.kpiId === kpi.id)
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    const monthDelta = snaps.length >= 2
      ? Math.round((snaps[snaps.length - 1].cumulativeValue - snaps[0].cumulativeValue) * 100) / 100
      : 0;

    items.push({
      kpiId: kpi.id,
      title: kpi.title,
      bscPerspective: kpi.bscPerspective ?? 'financial',
      scope: kpi.scope,
      startValue: kpi.startValue,
      targetValue: kpi.targetValue,
      currentValue: kpi.currentValue,
      completion: Math.round(completion * 100) / 100,
      color,
      unit: kpi.unit,
      monthDelta,
      snapshotsCount: snaps.length,
    });
  }

  // 按 BSC 维度汇总
  const perspectives = ['financial', 'customer', 'process', 'growth'];
  const byPerspective = perspectives
    .map((p) => {
      const perspItems = items.filter((i) => i.bscPerspective === p);
      if (perspItems.length === 0) return null;
      const avgCompletion = perspItems.reduce((sum, i) => sum + i.completion, 0) / perspItems.length;
      return {
        perspective: p,
        label: BSC_LABELS[p] ?? p,
        count: perspItems.length,
        avgCompletion: Math.round(avgCompletion * 100) / 100,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return {
    totalKpis: allKpis.length,
    bonusKpis,
    monitorKpis,
    greenCount,
    yellowCount,
    redCount,
    byPerspective,
    items: items.sort((a, b) => b.completion - a.completion),
  };
}

function buildUserPrompt(enriched: EnrichedCheckIn[], stats: MonthlyStats, kpiReview: KpiReviewSummary, days: number): string {
  const lines: string[] = [
    `员工最近 ${days} 天的月报数据如下：`,
    '',
    '## OKR Check-in 统计',
    `- 共 ${stats.totalCheckIns} 条 check-in，覆盖 ${stats.krsTouched} 个 KR`,
    `- 累计进度增量: ${stats.progressIncrement}`,
    `- 卡点记录: ${stats.blockersCount} 条`,
  ];

  if (stats.byKr.length > 0) {
    lines.push('', '### KR 维度汇总:');
    for (const kr of stats.byKr.slice(0, 20)) {
      lines.push(
        `- KR「${kr.krTitle}」: ${kr.checkIns} 次check-in, 进度增量 +${kr.progressDelta}, 当前 ${kr.finalProgress}/${kr.targetValue}, 信心 ${kr.finalConfidence}${kr.confidenceChanged ? ' (本月有变化)' : ''}`,
      );
    }
  }

  if (kpiReview.totalKpis > 0) {
    lines.push('', '## KPI 板块回顾');
    lines.push(`- 共 ${kpiReview.totalKpis} 个 KPI (奖金挂钩 ${kpiReview.bonusKpis}, 监控 ${kpiReview.monitorKpis})`);
    lines.push(`- 达标(绿) ${kpiReview.greenCount}, 关注(黄) ${kpiReview.yellowCount}, 未达(红) ${kpiReview.redCount}`);

    if (kpiReview.byPerspective.length > 0) {
      lines.push('', '### BSC 维度:');
      for (const p of kpiReview.byPerspective) {
        lines.push(`- ${p.label}: ${p.count} 个 KPI, 平均完成率 ${Math.round(p.avgCompletion * 100)}%`);
      }
    }

    lines.push('', '### KPI 明细 (前 10):');
    for (const item of kpiReview.items.slice(0, 10)) {
      lines.push(
        `- 「${item.title}」[${BSC_LABELS[item.bscPerspective] ?? item.bscPerspective}] 完成率 ${Math.round(item.completion * 100)}% (${item.color}), ${item.currentValue}/${item.targetValue} ${item.unit ?? ''}, 月增量 ${item.monthDelta > 0 ? '+' : ''}${item.monthDelta}`,
      );
    }
  }

  if (enriched.length > 0) {
    lines.push('', '## 原始 Check-in 流水 (前 30 条):');
    for (const c of enriched.slice(0, 30)) {
      const date = c.createdAt.slice(0, 10);
      lines.push(
        `- [${date}] KR「${c.krTitle}」 ${c.progressBefore} → ${c.progressAfter} (信心 ${c.confidenceBefore}→${c.confidenceAfter})`,
      );
      if (c.achievements?.trim()) lines.push(`    成果: ${c.achievements.replace(/\n/g, ' ')}`);
      if (c.blockers?.trim()) lines.push(`    卡点: ${c.blockers.replace(/\n/g, ' ')}`);
      if (c.nextSteps?.trim()) lines.push(`    下一步: ${c.nextSteps.replace(/\n/g, ' ')}`);
    }
  }

  lines.push('', '请按 system prompt 要求输出 JSON 月报。');
  return lines.join('\n');
}

function parseLlmJson(text: string): MonthlyRecapResult | null {
  if (!text) return null;
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1)) as Partial<MonthlyRecapResult>;
    if (
      typeof obj.summary !== 'string' ||
      !Array.isArray(obj.kpiHighlights) ||
      !Array.isArray(obj.okrProgress) ||
      !Array.isArray(obj.problemAnalysis) ||
      !Array.isArray(obj.futurePlan)
    ) {
      return null;
    }
    const trim = (arr: unknown[]) => arr.map(String).slice(0, 5);
    const rawActions: unknown[] = Array.isArray(obj.actionItems) ? obj.actionItems : [];
    const actionItems: ActionItem[] = rawActions
      .filter((a): a is Record<string, unknown> => typeof a === 'object' && a !== null)
      .map((a) => ({
        action: String(a.action ?? ''),
        owner: String(a.owner ?? '负责人待定'),
        deadline: String(a.deadline ?? ''),
        priority: (['high', 'medium', 'low'].includes(String(a.priority)) ? String(a.priority) : 'medium') as ActionItem['priority'],
        relatedKpi: a.relatedKpi ? String(a.relatedKpi) : undefined,
        relatedKr: a.relatedKr ? String(a.relatedKr) : undefined,
      }))
      .filter((a) => a.action.length > 0)
      .slice(0, 8);
    return {
      summary: obj.summary,
      kpiHighlights: trim(obj.kpiHighlights),
      okrProgress: trim(obj.okrProgress),
      problemAnalysis: trim(obj.problemAnalysis),
      futurePlan: trim(obj.futurePlan),
      actionItems,
    };
  } catch {
    return null;
  }
}

function buildFallback(
  enriched: EnrichedCheckIn[],
  stats: MonthlyStats,
  kpiReview: KpiReviewSummary,
  kpiTrends: KpiTrendItem[],
  krTrends: KrTrendItem[],
  rangeFrom: string,
  rangeTo: string,
  reason: string,
): MonthlyRecapResponse {
  if (enriched.length === 0 && kpiReview.totalKpis === 0) {
    return {
      summary: '本月无填报记录。',
      kpiHighlights: [],
      okrProgress: [],
      problemAnalysis: [],
      futurePlan: [],
      actionItems: [],
      stats,
      kpiReview,
      kpiTrends,
      krTrends,
      checkIns: enriched,
      source: 'fallback',
      reason,
      rangeFrom,
      rangeTo,
    };
  }

  // KPI 亮点: 达标或超额的
  const kpiHighlights = kpiReview.items
    .filter((k) => k.color === 'green')
    .slice(0, 3)
    .map((k) => `${k.title}：完成率 ${Math.round(k.completion * 100)}%，${k.color === 'green' ? '达标' : '超额完成'}`);

  // OKR 进展: 进度增量 > 0 的 KR
  const okrProgress = stats.byKr
    .filter((k) => k.progressDelta > 0)
    .slice(0, 5)
    .map((k) => `${k.krTitle}：本月推进 +${k.progressDelta}，当前 ${k.finalProgress}/${k.targetValue}`);

  // 问题分析: 未达 KPI + 信心下滑 KR + 卡点
  const problems: string[] = [];
  for (const k of kpiReview.items.filter((k) => k.color === 'red').slice(0, 3)) {
    problems.push(`${k.title}：KPI 完成率仅 ${Math.round(k.completion * 100)}%，未达预期`);
  }
  for (const k of stats.byKr.filter((k) => k.finalConfidence !== 'on-track').slice(0, 3)) {
    problems.push(`${k.krTitle}：信心 ${k.finalConfidence}，需关注`);
  }
  const blockerSet = new Set<string>();
  for (const c of enriched) {
    if (c.blockers?.trim()) {
      for (const line of c.blockers.split('\n').map((s) => s.trim()).filter(Boolean)) {
        blockerSet.add(line);
        if (blockerSet.size >= 3) break;
      }
    }
    if (blockerSet.size >= 3) break;
  }
  for (const b of Array.from(blockerSet)) problems.push(`卡点：${b}`);

  // 未来规划: 取最近 check-in 的 nextSteps + KPI 缺口建议
  const futurePlan: string[] = [];
  const nextSet = new Set<string>();
  for (const c of enriched) {
    if (c.nextSteps?.trim()) {
      for (const line of c.nextSteps.split('\n').map((s) => s.trim()).filter(Boolean)) {
        nextSet.add(line);
        if (nextSet.size >= 3) break;
      }
    }
    if (nextSet.size >= 3) break;
  }
  for (const n of Array.from(nextSet)) futurePlan.push(n);

  for (const k of kpiReview.items.filter((k) => k.color !== 'green').slice(0, 2)) {
    const gap = Math.round((1 - k.completion) * 100);
    futurePlan.push(`${k.title}：需补齐 ${gap}% 才能达标`);
  }

  // 降级行动项: 从 futurePlan + KPI 缺口生成
  const nextMonth = new Date(rangeTo);
  nextMonth.setDate(nextMonth.getDate() + 30);
  const defaultDeadline = nextMonth.toISOString().slice(0, 10);
  const actionItems: ActionItem[] = [];
  for (const k of kpiReview.items.filter((k) => k.color !== 'green').slice(0, 3)) {
    const gap = Math.round((1 - k.completion) * 100);
    actionItems.push({
      action: `${k.title}：补齐 ${gap}% 缺口至达标线`,
      owner: 'KPI 负责人',
      deadline: defaultDeadline,
      priority: k.color === 'red' ? 'high' : 'medium',
      relatedKpi: k.title,
    });
  }
  for (const k of stats.byKr.filter((k) => k.finalConfidence !== 'on-track').slice(0, 2)) {
    actionItems.push({
      action: `${k.krTitle}：跟进信心偏移，排查原因并制定追赶计划`,
      owner: 'KR 负责人',
      deadline: defaultDeadline,
      priority: k.finalConfidence === 'behind' ? 'high' : 'medium',
      relatedKr: k.krTitle,
    });
  }

  return {
    summary: `（降级模式）本月共 ${stats.totalCheckIns} 条 check-in，覆盖 ${stats.krsTouched} 个 KR，累计进度增量 ${stats.progressIncrement}。KPI 板块：${kpiReview.greenCount} 达标 / ${kpiReview.yellowCount} 关注 / ${kpiReview.redCount} 未达。`,
    kpiHighlights,
    okrProgress,
    problemAnalysis: problems,
    futurePlan: futurePlan.slice(0, 5),
    actionItems: actionItems.slice(0, 5),
    stats,
    kpiReview,
    kpiTrends,
    krTrends,
    checkIns: enriched,
    source: 'fallback',
    reason,
    rangeFrom,
    rangeTo,
  };
}

// ---------------------------------------------------------------------------
// Trends — KPI 快照时间序列 + KR 进度时间序列
// ---------------------------------------------------------------------------

async function computeTrends(
  store: ReturnType<typeof getStore>,
  tenantId: string,
  assigneeId: string,
  rangeFrom: string,
  rangeTo: string,
  allCheckIns: CheckIn[],
  krCache: Map<string, KeyResult | null>,
): Promise<{ kpiTrends: KpiTrendItem[]; krTrends: KrTrendItem[] }> {
  // KPI 趋势: 取该用户相关 KPI 的全部快照 (不限月内, 展示完整历史趋势)
  const cycles = (await withTenantScope(store.kpiCycles, tenantId).list())
    .filter((c: KpiCycle) => c.status === 'active');
  const activeCycleIds = new Set(cycles.map((c) => c.id));
  const allKpis = (await withTenantScope(store.kpis, tenantId).list()).filter(
    (k: Kpi) => activeCycleIds.has(k.cycleId) && (k.assigneeId === assigneeId || k.level === 'department'),
  );
  const kpiIdSet = new Set(allKpis.map((k) => k.id));
  const allSnapshots = (await store.kpiSnapshots.list()) as KpiSnapshot[];
  const relevantSnapshots = allSnapshots
    .filter((s) => kpiIdSet.has(s.kpiId))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const kpiTrends: KpiTrendItem[] = allKpis.map((kpi) => ({
    kpiId: kpi.id,
    title: kpi.title,
    bscPerspective: kpi.bscPerspective ?? 'financial',
    target: kpi.targetValue,
    unit: kpi.unit,
    points: relevantSnapshots
      .filter((s) => s.kpiId === kpi.id)
      .map((s) => ({ date: s.date, value: s.cumulativeValue })),
  })).filter((t) => t.points.length >= 2);

  // KR 趋势: 从 check-in 记录提取进度时间序列
  const mineCheckIns = allCheckIns.filter(
    (c) => c.authorId === assigneeId && c.scope === 'kr' && c.createdAt >= rangeFrom && c.createdAt <= rangeTo,
  );
  const byKr = new Map<string, { date: string; value: number }[]>();
  for (const c of mineCheckIns) {
    const arr = byKr.get(c.scopeId) ?? [];
    arr.push({ date: c.createdAt.slice(0, 10), value: c.progressAfter });
    byKr.set(c.scopeId, arr);
  }
  const krTrends: KrTrendItem[] = [];
  for (const [krId, points] of Array.from(byKr)) {
    if (points.length < 2) continue;
    const kr = krCache.get(krId);
    krTrends.push({
      krId,
      krTitle: kr?.title ?? '(已删除的 KR)',
      target: kr?.targetValue ?? 0,
      points: points.sort((a, b) => (a.date < b.date ? -1 : 1)),
    });
  }

  return { kpiTrends, krTrends };
}
