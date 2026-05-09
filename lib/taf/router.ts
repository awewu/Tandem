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

/** 默认路由规则 (来自 OSS-STACK 决议) */
export const DEFAULT_ROUTING_RULES: RoutingRule[] = [
  {
    scenario: 'reasoning_complex',
    primary: 'deepseek-v3',
    fallbacks: ['qwen-max', 'kimi-k2'],
    reason: '议事室 / 3+1 决策, 推理深度第一',
  },
  {
    scenario: 'tool_use',
    primary: 'qwen-max',
    fallbacks: ['deepseek-v3'],
    reason: 'Memory RAG / 工具调用, function calling 最稳',
  },
  {
    scenario: 'high_frequency',
    primary: 'doubao-pro',
    fallbacks: ['glm-4-air', 'qwen-plus'],
    reason: 'Check-in 草稿 / 通知, 性价比 + 速度',
  },
  {
    scenario: 'long_context',
    primary: 'kimi-k2',
    fallbacks: ['qwen-max', 'deepseek-v3'],
    reason: '128K+ 上下文, 复盘场景',
  },
  {
    scenario: 'persona_dialogue',
    primary: 'deepseek-v3',
    fallbacks: ['qwen-max'],
    reason: '拿捏老板对话, 推理 + 风格模仿',
  },
  {
    scenario: 'agentic',
    primary: 'hermes-4',
    fallbacks: ['deepseek-v3', 'qwen-max'],
    reason: 'Hermes Function Calling 训练范式优势',
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
    const candidates = this.resolveCandidates(req.scenario);

    let lastError: unknown;
    for (const name of candidates) {
      const provider = this.providers.get(name);
      if (!provider) continue;
      try {
        return await provider.chat(req);
      } catch (err) {
        lastError = err;
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

  /** 流式调用 */
  async *chatStream(req: ChatRequest): AsyncIterable<ChatChunk> {
    const candidates = this.resolveCandidates(req.scenario);

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

  private resolveCandidates(scenario?: ScenarioTag): string[] {
    if (!scenario) {
      // 默认: 使用第一个注册的 provider
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
