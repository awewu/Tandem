import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { DATA_STEWARD_ROLES } from '@/lib/auth/roles';
import {
  listEmployeeGrades,
  listAssignableEmployees,
  assignGrade,
  type AssignInput,
} from '@/lib/comp/assignment-service';

/** GET /api/comp/admin/assignments — 员工定级列表 + 可分配员工 */
async function GETApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, DATA_STEWARD_ROLES);
  if (forbidden) return forbidden;

  try {
    const [grades, employees] = await Promise.all([
      listEmployeeGrades(auth.tenantId),
      listAssignableEmployees(auth.tenantId),
    ]);
    return NextResponse.json({ grades, employees });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const GET = withApiLog(GETApiHandler, { route: '/api/comp/admin/assignments' });

/** POST /api/comp/admin/assignments — 分配/更新员工职级 */
async function POSTApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, DATA_STEWARD_ROLES);
  if (forbidden) return forbidden;

  const body = (await req.json().catch(() => ({}))) as Partial<AssignInput>;
  if (!body.employeeId || !body.familyId || !body.jobClass || !body.level || !body.taskGear) {
    return NextResponse.json(
      { error: 'employeeId, familyId, jobClass, level, taskGear 必填' },
      { status: 400 },
    );
  }

  try {
    const result = await assignGrade(auth.tenantId, {
      employeeId: body.employeeId,
      familyId: body.familyId,
      jobClass: body.jobClass,
      level: body.level,
      taskGear: body.taskGear,
      education: body.education,
      experience: body.experience,
    });
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const POST = withApiLog(POSTApiHandler, { route: '/api/comp/admin/assignments' });
