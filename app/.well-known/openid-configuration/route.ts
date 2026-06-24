/**
 * GET /.well-known/openid-configuration — OIDC Discovery 文档
 * 接入方据此自动发现各端点 + JWKS, 无需硬编码。
 */
import { NextResponse, type NextRequest } from 'next/server';
import { resolveIssuer, buildDiscoveryDocument } from '@/lib/oidc/discovery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const issuer = resolveIssuer(req.headers);
  return NextResponse.json(buildDiscoveryDocument(issuer), {
    headers: { 'Cache-Control': 'public, max-age=300' },
  });
}
