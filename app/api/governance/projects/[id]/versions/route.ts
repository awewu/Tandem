/**
 * GET  /api/governance/projects/:id/versions       — 列模板版本历史 (新到旧)
 * POST /api/governance/projects/:id/versions/rollback body { version } — 回滚
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { listTemplateVersions } from '@/lib/governance/projects';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const versions = await listTemplateVersions(id);
  return NextResponse.json({ ok: true, versions });
}
