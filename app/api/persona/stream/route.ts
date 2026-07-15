/**
 * POST /api/persona/stream · 我的分身(搭子) · 个人工作台 SSE 流式接口
 *
 * §搭子工作台双召唤 (2026-07-13):
 * - /tandem 主舞台的「我的分身」通道. 与 /api/boss-ai/stream (中央 AI) 并列.
 * - 员工在个人工作台与"自己的 AI 分身"一对一协作 (梳理思路 / 起草 / 分析 / 查真值).
 * - 这是"咨询本人分身", 不是"代行对外" → 不写 ProxyAction, 不入 CompanyBrain 飞轮.
 *
 * §治理铁律 (与 IM 代行同源, 无旁路):
 * - 分身产出前必过 governPersonaOutput (§19.5 统一卡点):
 *     L0 企业红线 HARD_BLOCK 一票否决 → 转人工 (不进 LLM)
 *     L1 组织记忆基线 / L2 OKR 锚 / L4 价值观锚 / L4.5 手抄语料 强制注入
 * - 流式答案推完后过 output-guard 出口镜片 (HARD_CONFLICT → 矫正块).
 * - 决策防火墙: 个人手抄语料仅作个人上下文, 与企业基线冲突一律以企业为准.
 *
 * Body:
 *   { messages: {role,content}[], sessionId?, currentPath?, currentTask?, images? }
 *
 * Response: SSE — data:{"content"} / data:{"status"} / data:{"step"} / data:{"done"} / data:{"error"}
 */
import { NextRequest } from 'next/server';
import { boot, getRouter } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { getStore } from '@/lib/storage/repository';
import { getPrimaryPersona } from '@/lib/persona/persona-lookup';
import { deferAudit } from '@/lib/audit/defer';
import { compactMessages } from '@/lib/agent-runtime/compaction';
import { buildUserContent } from '@/lib/agent-runtime/tool-loop';
import { rateLimit, POLICIES } from '@/lib/infra/rate-limit';
import type { ChatMessage } from '@/lib/taf/provider/types';
import { withApiLog } from '@/lib/api-log/with-api-log';

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
  images?: string[];
  /** 分身编队 (B-037 M4): 定向对话某个技能分身; 缺省=主分身(班长) */
  personaId?: string;
}

