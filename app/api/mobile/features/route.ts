/**
 * GET /api/mobile/features — current viewer's mobile App feature config.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { getMobileFeatureConfig } from '@/lib/settings/mobile-features';
import { MOBILE_FEATURE_META } from '@/lib/types/mobile-features';
import { withApiLog } from '@/lib/api-log/with-api-log';

async function GETApiHandler(req: NextRequest): Promise<NextResponse> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const config = await getMobileFeatureConfig(auth.tenantId);
  return NextResponse.json({ config, features: MOBILE_FEATURE_META });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/mobile/features' });

