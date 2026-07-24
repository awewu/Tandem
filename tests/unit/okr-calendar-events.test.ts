import { describe, expect, it } from 'vitest';
import { buildCurrentOkrOwnerIds, buildOkrCalendarEvents } from '@/lib/calendar/okr-calendar-events';
import type { CheckIn, Cycle, KeyResult, Objective } from '@/lib/store/okr';

const july1 = new Date('2026-07-01T00:00:00.000+08:00').getTime();
const july24 = new Date('2026-07-24T10:00:00.000+08:00').getTime();
const july30 = new Date('2026-07-30T09:00:00.000+08:00').getTime();

function cycle(patch: Partial<Cycle>): Cycle {
  return {
    id: 'cycle-1',
    name: '2026 Q3',
    type: 'quarter',
    startDate: july1,
    endDate: new Date('2026-09-30T23:59:59.000+08:00').getTime(),
    isActive: true,
    ...patch,
  };
}

function objective(patch: Partial<Objective>): Objective {
  return {
    id: 'obj-1',
    title: '我的目标',
    cycleId: 'cycle-1',
    ownerId: 'user-me',
    parentId: null,
    weight: 100,
    status: 'active',
    confidence: 'on-track',
    visibility: 'public',
    tags: [],
    createdAt: july1,
    updatedAt: july1,
    ...patch,
  };
}

function kr(patch: Partial<KeyResult>): KeyResult {
  return {
    id: 'kr-1',
    objectiveId: 'obj-1',
    title: '我的 KR',
    ownerId: 'user-me',
    type: 'percentage',
    startValue: 0,
    currentValue: 10,
    targetValue: 100,
    unit: '%',
    weight: 100,
    confidence: 'on-track',
    status: 'active',
    dueDate: july30,
    tags: [],
    createdAt: july1,
    updatedAt: july1,
    ...patch,
  };
}

function checkIn(patch: Partial<CheckIn>): CheckIn {
  return {
    id: 'ci-1',
    scope: 'kr',
    scopeId: 'kr-1',
    authorId: 'user-me',
    progressBefore: 0,
    progressAfter: 10,
    confidenceBefore: 'on-track',
    confidenceAfter: 'on-track',
    createdAt: july24,
    ...patch,
  };
}

describe('OKR calendar derived events', () => {
  it('does not include the legacy demo owner when an authenticated user exists', () => {
    expect(buildCurrentOkrOwnerIds({
      legacyCurrentUserId: 'me',
      authUserId: 'user-real',
      authEmail: 'real@example.com',
    })).toEqual(['user-real', 'person:user-real', 'real@example.com', 'person:real@example.com']);
  });

  it('only derives calendar events from the current user related OKRs', () => {
    const events = buildOkrCalendarEvents({
      cycles: [
        cycle({ id: 'cycle-my', name: '我的周期' }),
        cycle({ id: 'cycle-other', name: '别人的周期' }),
      ],
      objectives: [
        objective({ id: 'obj-my', cycleId: 'cycle-my', ownerId: 'user-me', title: '我的目标' }),
        objective({ id: 'obj-other', cycleId: 'cycle-other', ownerId: 'user-other', title: '别人的目标' }),
      ],
      keyResults: [
        kr({ id: 'kr-my', objectiveId: 'obj-my', ownerId: 'user-me', title: '我的 KR' }),
        kr({ id: 'kr-other', objectiveId: 'obj-other', ownerId: 'user-other', title: '别人的 KR' }),
      ],
      checkIns: [
        checkIn({ id: 'ci-my', scopeId: 'kr-my', authorId: 'user-me', progressAfter: 20 }),
        checkIn({ id: 'ci-other', scopeId: 'kr-other', authorId: 'user-other', progressAfter: 80 }),
      ],
      currentOwnerIds: ['user-me'],
      nameOf: (ownerId) => ownerId ?? '',
    });

    const titles = events.map((event) => event.title);
    expect(titles).toContain('KR截止: 我的 KR');
    expect(titles).toContain('OKR Check-in');
    expect(titles).toContain('我的周期 开始');
    expect(titles).not.toContain('KR截止: 别人的 KR');
    expect(titles).not.toContain('别人的周期 开始');
    expect(events.find((event) => event.title === 'OKR Check-in')?.description).not.toContain('user-other');
  });

  it('includes KRs assigned to the current user even when the objective owner is another person', () => {
    const events = buildOkrCalendarEvents({
      cycles: [cycle({ id: 'cycle-team', name: '团队周期' })],
      objectives: [objective({ id: 'obj-team', cycleId: 'cycle-team', ownerId: 'user-other', title: '团队目标' })],
      keyResults: [kr({ id: 'kr-assigned', objectiveId: 'obj-team', ownerId: 'person:user-me', title: '分配给我的 KR' })],
      checkIns: [checkIn({ id: 'ci-assigned', scopeId: 'kr-assigned', authorId: 'user-other', progressAfter: 50 })],
      currentOwnerIds: ['user-me'],
      nameOf: (ownerId) => ownerId ?? '',
    });

    expect(events.map((event) => event.title)).toEqual([
      '团队周期 开始',
      'OKR Check-in',
      'KR截止: 分配给我的 KR',
      '团队周期 结束',
    ]);
  });
});
