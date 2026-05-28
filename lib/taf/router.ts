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
    fallbacks: ['deepseek-v3', 'qwen-max', 'kimi-k2'],
    reason: '议事室 / 3+1 决策 — 企业最强推理旗舰',
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
    const candidates = this.resolveCandidates(req.scenario, req.forceProvider);

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

    throw new Error(
      `All providers failed for scenario=${req.scenario ?? 'default'}. Last: ${
        (lastError as Error)?.message ?? 'unknown'
      }`
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
    const candidates = this.resolveCandidates(req.scenario, req.forceProvider);

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

  private resolveCandidates(scenario?: ScenarioTag, forceProvider?: string): string[] {
    // 中央AI/个人AI 偏好: forceProvider 优先, 不在则退回场景规则
    if (forceProvider && this.providers.has(forceProvider)) {
      const rule = scenario ? this.rules.find((r) => r.scenario === scenario) : undefined;
      const fallbacks = rule ? [rule.primary, ...rule.fallbacks].filter((p) => p !== forceProvider) : [];
      return [forceProvider, ...fallbacks];
    }

    if (!scenario) {
      return Array.from(this.providers.keys());
    }

    const rule = this.rules.find((r) => r.scenario === scenario);
    if (!rule) {
      return Array.from(this.providers.keys());
    }

    return [rule.primary, ...rule.fallbacks];
  }

  private isRecoverable(err: unknown): boolean {
    const msg = (err as Error)?.message ?? '';
    // 网络错误 / 限流 / 5xx → 可恢复
    if (/timeout|ECONNREFUSED|429|5\d\d/i.test(msg)) return true;
    return false;
  }
}
