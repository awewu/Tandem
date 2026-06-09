/**
 * governedChat · 唯一强制治理出口 (P1-M4 · UNIFIED-TECH-DESIGN §1)
 *
 * 修复架构债 (内存 4881c05e): "无旁路"曾是纪律非架构 —— govern-persona /
 * runSkillGateway / output-guard 三者互不调用, 新功能可直调 router.chat() 绕过。
 * 本函数把三闸串成**唯一出口**, 让"中央基线管控"从纪律变架构:
 *
 *   ① 输入闸  governPersonaOutput  (闸① baseline + L2 OKR锚 + L4 价值观锚 → systemPrompt)
 *   ② 动作闸  runSkillGateway      (闸②③④, 闸④ 走 deriveActionZone 内容判定)
 *   ③ LLM     router.chat          (注入治理后的 systemPrompt)
 *   ④ 输出闸  checkOutput          (LLM-as-judge: HARD_CONFLICT→重写一次, SOFT_DRIFT→脚注)
 *
 * fail 行为:
 *   - 默认 persona/skill = fail-open (闸内部故障降级放行, 记 warning)
 *   - autonomous 默认 fail-closed (输入基线闸故障 = 拦截, 不放行)
 *     检测信号: governPersonaOutput 内部 checkBaseline 抛错时 checkId='' (基线闸未成功执行)
 *
 * 用法 (业务代码不再直调 router.chat, 一律走这里):
 *   const r = await governedChat({ actorUserId, intent, basePersonaPrompt, messages, agentKind });
 *   if (!r.ok) { 转人工(r.blocked); return; }
 *   交付(r.answer);
 */

import type { ChatMessage, ScenarioTag, ChatRequest } from '../taf/provider/types';
import type { TandemRouter } from '../taf/router';
import type { DelegationLevel } from '../types/persona';
import type { DeclaredActionScope } from '../skill-gateway/derive-zone';

/**
 * 惰性取 router: 优先读 boot 注入到 globalThis 的单例 (生产路由前已 await boot()),
 * 否则动态 import boot。**不在顶层 import boot**, 避免在无 DATABASE_URL 环境
 * (单测) 触发 drizzle-client 模块级 makeClient() 抛错。
 */
async function resolveRouter(): Promise<TandemRouter> {
  const g = globalThis as { __tandem_router__?: TandemRouter };
  if (g.__tandem_router__) return g.__tandem_router__;
  const { getRouter } = await import('../boot');
  return getRouter();
}

export interface GovernedChatAction {
  dataScope?: 'personal' | 'team' | 'department' | 'company';
  /** 涉及的目标用户 (跨用户数据访问判定; 等于 actor=本人放行, 不等需特权) */
  targetUserId?: string;
  /** 声明的动作范围 (仍参考, 但闸④ 以内容判定为准) */
  declaredActionScope?: DeclaredActionScope;
  /** persona 委托级别 (越权升红判定) */
  delegationLevel?: DelegationLevel;
}

export interface GovernedChatInput {
  /** 搭子关联员工 / 调用方 userId */
  actorUserId: string;
  /** 本次意图 / 最新用户输入 (用于三闸召回 + drift + zone 判定) */
  intent: string;
  /** persona 自有 prompt (身份/阶段/代行边界 L3 + 风格 L5); autonomous/skill 可空 */
  basePersonaPrompt?: string;
  /** 对话消息 (不含治理 system; governedChat 会在最前插入治理 system) */
  messages: ChatMessage[];
  /** 调用类型, 默认 persona */
  agentKind?: 'persona' | 'autonomous' | 'skill';
  /** 路由场景 */
  scenario?: ScenarioTag;
  /** 若本次调用会产生企业动作, 传 action 触发动作闸 (②③④) */
  action?: GovernedChatAction;
  /** 候选工具名 (审计 + drift source) */
  toolName?: string;
  /** 是否注入 OKR 锚 (默认 true) */
  injectOkr?: boolean;
  /** fail 模式; 不传时 autonomous=fail-closed, 其余=fail-open */
  failMode?: 'fail-open' | 'fail-closed';
  temperature?: number;
  maxTokens?: number;
  responseFormat?: ChatRequest['responseFormat'];
  metadata?: ChatRequest['metadata'];
  /** 强制 provider (个人AI/中央AI 偏好), 透传到 router */
  forceProvider?: string;
  /** 把治理后的 system 消息标 ephemeral (Anthropic prompt cache 省 token) */
  cacheControlSystem?: boolean;
  /**
   * 治理 systemPrompt 构建后、LLM 调用前的最后变换钩子 (如 preSearch 联网注入)。
   * 在三闸之后运行, 不绕过治理 (只追加上下文)。fail-soft: 抛错则用原 prompt。
   */
  systemPromptTransform?: (systemPrompt: string) => Promise<string> | string;
  /** output-guard 出口标识 (审计), 默认按 agentKind 生成 */
  outputGuardSource?: string;
  /** 关联 ref id (im message / session 等), 审计追踪 */
  refId?: string;
  /** 关闭输出闸 (压测/特殊场景), 默认开 */
  skipOutputGuard?: boolean;
}

