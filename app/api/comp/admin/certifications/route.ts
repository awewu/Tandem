import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { DATA_STEWARD_ROLES } from '@/lib/auth/roles';
import {
  listPendingCertifications,
  reviewCertification,
} from '@/lib/comp/certification-service';

/**
 * GET /api/comp/admin/certifications — HR 查待审批认证列表
 */
async function GETApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, DATA_STEWARD_ROLES);
  if (forbidden) return forbidden;

  try {
    const rows = await listPendingCertifications(auth.tenantId);
    return NextResponse.json({ rows });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const GET = withApiLog(GETApiHandler, { route: '/api/comp/admin/certifications' });

/**
 * PATCH /api/comp/admin/certifications — HR 审批认证
 *   { certId, approved: boolean }
 */
async function PATCHApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, DATA_STEWARD_ROLES);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => ({}));
  const certId = String(body.certId ?? '');
  const approved = Boolean(body.approved);

  if (!certId) {
    return NextResponse.json({ error: 'certId required' }, { status: 400 });
  }

  try {
    await reviewCertification(auth.tenantId, certId, approved, auth.userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const PATCH = withApiLog(PATCHApiHandler, { route: '/api/comp/admin/certifications' });
