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

/** 工具内部名 → 给人看的中文标签 (思考轨迹里展示, 未知名原样回退). */
const TOOL_LABELS: Record<string, string> = {
  web_search: '联网搜索',
  ai_okr_lookup: '查 OKR 实时进度',
  ai_okr_risk: '核对 OKR 风险',
  ai_decision_lookup: '查历史决议',
  ai_initiative_lookup: '查行动项',
  ai_checkin_lookup: '查 CheckIn 记录',
  ai_memory_search: '检索公司记忆',
};
function friendlyTools(names: string[]): string[] {
  return Array.from(new Set(names)).map((n) => TOOL_LABELS[n] ?? n);
}

interface RequestBody {
  messages?: IncomingMessage[];
  sessionId?: string;
  currentPath?: string;
  currentTask?: string;
  /** §多模态 · 随最新一条 user 提问一起发的图片 (http(s) 链接或 data:image base64). */
  images?: string[];
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

  const { messages = [], sessionId, currentPath, currentTask, images } = body;
  if (messages.length === 0) {
    return sseError('messages 不能为空', 400);
  }
  // §多模态 · 限制图片数量 (防 payload 失控), 只保留前 4 张合法图.
  const userImages = Array.isArray(images)
    ? images.filter((u) => typeof u === 'string' && (u.startsWith('http') || u.startsWith('data:image'))).slice(0, 4)
    : [];

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

  // §轻量字段 (无 IO)。所有重活 (Memory 构建 / preSearch / S1 感知, 合计 ~4s) 都移进
  //   stream start() 内, 先回 status 事件让用户立刻看到进度, 而非干等 ~4s 才见首字节。
  const latestUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  const userQuestion = messages[messages.length - 1]?.content ?? '';

  // ── SSE 流式回写 ────────────────────────────────────────────
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
      // §思考轨迹 · 把后端真实的"查/搜/推理"过程流给前端 (Gemini 式可见思考).
      //   phase 作为稳定 key 让前端 upsert; detail 为人话摘要; tools 为真实工具名;
      //   sources 为联网引用 (title+url) → 前端渲染可点击 chips。
      const emitStep = (
        phase: string,
        label: string,
        detail?: string,
        tools?: string[],
        sources?: Array<{ title: string; url: string }>,
      ) => {
        send({ step: { phase, label, detail, tools, sources, ts: Date.now() } });
      };

      const onAbort = () => {
        send({ done: true, aborted: true });
        safeClose();
      };
      req.signal.addEventListener('abort', onAbort);

