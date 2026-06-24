/**
 * GET  /api/oidc/clients — 列出本租户已注册的 SSO 接入方
 * POST /api/oidc/clients — 注册新接入方 (返回一次性 client_secret)
 *
 * 仅 owner/admin 可管理 (SSO 接入方是高敏配置)。
 */
import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { listClients, createClient, publicClientView } from '@/lib/oidc/clients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SSO_ADMIN_ROLES = ['owner', 'admin'];

export async function GET(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, SSO_ADMIN_ROLES);
  if (forbidden) return forbidden;
  const clients = await listClients(auth.tenantId);
  return NextResponse.json({ clients: clients.map(publicClientView) });
}

export async function POST(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, SSO_ADMIN_ROLES);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => ({}));
  if (!body.name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });
  if (!Array.isArray(body.redirectUris) || body.redirectUris.length === 0) {
    return NextResponse.json({ error: 'redirectUris required' }, { status: 400 });
  }
  try {
    const { client, secret } = await createClient({
      name: body.name,
      description: body.description,
      type: body.type === 'public' ? 'public' : 'confidential',
      redirectUris: body.redirectUris,
      postLogoutRedirectUris: Array.isArray(body.postLogoutRedirectUris) ? body.postLogoutRedirectUris : [],
      allowedScopes: Array.isArray(body.allowedScopes) ? body.allowedScopes : undefined,
      skipConsent: body.skipConsent !== false,
      tenantId: auth.tenantId,
      createdBy: auth.userId,
    });
    // client_secret 仅此一次明文返回
    return NextResponse.json({ client: publicClientView(client), clientSecret: secret }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
