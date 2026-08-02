import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { DATA_STEWARD_ROLES } from '@/lib/auth/roles';
import { getFamilySkillMatrix, updateSkillWage } from '@/lib/comp/admin-service';

/** GET /api/comp/admin/skills?familyId= — 岗族技能矩阵 + 逐级 Σ定价 */
async function GETApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, DATA_STEWARD_ROLES);
  if (forbidden) return forbidden;

  const familyId = new URL(req.url).searchParams.get('familyId');
  if (!familyId) return NextResponse.json({ error: 'familyId required' }, { status: 400 });

  try {
    const matrix = await getFamilySkillMatrix(auth.tenantId, familyId);
    return NextResponse.json({ matrix });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const GET = withApiLog(GETApiHandler, { route: '/api/comp/admin/skills' });

/** PATCH /api/comp/admin/skills — 改价 (真源) → 刷新带宽缓存 */
async function PATCHApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, DATA_STEWARD_ROLES);
  if (forbidden) return forbidden;

  const body = await req.json();
  const skillId = String(body.skillId ?? '');
  const skillWage = Number(body.skillWage);
  if (!skillId || !Number.isFinite(skillWage)) {
    return NextResponse.json({ error: 'skillId and numeric skillWage required' }, { status: 400 });
  }

  try {
    const result = await updateSkillWage(auth.tenantId, skillId, skillWage);
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const PATCH = withApiLog(PATCHApiHandler, { route: '/api/comp/admin/skills' });
