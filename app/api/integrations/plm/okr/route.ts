import { NextResponse, type NextRequest } from 'next/server';
import { boot, getStore } from '@/lib/boot';
import { verifyAccessToken } from '@/lib/oidc/tokens';
import { withTenantScope } from '@/lib/multi-tenant/with-tenant-scope';
import { resolveOkrVisibleOwnerIds } from '@/lib/okr/visibility';
import type { AuthContext } from '@/lib/auth/require-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function bearer(req: NextRequest): string | null {
  const authz = req.headers.get('authorization');
  if (authz?.startsWith('Bearer ')) return authz.slice(7).trim();
  return null;
}

export async function GET(req: NextRequest) {
  await boot();
  const token = bearer(req);
  if (!token) {
    return NextResponse.json({ error: 'Bearer access token required' }, { status: 401 });
  }

  const payload = await verifyAccessToken(token);
  if (!payload) {
    return NextResponse.json({ error: 'token invalid or expired' }, { status: 401 });
  }

  const store = getStore();
  const user = await store.auth.users.findById(payload.sub);
  if (!user || user.disabled) {
    return NextResponse.json({ error: 'user not found' }, { status: 401 });
  }

  const auth: AuthContext = {
    userId: user.id,
    email: user.email,
    tenantId: payload.tenant || user.tenantId || 'default',
    roles: user.roles || [],
    mfaVerified: false,
    demo: false,
  };

  const { searchParams } = new URL(req.url);
  const cycleId = searchParams.get('cycleId');
  const ownerId = searchParams.get('ownerId');

  let objectives = await withTenantScope(store.objectives, auth.tenantId).list();
  if (cycleId) objectives = objectives.filter((o) => o.cycleId === cycleId);
  if (ownerId) objectives = objectives.filter((o) => o.ownerId === ownerId);

  const allKrs = await withTenantScope(store.keyResults, auth.tenantId).list();
  const visible = await resolveOkrVisibleOwnerIds(auth, store);
  if (visible) {
    objectives = objectives.filter(
      (o) =>
        visible.has(o.ownerId) ||
        allKrs.some((kr) => kr.objectiveId === o.id && visible.has(kr.ownerId)),
    );
  }

  const visibleObjectiveIds = new Set(objectives.map((o) => o.id));
  const enriched = objectives.map((objective) => ({
    ...objective,
    keyResults: allKrs.filter((kr) => kr.objectiveId === objective.id),
  }));

  const cycles = await store.cycles.list();
  return NextResponse.json({
    objectives: enriched,
    keyResults: allKrs.filter((kr) => visibleObjectiveIds.has(kr.objectiveId)),
    cycles,
  });
}
