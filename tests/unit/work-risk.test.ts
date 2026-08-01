import { describe, expect, it } from 'vitest';
import type { AuthContext } from '@/lib/auth/require-auth';
import type { AuthUser } from '@/lib/storage/repository';
import { resolveWorkRiskPeople } from '@/lib/work-risk/scope';
import { buildWorkRiskBoard } from '@/lib/work-risk/board';
import type { Cycle, Initiative, KeyResult, Objective } from '@/lib/store';
import type { Approval } from '@/lib/types/approval';
import type { CalendarEvent } from '@/lib/types/feishu-catchup';

function auth(userId: string, roles: string[] = []): AuthContext {
  return {
    userId,
    email: `${userId}@example.com`,
    tenantId: 'default',
    roles,
    mfaVerified: false,
    demo: false,
  };
}

const users: AuthUser[] = [
  { id: 'u-manager', email: 'm@example.com', name: '经理', roles: ['manager'], tenantId: 'default' },
  { id: 'u-a', email: 'a@example.com', name: '甲', roles: [], tenantId: 'default', managerId: 'u-manager' },
  { id: 'u-b', email: 'b@example.com', name: '乙', roles: [], tenantId: 'default' },
];

describe('resolveWorkRiskPeople', () => {
  it('普通用户只能看自己', () => {
    const result = resolveWorkRiskPeople({ auth: auth('u-a'), users, requestedScope: 'team' });
    expect(result.ok).toBe(false);
    expect(result.allowedScopes).toEqual(['self']);
  });

  it('经理可以看自己和直属下属', () => {
    const result = resolveWorkRiskPeople({ auth: auth('u-manager', ['manager']), users, requestedScope: 'team' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.people.map((p) => p.id).sort()).toEqual(['u-a', 'u-manager']);
  });

  it('特权角色可以看组织范围', () => {
    const result = resolveWorkRiskPeople({ auth: auth('u-manager', ['steward']), users, requestedScope: 'organization' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.people.map((p) => p.id).sort()).toEqual(['u-a', 'u-b', 'u-manager']);
  });
});

describe('buildWorkRiskBoard', () => {
  const now = Date.UTC(2026, 5, 15);
  const cycles: Cycle[] = [
    {
      id: 'cy-2026-h1',
      name: '2026 H1',
      type: 'half',
      startDate: Date.UTC(2026, 0, 1),
      endDate: Date.UTC(2026, 5, 30),
      isActive: true,
    },
  ];
  const objective: Objective = {
    id: 'obj-1',
    title: '完成系统落地',
    cycleId: 'cy-2026-h1',
    ownerId: 'u-a',
    weight: 100,
    status: 'active',
    confidence: 'on-track',
    visibility: 'private',
    tags: [],
    progressOverride: 10,
    createdAt: now,
    updatedAt: now,
  };
  const keyResults: KeyResult[] = [
    {
      id: 'kr-1',
      objectiveId: 'obj-1',
      title: '交付关键路径',
      ownerId: 'u-a',
      type: 'percentage',
      startValue: 0,
      currentValue: 10,
      targetValue: 100,
      unit: '%',
      weight: 100,
      confidence: 'on-track',
      status: 'active',
      tags: [],
      createdAt: now,
      updatedAt: now,
    },
  ];
  const initiatives: Initiative[] = [
    {
      id: 'init-1',
      scope: 'objective',
      scopeId: 'obj-1',
      title: '补齐上线检查',
      ownerId: 'u-a',
      status: 'in-progress',
      priority: 'high',
      dueDate: now - 86_400_000,
      tags: [],
      createdAt: now,
      updatedAt: now,
    },
  ];

  it('按可见人员聚合 OKR 风险并限制私有证据', () => {
    const board = buildWorkRiskBoard({
      viewerUserId: 'u-manager',
      scope: 'team',
      allowedScopes: ['self', 'team'],
      people: [
        { id: 'u-manager', name: '经理' },
        { id: 'u-a', name: '甲', managerId: 'u-manager' },
      ],
      cycles,
      objectives: [objective],
      keyResults,
      initiatives,
      now,
    });

    expect(board.summary.signalCount).toBe(2);
    expect(board.summary.restrictedEvidence).toBe(2);
    expect(board.signals.every((signal) => signal.subjectUserId === 'u-a')).toBe(true);
    expect(board.signals.every((signal) => signal.evidence.visibility === 'restricted')).toBe(true);
    expect(board.signals.some((signal) => signal.title.includes('完成系统落地'))).toBe(false);
  });

  it('本人可以看到私有 OKR 证据', () => {
    const board = buildWorkRiskBoard({
      viewerUserId: 'u-a',
      scope: 'self',
      allowedScopes: ['self'],
      people: [{ id: 'u-a', name: '甲' }],
      cycles,
      objectives: [objective],
      keyResults,
      initiatives,
      now,
    });

    expect(board.summary.signalCount).toBe(2);
    expect(board.summary.restrictedEvidence).toBe(0);
    expect(board.signals.some((signal) => signal.title === '完成系统落地')).toBe(true);
  });

  it('接入流程审批风险并裁剪非参与者证据', () => {
    const approvals: Approval[] = [
      {
        id: 'apv-1',
        tenantId: 'default',
        title: '采购申请',
        type: 'expense',
        status: 'pending',
        requester: 'u-b',
        approver: 'u-a',
        createdAt: new Date(now - 4 * 86_400_000).toISOString(),
      },
    ];
    const board = buildWorkRiskBoard({
      viewerUserId: 'u-manager',
      scope: 'team',
      allowedScopes: ['self', 'team'],
      people: [
        { id: 'u-manager', name: '经理' },
        { id: 'u-a', name: '甲', managerId: 'u-manager' },
      ],
      cycles,
      objectives: [],
      keyResults: [],
      initiatives: [],
      approvals,
      now,
    });

    const approvalSignal = board.signals.find((signal) => signal.source === 'approval');
    expect(approvalSignal?.severity).toBe('high');
    expect(approvalSignal?.subjectUserId).toBe('u-a');
    expect(approvalSignal?.evidence.visibility).toBe('restricted');
    expect(approvalSignal?.title).not.toContain('采购申请');
  });

  it('接入日程冲突并限制非参与者查看详情', () => {
    const calendarEvents: CalendarEvent[] = [
      {
        id: 'cal-1',
        title: '评审会',
        startAt: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
        endAt: new Date(now + 3 * 60 * 60 * 1000).toISOString(),
        timezone: 'Asia/Shanghai',
        allDay: false,
        ownerId: 'u-a',
        attendees: ['u-a'],
        calendarSource: 'manual',
        status: 'confirmed',
        tenantId: 'default',
        createdAt: new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString(),
      },
      {
        id: 'cal-2',
        title: '项目会',
        startAt: new Date(now + 2.5 * 60 * 60 * 1000).toISOString(),
        endAt: new Date(now + 3.5 * 60 * 60 * 1000).toISOString(),
        timezone: 'Asia/Shanghai',
        allDay: false,
        ownerId: 'u-a',
        attendees: ['u-a'],
        calendarSource: 'manual',
        status: 'confirmed',
        tenantId: 'default',
        createdAt: new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString(),
      },
    ];
    const board = buildWorkRiskBoard({
      viewerUserId: 'u-manager',
      scope: 'team',
      allowedScopes: ['self', 'team'],
      people: [
        { id: 'u-manager', name: '经理' },
        { id: 'u-a', name: '甲', managerId: 'u-manager' },
      ],
      cycles,
      objectives: [],
      keyResults: [],
      initiatives: [],
      calendarEvents,
      now,
    });

    const calendarSignal = board.signals.find((signal) => signal.source === 'calendar' && signal.id.includes('conflict'));
    expect(calendarSignal?.severity).toBe('high');
    expect(calendarSignal?.subjectUserId).toBe('u-a');
    expect(calendarSignal?.evidence.visibility).toBe('restricted');
    expect(calendarSignal?.title).not.toContain('评审会');
  });

  it('接入 IM 未读和可见消息中的工作指派', () => {
    const board = buildWorkRiskBoard({
      viewerUserId: 'u-manager',
      scope: 'team',
      allowedScopes: ['self', 'team'],
      people: [
        { id: 'u-manager', name: '经理' },
        { id: 'u-a', name: '甲', managerId: 'u-manager' },
      ],
      cycles,
      objectives: [],
      keyResults: [],
      initiatives: [],
      imChannels: [
        {
          subjectUserId: 'u-a',
          channel: { id: 'ch-private', name: '私密群', type: 'group', memberIds: ['u-a'] },
          unreadCount: 2,
          hasUnreadMention: true,
          viewerIsMember: false,
        },
      ],
      imMessages: [
        {
          channel: { id: 'ch-team', name: '团队群', type: 'group', memberIds: ['u-manager', 'u-a'] },
          message: {
            id: 'msg-1',
            senderId: 'u-manager',
            body: '@[甲](u-a:assign) 请跟进交付安排',
            mentions: [{ userId: 'u-a', start: 0, end: 17, kind: 'assign' }],
            createdAt: new Date(now).toISOString(),
          },
        },
      ],
      now,
    });

    const restrictedUnread = board.signals.find((signal) => signal.id.startsWith('im:unread'));
    const fullMention = board.signals.find((signal) => signal.id.startsWith('im:mention'));
    expect(restrictedUnread?.evidence.visibility).toBe('restricted');
    expect(fullMention?.evidence.visibility).toBe('full');
    expect(fullMention?.detail).toContain('跟进交付安排');
  });
});
