/**
 * POST /api/workspaces/switch
 *
 * 切换当前用户的 workspace，重新签发 access token.
 * Body: { workspaceId: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { getStore } from '@/lib/storage/repository';
import { COOKIE_ACCESS, SESSION_COOKIE_OPTIONS, signAccessToken } from '@/lib/auth/session';
import { error } from '@/app/api/_common/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    await boot();
    const store = getStore();
    const body = (await req.json()) as { workspaceId?: string };
    const workspaceId = body.workspaceId;
    if (!workspaceId) {
      return error('workspaceId required', 400);
    }

    const workspace = await store.workspaces.get(workspaceId);
    if (!workspace) {
      return error('Workspace not found', 404);
    }

    // Resolve current user from cookie
    const at = req.cookies.get(COOKIE_ACCESS)?.value;
    if (!at) {
      return error('unauthenticated', 401);
    }

    // We need the userId from the token; verify it via session store
    const { verifyAccessToken } = await import('@/lib/auth/session');
    const payload = verifyAccessToken(at);
    if (!payload) {
      return error('invalid token', 401);
    }

    const user = await store.auth.users.findById(payload.sub);
    if (!user) {
      return error('User not found', 404);
    }

    // Update user's workspace
    await store.auth.users.update(user.id, { workspaceId });

    // Re-issue access token with new workspaceId
    const newToken = signAccessToken({
      sub: user.id,
      email: user.email,
      roles: user.roles ?? [],
      tenantId: user.tenantId ?? 'default',
      workspaceId,
      mfa: payload.mfa,
      sid: payload.sid,
    });

    const res = NextResponse.json({ ok: true, workspace: { id: workspace.id, name: workspace.name } });
    res.cookies.set(COOKIE_ACCESS, newToken, {
      ...SESSION_COOKIE_OPTIONS,
      expires: new Date(Date.now() + 15 * 60 * 1000),
    });
    return res;
  } catch (err: any) {
    console.error('[workspaces/switch]', err);
    return error(err?.message || 'Failed', 500);
  }
}
