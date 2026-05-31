/**
 * B4 Phase-1 · OKR 读路径收敛 mapper 测试 (2026-05-31)
 *
 * 覆盖服务端 (lib/types/okr-tti) → 客户端 (lib/store/okr) 的字段/枚举/时间戳映射,
 * 这是 client store 薄测试覆盖区的核心风险点.
 */

import { describe, it, expect } from 'vitest';
import {
  mapServerObjective,
  mapServerKeyResult,
  mapServerCycle,
  mapCyclePeriod,
  mapObjectiveStatus,
} from '@/lib/store/okr-sync';
import type * as Server from '@/lib/types/okr-tti';

const ISO = '2026-05-31T00:00:00.000Z';
const ISO_MS = Date.parse(ISO);

describe('B4 · ObjectiveStatus 映射', () => {
  it("'abandoned' → 'archived'", () => {
    expect(mapObjectiveStatus('abandoned')).toBe('archived');
  });
  it('其余枚举原样透传', () => {
    expect(mapObjectiveStatus('active')).toBe('active');
    expect(mapObjectiveStatus('paused')).toBe('paused');
    expect(mapObjectiveStatus('completed')).toBe('completed');
  });
});

describe('B4 · CyclePeriod 映射', () => {
  it('year/half/quarter/month 原样', () => {
    expect(mapCyclePeriod('year')).toBe('year');
    expect(mapCyclePeriod('half')).toBe('half');
    expect(mapCyclePeriod('quarter')).toBe('quarter');
    expect(mapCyclePeriod('month')).toBe('month');
  });
  it('bi_monthly / custom 回落 month', () => {
    expect(mapCyclePeriod('bi_monthly')).toBe('month');
    expect(mapCyclePeriod('custom')).toBe('month');
  });
});

describe('B4 · mapServerObjective', () => {
  const server: Server.Objective = {
    id: 'o1',
    cycleId: 'cy-2026',
    level: 'team',
    parentObjectiveId: 'o-parent',
    ownerId: 'u1',
    title: '提升交付质量',
    description: 'desc',
    visibility: 'team',
    weight: 80,
    status: 'abandoned',
    confidence: 'at-risk',
    tags: ['q3'],
    collaboratorIds: ['u2', 'u3'],
    watcherIds: ['u4'],
    selfScore: 0.7,
    managerScore: 0.6,
    finalScore: 0.8,
    retrospective: '复盘文本',
    reviewedAt: ISO,
    tenantId: 'default',
    createdAt: ISO,
    updatedAt: ISO,
  };

  it('字段名/枚举/时间戳全部正确映射', () => {
    const c = mapServerObjective(server);
    expect(c.id).toBe('o1');
    expect(c.parentId).toBe('o-parent');         // parentObjectiveId → parentId
    expect(c.collaborators).toEqual(['u2', 'u3']); // collaboratorIds → collaborators
    expect(c.watchers).toEqual(['u4']);            // watcherIds → watchers
    expect(c.status).toBe('archived');             // abandoned → archived
    expect(c.visibility).toBe('department');       // team → department
    expect(c.score).toBe(0.8);                     // finalScore → score
    expect(c.selfScore).toBe(0.7);
    expect(c.managerScore).toBe(0.6);
    expect(c.createdAt).toBe(ISO_MS);              // ISO → ms
    expect(c.updatedAt).toBe(ISO_MS);
    expect(c.reviewedAt).toBe(ISO_MS);
    expect(c.progressOverride).toBeNull();
    expect(c.weight).toBe(80);
  });

  it('parentObjectiveId 缺失 → parentId null', () => {
    const c = mapServerObjective({ ...server, parentObjectiveId: undefined });
    expect(c.parentId).toBeNull();
  });
});

describe('B4 · mapServerKeyResult', () => {
  const kr: Server.KeyResult = {
    id: 'kr1',
    objectiveId: 'o1',
    ownerId: 'u1',
    coOwnerIds: [],
    title: 'NPS ≥ 60',
    measureType: 'numeric',
    computeMethod: 'latest',
    startValue: 0,
    targetValue: 60,
    currentValue: 30,
    unit: '分',
    confidence: 'on-track',
    riskStatus: 'on_track',
    weight: 50,
    status: 'active',
    dueDate: ISO,
    tags: [],
    collaboratorIds: ['u9'],
    watcherIds: [],
    selfScore: null,
    finalScore: null,
    createdAt: ISO,
    updatedAt: ISO,
  };

  it('measureType → type, 时间戳/单位映射', () => {
    const c = mapServerKeyResult(kr);
    expect(c.type).toBe('numeric');           // measureType → type
    expect(c.unit).toBe('分');
    expect(c.collaborators).toEqual(['u9']);
    expect(c.dueDate).toBe(ISO_MS);
    expect(c.createdAt).toBe(ISO_MS);
    expect(c.currentValue).toBe(30);
  });

  it('unit 为 null → 空字符串', () => {
    const c = mapServerKeyResult({ ...kr, unit: null });
    expect(c.unit).toBe('');
  });
});

describe('B4 · mapServerCycle', () => {
  it('period → type, ISO → ms', () => {
    const c = mapServerCycle({
      id: 'cy-2026-q3',
      period: 'quarter',
      name: '2026 Q3',
      startDate: ISO,
      endDate: ISO,
      isActive: true,
    });
    expect(c.type).toBe('quarter');
    expect(c.startDate).toBe(ISO_MS);
    expect(c.isActive).toBe(true);
  });
});
