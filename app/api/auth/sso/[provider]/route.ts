/**
 * GET /api/auth/sso/:provider
 *
 * 发起企业 SSO 登录:
 *   1. 生成 state (防 CSRF)
 *   2. 构建授权 URL
 *   3. 302 跳转到钉钉/企微/飞书授权页
 */

import { NextRequest } from 'next/server';
import { buildAuthUrl, storeSsoState, type SsoProvider } from '@/lib/auth/sso';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_PROVIDERS = new Set<string>(['wecom', 'dingtalk', 'feishu']);

export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  const provider = params.provider;
  if (!VALID_PROVIDERS.has(provider)) {
    return new Response('Unsupported SSO provider', { status: 400 });
  }

  const url = new URL(req.url);
  const redirectUri = `${url.origin}/api/auth/sso/callback`;
  const result = buildAuthUrl(provider as SsoProvider, redirectUri);

  if (!result) {
    return new Response('SSO provider not configured (missing env)', { status: 503 });
  }

  storeSsoState(result.state, provider as SsoProvider, redirectUri);

  return new Response(null, {
    status: 302,
    headers: { Location: result.url },
  });
}
