/**
 * GET /api/legal/privacy-policy
 *
 * Public legal document endpoint shared by Tandem and the standalone Shouchao App.
 */

import { NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { getEffectivePrivacyPolicy } from '@/lib/legal/privacy-policy';
import { withApiLog } from '@/lib/api-log/with-api-log';

export const runtime = 'nodejs';

async function GETApiHandler(): Promise<NextResponse> {
  await boot();
  const policy = await getEffectivePrivacyPolicy();
  return NextResponse.json({ policy });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/legal/privacy-policy' });
