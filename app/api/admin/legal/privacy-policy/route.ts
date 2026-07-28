/**
 * GET /api/admin/legal/privacy-policy
 * PUT /api/admin/legal/privacy-policy
 *
 * Admin-managed privacy policy for Tandem and the standalone Shouchao App.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { getAdminPrivacyPolicy, upsertPrivacyPolicy } from '@/lib/legal/privacy-policy';
import { withApiLog } from '@/lib/api-log/with-api-log';

function canManageLegalDocuments(roles: string[]): boolean {
  return roles.some((role) => role === 'owner' || role === 'admin');
}

async function GETApiHandler(req: NextRequest): Promise<NextResponse> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!canManageLegalDocuments(auth.roles)) {
    return NextResponse.json({ error: '仅管理员可访问' }, { status: 403 });
  }

  const policy = await getAdminPrivacyPolicy();
  return NextResponse.json({ policy });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/admin/legal/privacy-policy' });

async function PUTApiHandler(req: NextRequest): Promise<NextResponse> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!canManageLegalDocuments(auth.roles)) {
    return NextResponse.json({ error: '仅管理员可修改' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体格式错误' }, { status: 400 });
  }

  try {
    const input = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const policy = await upsertPrivacyPolicy(input, auth.userId);
    return NextResponse.json({ policy });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '保存失败' },
      { status: 400 },
    );
  }
}

export const PUT = withApiLog(PUTApiHandler, { route: '/api/admin/legal/privacy-policy' });
