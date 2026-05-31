/**
 * KPI 因果链 (B-019) · single-item endpoint
 *
 * PATCH  改 strength/hypothesis, 或年终复盘验证 (validate=true/false)
 * DELETE 删除因果链
 *
 * 均需 kpi.write 权限 (战略地图设定).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { hasKpiPermission } from '@/lib/auth/kpi-perms';
import {
  updateCausalLink,
  validateCausalLink,
  deleteCausalLink,
  CausalLinkError,
} from '@/lib/kpi/causal-links';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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

    // 验证模式: body.validate 显式存在 → 走年终复盘验证
    if (typeof body.validate === 'boolean') {
      const link = await validateCausalLink({
        id: params.id,
        actorId: auth.userId,
        validated: body.validate,
        validationNote: typeof body.validationNote === 'string' ? body.validationNote : undefined,
      });
      return NextResponse.json({ link });
    }

    const link = await updateCausalLink({
      id: params.id,
      actorId: auth.userId,
      strength: typeof body.strength === 'number' ? body.strength : undefined,
      hypothesis: typeof body.hypothesis === 'string' ? body.hypothesis : undefined,
    });
    return NextResponse.json({ link });
  } catch (err) {
    if (err instanceof CausalLinkError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: err.httpStatus });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
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
    await deleteCausalLink(params.id, auth.userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof CausalLinkError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: err.httpStatus });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
