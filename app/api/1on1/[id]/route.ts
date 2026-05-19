/**
 * GET    /api/1on1/[id]   — fetch single (with action items)
 * PATCH  /api/1on1/[id]   — update fields
 * DELETE /api/1on1/[id]   — only manager can delete
 *
 * 隐私: 仅 manager / report 可访问. privateManagerNote/moodScore 仅 manager.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getStore, boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { strip1on1ForRequester } from '@/lib/auth/strip';

async function loadAndAuthorize(
  id: string,
  requesterId: string,
  tenantId: string,
) {
  const store = getStore();
  const meeting = await store.oneOnOneMeetings.get(id);
  if (!meeting || meeting.tenantId !== tenantId) {
    return { error: NextResponse.json({ error: 'not found' }, { status: 404 }) };
  }
  if (meeting.managerId !== requesterId && meeting.reportId !== requesterId) {
    return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  }
  return { meeting };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { meeting, error } = await loadAndAuthorize(params.id, auth.userId, auth.tenantId);
  if (error) return error;
  const store = getStore();
  const items = await store.oneOnOneActionItems.list({ meetingId: params.id });
  items.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  return NextResponse.json({
    meeting: strip1on1ForRequester(meeting!, auth.userId),
    actionItems: items,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { meeting, error } = await loadAndAuthorize(params.id, auth.userId, auth.tenantId);
  if (error) return error;
  try {
    const body = await req.json();
    const isManager = meeting!.managerId === auth.userId;
    /** 字段白名单: 防止改 ownership/tenantId */
    const allowedAll = [
      'cadence', 'scheduledAt', 'startedAt', 'completedAt', 'status',
      'agendaManager', 'agendaReport', 'noteProgress', 'noteBlockers',
      'noteNextSteps', 'linkedKrIds',
    ];
    const allowedManagerOnly = ['moodScore', 'privateManagerNote'];
    const patch: Record<string, unknown> = {};
    for (const k of allowedAll) if (k in body) patch[k] = body[k];
    if (isManager) {
      for (const k of allowedManagerOnly) if (k in body) patch[k] = body[k];
    }
    patch.updatedAt = new Date().toISOString();
    const store = getStore();
    const updated = await store.oneOnOneMeetings.update(params.id, patch);
    return NextResponse.json({ meeting: strip1on1ForRequester(updated, auth.userId) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { meeting, error } = await loadAndAuthorize(params.id, auth.userId, auth.tenantId);
  if (error) return error;
  if (meeting!.managerId !== auth.userId) {
    return NextResponse.json({ error: 'only manager can delete' }, { status: 403 });
  }
  const store = getStore();
  // cascade: delete action items first
  const items = await store.oneOnOneActionItems.list({ meetingId: params.id });
  await Promise.all(items.map((i) => store.oneOnOneActionItems.delete(i.id)));
  await store.oneOnOneMeetings.delete(params.id);
  return NextResponse.json({ ok: true });
}
