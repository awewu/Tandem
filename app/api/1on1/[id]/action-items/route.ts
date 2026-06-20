/**
 * POST /api/1on1/[id]/action-items   — 在 meeting 下加 action item
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getStore, boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { withTenantScope } from '@/lib/multi-tenant/with-tenant-scope';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json();
    if (!body.text || !body.assigneeId) {
      return NextResponse.json({ error: 'text and assigneeId required' }, { status: 400 });
    }
    const store = getStore();
    const meeting = await withTenantScope(store.oneOnOneMeetings, auth.tenantId).get(params.id);
    if (!meeting) {
      return NextResponse.json({ error: 'meeting not found' }, { status: 404 });
    }
    if (meeting.managerId !== auth.userId && meeting.reportId !== auth.userId) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    const now = new Date().toISOString();
    const item = await store.oneOnOneActionItems.create({
      meetingId: params.id,
      text: body.text,
      assigneeId: body.assigneeId,
      dueDate: body.dueDate ?? null,
      done: false,
      linkedInitiativeId: null,
      createdAt: now,
      updatedAt: now,
    });
    return NextResponse.json({ actionItem: item });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