      // §CA-13 飞轮 (2026-06-09): 记录 boss_ai_reply 决策时需要端到端 latency,
      //   t0 必须包含整个 systemPrompt 构建 + S2/S1 + 流式生成的总耗时 (不只是 LLM 推理).
      const t0 = Date.now();
      try {
        // ── 0. §红线硬拒 (回答三档·第三档) · 确定性快检, 命中直接转人工, 不进 LLM ──
        try {
          const { matchHardRefuseLive } = await import('@/lib/governance/hard-refuse-service');
          const rf = await matchHardRefuseLive(userQuestion, auth.tenantId);
          if (rf.hit) {
            const msg = `🚫 这个问题涉及**${rf.label}**, 属于我不能替公司拍板的红线范围。\n\n${rf.redirect}`;
            send({ content: msg });
            fullResponse = msg;
            deferAudit('boss_ai.hard_refused', auth.userId, {
              targetId: sessionId ?? 'no-session',
              targetType: 'boss_ai_session',
              metadata: { topicId: rf.topicId, label: rf.label, questionPreview: userQuestion.slice(0, 200) },
              tenantId: auth.tenantId,
            });
            send({ done: true, length: fullResponse.length, hardRefused: true });
            return;
          }
        } catch {
          /* 红线快检失败不阻塞正常回答 (fail-open) */
        }

        // ── 1. 构建 systemPrompt (Memory rerank) · 先回 status 让前端立刻有反馈 ──
        send({ status: '正在调取公司知识库…' });
        let systemPrompt: string;
        try {
          const baseSystemPrompt = await buildCompanyBrainSystemPrompt({ query: latestUserMessage });
          const contextAnchor = buildContextAnchor({ currentPath, currentTask, userId: auth.userId });
          systemPrompt = `${baseSystemPrompt}\n\n${contextAnchor}`;
          emitStep('knowledge', '调取公司知识库', '已载入 OKR / SOP / 红线 / 历史决议');
        } catch (err) {
          send({ error: `CompanyBrain prompt 构建失败: ${(err as Error).message}` });
          send({ done: true });
          return;
        }

        // ── 2. Pre-Search Layer · 时间敏感 / Memory 覆盖率低时主动联网 ──
        try {
          const { preSearchLayer } = await import('@/lib/persona/company-brain');
          const ps = await preSearchLayer(latestUserMessage, systemPrompt, auth.userId);
          if (ps.searched) {
            send({ status: '正在联网查证最新信息…' });
            systemPrompt = ps.revisedSystemPrompt;
            const prov = ps.provider ? ` (${ps.provider})` : '';
            emitStep('search', '联网查证最新信息', `命中 ${ps.log.resultCount} 条结果${prov}`, undefined, ps.sources);
          }
        } catch {
          /* preSearch 失败不阻塞主流程 */
        }

        // ── 3. §S1 内部感知层 (CA-6/7) · 只读工具查 OKR/决议真值并注入 ──
        //   "瞎子 → 能看": 基于 S0 rollup 真值作答, 而非静态注入文本。
        // §S2 深推理层 (主回复路径 · 2026-06-09) · 复杂决策类提问跑 multi-step ReAct
        //   "比较 / 为什么 / 应该 / 分析 / 策略" → 命中即跳过 S1 (S2 是 S1 的超集)。
        let s2Reasoned = false;
        try {
          send({ status: '正在做多步推理 …' });
          const { companyBrainReasoningPass } = await import('@/lib/persona/company-brain-reasoning');
          const reasoning = await companyBrainReasoningPass(latestUserMessage, systemPrompt);
          if (reasoning.reasoned) {
            systemPrompt = reasoning.revisedSystemPrompt;
            s2Reasoned = true;
            emitStep(
              'reasoning',
              '多步推理',
              `${reasoning.log.stepsExecuted} 步推理`,
              friendlyTools(reasoning.toolsUsed),
            );
            deferAudit('output_guard.checked', auth.userId, {
              targetId: sessionId ?? 'no-session',
              targetType: 'company_brain_boss',
              metadata: {
                stage: 'S2',
                reasoned: true,
                tools: reasoning.toolsUsed,
                stepsExecuted: reasoning.log.stepsExecuted,
                toolCallCount: reasoning.log.toolCallCount,
                latencyMs: reasoning.log.latencyMs,
                triggerReason: reasoning.log.triggerReason,
                traceId: reasoning.log.traceId,
              },
              tenantId: auth.tenantId,
            });
          }
        } catch {
          /* S2 失败不阻塞主流程 — 继续走 S1 兜底 */
        }

        if (!s2Reasoned) try {
          send({ status: '正在核对 OKR / 决议实时进度…' });
          const { companyBrainPerceptionPass } = await import('@/lib/persona/company-brain-perception');
          const perception = await companyBrainPerceptionPass(latestUserMessage, systemPrompt);
          if (perception.perceived) {
            systemPrompt = perception.revisedSystemPrompt;
            emitStep(
              'perception',
              '核对 OKR / 决议实时进度',
              `调用 ${perception.log.toolCallCount} 个只读工具`,
              friendlyTools(perception.toolInvocations.map((t) => t.name)),
            );
            deferAudit('output_guard.checked', auth.userId, {
              targetId: sessionId ?? 'no-session',
              targetType: 'company_brain_boss',
              metadata: {
                perception: true,
                tools: perception.toolInvocations.map((t) => t.name),
                toolCallCount: perception.log.toolCallCount,
                roundsExecuted: perception.log.roundsExecuted,
                latencyMs: perception.log.latencyMs,
                triggerReason: perception.log.triggerReason,
              },
              tenantId: auth.tenantId,
            });
          }
        } catch {
          /* 感知层失败不阻塞主流程 (fail-soft) */
        }

        // ── 3.5 §B-024 self-hint 召回 · 注入提问者过去的语言化自省教训 ──
        //   IM 主路径与 three-plus-one-engine 都已接入; BossAI 之前是 gap,
        //   导致同一员工反复问同类问题 AI 无法"记住上次怎么栽过". 此处补齐。
        //   fail-soft: 召回失败原样继续, 绝不阻塞主回复。
        let selfHintCount = 0;
        try {
          const { injectSelfHints } = await import('@/lib/persona/reflexion');
          const sh = await injectSelfHints(systemPrompt, auth.userId, latestUserMessage);
          if (sh.hintCount > 0) {
            systemPrompt = sh.revisedSystemPrompt;
            selfHintCount = sh.hintCount;
            emitStep('selfhint', '召回历史教训', `回放 ${sh.hintCount} 条过往自省`);
          }
        } catch {
          /* fail-soft */
        }

        // ── 3.6 §P0-5 SRPO 修正补丁召回 · 注入过往被否决/投诉提炼出的可复用修正策略 ──
        //   与 self-hint 互补: self-hint = 员工个人自省; SRPO patch = 中央 AI 从负面信号
        //   提炼的"下次应改成 X"修正策略 (确定性关键词检索, 零 LLM 成本). fail-soft.
        try {
          const { retrieveCorrectionPatches, buildCorrectionPromptBlock } = await import('@/lib/persona/srpo-patch');
          // context 与 company-brain-decision 记录的 decision.context 一致 (BossAI = 'boss_ai_reply')
          const patches = await retrieveCorrectionPatches(latestUserMessage, {
            tenantId: auth.tenantId,
            context: 'boss_ai_reply',
          });
          const block = buildCorrectionPromptBlock(patches);
          if (block) {
            systemPrompt += block;
            emitStep('srpo', '召回修正经验', `应用 ${patches.length} 条历史修正策略`);
          }
        } catch {
          /* fail-soft */
        }

        // ── 4. Compaction + 起点审计 ──
        // §多模态 · 把图片拼到最新一条 user 消息上 (其余消息保持纯文本).
        const lastUserIdx = messages.map((m) => m.role).lastIndexOf('user');
        const rawChatMessages: ChatMessage[] = [
          // §B-003 · system prompt 上挂 ephemeral 缓存; Anthropic 命中后输入 token ~10% 计费
          { role: 'system', content: systemPrompt, cacheControl: 'ephemeral' },
          ...messages.map((m, i) => ({
            role: m.role,
            content:
              i === lastUserIdx && userImages.length > 0
                ? buildUserContent(m.content, userImages)
                : m.content,
          })),
        ];
        const compaction = await compactMessages(rawChatMessages);
        const chatMessages = compaction.messages;

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

        // ── 5. 流式回答 ──
        send({ status: '正在组织回答…' });
        const stream = router.chatStream({
          messages: chatMessages,
          scenario: 'reasoning_complex',
          temperature: 0.6,
          metadata: { requestId: sessionId, feature: 'boss_ai_stream' },
        });

        for await (const chunk of stream) {
          if (req.signal.aborted) break;
          const text = typeof chunk.delta?.content === 'string' ? chunk.delta.content : '';
          if (text) {
            fullResponse += text;
            send({ content: text });
          }
        }

        // §Output Guard · 出口对齐镜片 (Open-Read / Governed-Output / Locked-Write 三段闸)
        // §快慢双轨: 简单问题走快道 (跳过 LLM critique, 仅靠入口红线快检兜底);
        //   复杂/决策类 或 长回答 才跑完整出口对齐裁判 (服务/偏离/冲突 + 冲突 revise)。
        let runCritique = false;
        // §闲聊软引导: 快道 = 简单/闲聊; 或出口裁判 alignment='无关' → off-topic。
        let offTopicByAlignment = false;
        if (!req.signal.aborted && fullResponse.trim().length >= 20) {
          try {
            const { shouldFullCritique } = await import('@/lib/persona/answer-pipeline');
            runCritique = shouldFullCritique(userQuestion, fullResponse.length).full;
          } catch {
            runCritique = true; // 判定失败保守跑全环
          }
        }
        if (runCritique) {
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
                  metadata: { requestId: `${sessionId ?? 'no-session'}_revised`, feature: 'boss_ai_revise' },
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
            } else if (verdict.footnote) {
              // SOFT_DRIFT 偏离脚注, 或 PASS+服务 OKR 的正向脚注 (治理倒置出口对齐提示)
              send({ content: verdict.footnote });
              fullResponse += verdict.footnote;
            }
            if (verdict.alignment === '无关') offTopicByAlignment = true;
            // §引用后处理 · 回答生成后附来源 chips (基于 output-guard 标出的 groundedIn Memory)
            if (verdict.citedMemories && verdict.citedMemories.length > 0) {
              emitStep(
                'citation',
                '引用来源',
                `基于 ${verdict.citedMemories.length} 条公司记忆`,
                undefined,
                verdict.citedMemories.map((c) => ({
                  title: c.title,
                  url: `/memories?highlight=${encodeURIComponent(c.id)}`,
                })),
              );
            }
          } catch {
            /* output-guard 自身失败不阻断 (fail-soft) */
          }
        }

        // §闲聊软引导 (默认关, admin 可开): off-topic 回复末尾附一句引导回工作。
        if (!req.signal.aborted) {
          try {
            const offTopic = !runCritique || offTopicByAlignment;
            const { maybeOffTopicNudge } = await import('@/lib/persona/off-topic-nudge');
            const nudge = await maybeOffTopicNudge(offTopic, auth.tenantId);
            if (nudge) {
              send({ content: nudge });
              fullResponse += nudge;
            }
          } catch {
            /* nudge 失败不阻断 (fail-soft) */
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

        // §产出捕获层 (#17): 中央 AI 答复也提炼可复用知识 → 待沉淀候选 (fire-and-forget).
        //   与 persona/stream 同源; 严格 gate + fail-soft, 候选归提问者, 采纳才走三级签批.
        if (!req.signal.aborted && fullResponse.trim().length >= 160) {
          const captureText = fullResponse;
          void import('@/lib/memory/output-capture')
            .then(({ captureOutputPass }) =>
              captureOutputPass({
                text: captureText,
                authorUserId: auth.userId,
                source: 'boss_ai',
                tenantId: auth.tenantId,
                sessionId: sessionId ?? undefined,
                userQuery: userQuestion,
              }),
            )
            .catch(() => { /* fire-and-forget */ });
        }

        // §CA-13 闭环 (2026-06-09 · 补燃料): 落地 boss_ai_reply 决策给反思循环喂料.
        //   之前 IM 路径已记 im_reply, 议事路径已记 meeting_advice, 唯独 BossAI (灵魂入口)
        //   不留痕 → 流量最大的入口对训练数据零贡献, 推翻梯度=0. 修补这条腿.
        //   best-effort: 失败仅 warn, 永不阻塞流式回答 / 客户端 close.
        //   decisionId 回传客户端 → 抽屉 UI 渲染 👍/✏️/👎 反馈按钮 → POST /api/company-brain/feedback.
        let recordedDecisionId: string | undefined;
        try {
          const latencyMs = Date.now() - t0;
          const { recordDecision } = await import('@/lib/persona/company-brain-decision');
          const { estimateCostMicroUsd } = await import('@/lib/analytics/track');
          // 流式无 usage, 沿用 IM 路径同一估算式 (中文 1.5 token / 其他 0.3 token).
          const estimateTokens = (text: string): number => {
            const cn = (text.match(/[\u4e00-\u9fa5]/g) ?? []).length;
            const other = text.length - cn;
            return Math.ceil(cn * 1.5 + other * 0.3);
          };
          const tokensIn = estimateTokens(`${systemPrompt}\n${userQuestion}`);
          const tokensOut = estimateTokens(fullResponse);
          // 真实归因: 取 router 对 reasoning_complex 实际命中的 provider + 模型名
          const active = router.resolveActiveModel('reasoning_complex');
          const modelUsed = active?.model ?? 'claude-opus-4-5';
          const providerUsed = active?.provider ?? 'anthropic';
          const costMicroUsd = estimateCostMicroUsd(modelUsed, tokensIn, tokensOut);
          const decision = await recordDecision({
            context: 'boss_ai_reply',
            inputSummary: userQuestion,
            outputSummary: fullResponse,
            modelUsed,
            providerUsed,
            scenario: 'reasoning_complex',
            tokensIn,
            tokensOut,
            costMicroUsd,
            latencyMs,
            aiTraceId: sessionId,
            refId: sessionId,
            refType: 'boss_ai_session',
          });
          if (decision) {
            recordedDecisionId = decision.id;
            const { audit } = await import('@/lib/audit/log');
            await audit('company_brain.decision_recorded', auth.userId, {
              targetId: decision.id,
              targetType: 'company_brain_decision',
              metadata: {
                context: 'boss_ai_reply',
                sessionId: sessionId ?? null,
                brainVersion: decision.brainVersion,
                model: modelUsed,
                tokensIn,
                tokensOut,
                costMicroUsd,
                latencyMs,
                s2Reasoned,
                currentPath: currentPath ?? null,
              },
              tenantId: auth.tenantId,
            }).catch(() => { /* noop */ });
          }
        } catch {
          /* 决策记录失败不影响 BossAI 主流程 */
        }

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

        send({
          done: true,
          length: fullResponse.length,
          decisionId: recordedDecisionId,
          selfHintCount,
          s2Reasoned,
        });
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

export const POST = withApiLog(POSTApiHandler, { route: '/api/boss-ai/stream' });

/**
 * GET /api/boss-ai/stream · 仅做 health probe (返回当前 CompanyBrain 路由信息)
 * 客户端首屏可调用此端点确认 provider 在线.
 */
async function GETApiHandler(req: NextRequest): Promise<Response> {
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

export const GET = withApiLog(GETApiHandler, { route: '/api/boss-ai/stream' });

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
      '请用第一人称代表老板回答, 务实, 优先指向当前 OKR. ' +
      '按问题复杂度自由展开: 简单问题简短直接, 复杂/决策类问题给出推理链、方向、优先级与判断框架, 不必强行压到几百字. ' +
      '如果问题需要具体数据/同事确认, 明确说"我建议你去 X 页面看 / 跟 Y 同事确认". ' +
      '不编造数据, 不替员工签字.',
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

