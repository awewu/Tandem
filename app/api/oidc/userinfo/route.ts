/**
 * GET|POST /api/oidc/userinfo — OIDC UserInfo 端点
 *
 * 持 Bearer access_token (本 IdP 颁发的 RS256 JWT) 获取按 scope 解析的用户 claims.
 * 这是其他项目同步"组织结构 / 角色 / 通讯录"的标准入口。
 */
import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { verifyAccessToken } from '@/lib/oidc/tokens';
import { buildClaimsForUserId } from '@/lib/oidc/claims';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function bearer(req: NextRequest): string | null {
  const authz = req.headers.get('authorization');
  if (authz?.startsWith('Bearer ')) return authz.slice(7).trim();
  return null;
}

async function handle(req: NextRequest): Promise<NextResponse> {
  await boot();
  const token = bearer(req);
  if (!token) {
    return NextResponse.json(
      { error: 'invalid_token', error_description: 'Bearer access token required' },
      { status: 401, headers: { 'WWW-Authenticate': 'Bearer error="invalid_token"' } },
    );
  }
  const payload = await verifyAccessToken(token);
  if (!payload) {
    return NextResponse.json(
      { error: 'invalid_token', error_description: 'token invalid or expired' },
      { status: 401, headers: { 'WWW-Authenticate': 'Bearer error="invalid_token"' } },
    );
  }
  const scopes = (payload.scope ?? '').split(/\s+/).filter(Boolean);
  const claims = await buildClaimsForUserId(payload.sub, scopes);
  if (!claims) {
    return NextResponse.json({ error: 'invalid_token', error_description: 'user not found' }, { status: 401 });
  }
  return NextResponse.json(claims, { headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
