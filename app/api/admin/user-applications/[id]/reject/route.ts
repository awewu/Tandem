/**
 * POST /api/admin/user-applications/:id/reject
 *
 * Owner/Admin 拒绝外部人员申请.
 * Body: { decisionNote?: string }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { rejectApplication, ApplicationError } from '@/lib/auth/applications';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const guard = requireRole(auth, ['owner', 'admin']);
  if (guard) return guard;
  const { id } = await params;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  try {
    const app = await rejectApplication({
      applicationId: id,
      approverId: auth.userId,
      decisionNote: body.decisionNote ? String(body.decisionNote) : undefined,
    });
    return NextResponse.json({ ok: true, application: app });
  } catch (err) {
    if (err instanceof ApplicationError) {
      return NextResponse.json(
        { ok: false, code: err.code, error: err.message },
        { status: err.httpStatus },
      );
    }
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
