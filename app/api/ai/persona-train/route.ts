/**
 * POST /api/ai/persona-train
 *
 * 分身训练台对话：用户提问 → AI 用"用户的口吻"回答 → 用户给反馈。
 *
 * SSE 协议（与 /api/ai/extract-daily-report 对齐）:
 *   data: {"type":"delta","content":"..."}      // LLM token 流
 *   data: {"type":"done","source":"llm"|"fallback","model":"...","reason":"..."}
 *
 * 失败 / 无 provider → 不假装回复；前端弹 destructive toast + 在对话历史里写「⚠️ LLM 未响应」。
 *
 * 反馈写回（用户标"像我 / 不像我"）走现有 PATCH /api/persona/[userId]，
 * 这里只负责生成回复，不直接改 persona。
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot, getRouter } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import type { ChatMessage } from '@/lib/taf/provider/types';
import { withApiLog } from '@/lib/api-log/with-api-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RequestBody {
  /** 用户提的问题 */
  query: string;
  /** 分身编队 (B-037 M4): 训练哪个分身; 缺省=主分身(班长)。技能分身注入其模板专业基线。 */
  personaId?: string;
  /** 训练养料摘要（前端从 /training-context 拿到后传过来；服务端不重新查，省一次 IO） */
  context?: {
    styleProfile?: {
      decisionSpeed?: string;
      riskAppetite?: number;
      communicationStyle?: string;
    } | null;
    /** 最近成果片段（简短拼接） */
    recentAchievements?: string[];
    /** 最近卡点 */
    recentBlockers?: string[];
    /** 最近 next steps */
    recentNextSteps?: string[];
    /** 个人 Memory 标题（反映重视的规范） */
    memoryTitles?: string[];
  };
}

const SYSTEM_PROMPT_BASE = `你是企业员工 X 的 AI 分身。
你正在与员工本人对话，目的是让他训练你越来越像他自己。

回答时遵循：
1. 严格采用员工本人的语气和决策习惯（见下方 "styleProfile" 和 "近期成果/卡点/计划"）。
2. 答案要具体可执行，不堆形容词，不空泛口号。
3. 字数控制在 200 字以内。
4. 如果养料里有相关历史决策痕迹，优先引用员工已有的判断逻辑而不是另起炉灶。
5. 中文回答。`;

function buildSystemPrompt(ctx: RequestBody['context']): string {
  if (!ctx) return SYSTEM_PROMPT_BASE;
  const parts: string[] = [SYSTEM_PROMPT_BASE, ''];

  if (ctx.styleProfile) {
    const sp = ctx.styleProfile;
    parts.push(`员工风格画像:`);
    if (sp.decisionSpeed) parts.push(`  - 决策速度: ${sp.decisionSpeed}`);
    if (typeof sp.riskAppetite === 'number') parts.push(`  - 风险偏好: ${sp.riskAppetite.toFixed(2)} (0=保守, 1=激进)`);
    if (sp.communicationStyle) parts.push(`  - 沟通风格: ${sp.communicationStyle}`);
    parts.push('');
  }

  if (ctx.recentAchievements?.length) {
    parts.push('员工近期成果片段（用作语言/逻辑参考）:');
    for (const a of ctx.recentAchievements.slice(0, 5)) {
      parts.push(`  · ${a}`);
    }
    parts.push('');
  }

  if (ctx.recentBlockers?.length) {
    parts.push('员工近期遇到的卡点:');
    for (const b of ctx.recentBlockers.slice(0, 3)) {
      parts.push(`  · ${b}`);
    }
    parts.push('');
  }

  if (ctx.recentNextSteps?.length) {
    parts.push('员工近期写下的下一步:');
    for (const n of ctx.recentNextSteps.slice(0, 3)) {
      parts.push(`  · ${n}`);
    }
    parts.push('');
  }

  if (ctx.memoryTitles?.length) {
    parts.push('员工重视的规范（个人 Memory 标题）:');
    for (const t of ctx.memoryTitles.slice(0, 5)) {
      parts.push(`  · ${t}`);
    }
  }

  return parts.join('\n');
}

async function POSTApiHandler(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!body.query?.trim()) {
    return NextResponse.json({ error: 'query required' }, { status: 400 });
  }

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
        await boot();
        const router = getRouter();
        if (router.listProviders().length === 0) {
          send({ type: 'done', source: 'fallback', reason: 'no_provider_registered' });
          safeClose();
          return;
        }

        // §19.5 搭子受控铁律: persona 自有 prompt 先过统一卡点, 企业基线强制注入,
        // 命中企业红线 HARD_BLOCK 则转人工 (不进 LLM)。
        let basePersonaPrompt = buildSystemPrompt(body.context);
        let agentKind: 'persona' | 'skill' = 'persona';
        let personaId: string | undefined;
        // 分身编队 (B-037 M4): 若指定 personaId 且属本人, 训练该技能分身 (注入模板基线 + 手抄丙定向)。
        if (typeof body.personaId === 'string' && body.personaId) {
          try {
            const { getStore } = await import('@/lib/storage/repository');
            const store = getStore();
            const p = await store.personas.get(body.personaId);
            if (p && p.userId === auth.userId) {
              personaId = p.id;
              if (p.kind === 'skill') {
                agentKind = 'skill';
                if (p.templateId) {
                  const tpl = await store.agentTemplates.get(p.templateId);
                  if (tpl) {
                    basePersonaPrompt =
                      `你是 ${auth.userId} 的技能分身「${tpl.name}」(专业域: ${p.specialty ?? tpl.specialty})。\n` +
                      `专业人格基线:\n${tpl.basePrompt}\n\n` +
                      basePersonaPrompt;
                  }
                }
              }
            }
          } catch { /* fail-soft: 解析失败退回主分身训练 */ }
        }
        const { governPersonaOutput } = await import('@/lib/persona/govern-persona');
        const gov = await governPersonaOutput({
          actorUserId: auth.userId,
          intent: body.query.trim(),
          basePersonaPrompt,
          agentKind,
          toolName: 'persona-train',
          personaId,
        });
        if (!gov.allowed) {
          send({ type: 'delta', content: `🚫 ${gov.blockReason ?? '命中企业红线, 已转人工。'}` });
          send({ type: 'done', source: 'fallback', reason: 'baseline_hard_block', model: 'governed' });
          safeClose();
          return;
        }
        const messages: ChatMessage[] = [
          { role: 'system', content: gov.systemPrompt },
          { role: 'user', content: body.query.trim() },
        ];

        try {
          const it = router.chatStream({
            messages,
            scenario: 'persona_dialogue',
            temperature: 0.6,
            maxTokens: 400,
            metadata: { userId: auth.userId },
          });
          let gotAnyToken = false;
          for await (const chunk of it) {
            if (req.signal.aborted) break;
            const piece = typeof chunk.delta?.content === 'string' ? chunk.delta.content : '';
            if (piece) {
              gotAnyToken = true;
              send({ type: 'delta', content: piece });
            }
          }
          const modelUsed = router.listProviders().find((p) => p.includes('deepseek') || p.includes('claude')) || 'unknown';
          send({
            type: 'done',
            source: gotAnyToken ? 'llm' : 'fallback',
            model: modelUsed,
            reason: gotAnyToken ? undefined : 'llm_returned_empty',
          });
          safeClose();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          send({ type: 'done', source: 'fallback', reason: `llm_stream_error: ${msg}` });
          safeClose();
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        send({ type: 'done', source: 'fallback', reason: `boot_error: ${msg}` });
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

export const POST = withApiLog(POSTApiHandler, { route: '/api/ai/persona-train' });
