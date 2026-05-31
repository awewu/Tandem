/**
 * POST /api/boss-ai/stream · Tandem AI · 老板的搭子 · SSE 流式接口
 *
 * §灵魂入口 (2026-05-29 PT 19:00):
 * - 任何同事在任何页面方向不明 → 浮窗问 → 此端点回答
 * - 答案基于 CompanyBrain Persona (老板的分身) + OKR Anchor + 公司 Memory
 * - 客户端不可改写 systemPrompt; 安全 + 一致性都在服务端兜底
 *
 * Body:
 *   { messages: { role, content }[],
 *     sessionId?: string,        // 客户端 uuid, 用于审计串联
 *     currentPath?: string,      // 当前页面 URL, 注入为 'PAGE_CONTEXT' anchor
 *     currentTask?: string }     // 当前任务简述 (可选)
 *
 * Response: SSE
 *   data: {"content": "..."}
 *   data: {"done": true, "usage": {...}}
 *   data: {"error": "..."}
 */
import { NextRequest } from 'next/server';
import { boot, getRouter } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { buildCompanyBrainSystemPrompt } from '@/lib/persona/company-brain';
import { deferAudit } from '@/lib/audit/defer';
import { compactMessages } from '@/lib/agent-runtime/compaction';
import { rateLimit, POLICIES } from '@/lib/infra/rate-limit';
import type { ChatMessage } from '@/lib/taf/provider/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface IncomingMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface RequestBody {
  messages?: IncomingMessage[];
  sessionId?: string;
  currentPath?: string;
  currentTask?: string;
}

