/**
 * GET /api/admin/mobile-features
 * PUT /api/admin/mobile-features
 *
 * PC admin page for Android/iOS feature switches.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { getMobileFeatureConfig, upsertMobileFeatureConfig } from '@/lib/settings/mobile-features';
import { MOBILE_FEATURE_META } from '@/lib/types/mobile-features';
import { withApiLog } from '@/lib/api-log/with-api-log';

async function GETApiHandler(req: NextRequest): Promise<NextResponse> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!auth.roles.some((role) => role === 'owner' || role === 'admin')) {
    return NextResponse.json({ error: '仅管理员可访问' }, { status: 403 });
  }

  const config = await getMobileFeatureConfig(auth.tenantId);
  return NextResponse.json({ config, features: MOBILE_FEATURE_META });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/admin/mobile-features' });

async function PUTApiHandler(req: NextRequest): Promise<NextResponse> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!auth.roles.some((role) => role === 'owner' || role === 'admin')) {
    return NextResponse.json({ error: '仅管理员可修改' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体格式错误' }, { status: 400 });
  }

  const input = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const config = await upsertMobileFeatureConfig(
    auth.tenantId,
    {
      enabledFeatures: input.enabledFeatures,
      bottomNav: input.bottomNav,
      dashboardCards: input.dashboardCards,
    },
    auth.userId,
  );
  return NextResponse.json({ config });
}

export const PUT = withApiLog(PUTApiHandler, { route: '/api/admin/mobile-features' });