export interface GovernedChatResult {
  /** false = 被输入闸或动作闸拦截, answer 为空, 调用方应转人工 */
  ok: boolean;
  blocked?: { stage: 'input' | 'action'; reasons: string[] };
  /** ok=true 时的最终回答 (可能已被输出闸矫正) */
  answer?: string;
  gates: {
    input: { verdict: string; checkId: string; hitCount: number; failed: boolean };
    action?: { verdict: string; zone?: string; reasons: string[]; checkId: string };
    output?: { verdict: string; revised: boolean; checkId: string };
  };
  warnings: string[];
  checkId: string;
}

function genId(): string {
  return `gc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function governedChat(input: GovernedChatInput): Promise<GovernedChatResult> {
  const checkId = genId();
  const warnings: string[] = [];
  const agentKind = input.agentKind ?? 'persona';
  const failMode = input.failMode ?? (agentKind === 'autonomous' ? 'fail-closed' : 'fail-open');

  // ── ① 输入闸 ─────────────────────────────────────────────────────────
  const { governPersonaOutput } = await import('../persona/govern-persona');
  const gov = await governPersonaOutput({
    actorUserId: input.actorUserId,
    intent: input.intent,
    basePersonaPrompt: input.basePersonaPrompt ?? '',
    agentKind,
    toolName: input.toolName,
    injectOkr: input.injectOkr,
  });

  // L0 红线 HARD_BLOCK → 拦截 (任何 failMode 都拦)
  if (!gov.allowed) {
    return {
      ok: false,
      blocked: { stage: 'input', reasons: [gov.blockReason ?? '命中企业红线'] },
      gates: { input: { verdict: gov.verdict, checkId: gov.checkId, hitCount: gov.hits.length, failed: false } },
      warnings: [...warnings, ...gov.warnings],
      checkId,
    };
  }

  // fail-closed: 基线闸内部故障 (checkId 为空 = checkBaseline 抛错未成功执行) → 拦截
  const inputGateFailed = gov.checkId === '';
  if (inputGateFailed && failMode === 'fail-closed') {
    return {
      ok: false,
      blocked: {
        stage: 'input',
        reasons: ['autonomous fail-closed: 输入基线闸故障, 拒绝放行 (降级=拦截)'],
      },
      gates: { input: { verdict: gov.verdict, checkId: gov.checkId, hitCount: gov.hits.length, failed: true } },
      warnings: [...warnings, ...gov.warnings],
      checkId,
    };
  }
  warnings.push(...gov.warnings);

  let systemPrompt = gov.systemPrompt;

  // ── ② 动作闸 (仅当本次调用会产生企业动作) ──────────────────────────────
  let actionGate: GovernedChatResult['gates']['action'];
  if (input.action) {
    let sgFailed = false;
    try {
      const { runSkillGateway } = await import('../skill-gateway');
      const sg = await runSkillGateway({
        intent: input.intent,
        actorUserId: input.actorUserId,
        agentKind,
        toolName: input.toolName ?? `governed.${agentKind}`,
        dataScope: input.action.dataScope,
        targetUserId: input.action.targetUserId,
        actionScope: input.action.declaredActionScope,
        delegationLevel: input.action.delegationLevel,
      });
      actionGate = {
        verdict: sg.verdict,
        zone: sg.gates.actionScope.zone,
        reasons: sg.blockReasons ?? [],
        checkId: sg.checkId,
      };
      if (sg.verdict === 'HARD_BLOCK') {
        return {
          ok: false,
          blocked: { stage: 'action', reasons: sg.blockReasons ?? ['动作闸 HARD_BLOCK'] },
          gates: {
            input: { verdict: gov.verdict, checkId: gov.checkId, hitCount: gov.hits.length, failed: inputGateFailed },
            action: actionGate,
          },
          warnings,
          checkId,
        };
      }
      if (sg.verdict === 'SOFT_WARN') {
        const zoneNote = sg.gates.actionScope.zone === 'yellow'
          ? '\n\n---\n【动作闸 · 黄区提示】本次涉及改企业数据/对外承诺, 产出仅为草案, 需走签批/24h 否决窗, 不得视为已生效。'
          : '';
        if (sg.contextToInject) systemPrompt += `\n\n---\n${sg.contextToInject}`;
        systemPrompt += zoneNote;
      }
    } catch (err) {
      sgFailed = true;
      warnings.push(`动作闸调用异常: ${(err as Error).message}`);
      if (failMode === 'fail-closed') {
        return {
          ok: false,
          blocked: { stage: 'action', reasons: ['autonomous fail-closed: 动作闸故障, 拒绝放行'] },
          gates: {
            input: { verdict: gov.verdict, checkId: gov.checkId, hitCount: gov.hits.length, failed: inputGateFailed },
            action: { verdict: 'HARD_BLOCK', reasons: ['gate exception'], checkId: '' },
          },
          warnings,
          checkId,
        };
      }
    }
    if (sgFailed && !actionGate) {
      actionGate = { verdict: 'PASS', reasons: ['fail-open: 动作闸故障降级放行'], checkId: '' };
    }
  }

  // ── ③ LLM 调用 (注入治理后的 systemPrompt) ───────────────────────────
  // 最后变换钩子 (preSearch 等): 在三闸之后追加上下文, 不绕过治理
  if (input.systemPromptTransform) {
    try {
      systemPrompt = await input.systemPromptTransform(systemPrompt);
    } catch (err) {
      warnings.push(`systemPromptTransform 失败 (用原 prompt): ${(err as Error).message}`);
    }
  }

  const router = await resolveRouter();
  const systemMsg: ChatMessage = { role: 'system', content: systemPrompt };
  if (input.cacheControlSystem) systemMsg.cacheControl = 'ephemeral';
  const messages: ChatMessage[] = [systemMsg, ...input.messages];
  let answer: string;
  try {
    const res = await router.chat({
      messages,
      scenario: input.scenario,
      forceProvider: input.forceProvider,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      responseFormat: input.responseFormat,
      metadata: input.metadata ?? { userId: input.actorUserId, requestId: input.refId },
    });
    answer = typeof res.message.content === 'string' ? res.message.content : '';
  } catch (err) {
    // LLM 故障不是闸故障; 直接抛给调用方处理 (router 已内置 fallback)
    throw new Error(`governedChat LLM 调用失败: ${(err as Error).message}`);
  }

  // ── ④ 输出闸 (LLM-as-judge 矫正镜片) ─────────────────────────────────
  let outputGate: GovernedChatResult['gates']['output'];
  if (!input.skipOutputGuard) {
    try {
      const { checkOutput } = await import('../memory/output-guard');
      const out = await checkOutput({
        query: input.intent,
        response: answer,
        actorUserId: input.actorUserId,
        source: input.outputGuardSource ?? `governed.${agentKind}`,
        refId: input.refId,
      });
      let revised = false;
      if (out.verdict === 'HARD_CONFLICT' && out.revisionPrompt) {
        // 重写一次: 把矫正指引作为追加 user 消息再调一轮
        try {
          const res2 = await router.chat({
            messages: [
              ...messages,
              { role: 'assistant', content: answer },
              { role: 'user', content: out.revisionPrompt },
            ],
            scenario: input.scenario,
            temperature: 0.3,
            maxTokens: input.maxTokens,
            metadata: input.metadata ?? { userId: input.actorUserId, requestId: input.refId },
          });
          const revisedAnswer = typeof res2.message.content === 'string' ? res2.message.content : '';
          if (revisedAnswer.trim()) {
            answer = revisedAnswer + '\n\n_（已按公司 Memory 基线自我矫正）_';
            revised = true;
          }
        } catch (err) {
          warnings.push(`输出闸重写失败 (保留原答 + 告警): ${(err as Error).message}`);
        }
      } else if (out.verdict === 'SOFT_DRIFT' && out.footnote) {
        answer += out.footnote;
      }
      outputGate = { verdict: out.verdict, revised, checkId: out.checkId };
    } catch (err) {
      warnings.push(`输出闸调用异常 (fail-soft): ${(err as Error).message}`);
    }
  }

  return {
    ok: true,
    answer,
    gates: {
      input: { verdict: gov.verdict, checkId: gov.checkId, hitCount: gov.hits.length, failed: inputGateFailed },
      action: actionGate,
      output: outputGate,
    },
    warnings,
    checkId,
  };
}
