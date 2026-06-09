/**
 * POST /api/360/cycles/[id]/assignments   — bulk create rater assignments
 *   body: { assignments: { subjectId, raterId, raterType }[] }
 *   仅 admin/hr/champion/createdBy
 *
 * GET  /api/360/cycles/[id]/assignments   — list (mine: where raterId=me OR subjectId=me)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getStore, boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { DATA_STEWARD_ROLES } from '@/lib/auth/roles';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const store = getStore();
  const cycle = await store.review360Cycles.get(params.id);
  if (!cycle || cycle.tenantId !== auth.tenantId) {
    return NextResponse.json({ error: 'cycle not found' }, { status: 404 });
  }
  const isPriv =
    auth.demo ||
    cycle.createdBy === auth.userId ||
    auth.roles.some((r) => ([...DATA_STEWARD_ROLES, 'champion'] as string[]).includes(r));
  if (!isPriv) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  try {
    const body = await req.json();
    const list = Array.isArray(body.assignments) ? body.assignments : [];
    if (list.length === 0) {
      return NextResponse.json({ error: 'assignments[] required' }, { status: 400 });
    }
    const now = new Date().toISOString();
    const existing = await store.review360Assignments.list({ cycleId: params.id });
    const existingKey = new Set(existing.map((a) => `${a.subjectId}:${a.raterId}`));
    const created = [];
    for (const a of list) {
      const key = `${a.subjectId}:${a.raterId}`;
      if (existingKey.has(key)) continue; // 跳过 (cycleId, subjectId, raterId) 唯一
      if (!a.subjectId || !a.raterId || !a.raterType) continue;
      const item = await store.review360Assignments.create({
        cycleId: params.id,
        subjectId: a.subjectId,
        raterId: a.raterId,
        raterType: a.raterType,
        submitted: false,
        submittedAt: null,
        createdAt: now,
      });
      created.push(item);
    }
    return NextResponse.json({ created, skipped: list.length - created.length });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const store = getStore();
  const all = await store.review360Assignments.list({ cycleId: params.id });
  // mine: raterId=me OR subjectId=me
  const mine = all.filter((a) => a.raterId === auth.userId || a.subjectId === auth.userId);
  return NextResponse.json({ assignments: mine });
}
