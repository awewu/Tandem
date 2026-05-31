/**
 * POST /api/admin/user-applications/:id/approve
 *
 * Owner/Admin 审批通过 → 生成单次邀请码 (与申请邮箱绑定, 72h 内有效).
 * 返回 inviteCode 明文 (仅本次), 由审批者带外发给申请人.
 *
 * Body: { grantedRoles?: Role[], decisionNote?: string }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { approveApplication, ApplicationError } from '@/lib/auth/applications';
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

  let grantedRoles: Role[] | undefined;
  if (Array.isArray(body.grantedRoles)) {
    const raw = body.grantedRoles as unknown[];
    const filtered = raw.filter((r): r is string => typeof r === 'string').filter(isRole);
    if (filtered.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'grantedRoles 必须是已注册角色枚举' },
        { status: 400 },
      );
    }
    grantedRoles = filtered;
  }

  try {
    const result = await approveApplication({
      applicationId: id,
      approverId: auth.userId,
      grantedRoles,
      decisionNote: body.decisionNote ? String(body.decisionNote) : undefined,
    });
    return NextResponse.json({
      ok: true,
      application: result.application,
      inviteCode: result.inviteCode,
      inviteExpiresAt: result.inviteExpiresAt,
    });
  } catch (err) {
    if (err instanceof ApplicationError) {
      return NextResponse.json(
        { ok: false, code: err.code, error: err.message },
        { status: err.httpStatus },
      );
    }
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
