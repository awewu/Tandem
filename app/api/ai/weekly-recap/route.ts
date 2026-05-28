/**
 * /api/ai/weekly-recap
 *
 * 完全基于真实 check-in 数据生成周报。
 *
 * 流程：
 *   1. 拉取 store.checkIns 中 authorId === auth.userId 且 createdAt 在 N 天内的记录
 *   2. 关联每条 check-in 的 KR title / target / unit
 *   3. 计算硬统计（无 LLM 也能拿到）：
 *        - totalCheckIns
 *        - krsTouched
 *        - progressIncrementByKr  (∑ progressAfter - progressBefore by kr)
 *   4. 喂给 LLM 让其输出结构化 JSON 周报（summary / highlights / concerns / blockers / nextWeekFocus）
 *   5. LLM 失败 / 无 provider → 纯规则降级（基于 stats 直接生成）
 *
 * 响应里始终带 source: 'llm' | 'fallback'。前端必须诚实展示。
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot, getRouter, getStore } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import type { ChatMessage } from '@/lib/taf/provider/types';
import type { CheckIn, KeyResult } from '@/lib/types/okr-tti';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RequestBody {
  /** 默认 7 天 */
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

interface RecapStats {
  totalCheckIns: number;
  krsTouched: number;
  progressIncrement: number;
  blockersCount: number;
  byKr: Array<{
    krId: string;
    krTitle: string;
    checkIns: number;
    progressDelta: number;
    finalProgress: number;
    targetValue: number;
    finalConfidence: string;
  }>;
}

interface RecapResult {
  summary: string;
  highlights: string[];
  concerns: string[];
  blockers: string[];
  nextWeekFocus: string[];
}

interface RecapResponse extends RecapResult {
  stats: RecapStats;
  checkIns: EnrichedCheckIn[];
  source: 'llm' | 'fallback';
  model?: string;
  reason?: string;
  rangeFrom: string;
  rangeTo: string;
}

