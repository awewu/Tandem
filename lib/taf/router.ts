/**
 * TAF Router · 多模型路由器
 *
 * 按场景 + 成本 + 失败回退 自动选择最佳 LLM.
 * 对应 MANIFESTO 第十六条
 */

import type {
  ChatChunk,
  ChatRequest,
  ChatResponse,
  LLMProvider,
  ScenarioTag,
} from './provider/types';

export interface RoutingRule {
  scenario: ScenarioTag;
  primary: string;        // provider name
  fallbacks: string[];    // 按顺序尝试
  reason?: string;
}

/**
 * 默认路由规则 (企业级中央AI: claude-opus-4-5 担任旗舰, 其余为梯级 fallback)
 *
 * 优先级策略:
 *   中央AI (tenant forceProvider) > 个人AI (user forceProvider) > 以下场景规则
 *
 * claude-opus-4-5: 200K ctx, vision, 强推理 — 企业关键决策专用
 * deepseek-v3:     高性价比推理兜底
 * doubao-pro:      256K 长文档 / 高频低成本
 */
export const DEFAULT_ROUTING_RULES: RoutingRule[] = [
  {
    scenario: 'reasoning_complex',
    primary: 'claude-opus-4-5',
    // §B-001 · deepseek-r1 作为第一 fallback (推理质量接近 + ~30x 便宜)
    fallbacks: ['deepseek-r1', 'deepseek-v3', 'qwen-max', 'kimi-k2'],
    reason: '议事室 / 3+1 决策 — 企业最强推理旗舰; R1 fallback 提质降本',
  },
  {
    scenario: 'agentic',
    primary: 'claude-opus-4-5',
    fallbacks: ['deepseek-v3', 'hermes-4', 'qwen-max'],
    reason: '多步 Agent — Opus 工具调用 + 长上下文规划最优',
  },
  {
    scenario: 'tool_use',
    primary: 'claude-opus-4-5',
    fallbacks: ['qwen-max', 'deepseek-v3'],
    reason: 'Memory RAG / Function Calling — Opus function calling 精准',
  },
  {
    scenario: 'long_context',
    primary: 'claude-opus-4-5',
    fallbacks: ['doubao-pro', 'kimi-k2', 'deepseek-v3'],
    reason: '200K ctx — 复盘 / 历史回溯 / 长文档分析',
  },
  {
    scenario: 'persona_dialogue',
    primary: 'deepseek-v3',
    fallbacks: ['claude-opus-4-5', 'qwen-max'],
    reason: '拿捏老板对话 — 高频个人AI 场景, 成本敏感, Opus 作备用',
  },
  {
    scenario: 'high_frequency',
    primary: 'doubao-pro',
    fallbacks: ['deepseek-v3', 'qwen-max'],
    reason: 'Check-in 草稿 / 通知 — 高频低成本, 不消耗 Opus 配额',
  },
];

export class TandemRouter {
  private providers = new Map<string, LLMProvider>();
  private rules: RoutingRule[];

  constructor(rules: RoutingRule[] = DEFAULT_ROUTING_RULES) {
    this.rules = rules;
  }

  registerProvider(provider: LLMProvider): void {
    this.providers.set(provider.name, provider);
  }