async function POSTApiHandler(req: NextRequest): Promise<Response> {
  const auth = requireAuth(req);
  if (!('userId' in auth)) return auth; // 401

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return sseError('Invalid JSON body', 400);
  }

  const { messages = [], sessionId, currentPath, currentTask, images, personaId } = body;
  if (messages.length === 0) return sseError('messages 不能为空', 400);

  const userImages = Array.isArray(images)
    ? images.filter((u) => typeof u === 'string' && (u.startsWith('http') || u.startsWith('data:image'))).slice(0, 4)
    : [];

  // ── §0. 限流 (独立于中央 AI 预算池, 但沿用同一档位) ──────────────
  const minute = await rateLimit({ key: `persona_chat:min:${auth.userId}`, ...POLICIES.bossAi() });
  if (!minute.allowed) {
    deferAudit('boss_ai.rate_limited', auth.userId, {
      targetType: 'persona_chat_session',
      metadata: { window: 'minute', limit: minute.totalHits },
      tenantId: auth.tenantId,
    });
    return sseError(`请慢一点 · 每分钟最多 ${POLICIES.bossAi().limit} 次, 稍后再试`, 429);
  }
  const day = await rateLimit({ key: `persona_chat:day:${auth.userId}`, ...POLICIES.bossAiDaily() });
  if (!day.allowed) {
    deferAudit('boss_ai.rate_limited', auth.userId, {
      targetType: 'persona_chat_session',
      metadata: { window: 'day', limit: day.totalHits },
      tenantId: auth.tenantId,
    });
    return sseError(`今日额度已用完 (${POLICIES.bossAiDaily().limit} 次/天). 明天再来, 或联系 admin 调整额度`, 429);
  }

  await boot();
  const router = getRouter();

  const latestUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  const userQuestion = messages[messages.length - 1]?.content ?? '';

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
      const emitStep = (phase: string, label: string, detail?: string, tools?: string[]) => {
        send({ step: { phase, label, detail, tools, ts: Date.now() } });
      };
      const onAbort = () => { send({ done: true, aborted: true }); safeClose(); };
      req.signal.addEventListener('abort', onAbort);

      try {
        // ── 1. 载入本人分身 (首次自动建档 newborn) ──────────────────
        send({ status: '正在唤醒你的分身…' });
        const store = getStore();
        // 分身编队 (B-037 M4): 若指定 personaId 且属本人, 定向该技能分身; 否则用主分身(班长)。
        let persona = null;
        if (personaId) {
          const target = await store.personas.get(personaId);
          if (target && target.userId === auth.userId) persona = target;
        }
        if (!persona) {
          persona = await getPrimaryPersona(auth.userId);
        }
        if (!persona) {
          const { createPersona } = await import('@/lib/persona/evolution');
          persona = await createPersona(auth.userId);
        }

        // 技能分身: 注入其模板专业人格基线, 让对话带专业口径 (受控铁律不变)
        let skillPreamble = '';
        if (persona.kind === 'skill' && persona.templateId) {
          const tpl = await store.agentTemplates.get(persona.templateId);
          if (tpl) {
            skillPreamble =
              `你是 ${auth.userId} 的技能分身「${tpl.name}」(专业域: ${persona.specialty ?? tpl.specialty})。\n` +
              `专业人格基线:\n${tpl.basePrompt}\n`;
          }
        }

        const basePersonaPrompt =
          (skillPreamble || `你是 ${auth.userId} 的专属 AI 分身(搭子), 正在「个人工作台」与本人一对一协作。`) +
          `当前阶段: ${persona.stage}; 委托级别: ${persona.delegationLevel}。` +
          `风格: 决策速度=${persona.styleProfile.decisionSpeed}, ` +
          `风险偏好=${persona.styleProfile.riskAppetite}, ` +
          `沟通风格=${persona.styleProfile.communicationStyle}。` +
          `职责: 像最懂本人的同事一样帮他梳理思路 / 起草 / 分析 / 查真值, 务实简洁。` +
          `你了解本人的 OKR 与个人上下文, 但任何对外产出或写动作都需本人确认, 不替他做承诺、不替他签字。`;

        // ── 2. §19.5 统一卡点: 企业基线注入 + 红线 HARD_BLOCK ─────────
        send({ status: '正在对齐公司基线 / 你的 OKR…' });
        const { governPersonaOutput } = await import('@/lib/persona/govern-persona');
        const gov = await governPersonaOutput({
          actorUserId: auth.userId,
          intent: latestUserMessage,
          basePersonaPrompt,
          agentKind: persona.kind === 'skill' ? 'skill' : 'persona',
          toolName: 'persona.workbench_chat',
          injectOkr: true,
          // 分身编队 (B-037 M4): 传当前分身 id, 手抄语料方案丙按分身定向过滤
          personaId: persona.id,
        });
        if (!gov.allowed) {
          send({
            content:
              `🚫 这个方向触到了公司红线 / 组织记忆基线, 我不能替你往下推, 建议转人工或先与相关同事对齐。\n\n${gov.blockReason ?? ''}`,
          });
          fullResponse = gov.blockReason ?? 'blocked';
          send({ done: true, blocked: true });
          return;
        }
        let systemPrompt = gov.systemPrompt;
        emitStep('baseline', '对齐公司基线', gov.hits.length > 0 ? `命中 ${gov.hits.length} 条组织记忆基线` : '无冲突');

        // ── 3. 分身感知前置 (只读工具查本人 OKR/决议/记忆真值, fail-soft) ──
        try {
          send({ status: '正在核对你的 OKR / 决议实时进度…' });
          const { personaPerceptionPass } = await import('@/lib/persona/persona-perception');
          const pp = await personaPerceptionPass(latestUserMessage, systemPrompt, auth.userId);
          if (pp.perceived) {
            systemPrompt = pp.revisedSystemPrompt;
            emitStep('perception', '核对你的实时进度', undefined, pp.toolInvocations.filter((t) => t.ok).map((t) => t.name));
          }
        } catch { /* fail-soft */ }

        // ── 3.5 联网 pre-search (实时外部信息, fail-soft) ────────────
        try {
          const { preSearchLayer } = await import('@/lib/persona/company-brain');
          const ps = await preSearchLayer(latestUserMessage, systemPrompt, auth.userId);
          if (ps.searched) {
            systemPrompt = ps.revisedSystemPrompt;
            emitStep('search', '联网查证最新信息', `命中 ${ps.log.resultCount} 条结果`);
          }
        } catch { /* fail-soft */ }

        // ── 3.6 §B-024 self-hint 召回 (分身过去的语言化自省教训, fail-soft) ──
        try {
          const { injectSelfHints } = await import('@/lib/persona/reflexion');
          const sh = await injectSelfHints(systemPrompt, auth.userId, latestUserMessage);
          if (sh.hintCount > 0) {
            systemPrompt = sh.revisedSystemPrompt;
            emitStep('selfhint', '召回历史教训', `回放 ${sh.hintCount} 条过往自省`);
          }
        } catch { /* fail-soft */ }

        // ── 4. 解析个人 AI 偏好 (个人 AI > 中央规则), 受租户策略门控 ──────
        let forceProvider: string | undefined;
        try {
          const { resolveProviderForUser } = await import('@/lib/settings/llm-preference');
          const { checkPersonalAiAllowed } = await import('@/lib/settings/tenant-ai-policy');
          const resolved = await resolveProviderForUser(auth.userId, auth.tenantId, 'persona_dialogue');
          if (resolved) {
            const check = await checkPersonalAiAllowed(auth.tenantId, auth.userId, resolved);
            if (check.allowed) forceProvider = resolved;
          }
        } catch { /* 偏好读取失败走默认路由 */ }

        // ── 5. Compaction + 起点审计 ──────────────────────────────────
        const lastUserIdx = messages.map((m) => m.role).lastIndexOf('user');
        const rawChatMessages: ChatMessage[] = [
          { role: 'system', content: systemPrompt, cacheControl: 'ephemeral' },
          ...messages.map((m, i) => ({
            role: m.role,
            content: i === lastUserIdx && userImages.length > 0 ? buildUserContent(m.content, userImages) : m.content,
          })),
        ];
        const compaction = await compactMessages(rawChatMessages);
        const chatMessages = compaction.messages;

        deferAudit('boss_ai.ask', auth.userId, {
          targetId: sessionId ?? 'no-session',
          targetType: 'persona_chat_session',
          metadata: {
            questionPreview: userQuestion.slice(0, 200),
            currentPath: currentPath ?? null,
            messageCount: messages.length,
            stage: persona.stage,
            baselineHits: gov.hits.length,
          },
          tenantId: auth.tenantId,
        });

        // ── 6. 流式回答 ──────────────────────────────────────────────
        send({ status: '正在组织回答…' });
        const stream = router.chatStream({
          messages: chatMessages,
          scenario: 'persona_dialogue',
          temperature: 0.6,
          forceProvider,
          metadata: { userId: auth.userId, requestId: sessionId },
        });
        for await (const chunk of stream) {
          if (req.signal.aborted) break;
          const text = typeof chunk.delta?.content === 'string' ? chunk.delta.content : '';
          if (text) { fullResponse += text; send({ content: text }); }
        }

        // ── 7. Output Guard 出口镜片 (与公司 Memory 冲突 → 矫正块) ──────
        if (!req.signal.aborted && fullResponse.trim().length >= 20) {
          try {
            const { checkOutput } = await import('@/lib/memory/output-guard');
            const verdict = await checkOutput({
              query: userQuestion,
              response: fullResponse,
              actorUserId: auth.userId,
              source: 'persona_workbench',
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
                  scenario: 'persona_dialogue',
                  temperature: 0.4,
                  forceProvider,
                  metadata: { userId: auth.userId, requestId: `${sessionId ?? 'no-session'}_revised` },
                });
                const revised = typeof retry.message.content === 'string' ? retry.message.content.trim() : '';
                if (revised) {
                  const block = `\n\n---\n\n**⚠️ 已按公司 Memory 基线矫正**:\n\n${revised}\n\n_— output_guard checkId=${verdict.checkId}_`;
                  send({ content: block });
                  fullResponse += block;
                }
              } catch {
                const warn = `\n\n---\n\n_⚠️ 检测到与公司 Memory 偏离 (checkId=${verdict.checkId}), 重写失败 — 请谨慎采纳_`;
                send({ content: warn });
                fullResponse += warn;
              }
            } else if (verdict.verdict === 'SOFT_DRIFT' && verdict.footnote) {
              send({ content: verdict.footnote });
              fullResponse += verdict.footnote;
            }
          } catch { /* fail-soft */ }
        }

        deferAudit('boss_ai.answer', auth.userId, {
          targetId: sessionId ?? 'no-session',
          targetType: 'persona_chat_session',
          metadata: { answerLength: fullResponse.length, answerPreview: fullResponse.slice(0, 300) },
          tenantId: auth.tenantId,
        });

        send({ done: true, length: fullResponse.length });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        send({ error: `分身调用失败: ${msg}` });
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

export const POST = withApiLog(POSTApiHandler, { route: '/api/persona/stream' });

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
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache' },
  });
}
