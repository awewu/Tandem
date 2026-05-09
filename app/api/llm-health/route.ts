/**
 * GET /api/llm-health
 *
 * 用于验证 LLM provider 配置. 返回:
 *   - 已注册的 providers
 *   - 每个 provider 的健康检查 (实际 ping 一次 chat completion)
 *   - DeepSeek 是否可用 (核心模型)
 */

import { NextResponse } from 'next/server';
import { boot, getRouter } from '@/lib/boot';

export async function GET() {
  await boot();
  const router = getRouter();
  const registered = router.listProviders();

  // ping 每个 provider (受测时实际打一次 LLM 接口, 慢但准)
  const checks = await router.healthCheckAll();

  // 屏蔽 .env 风险: 不返回任何 key, 仅 boolean
  const summary = {
    registeredProviders: registered,
    primaryReasoner: registered.includes('deepseek-v3') ? 'deepseek-v3' : registered[0] ?? null,
    health: checks,
    deepseekConfigured: registered.includes('deepseek-v3'),
    deepseekHealthy: checks['deepseek-v3']?.healthy ?? false,
  };

  return NextResponse.json(summary);
}
