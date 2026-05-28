/**
 * GET /api/admin/company-brain
 *
 * §CA-1 (CENTRAL-AI-ARCHITECTURE.md) · 中央 AI 实体管理面板的数据 API
 *
 * 返回:
 *   - CompanyBrain Persona (id, stage, styleProfile, ...)
 *   - 公司层 Memory 计数 (训练数据规模)
 *   - 默认路由模型 (reasoning_complex scenario)
 *
 * V1.5 仅查询; V2 提供 PATCH 编辑 styleProfile + reseed
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot, getRouter } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { getStore } from '@/lib/storage/repository';
import {
  COMPANY_BRAIN_USER_ID,
  COMPANY_BRAIN_PERSONA_ID,
  getCompanyBrain,
  seedCompanyBrainIfMissing,
} from '@/lib/persona/company-brain';
import { DEFAULT_ROUTING_RULES } from '@/lib/taf/router';

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  // 幂等保证: 即使 boot seed 失败, 这里再尝试一次
  await seedCompanyBrainIfMissing();

  const persona = await getCompanyBrain();
  const store = getStore();
  const allMems = await store.memories.list();
  const companyMems = allMems.filter((m) => m.ownershipLevel === 'company');

  const router = getRouter();
  const reasoningRule = DEFAULT_ROUTING_RULES.find((r) => r.scenario === 'reasoning_complex');

  return NextResponse.json({
    userId: COMPANY_BRAIN_USER_ID,
    personaId: COMPANY_BRAIN_PERSONA_ID,
    persona,
    trainingData: {
      companyMemoryCount: companyMems.length,
      sampleTitles: companyMems.slice(0, 5).map((m) => m.title),
    },
    routing: {
      defaultScenario: 'reasoning_complex',
      primaryProvider: reasoningRule?.primary,
      fallbacks: reasoningRule?.fallbacks ?? [],
      registeredProviders: router.listProviders(),
    },
    capabilities: {
      canBeMentioned: true,
      bypassesBaselineGuard: true,
      writesProxyAction: false,
      hasReasoningLoop: false, // V2 接入 Mastra/LangGraph 后置为 true
      hasToolCalling: false,   // V2 完成 MCP 接入后置为 true
      hasReflectionLoop: false, // V3
    },
    architectureDoc: '/docs/CENTRAL-AI-ARCHITECTURE.md',
  });
}
