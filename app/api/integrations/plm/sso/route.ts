import { createHmac } from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { boot, getStore } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_PLM_URL = 'https://studio.rhautt.com';

function base64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function ssoSecret(): string {
  const secret =
    process.env.PLM_SSO_JWT_SECRET ||
    process.env.TANDEM_SSO_JWT_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.SESSION_SECRET;
  if (!secret) throw new Error('PLM SSO secret is not configured');
  return secret;
}

function signJwt(payload: Record<string, unknown>, secret: string): string {
  const header = base64url({ alg: 'HS256', typ: 'JWT' });
  const body = base64url(payload);
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function stateFor(next: string): string {
  return Buffer.from(JSON.stringify({ next, ts: Date.now() })).toString('base64url');
}

function mapStudioRoles(roles: string[]): string[] {
  const out = new Set<string>();
  if (roles.some((r) => ['owner', 'admin', 'steward', 'champion'].includes(r))) out.add('admin');
  if (roles.some((r) => ['employee', 'manager', 'finance', 'internal_staff'].includes(r))) out.add('engineering');
  if (roles.includes('partner') || roles.includes('contractor')) out.add('product');
  if (out.size === 0) out.add('engineering');
  return Array.from(out);
}

export async function GET(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const store = getStore();
  const user = auth.demo ? null : await store.auth.users.findById(auth.userId);
  const url = new URL(req.url);
  const plmBase = (url.searchParams.get('base') || process.env.PLM_STUDIO_URL || DEFAULT_PLM_URL).replace(/\/$/, '');
  const next = url.searchParams.get('next') || '/';
  if (!next.startsWith('/') || next.startsWith('//')) {
    return NextResponse.json({ error: 'invalid next' }, { status: 400 });
  }

  const token = signJwt(
    {
      sub: auth.userId,
      email: auth.email,
      name: user?.name || auth.email.split('@')[0] || 'Tandem User',
      roles: mapStudioRoles(auth.roles),
      tenantId: auth.tenantId,
      iss: 'hermes-tandem',
      exp: Math.floor(Date.now() / 1000) + 5 * 60,
    },
    ssoSecret(),
  );

  const callback = new URL('/api/auth/sso/callback', plmBase);
  callback.searchParams.set('token', token);
  callback.searchParams.set('state', stateFor(next));
  return NextResponse.redirect(callback.toString());
}
