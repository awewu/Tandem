/**
 * GET  /api/1on1            — list (mine: where managerId=me OR reportId=me)
 * POST /api/1on1            — create meeting (caller becomes managerId 默认)
 *
 * 隐私: list 时按 requester 调用 strip1on1ForRequester.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getStore } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { strip1on1ForRequester } from '@/lib/auth/strip';
import type { OneOnOneMeeting } from '@/lib/types/one-on-one';

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const { searchParams } = new URL(req.url);
    /** scope=mine (default) | manager | report | all (admin only) */
    const scope = searchParams.get('scope') ?? 'mine';
    const peerId = searchParams.get('peerId'); // 主管想看与某 report 的所有 1on1
    const store = getStore();
    let all = await store.oneOnOneMeetings.list({ tenantId: auth.tenantId });

    if (scope === 'all') {
      const isAdmin = auth.roles.includes('admin') || auth.roles.includes('hr') || auth.demo;
      if (!isAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    } else {
      all = all.filter((m) => m.managerId === auth.userId || m.reportId === auth.userId);
      if (peerId) {
        all = all.filter((m) => m.managerId === peerId || m.reportId === peerId);
      }
      if (scope === 'manager') all = all.filter((m) => m.managerId === auth.userId);
      if (scope === 'report') all = all.filter((m) => m.reportId === auth.userId);
    }
    // newest first
    all.sort((a, b) => (a.scheduledAt < b.scheduledAt ? 1 : -1));
    const stripped = all.map((m) => strip1on1ForRequester(m, auth.userId));
    return NextResponse.json({ meetings: stripped });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json();
    if (!body.reportId || !body.scheduledAt) {
      return NextResponse.json(
        { error: 'reportId and scheduledAt required' },
        { status: 400 },
      );
    }
    const store = getStore();
    const now = new Date().toISOString();
    const meeting = await store.oneOnOneMeetings.create({
      tenantId: auth.tenantId,
      managerId: body.managerId ?? auth.userId,
      reportId: body.reportId,
      cadence: body.cadence ?? 'biweekly',
      scheduledAt: body.scheduledAt,
      startedAt: null,
      completedAt: null,
      status: body.status ?? 'scheduled',
      agendaManager: body.agendaManager ?? null,
      agendaReport: body.agendaReport ?? null,
      noteProgress: null,
      noteBlockers: null,
      noteNextSteps: null,
      linkedKrIds: Array.isArray(body.linkedKrIds) ? body.linkedKrIds : [],
      moodScore: null,
      privateManagerNote: null,
      createdAt: now,
      updatedAt: now,
    } as Omit<OneOnOneMeeting, 'id'>);
    return NextResponse.json({ meeting });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
