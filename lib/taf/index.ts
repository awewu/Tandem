/**
 * TAF · Tandem Agent Framework
 *
 * 入口: 创建预配置的 router (含主流国产模型 + Hermes).
 *
 * 用法:
 *   import { createDefaultRouter } from '@/lib/taf';
 *   const router = createDefaultRouter();
 *   const res = await router.chat({
 *     messages: [{ role: 'user', content: '...' }],
 *     scenario: 'reasoning_complex',
 *   });
 */

import { OpenAICompatibleProvider } from './provider/openai-compatible';
import { TandemRouter } from './router';
import type { ProviderConfig } from './provider/types';

export { TandemRouter, DEFAULT_ROUTING_RULES } from './router';
export { OpenAICompatibleProvider } from './provider/openai-compatible';
export type * from './provider/types';

// ---------------------------------------------------------------------------
// 默认 Provider 配置 (从环境变量读)
// ---------------------------------------------------------------------------

function envOr(key: string, fallback = ''): string {
  if (typeof process === 'undefined') return fallback;
  return process.env[key] ?? fallback;
}

export const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  'deepseek-v3': {
    name: 'deepseek-v3',
    baseUrl: envOr('DEEPSEEK_BASE_URL', 'https://api.deepseek.com/v1'),
    model: envOr('DEEPSEEK_MODEL', 'deepseek-chat'),
    apiKey: envOr('DEEPSEEK_API_KEY'),
    capabilities: {
      chat: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      vision: false,
      maxContextTokens: 64_000,
      inputPriceRmbPerM: 1.0,
      outputPriceRmbPerM: 2.0,
    },
  },
  'qwen-max': {
    name: 'qwen-max',
    baseUrl: envOr('QWEN_BASE_URL', 'https://dashscope.aliyuncs.com/compatible-mode/v1'),
    model: envOr('QWEN_MODEL', 'qwen-max'),
    apiKey: envOr('QWEN_API_KEY'),
    capabilities: {
      chat: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      vision: true,
      maxContextTokens: 32_000,
      inputPriceRmbPerM: 4.0,
      outputPriceRmbPerM: 12.0,
    },
  },
  'doubao-pro': {
    name: 'doubao-pro',
    baseUrl: envOr('DOUBAO_BASE_URL', 'https://ark.cn-beijing.volces.com/api/v3'),
    model: envOr('DOUBAO_MODEL', 'doubao-1-5-pro-256k'),
    apiKey: envOr('DOUBAO_API_KEY'),
    capabilities: {
      chat: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      vision: false,
      maxContextTokens: 256_000,
      inputPriceRmbPerM: 0.8,
      outputPriceRmbPerM: 2.0,
    },
  },
  'kimi-k2': {
    name: 'kimi-k2',
    baseUrl: envOr('KIMI_BASE_URL', 'https://api.moonshot.cn/v1'),
    model: envOr('KIMI_MODEL', 'moonshot-v1-128k'),
    apiKey: envOr('KIMI_API_KEY'),
    capabilities: {
      chat: true,
      functionCalling: true,
      streaming: true,
      jsonMode: false,
      vision: false,
      maxContextTokens: 128_000,
      inputPriceRmbPerM: 6.0,
      outputPriceRmbPerM: 6.0,
    },
  },
  'hermes-4': {
    // 本地 Hermes 4 (Ollama / vLLM 部署)
    name: 'hermes-4',
    baseUrl: envOr('HERMES_BASE_URL', 'http://localhost:11434/v1'),
    model: envOr('HERMES_MODEL', 'hermes3'),
    apiKey: envOr('HERMES_API_KEY', 'ollama'),
    capabilities: {
      chat: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      vision: false,
      maxContextTokens: 128_000,
    },
  },
};

/**
 * 创建默认路由器 (含所有有 API key 的 provider).
 *
 * 缺失 API key 的 provider 会被跳过 (开发期方便, 生产期严格校验).
 */
export function createDefaultRouter(): TandemRouter {
  const router = new TandemRouter();
  for (const [, config] of Object.entries(PROVIDER_CONFIGS)) {
    if (!config.apiKey) {
      // 跳过未配置的 provider
      continue;
    }
    router.registerProvider(new OpenAICompatibleProvider(config));
  }
  return router;
}

/**
 * 仅用于开发: 强制只用本地 Hermes (无需任何云 API key).
 */
export function createLocalDevRouter(): TandemRouter {
  const router = new TandemRouter();
  router.registerProvider(
    new OpenAICompatibleProvider({
      ...PROVIDER_CONFIGS['hermes-4'],
      apiKey: 'ollama',
    })
  );
  return router;
}
