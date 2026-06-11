/**
 * GET /api/analytics/cross-rollup?cycleId=...
 *
 * 四维错配看板 (机会#5): 在「人」上对齐 OKR/KPI/9宫格/奖金, 返回:
 *   - overall: 全公司四维错配得分 + 奖金池就绪度
 *   - units:   各事业部错配得分排行
 *   - topRisks: 错配最严重的人 (含具体信号)
 *
 * 只读, 权限 manager+ (与 9-box 一致)。
 */
import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { getStore } from '@/lib/storage/repository';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { computeCrossRollup } from '@/lib/domain/analytics/cross-rollup';

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
    const result = await computeCrossRollup(store, auth.tenantId, cycleId && cycleId !== 'all' ? cycleId : null);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
