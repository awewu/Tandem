/**
 * GET /api/agent-templates
 *
 * 分身编队 (B-037 · M4): 基础 Agent 模板市场 — 列出本租户**已发布**模板, 供员工 fork 技能分身。
 * Query: ?specialty=finance (可选按专业域过滤)
 *
 * 租户隔离: 只返回 auth.tenantId 下 status='published' 的模板。
 * 外部市场 (origin='external_market') 需经 §19 出站审查后 published, 才会出现在此。
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { getStore } from '@/lib/storage/repository';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const tenantId = auth.tenantId ?? 'default';
  const specialty = new URL(req.url).searchParams.get('specialty');

  const store = getStore();
  const all = await store.agentTemplates.list();
  const templates = all
    .filter((t) => t.tenantId === tenantId && t.status === 'published')
    .filter((t) => !specialty || t.specialty === specialty)
    .map((t) => ({
      id: t.id,
      name: t.name,
      specialty: t.specialty,
      origin: t.origin,
      basePrompt: t.basePrompt,
      defaultKnowledgeTags: t.defaultKnowledgeTags,
    }))
    .sort((a, b) => a.specialty.localeCompare(b.specialty) || a.name.localeCompare(b.name));

  return NextResponse.json({ ok: true, templates });
}
