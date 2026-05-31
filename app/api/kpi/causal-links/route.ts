/**
 * KPI 因果链 (B-019 · BSC 战略地图) · collection endpoint
 *
 * GET  ?cycleId=...            列出某周期所有因果链
 * GET  ?cycleId=...&map=1      返回组装好的战略地图 (BSC 四维泳道 + 边)
 * POST                         创建因果链 (kpi.write 权限; 含方向校验 + 环检测)
 *
 * 方向规则: growth → process → customer → financial.
 * 反向/跨维度需 body.allowAnyDirection=true (议事室特批语义).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { hasKpiPermission } from '@/lib/auth/kpi-perms';
import {
  createCausalLink,
  listCausalLinks,
  getStrategyMap,
  CausalLinkError,
} from '@/lib/kpi/causal-links';

export async function GET(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const cycleId = url.searchParams.get('cycleId');
  if (!cycleId) {
    return NextResponse.json({ error: 'cycleId required' }, { status: 400 });
  }

  if (url.searchParams.get('map') === '1') {
    const map = await getStrategyMap(cycleId);
    return NextResponse.json({ map });
  }

  const links = await listCausalLinks(cycleId);
  return NextResponse.json({ links });
}

export async function POST(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  if (!hasKpiPermission(auth, 'kpi.write')) {
    return NextResponse.json(
      { error: 'forbidden', reason: '需 kpi.write 权限 (战略地图设定)' },
      { status: 403 },
    );
  }

  try {
    const body = await req.json();
    if (!body.cycleId || !body.fromKpiId || !body.toKpiId) {
      return NextResponse.json(
        { error: 'required: cycleId, fromKpiId, toKpiId' },
        { status: 400 },
      );
    }

    const link = await createCausalLink({
      cycleId: body.cycleId,
      fromKpiId: body.fromKpiId,
      toKpiId: body.toKpiId,
      strength: typeof body.strength === 'number' ? body.strength : undefined,
      hypothesis: typeof body.hypothesis === 'string' ? body.hypothesis : undefined,
      allowAnyDirection: body.allowAnyDirection === true,
      createdBy: auth.userId,
      tenantId: auth.tenantId,
    });

    return NextResponse.json({ link }, { status: 201 });
  } catch (err) {
    if (err instanceof CausalLinkError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: err.httpStatus });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
