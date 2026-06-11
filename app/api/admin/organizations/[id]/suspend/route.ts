/**
 * POST /api/admin/organizations/:id/suspend  ·  停用下游组织 (Owner/Admin)
 *
 * 停用后该组织不能再邀请新成员 (已存在成员的会话另行治理).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { suspendOrg, OrgError } from '@/lib/auth/organizations';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const guard = requireRole(auth, ['owner', 'admin']);
  if (guard) return guard;
  const { id } = await params;

  try {
    const org = await suspendOrg(id, auth.userId);
    return NextResponse.json({ ok: true, organization: org });
  } catch (err) {
    if (err instanceof OrgError) {
      return NextResponse.json({ ok: false, code: err.code, error: err.message }, { status: err.httpStatus });
    }
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
