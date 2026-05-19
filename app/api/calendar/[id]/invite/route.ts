import { NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { getStore } from '@/lib/storage/repository';

/**
 * POST /api/calendar/[id]/invite
 * Body: { userIds: string[] }
 * 向会议添加参与者，并发送通知
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    await boot();
    const s = getStore();
    const ev = await s.calendarEvents.get(params.id);
    if (!ev) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await req.json();
    const userIds: string[] = body.userIds ?? [];
    const current = new Set(ev.attendees ?? []);
    userIds.forEach((uid) => current.add(uid));

    const updated = await s.calendarEvents.update(params.id, {
      attendees: Array.from(current),
    });

    // 发送邀请通知
    for (const uid of userIds) {
      if (!ev.attendees?.includes(uid)) {
        await s.notifications.create({
          userId: uid,
          type: 'reminder',
          title: `会议邀请: ${ev.title}`,
          body: `你被邀请参加 ${new Date(ev.startAt).toLocaleString()} 的会议`,
          data: { eventId: ev.id, inviter: ev.ownerId },
          priority: 'normal',
          channel: 'in-app',
          tenantId: ev.tenantId,
          createdAt: new Date().toISOString(),
        } as any);
      }
    }

    return NextResponse.json({ event: updated, invited: userIds });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
