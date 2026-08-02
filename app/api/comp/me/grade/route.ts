import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { getEmployeeGradeView } from '@/lib/comp/grade-service';
import { COMP_INCOME_COOKIE, hasIncomePin, verifyUnlockToken } from '@/lib/comp/income-lock';

/**
 * GET /api/comp/me/grade
 * 员工侧 (/organization/performance) 看板数据源:
 *   三段薪资构成 + 已认证技能工资 + 当前层级标准(真源Σ) + 下一级缺口。
 * 支持 ?employeeId= (仅管理角色查他人; 默认查本人)。
 */
async function GETApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const target = searchParams.get('employeeId');
  const MANAGER_ROLES = ['manager', 'steward', 'admin', 'owner'];
  const canViewOthers = auth.roles.some((r) => MANAGER_ROLES.includes(r));
  const employeeId = target && canViewOthers ? target : auth.userId;

  // 收入二次密码闸门: 查看本人收入需先解锁 (独立于登录)。
  if (employeeId === auth.userId) {
    const unlocked = verifyUnlockToken(req.cookies.get(COMP_INCOME_COOKIE)?.value, auth.userId);
    if (!unlocked) {
      const hasPin = await hasIncomePin(auth.userId);
      return NextResponse.json({ locked: true, hasPin });
    }
  }

  try {
    const view = await getEmployeeGradeView(auth.tenantId, employeeId);
    return NextResponse.json({ view });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const GET = withApiLog(GETApiHandler, { route: '/api/comp/me/grade' });
