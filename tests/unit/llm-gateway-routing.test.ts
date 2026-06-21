/**
 * Unit tests — 中继站网关 (LLM relay gateway) 路由逻辑
 *
 * 验证「一键换模型/换中继站」兼容模式的核心闭环:
 *   G-1: promoteToPrimary 后, 网关成为所有场景的首选候选
 *   G-2: 显式 forceProvider (已注册) 让位优先, 网关不强插
 *   G-3: 带 tools 的请求, 若网关不支持 function calling, 自动绕开走 fallback
 *   G-4: unregisterProvider 注销网关时, primaryOverride 自动清除
 *   G-5: promoteToPrimary 对未注册名是 no-op (不会把流量打到不存在的 provider)
 *   G-6: buildGatewayConfig — 未配置返回 null, 配齐返回 gateway config
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TandemRouter } from '../../lib/taf/router';
import { buildGatewayConfig, GATEWAY_PROVIDER_NAME } from '../../lib/taf';
import type {
  ChatRequest,
  ChatResponse,
  ChatChunk,
  LLMProvider,
  ProviderCapabilities,
} from '../../lib/taf/provider/types';

// ── Mock provider: 记录是否被调用, 返回固定响应 ──────────────────────────
function makeProvider(
  name: string,
  model: string,
  capsOverride: Partial<ProviderCapabilities> = {},
): LLMProvider & { calls: number } {
  const capabilities: ProviderCapabilities = {
    chat: true,
    functionCalling: true,
    streaming: true,
    jsonMode: true,
    vision: true,
    maxContextTokens: 200_000,
    ...capsOverride,
  };
  const provider = {
    name,
    model,
    capabilities,
    calls: 0,
    async chat(_req: ChatRequest): Promise<ChatResponse> {
      provider.calls += 1;
      return {
        id: `${name}-resp`,
        message: { role: 'assistant', content: `hi from ${name}` },
        finishReason: 'stop',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        model,
      };
    },
    async *chatStream(_req: ChatRequest): AsyncIterable<ChatChunk> {
      provider.calls += 1;
      yield { delta: { content: `hi from ${name}` }, finishReason: 'stop' };
    },
    async countTokens(text: string): Promise<number> {
      return text.length;
    },
    async healthCheck() {
      return { healthy: true };
    },
  };
  return provider;
}

const MSG: ChatRequest['messages'] = [{ role: 'user', content: 'hi' }];

describe('LLM 中继站网关路由', () => {
  let router: TandemRouter;
  let gateway: ReturnType<typeof makeProvider>;
  let claude: ReturnType<typeof makeProvider>;
  let r1: ReturnType<typeof makeProvider>;

  beforeEach(() => {
    router = new TandemRouter();
    // 网关上游真实模型 claude-opus-4-8 (真实归因用)
    gateway = makeProvider(GATEWAY_PROVIDER_NAME, 'claude-opus-4-8');
    claude = makeProvider('claude-opus-4-5', 'claude-opus-4-5');
    r1 = makeProvider('deepseek-r1', 'deepseek-reasoner', { functionCalling: false });
    router.registerProvider(claude);
    router.registerProvider(r1);
    router.registerProvider(gateway);
  });

  it('G-1: promoteToPrimary 后网关成为所有场景首选 + 真实模型归因', () => {
    router.promoteToPrimary(GATEWAY_PROVIDER_NAME);
    // reasoning_complex 默认 primary 是 claude-opus-4-5, 网关应抢到首位
    const active = router.resolveActiveModel('reasoning_complex');
    expect(active).toEqual({ provider: 'gateway', model: 'claude-opus-4-8' });
    expect(router.getPrimaryOverride()).toBe('gateway');
  });

  it('G-1b: 实际 chat 调用先打到网关', async () => {
    router.promoteToPrimary(GATEWAY_PROVIDER_NAME);
    await router.chat({ messages: MSG, scenario: 'reasoning_complex' });
    expect(gateway.calls).toBe(1);
    expect(claude.calls).toBe(0);
  });

  it('G-2: 显式 forceProvider 让位优先, 网关不强插', async () => {
    router.promoteToPrimary(GATEWAY_PROVIDER_NAME);
    await router.chat({
      messages: MSG,
      scenario: 'reasoning_complex',
      forceProvider: 'claude-opus-4-5',
    });
    expect(claude.calls).toBe(1);
    expect(gateway.calls).toBe(0);
  });

  it('G-3: 网关不支持 function calling 时, 带 tools 请求绕开网关走 fallback', async () => {
    // 网关声明不支持 tools
    const noToolGateway = makeProvider(GATEWAY_PROVIDER_NAME, 'claude-opus-4-8', {
      functionCalling: false,
    });
    router.registerProvider(noToolGateway);
    router.promoteToPrimary(GATEWAY_PROVIDER_NAME);

    await router.chat({
      messages: MSG,
      scenario: 'reasoning_complex',
      tools: [
        {
          type: 'function',
          function: { name: 'noop', description: 'noop', parameters: {} },
        },
      ],
    });
    // 网关被过滤, claude (支持 tools) 接管
    expect(noToolGateway.calls).toBe(0);
    expect(claude.calls).toBe(1);
  });

  it('G-4: 注销网关时 primaryOverride 自动清除', () => {
    router.promoteToPrimary(GATEWAY_PROVIDER_NAME);
    expect(router.getPrimaryOverride()).toBe('gateway');
    router.unregisterProvider(GATEWAY_PROVIDER_NAME);
    expect(router.getPrimaryOverride()).toBeNull();
  });

  it('G-5: promoteToPrimary 对未注册名是 no-op', () => {
    router.promoteToPrimary('does-not-exist');
    expect(router.getPrimaryOverride()).toBeNull();
  });
});

describe('buildGatewayConfig (env 驱动)', () => {
  const saved = {
    base: process.env.LLM_GATEWAY_BASE_URL,
    model: process.env.LLM_GATEWAY_MODEL,
    key: process.env.LLM_GATEWAY_API_KEY,
    tools: process.env.LLM_GATEWAY_TOOLS,
  };

  beforeEach(() => {
    delete process.env.LLM_GATEWAY_BASE_URL;
    delete process.env.LLM_GATEWAY_MODEL;
    delete process.env.LLM_GATEWAY_API_KEY;
    delete process.env.LLM_GATEWAY_TOOLS;
  });

  afterEach(() => {
    process.env.LLM_GATEWAY_BASE_URL = saved.base;
    process.env.LLM_GATEWAY_MODEL = saved.model;
    process.env.LLM_GATEWAY_API_KEY = saved.key;
    process.env.LLM_GATEWAY_TOOLS = saved.tools;
  });

  it('G-6a: 未配置 (缺 baseUrl 或 model) 返回 null', () => {
    expect(buildGatewayConfig()).toBeNull();
    process.env.LLM_GATEWAY_BASE_URL = 'http://127.0.0.1:15721/v1';
    expect(buildGatewayConfig()).toBeNull(); // 仍缺 model
  });

  it('G-6b: 配齐 baseUrl + model 返回 gateway config', () => {
    process.env.LLM_GATEWAY_BASE_URL = 'http://127.0.0.1:15721/v1';
    process.env.LLM_GATEWAY_MODEL = 'claude-opus-4-8';
    const cfg = buildGatewayConfig();
    expect(cfg).not.toBeNull();
    expect(cfg!.name).toBe(GATEWAY_PROVIDER_NAME);
    expect(cfg!.model).toBe('claude-opus-4-8');
    expect(cfg!.baseUrl).toBe('http://127.0.0.1:15721/v1');
    // key 缺省占位
    expect(cfg!.apiKey).toBe('PROXY_MANAGED');
    // 默认支持 function calling
    expect(cfg!.capabilities.functionCalling).toBe(true);
  });

  it('G-6c: LLM_GATEWAY_TOOLS=0 关闭 function calling', () => {
    process.env.LLM_GATEWAY_BASE_URL = 'http://127.0.0.1:15721/v1';
    process.env.LLM_GATEWAY_MODEL = 'claude-opus-4-8';
    process.env.LLM_GATEWAY_TOOLS = '0';
    const cfg = buildGatewayConfig();
    expect(cfg!.capabilities.functionCalling).toBe(false);
  });
});
