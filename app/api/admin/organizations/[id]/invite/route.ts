/**
 * POST /api/admin/organizations/:id/invite  ·  给下游组织发邀请码 (Owner/Admin)
 *
 * 邀请码绑定 orgId + membershipType → 被邀请人注册即权威归属该下游组织.
 * 返回 inviteCode 明文 (仅本次), 由邀请者带外发给下游成员.
 *
 * Body: { email?: string, roles?: Role[], ttlHours?: number }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { inviteDownstreamMember, OrgError } from '@/lib/auth/organizations';
import { isRole, type Role } from '@/lib/auth/roles';

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

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  let roles: Role[] | undefined;
  if (Array.isArray(body.roles)) {
    const filtered = (body.roles as unknown[])
      .filter((r): r is string => typeof r === 'string')
      .filter(isRole);
    if (filtered.length === 0) {
      return NextResponse.json({ ok: false, error: 'roles 必须是已注册角色枚举' }, { status: 400 });
    }
    roles = filtered;
  }

  const ttlHours =
    typeof body.ttlHours === 'number' && body.ttlHours > 0 ? body.ttlHours : undefined;

  try {
    const result = await inviteDownstreamMember({
      orgId: id,
      email: body.email ? String(body.email) : undefined,
      roles,
      invitedById: auth.userId,
      ttlHours,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof OrgError) {
      return NextResponse.json({ ok: false, code: err.code, error: err.message }, { status: err.httpStatus });
    }
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
