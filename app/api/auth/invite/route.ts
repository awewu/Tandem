import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { COOKIE_ACCESS, verifyAccessToken } from '@/lib/auth/session';
import { getStore } from '@/lib/storage/repository';
import { generateInviteCode, defaultExpiry } from '@/lib/auth/invite';

/**
 * POST /api/auth/invite
 * Body: { email?: string, presetRoles?: string[], departmentId?: string, maxUses?: number, validHours?: number, note?: string }
 *
 * 仅 admin / manager 角色可创建邀请码.
 * 返回明文邀请码 (仅一次, 务必给受邀者).
 */
export async function POST(req: NextRequest) {
  await boot();
  const at = req.cookies.get(COOKIE_ACCESS)?.value;
  const payload = at ? verifyAccessToken(at) : null;
  if (!payload) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });

  const isAdmin = payload.roles.some((r) => r === 'admin' || r === 'manager' || r === 'owner');
  if (!isAdmin) {
    return NextResponse.json({ ok: false, error: '需要 admin / manager / owner 角色' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    presetRoles?: string[];
    departmentId?: string;
    maxUses?: number;
    validHours?: number;
    note?: string;
  };

  const { plainCode, codeHash } = generateInviteCode();
  const invite = await getStore().auth.invites.create({
    codeHash,
    email: body.email?.toLowerCase() ?? null,
    presetRoles: body.presetRoles ?? [],
    presetDepartmentId: body.departmentId ?? null,
    tenantId: payload.tenantId,
    invitedById: payload.sub,
    maxUses: body.maxUses ?? 1,
    expiresAt: defaultExpiry(body.validHours ?? 168).toISOString(),
  });

  await getStore().auth.events.append({
    userId: payload.sub,
    eventType: 'invite_created',
    metadata: { inviteId: invite.id, email: body.email, note: body.note },
  });

  return NextResponse.json({
    ok: true,
    /** 仅此一次明文返回 */
    code: plainCode,
    inviteId: invite.id,
    expiresAt: invite.expiresAt,
  });
}

/**
 * GET /api/auth/invite
 * 列出当前用户发出的邀请码 (不返回明文)
 */
export async function GET(req: NextRequest) {
  await boot();
  const at = req.cookies.get(COOKIE_ACCESS)?.value;
  const payload = at ? verifyAccessToken(at) : null;
  if (!payload) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });

  const list = await getStore().auth.invites.list({ invitedById: payload.sub });
  return NextResponse.json({
    invites: list.map((i) => ({
      id: i.id,
      email: i.email,
      presetRoles: i.presetRoles,
      maxUses: i.maxUses,
      usedCount: i.usedCount,
      expiresAt: i.expiresAt,
      redeemedAt: i.redeemedAt,
    })),
  });
}
