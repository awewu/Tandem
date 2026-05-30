/**
 * §B-001 · DeepSeek-R1 配置 + 路由就绪测试
 */
import { describe, it, expect } from 'vitest';
import { PROVIDER_CONFIGS } from '../../lib/taf/index';
import { DEFAULT_ROUTING_RULES } from '../../lib/taf/router';
import { estimateCostMicroUsd, LLM_PRICING_USD_PER_M } from '../../lib/analytics/track';

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
