/**
 * PATCH  /api/governance/projects/:id  — 修改项目元信息 / 状态
 * DELETE /api/governance/projects/:id  — 删除 (非 default)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import {
  updateProject,
  deleteProject,
  GovernanceError,
} from '@/lib/governance/projects';
import type { GovernanceProjectStatus } from '@/lib/types/governance';

const WRITERS = ['manager', 'admin', 'owner', 'champion', 'steward'];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const guard = requireRole(auth, WRITERS);
  if (guard) return guard;
  const { id } = await params;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  try {
    const updated = await updateProject(id, {
      name: body.name ? String(body.name) : undefined,
      description: body.description !== undefined ? String(body.description) : undefined,
      status: body.status ? (String(body.status) as GovernanceProjectStatus) : undefined,
      ownerId: body.ownerId !== undefined ? String(body.ownerId) : undefined,
      northStar: body.northStar !== undefined ? String(body.northStar) : undefined,
      primaryObjectiveId:
        body.primaryObjectiveId === null
          ? null
          : body.primaryObjectiveId !== undefined
            ? String(body.primaryObjectiveId)
            : undefined,
      noOkrReason:
        body.noOkrReason === null
          ? null
          : body.noOkrReason !== undefined
            ? String(body.noOkrReason)
            : undefined,
      updatedBy: auth.userId,
    });
    return NextResponse.json({ ok: true, project: updated });
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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const guard = requireRole(auth, ['admin', 'owner', 'champion']);
  if (guard) return guard;
  const { id } = await params;

  try {
    await deleteProject(id, auth.userId);
    return NextResponse.json({ ok: true });
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
