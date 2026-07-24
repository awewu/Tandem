import type { CalendarEvent } from '@/lib/store/calendar';
import type { CheckIn, Cycle, KeyResult, Objective } from '@/lib/store/okr';

type CalendarDraft = Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>;

export interface BuildOkrCalendarEventsInput {
  cycles: Cycle[];
  objectives: Objective[];
  keyResults: KeyResult[];
  checkIns: CheckIn[];
  currentOwnerIds: string[];
  nameOf: (ownerId: string | undefined | null) => string;
}

export function buildCurrentOkrOwnerIds(input: {
  legacyCurrentUserId: string;
  authUserId?: string | null;
  authEmail?: string | null;
}): string[] {
  const authenticatedIds = uniqueStrings([
    input.authUserId,
    input.authUserId ? `person:${input.authUserId}` : undefined,
    input.authEmail,
    input.authEmail ? `person:${input.authEmail}` : undefined,
  ]);
  if (authenticatedIds.length > 0) return authenticatedIds;
  return uniqueStrings([input.legacyCurrentUserId]);
}

export function buildOkrCalendarEvents(input: BuildOkrCalendarEventsInput): CalendarDraft[] {
  const ownerIds = normalizeOwnerIdSet(input.currentOwnerIds);
  if (ownerIds.size === 0) return [];

  const objectivesById = new Map(input.objectives.map((objective) => [objective.id, objective]));
  const myObjectiveIds = new Set<string>();
  for (const objective of input.objectives) {
    if (ownerMatches(objective.ownerId, ownerIds)) myObjectiveIds.add(objective.id);
  }

  const myKeyResults = input.keyResults.filter((kr) => (
    ownerMatches(kr.ownerId, ownerIds) ||
    (kr.collaborators ?? []).some((ownerId) => ownerMatches(ownerId, ownerIds)) ||
    myObjectiveIds.has(kr.objectiveId)
  ));
  const myKeyResultIds = new Set(myKeyResults.map((kr) => kr.id));
  for (const kr of myKeyResults) myObjectiveIds.add(kr.objectiveId);

  const events: CalendarDraft[] = [];
  const okrCalId = 'cal-okr';

  for (const kr of myKeyResults) {
    if (!kr?.dueDate) continue;
    const dueAt = toTime(kr.dueDate);
    if (Number.isNaN(dueAt)) continue;
    const objective = objectivesById.get(kr.objectiveId);
    events.push({
      calendarId: okrCalId,
      title: `KR截止: ${kr.title || '(无标题)'}`,
      startTime: new Date(new Date(dueAt).setHours(9, 0, 0, 0)).getTime(),
      endTime: new Date(new Date(dueAt).setHours(10, 0, 0, 0)).getTime(),
      isAllDay: false,
      type: 'okr_due',
      linkedKrId: kr.id,
      createdBy: 'system',
      status: 'confirmed',
      description: `目标: ${objective?.title ?? ''}\n负责人: ${input.nameOf(kr.ownerId)}`,
    });
  }

  const visibleCheckIns = input.checkIns.filter((checkIn) => (
    checkIn.scope === 'objective'
      ? myObjectiveIds.has(checkIn.scopeId)
      : myKeyResultIds.has(checkIn.scopeId)
  ));
  const checkInsByDay = new Map<number, CheckIn[]>();
  for (const checkIn of visibleCheckIns) {
    const createdAt = toTime(checkIn.createdAt);
    if (Number.isNaN(createdAt)) continue;
    const dayStart = new Date(createdAt).setHours(9, 30, 0, 0);
    checkInsByDay.set(dayStart, [...(checkInsByDay.get(dayStart) ?? []), checkIn]);
  }
  for (const [dayStart, items] of Array.from(checkInsByDay.entries())) {
    const sample = items.slice(0, 5).map((checkIn) => {
      const authorName = input.nameOf(checkIn.authorId);
      return `${checkIn.scope === 'objective' ? 'O' : 'KR'} · ${authorName} · ${checkIn.progressAfter ?? 0}%`;
    });
    events.push({
      calendarId: okrCalId,
      title: items.length === 1 ? 'OKR Check-in' : `OKR Check-in ${items.length} 条`,
      startTime: dayStart,
      endTime: dayStart + 30 * 60 * 1000,
      isAllDay: false,
      type: 'checkin',
      createdBy: 'system',
      status: 'confirmed',
      description: [
        `当天共有 ${items.length} 条 OKR 进度更新。`,
        ...sample,
        items.length > sample.length ? `另有 ${items.length - sample.length} 条未展开。` : '',
      ].filter(Boolean).join('\n'),
    });
  }

  const myCycleIds = new Set(
    input.objectives
      .filter((objective) => myObjectiveIds.has(objective.id))
      .map((objective) => objective.cycleId),
  );
  for (const cycle of input.cycles) {
    if (!myCycleIds.has(cycle.id) || !cycle.startDate || !cycle.endDate) continue;
    events.push({
      calendarId: okrCalId,
      title: `${cycle.name} 开始`,
      startTime: cycle.startDate,
      endTime: cycle.startDate + 60 * 60 * 1000,
      isAllDay: true,
      type: 'cycle',
      createdBy: 'system',
      status: 'confirmed',
    });
    events.push({
      calendarId: okrCalId,
      title: `${cycle.name} 结束`,
      startTime: cycle.endDate,
      endTime: cycle.endDate + 60 * 60 * 1000,
      isAllDay: true,
      type: 'cycle',
      createdBy: 'system',
      status: 'confirmed',
    });
  }

  return events.sort((left, right) => left.startTime - right.startTime);
}

function normalizeOwnerIdSet(values: string[]): Set<string> {
  const normalized = new Set<string>();
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    normalized.add(trimmed);
    normalized.add(trimmed.startsWith('person:') ? trimmed.slice(7) : `person:${trimmed}`);
  }
  return normalized;
}

function ownerMatches(ownerId: string | undefined, candidates: Set<string>): boolean {
  if (!ownerId) return false;
  return candidates.has(ownerId) || candidates.has(ownerId.startsWith('person:') ? ownerId.slice(7) : `person:${ownerId}`);
}

function toTime(value: number | string): number {
  return typeof value === 'number' ? value : Date.parse(value);
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))));
}
