/**
 * GET /api/admin/user-applications
 *
 * 列出外部人员注册申请. 仅 owner/admin.
 * ?status=pending|approved|rejected (默认: 全部)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { listApplications } from '@/lib/auth/applications';

export async function GET(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const guard = requireRole(auth, ['owner', 'admin']);
  if (guard) return guard;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') as
    | 'pending'
    | 'approved'
    | 'rejected'
    | null;

  const items = await listApplications({
    status: status ?? undefined,
    tenantId: auth.tenantId,
  });
  return NextResponse.json({ ok: true, items });
}
