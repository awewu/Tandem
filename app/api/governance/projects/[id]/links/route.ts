/**
 * POST   /api/governance/projects/:id/links  body { kind, targetId } — 关联 OKR/决议
 * DELETE /api/governance/projects/:id/links?kind=...&targetId=...   — 取消关联
 *
 * 软链接: kind = 'objective' | 'decision'
 *   - objective: 客户端 zustand OKR (无 FK 校验)
 *   - decision : DecisionCard (UI 加载时校验存在性)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import {
  addLink,
  removeLink,
  GovernanceError,
  type LinkKind,
} from '@/lib/governance/projects';

const WRITERS = ['manager', 'admin', 'owner', 'champion', 'steward'];

function parseKind(raw: unknown): LinkKind | null {
  if (raw === 'objective' || raw === 'decision') return raw;
  return null;
}

export async function POST(
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
  const kind = parseKind(body.kind);
  if (!kind) {
    return NextResponse.json(
      { ok: false, error: 'kind 必须是 objective 或 decision' },
      { status: 400 },
    );
  }
  const targetId = String(body.targetId ?? '').trim();
  if (!targetId) {
    return NextResponse.json({ ok: false, error: 'targetId 不能为空' }, { status: 400 });
  }

  try {
    const project = await addLink(id, kind, targetId, auth.userId);
    return NextResponse.json({ ok: true, project });
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
  const guard = requireRole(auth, WRITERS);
  if (guard) return guard;
  const { id } = await params;

  const { searchParams } = new URL(req.url);
  const kind = parseKind(searchParams.get('kind'));
  const targetId = (searchParams.get('targetId') ?? '').trim();
  if (!kind || !targetId) {
    return NextResponse.json(
      { ok: false, error: 'kind 与 targetId 必填' },
      { status: 400 },
    );
  }

  try {
    const project = await removeLink(id, kind, targetId, auth.userId);
    return NextResponse.json({ ok: true, project });
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