const SYSTEM_PROMPT = `你是企业 OKR 周报教练。员工把过去一周的所有 check-in 数据交给你，请输出严格 JSON，结构如下：

{
  "summary": "本周整体一句话总结",
  "highlights": ["亮点 KR + 进度，例如：核心可用性 SLA 推进 8%，已达成本周阶段目标"],
  "concerns": ["进度落后或信心下滑的 KR"],
  "blockers": ["合并去重的关键卡点"],
  "nextWeekFocus": ["下周建议的 2-3 个重点行动"]
}

要求：
1. 只输出 JSON 本身，不要 markdown 代码块。
2. highlights / concerns / blockers / nextWeekFocus 数量各自 ≤ 5 条，没有的话给空数组。
3. 中文输出；语气克制、基于事实，不要堆形容词。
4. 如果一周没有任何 check-in，summary 直接说"本周无填报记录"。`;

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  let body: RequestBody;
  try {
    body = (await req.json().catch(() => ({}))) as RequestBody;
  } catch {
    body = {};
  }
  const days = Math.max(1, Math.min(30, body.days ?? 7));
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

  // 4. LLM 流式调用（SSE）
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
          send({ type: 'done', result: buildFallback(enriched, stats, rangeFrom, rangeTo, 'no_provider_registered') });
          safeClose();
          return;
        }

        const userPrompt = buildUserPrompt(enriched, stats, days);
        const messages: ChatMessage[] = [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ];

        // 先把 stats 推给前端，前端可以立刻渲染统计卡（不等 LLM）
        send({ type: 'stats', stats, checkIns: enriched, rangeFrom, rangeTo });

        let buffer = '';
        try {
          const it = router.chatStream({
            messages,
            scenario: 'long_context',
            temperature: 0.3,
            responseFormat: 'json',
            maxTokens: 1200,
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
          send({ type: 'done', result: buildFallback(enriched, stats, rangeFrom, rangeTo, `llm_stream_error: ${msg}`) });
          safeClose();
          return;
        }

        const parsed = parseLlmJson(buffer);
        if (!parsed) {
          send({ type: 'done', result: buildFallback(enriched, stats, rangeFrom, rangeTo, 'llm_json_parse_failed') });
          safeClose();
          return;
        }

        const modelUsed = router.listProviders().find(p => p.includes('claude') || p.includes('deepseek')) || 'claude-opus-4-5';

        const result: RecapResponse = {
          ...parsed,
          stats,
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
        send({ type: 'done', result: buildFallback(enriched, stats, rangeFrom, rangeTo, `llm_error: ${msg}`) });
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeStats(checkIns: EnrichedCheckIn[], krCache: Map<string, KeyResult | null>): RecapStats {
  const byKr = new Map<string, RecapStats['byKr'][number]>();
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
      // 用最新一条覆盖（enriched 已按 createdAt desc 排序）
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

function buildUserPrompt(enriched: EnrichedCheckIn[], stats: RecapStats, days: number): string {
  if (enriched.length === 0) {
    return `员工在过去 ${days} 天内没有提交任何 check-in。请按要求输出 JSON。`;
  }

  const lines: string[] = [
    `员工最近 ${days} 天的 OKR check-in 记录如下（共 ${stats.totalCheckIns} 条，涉及 ${stats.krsTouched} 个 KR）：`,
    '',
  ];

  for (const c of enriched.slice(0, 50)) {
    const date = c.createdAt.slice(0, 10);
    lines.push(
      `- [${date}] KR「${c.krTitle}」 ${c.progressBefore} → ${c.progressAfter} (信心 ${c.confidenceBefore}→${c.confidenceAfter})`,
    );
    if (c.achievements?.trim()) lines.push(`    成果: ${c.achievements.replace(/\n/g, ' ')}`);
    if (c.blockers?.trim()) lines.push(`    卡点: ${c.blockers.replace(/\n/g, ' ')}`);
    if (c.nextSteps?.trim()) lines.push(`    下一步: ${c.nextSteps.replace(/\n/g, ' ')}`);
  }

  lines.push('');
  lines.push('请按 system prompt 要求输出 JSON 周报。');
  return lines.join('\n');
}

function parseLlmJson(text: string): RecapResult | null {
  if (!text) return null;
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1)) as Partial<RecapResult>;
    if (
      typeof obj.summary !== 'string' ||
      !Array.isArray(obj.highlights) ||
      !Array.isArray(obj.concerns) ||
      !Array.isArray(obj.blockers) ||
      !Array.isArray(obj.nextWeekFocus)
    ) {
      return null;
    }
    const trim = (arr: unknown[]) => arr.map(String).slice(0, 5);
    return {
      summary: obj.summary,
      highlights: trim(obj.highlights),
      concerns: trim(obj.concerns),
      blockers: trim(obj.blockers),
      nextWeekFocus: trim(obj.nextWeekFocus),
    };
  } catch {
    return null;
  }
}

function buildFallback(
  enriched: EnrichedCheckIn[],
  stats: RecapStats,
  rangeFrom: string,
  rangeTo: string,
  reason: string,
): RecapResponse {
  if (enriched.length === 0) {
    return {
      summary: '本周无填报记录。',
      highlights: [],
      concerns: [],
      blockers: [],
      nextWeekFocus: [],
      stats,
      checkIns: enriched,
      source: 'fallback',
      reason,
      rangeFrom,
      rangeTo,
    };
  }

  const highlights = stats.byKr
    .filter((k) => k.progressDelta > 0)
    .slice(0, 3)
    .map((k) => `${k.krTitle}：本周推进 +${k.progressDelta}，当前 ${k.finalProgress}/${k.targetValue}`);

  const concerns = stats.byKr
    .filter((k) => k.finalConfidence !== 'on-track')
    .slice(0, 3)
    .map((k) => `${k.krTitle}：信心 ${k.finalConfidence}，需关注`);

  // 合并去重所有 check-in 里的 blockers
  const blockerSet = new Set<string>();
  for (const c of enriched) {
    if (c.blockers?.trim()) {
      for (const line of c.blockers.split('\n').map((s) => s.trim()).filter(Boolean)) {
        blockerSet.add(line);
        if (blockerSet.size >= 5) break;
      }
    }
    if (blockerSet.size >= 5) break;
  }

  // 下一步：取最近 3 条 check-in 的 nextSteps
  const nextSet = new Set<string>();
  for (const c of enriched) {
    if (c.nextSteps?.trim()) {
      for (const line of c.nextSteps.split('\n').map((s) => s.trim()).filter(Boolean)) {
        nextSet.add(line);
        if (nextSet.size >= 5) break;
      }
    }
    if (nextSet.size >= 5) break;
  }

  return {
    summary: `（降级模式）共 ${stats.totalCheckIns} 条 check-in，覆盖 ${stats.krsTouched} 个 KR，累计进度增量 ${stats.progressIncrement}，${stats.blockersCount} 条卡点。`,
    highlights,
    concerns,
    blockers: Array.from(blockerSet),
    nextWeekFocus: Array.from(nextSet),
    stats,
    checkIns: enriched,
    source: 'fallback',
    reason,
    rangeFrom,
    rangeTo,
  };
}
