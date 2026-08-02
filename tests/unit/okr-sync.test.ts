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
  objectiveToBody,
  keyResultToBody,
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

  // P0-1 闭环回归: 服务端手动覆盖进度 0-1 → 客户端 0-100 (此前硬编码 null → 刷新丢覆盖).
  it('progressOverride: 服务端 0-1 → 客户端 0-100', () => {
    expect(mapServerObjective({ ...server, progressOverride: 0.7 }).progressOverride).toBe(70);
    expect(mapServerObjective({ ...server, progressOverride: 0 }).progressOverride).toBe(0);
    expect(mapServerObjective({ ...server, progressOverride: 1 }).progressOverride).toBe(100);
  });
  it('progressOverride: 服务端 null/undefined → 客户端 null (回退 rollup)', () => {
    expect(mapServerObjective({ ...server, progressOverride: null }).progressOverride).toBeNull();
    expect(mapServerObjective({ ...server, progressOverride: undefined }).progressOverride).toBeNull();
  });
});

// P0-1 闭环回归: 客户端 → 服务端下发, 与 mapServerObjective 构成往返闭环.
describe('P0-1 · objectiveToBody · progressOverride 双向闭环', () => {
  it('客户端 0-100 → 服务端 0-1', () => {
    expect(objectiveToBody({ progressOverride: 70 }).progressOverride).toBe(0.7);
    expect(objectiveToBody({ progressOverride: 0 }).progressOverride).toBe(0);
    expect(objectiveToBody({ progressOverride: 100 }).progressOverride).toBe(1);
  });
  it('null 显式清除覆盖 → 原样下发 null', () => {
    expect(objectiveToBody({ progressOverride: null }).progressOverride).toBeNull();
  });
  it('字段缺失 → 不下发 (undefined, 避免部分更新误清覆盖)', () => {
    const body = objectiveToBody({ title: '只改标题' });
    expect(body.progressOverride).toBeUndefined();
  });
  it('往返: 客户端整数百分比 → 服务端 → 客户端 数值稳定', () => {
    for (const pct of [0, 25, 67, 70, 100]) {
      const server = objectiveToBody({ progressOverride: pct }).progressOverride as number;
      const back = mapServerObjective({
        id: 'o', cycleId: 'c', level: 'individual', ownerId: 'u', title: 't',
        visibility: 'public', weight: 100, status: 'active', confidence: 'on-track',
        tags: [], collaboratorIds: [], watcherIds: [], progressOverride: server,
        createdAt: ISO, updatedAt: ISO,
      } as Server.Objective).progressOverride;
      expect(back).toBe(pct);
    }
  });
});

// P0-2 闭环回归: 评分/复盘字段必须进 body (此前 objectiveToBody 完全不含 → 落库无门).
describe('P0-2 · objectiveToBody · 评分/复盘落库', () => {
  it('score → finalScore (改名), selfScore/managerScore 原样, reviewedAt ms→ISO', () => {
    const body = objectiveToBody({
      selfScore: 0.6, managerScore: 0.7, score: 0.8,
      retrospective: '复盘', reviewedAt: ISO_MS,
    });
    expect(body.selfScore).toBe(0.6);
    expect(body.managerScore).toBe(0.7);
    expect(body.finalScore).toBe(0.8);       // client score → server finalScore
    expect(body.retrospective).toBe('复盘');
    expect(body.reviewedAt).toBe(ISO);        // ms → ISO 字符串
  });
  it('字段缺失 → 不下发 (undefined, 避免误清评分)', () => {
    const body = objectiveToBody({ title: '只改标题' });
    expect(body.selfScore).toBeUndefined();
    expect(body.managerScore).toBeUndefined();
    expect(body.finalScore).toBeUndefined();
    expect(body.retrospective).toBeUndefined();
    expect(body.reviewedAt).toBeUndefined();
  });
  it('null 显式清空评分 → 原样下发 null', () => {
    const body = objectiveToBody({ selfScore: null, managerScore: null, score: null });
    expect(body.selfScore).toBeNull();
    expect(body.managerScore).toBeNull();
    expect(body.finalScore).toBeNull();
  });
});

describe('P0-2 · keyResultToBody · KR 自评/终评落库', () => {
  it('selfScore/finalScore 存在则下发, 缺失则 undefined', () => {
    expect(keyResultToBody({ selfScore: 0.5 }).selfScore).toBe(0.5);
    expect(keyResultToBody({ finalScore: 0.9 }).finalScore).toBe(0.9);
    const empty = keyResultToBody({ title: 't' });
    expect(empty.selfScore).toBeUndefined();
    expect(empty.finalScore).toBeUndefined();
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
