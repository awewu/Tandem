/**
 * /api/ai/extract-daily-report
 *
 * 用 TAF Router 真实调用 LLM，把员工的日报碎碎念提炼为结构化 AP。
 *
 * 协议：Server-Sent Events
 *   data: {"type":"delta","content":"..."}      // LLM token 流（可选，仅 llm 路径）
 *   data: {"type":"done","result":{...}}        // 最终结构化结果（必发）
 *   data: {"type":"error","message":"..."}      // 错误（替代 done）
 *
 * 结果对象包含 source: 'llm' | 'fallback'，前端必须诚实展示。
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot, getRouter } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import type { ChatMessage } from '@/lib/taf/provider/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RequestBody {
  rawInput: string;
  kr: {
    id: string;
    title: string;
    startValue: number;
    targetValue: number;
    currentValue: number;
    unit?: string | null;
    measureType?: string;
    confidence?: string;
  };
  mood?: string;
}

interface ExtractResult {
  achievements: string[];
  blockers: string[];
  nextSteps: string[];
  suggestedValue: number;
  suggestedConfidence: 'on-track' | 'at-risk' | 'off-track';
  explanation: string;
}

interface ExtractResponse extends ExtractResult {
  source: 'llm' | 'fallback';
  model?: string;
  reason?: string;
}

const SYSTEM_PROMPT = `你是企业 OKR 教练助手。员工会用自然语言（可能很凌乱）描述今天的工作进展，你需要严格输出一个 JSON 对象，结构如下：

{
  "achievements": ["..."],   // 今日具体已完成的事项，每条一句话，至少1条
  "blockers": ["..."],       // 遇到的卡点/阻碍，没有就空数组
  "nextSteps": ["..."],      // 下一步行动计划，至少1条
  "suggestedValue": 数字,    // 基于描述对应到 KR 的建议 currentValue。不要超过 targetValue。
  "suggestedConfidence": "on-track" | "at-risk" | "off-track",
  "explanation": "..."       // 一句话解释你为什么推荐这个 suggestedValue
}

要求：
1. 只输出 JSON 本身，不要 markdown 代码块，不要任何解释性前后文。
2. suggestedValue 必须是一个数字，介于 startValue 和 targetValue 之间。
3. 如果员工描述很模糊或没有实质进展，suggestedValue 可以等于 currentValue（不变）。
4. 中文输出。`;

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return jsonError('invalid_json', 400);
  }

  if (!body.rawInput?.trim() || !body.kr?.id) {
    return jsonError('rawInput and kr required', 400);
  }

  const userPrompt = buildUserPrompt(body);
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

      // 客户端断开 → 终止
      req.signal.addEventListener('abort', safeClose);

      try {
        await boot();
        const router = getRouter();

        // ── 降级路径：没有 provider ────────────────────────────────
        if (router.listProviders().length === 0) {
          send({ type: 'done', result: fallback(body, 'no_provider_registered') });
          safeClose();
          return;
        }

        const messages: ChatMessage[] = [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ];

        // ── LLM 流式调用：边推送 delta 边累积 buffer ─────────────
        let buffer = '';
        let modelUsed = '';
        try {
          const it = router.chatStream({
            messages,
            scenario: 'high_frequency',
            temperature: 0.3,
            responseFormat: 'json',
            maxTokens: 800,
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
          // 流式失败 → 走 fallback 但保留 buffer 作为调试参考
          const msg = err instanceof Error ? err.message : String(err);
          send({ type: 'done', result: fallback(body, `llm_stream_error: ${msg}`) });
          safeClose();
          return;
        }

        // ── 服务端 parse 完整 JSON ────────────────────────────────
        const parsed = parseLlmJson(buffer);
        if (!parsed) {
          send({ type: 'done', result: fallback(body, 'llm_json_parse_failed') });
          safeClose();
          return;
        }
        const clamped = clampToKr(parsed, body.kr);
        const result: ExtractResponse = { ...clamped, source: 'llm', model: modelUsed || guessModelFromBuffer() };
        send({ type: 'done', result });
        safeClose();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        send({ type: 'done', result: fallback(body, `llm_error: ${msg}`) });
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

function jsonError(message: string, status: number): Response {
  return NextResponse.json({ error: message }, { status });
}

// chatStream 不返回 model 名；这里先返回空字符串，未来 chatStream 升级再读取。
function guessModelFromBuffer(): string {
  return '';
}

function buildUserPrompt(body: RequestBody): string {
  const k = body.kr;
  return [
    `当前 KR 信息：`,
    `- 标题：${k.title}`,
    `- 起始值：${k.startValue}${k.unit ? ' ' + k.unit : ''}`,
    `- 目标值：${k.targetValue}${k.unit ? ' ' + k.unit : ''}`,
    `- 当前值：${k.currentValue}${k.unit ? ' ' + k.unit : ''}`,
    `- 当前信心：${k.confidence ?? 'on-track'}`,
    `- 度量类型：${k.measureType ?? 'numeric'}`,
    body.mood ? `- 员工今日心流：${body.mood}` : '',
    ``,
    `员工今日工作描述（可能凌乱）：`,
    body.rawInput.trim(),
  ].filter(Boolean).join('\n');
}

function parseLlmJson(text: string): ExtractResult | null {
  if (!text) return null;
  // 兼容 ```json ... ``` 包裹
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  // 找到第一个 { 到最后一个 } 之间的子串
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < 0 || end <= start) return null;
  const slice = cleaned.slice(start, end + 1);

  try {
    const obj = JSON.parse(slice) as Partial<ExtractResult>;
    if (
      !Array.isArray(obj.achievements) ||
      !Array.isArray(obj.blockers) ||
      !Array.isArray(obj.nextSteps) ||
      typeof obj.suggestedValue !== 'number' ||
      typeof obj.suggestedConfidence !== 'string' ||
      typeof obj.explanation !== 'string'
    ) {
      return null;
    }
    const conf = obj.suggestedConfidence;
    if (conf !== 'on-track' && conf !== 'at-risk' && conf !== 'off-track') {
      return null;
    }
    return {
      achievements: obj.achievements.map(String).slice(0, 6),
      blockers: obj.blockers.map(String).slice(0, 6),
      nextSteps: obj.nextSteps.map(String).slice(0, 6),
      suggestedValue: obj.suggestedValue,
      suggestedConfidence: conf,
      explanation: obj.explanation,
    };
  } catch {
    return null;
  }
}

function clampToKr(result: ExtractResult, kr: RequestBody['kr']): ExtractResult {
  // 确保 suggestedValue 在 [startValue, targetValue] 之间且不倒退
  const lo = Math.min(kr.startValue, kr.targetValue);
  const hi = Math.max(kr.startValue, kr.targetValue);
  let v = result.suggestedValue;
  if (Number.isNaN(v)) v = kr.currentValue;
  v = Math.max(lo, Math.min(hi, v));
  // 不允许相比 currentValue 倒退（员工写了今天的进展，不该让进度降）
  if (kr.targetValue >= kr.startValue) {
    v = Math.max(v, kr.currentValue);
  } else {
    v = Math.min(v, kr.currentValue);
  }
  return { ...result, suggestedValue: Math.round(v * 100) / 100 };
}

function fallback(body: RequestBody, reason: string): ExtractResponse {
  // 朴素降级：基于文本关键词做最小推断；不假装 AI。
  const k = body.kr;
  const txt = body.rawInput;
  const hasBlocker = /卡|阻|延|慢|问题|障碍|拖|风险|没赶上/.test(txt);
  const completed = /完成|搞定|上线|交付|发布|跑通|提交|合并|通过/.test(txt);

  // 仅在描述里提到具体进展时给一个小幅 step；否则保持原值
  const range = k.targetValue - k.startValue;
  const stepBase = Math.abs(range) * 0.1;
  let suggested = k.currentValue;
  if (completed) {
    suggested = k.targetValue >= k.startValue
      ? Math.min(k.targetValue, k.currentValue + stepBase)
      : Math.max(k.targetValue, k.currentValue - stepBase);
  }

  const conf: ExtractResult['suggestedConfidence'] = hasBlocker
    ? 'at-risk'
    : (k.confidence as ExtractResult['suggestedConfidence']) ?? 'on-track';

  return {
    achievements: completed ? ['（降级模式）员工描述中检测到完成事项'] : [],
    blockers: hasBlocker ? ['（降级模式）员工描述中检测到卡点关键词'] : [],
    nextSteps: ['（降级模式）请人工补充下一步计划'],
    suggestedValue: Math.round(suggested * 100) / 100,
    suggestedConfidence: conf,
    explanation: '当前未调用 LLM，使用规则降级。请配置 LLM provider 后获取真实提炼。',
    source: 'fallback',
    reason,
  };
}
