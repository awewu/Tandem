/**
 * GET /api/governance/projects/:id/template — 获取项目的三省六部模板
 * PUT /api/governance/projects/:id/template — 整体替换模板 (departments)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import {
  getTemplate,
  saveTemplate,
  GovernanceError,
} from '@/lib/governance/projects';
import type { Department } from '@/lib/types/governance';

const WRITERS = ['manager', 'admin', 'owner', 'champion', 'steward'];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const template = await getTemplate(id);
  if (!template) {
    return NextResponse.json(
      { ok: false, error: '模板不存在', code: 'not_found' },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, template });
}

export async function PUT(
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
  const departments = body.departments;
  if (!Array.isArray(departments)) {
    return NextResponse.json(
      { ok: false, error: 'departments 字段缺失或格式错误' },
      { status: 400 },
    );
  }

  try {
    const template = await saveTemplate(id, departments as Department[], auth.userId);
    return NextResponse.json({ ok: true, template });
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
