import { NextResponse, type NextRequest } from 'next/server';
import { boot, getRouter } from '@/lib/boot';
import { spawnAgent, spawnAgentAsync } from '@/lib/taf/agent/spawn';
import { audit } from '@/lib/audit/log';

/**
 * POST /api/agent/spawn
 *
 * Body: {
 *   task: string,
 *   mode?: 'fork' | 'fresh' | 'parallel',
 *   scenario?: string,
 *   allowedSkillIds?: string[],
 *   parentMessages?: ChatMessage[],
 *   budget?: number,
 *   maxSteps?: number,
 *   async?: boolean,
 *   userId?: string,
 *   isProxy?: boolean
 * }
 */
export async function POST(req: NextRequest) {
  await boot();
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

  const router = getRouter();
  const userId = String(body.userId ?? 'demo_user');

  await audit('agent.spawned', userId, {
    targetType: 'agent',
    metadata: { task, mode: body.mode ?? 'fresh' },
  });

  const input = {
    task,
    mode: (body.mode as 'fork' | 'fresh' | 'parallel') ?? 'fresh',
    scenario: body.scenario as never,
    allowedSkillIds: body.allowedSkillIds as string[] | undefined,
    parentMessages: body.parentMessages as never,
    budget: body.budget as number | undefined,
    maxSteps: body.maxSteps as number | undefined,
    ctx: {
      userId,
      tenantId: String(body.tenantId ?? 'default'),
      isProxy: Boolean(body.isProxy),
    },
  };

  if (body.async) {
    const { agentId } = spawnAgentAsync(router, input);
    return NextResponse.json({ ok: true, agentId, async: true });
  }

  const result = await spawnAgent(router, input);
  await audit('agent.completed', userId, {
    targetId: result.agentId,
    targetType: 'agent',
    metadata: { reason: result.reason, tokensUsed: result.tokensUsed, steps: result.steps },
  });

  return NextResponse.json({ ok: true, ...result });
}
