/**
 * GET /api/analytics/okr-kpi-consistency?cycleId=...
 *
 * OKR-KPI 一致性体检 (机会#2): 检查每个 Objective 是否锚定到营收硬 KPI,
 * KR→KPI 锚定覆盖率, 悬空锚, 输出一致性得分与不一致清单。只读, manager+。
 */
import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { getStore } from '@/lib/storage/repository';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { computeOkrKpiConsistency } from '@/lib/domain/analytics/okr-kpi-consistency';

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, ['manager', 'admin', 'champion', 'steward']);
  if (forbidden) return forbidden;
  try {
    await boot();
    const { searchParams } = new URL(req.url);
    const cycleId = searchParams.get('cycleId');
    const store = getStore();
    const result = await computeOkrKpiConsistency(
      store,
      auth.tenantId,
      cycleId && cycleId !== 'all' ? cycleId : null,
    );
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
