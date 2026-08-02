import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { DATA_STEWARD_ROLES } from '@/lib/auth/roles';
import {
  listCertifications,
  listPendingCertifications,
  submitCertification,
  reviewCertification,
} from '@/lib/comp/certification-service';

/**
 * GET /api/comp/me/certifications — 员工查自己的认证记录
 * GET /api/comp/admin/certifications — HR 查待审批列表
 *
 * 本路由处理员工侧 (me). admin 侧在 /api/comp/admin/certifications.
 */
async function GETApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const status = url.searchParams.get('status') ?? undefined;

  try {
    const rows = await listCertifications(
      auth.tenantId,
      auth.userId,
      status as '待认证' | '已认证' | '已驳回' | undefined,
    );
    return NextResponse.json({ rows });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const GET = withApiLog(GETApiHandler, { route: '/api/comp/me/certifications' });

/**
 * POST /api/comp/me/certifications — 员工提交认证申请
 *   { familyId, skillId, evidence }
 */
async function POSTApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  if (!body.familyId || !body.skillId || !body.evidence) {
    return NextResponse.json(
      { error: 'familyId, skillId, evidence required' },
      { status: 400 },
    );
  }

  try {
    const result = await submitCertification({
      tenantId: auth.tenantId,
      employeeId: auth.userId,
      familyId: body.familyId,
      skillId: body.skillId,
      evidence: String(body.evidence),
    });
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const POST = withApiLog(POSTApiHandler, { route: '/api/comp/me/certifications' });
