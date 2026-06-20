/**
 * PATCH /api/360/cycles/[id]   — update fields (status active/closed 等)
 *   仅 admin/hr/champion/createdBy
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getStore, boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { DATA_STEWARD_ROLES } from '@/lib/auth/roles';
import { withTenantScope } from '@/lib/multi-tenant/with-tenant-scope';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const store = getStore();
  const cycles = withTenantScope(store.review360Cycles, auth.tenantId);
  const cycle = await cycles.get(params.id);
  if (!cycle) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  const isPriv =
    auth.demo ||
    cycle.createdBy === auth.userId ||
    auth.roles.some((r) => ([...DATA_STEWARD_ROLES, 'champion'] as string[]).includes(r));
  if (!isPriv) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  try {
    const body = await req.json();
    const allowed = ['name', 'status', 'startDate', 'endDate', 'anonymizePeers', 'questions'];
    const patch: Record<string, unknown> = {};
    for (const k of allowed) if (k in body) patch[k] = body[k];
    patch.updatedAt = new Date().toISOString();
    const updated = await cycles.update(params.id, patch);
    return NextResponse.json({ cycle: updated });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
