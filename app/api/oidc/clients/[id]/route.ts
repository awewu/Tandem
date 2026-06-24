/**
 * PATCH  /api/oidc/clients/[id] — 更新接入方
 * DELETE /api/oidc/clients/[id] — 删除接入方
 *
 * action=rotate_secret (PATCH body) → 重置并返回新 client_secret (一次性)。
 * 仅 owner/admin。
 */
import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { updateClient, deleteClient, rotateSecret, getClient, publicClientView } from '@/lib/oidc/clients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SSO_ADMIN_ROLES = ['owner', 'admin'];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, SSO_ADMIN_ROLES);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => ({}));

  if (body.action === 'rotate_secret') {
    try {
      const secret = await rotateSecret(params.id, auth.tenantId);
      return NextResponse.json({ clientSecret: secret });
    } catch (err) {
      const m = (err as Error).message;
      return NextResponse.json({ error: m }, { status: m.includes('not found') ? 404 : 400 });
    }
  }

  try {
    const patch: Record<string, unknown> = {};
    if (body.name !== undefined) patch.name = String(body.name).trim();
    if (body.description !== undefined) patch.description = body.description;
    if (body.redirectUris !== undefined) patch.redirectUris = body.redirectUris;
    if (body.postLogoutRedirectUris !== undefined) patch.postLogoutRedirectUris = body.postLogoutRedirectUris;
    if (body.allowedScopes !== undefined) patch.allowedScopes = body.allowedScopes;
    if (body.skipConsent !== undefined) patch.skipConsent = !!body.skipConsent;
    if (body.disabled !== undefined) patch.disabled = !!body.disabled;
    const client = await updateClient(params.id, auth.tenantId, patch);
    return NextResponse.json({ client: publicClientView(client) });
  } catch (err) {
    const m = (err as Error).message;
    return NextResponse.json({ error: m }, { status: m.includes('not found') ? 404 : 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, SSO_ADMIN_ROLES);
  if (forbidden) return forbidden;
  const existing = await getClient(params.id, auth.tenantId);
  if (!existing) return NextResponse.json({ error: 'client not found' }, { status: 404 });
  await deleteClient(params.id, auth.tenantId);
  return NextResponse.json({ ok: true });
}