export async function POST(req: NextRequest): Promise<Response> {
  const auth = requireAuth(req);
  if (!('userId' in auth)) return auth; // 401

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return sseError('Invalid JSON body', 400);
  }

  const { messages = [], sessionId, currentPath, currentTask } = body;
  if (messages.length === 0) {
    return sseError('messages 不能为空', 400);
  }

  // ── §0. 限流: 防失控成本 ──────────────────────────────────────
  //   per-user per-minute (突发限流) + per-user per-day (失控上限)
  const minute = await rateLimit({ key: `boss_ai:min:${auth.userId}`, ...POLICIES.bossAi() });
  if (!minute.allowed) {
    deferAudit('boss_ai.rate_limited', auth.userId, {
      targetType: 'boss_ai_session',
      metadata: { window: 'minute', limit: minute.totalHits },
      tenantId: auth.tenantId,
    });
    return sseError(`请慢一点 · 每分钟最多 ${POLICIES.bossAi().limit} 次, 稍后再试`, 429);
  }
  const day = await rateLimit({ key: `boss_ai:day:${auth.userId}`, ...POLICIES.bossAiDaily() });
  if (!day.allowed) {
    deferAudit('boss_ai.rate_limited', auth.userId, {
      targetType: 'boss_ai_session',
      metadata: { window: 'day', limit: day.totalHits },
      tenantId: auth.tenantId,
    });
    return sseError(`今日额度已用完 (${POLICIES.bossAiDaily().limit} 次/天). 明天再来, 或联系 admin 调整额度`, 429);
  }

  await boot();
  const router = getRouter();

  // ── 1. 服务端构建 systemPrompt (客户端无权改写) ──────────────────
  //    §P1 Reranker · 用最新一条 user message 作为 query, 让 CompanyBrain Memory 注入按相关度排序
  const latestUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  let baseSystemPrompt: string;
  try {
    baseSystemPrompt = await buildCompanyBrainSystemPrompt({ query: latestUserMessage });
  } catch (err) {
    return sseError(`CompanyBrain prompt 构建失败: ${(err as Error).message}`, 500);
  }

  // ── 2. 注入页面/任务上下文 anchor ─────────────────────────────
  const contextAnchor = buildContextAnchor({ currentPath, currentTask, userId: auth.userId });
  let systemPrompt = `${baseSystemPrompt}\n\n${contextAnchor}`;

  // §Pre-Search Layer · 时间敏感 / 公司 Memory 覆盖度低时主动联网 (不阻塞流式)
  try {
    const { preSearchLayer } = await import('@/lib/persona/company-brain');
    const ps = await preSearchLayer(latestUserMessage, systemPrompt, auth.userId);
    if (ps.searched) {
      systemPrompt = ps.revisedSystemPrompt;
    }
  } catch {
    // preSearch 失败不阻塞主流程
  }

  const rawChatMessages: ChatMessage[] = [
    // §B-003 · system prompt 上挂 ephemeral 缓存; Anthropic 命中后输入 token ~10% 计费
    { role: 'system', content: systemPrompt, cacheControl: 'ephemeral' },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  // §Compaction: 长对话自动摘要中间历史, 保住首条 + 末 4 轮
  const compaction = await compactMessages(rawChatMessages);
  const chatMessages = compaction.messages;

  // ── 3. 审计起点 (问题进 audit, 答案在 stream 结束后再写) ────────
  const userQuestion = messages[messages.length - 1]?.content ?? '';
  deferAudit('boss_ai.ask', auth.userId, {
    targetId: sessionId ?? 'no-session',
    targetType: 'boss_ai_session',
    metadata: {
      questionPreview: userQuestion.slice(0, 200),
      currentPath: currentPath ?? null,
      messageCount: messages.length,
      compacted: compaction.compacted,
      droppedCount: compaction.droppedCount,
    },
    tenantId: auth.tenantId,
  });

  // ── 4. SSE 流式回写 ────────────────────────────────────────────
  const encoder = new TextEncoder();
  let fullResponse = '';

  const readable = new ReadableStream({
    async start(controller) {
      let closed = false;
      const safeClose = () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch { /* ignore */ }
      };
      const send = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch { /* ignore */ }
      };

      const onAbort = () => {
        send({ done: true, aborted: true });
        safeClose();
      };
      req.signal.addEventListener('abort', onAbort);

      try {
        const stream = router.chatStream({
          messages: chatMessages,
          scenario: 'reasoning_complex',
          temperature: 0.6,
          metadata: { requestId: sessionId },
        });

        for await (const chunk of stream) {
          if (req.signal.aborted) break;
          const text = typeof chunk.delta?.content === 'string' ? chunk.delta.content : '';
          if (text) {
            fullResponse += text;
            send({ content: text });
          }
        }

        // §Output Guard · 出口矫正镜片 (Open-Read / Governed-Output / Locked-Write 三段闸)
        // 流式答案推完后, 用公司 Memory 裁判一遍, HARD_CONFLICT 追加矫正块.
        if (!req.signal.aborted && fullResponse.trim().length >= 20) {
          try {
            const { checkOutput } = await import('@/lib/memory/output-guard');
            const verdict = await checkOutput({
              query: userQuestion,
              response: fullResponse,
              actorUserId: auth.userId,
              source: 'company_brain_boss',
              refId: sessionId ?? undefined,
            });
            if (verdict.verdict === 'HARD_CONFLICT' && verdict.revisionPrompt) {
              try {
                const retry = await router.chat({
                  messages: [
                    ...chatMessages,
                    { role: 'assistant', content: fullResponse },
                    { role: 'user', content: verdict.revisionPrompt },
                  ],
                  scenario: 'reasoning_complex',
                  temperature: 0.4,
                  metadata: { requestId: `${sessionId ?? 'no-session'}_revised` },
                });
                const revised = typeof retry.message.content === 'string' ? retry.message.content.trim() : '';
                if (revised) {
                  const correctionBlock = `\n\n---\n\n**⚠️ Output Guard 矫正**: 上面的回答与公司 Memory 存在冲突, 按公司基线重述如下:\n\n${revised}\n\n_— output_guard checkId=${verdict.checkId}_`;
                  send({ content: correctionBlock });
                  fullResponse += correctionBlock;
                  const { audit } = await import('@/lib/audit/log');
                  await audit('output_guard.revised', auth.userId, {
                    targetId: sessionId ?? undefined,
                    targetType: 'company_brain_boss',
                    metadata: { checkId: verdict.checkId, hits: verdict.hits.length },
                  }).catch(() => { /* noop */ });
                }
              } catch {
                const warn = `\n\n---\n\n_⚠️ Output Guard 检测到与公司 Memory 偏离 (checkId=${verdict.checkId}), 重写失败 — 请谨慎采纳上述回答_`;
                send({ content: warn });
                fullResponse += warn;
              }
            } else if (verdict.verdict === 'SOFT_DRIFT' && verdict.footnote) {
              send({ content: verdict.footnote });
              fullResponse += verdict.footnote;
            }
          } catch {
            /* output-guard 自身失败不阻断 (fail-soft) */
          }
        }

        // 完成 · 写答案审计 (best-effort)
        deferAudit('boss_ai.answer', auth.userId, {
          targetId: sessionId ?? 'no-session',
          targetType: 'boss_ai_session',
          metadata: {
            answerLength: fullResponse.length,
            answerPreview: fullResponse.slice(0, 300),
          },
          tenantId: auth.tenantId,
        });

        // §B-015 OKR Drift Detection · fire-and-forget · 不阻塞 SSE close
        // 治理委员会月审看 'BossAI 提问主航道偏离率', 不警告用户 (BossAI 是问答, 不是决策)
        queueMicrotask(() => {
          (async () => {
            try {
              const { checkOkrDrift, auditOkrDriftIfNeeded } = await import('@/lib/governance/okr-drift');
              const driftInput = {
                intent: userQuestion,
                actorUserId: auth.userId,
                source: 'company_brain_reply' as const,
                refId: sessionId ?? undefined,
                tenantId: auth.tenantId,
              };
              const drift = await checkOkrDrift(driftInput);
              await auditOkrDriftIfNeeded(drift, driftInput);
            } catch { /* best-effort */ }
          })();
        });

        send({ done: true, length: fullResponse.length });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        send({ error: `Tandem AI 调用失败: ${msg}` });
        send({ done: true, length: fullResponse.length });
      } finally {
        req.signal.removeEventListener('abort', onAbort);
        safeClose();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

/**
 * GET /api/boss-ai/stream · 仅做 health probe (返回当前 CompanyBrain 路由信息)
 * 客户端首屏可调用此端点确认 provider 在线.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const auth = requireAuth(req);
  if (!('userId' in auth)) return auth;

  await boot();
  const router = getRouter();
  return new Response(
    JSON.stringify({
      ok: true,
      providers: router.listProviders(),
      scenario: 'reasoning_complex',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
}

// ──────────────────────────────────────────────────────────────────
// helpers
// ──────────────────────────────────────────────────────────────────

function buildContextAnchor(args: {
  currentPath?: string;
  currentTask?: string;
  userId: string;
}): string {
  const lines: string[] = ['【会话上下文】'];
  lines.push(`- 提问人 userId: ${args.userId}`);
  if (args.currentPath) {
    lines.push(`- 当前页面: ${args.currentPath}`);
  }
  if (args.currentTask) {
    lines.push(`- 当前任务: ${args.currentTask}`);
  }
  lines.push('');
  lines.push(
    '【回答原则】你是老板的分身, 永远在线. 同事方向不明就问你. ' +
      '请用第一人称代表老板回答, 简短(≤300字), 务实, 优先指向当前 OKR. ' +
      '如果问题需要具体数据/同事确认, 明确说"我建议你去 X 页面看 / 跟 Y 同事确认". ' +
      '不编造数据, 不替员工签字; 但要给出方向、优先级、判断框架.',
  );
  return lines.join('\n');
}

function sseError(message: string, status: number): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`));
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      controller.close();
    },
  });
  return new Response(stream, {
    status,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}

