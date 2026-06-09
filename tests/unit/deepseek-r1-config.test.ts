/**
 * §B-001 · DeepSeek-R1 配置 + 路由就绪测试
 */
import { describe, it, expect } from 'vitest';
import { PROVIDER_CONFIGS } from '../../lib/taf/index';
import { DEFAULT_ROUTING_RULES, TandemRouter } from '../../lib/taf/router';
import { estimateCostMicroUsd, LLM_PRICING_USD_PER_M } from '../../lib/analytics/track';
import type {
  ChatChunk,
  ChatRequest,
  ChatResponse,
  LLMProvider,
  ProviderCapabilities,
} from '../../lib/taf/provider/types';

describe('B-001 · DeepSeek-R1 接入', () => {
  it('PROVIDER_CONFIGS 包含 deepseek-r1', () => {
    const cfg = PROVIDER_CONFIGS['deepseek-r1'];
    expect(cfg).toBeDefined();
    expect(cfg.name).toBe('deepseek-r1');
    expect(cfg.baseUrl).toContain('deepseek');
    // R1 限制
    expect(cfg.capabilities.functionCalling).toBe(false);
    expect(cfg.capabilities.jsonMode).toBe(false);
    expect(cfg.capabilities.streaming).toBe(true);
    expect(cfg.capabilities.maxContextTokens).toBeGreaterThanOrEqual(64_000);
  });

  it('reasoning_complex 路由 fallback 包含 deepseek-r1 (优先于 v3)', () => {
    const rule = DEFAULT_ROUTING_RULES.find((r) => r.scenario === 'reasoning_complex');
    expect(rule).toBeDefined();
    expect(rule!.fallbacks).toContain('deepseek-r1');
    const r1Idx = rule!.fallbacks.indexOf('deepseek-r1');
    const v3Idx = rule!.fallbacks.indexOf('deepseek-v3');
    expect(r1Idx).toBeLessThan(v3Idx);
  });

  it('agentic / tool_use 不应使用 R1 (R1 不支持 function calling)', () => {
    const agentic = DEFAULT_ROUTING_RULES.find((r) => r.scenario === 'agentic');
    const toolUse = DEFAULT_ROUTING_RULES.find((r) => r.scenario === 'tool_use');
    expect(agentic!.primary).not.toBe('deepseek-r1');
    expect(agentic!.fallbacks).not.toContain('deepseek-r1');
    expect(toolUse!.primary).not.toBe('deepseek-r1');
    expect(toolUse!.fallbacks).not.toContain('deepseek-r1');
  });

  it('LLM_PRICING_USD_PER_M 含 deepseek-reasoner (R1 model name)', () => {
    expect(LLM_PRICING_USD_PER_M['deepseek-reasoner']).toBeDefined();
    expect(LLM_PRICING_USD_PER_M['deepseek-reasoner'].out).toBeGreaterThan(0);
  });

  it('estimateCostMicroUsd · R1 1M in + 1M out ≈ $2.74 = 27,400 microUsd', () => {
    // 1 microUsd = 1/10000 USD; $0.55 + $2.19 = $2.74 = 27,400 microUsd
    const cost = estimateCostMicroUsd('deepseek-reasoner', 1_000_000, 1_000_000);
    expect(cost).toBeGreaterThan(27_000);
    expect(cost).toBeLessThan(27_500);
  });
});

// 回归: 带 tools 的请求绝不能路由到 functionCalling=false 的 provider (如 R1)。
//   2026-06-08 真模型深挖确认: reasoning_complex 首选 fallback 是 deepseek-r1
//   (functionCalling=false), 若路由不按能力过滤, tool 请求会先打到 R1 → 模型
//   忽略/报错 tools → 工具循环 0 工具 → S2 议事参谋 fail-soft 返空 = 精致的假。
describe('B-001 · 路由能力过滤 (functionCalling)', () => {
  function makeProvider(
    name: string,
    functionCalling: boolean,
  ): LLMProvider & { calls: number } {
    const caps: ProviderCapabilities = {
      chat: true,
      functionCalling,
      streaming: true,
      jsonMode: true,
      vision: false,
      maxContextTokens: 64_000,
    };
    const p = {
      name,
      capabilities: caps,
      calls: 0,
      async chat(_req: ChatRequest): Promise<ChatResponse> {
        p.calls++;
        return {
          id: name,
          message: { role: 'assistant', content: `from ${name}` },
          finishReason: 'stop',
          usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
          model: name,
        };
      },
      async *chatStream(_req: ChatRequest): AsyncIterable<ChatChunk> {
        p.calls++;
        yield { delta: `from ${name}`, done: true } as unknown as ChatChunk;
      },
      async countTokens(): Promise<number> {
        return 1;
      },
      async healthCheck() {
        return { healthy: true };
      },
    };
    return p;
  }

  const toolSchema = {
    type: 'function' as const,
    function: { name: 'okr_health_digest', description: 't', parameters: { type: 'object', properties: {} } },
  };

  it('带 tools · reasoning_complex → 跳过 R1(no-fc), 落到支持的 provider', async () => {
    const router = new TandemRouter();
    const r1 = makeProvider('deepseek-r1', false);
    const v3 = makeProvider('deepseek-v3', true);
    router.registerProvider(r1);
    router.registerProvider(v3);

    const res = await router.chat({
      messages: [{ role: 'user', content: 'q' }],
      scenario: 'reasoning_complex',
      tools: [toolSchema],
      toolChoice: 'auto',
    });

    expect(r1.calls).toBe(0); // R1 不支持 fc, 被过滤, 从未被调
    expect(v3.calls).toBe(1);
    expect(res.model).toBe('deepseek-v3');
  });

  it('无 tools · reasoning_complex → R1 仍优先 (能力过滤不影响纯推理)', async () => {
    const router = new TandemRouter();
    const r1 = makeProvider('deepseek-r1', false);
    const v3 = makeProvider('deepseek-v3', true);
    router.registerProvider(r1);
    router.registerProvider(v3);

    const res = await router.chat({
      messages: [{ role: 'user', content: 'q' }],
      scenario: 'reasoning_complex',
    });

    expect(r1.calls).toBe(1); // 无 tools, R1 作为首选 fallback 正常优先
    expect(res.model).toBe('deepseek-r1');
  });
});
