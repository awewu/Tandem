import type { CalendarEvent } from '@/lib/types/feishu-catchup';
import type { WorkRiskPerson, WorkRiskSignal } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

function personName(peopleById: Map<string, WorkRiskPerson>, userId: string): string {
  return peopleById.get(userId)?.name ?? userId;
}

function eventParticipants(event: CalendarEvent): string[] {
  return Array.from(new Set([event.ownerId, ...(event.attendees ?? [])].filter(Boolean)));
}

function canSeeCalendarEvidence(viewerUserId: string, event: CalendarEvent): boolean {
  return event.ownerId === viewerUserId || event.attendees.includes(viewerUserId);
}

function overlaps(a: CalendarEvent, b: CalendarEvent): boolean {
  return new Date(a.startAt) < new Date(b.endAt) && new Date(a.endAt) > new Date(b.startAt);
}

function isUpcoming(event: CalendarEvent, now: number, horizonDays: number): boolean {
  const start = new Date(event.startAt).getTime();
  return event.status !== 'cancelled' && start >= now && start <= now + horizonDays * DAY_MS;
}

function safeTitle(viewerUserId: string, event: CalendarEvent): string {
  return canSeeCalendarEvidence(viewerUserId, event) ? event.title : '一个受限日程存在风险';
}

export function buildCalendarWorkRiskSignals(input: {
  viewerUserId: string;
  people: WorkRiskPerson[];
  events: CalendarEvent[];
  now?: number;
}): WorkRiskSignal[] {
  const now = input.now ?? Date.now();
  const visibleUserIds = new Set(input.people.map((p) => p.id));
  const peopleById = new Map(input.people.map((p) => [p.id, p]));
  const upcoming = input.events.filter((event) => isUpcoming(event, now, 14));
  const signals: WorkRiskSignal[] = [];
  const conflictKeys = new Set<string>();

  for (let i = 0; i < upcoming.length; i++) {
    for (let j = i + 1; j < upcoming.length; j++) {
      const a = upcoming[i];
      const b = upcoming[j];
      if (!overlaps(a, b)) continue;
      const sharedVisiblePeople = eventParticipants(a).filter((userId) => visibleUserIds.has(userId) && eventParticipants(b).includes(userId));
      for (const userId of sharedVisiblePeople) {
        const key = [userId, a.id, b.id].sort().join(':');
        if (conflictKeys.has(key)) continue;
        conflictKeys.add(key);
        const evidenceVisible = canSeeCalendarEvidence(input.viewerUserId, a) && canSeeCalendarEvidence(input.viewerUserId, b);
        signals.push({
          id: `calendar:conflict:${key}`,
          source: 'calendar',
          subjectUserId: userId,
          subjectName: personName(peopleById, userId),
          severity: 'high',
          title: evidenceVisible ? `日程冲突: ${a.title} / ${b.title}` : '一组受限日程发生冲突',
          detail: evidenceVisible
            ? `${new Date(a.startAt).toLocaleString('zh-CN')} 与另一日程重叠`
            : '日程详情受限, 仅显示冲突风险',
          href: evidenceVisible ? '/calendar' : undefined,
          dueAt: a.startAt,
          evidence: {
            visibility: evidenceVisible ? 'full' : 'restricted',
            label: evidenceVisible ? '日程冲突' : '日程证据受限',
            href: evidenceVisible ? '/calendar' : undefined,
          },
        });
      }
    }
  }

  for (const event of upcoming) {
    const startsWithin24h = new Date(event.startAt).getTime() <= now + DAY_MS;
    if (!startsWithin24h) continue;
    const participants = eventParticipants(event).filter((userId) => visibleUserIds.has(userId));
    const isMeeting = participants.length > 1 || (event.attendeeEmails?.length ?? 0) > 0 || (event.externalAttendeeEmails?.length ?? 0) > 0;
    if (!isMeeting) continue;
    if (event.location || event.meetingUrl) continue;

    for (const userId of participants) {
      const evidenceVisible = canSeeCalendarEvidence(input.viewerUserId, event);
      signals.push({
        id: `calendar:incomplete:${event.id}:${userId}`,
        source: 'calendar',
        subjectUserId: userId,
        subjectName: personName(peopleById, userId),
        severity: 'medium',
        title: evidenceVisible ? `会议信息不完整: ${event.title}` : '一个临近会议缺少地点或链接',
        detail: evidenceVisible
          ? '会议将在 24 小时内开始, 但未填写地点/会议链接'
          : '会议详情受限, 仅显示准备风险',
        href: evidenceVisible ? '/calendar' : undefined,
        dueAt: event.startAt,
        evidence: {
          visibility: evidenceVisible ? 'full' : 'restricted',
          label: evidenceVisible ? '日程详情' : '日程证据受限',
          href: evidenceVisible ? '/calendar' : undefined,
        },
      });
    }
  }

  return signals;
}
