/**
 * PATCH  /api/1on1/action-items/[id]   — toggle done / 改 text/dueDate / linkedInitiativeId
 * DELETE /api/1on1/action-items/[id]
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getStore, boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';

async function loadAndAuthorize(itemId: string, requesterId: string, tenantId: string) {
  const store = getStore();
  const item = await store.oneOnOneActionItems.get(itemId);
  if (!item) {
    return { error: NextResponse.json({ error: 'not found' }, { status: 404 }) };
  }
  const meeting = await store.oneOnOneMeetings.get(item.meetingId);
  if (!meeting || meeting.tenantId !== tenantId) {
    return { error: NextResponse.json({ error: 'not found' }, { status: 404 }) };
  }
  if (meeting.managerId !== requesterId && meeting.reportId !== requesterId) {
    return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  }
  return { item, meeting };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { error } = await loadAndAuthorize(params.id, auth.userId, auth.tenantId);
  if (error) return error;
  try {
    const body = await req.json();
    const allowed = ['text', 'assigneeId', 'dueDate', 'done', 'linkedInitiativeId'];
    const patch: Record<string, unknown> = {};
    for (const k of allowed) if (k in body) patch[k] = body[k];
    patch.updatedAt = new Date().toISOString();
    const store = getStore();
    const updated = await store.oneOnOneActionItems.update(params.id, patch);
    return NextResponse.json({ actionItem: updated });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { error } = await loadAndAuthorize(params.id, auth.userId, auth.tenantId);
  if (error) return error;
  const store = getStore();
  await store.oneOnOneActionItems.delete(params.id);
  return NextResponse.json({ ok: true });
}
