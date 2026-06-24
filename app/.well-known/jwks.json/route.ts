/**
 * GET /.well-known/jwks.json — OIDC 公钥集 (JWKS)
 * 接入方用此验证 id_token / access_token 的 RS256 签名。
 */
import { NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { getJwks } from '@/lib/oidc/keys';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  await boot();
  const jwks = await getJwks();
  return NextResponse.json(jwks, {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  });
}
