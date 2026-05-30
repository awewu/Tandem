/**
 * Learning closure · onLessonCompleted 三柱闭环测试
 *
 * 验证一节课完成后:
 *   1. attempt.passed=false → 跳过闭环
 *   2. lesson.linkedKrId → 产生 krProgressDelta
 *   3. lesson.rewardMode/Score → 产生 proficiencyDelta
 *   4. mandatory_once → certification 无过期
 *   5. mandatory_quarterly → certification 有 90 天过期
 *   6. Persona Memory candidate 始终产出
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { onLessonCompleted, setClosureStoreGetter } from '@/lib/learning/closure';
import type { Lesson, LessonAttempt } from '@/lib/learning/types';
import type { TandemStore } from '@/lib/storage/repository';

function makeAttempt(overrides: Partial<LessonAttempt> = {}): LessonAttempt {
  return {
    id: 'a1',
    lessonId: 'l1',
    userId: 'u1',
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    score: 85,
    passed: true,
    ...overrides,
  };
}

function makeLesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: 'l1',
    title: 'test',
    category: 'products',
    requirement: 'recommended',
    durationMin: 10,
    summary: 's',
    sourceRefs: [],
    ...overrides,
  };
}

describe('onLessonCompleted · 三柱闭环', () => {
  it('未通过 → 跳过闭环 (success=false)', async () => {
    const res = await onLessonCompleted({
      attempt: makeAttempt({ passed: false }),
      lesson: makeLesson(),
    });
    expect(res.success).toBe(false);
    expect(res.warnings[0]).toMatch(/passed=false/);
  });

  it('linkedKrId → krProgressDelta', async () => {
    const res = await onLessonCompleted({
      attempt: makeAttempt(),
      lesson: makeLesson({ linkedKrId: 'kr_42' }),
    });
    expect(res.success).toBe(true);
    expect(res.effects.krProgressDelta?.krId).toBe('kr_42');
    expect(res.effects.krProgressDelta?.deltaPercent).toBeGreaterThan(0);
  });

  it('rewardMode + rewardScore → proficiencyDelta', async () => {
    const res = await onLessonCompleted({
      attempt: makeAttempt(),
      lesson: makeLesson({ rewardMode: 'design', rewardScore: 5 }),
    });
    expect(res.effects.proficiencyDelta).toEqual({
      mode: 'design',
      addedScore: 5,
    });
  });

  it('mandatory_once → certification 无 expiresAt', async () => {
    const res = await onLessonCompleted({
      attempt: makeAttempt(),
      lesson: makeLesson({ requirement: 'mandatory_once' }),
    });
    expect(res.effects.certification).toBeDefined();
    expect(res.effects.certification?.expiresAt).toBeUndefined();
  });

  it('mandatory_quarterly → certification 90 天过期', async () => {
    const res = await onLessonCompleted({
      attempt: makeAttempt(),
      lesson: makeLesson({ requirement: 'mandatory_quarterly' }),
    });
    expect(res.effects.certification).toBeDefined();
    const expMs = Date.parse(res.effects.certification!.expiresAt!);
    const days = (expMs - Date.now()) / 86400_000;
    expect(days).toBeGreaterThan(89);
    expect(days).toBeLessThan(91);
  });

  it('recommended → 不发证书', async () => {
    const res = await onLessonCompleted({
      attempt: makeAttempt(),
      lesson: makeLesson({ requirement: 'recommended' }),
    });
    expect(res.effects.certification).toBeUndefined();
  });

  it('始终产生 Persona Memory candidate', async () => {
    const res = await onLessonCompleted({
      attempt: makeAttempt({ score: 92 }),
      lesson: makeLesson({ title: 'Tandem 入门' }),
    });
    expect(res.effects.personaMemoryCandidate?.lessonId).toBe('l1');
    expect(res.effects.personaMemoryCandidate?.summary).toContain('Tandem 入门');
    expect(res.effects.personaMemoryCandidate?.summary).toContain('92');
  });
});

// ===========================================================================
// 真扭转: 注入 mock store, 验证 store.create / update 被真调
// ===========================================================================

interface CallLog {
  attemptCreate: number;
  certCreate: number;
  enrollCreate: number;
  enrollUpdate: number;
  checkInCreate: number;
  personaUpdate: Array<Record<string, unknown>>;
  keyResultGet: number;
}

function buildMockStore(opts: {
  persona?: { id: string; userId: string; modeProficiency?: Record<string, number> };
  kr?: { id: string; currentValue?: number };
}): { store: TandemStore; log: CallLog } {
  const log: CallLog = {
    attemptCreate: 0,
    certCreate: 0,
    enrollCreate: 0,
    enrollUpdate: 0,
    checkInCreate: 0,
    personaUpdate: [],
    keyResultGet: 0,
  };

  const enrollmentDb = new Map<string, unknown>();

  const store = {
    learningAttempts: {
      create: async () => {
        log.attemptCreate++;
        return null;
      },
    },
    learningCertifications: {
      create: async () => {
        log.certCreate++;
        return null;
      },
    },
    learningEnrollments: {
      get: async (id: string) => enrollmentDb.get(id) ?? null,
      create: async (row: { id: string }) => {
        log.enrollCreate++;
        enrollmentDb.set(row.id, row);
        return row;
      },
      update: async (id: string, patch: unknown) => {
        log.enrollUpdate++;
        const cur = enrollmentDb.get(id) as Record<string, unknown> | undefined;
        if (cur) enrollmentDb.set(id, { ...cur, ...(patch as object) });
        return cur;
      },
    },
    checkIns: {
      create: async () => {
        log.checkInCreate++;
        return null;
      },
    },
    keyResults: {
      get: async () => {
        log.keyResultGet++;
        return opts.kr ?? null;
      },
    },
    personas: {
      list: async () => (opts.persona ? [opts.persona] : []),
      update: async (_id: string, patch: Record<string, unknown>) => {
        log.personaUpdate.push(patch);
        return null;
      },
    },
  } as unknown as TandemStore;

  return { store, log };
}

describe('onLessonCompleted · 真扭转 (mock store)', () => {
  afterEach(() => setClosureStoreGetter(null));

  it('linkedKrId → 真调 keyResults.get + checkIns.create', async () => {
    const { store, log } = buildMockStore({
      kr: { id: 'kr_42', currentValue: 30 },
    });
    setClosureStoreGetter(() => store);

    const res = await onLessonCompleted({
      attempt: makeAttempt(),
      lesson: makeLesson({ linkedKrId: 'kr_42' }),
    });

    expect(res.success).toBe(true);
    expect(log.keyResultGet).toBe(1);
    expect(log.checkInCreate).toBe(1);
    expect(res.effects.krProgressDelta?.krId).toBe('kr_42');
    expect(res.effects.krProgressDelta?.deltaPercent).toBe(5);
  });

  it('rewardMode → 真调 personas.update 累加 modeProficiency', async () => {
    const { store, log } = buildMockStore({
      persona: { id: 'p1', userId: 'u1', modeProficiency: { design: 40 } },
    });
    setClosureStoreGetter(() => store);

    const res = await onLessonCompleted({
      attempt: makeAttempt(),
      lesson: makeLesson({ rewardMode: 'design', rewardScore: 7 }),
    });

    expect(res.success).toBe(true);
    expect(log.personaUpdate).toHaveLength(1);
    expect(log.personaUpdate[0].modeProficiency).toEqual({ design: 47 });
    expect(res.effects.proficiencyDelta?.addedScore).toBe(7);
  });

  it('mandatory_quarterly → 真调 learningCertifications.create', async () => {
    const { store, log } = buildMockStore({});
    setClosureStoreGetter(() => store);

    await onLessonCompleted({
      attempt: makeAttempt(),
      lesson: makeLesson({ requirement: 'mandatory_quarterly' }),
    });

    expect(log.certCreate).toBe(1);
  });

  it('每次完成都 insert LessonAttempt + 维护 Enrollment.lessonsCompleted 去重', async () => {
    const { store, log } = buildMockStore({});
    setClosureStoreGetter(() => store);

    // 第 1 次完成 l1
    await onLessonCompleted({
      attempt: makeAttempt({ id: 'a1', lessonId: 'l1' }),
      lesson: makeLesson({ id: 'l1' }),
    });
    // 第 2 次完成 l2 (同用户)
    await onLessonCompleted({
      attempt: makeAttempt({ id: 'a2', lessonId: 'l2' }),
      lesson: makeLesson({ id: 'l2' }),
    });
    // 第 3 次重修 l1 (lessonsCompleted 不重复)
    await onLessonCompleted({
      attempt: makeAttempt({ id: 'a3', lessonId: 'l1' }),
      lesson: makeLesson({ id: 'l1' }),
    });

    expect(log.attemptCreate).toBe(3);
    expect(log.enrollCreate).toBe(1); // 仅第一次新建
    expect(log.enrollUpdate).toBe(2); // 第 2/3 次更新
  });

  it('persona 不存在 → 加 warning 不崩', async () => {
    const { store } = buildMockStore({});
    setClosureStoreGetter(() => store);

    const res = await onLessonCompleted({
      attempt: makeAttempt({ userId: 'ghost' }),
      lesson: makeLesson({ rewardMode: 'pm', rewardScore: 3 }),
    });

    expect(res.success).toBe(true);
    expect(res.warnings.some((w) => w.includes('Persona for ghost'))).toBe(true);
  });
});
