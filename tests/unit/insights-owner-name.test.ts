import { describe, expect, it } from 'vitest';
import { generateInsights, type InsightInput } from '@/lib/insights/derive';

describe('insight owner names', () => {
  it('uses the organization display name instead of a raw user id', () => {
    const ownerId = 'user_mqhbv8zaol8q5ckx';
    const now = Date.now();
    const input: InsightInput = {
      objectives: [{
        id: 'obj-risk',
        title: '建设可持续的人才梯队',
        cycleId: 'cycle-1',
        ownerId,
        weight: 100,
        status: 'active',
        confidence: 'off-track',
        visibility: 'public',
        tags: [],
        createdAt: now,
        updatedAt: now,
      }],
      keyResults: [{
        id: 'kr-risk',
        objectiveId: 'obj-risk',
        title: '完成梯队建设',
        ownerId,
        type: 'percentage',
        startValue: 0,
        currentValue: 0,
        targetValue: 100,
        unit: '%',
        weight: 100,
        confidence: 'off-track',
        status: 'active',
        tags: [],
        createdAt: now,
        updatedAt: now,
      }],
      checkIns: [],
      meetings: [],
      submissions: [],
      cycles360: [],
      people: [{ id: ownerId, name: 'Steve' }],
      ownerNameById: { [ownerId]: 'Steve' },
      now,
    };

    const risk = generateInsights(input).find((item) => item.category === 'okr-risk');
    expect(risk?.detail).toContain('负责人 Steve');
    expect(risk?.detail).not.toContain(ownerId);
  });

  it('uses a neutral label when a historical person no longer exists', () => {
    const ownerId = 'user_deleted_123';
    const now = Date.now();
    const input: InsightInput = {
      objectives: [{
        id: 'obj-risk',
        title: '历史目标',
        cycleId: 'cycle-1',
        ownerId,
        weight: 100,
        status: 'active',
        confidence: 'off-track',
        visibility: 'public',
        tags: [],
        createdAt: now,
        updatedAt: now,
      }],
      keyResults: [{
        id: 'kr-risk',
        objectiveId: 'obj-risk',
        title: '历史 KR',
        ownerId,
        type: 'percentage',
        startValue: 0,
        currentValue: 0,
        targetValue: 100,
        unit: '%',
        weight: 100,
        confidence: 'off-track',
        status: 'active',
        tags: [],
        createdAt: now,
        updatedAt: now,
      }],
      checkIns: [],
      meetings: [],
      submissions: [],
      cycles360: [],
      people: [],
      now,
    };

    const risk = generateInsights(input).find((item) => item.category === 'okr-risk');
    expect(risk?.detail).toContain('负责人 未知人员');
    expect(risk?.detail).not.toContain(ownerId);
  });
});
