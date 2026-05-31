/**
 * GET  /api/governance/projects[?status=draft|active|archived]  — 列出战略项目
 * POST /api/governance/projects                                  — 新建项目 (复制模板)
 *
 * 任何登录用户可读 (协同需要), 仅 manager+ 可写.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import {
  createProject,
  listProjects,
  GovernanceError,
} from '@/lib/governance/projects';
import type { GovernanceProjectStatus } from '@/lib/types/governance';

export async function GET(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') as GovernanceProjectStatus | null;
  const items = await listProjects({
    status: status ?? undefined,
    tenantId: auth.tenantId,
  });
  return NextResponse.json({ ok: true, items });
}

export async function POST(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const guard = requireRole(auth, ['manager', 'admin', 'owner', 'champion', 'steward']);
  if (guard) return guard;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  try {
    const result = await createProject({
      name: String(body.name ?? ''),
      description: body.description ? String(body.description) : undefined,
      ownerId: body.ownerId ? String(body.ownerId) : undefined,
      northStar: body.northStar ? String(body.northStar) : undefined,
      primaryObjectiveId: body.primaryObjectiveId ? String(body.primaryObjectiveId) : undefined,
      noOkrReason: body.noOkrReason ? String(body.noOkrReason) : undefined,
      copyFromProjectId: body.copyFromProjectId ? String(body.copyFromProjectId) : undefined,
      createdBy: auth.userId,
      tenantId: auth.tenantId,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof GovernanceError) {
      return NextResponse.json(
        { ok: false, code: err.code, error: err.message },
        { status: err.httpStatus },
      );
    }
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