  unregisterProvider(name: string): void {
    this.providers.delete(name);
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  setRules(rules: RoutingRule[]): void {
    this.rules = rules;
  }

  /** 阻塞调用, 自动 fallback */
  async chat(req: ChatRequest): Promise<ChatResponse> {
    req = await this.preprocessMessages(req);
    const candidates = this.resolveCandidates(
      req.scenario,
      req.forceProvider,
      hasTools(req),
    );

    let lastError: unknown;
    for (const name of candidates) {
      const provider = this.providers.get(name);
      if (!provider) continue;
      const startedAt = Date.now();
      try {
        const res = await provider.chat(req);
        // §B-005 LlmUsageLog 自动埋点 (fire-and-forget)
        void this.recordLlmUsage(name, req, res, Date.now() - startedAt, true).catch(() => {});
        return res;
      } catch (err) {
        lastError = err;
        // 失败也记录, 用于失败率统计
        void this.recordLlmUsage(name, req, null, Date.now() - startedAt, false, err).catch(() => {});
        if (!this.isRecoverable(err)) {
          throw err;
        }
        // 继续尝试下一个 fallback
      }
    }

    // P0-3 (LAUNCH-200): 全 provider 失败 = critical, 触发告警 (alerts.ts 内置 60s 同标题抖动抑制)
    const errMsg = (lastError as Error)?.message ?? 'unknown';
    void import('../infra/alerts').then(({ fireAlert }) =>
      fireAlert({
        severity: 'critical',
        title: 'LLM all providers failed',
        body: `scenario=${req.scenario ?? 'default'} candidates=${candidates.join(',')} last=${errMsg.slice(0, 300)}`,
        tags: { module: 'llm-router', scenario: req.scenario ?? 'default' },
      }),
    ).catch(() => {});
    throw new Error(
      `All providers failed for scenario=${req.scenario ?? 'default'}. Last: ${errMsg}`
    );
  }

  /**
   * 把单次 LLM 调用结果写入 LlmUsageLog. 永不抛错.
   * 跟 audit/log.ts 风格一致 (best-effort persist).
   */
  private async recordLlmUsage(
    providerName: string,
    req: ChatRequest,
    res: ChatResponse | null,
    latencyMs: number,
    success: boolean,
    err?: unknown
  ): Promise<void> {
    try {
      const { trackLlm, estimateCostMicroUsd } = await import('@/lib/analytics/track');
      const model = res?.model ?? '(unknown)';
      const tokensIn = res?.usage?.promptTokens ?? 0;
      const tokensOut = res?.usage?.completionTokens ?? 0;
      await trackLlm({
        scenario: req.scenario ?? 'default',
        provider: providerName,
        model,
        tokensIn,
        tokensOut,
        latencyMs,
        costMicroUsd: success ? estimateCostMicroUsd(model, tokensIn, tokensOut) : 0,
        userId: req.metadata?.userId ?? (req as { actorUserId?: string }).actorUserId ?? null,
        // §IM-7 调用方 trace id (IM messageId / decisionCardId / ⌘K sessionId / ...)
        requestId: req.metadata?.requestId,
        success,
        errorMessage: success ? undefined : (err as Error)?.message?.slice(0, 500),
      });
    } catch {
      /* 埋点失败永不抛 */
    }
  }

  /** 流式调用 */
  async *chatStream(req: ChatRequest): AsyncIterable<ChatChunk> {
    req = await this.preprocessMessages(req);
    const candidates = this.resolveCandidates(
      req.scenario,
      req.forceProvider,
      hasTools(req),
    );

    for (const name of candidates) {
      const provider = this.providers.get(name);
      if (!provider) continue;
      try {
        yield* provider.chatStream(req);
        return;
      } catch (err) {
        if (!this.isRecoverable(err)) throw err;
        // try next
      }
    }

    void import('../infra/alerts').then(({ fireAlert }) =>
      fireAlert({
        severity: 'critical',
        title: 'LLM all providers failed (streaming)',
        body: `scenario=${req.scenario ?? 'default'} candidates=${candidates.join(',')}`,
        tags: { module: 'llm-router', scenario: req.scenario ?? 'default', stream: true },
      }),
    ).catch(() => {});
    throw new Error(`All providers failed for streaming scenario=${req.scenario ?? 'default'}`);
  }

  /** 健康检查所有 provider */
  async healthCheckAll(): Promise<Record<string, { healthy: boolean; latencyMs?: number; error?: string }>> {
    const results: Record<string, { healthy: boolean; latencyMs?: number; error?: string }> = {};
    await Promise.all(
      Array.from(this.providers.entries()).map(async ([name, provider]) => {
        results[name] = await provider.healthCheck();
      })
    );
    return results;
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private resolveCandidates(
    scenario?: ScenarioTag,
    forceProvider?: string,
    requireFunctionCalling = false,
  ): string[] {
    let candidates: string[];

    // 中央AI/个人AI 偏好: forceProvider 优先, 不在则退回场景规则
    if (forceProvider && this.providers.has(forceProvider)) {
      const rule = scenario ? this.rules.find((r) => r.scenario === scenario) : undefined;
      const fallbacks = rule ? [rule.primary, ...rule.fallbacks].filter((p) => p !== forceProvider) : [];
      candidates = [forceProvider, ...fallbacks];
    } else if (!scenario) {
      candidates = Array.from(this.providers.keys());
    } else {
      const rule = this.rules.find((r) => r.scenario === scenario);
      candidates = rule ? [rule.primary, ...rule.fallbacks] : Array.from(this.providers.keys());
    }

    // ⚠️ 带 tools 的请求绝不能路由到不支持 function calling 的 provider:
    //   否则模型要么报错要么静默忽略 tools → 工具循环拿 0 工具 → 上层 (S1 感知 /
    //   S2 议事参谋) fail-soft 返空 = "精致的假"。例: reasoning_complex 首选 fallback
    //   deepseek-r1 (functionCalling=false), 不过滤则 tool 请求会先打到它。
    //   只过滤"已注册且不支持"的; 未注册名留着 (调用循环里自然 skip)。
    if (requireFunctionCalling) {
      candidates = candidates.filter((name) => {
        const p = this.providers.get(name);
        return !p || p.capabilities.functionCalling;
      });
    }

    return candidates;
  }

  private isRecoverable(err: unknown): boolean {
    const msg = (err as Error)?.message ?? '';
    // 网络错误 / 限流 / 5xx → 可恢复
    if (/timeout|ECONNREFUSED|429|5\d\d/i.test(msg)) return true;
    return false;
  }

  /**
   * D-01: 在 LLM 调用前展开 user message 中的 `[[doc:id|title]]` 文档引用.
   *
   * - 把 inline mention 替换为 "(见附录 N: title)"
   * - 把所有文档原文以附录形式追加到最后一条 system 消息 (没有 system 就新建)
   * - 防爆量: 单文件 8000 字 / 整体 24000 字 (resolve-mentions.ts 内置)
   * - 无 mention 时 0 IO, 直接返回原 req
   *
   * 这是 Tandem 文档板块"超越飞书"的真注入点 (内存 7b67ce8c 同志要求的"真注入到 systemContent").
   */
  private async preprocessMessages(req: ChatRequest): Promise<ChatRequest> {
    try {
      const { hasDocumentMention, resolveDocumentMentions } = await import(
        '@/lib/documents/resolve-mentions'
      );
      const hasMention = req.messages.some(
        (m) => typeof m.content === 'string' && hasDocumentMention(m.content),
      );
      if (!hasMention) return req;

      const allAppendix: string[] = [];
      const newMessages = await Promise.all(
        req.messages.map(async (m) => {
          if (typeof m.content !== 'string' || !hasDocumentMention(m.content)) return m;
          const { inlineText, appendix } = await resolveDocumentMentions(m.content);
          if (appendix) allAppendix.push(appendix);
          return { ...m, content: inlineText };
        }),
      );

      if (allAppendix.length === 0) return { ...req, messages: newMessages };

      // 把附录拼到最后一条 system 消息末尾; 若无 system 则在最前插入
      const combinedAppendix = allAppendix.join('\n');
      const lastSystemIdx = (() => {
        for (let i = newMessages.length - 1; i >= 0; i--) {
          if (newMessages[i].role === 'system') return i;
        }
        return -1;
      })();
      if (lastSystemIdx >= 0) {
        const sys = newMessages[lastSystemIdx];
        newMessages[lastSystemIdx] = {
          ...sys,
          content:
            (typeof sys.content === 'string' ? sys.content : String(sys.content ?? '')) +
            combinedAppendix,
        };
      } else {
        newMessages.unshift({
          role: 'system',
          content: '## 用户引用的文档原文 (供你回答时参考)' + combinedAppendix,
        });
      }

      return { ...req, messages: newMessages };
    } catch (err) {
      // resolve 失败永不阻断 LLM 调用; 直接返回原 req
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn('[router] preprocessMessages failed:', err);
      }
      return req;
    }
  }
}

/** 请求是否携带 tools (用于路由时过滤掉不支持 function calling 的 provider) */
function hasTools(req: ChatRequest): boolean {
  return Array.isArray(req.tools) && req.tools.length > 0;
}
