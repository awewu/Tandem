/**
 * OpenAI-Compatible Provider · 通用实现
 *
 * 支持: DeepSeek / Qwen / Doubao / Kimi / GLM / Hermes (vLLM) / OpenAI / Anthropic 等
 *
 * 任何 OpenAI 兼容接口的模型只需配置 baseUrl + model 即可接入.
 */

import type {
  ChatChunk,
  ChatMessage,
  ChatRequest,
  ChatResponse,
  LLMProvider,
  ProviderCapabilities,
  ProviderConfig,
} from './types';

/**
 * §B-003 · 按 cacheControl 标记转换消息为 wire 格式
 *
 * - cacheControl='ephemeral' + content 是 string → 转 [{type:'text', text, cache_control:{type:'ephemeral'}}]
 * - 其它 provider 不识别 cache_control 字段时会忽略 (Anthropic / OpenRouter / Bedrock 兼容)
 * - 无 cacheControl 时直接透传 (向后兼容)
 *
 * 命中后输入 token 计费 ~10% (Anthropic 官价), 大型 system prompt 重复调用时省钱明显.
 */
export function transformMessageForWire(m: ChatMessage): Record<string, unknown> {
  const wire: Record<string, unknown> = {
    role: m.role,
    content: m.content,
  };
  if (m.name !== undefined) wire.name = m.name;
  if (m.toolCallId !== undefined) wire.tool_call_id = m.toolCallId;
  if (m.toolCalls !== undefined) wire.tool_calls = m.toolCalls;

  if (m.cacheControl === 'ephemeral') {
    if (typeof m.content === 'string') {
      wire.content = [{ type: 'text', text: m.content, cache_control: { type: 'ephemeral' } }];
    } else if (Array.isArray(m.content) && m.content.length > 0) {
      // 仅在最后一个 part 上挂 cache_control (Anthropic 官方推荐)
      const parts = m.content.map((p, i, arr) => {
        if (i === arr.length - 1 && p.type === 'text') {
          return { ...p, cache_control: { type: 'ephemeral' } };
        }
        return p;
      });
      wire.content = parts;
    }
  }
  return wire;
}

export class OpenAICompatibleProvider implements LLMProvider {
  readonly name: string;
  readonly capabilities: ProviderCapabilities;

  private readonly baseUrl: string;
  private readonly model: string;
  private readonly apiKey: string;
  private readonly headers: Record<string, string>;
  private readonly defaultTemperature: number;
  private readonly defaultMaxTokens?: number;

  constructor(config: ProviderConfig) {
    this.name = config.name;
    this.capabilities = config.capabilities;
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.model = config.model;
    this.apiKey = config.apiKey;
    this.headers = config.headers ?? {};
    this.defaultTemperature = config.temperature ?? 0.7;
    this.defaultMaxTokens = config.maxTokens;
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const body = this.buildRequestBody(req, false);
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Provider ${this.name} chat failed (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as OpenAIChatResponse;
    return this.parseResponse(data);
  }

  async *chatStream(req: ChatRequest): AsyncIterable<ChatChunk> {
    const body = this.buildRequestBody(req, true);
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok || !res.body) {
      throw new Error(`Provider ${this.name} stream failed (${res.status})`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') return;
        try {
          const parsed = JSON.parse(payload) as OpenAIStreamChunk;
          const choice = parsed.choices?.[0];
          if (!choice) continue;
          yield {
            delta: {
              role: choice.delta.role as never,
              content: choice.delta.content,
              toolCalls: choice.delta.tool_calls?.map((tc) => ({
                id: tc.id ?? '',
                type: 'function' as const,
                function: {
                  name: tc.function?.name ?? '',
                  arguments: tc.function?.arguments ?? '',
                },
              })),
            },
            finishReason: choice.finish_reason ?? undefined,
          };
        } catch {
          // Ignore malformed chunks
        }
      }
    }
  }

  async countTokens(text: string): Promise<number> {
    // 粗略估计: 中文 1 char ≈ 1.5 tokens, 英文 1 word ≈ 1.3 tokens
    // 生产环境应集成 tiktoken / 厂商 SDK
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) ?? []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars * 1.5 + otherChars * 0.3);
  }

  async healthCheck(): Promise<{ healthy: boolean; latencyMs?: number; error?: string }> {
    const t0 = Date.now();
    try {
      await this.chat({
        messages: [{ role: 'user', content: 'ping' }],
        maxTokens: 5,
      });
      return { healthy: true, latencyMs: Date.now() - t0 };
    } catch (err) {
      return { healthy: false, error: (err as Error).message };
    }
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
      ...this.headers,
    };
  }

  private buildRequestBody(req: ChatRequest, stream: boolean): Record<string, unknown> {
    return {
      model: this.model,
      messages: req.messages.map((m) => transformMessageForWire(m)),
      tools: req.tools,
      tool_choice: req.toolChoice,
      temperature: req.temperature ?? this.defaultTemperature,
      max_tokens: req.maxTokens ?? this.defaultMaxTokens,
      response_format:
        req.responseFormat === 'json' ? { type: 'json_object' } : undefined,
      stream,
    };
  }

  private parseResponse(data: OpenAIChatResponse): ChatResponse {
    const choice = data.choices[0];
    const usage = data.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    let estimatedCostRmb: number | undefined;
    if (this.capabilities.inputPriceRmbPerM && this.capabilities.outputPriceRmbPerM) {
      estimatedCostRmb =
        (usage.prompt_tokens / 1_000_000) * this.capabilities.inputPriceRmbPerM +
        (usage.completion_tokens / 1_000_000) * this.capabilities.outputPriceRmbPerM;
    }

    return {
      id: data.id,
      message: {
        role: 'assistant',
        content: choice.message.content ?? '',
        toolCalls: choice.message.tool_calls?.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.function.name, arguments: tc.function.arguments },
        })),
      },
      finishReason: choice.finish_reason as never,
      usage: {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      },
      model: data.model ?? this.model,
      estimatedCostRmb,
    };
  }
}

// ---------------------------------------------------------------------------
// 内部 OpenAI 响应类型 (最简版, 不暴露)
// ---------------------------------------------------------------------------

interface OpenAIChatResponse {
  id: string;
  model?: string;
  choices: {
    message: {
      role: string;
      content: string | null;
      tool_calls?: { id: string; type: string; function: { name: string; arguments: string } }[];
    };
    finish_reason: string;
  }[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

interface OpenAIStreamChunk {
  choices?: {
    delta: {
      role?: string;
      content?: string;
      tool_calls?: {
        id?: string;
        type?: string;
        function?: { name?: string; arguments?: string };
      }[];
    };
    finish_reason?: 'stop' | 'length' | 'tool_calls' | null;
  }[];
}
