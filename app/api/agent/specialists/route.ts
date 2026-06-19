/**
 * /api/agent/specialists · 具名专家子代理 (借鉴 Claude Code subagent 模式)
 *
 * GET  → 列出所有专家定义 (id / name / description / scenario / toolset / zoneHint)
 * POST → 派生一个专家执行子任务
 *        body: { task: string, specialistId?: string, parentSystemHint?: string }
 *        - specialistId 缺省时按 task 关键词自动匹配
 *        - 复用 spawnSubagent 运行时 + skillRegistry 5 道权限守门
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { boot } from '@/lib/boot';
import { listSpecialists } from '@/lib/agent-runtime/agent-definitions';
import { spawnSpecialist } from '@/lib/agent-runtime/subagent';
import { audit } from '@/lib/audit/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const specialists = listSpecialists().map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    keywords: s.keywords,
    scenario: s.scenario,
    toolset: s.toolset,
    maxSteps: s.maxSteps,
    zoneHint: s.zoneHint,
  }));

  return NextResponse.json({ ok: true, specialists, count: specialists.length });
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  const task = String(body.task ?? '').trim();
  if (!task) {
    return NextResponse.json({ ok: false, error: 'task required' }, { status: 400 });
  }
  const specialistId =
    typeof body.specialistId === 'string' && body.specialistId.trim()
      ? body.specialistId.trim()
      : undefined;
  const parentSystemHint =
    typeof body.parentSystemHint === 'string' ? body.parentSystemHint : undefined;

  // boot 确保 router + skills 已注册 (专家派生要调 LLM + skill)
  await boot();

  const result = await spawnSpecialist({
    task,
    specialistId,
    parentSystemHint,
    actorUserId: auth.userId,
    tenantId: auth.tenantId,
  });

  await audit('agent.spawned', auth.userId, {
    targetType: 'agent',
    metadata: {
      kind: 'specialist',
      specialistId: result.specialist?.id ?? specialistId ?? '(unmatched)',
      matchReason: result.matchReason,
      ok: result.ok,
      tokensUsed: result.tokensUsed,
    },
  });

  // 无匹配 = 400 (调用方该显式指定); 其余皆 200 (含子任务内部失败, 由 ok 字段表达)
  if (result.matchReason === 'no_match') {
    return NextResponse.json(
      { ok: false, error: result.error, summary: result.summary, specialist: null },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: result.ok,
    specialist: result.specialist,
    matchReason: result.matchReason,
    summary: result.summary,
    tokensUsed: result.tokensUsed,
    latencyMs: result.latencyMs,
    error: result.error,
  });
}
